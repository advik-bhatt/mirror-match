// Upstash Redis — HTTP-native, works on Vercel serverless.
// Redis is MirrorMatch's real-time hot path: live emotion state, the emotion
// arc as a sorted set, and atomic escalation counters. Supabase is the durable
// archive; Redis is the in-call source of truth read back for the live summary.
// Requires: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN

type Cmd = (string | number)[]

async function pipeline(commands: Cmd[]): Promise<unknown[] | null> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) return null
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    })
    if (!res.ok) return null
    const out = await res.json() as { result: unknown }[]
    return out.map(r => r.result)
  } catch {
    return null
  }
}

const TTL = 3600 // 1h

export async function redisCreateSession(sessionId: string): Promise<void> {
  await pipeline([
    ['HSET', `mm:session:${sessionId}`, 'scenario', 'live_call', 'status', 'active', 'started', Date.now()],
    ['EXPIRE', `mm:session:${sessionId}`, TTL],
    ['INCR', 'mm:stats:sessions_total'],
  ])
}

export async function redisLogTurn(
  sessionId: string,
  speaker: string,
  text: string,
  emotionLevel: number,
  anger: number,
): Promise<void> {
  const ts = Date.now()
  const entry = JSON.stringify({ speaker, text, emotion_level: emotionLevel, anger, ts })
  const cmds: Cmd[] = [
    // full turn log (list)
    ['RPUSH', `mm:turns:${sessionId}`, entry],
    // emotion arc as a time-series sorted set (score = timestamp)
    ['ZADD', `mm:arc:${sessionId}`, ts, JSON.stringify({ anger, level: emotionLevel, ts })],
    // peak-anger sorted set — ZREVRANGE gives the worst moment instantly
    ['ZADD', `mm:anger:${sessionId}`, anger, `${ts}`],
    // live emotion state (hash) — dashboard's real-time source of truth
    ['HSET', `mm:state:${sessionId}`, 'anger', anger, 'level', emotionLevel, 'updated', ts],
    // atomic counters
    ['INCR', `mm:count:${sessionId}:turns`],
  ]
  if (emotionLevel >= 2) cmds.push(['INCR', `mm:count:${sessionId}:escalations`])
  // refresh TTLs
  for (const k of ['turns', 'arc', 'anger', 'state']) {
    cmds.push(['EXPIRE', `mm:${k}:${sessionId}`, TTL])
  }
  await pipeline(cmds)
}

export interface SessionSummary {
  turns: number
  escalations: number
  peakAnger: number
}

// Read the live summary back OUT of Redis — proves the data round-trips and
// powers the in-call stats chip.
export async function redisSessionSummary(sessionId: string): Promise<SessionSummary | null> {
  const res = await pipeline([
    ['GET', `mm:count:${sessionId}:turns`],
    ['GET', `mm:count:${sessionId}:escalations`],
    ['ZREVRANGE', `mm:anger:${sessionId}`, 0, 0, 'WITHSCORES'],
  ])
  if (!res) return null
  const turns = parseInt((res[0] as string) ?? '0', 10) || 0
  const escalations = parseInt((res[1] as string) ?? '0', 10) || 0
  const peakRow = res[2] as string[] | null
  const peakAnger = peakRow && peakRow.length >= 2 ? parseFloat(peakRow[1]) : 0
  return { turns, escalations, peakAnger }
}
