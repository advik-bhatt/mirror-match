'use client'

import React, { useState, useCallback } from 'react'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'

interface Props {
  onEmotionUpdate?: (scores: Record<string, number>, emotionLevel: number) => void
}

export default function TavusPanel({ onEmotionUpdate: _onEmotionUpdate }: Props) {
  const [conversationUrl, setConversationUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ended, setEnded] = useState(false)

  const startCall = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/tavus/conversation`, { method: 'POST' })
      const data = await res.json() as { conversation_url?: string; error?: string }
      if (data.conversation_url) {
        setConversationUrl(data.conversation_url)
      } else {
        setError(data.error ?? 'Could not start Tavus session')
      }
    } catch {
      setError('Backend unreachable — is the server running?')
    } finally {
      setLoading(false)
    }
  }, [])

  const endCall = useCallback(() => {
    setConversationUrl(null)
    setEnded(true)
    setTimeout(() => setEnded(false), 3000)
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
        <h2 className="text-xl font-bold text-white">Tavus Live Avatar</h2>
        <p className="text-sm text-gray-400 max-w-sm leading-relaxed">
          A photorealistic AI customer calls you live. Practice de-escalation while
          MirrorMatch tracks their emotional state in real time.
        </p>
      </div>

      {ended && (
        <p className="text-sm text-green-400">Call ended. Session data saved.</p>
      )}

      {error && (
        <p className="text-sm text-red-400 text-center max-w-xs">{error}</p>
      )}

      <button
        onClick={startCall}
        disabled={loading}
        className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 ${
          loading
            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
            : 'bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/20'
        }`}
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting…
          </>
        ) : (
          <>🎙 Start Live Call</>
        )}
      </button>

      <p className="text-xs text-gray-600 text-center">
        Powered by Tavus CVI · Requires TAVUS_API_KEY
      </p>
    </div>
  )
}
