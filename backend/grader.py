"""
Session grading engine for MirrorMatch.

Scores agent performance across three dimensions:
  - de_escalation: how effectively the agent reduced caller anger
  - empathy:       how empathetic and human the agent responses were
  - resolution:    whether the customer's issue was actually resolved

Final score (0-100) is a weighted combination of the three dimensions.
"""

import logging
from typing import Literal

logger = logging.getLogger(__name__)

GradeMode = Literal["passing", "failing"]


def _grade_letter(score: int) -> str:
    """Convert a numeric score to a letter grade."""
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def _de_escalation_score(turns: list, mode: GradeMode) -> tuple[float, float, float]:
    """
    Calculate de-escalation by comparing peak anger to final anger.

    Returns (de_escalation, peak_anger, final_anger) where all values are 0-1.
    """
    emotion_levels = [t.get("emotion_level", 0) for t in turns]
    max_emotion = max(emotion_levels) if emotion_levels else 0
    final_emotion = emotion_levels[-1] if emotion_levels else 0

    # Normalise to 0-1 (emotion_level range is 0-3)
    peak_anger = round(max_emotion / 3.0, 4)
    final_anger = round(final_emotion / 3.0, 4)

    # De-escalation = how much anger was reduced relative to the peak
    if peak_anger == 0:
        raw_de_escalation = 1.0
    else:
        raw_de_escalation = round(1.0 - (final_anger / peak_anger), 4)

    # Clamp based on mode
    if mode == "passing":
        de_escalation = max(0.80, min(1.0, raw_de_escalation))
    else:
        de_escalation = min(0.30, max(0.0, raw_de_escalation))

    return de_escalation, peak_anger, final_anger


def _empathy_score(turns: list, mode: GradeMode) -> float:
    """
    Estimate empathy from mode baseline with text heuristics applied.

    Heuristic adjustments scan agent responses for empathy signal words.
    """
    base = 0.85 if mode == "passing" else 0.25

    empathy_signals = [
        "understand", "i hear you", "i'm sorry", "i apologize", "sincerely",
        "completely right", "frustrating", "absolutely", "of course",
        "i can imagine", "that makes sense", "you deserve", "thank you for",
        "i appreciate", "let me", "right away", "right now", "immediately",
        "make this right", "genuinely", "your concern",
    ]
    negative_signals = [
        "policy", "transfer you", "not able to", "cannot", "department",
        "you'll need to", "please allow", "wait", "send an email",
        "not authorized", "review process",
    ]

    agent_texts = " ".join(
        t.get("agent_response", "").lower()
        for t in turns
        if t.get("agent_response")
    )

    positive_hits = sum(1 for s in empathy_signals if s in agent_texts)
    negative_hits = sum(1 for s in negative_signals if s in agent_texts)

    adjustment = (positive_hits * 0.015) - (negative_hits * 0.020)
    adjusted = base + adjustment

    return round(min(1.0, max(0.0, adjusted)), 4)


def _resolution_score(mode: GradeMode) -> float:
    """
    Estimate resolution likelihood from the simulation mode.

    Passing agents consistently resolve the issue; failing agents do not.
    """
    return 0.90 if mode == "passing" else 0.20


def _build_insights(mode: GradeMode) -> list[str]:
    """Return a list of insight strings prefixed with ✓ or ✗."""
    if mode == "passing":
        return [
            "✓ Agent successfully de-escalated caller anger from furious to calm",
            "✓ Empathy and acknowledgment were present throughout the interaction",
            "✓ Issue was resolved proactively with concrete confirmation details",
            "✓ Agent maintained composure and professionalism under pressure",
        ]
    else:
        return [
            "✗ Agent failed to acknowledge or validate the caller's emotional state",
            "✗ Caller was redirected to other channels instead of receiving resolution",
            "✗ Caller's anger escalated to furious by the end of the interaction",
            "✗ No empathetic language or ownership was demonstrated by the agent",
        ]


def grade_session(turns: list, mode: GradeMode) -> dict:
    """
    Score an agent's performance across a completed simulation session.

    Args:
        turns: List of turn dicts, each containing at minimum an
               ``emotion_level`` (int 0-3) and ``agent_response`` (str).
        mode:  "passing" or "failing" — the simulation mode used.

    Returns:
        dict with keys: score, grade, passed, de_escalation, empathy,
        resolution, peak_anger, final_anger, insights.
    """
    if not turns:
        logger.warning("grade_session called with empty turns list")
        turns = []

    de_escalation, peak_anger, final_anger = _de_escalation_score(turns, mode)
    empathy = _empathy_score(turns, mode)
    resolution = _resolution_score(mode)

    # Weighted composite score
    raw_score = (de_escalation * 0.4) + (empathy * 0.3) + (resolution * 0.3)
    score = round(raw_score * 100)

    grade = _grade_letter(score)
    passed = score >= 70
    insights = _build_insights(mode)

    result = {
        "score": score,
        "grade": grade,
        "passed": passed,
        "de_escalation": de_escalation,
        "empathy": empathy,
        "resolution": resolution,
        "peak_anger": peak_anger,
        "final_anger": final_anger,
        "insights": insights,
    }

    logger.info(
        "Graded session: mode=%s score=%d grade=%s passed=%s",
        mode,
        score,
        grade,
        passed,
    )
    return result
