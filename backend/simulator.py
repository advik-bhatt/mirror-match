"""
Async simulation engine for MirrorMatch.

Drives a full adversarial call simulation turn-by-turn, generating
emotion classifications and optional TTS audio for both the caller and
the agent, then grades the completed session.
"""

import asyncio
import logging
import os
from typing import Literal

from elevenlabs import ElevenLabs

from .emotion import classify_emotion
from .grader import grade_session
from .redis_store import (
    add_turn,
    publish_event,
    save_report,
    update_session_status,
)
from .scenarios import SCENARIOS

logger = logging.getLogger(__name__)

SimMode = Literal["passing", "failing"]

# Default voice IDs — can be overridden via environment variables.
# Agent voice defaults to same as caller to avoid paid-library-voice 402 errors.
_DEFAULT_CALLER_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"
_DEFAULT_AGENT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"


def get_audio_path(session_id: str, turn_num: int, speaker: str) -> str:
    """
    Return the expected filesystem path for a turn's audio file.

    Args:
        session_id: Unique session identifier.
        turn_num:   0-based turn index.
        speaker:    "caller" or "agent".

    Returns:
        Absolute path to the .mp3 file in /tmp.
    """
    return f"/tmp/mm_{session_id}_turn{turn_num}_{speaker}.mp3"


def _get_voice_ids() -> tuple[str, str]:
    """Return (caller_voice_id, agent_voice_id) from env with defaults."""
    caller = os.getenv("ELEVENLABS_CALLER_VOICE_ID", _DEFAULT_CALLER_VOICE_ID)
    agent = os.getenv("ELEVENLABS_AGENT_VOICE_ID", _DEFAULT_AGENT_VOICE_ID)
    return caller, agent


def _voice_stability(emotion_level: int) -> float:
    """
    Map an emotion level (0-3) to ElevenLabs voice stability.

    Higher emotion = lower stability = more expressive / less controlled speech.
    """
    return max(0.3, 1.0 - emotion_level * 0.2)


async def _generate_audio(
    text: str,
    voice_id: str,
    output_path: str,
    stability: float,
    api_key: str,
) -> str | None:
    """
    Generate TTS audio using the ElevenLabs SDK and save it to disk.

    Returns the output path on success, or None on failure.
    """
    try:
        client = ElevenLabs(api_key=api_key)
        audio_generator = client.text_to_speech.convert(
            voice_id=voice_id,
            text=text,
            model_id="eleven_multilingual_v2",
            voice_settings={
                "stability": stability,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        )
        # The SDK returns an iterator of bytes chunks — collect and write.
        with open(output_path, "wb") as f:
            for chunk in audio_generator:
                if chunk:
                    f.write(chunk)

        logger.debug("Audio saved to %s", output_path)
        return output_path

    except Exception as exc:  # noqa: BLE001
        logger.warning("ElevenLabs TTS failed for %s: %s", output_path, exc)
        return None


import hashlib
import shutil
import os as _os


def _get_cached_audio(text: str, voice_id: str, stability: float) -> str | None:
    """Return path to cached audio if it exists."""
    key = hashlib.md5(f"{text}{voice_id}{stability:.2f}".encode()).hexdigest()
    path = f"/tmp/mm_tts_cache/{key}.mp3"
    return path if _os.path.exists(path) else None


def _cache_audio(text: str, voice_id: str, stability: float, source_path: str) -> None:
    """Copy generated audio to cache."""
    os.makedirs("/tmp/mm_tts_cache", exist_ok=True)
    key = hashlib.md5(f"{text}{voice_id}{stability:.2f}".encode()).hexdigest()
    dest = f"/tmp/mm_tts_cache/{key}.mp3"
    if not os.path.exists(dest) and os.path.exists(source_path):
        shutil.copy2(source_path, dest)


async def run_simulation(
    session_id: str,
    scenario_name: str,
    mode: SimMode,
) -> None:
    """
    Execute a full simulation session and persist results to Redis.

    This is designed to run as a FastAPI BackgroundTask. All exceptions
    are caught internally so that a failure in one turn does not prevent
    the session from completing and being graded.

    Args:
        session_id:    Unique session identifier (already created in Redis).
        scenario_name: Key into the SCENARIOS dict (e.g. "billing_issue").
        mode:          "passing" or "failing" — controls which agent responses
                       are used and influences grading expectations.
    """
    scenario = SCENARIOS.get(scenario_name)
    if scenario is None:
        logger.error("Unknown scenario: %s", scenario_name)
        await update_session_status(session_id, "error")
        await publish_event(session_id, {"type": "error", "message": f"Unknown scenario: {scenario_name}"})
        return

    enable_tts = (
        os.getenv("ENABLE_TTS", "false").lower() == "true"
        and os.getenv("MOCK_MODE", "false").lower() != "true"
    )
    elevenlabs_api_key: str | None = os.getenv("ELEVENLABS_API_KEY") if enable_tts else None
    caller_voice_id, agent_voice_id = _get_voice_ids()

    await update_session_status(session_id, "running")
    await publish_event(
        session_id,
        {
            "type": "started",
            "scenario": scenario_name,
            "scenario_name": scenario["name"],
            "mode": mode,
            "total_turns": len(scenario["turns"]),
        },
    )

    turns_data: list[dict] = []

    for turn_index, turn in enumerate(scenario["turns"]):
        try:
            caller_text: str = turn["caller_text"]
            emotion_level: int = turn["emotion_level"]
            agent_response: str = (
                turn["passing_response"] if mode == "passing" else turn["failing_response"]
            )

            # ── Emotion classification ─────────────────────────────────────────
            emotion_scores: dict = {}
            try:
                emotion_scores = await classify_emotion(caller_text)
            except Exception as exc:  # noqa: BLE001
                logger.warning("Emotion classification failed for turn %d: %s", turn_index, exc)

            # ── TTS audio generation ───────────────────────────────────────────
            caller_audio_path: str | None = None
            agent_audio_path: str | None = None
            stability = _voice_stability(emotion_level)

            if elevenlabs_api_key:
                caller_output = get_audio_path(session_id, turn_index, "caller")
                cached = _get_cached_audio(caller_text, caller_voice_id, stability)
                if cached:
                    shutil.copy2(cached, caller_output)
                    caller_audio_path = caller_output
                else:
                    caller_audio_path = await _generate_audio(
                        text=caller_text,
                        voice_id=caller_voice_id,
                        output_path=caller_output,
                        stability=stability,
                        api_key=elevenlabs_api_key,
                    )
                    if caller_audio_path:
                        _cache_audio(caller_text, caller_voice_id, stability, caller_audio_path)

                agent_output = get_audio_path(session_id, turn_index, "agent")
                agent_audio_path = await _generate_audio(
                    text=agent_response,
                    voice_id=agent_voice_id,
                    output_path=agent_output,
                    stability=0.80,  # Agent always sounds composed
                    api_key=elevenlabs_api_key,
                )
            else:
                logger.warning(
                    "ELEVENLABS_API_KEY not set — skipping audio for turn %d.", turn_index
                )

            # ── Assemble turn record ───────────────────────────────────────────
            dominant = max(emotion_scores, key=emotion_scores.get) if emotion_scores else "neutral"
            turn_data = {
                "turn_number": turn_index + 1,
                "caller_message": caller_text,
                "emotion_level": emotion_level,
                "agent_response": agent_response,
                "emotion_scores": emotion_scores,
                "dominant_emotion": dominant,
                "caller_audio_path": caller_audio_path,
                "agent_audio_path": agent_audio_path,
                "mode": mode,
            }

            turns_data.append(turn_data)

            await add_turn(session_id, turn_data)
            await publish_event(
                session_id,
                {
                    "type": "turn",
                    **turn_data,
                },
            )

            logger.info(
                "Session %s — turn %d/%d complete (emotion_level=%d)",
                session_id,
                turn_index + 1,
                len(scenario["turns"]),
                emotion_level,
            )

        except Exception as exc:  # noqa: BLE001
            logger.exception("Unhandled error in turn %d of session %s: %s", turn_index, session_id, exc)
            # Record a minimal turn so the session can still be graded
            minimal_turn = {
                "turn_number": turn_index + 1,
                "caller_message": turn.get("caller_text", ""),
                "emotion_level": turn.get("emotion_level", 0),
                "agent_response": "",
                "emotion_scores": {},
                "dominant_emotion": "neutral",
                "caller_audio_path": None,
                "agent_audio_path": None,
                "mode": mode,
                "error": str(exc),
            }
            turns_data.append(minimal_turn)
            await add_turn(session_id, minimal_turn)

        # Pacing delay — gives the frontend time to animate between turns
        turn_delay = 1.0 if os.getenv("MOCK_MODE", "false").lower() == "true" else 2.5
        await asyncio.sleep(turn_delay)

    # ── Grade the completed session ────────────────────────────────────────────
    try:
        report = grade_session(turns_data, mode)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Grading failed for session %s: %s", session_id, exc)
        report = {
            "score": 0,
            "grade": "F",
            "passed": False,
            "error": str(exc),
            "insights": [],
        }

    await save_report(session_id, report)
    await publish_event(
        session_id,
        {
            "type": "complete",
            "report": report,
        },
    )

    logger.info(
        "Session %s complete — score=%s grade=%s passed=%s",
        session_id,
        report.get("score"),
        report.get("grade"),
        report.get("passed"),
    )
