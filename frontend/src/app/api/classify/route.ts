import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/redis'
import { classifyEmotion } from '@/lib/classify'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const allowed = await checkRateLimit(ip, 'classify', 40)
  if (!allowed) return NextResponse.json({ error: 'rate limited' }, { status: 429 })

  const { text } = await req.json() as { text: string }
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 })

  const result = await classifyEmotion(text)
  return NextResponse.json(result)
}
