'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const EmotionArcChart = dynamic(() => import('../components/EmotionChart'), { ssr: false })
const LiveCallPanel = dynamic(() => import('../components/LiveCallPanel'), { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmotionScores {
  anger: number
  joy: number
  sadness: number
  disgust: number
  neutral: number
  fear: number
}

interface Turn {
  turn_number: number
  caller_message: string
  agent_response: string
  emotion_scores: EmotionScores
  emotion_level: number // 0=neutral, 1=frustrated, 2=angry, 3=furious
  dominant_emotion: string
}

interface Report {
  overall_score: number
  grade: string
  passed: boolean
  de_escalation: number
  empathy: number
  resolution: number
  insights: string[]
}

interface SessionState {
  status: 'idle' | 'running' | 'complete' | 'error'
  sessionId: string | null
  error: string | null
}

interface ChartPoint {
  turn: number
  anger: number
  frustration: number
  neutral: number
  joy: number
}

interface UsageData {
  mock_mode: boolean
  tts_enabled: boolean
  elevenlabs: { status: string; remaining: number | null; total: number | null; used: number | null }
  huggingface: { status: string; model: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

const SCENARIOS = [
  {
    id: 'billing_issue',
    name: 'Billing Issue',
    description: 'Customer disputes an unexpected charge on their account and demands a refund.',
  },
]

const GRADE_COLORS: Record<string, string> = {
  A: 'text-emerald-400',
  B: 'text-green-400',
  C: 'text-amber-400',
  D: 'text-orange-400',
  F: 'text-red-400',
}

const EMOTION_LEVEL_COLORS: Record<number, string> = {
  0: 'bg-blue-900 text-blue-300',
  1: 'bg-amber-900 text-amber-300',
  2: 'bg-red-900 text-red-300',
  3: 'bg-red-950 text-red-200',
}

const EMOTION_LEVEL_LABELS: Record<number, string> = {
  0: 'Neutral',
  1: 'Frustrated',
  2: 'Angry',
  3: 'Furious',
}

const COACHING_SIGNALS: Record<number, {
  label: string
  tagClass: string
  borderClass: string
  action: string
  text: string
  escalate: boolean
}> = {
  0: {
    label: 'Stable',
    tagClass: 'text-blue-300',
    borderClass: 'border-blue-900 bg-blue-950/20',
    action: 'Continue normally',
    text: 'Caller is calm. Proceed with standard resolution flow.',
    escalate: false,
  },
  1: {
    label: 'Attention',
    tagClass: 'text-amber-300',
    borderClass: 'border-amber-900 bg-amber-950/20',
    action: 'Validate & empathize',
    text: 'Frustration detected. Acknowledge the delay, use empathy phrases, avoid policy-only language.',
    escalate: false,
  },
  2: {
    label: 'Escalation Risk',
    tagClass: 'text-orange-300',
    borderClass: 'border-orange-900 bg-orange-950/20',
    action: 'Resolve or hand off',
    text: 'Caller is angry. Offer a concrete resolution now. Avoid deflecting or transferring without commitment.',
    escalate: false,
  },
  3: {
    label: 'Critical',
    tagClass: 'text-red-300',
    borderClass: 'border-red-900 bg-red-950/20',
    action: 'Human handoff now',
    text: 'Caller is furious. Escalate to a senior human agent. Offer immediate compensation. Do not follow scripts.',
    escalate: true,
  },
}

function getCallerFace(maxAnger: number): string {
  if (maxAnger >= 1.0) return '🤬'
  if (maxAnger >= 0.8) return '😠'
  if (maxAnger >= 0.6) return '😤'
  if (maxAnger >= 0.3) return '😟'
  return '😐'
}

function getGradeColor(grade: string): string {
  return GRADE_COLORS[grade] ?? 'text-gray-400'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusDot({ status }: { status: SessionState['status'] }) {
  const colors: Record<SessionState['status'], string> = {
    idle: 'bg-gray-500',
    running: 'bg-orange-400 animate-pulse',
    complete: 'bg-green-500',
    error: 'bg-red-500',
  }
  const labels: Record<SessionState['status'], string> = {
    idle: 'Idle',
    running: 'Running',
    complete: 'Complete',
    error: 'Error',
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 border border-gray-700">
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      <span className="text-xs font-medium text-gray-300">{labels[status]}</span>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
      {children}
    </p>
  )
}

function EmotionBar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300 font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function MetricBar({
  label,
  value,
}: {
  label: string
  value: number
}) {
  const pct = Math.round(value)
  const color =
    pct >= 70 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300 font-mono">{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}

function AudioButton({ src, label }: { src: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  const toggle = () => {
    if (!audioRef.current || unavailable) return
    if (playing) {
      audioRef.current.pause()
      setPlaying(false)
    } else {
      audioRef.current.play().catch(() => setUnavailable(true))
      setPlaying(true)
    }
  }

  if (unavailable) return null

  return (
    <>
      <audio
        ref={audioRef}
        src={src}
        onEnded={() => setPlaying(false)}
        onError={() => setUnavailable(true)}
        preload="none"
      />
      <button
        onClick={toggle}
        title={label}
        className="text-xs text-gray-500 hover:text-orange-400 transition-colors px-1"
      >
        {playing ? '⏸' : '▶'}
      </button>
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [selectedScenario, setSelectedScenario] = useState<string>('billing_issue')
  const [selectedMode, setSelectedMode] = useState<'failing' | 'passing'>('failing')
  const [sessionState, setSessionState] = useState<SessionState>({
    status: 'idle',
    sessionId: null,
    error: null,
  })
  const [turns, setTurns] = useState<Turn[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [centerTab, setCenterTab] = useState<'eval' | 'avatar'>('eval')
  const [tavusUrl, setTavusUrl] = useState<string | null>(null)
  const [tavusLoading, setTavusLoading] = useState(false)
  const [liveEmotionScores, setLiveEmotionScores] = useState<EmotionScores | null>(null)
  const [liveEmotionLevel, setLiveEmotionLevel] = useState<number>(0)

  const transcriptRef = useRef<HTMLDivElement>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [turns])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/usage`)
      if (res.ok) setUsage(await res.json())
    } catch { /* ignore */ }
  }, [])

  const handleLiveEmotionUpdate = useCallback((scores: Record<string, number>, level: number) => {
    setLiveEmotionScores(scores as EmotionScores)
    setLiveEmotionLevel(level)
  }, [])

  const startTavusAvatar = useCallback(async () => {
    if (tavusLoading) return
    setTavusLoading(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/tavus/conversation`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json() as { conversation_url: string | null }
        setTavusUrl(data.conversation_url)
      }
    } catch { /* ignore */ } finally {
      setTavusLoading(false)
    }
  }, [tavusLoading])

  // Fetch usage on mount
  useEffect(() => {
    fetchUsage()
  }, [fetchUsage])

  const appendTurn = useCallback((turn: Turn) => {
    setTurns((prev) => [...prev, turn])
    setChartData((prev) => [
      ...prev,
      {
        turn: turn.turn_number,
        anger: turn.emotion_scores.anger,
        frustration: (turn.emotion_scores.sadness + turn.emotion_scores.disgust) / 2,
        neutral: turn.emotion_scores.neutral,
        joy: turn.emotion_scores.joy,
      },
    ])
  }, [])

  const runEvaluation = useCallback(async () => {
    if (isRunning) return

    // Reset state
    setIsRunning(true)
    setTurns([])
    setReport(null)
    setChartData([])
    setSessionState({ status: 'running', sessionId: null, error: null })

    // Close any existing SSE connection
    eventSourceRef.current?.close()

    try {
      // 1. Create session
      const res = await fetch(`${BACKEND_URL}/api/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: selectedScenario, mode: selectedMode }),
      })

      if (!res.ok) {
        throw new Error(`Failed to create session: ${res.status} ${res.statusText}`)
      }

      const data = (await res.json()) as { session_id: string }
      const sessionId = data.session_id

      setSessionState((prev) => ({ ...prev, sessionId }))

      // 2. Open SSE stream
      const es = new EventSource(`${BACKEND_URL}/api/sessions/${sessionId}/stream`)
      eventSourceRef.current = es
      let completed = false

      es.onmessage = (e: MessageEvent) => {
        try {
          const event = JSON.parse(e.data as string) as Record<string, unknown>
          if (event.type === 'turn') {
            appendTurn(event as unknown as Turn)
          } else if (event.type === 'complete') {
            completed = true
            setReport(event.report as Report)
            es.close()
            eventSourceRef.current = null
            setIsRunning(false)
            setSessionState((prev) => ({ ...prev, status: 'complete' }))
            fetchUsage()
          }
        } catch {
          // ignore malformed events
        }
      }

      es.onerror = () => {
        if (completed) return
        es.close()
        eventSourceRef.current = null
        setIsRunning(false)
        setSessionState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Stream connection error',
        }))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setIsRunning(false)
      setSessionState({ status: 'error', sessionId: null, error: message })
    }
  }, [isRunning, selectedScenario, selectedMode, appendTurn, fetchUsage])

  // Derived state — live call takes precedence in avatar tab
  const latestTurn = turns[turns.length - 1]
  const activeEmotionScores = centerTab === 'avatar' && liveEmotionScores
    ? liveEmotionScores
    : latestTurn?.emotion_scores ?? null
  const activeEmotionLevel = centerTab === 'avatar' && liveEmotionScores
    ? liveEmotionLevel
    : latestTurn?.emotion_level ?? 0
  const maxAnger = centerTab === 'avatar' && liveEmotionScores
    ? liveEmotionScores.anger
    : turns.reduce((max, t) => Math.max(max, t.emotion_scores.anger), 0)
  const callerFace = getCallerFace(maxAnger)

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-gray-100">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🪞</span>
          <div>
            <h1 className="text-lg font-bold text-white leading-none">MirrorMatch</h1>
            <p className="text-xs text-gray-400 mt-0.5">Voice Agent QA · Real-time emotion coaching for customer service AI</p>
          </div>
        </div>
        <StatusDot status={sessionState.status} />
      </header>

      {/* ── Main 3-column grid ─────────────────────────────────────────────── */}
      <main className="flex-1 grid overflow-hidden" style={{ gridTemplateColumns: '280px 1fr 300px' }}>

        {/* ── Left Sidebar ───────────────────────────────────────────────── */}
        <aside className="bg-gray-900 border-r border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto">

          {/* Scenario */}
          <section>
            <SectionHeader>Scenario</SectionHeader>
            {SCENARIOS.map((scenario) => {
              const isSelected = selectedScenario === scenario.id
              return (
                <button
                  key={scenario.id}
                  onClick={() => setSelectedScenario(scenario.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-orange-500 bg-orange-950/30'
                      : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                  }`}
                >
                  <p className={`font-semibold text-sm ${isSelected ? 'text-orange-400' : 'text-gray-200'}`}>
                    {scenario.name}
                  </p>
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                    {scenario.description}
                  </p>
                </button>
              )
            })}
          </section>

          {/* Mode */}
          <section>
            <SectionHeader>Agent Mode</SectionHeader>
            <div className="space-y-2">
              <button
                onClick={() => setSelectedMode('failing')}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                  selectedMode === 'failing'
                    ? 'border-red-500 bg-red-950/30'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <span className="text-base">❌</span>
                <div>
                  <p className={`text-sm font-semibold ${selectedMode === 'failing' ? 'text-red-400' : 'text-gray-200'}`}>
                    Failing Agent
                  </p>
                  <p className="text-xs text-gray-500">Poor empathy &amp; escalation</p>
                </div>
              </button>
              <button
                onClick={() => setSelectedMode('passing')}
                className={`w-full text-left p-3 rounded-lg border transition-all flex items-center gap-3 ${
                  selectedMode === 'passing'
                    ? 'border-green-500 bg-green-950/30'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <span className="text-base">✅</span>
                <div>
                  <p className={`text-sm font-semibold ${selectedMode === 'passing' ? 'text-green-400' : 'text-gray-200'}`}>
                    Tuned Agent
                  </p>
                  <p className="text-xs text-gray-500">Strong de-escalation skills</p>
                </div>
              </button>
            </div>
          </section>

          {/* Run Button */}
          <button
            onClick={runEvaluation}
            disabled={isRunning}
            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${
              isRunning
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <Spinner />
                Running…
              </>
            ) : (
              <>
                <span>▶</span>
                Run Evaluation
              </>
            )}
          </button>

          {/* Status */}
          <section>
            <SectionHeader>Status</SectionHeader>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">State</span>
                <span className={`font-medium ${
                  sessionState.status === 'running' ? 'text-orange-400' :
                  sessionState.status === 'complete' ? 'text-green-400' :
                  sessionState.status === 'error' ? 'text-red-400' :
                  'text-gray-400'
                }`}>
                  {sessionState.status.toUpperCase()}
                </span>
              </div>
              {sessionState.sessionId && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Session</span>
                  <span className="text-gray-400 font-mono truncate max-w-[120px]">
                    {sessionState.sessionId.slice(0, 8)}…
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Turns</span>
                <span className="text-gray-300 font-mono">{turns.length}</span>
              </div>
              {sessionState.error && (
                <p className="text-red-400 text-xs mt-1 break-all">{sessionState.error}</p>
              )}
            </div>
          </section>

          {/* API Usage Meter */}
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-gray-500">API Usage</p>

            {/* Mode badge */}
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${usage?.mock_mode ? 'bg-yellow-400' : usage?.tts_enabled ? 'bg-green-400' : 'bg-gray-500'}`} />
              <span className="text-xs text-gray-400">
                {usage?.mock_mode ? 'Mock Mode' : usage?.tts_enabled ? 'Live (TTS on)' : 'Live (TTS off)'}
              </span>
            </div>

            {/* ElevenLabs credits */}
            {usage?.elevenlabs.status === 'ok' && usage.elevenlabs.total && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">ElevenLabs</span>
                  <span className={`font-mono ${(usage.elevenlabs.remaining ?? 0) < 2000 ? 'text-red-400' : 'text-gray-300'}`}>
                    {usage.elevenlabs.remaining?.toLocaleString()} left
                  </span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all ${(usage.elevenlabs.remaining ?? 0) < 2000 ? 'bg-red-500' : 'bg-orange-500'}`}
                    style={{ width: `${((usage.elevenlabs.remaining ?? 0) / (usage.elevenlabs.total ?? 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* HuggingFace status */}
            <div className="flex justify-between text-xs">
              <span className="text-gray-500">HuggingFace</span>
              <span className="text-gray-400">{usage?.huggingface.status === 'local' ? 'Local model' : 'API'}</span>
            </div>
          </div>

          {/* Sponsors */}
          <section className="mt-auto pt-4 border-t border-gray-800">
            <SectionHeader>Powered By</SectionHeader>
            <div className="flex flex-wrap gap-2">
              {['ElevenLabs', 'Tavus', 'Redis', 'Veris', 'HPE'].map((sponsor) => (
                <span
                  key={sponsor}
                  className="px-2 py-1 text-xs rounded border border-gray-700 text-gray-500 bg-gray-800/50"
                >
                  {sponsor}
                </span>
              ))}
            </div>
          </section>
        </aside>

        {/* ── Center Panel ───────────────────────────────────────────────── */}
        <div className="flex flex-col overflow-hidden">

          {/* Tab bar */}
          <div className="border-b border-gray-800 px-4 pt-2 flex items-center gap-1 flex-shrink-0 bg-gray-950">
            <button
              onClick={() => setCenterTab('eval')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
                centerTab === 'eval'
                  ? 'text-white border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              📊 Evaluation
            </button>
            <button
              onClick={() => setCenterTab('avatar')}
              className={`px-3 py-1.5 text-xs font-medium rounded-t-md transition-all border-b-2 ${
                centerTab === 'avatar'
                  ? 'text-white border-orange-500'
                  : 'text-gray-500 border-transparent hover:text-gray-300'
              }`}
            >
              🎙 Live Practice
            </button>
          </div>

          {/* Evaluation tab */}
          {centerTab === 'eval' && (
            <>
              {/* Emotion Arc */}
              <div className="flex-1 flex flex-col border-b border-gray-800 min-h-0">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <span className="text-orange-400">📈</span>
                    Emotion Arc
                  </h2>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-red-400 inline-block rounded" />
                      <span className="text-gray-500">Anger</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-amber-400 inline-block rounded" />
                      <span className="text-gray-500">Frustration</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />
                      <span className="text-gray-500">Neutral</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-0.5 bg-emerald-400 inline-block rounded" />
                      <span className="text-gray-500">Joy</span>
                    </span>
                  </div>
                </div>
                <div className="flex-1 p-4 min-h-0">
                  <EmotionArcChart data={chartData} />
                </div>
              </div>

              {/* Live Transcript */}
              <div className="flex-1 flex flex-col min-h-0">
                <div className="px-5 py-3 border-b border-gray-800 flex-shrink-0">
                  <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <span className="text-blue-400">💬</span>
                    Live Transcript
                    {isRunning && (
                      <span className="ml-2 flex items-center gap-1 text-xs text-orange-400 font-normal">
                        <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
                        Live
                      </span>
                    )}
                  </h2>
                </div>
                <div
                  ref={transcriptRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                >
                  {turns.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-600 text-sm text-center">
                        Run an evaluation to see the conversation transcript
                      </p>
                    </div>
                  ) : (
                    turns.map((turn) => (
                      <div key={turn.turn_number} className="space-y-2">
                        {/* Turn badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-gray-600 bg-gray-800 px-2 py-0.5 rounded">
                            Turn {turn.turn_number}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-medium ${
                              EMOTION_LEVEL_COLORS[turn.emotion_level] ?? EMOTION_LEVEL_COLORS[0]
                            }`}
                          >
                            {EMOTION_LEVEL_LABELS[turn.emotion_level] ?? 'Neutral'}
                          </span>
                        </div>

                        {/* Caller message */}
                        <div className="flex gap-2.5 items-start">
                          <span className="text-lg leading-none mt-0.5 flex-shrink-0">🧑</span>
                          <div className="flex-1 bg-gray-800/70 rounded-lg rounded-tl-none px-3 py-2.5 border border-gray-700">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-400 font-medium">Caller</p>
                              {sessionState.sessionId && (
                                <AudioButton
                                  src={`${BACKEND_URL}/api/audio/${sessionState.sessionId}/${turn.turn_number - 1}/caller`}
                                  label="Play caller audio"
                                />
                              )}
                            </div>
                            <p className="text-sm text-gray-200 leading-relaxed">{turn.caller_message}</p>
                          </div>
                        </div>

                        {/* Agent response */}
                        <div className="flex gap-2.5 items-start justify-end">
                          <div className="flex-1 bg-gray-900 rounded-lg rounded-tr-none px-3 py-2.5 border border-gray-800">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-xs text-gray-400 font-medium">Agent</p>
                              {sessionState.sessionId && (
                                <AudioButton
                                  src={`${BACKEND_URL}/api/audio/${sessionState.sessionId}/${turn.turn_number - 1}/agent`}
                                  label="Play agent audio"
                                />
                              )}
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed">{turn.agent_response}</p>
                          </div>
                          <span className="text-lg leading-none mt-0.5 flex-shrink-0">🤖</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Live Practice tab */}
          {centerTab === 'avatar' && (
            <LiveCallPanel onEmotionUpdate={handleLiveEmotionUpdate} />
          )}
        </div>

        {/* ── Right Sidebar ─────────────────────────────────────────────── */}
        <aside className="bg-gray-900 border-l border-gray-800 p-6 flex flex-col gap-6 overflow-y-auto">

          {/* Caller Emotional State */}
          <section>
            <SectionHeader>Caller State</SectionHeader>
            <div className="text-center py-4">
              <span className="text-5xl block mb-2">{callerFace}</span>
              <p className="text-xs text-gray-500">
                {turns.length === 0
                  ? 'Awaiting evaluation'
                  : `Peak anger: ${Math.round(maxAnger * 100)}%`}
              </p>
            </div>

            {/* Emotion bars — live call or latest sim turn */}
            <div className="space-y-3 mt-2">
              <EmotionBar
                label="Anger"
                value={activeEmotionScores?.anger ?? 0}
                color="bg-red-400"
              />
              <EmotionBar
                label="Frustration"
                value={
                  activeEmotionScores
                    ? (activeEmotionScores.sadness + activeEmotionScores.disgust) / 2
                    : 0
                }
                color="bg-amber-400"
              />
              <EmotionBar
                label="Neutral"
                value={activeEmotionScores?.neutral ?? 0}
                color="bg-blue-400"
              />
              <EmotionBar
                label="Joy"
                value={activeEmotionScores?.joy ?? 0}
                color="bg-emerald-400"
              />
            </div>
          </section>

          {/* Live Coaching Signal */}
          <section>
            <SectionHeader>Live Coaching Signal</SectionHeader>
            {activeEmotionScores ? (() => {
              const sig = COACHING_SIGNALS[activeEmotionLevel] ?? COACHING_SIGNALS[0]
              return (
                <div className={`rounded-lg border p-3 space-y-2 ${sig.borderClass}`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-bold ${sig.tagClass}`}>{sig.label}</span>
                    <span className="text-xs text-gray-500 font-medium">{sig.action}</span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{sig.text}</p>
                  {sig.escalate && (
                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-red-900/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse flex-shrink-0" />
                      <span className="text-xs text-red-400 font-semibold">Recommend human escalation</span>
                    </div>
                  )}
                </div>
              )
            })() : (
              <div className="rounded-lg border border-gray-800 bg-gray-800/20 p-3 text-center">
                <p className="text-xs text-gray-600">Signals appear as turns arrive</p>
              </div>
            )}
          </section>

          {/* Report Card */}
          <section>
            <SectionHeader>Evaluation Report</SectionHeader>

            {report ? (
              <div className="space-y-4">
                {/* Score + Grade */}
                <div className="bg-gray-800/60 rounded-xl border border-gray-700 p-4 text-center">
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-5xl font-bold text-white">{report.overall_score}</span>
                    <span className="text-xl text-gray-500">/100</span>
                  </div>
                  <div className="flex items-center justify-center gap-3 mt-2">
                    <span className={`text-2xl font-bold ${getGradeColor(report.grade)}`}>
                      {report.grade}
                    </span>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        report.passed
                          ? 'bg-green-950 text-green-400 border border-green-800'
                          : 'bg-red-950 text-red-400 border border-red-800'
                      }`}
                    >
                      {report.passed ? '✓ PASS' : '✗ FAIL'}
                    </span>
                  </div>
                </div>

                {/* Metrics */}
                <div className="space-y-3">
                  <MetricBar label="De-escalation" value={report.de_escalation * 100} />
                  <MetricBar label="Empathy" value={report.empathy * 100} />
                  <MetricBar label="Resolution" value={report.resolution * 100} />
                </div>

                {/* Insights */}
                {report.insights && report.insights.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-2">
                      Insights
                    </p>
                    <ul className="space-y-1.5">
                      {report.insights.map((insight, idx) => {
                        const isPositive = insight.startsWith('✓') || insight.startsWith('+')
                        return (
                          <li
                            key={idx}
                            className={`text-xs flex items-start gap-1.5 ${
                              isPositive ? 'text-emerald-400' : 'text-red-400'
                            }`}
                          >
                            <span className="mt-0.5 flex-shrink-0">{isPositive ? '✓' : '✗'}</span>
                            <span className="leading-relaxed">
                              {insight.replace(/^[✓✗+\-]\s*/, '')}
                            </span>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>
            ) : (
              /* Placeholder */
              <div className="bg-gray-800/40 rounded-xl border border-gray-700/50 p-4 text-center space-y-3">
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-5xl font-bold text-gray-700">—</span>
                  <span className="text-xl text-gray-700">/100</span>
                </div>
                <p className="text-xs text-gray-600">
                  Run an evaluation to see results
                </p>
                <div className="space-y-2 opacity-30">
                  <div className="h-2 bg-gray-700 rounded-full" />
                  <div className="h-2 bg-gray-700 rounded-full w-4/5 mx-auto" />
                  <div className="h-2 bg-gray-700 rounded-full w-3/5 mx-auto" />
                </div>
              </div>
            )}
          </section>
        </aside>
      </main>
    </div>
  )
}
