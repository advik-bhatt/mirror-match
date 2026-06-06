import { NextRequest, NextResponse } from 'next/server'
import { redisLogTurn } from '@/lib/redis'

export async function POST(req: NextRequest) {
  const { session_id, speaker, text, emotion_level, anger } = await req.json() as {
    session_id: string
    speaker: string
    text: string
    emotion_level: number
    anger: number
  }
  await redisLogTurn(session_id, speaker, text, emotion_level, anger)
  return NextResponse.json({ ok: true })
}
