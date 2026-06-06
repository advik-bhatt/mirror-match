import { NextRequest, NextResponse } from 'next/server'
import { redisLogTurn, redisSessionSummary } from '@/lib/redis'

export async function POST(req: NextRequest) {
  const { session_id, speaker, text, emotion_level, anger } = await req.json() as {
    session_id: string
    speaker: string
    text: string
    emotion_level: number
    anger: number
  }
  await redisLogTurn(session_id, speaker, text, emotion_level, anger)
  const summary = await redisSessionSummary(session_id)
  return NextResponse.json({ ok: true, summary })
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('session_id')
  if (!id) return NextResponse.json({ error: 'no session_id' }, { status: 400 })
  const summary = await redisSessionSummary(id)
  return NextResponse.json({ summary })
}
