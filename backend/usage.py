"""Usage tracking for external API services."""
import os
import logging
import httpx

logger = logging.getLogger(__name__)

async def get_elevenlabs_balance() -> dict:
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    if not api_key:
        return {"status": "no_key", "remaining": None, "total": None, "used": None}
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                "https://api.elevenlabs.io/v1/user/subscription",
                headers={"xi-api-key": api_key},
            )
            if resp.status_code == 200:
                data = resp.json()
                limit = data.get("character_limit", 10000)
                used = data.get("character_count", 0)
                return {
                    "status": "ok",
                    "total": limit,
                    "used": used,
                    "remaining": limit - used,
                }
    except Exception as exc:
        logger.warning("Failed to fetch ElevenLabs balance: %s", exc)
    return {"status": "error", "remaining": None, "total": None, "used": None}
