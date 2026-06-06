"""
Async Redis store for MirrorMatch session management and real-time event streaming.
"""

import json
import logging
import os
from typing import AsyncGenerator, Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

_redis_client: Optional[aioredis.Redis] = None


def get_redis() -> aioredis.Redis:
    """
    Return a singleton async Redis client.

    Reads REDIS_URL from the environment (default: redis://localhost:6379).
    The client is created lazily on first call and reused for all subsequent calls.
    """
    global _redis_client
    if _redis_client is None:
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        _redis_client = aioredis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        logger.info("Redis client created for %s", redis_url)
    return _redis_client


async def create_session(session_id: str, config: dict) -> None:
    """
    Create a new session record in Redis.

    Stores status, config, turns (empty list), and report as separate hash fields.
    The key expires after 3600 seconds (1 hour).
    """
    r = get_redis()
    key = f"session:{session_id}"
    await r.hset(
        key,
        mapping={
            "status": "created",
            "config": json.dumps(config),
            "turns": json.dumps([]),
            "report": json.dumps({}),
        },
    )
    await r.expire(key, 3600)
    logger.debug("Created session %s", session_id)


async def get_session(session_id: str) -> Optional[dict]:
    """
    Retrieve a session record by ID.

    Returns a dict with keys: session_id, status, config, turns, report.
    Returns None if the session does not exist.
    """
    r = get_redis()
    key = f"session:{session_id}"
    data = await r.hgetall(key)

    if not data:
        return None

    return {
        "session_id": session_id,
        "status": data.get("status", "unknown"),
        "config": json.loads(data.get("config", "{}")),
        "turns": json.loads(data.get("turns", "[]")),
        "report": json.loads(data.get("report", "{}")),
    }


async def update_session_status(session_id: str, status: str) -> None:
    """Update the status field of an existing session."""
    r = get_redis()
    await r.hset(f"session:{session_id}", "status", status)
    logger.debug("Session %s status → %s", session_id, status)


async def add_turn(session_id: str, turn_dict: dict) -> None:
    """
    Append a turn record to the session's turns list.

    Reads the current JSON array, appends the new turn, and writes it back.
    """
    r = get_redis()
    key = f"session:{session_id}"
    raw = await r.hget(key, "turns")
    turns: list = json.loads(raw) if raw else []
    turns.append(turn_dict)
    await r.hset(key, "turns", json.dumps(turns))
    logger.debug("Added turn %d to session %s", len(turns), session_id)


async def save_report(session_id: str, report_dict: dict) -> None:
    """
    Persist the final grading report and mark the session as complete.
    """
    r = get_redis()
    key = f"session:{session_id}"
    await r.hset(
        key,
        mapping={
            "status": "complete",
            "report": json.dumps(report_dict),
        },
    )
    logger.debug("Saved report for session %s", session_id)


async def publish_event(session_id: str, event_dict: dict) -> None:
    """
    Publish an event to the session's Redis pub/sub channel.

    Channel name: session:{session_id}:events
    """
    r = get_redis()
    channel = f"session:{session_id}:events"
    await r.publish(channel, json.dumps(event_dict))
    logger.debug("Published event type=%s to %s", event_dict.get("type"), channel)


async def subscribe_events(session_id: str) -> AsyncGenerator[dict, None]:
    """
    Async generator that subscribes to a session's event channel and yields
    parsed event dicts until the channel is closed or the connection drops.

    Creates a dedicated pub/sub connection so the main Redis client remains
    available for regular commands.
    """
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    pubsub_client = aioredis.from_url(
        redis_url,
        encoding="utf-8",
        decode_responses=True,
    )
    channel = f"session:{session_id}:events"

    async with pubsub_client.pubsub() as pubsub:
        await pubsub.subscribe(channel)
        logger.debug("Subscribed to channel %s", channel)

        try:
            async for message in pubsub.listen():
                if message["type"] != "message":
                    continue
                try:
                    event = json.loads(message["data"])
                except (json.JSONDecodeError, TypeError) as exc:
                    logger.warning("Could not parse event from channel: %s", exc)
                    continue

                yield event

                # Stop listening once the simulation signals completion
                if event.get("type") == "complete":
                    logger.debug("Received 'complete' event — closing subscription for %s", session_id)
                    break
        finally:
            await pubsub.unsubscribe(channel)
            await pubsub_client.aclose()
