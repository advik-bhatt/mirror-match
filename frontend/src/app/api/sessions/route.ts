import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redisCreateSession } from '@/lib/redis'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)

export async function POST() {
  const { data, error } = await supabase
    .from('mm_sessions')
    .insert({ scenario: 'live_call', status: 'active' })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await redisCreateSession(data.id)
  return NextResponse.json({ session_id: data.id })
}
