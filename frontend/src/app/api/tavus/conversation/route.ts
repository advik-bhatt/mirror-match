import { NextRequest, NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/redis'

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  const allowed = await checkRateLimit(ip, 'tavus', 3) // 3 sessions/min per IP
  if (!allowed) return NextResponse.json({ error: 'Too many sessions, try again in a minute.' }, { status: 429 })
  const apiKey = process.env.TAVUS_API_KEY
  const replicaId = process.env.TAVUS_REPLICA_ID ?? 'r79e1c033f'

  if (!apiKey || apiKey === 'mock') {
    return NextResponse.json({ conversation_url: null, mock: true })
  }

  try {
    const res = await fetch('https://tavusapi.com/v2/conversations', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        replica_id: replicaId,
        conversation_name: 'MirrorMatch Session',
        conversational_context:
          'You are a customer service agent for a company. An angry customer is calling about an unauthorized $149 charge on their account. ' +
          'Your job is to de-escalate the situation, show empathy, take ownership, and resolve the issue immediately. ' +
          'Do NOT deflect, do NOT say "please email billing", do NOT put them on hold. ' +
          'Offer a refund directly. Be warm, human, and decisive. ' +
          'If the customer is very angry, slow down, acknowledge their frustration, and commit to a concrete resolution.',
        custom_greeting: 'Thank you for calling, I\'m here to help you. What can I assist you with today?',
      }),
    })
    if (res.ok) {
      const data = await res.json() as { conversation_url?: string; conversation_id?: string }
      return NextResponse.json({ conversation_url: data.conversation_url, mock: false })
    }
  } catch { /* fall through */ }

  return NextResponse.json({ conversation_url: null, mock: true, error: 'Tavus unavailable' })
}
