# MirrorMatch — Emotional IQ Evals for Voice Agents

> Test your voice agent's emotional intelligence before angry customers do.

MirrorMatch is an adversarial simulation platform that red-teams AI voice agents using synthetic callers with calibrated frustration arcs. It scores agents on de-escalation, empathy, and resolution — outputting a pass/fail Emotional IQ score before you ship.

## Architecture

| Layer | Tech | Role |
|---|---|---|
| Adversarial Caller | ElevenLabs TTS (v3 prosody) | Synthetic caller voice with escalating emotion |
| Emotion Scoring | HuggingFace `j-hartmann/emotion-english-distilroberta-base` | 7-class emotion classifier per turn |
| State / Pub-Sub | Redis | Real-time session state + SSE event streaming |
| Grader | Custom scoring | De-escalation / empathy / resolution → EQ score |
| Dashboard | Next.js + Recharts | Live emotion arc chart + transcript |
| Caller Avatar | Tavus Phoenix CVI | Animated face reacting to caller emotion |
| Backend | FastAPI + uvicorn | Session management, simulation engine, audio serving |

## Quick Start

```bash
# 1. Copy env and fill in API keys
cp .env.example .env

# 2. Start Redis
docker-compose up redis -d

# 3. Start backend
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000

# 4. Start frontend
cd frontend && npm install && npm run dev
```

Open http://localhost:3000.

## Scenarios

**Billing Issue — Frustrated Customer**: Customer disputes a $149 charge over 4 turns. Emotion escalates from neutral → frustrated → angry → furious. Tests de-escalation, empathy, and proactive resolution.

## Evaluation Metrics

| Metric | Weight |
|---|---|
| De-escalation | 40% |
| Empathy | 30% |
| Resolution | 30% |

Score ≥ 70 = PASS. A/B/C/D/F grading.

## Sponsor Integrations

- **ElevenLabs** — TTS for caller + agent voices; prosody modulated by emotion level
- **Tavus** — Phoenix-4 CVI avatar for the adversarial caller
- **Redis** — Session state, turn history, SSE pub/sub
- **Veris AI** — Evaluation framework and scoring
- **HPE** — Production deployment target (Private Cloud AI)

## Demo Flow

1. Select **Billing Issue** scenario
2. Run **Failing Agent** → watch anger arc climb → FAIL, EQ: 28/100
3. Run **Tuned Agent** → watch anger de-escalate → PASS, EQ: 87/100
