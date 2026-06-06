"""
MirrorMatch FastAPI backend.

Provides endpoints for creating and streaming simulation sessions,
serving audio files, and retrieving scenario metadata.
"""

import json
import logging
import os
import uuid
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sse_starlette.sse import EventSourceResponse

from .redis_store import create_session, get_session, subscribe_events
from .scenarios import SCENARIOS
from .simulator import run_simulation

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
        # ── 1. Send current session snapshot as the first event ───────────────
        try:
            snapshot_session = await get_session(session_id)
            if snapshot_session:
                yield {"data": json.dumps({"type": "snapshot", "session": snapshot_session})}
        except Exception as exc:  # noqa: BLE001
            logger.warning("Failed to send session snapshot for %s: %s", session_id, exc)

        # ── 2. If session is already complete, nothing more to stream ─────────
        if session.get("status") == "complete":
            yield {
                "data": json.dumps({
                    "type": "complete",
                    "report": session.get("report", {}),
                })
            }
            return

        # ── 3. Subscribe to Redis pub/sub and forward events ──────────────────
        try:
            async for event in subscribe_events(session_id):
                yield {"data": json.dumps(event)}
                if event.get("type") == "complete":
                    break
        except Exception as exc:  # noqa: BLE001
            logger.warning("SSE stream error for session %s: %s", session_id, exc)
            yield {"data": json.dumps({"type": "error", "message": str(exc)})}

    return EventSourceResponse(event_generator())


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
