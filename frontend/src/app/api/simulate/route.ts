// Veris AI simulation endpoint.
// Veris sends scripted customer utterances here turn by turn.
// MirrorMatch classifies the emotion and returns the coaching signal.
// This is the HTTP channel contract defined in .veris/veris.yaml.

import { NextRequest, NextResponse } from 'next/server'
import { classifyEmotion } from '@/lib/classify'
import { redisLogTurn } from '@/lib/redis'

const COACHING: Record<number, string> = {
  0: 'Customer is stable. Maintain standard flow — no behavior change required.',
  1: 'Tension detected. Shift to empathetic mode — lead with acknowledgment, avoid policy-only language, use "I will" not "the team will".',
  2: 'Escalating. Resolve concretely now — commit to a specific outcome, do not transfer without acting first, offer compensation proactively.',
  3: 'Critical. Route to human agent immediately — trigger escalation, pass full context, offer compensation before handoff.',
}

export async function POST(req: NextRequest) {
  const { message, session_id } = await req.json() as { message: string; session_id?: string }
  if (!message) return NextResponse.json({ error: 'no message' }, { status: 400 })

  const { scores, emotion_level, dominant_emotion } = await classifyEmotion(message)

  if (session_id) {
    await redisLogTurn(session_id, 'customer', message, emotion_level, scores.anger ?? 0)
  }

  return NextResponse.json({
    message: COACHING[emotion_level],
    session_id: session_id ?? '',
    emotion_level,
    dominant_emotion,
    scores,
  })
}
