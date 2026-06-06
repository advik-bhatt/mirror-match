'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { createSession, logTurn } from '../lib/supabase'

async function playTTS(text: string, stability = 0.55) {
  try {
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, stability }),
    })
    if (!res.ok) return
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audio.play().catch(() => {})
    audio.onended = () => URL.revokeObjectURL(url)
  } catch { /* ignore — EL optional */ }
}

const EmotionArcChart = dynamic(() => import('../components/EmotionChart'), { ssr: false })
const EmotionOrb = dynamic(() => import('../components/EmotionOrb'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmotionScores {
  anger: number; joy: number; sadness: number
  disgust: number; neutral: number; fear: number
}

interface TranscriptEntry {
  id: number; speaker: 'customer' | 'agent'; text: string
  emotionLevel: number; timestamp: string
}

interface ChartPoint {
  turn: number; anger: number; frustration: number; neutral: number; joy: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const API = (process.env.NEXT_PUBLIC_BACKEND_URL ?? '')

const COACHING: Record<number, { label: string; color: string; border: string; action: string; bullets: string[] }> = {
  0: {
    label: 'Stable', color: 'text-blue-400', border: 'border-blue-900/60 bg-blue-950/10',
    action: 'Maintain standard flow',
    bullets: ['Continue current response pacing', 'No behavior change required'],
  },
  1: {
    label: 'Tension', color: 'text-amber-400', border: 'border-amber-900/60 bg-amber-950/10',
    action: 'Shift to empathetic mode',
    bullets: ['Lead with acknowledgment', 'Remove policy-only language', 'Use "I will" not "the team will"'],
  },
  2: {
    label: 'Escalating', color: 'text-orange-400', border: 'border-orange-900/60 bg-orange-950/10',
    action: 'Resolve concretely now',
    bullets: ['Commit to a specific outcome', 'Do not transfer without first acting', 'Offer compensation proactively'],
  },
  3: {
    label: 'Critical', color: 'text-red-400', border: 'border-red-900/60 bg-red-950/10',
    action: 'Route to human agent',
    bullets: ['Trigger escalation immediately', 'Pass full context to human agent', 'Offer direct compensation before handoff'],
  },
}

let entryId = 0

// ─── Sub-components ───────────────────────────────────────────────────────────

function Bar({ label, sub, value, color }: { label: string; sub: string; value: number; color: string }) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-gray-200 font-medium">
          {label}<span className="text-gray-600 font-normal"> · {sub}</span>
        </span>
        <span className="font-mono text-gray-300 tabular-nums">{pct}%</span>
      </div>
      <div className="h-px bg-gray-800 relative overflow-visible">
        <div
          className={`absolute top-0 left-0 h-px transition-all duration-700 ${color}`}
          style={{ width: `${pct}%`, boxShadow: `0 0 6px currentColor` }}
        />
      </div>
    </div>
  )
}

function Timer({ active }: { active: boolean }) {
  const [secs, setSecs] = useState(0)
  useEffect(() => {
    if (!active) { setSecs(0); return }
    const iv = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [active])
  const m = String(Math.floor(secs / 60)).padStart(2, '0')
  const s = String(secs % 60).padStart(2, '0')
  return <span className="font-mono text-sm tabular-nums text-gray-300">{m}:{s}</span>
}

// ─── Tavus Panel ─────────────────────────────────────────────────────────────

function TavusEmbed({
  onEmotionUpdate,
  onTranscript,
  onCallStart,
  onCallEnd,
}: {
  onEmotionUpdate: (scores: EmotionScores, level: number) => void
  onTranscript: (entry: TranscriptEntry) => void
  onCallStart: () => void
  onCallEnd: () => void
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const classify = useCallback(async (text: string) => {
    try {
      const res = await fetch(`${API}/api/classify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { scores: EmotionScores; emotion_level: number }
      onEmotionUpdate(data.scores, data.emotion_level)
      onTranscript({
        id: ++entryId, speaker: 'customer', text,
        emotionLevel: data.emotion_level,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    } catch { /* ignore */ }
  }, [onEmotionUpdate, onTranscript])

  const startSpeechRecognition = useCallback(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = true
    r.interimResults = false
    r.lang = 'en-US'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    r.onresult = (e: any) => {
      const result = e.results[e.results.length - 1]
      if (result.isFinal) {
        const text = result[0].transcript.trim()
        if (text.length > 3) void classify(text)
      }
    }
    r.onerror = () => setTimeout(() => r.start(), 1000)
    r.start()
    recognitionRef.current = r
  }, [classify])

  const startCall = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`${API}/api/tavus/conversation`, { method: 'POST' })
      const data = await res.json() as { conversation_url?: string; error?: string }
      if (data.conversation_url) {
        setUrl(data.conversation_url)
        onCallStart()
        setTimeout(startSpeechRecognition, 2000)
      } else {
        setError(data.error ?? 'Could not start session')
      }
    } catch { setError('Backend unreachable') }
    finally { setLoading(false) }
  }, [onCallStart, startSpeechRecognition])

  const endCall = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    setUrl(null)
    onCallEnd()
  }, [onCallEnd])

  if (url) return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      <button onClick={endCall}
        className="absolute top-4 right-4 z-20 px-3 py-1.5 text-xs font-medium bg-black/60 border border-gray-700 text-gray-300 rounded-lg hover:bg-black/80 backdrop-blur">
        End Call
      </button>
      <iframe src={url} allow="camera; microphone; autoplay; display-capture"
        className="flex-1 w-full border-0" style={{ minHeight: '100%' }} />
    </div>
  )

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8">
      <div className="text-center space-y-2">
        <p className="text-xs font-mono tracking-widest text-gray-600 uppercase">MirrorMatch · Live Evaluation</p>
        <h2 className="text-3xl font-bold text-white tracking-tight">Ready to evaluate</h2>
        <p className="text-sm text-gray-500 max-w-xs leading-relaxed">
          You play the angry customer. The AI agent tries to de-escalate you.
          MirrorMatch monitors the agent's emotional intelligence in real time.
        </p>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={startCall} disabled={loading}
        className={`px-10 py-4 rounded-2xl font-semibold tracking-wide transition-all ${
          loading ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
          : 'bg-white text-black hover:bg-gray-100 shadow-[0_0_40px_rgba(255,255,255,0.1)]'
        }`}>
        {loading ? 'Connecting…' : 'Start Live Call'}
      </button>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Page() {
  const [emotionScores, setEmotionScores] = useState<EmotionScores>({ anger: 0, joy: 0.1, sadness: 0, disgust: 0, neutral: 0.9, fear: 0 })
  const [emotionLevel, setEmotionLevel] = useState(0)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [callActive, setCallActive] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)
  const turnCount = useRef(0)
  const prevLevelRef = useRef(0)

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
  }, [transcript])

  // ElevenLabs: speak coaching alert when escalation level rises
  useEffect(() => {
    if (emotionLevel > prevLevelRef.current && callActive) {
      const stability = Math.max(0.2, 0.6 - emotionLevel * 0.1)
      void playTTS(COACHING[emotionLevel].action, stability)
    }
    prevLevelRef.current = emotionLevel
  }, [emotionLevel, callActive])

  const handleEmotionUpdate = useCallback((scores: EmotionScores, level: number) => {
    setEmotionScores(scores)
    setEmotionLevel(level)
    setChartData(prev => [...prev, {
      turn: ++turnCount.current,
      anger: scores.anger,
      frustration: (scores.sadness + scores.disgust) / 2,
      neutral: scores.neutral,
      joy: scores.joy,
    }])
  }, [])

  const handleTranscript = useCallback((entry: TranscriptEntry) => {
    setTranscript(prev => [...prev, entry])
    if (sessionId) {
      void logTurn(sessionId, entry.speaker, entry.text, entry.emotionLevel, {})
      void fetch('/api/turns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          speaker: entry.speaker,
          text: entry.text,
          emotion_level: entry.emotionLevel,
          anger: 0,
        }),
      })
    }
  }, [sessionId])

  const handleCallStart = useCallback(async () => {
    setCallActive(true)
    setChartData([])
    setTranscript([])
    turnCount.current = 0
    const id = await createSession()
    setSessionId(id)
  }, [])

  const handleCallEnd = useCallback(() => {
    setCallActive(false)
    setSessionId(null)
  }, [])

  const sig = COACHING[emotionLevel] ?? COACHING[0]
  const anger = emotionScores.anger

  return (
    <div className="flex flex-col min-h-screen bg-[#080808] text-gray-100" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <header className="border-b border-white/5 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-sm">🪞</div>
          <span className="font-semibold text-white tracking-tight">MirrorMatch</span>
          <span className="text-gray-600 text-xs">· Voice Agent QA</span>
        </div>
        <div className="flex items-center gap-4">
          {callActive && (
            <span className="flex items-center gap-2 text-xs text-red-400 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
          <Timer active={callActive} />
        </div>
      </header>

      {/* 3-column layout */}
      <main className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '260px 1fr 300px' }}>

        {/* Left — 3D Orb + Coaching */}
        <aside className="border-r border-white/5 flex flex-col overflow-hidden">
          {/* 3D Orb */}
          <div className="h-56 relative flex-shrink-0">
            <EmotionOrb emotionLevel={emotionLevel} anger={anger} />
            <div className="absolute bottom-3 left-0 right-0 text-center">
              <span className={`text-xs font-mono font-bold tracking-widest uppercase ${sig.color}`}>
                {sig.label}
              </span>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5 flex-shrink-0" />

          {/* Coaching Signal */}
          <div className="p-5 flex flex-col gap-4 overflow-y-auto flex-1">
            <div>
              <p className="text-[10px] font-mono tracking-widest text-gray-600 uppercase mb-3">Coaching Signal</p>
              <div className={`rounded-xl border p-4 space-y-3 ${sig.border}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold ${sig.color}`}>{sig.label}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{sig.action}</span>
                </div>
                <div className="space-y-1.5">
                  {sig.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-xs flex-shrink-0 mt-0.5 ${sig.color}`}>→</span>
                      <span className="text-xs text-gray-400 leading-relaxed">{b}</span>
                    </div>
                  ))}
                </div>
                {emotionLevel === 3 && (
                  <div className="flex items-center gap-2 pt-1 border-t border-red-900/40">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                    <span className="text-xs text-red-400 font-semibold">Route to human now</span>
                  </div>
                )}
              </div>
            </div>

            {/* Powered by */}
            <div className="mt-auto pt-4 border-t border-white/5">
              <p className="text-[10px] font-mono tracking-widest text-gray-700 uppercase mb-2">Powered by</p>
              <div className="flex flex-wrap gap-1.5">
                {['ElevenLabs', 'Tavus', 'Supabase', 'Veris', 'HPE'].map(s => (
                  <span key={s} className="px-2 py-0.5 text-[10px] rounded border border-white/5 text-gray-600">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Center — Tavus */}
        <div className="flex flex-col overflow-hidden bg-[#050505]">
          <TavusEmbed
            onEmotionUpdate={handleEmotionUpdate}
            onTranscript={handleTranscript}
            onCallStart={handleCallStart}
            onCallEnd={handleCallEnd}
          />
        </div>

        {/* Right — Data */}
        <aside className="border-l border-white/5 flex flex-col overflow-hidden">

          {/* Emotion bars */}
          <div className="p-5 border-b border-white/5 space-y-4 flex-shrink-0">
            <p className="text-[10px] font-mono tracking-widest text-gray-600 uppercase">Emotion Signal</p>
            <Bar label="Anger" sub="Escalation Risk" value={emotionScores.anger} color="bg-red-500" />
            <Bar label="Frustration" sub="Tension Index"
              value={(emotionScores.sadness + emotionScores.disgust) / 2} color="bg-amber-500" />
            <Bar label="Neutral" sub="Stability" value={emotionScores.neutral} color="bg-blue-500" />
            <Bar label="Joy" sub="Satisfaction" value={emotionScores.joy} color="bg-emerald-500" />
          </div>

          {/* Emotion arc */}
          <div className="p-5 border-b border-white/5 flex-shrink-0" style={{ height: '180px' }}>
            <p className="text-[10px] font-mono tracking-widest text-gray-600 uppercase mb-3">Emotion Arc</p>
            <div style={{ height: '130px' }}>
              <EmotionArcChart data={chartData} />
            </div>
          </div>

          {/* Transcript */}
          <div className="flex-1 flex flex-col min-h-0 p-5">
            <p className="text-[10px] font-mono tracking-widest text-gray-600 uppercase mb-3 flex-shrink-0">
              Live Transcript
              {callActive && <span className="ml-2 text-red-500">●</span>}
            </p>
            <div ref={transcriptRef} className="flex-1 overflow-y-auto space-y-3">
              {transcript.length === 0 ? (
                <p className="text-xs text-gray-700 italic">Transcript appears when call is active…</p>
              ) : transcript.map(entry => (
                <div key={entry.id} className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold uppercase ${
                      entry.speaker === 'customer' ? 'text-orange-500' : 'text-blue-400'
                    }`}>
                      {entry.speaker === 'customer' ? 'Customer' : 'Agent'}
                    </span>
                    <span className="text-[10px] text-gray-700 font-mono">{entry.timestamp}</span>
                  </div>
                  <p className="text-xs text-gray-300 leading-relaxed">{entry.text}</p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
