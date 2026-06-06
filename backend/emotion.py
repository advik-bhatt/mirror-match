"""
Emotion classification for caller utterances.

Primary: HuggingFace Inference API using j-hartmann/emotion-english-distilroberta-base
Fallback: keyword-based heuristic classifier when API is unavailable.
"""

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# The 7 emotion labels produced by this model
EMOTION_LABELS = ["anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"]

HF_API_URL = (
    "https://api-inference.huggingface.co/models/"
    "j-hartmann/emotion-english-distilroberta-base"
)


def _keyword_fallback(text: str) -> dict:
    """
    Keyword-based emotion classifier used when the HuggingFace API is unavailable.

    Produces plausible scores that reflect the emotional content of the text,
    leaning on common anger/frustration/fear signal words.
    """
    text_lower = text.lower()

    # Anger signals
    anger_words = [
        "angry", "furious", "outraged", "ridiculous", "unacceptable", "done",
        "cancel", "serious", "ridiculous", "beg", "begging", "remove it",
        "how dare", "absurd", "disgusting", "terrible", "horrible", "worst",
        "yelling", "shouting", "fed up", "last straw", "never again",
    ]
    # Frustration signals (map to moderate anger + some disgust)
    frustration_words = [
        "frustrated", "frustrating", "annoyed", "annoying", "why", "still",
        "again", "days ago", "no response", "nobody", "difficult", "chase",
        "bother", "not working", "doesn't work", "keep", "waiting", "wait",
        "supposed to", "should", "shouldn't have to",
    ]
    # Fear / worry signals
    fear_words = [
        "worried", "concern", "scared", "afraid", "unauthorized", "fraud",
        "don't recognize", "strange", "suspicious", "hacked", "stolen",
    ]
    # Sadness signals
    sadness_words = [
        "disappointed", "disappointing", "let down", "expected better",
        "sad", "unhappy", "upset",
    ]
    # Joy signals
    joy_words = [
        "great", "wonderful", "happy", "pleased", "excellent", "love",
        "thank you", "thanks", "appreciate", "perfect",
    ]

    # Caps-lock words amplify anger
    caps_words = sum(1 for word in text.split() if word.isupper() and len(word) > 2)
    exclamation_count = text.count("!")

    # Base anger score
    anger_hits = sum(1 for w in anger_words if w in text_lower)
    frustration_hits = sum(1 for w in frustration_words if w in text_lower)
    fear_hits = sum(1 for w in fear_words if w in text_lower)
    sadness_hits = sum(1 for w in sadness_words if w in text_lower)
    joy_hits = sum(1 for w in joy_words if w in text_lower)

    # Build raw scores
    raw_anger = anger_hits * 0.25 + frustration_hits * 0.10 + caps_words * 0.15 + exclamation_count * 0.08
    raw_disgust = anger_hits * 0.10 + frustration_hits * 0.05
    raw_fear = fear_hits * 0.30
    raw_sadness = sadness_hits * 0.25 + frustration_hits * 0.05
    raw_joy = joy_hits * 0.35
    raw_neutral = max(0.0, 0.5 - raw_anger - raw_fear - raw_sadness - raw_joy)
    raw_surprise = 0.05

    total = raw_anger + raw_disgust + raw_fear + raw_sadness + raw_joy + raw_neutral + raw_surprise
    if total == 0:
        total = 1.0

    scores = {
        "anger": min(1.0, raw_anger / total),
        "disgust": min(1.0, raw_disgust / total),
        "fear": min(1.0, raw_fear / total),
        "joy": min(1.0, raw_joy / total),
        "neutral": min(1.0, raw_neutral / total),
        "sadness": min(1.0, raw_sadness / total),
        "surprise": min(1.0, raw_surprise / total),
    }

    # Re-normalize to sum to 1.0
    total_score = sum(scores.values())
    if total_score > 0:
        scores = {k: round(v / total_score, 4) for k, v in scores.items()}

    return scores


async def classify_emotion(text: str) -> dict:
    """
    Classify the emotion of the given text.

    Attempts to use the HuggingFace Inference API first. Falls back to a
    keyword-based heuristic classifier if the API key is missing or the
    request fails for any reason.

    Returns:
        dict: Mapping of lowercase emotion label to confidence score (0.0–1.0).
              Keys: anger, disgust, fear, joy, neutral, sadness, surprise
    """
    api_key: Optional[str] = os.getenv("HUGGINGFACE_API_KEY")

    if not api_key:
        logger.warning(
            "HUGGINGFACE_API_KEY not set — using keyword-based emotion classifier."
        )
        return _keyword_fallback(text)

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                HF_API_URL,
                headers={"Authorization": f"Bearer {api_key}"},
                json={"inputs": text},
            )
            response.raise_for_status()
            data = response.json()

        # HuggingFace returns: [[{"label": "anger", "score": 0.92}, ...]]
        if not data or not isinstance(data, list):
            raise ValueError(f"Unexpected response format: {data!r}")

        inner = data[0] if isinstance(data[0], list) else data
        scores = {item["label"].lower(): round(item["score"], 4) for item in inner}

        # Ensure all expected labels are present (fill missing with 0.0)
        for label in EMOTION_LABELS:
            scores.setdefault(label, 0.0)

        return scores

    except httpx.HTTPStatusError as exc:
        logger.warning(
            "HuggingFace API returned HTTP %s — falling back to keyword classifier.",
            exc.response.status_code,
        )
    except httpx.RequestError as exc:
        logger.warning(
            "HuggingFace API request failed (%s) — falling back to keyword classifier.",
            exc,
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Unexpected error during emotion classification (%s) — using fallback.",
            exc,
        )

    return _keyword_fallback(text)
