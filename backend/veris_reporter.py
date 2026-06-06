"""
Veris engine tool-call reporter.

Reports MirrorMatch's internal tool calls (emotion classification, session
grading) to the Veris simulation engine so they appear in the graded trace.

No-ops when SIMULATION_ID is not set (i.e. outside a Veris sandbox). Never
raises into the call path — fire-and-forget with a short timeout.
"""

import json
import logging
import os

import httpx

logger = logging.getLogger(__name__)

_ENGINE_URL = os.environ.get("ENGINE_URL", "http://localhost:6100")
_SIMULATION_ID = os.environ.get("SIMULATION_ID")


def report_tool_call(name: str, arguments: dict, result: object) -> None:
    """Report a tool call to the Veris engine trace. No-op outside a simulation."""
    if not _SIMULATION_ID:
        return
    body = json.dumps(
        {
            "service": "agent",
            "event_type": "agent_tool_call",
            "data": {"name": name, "arguments": arguments, "result": result},
        },
        default=str,
    )
    try:
        httpx.post(
            f"{_ENGINE_URL}/simulations/{_SIMULATION_ID}/events",
            content=body,
            headers={"Content-Type": "application/json"},
            timeout=2.0,
        )
    except Exception as exc:
        logger.warning("[veris] could not report %s to engine: %s", name, exc)
