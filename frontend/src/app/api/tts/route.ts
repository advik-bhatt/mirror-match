import { NextRequest, NextResponse } from 'next/server'

const ADAM_VOICE = 'pNInz6obpgDQGcFmaJgB' // Adam — coaching alert voice

export async function POST(req: NextRequest) {
  const { text, stability = 0.55 } = await req.json() as { text: string; stability?: number }
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey || apiKey.startsWith('your_')) {
    return NextResponse.json({ error: 'no key' }, { status: 503 })
  }

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ADAM_VOICE}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability, similarity_boost: 0.75 },
      }),
    })
    if (!res.ok) return NextResponse.json({ error: 'EL error' }, { status: 502 })
    const audio = await res.arrayBuffer()
    return new NextResponse(audio, { headers: { 'Content-Type': 'audio/mpeg' } })
  } catch {
    return NextResponse.json({ error: 'EL unreachable' }, { status: 503 })
  }
}
