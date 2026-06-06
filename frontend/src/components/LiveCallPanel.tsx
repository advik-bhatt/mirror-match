'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'
const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || ''

interface LiveMessage {
  id: number
  source: 'user' | 'ai'
  text: string
  emotionLevel: number
}

const EMOTION_COLORS: Record<number, string> = {
  0: 'bg-blue-900/60 text-blue-300',
  1: 'bg-amber-900/60 text-amber-300',
  2: 'bg-red-900/60 text-red-300',
  3: 'bg-red-950/80 text-red-200',
}

const EMOTION_LABELS: Record<number, string> = {
  0: 'Calm',
  1: 'Frustrated',
  2: 'Angry',
  3: 'Furious',
}

export interface LiveCallPanelProps {
  onEmotionUpdate?: (scores: Record<string, number>, emotionLevel: number) => void
}

export default function LiveCallPanel({ onEmotionUpdate }: LiveCallPanelProps) {
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active' | 'ended'>('idle')
  const [mode, setMode] = useState<'speaking' | 'listening'>('listening')
  const [messages, setMessages] = useState<LiveMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const convRef = useRef<{ endSession: () => Promise<void> } | null>(null)
  const msgIdRef = useRef(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const classifyText = useCallback(async (text: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) return null
      return await res.json() as { scores: Record<string, number>; emotion_level: number }
    } catch {
      return null
    }
  }, [])

  const startCall = useCallback(async () => {
    if (!AGENT_ID) {
      setError('NEXT_PUBLIC_ELEVENLABS_AGENT_ID not set — see setup below.')
      return
    }
    setCallStatus('connecting')
    setMessages([])
    setError(null)

    try {
      const { Conversation } = await import('@11labs/client')
      const conv = await Conversation.startSession({
        agentId: AGENT_ID,
        connectionType: 'webrtc',
        onConnect: () => setCallStatus('active'),
        onDisconnect: () => setCallStatus('ended'),
        onError: (msg: string) => { setError(msg); setCallStatus('idle') },
        onModeChange: ({ mode }: { mode: 'speaking' | 'listening' }) => setMode(mode),
        onMessage: async ({ message, source }: { message: string; source: 'user' | 'ai' }) => {
          const id = ++msgIdRef.current
          let level = 0
          if (source === 'ai') {
            const result = await classifyText(message)
            if (result) {
              level = result.emotion_level
              onEmotionUpdate?.(result.scores, result.emotion_level)
            }
          }
          setMessages(prev => [...prev, { id, source, text: message, emotionLevel: level }])
        },
      })
      convRef.current = conv
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Connection failed')
      setCallStatus('idle')
    }
  }, [classifyText, onEmotionUpdate])

  const endCall = useCallback(async () => {
    if (convRef.current) {
      await convRef.current.endSession()
      convRef.current = null
    }
    setCallStatus('ended')
  }, [])

  if (!AGENT_ID && callStatus === 'idle') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
        <div className="text-center space-y-4 max-w-md">
          <span className="text-6xl block">🎙️</span>
          <div>
            <p className="text-gray-200 font-semibold text-lg">Live Practice Call</p>
            <p className="text-gray-500 text-sm mt-1 leading-relaxed">
              Practice de-escalation against Alex — an adversarial AI caller that gets angrier every turn, powered by ElevenLabs Conversational AI.
            </p>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-700 p-4 text-left space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Setup</p>
            <ol className="text-xs text-gray-400 space-y-1.5 list-decimal list-inside leading-relaxed">
              <li>Go to <span className="text-orange-400">elevenlabs.io → ElevenAgents</span> and create an agent</li>
              <li>Use the system prompt below as the agent persona</li>
              <li>Copy the Agent ID and add to <code className="text-orange-400">.env</code></li>
            </ol>
            <code className="text-xs text-orange-400 block bg-gray-800 rounded px-2 py-1.5">
              NEXT_PUBLIC_ELEVENLABS_AGENT_ID=your_agent_id
            </code>
            <div className="border-t border-gray-700 pt-3">
              <p className="text-xs font-semibold text-gray-400 mb-1.5">Agent System Prompt:</p>
              <p className="text-xs text-gray-500 italic leading-relaxed">
                You are Alex, a customer calling support about an unexpected $49.99 charge. Start confused but polite. Escalate your frustration if the agent deflects, reads scripts, or fails to resolve the issue. Use CAPS for emphasis when angry. Demand a supervisor if ignored twice. Keep responses under 3 sentences.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-200">Live Practice Call</span>
          {callStatus === 'active' && (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              LIVE
            </span>
          )}
        </div>
        {callStatus === 'active' && (
          <span className={`text-xs px-2 py-0.5 rounded font-medium transition-all ${
            mode === 'speaking'
              ? 'bg-orange-900/60 text-orange-300'
              : 'bg-gray-800 text-gray-400'
          }`}>
            {mode === 'speaking' ? '🗣 Alex speaking' : '🎙 Your turn'}
          </span>
        )}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {callStatus === 'idle' && (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 text-sm">Start a call to practice de-escalation</p>
          </div>
        )}
        {callStatus === 'connecting' && (
          <div className="h-full flex flex-col items-center justify-center gap-2 text-gray-500">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm">Connecting to Alex…</p>
          </div>
        )}
        {(callStatus === 'active' || callStatus === 'ended') && messages.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <p className="text-gray-600 text-sm">Waiting for Alex to speak…</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 items-start ${msg.source === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.source === 'ai' && (
              <span className="text-lg leading-none mt-0.5 flex-shrink-0">😤</span>
            )}
            <div className={`max-w-[85%] rounded-lg px-3 py-2 ${
              msg.source === 'ai'
                ? 'bg-gray-800 border border-gray-700 rounded-tl-none'
                : 'bg-blue-950 border border-blue-900 rounded-tr-none'
            }`}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs text-gray-500">
                  {msg.source === 'ai' ? 'Alex (Caller)' : 'You (Agent)'}
                </span>
                {msg.source === 'ai' && msg.emotionLevel > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded ${EMOTION_COLORS[msg.emotionLevel]}`}>
                    {EMOTION_LABELS[msg.emotionLevel]}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-200 leading-relaxed">{msg.text}</p>
            </div>
            {msg.source === 'user' && (
              <span className="text-lg leading-none mt-0.5 flex-shrink-0">🎧</span>
            )}
          </div>
        ))}
        {callStatus === 'ended' && messages.length > 0 && (
          <div className="text-center py-2 text-xs text-gray-600">— call ended —</div>
        )}
      </div>

      {error && (
        <div className="mx-4 mb-2 p-2 bg-red-950/50 border border-red-800 rounded text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Controls */}
      <div className="p-4 border-t border-gray-800 flex-shrink-0">
        {callStatus === 'idle' || callStatus === 'ended' ? (
          <button
            onClick={startCall}
            className="w-full py-2.5 bg-green-700 hover:bg-green-600 text-white font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span>📞</span>
            {callStatus === 'ended' ? 'Start New Call' : 'Start Practice Call'}
          </button>
        ) : callStatus === 'connecting' ? (
          <button disabled className="w-full py-2.5 bg-gray-700 text-gray-400 font-semibold text-sm rounded-lg cursor-not-allowed">
            Connecting…
          </button>
        ) : (
          <button
            onClick={endCall}
            className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white font-semibold text-sm rounded-lg transition-all flex items-center justify-center gap-2"
          >
            <span>📵</span>
            End Call
          </button>
        )}
      </div>
    </div>
  )
}
