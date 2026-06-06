import { NextRequest, NextResponse } from 'next/server'

const HF_API_KEY = process.env.HUGGINGFACE_API_KEY
const HF_MODEL = 'j-hartmann/emotion-english-distilroberta-base'

function keywordFallback(text: string): Record<string, number> {
  const t = text.toLowerCase()
  const anger = (t.match(/angry|furious|ridiculous|unacceptable|cancel|demand|supervisor|escalate|outrageous|never again|CAPS/gi) ?? []).length
  const frustration = (t.match(/frustrated|annoying|again|still|waiting|days|week|nobody|useless/gi) ?? []).length
  const joy = (t.match(/thank|great|perfect|resolved|happy|appreciate|wonderful/gi) ?? []).length
  const total = Math.max(anger * 0.4 + frustration * 0.2 + joy * 0.2 + 0.2, 0.01)
  return {
    anger: Math.min((anger * 0.4) / total, 0.95),
    disgust: Math.min((frustration * 0.1) / total, 0.5),
    sadness: Math.min((frustration * 0.15) / total, 0.5),
    joy: Math.min((joy * 0.3) / total, 0.9),
    neutral: Math.max(1 - Math.min(anger * 0.4 + frustration * 0.2, 0.8), 0.05),
    fear: 0.01,
    surprise: 0.01,
  }
}

export async function POST(req: NextRequest) {
  const { text } = await req.json() as { text: string }
  if (!text) return NextResponse.json({ error: 'no text' }, { status: 400 })

  let scores: Record<string, number>

  if (HF_API_KEY && HF_API_KEY !== 'mock') {
    try {
      const res = await fetch(
        `https://api-inference.huggingface.co/models/${HF_MODEL}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${HF_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ inputs: text }),
        }
      )
      if (res.ok) {
        const raw = await res.json() as { label: string; score: number }[][]
        scores = Object.fromEntries((raw[0] ?? []).map(({ label, score }) => [label.toLowerCase(), score]))
      } else {
        scores = keywordFallback(text)
      }
    } catch {
      scores = keywordFallback(text)
    }
  } else {
    scores = keywordFallback(text)
  }

  const anger = scores.anger ?? 0
  const emotionLevel = anger >= 0.7 ? 3 : anger >= 0.4 ? 2 : anger >= 0.2 ? 1 : 0
  const dominant = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral'

  return NextResponse.json({ scores, emotion_level: emotionLevel, dominant_emotion: dominant })
}
