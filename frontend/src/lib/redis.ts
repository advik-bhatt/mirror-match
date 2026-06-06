// Upstash Redis — HTTP-native, works on Vercel serverless
// Requires: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

async function pipeline(commands: unknown[][]): Promise<void> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return
  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
  } catch { /* degrade silently */ }
}

export async function redisCreateSession(sessionId: string): Promise<void> {
  await pipeline([
    ['HSET', `mm:session:${sessionId}`, 'scenario', 'live_call', 'status', 'active', 'ts', Date.now().toString()],
    ['EXPIRE', `mm:session:${sessionId}`, '3600'],
  ])
}

export async function redisLogTurn(
  sessionId: string,
  speaker: string,
  text: string,
  emotionLevel: number,
  anger: number,
): Promise<void> {
  const entry = JSON.stringify({ speaker, text, emotion_level: emotionLevel, anger, ts: Date.now() })
  await pipeline([
    ['LPUSH', `mm:turns:${sessionId}`, entry],
    ['EXPIRE', `mm:turns:${sessionId}`, '3600'],
  ])
}
