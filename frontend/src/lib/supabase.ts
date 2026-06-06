import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  if (!_client) _client = createClient(url, key)
  return _client
}

export async function createSession(): Promise<string | null> {
  const client = getClient()
  if (!client) return null
  const { data, error } = await client
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
  const client = getClient()
  if (!client) return
  await client.from('mm_turns').insert({
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
