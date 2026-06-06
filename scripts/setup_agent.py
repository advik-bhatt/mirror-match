#!/usr/bin/env python3
"""
Automatically creates the MirrorMatch ElevenLabs Conversational AI agent
and writes the agent_id directly into .env. No copy-pasting needed.

Usage:
    python3 scripts/setup_agent.py
"""

import os
import re
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
if not API_KEY or API_KEY == "mock":
    print("ERROR: Set a real ELEVENLABS_API_KEY in your .env first.")
    sys.exit(1)

AGENT_CONFIG = {
    "name": "MirrorMatch — Alex (Angry Caller)",
    "conversation_config": {
        "agent": {
            "prompt": {
                "prompt": (
                    "You are Alex, a customer calling support about an unexpected $49.99 "
                    "charge on your credit card. Start confused but polite. If the agent "
                    "deflects, reads from a script, or fails to resolve the issue, escalate "
                    "your frustration. Use CAPS for emphasis when angry. Demand a supervisor "
                    "if ignored twice. Keep all responses under 3 sentences."
                ),
                "llm": "gpt-4o-mini",
                "temperature": 0.8,
            },
            "first_message": (
                "Hi, I'm calling about a charge on my account that I did not authorize. "
                "Can you help me figure out what this is?"
            ),
            "language": "en",
        },
        "tts": {
            "voice_id": "JBFqnCBsd6RMkjVDRZzb",  # George — free premade ElevenLabs voice
        },
    },
}


def create_agent() -> str:
    print("Creating ElevenLabs Conversational AI agent...")
    resp = httpx.post(
        "https://api.elevenlabs.io/v1/convai/agents/create",
        headers={"xi-api-key": API_KEY},
        json=AGENT_CONFIG,
        timeout=15.0,
    )
    if resp.status_code != 200:
        print(f"ERROR {resp.status_code}: {resp.text}")
        sys.exit(1)
    agent_id = resp.json()["agent_id"]
    print(f"Agent created: {agent_id}")
    return agent_id


def write_to_env(agent_id: str) -> None:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    env_path = os.path.normpath(env_path)

    if not os.path.exists(env_path):
        print(f"ERROR: .env not found at {env_path}")
        sys.exit(1)

    with open(env_path, "r") as f:
        content = f.read()

    key = "NEXT_PUBLIC_ELEVENLABS_AGENT_ID"
    line = f"{key}={agent_id}"

    if key in content:
        content = re.sub(rf"^{key}=.*$", line, content, flags=re.MULTILINE)
        print(f"Updated {key} in .env")
    else:
        content = content.rstrip("\n") + f"\n{line}\n"
        print(f"Added {key} to .env")

    with open(env_path, "w") as f:
        f.write(content)

    print(f"\n.env updated. Restart the Next.js dev server to pick up the change:")
    print("  Ctrl+C  then  cd frontend && npm run dev")


if __name__ == "__main__":
    agent_id = create_agent()
    write_to_env(agent_id)
    print("\nDone. Your live practice call is ready.")
