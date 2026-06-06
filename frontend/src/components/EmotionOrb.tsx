'use client'

import { useEffect, useRef } from 'react'

const COLORS = [
  { bg: '#1d4ed8', glow: '#3b82f6', ring: '#1e3a8a' }, // calm — blue
  { bg: '#d97706', glow: '#f59e0b', ring: '#92400e' }, // frustrated — amber
  { bg: '#dc2626', glow: '#ef4444', ring: '#991b1b' }, // angry — red
  { bg: '#7f1d1d', glow: '#b91c1c', ring: '#450a0a' }, // furious — deep red
]

interface Props {
  emotionLevel: number
  anger: number
}

export default function EmotionOrb({ emotionLevel, anger }: Props) {
  const orbRef = useRef<HTMLDivElement>(null)
  const glowRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  const level = Math.min(Math.max(emotionLevel, 0), 3)
  const colors = COLORS[level]
  const pulseSpeed = 2.5 - anger * 1.8 // 2.5s calm → 0.7s furious
  const glowSize = 20 + anger * 60 // 20px → 80px glow

  useEffect(() => {
    if (orbRef.current) {
      orbRef.current.style.animationDuration = `${Math.max(pulseSpeed, 0.6)}s`
      orbRef.current.style.background = `radial-gradient(circle at 35% 35%, ${colors.glow}, ${colors.bg})`
      orbRef.current.style.boxShadow = `0 0 ${glowSize}px ${glowSize / 2}px ${colors.glow}40`
    }
    if (glowRef.current) {
      glowRef.current.style.background = colors.glow
      glowRef.current.style.animationDuration = `${Math.max(pulseSpeed * 1.3, 0.8)}s`
      glowRef.current.style.width = `${140 + anger * 40}px`
      glowRef.current.style.height = `${140 + anger * 40}px`
    }
    if (ringRef.current) {
      ringRef.current.style.borderColor = colors.ring
      ringRef.current.style.animationDuration = `${Math.max(pulseSpeed * 2, 1.2)}s`
    }
  }, [emotionLevel, anger, colors, glowSize, pulseSpeed])

  return (
    <div className="w-full h-full flex items-center justify-center relative overflow-hidden">
      {/* Outer ring */}
      <div
        ref={ringRef}
        className="absolute rounded-full border opacity-30"
        style={{
          width: '160px', height: '160px',
          borderColor: colors.ring,
          animation: 'orb-ring 3s ease-in-out infinite',
        }}
      />
      {/* Glow blob */}
      <div
        ref={glowRef}
        className="absolute rounded-full opacity-20 blur-2xl"
        style={{
          width: '120px', height: '120px',
          background: colors.glow,
          animation: 'orb-pulse 2s ease-in-out infinite',
        }}
      />
      {/* Core orb */}
      <div
        ref={orbRef}
        className="relative rounded-full z-10"
        style={{
          width: '80px', height: '80px',
          background: `radial-gradient(circle at 35% 35%, ${colors.glow}, ${colors.bg})`,
          boxShadow: `0 0 ${glowSize}px ${glowSize / 2}px ${colors.glow}40`,
          animation: 'orb-pulse 2s ease-in-out infinite',
        }}
      >
        {/* Specular highlight */}
        <div className="absolute top-3 left-3 w-5 h-5 rounded-full bg-white opacity-25 blur-sm" />
      </div>

      <style>{`
        @keyframes orb-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
        @keyframes orb-ring {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.25); opacity: 0.1; }
        }
      `}</style>
    </div>
  )
}
