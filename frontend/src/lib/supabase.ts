import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, key)

export async function createSession(): Promise<string | null> {
  const { data, error } = await supabase
    .from('mm_sessions')
    .insert({ scenario: 'live_call', status: 'active' })
    .select('id')
    .single()
  if (error) { console.error(error); return null }
  return data.id as string
}

export async function logTurn(
  sessionId: string,
  speaker: 'customer' | 'agent',
  text: string,
  emotionLevel: number,
  scores: Record<string, number>,
) {
  await supabase.from('mm_turns').insert({
    session_id: sessionId,
    speaker,
    text,
    emotion_level: emotionLevel,
    anger: scores.anger ?? 0,
    frustration: ((scores.sadness ?? 0) + (scores.disgust ?? 0)) / 2,
    neutral: scores.neutral ?? 0,
    joy: scores.joy ?? 0,
    dominant_emotion: Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'neutral',
  })
}
