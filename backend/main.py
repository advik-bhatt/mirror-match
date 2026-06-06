"""
MirrorMatch FastAPI backend.

Provides endpoints for creating and streaming simulation sessions,
serving audio files, and retrieving scenario metadata.
"""

import asyncio
import json
import logging
import os
import uuid
from contextlib import asynccontextmanager

import httpx
from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .emotion import classify_emotion
from .redis_store import create_session, get_session
from .scenarios import SCENARIOS
from .simulator import run_simulation
from .usage import get_elevenlabs_balance

# Load environment variables from .env file at import time
load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("MirrorMatch backend starting up.")
    yield
    logger.info("MirrorMatch backend shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="MirrorMatch API",
    description="Emotion-aware voice agent evaluation platform backend.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response models ─────────────────────────────────────────────────

class CreateSessionRequest(BaseModel):
    scenario: str = "billing_issue"
    mode: str = "failing"


class CreateSessionResponse(BaseModel):
    session_id: str
    status: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}


@app.get("/api/scenarios")
async def list_scenarios():
    """
    Return all available simulation scenarios with their names and descriptions.
    """
    return [
        {
            "id": key,
            "name": value["name"],
            "description": value["description"],
            "turn_count": len(value["turns"]),
        }
        for key, value in SCENARIOS.items()
    ]


@app.post("/api/sessions", response_model=CreateSessionResponse, status_code=201)
async def create_session_endpoint(
    body: CreateSessionRequest,
    background_tasks: BackgroundTasks,
):
    """
    Create a new simulation session and start the simulation in the background.

    Returns immediately with a session_id that the client can use to stream
    events via GET /api/sessions/{session_id}/stream.
    """
    if body.scenario not in SCENARIOS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown scenario '{body.scenario}'. "
                   f"Valid options: {list(SCENARIOS.keys())}",
        )

    if body.mode not in ("passing", "failing"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid mode '{body.mode}'. Must be 'passing' or 'failing'.",
        )

    session_id = str(uuid.uuid4())
    config = {"scenario": body.scenario, "mode": body.mode}

    await create_session(session_id, config)

    background_tasks.add_task(
        run_simulation,
        session_id=session_id,
        scenario_name=body.scenario,
        mode=body.mode,
    )

    logger.info("Created session %s (scenario=%s mode=%s)", session_id, body.scenario, body.mode)

    return CreateSessionResponse(session_id=session_id, status="created")


@app.get("/api/sessions/{session_id}")
async def get_session_endpoint(session_id: str):
    """
    Retrieve the current state of a simulation session.

    Returns the session metadata, all completed turns, and the final report
    (if the session is complete).
    """
    session = await get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")
    return session


@app.get("/api/sessions/{session_id}/stream")
async def stream_session_events(session_id: str):
    """
    Server-Sent Events (SSE) stream for a simulation session.

    Immediately sends the current session state as the first event, then
    subscribes to the Redis pub/sub channel and forwards events until a
    "complete" event is received.
    """
    session = await get_session(session_id)
    if session is None:
        raise HTTPException(status_code=404, detail=f"Session '{session_id}' not found.")

    async def event_generator():
        sent_turns = 0

        # Send initial snapshot
        try:
            snapshot = await get_session(session_id)
            if snapshot:
                yield {"data": json.dumps({"type": "snapshot", "session": snapshot})}
        except Exception as exc:  # noqa: BLE001
            logger.warning("Snapshot failed for %s: %s", session_id, exc)

        # Poll Redis every 0.5s until session completes (max 90s)
        for _ in range(180):
            try:
                current = await get_session(session_id)
                if not current:
                    break

                turns = current.get("turns", [])
                for turn in turns[sent_turns:]:
                    yield {"data": json.dumps({"type": "turn", **turn})}
                    sent_turns += 1

                if current.get("status") == "complete":
                    yield {"data": json.dumps({"type": "complete", "report": current.get("report")})}
                    return

            except Exception as exc:  # noqa: BLE001
                logger.warning("Poll error for %s: %s", session_id, exc)

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@app.get("/api/usage")
async def get_usage_endpoint():
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"
    tts_enabled = os.getenv("ENABLE_TTS", "false").lower() == "true" and not mock_mode
    el_balance = await get_elevenlabs_balance()
    return {
        "mock_mode": mock_mode,
        "tts_enabled": tts_enabled,
        "elevenlabs": el_balance,
        "huggingface": {
            "status": "local" if not os.getenv("HUGGINGFACE_API_KEY") else "api",
            "model": "j-hartmann/emotion-english-distilroberta-base",
        },
    }


@app.get("/api/audio/{session_id}/{turn_num}/{speaker}")
async def serve_audio(session_id: str, turn_num: int, speaker: str):
    """
    Serve a pre-generated TTS audio file for a specific turn.

    Returns the .mp3 file if it exists, 404 otherwise.
    """
    if speaker not in ("caller", "agent"):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid speaker '{speaker}'. Must be 'caller' or 'agent'.",
        )

    audio_path = f"/tmp/mm_{session_id}_turn{turn_num}_{speaker}.mp3"

    if not os.path.isfile(audio_path):
        raise HTTPException(
            status_code=404,
            detail=f"Audio file not found for session={session_id} turn={turn_num} speaker={speaker}.",
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/mpeg",
        filename=f"turn{turn_num}_{speaker}.mp3",
    )


@app.post("/api/tavus/conversation")
async def create_tavus_conversation():
    """
    Create a Tavus CVI conversation for the Live Avatar panel.

    Returns a conversation_url that can be embedded as an iframe.
    Falls back to mock=True when TAVUS_API_KEY is not configured.
    """
    tavus_api_key = os.getenv("TAVUS_API_KEY")
    mock_mode = os.getenv("MOCK_MODE", "false").lower() == "true"

    if not tavus_api_key or tavus_api_key == "mock" or mock_mode:
        return {"conversation_url": None, "mock": True}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://tavusapi.com/v2/conversations",
                headers={"x-api-key": tavus_api_key},
                json={
                    "replica_id": os.getenv("TAVUS_REPLICA_ID", "r79e1c033f"),
                    "conversation_name": "MirrorMatch Demo",
                    "conversational_context": (
                        "You are a customer service agent for a company. "
                        "An angry customer is calling about an unauthorized $149 charge on their account. "
                        "Your job is to de-escalate the situation, show empathy, take ownership, and resolve the issue. "
                        "Do NOT deflect, do NOT say 'please email billing', do NOT put them on hold. "
                        "Offer a refund directly. Be warm, human, and decisive. "
                        "If the customer is very angry, slow down, acknowledge their frustration by name, and commit to a concrete resolution."
                    ),
                    "custom_greeting": (
                        "Thank you for calling, I'm here to help you. What can I assist you with today?"
                    ),
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                logger.info("Tavus conversation created: %s", data.get("conversation_id"))
                return {"conversation_url": data.get("conversation_url"), "mock": False}
            else:
                logger.warning("Tavus API returned %d: %s", resp.status_code, resp.text)
    except Exception as exc:
        logger.warning("Tavus API error: %s", exc)

    return {"conversation_url": None, "mock": True, "error": "Tavus API unavailable"}


class ClassifyRequest(BaseModel):
    text: str


@app.post("/api/classify")
async def classify_text(body: ClassifyRequest):
    """
    Classify the emotion of a text utterance.

    Used by the LiveCallPanel to score caller messages from the ElevenLabs
    Conversational AI session in real time.
    """
    scores = await classify_emotion(body.text)
    anger = scores.get("anger", 0.0)
    if anger >= 0.7:
        emotion_level = 3
    elif anger >= 0.4:
        emotion_level = 2
    elif anger >= 0.2:
        emotion_level = 1
    else:
        emotion_level = 0
    dominant = max(scores, key=scores.get)
    return {"scores": scores, "emotion_level": emotion_level, "dominant_emotion": dominant}
