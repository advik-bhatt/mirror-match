'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

export interface TranscriptEntry {
  id: number
  speaker: 'customer' | 'agent'
  text: string
  emotionLevel: number
  timestamp: string
}

interface Props {
  onEmotionUpdate?: (scores: Record<string, number>, emotionLevel: number) => void
  onTranscript?: (entry: TranscriptEntry) => void
}

let entryId = 0

export default function TavusPanel({ onEmotionUpdate, onTranscript }: Props) {
  const [conversationUrl, setConversationUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [callActive, setCallActive] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const classifyAndEmit = useCallback(async (text: string, speaker: 'customer' | 'agent') => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const data = await res.json() as { scores: Record<string, number>; emotion_level: number }
      onEmotionUpdate?.(data.scores, data.emotion_level)
      onTranscript?.({
        id: ++entryId,
        speaker,
        text,
        emotionLevel: data.emotion_level,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
    } catch { /* ignore */ }
  }, [onEmotionUpdate, onTranscript])

  // Start speech recognition when call goes live
  useEffect(() => {
    if (!callActive) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      return
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1]
      if (result.isFinal) {
        const text = result[0].transcript.trim()
        if (text.length > 3) void classifyAndEmit(text, 'customer')
      }
    }

    recognition.onerror = () => {
      setTimeout(() => recognition.start(), 1000)
    }

    recognition.start()
    recognitionRef.current = recognition

    return () => {
      recognition.stop()
    }
  }, [callActive, classifyAndEmit])

  const startCall = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/tavus/conversation`, { method: 'POST' })
      const data = await res.json() as { conversation_url?: string; error?: string }
      if (data.conversation_url) {
        setConversationUrl(data.conversation_url)
        setCallActive(true)
      } else {
        setError(data.error ?? 'Could not start session')
      }
    } catch {
      setError('Backend unreachable')
    } finally {
      setLoading(false)
    }
  }, [])

  const endCall = useCallback(() => {
    setConversationUrl(null)
    setCallActive(false)
  }, [])

  if (conversationUrl) {
    return (
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-950 border border-red-800 rounded-full text-xs text-red-400 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
          <button
            onClick={endCall}
            className="px-3 py-1 text-xs bg-gray-800 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700"
          >
            End Call
          </button>
        </div>
        <iframe
          src={conversationUrl}
          allow="camera; microphone; autoplay; display-capture"
          className="flex-1 w-full border-0"
          style={{ minHeight: '100%' }}
        />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center space-y-3">
        <div className="text-6xl">🎭</div>
        <h2 className="text-xl font-bold text-white">Live Agent Evaluation</h2>
        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
          Call in as an angry customer. The Tavus AI agent tries to de-escalate you.
          MirrorMatch monitors the agent's performance in real time.
        </p>
      </div>
      {error && <p className="text-sm text-red-400 text-center max-w-xs">{error}</p>}
      <button
        onClick={startCall}
        disabled={loading}
        className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
          loading
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20'
        }`}
      >
        {loading ? 'Connecting…' : '🎙 Start Live Call'}
      </button>
    </div>
  )
}
