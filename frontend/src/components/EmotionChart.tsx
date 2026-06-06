'use client'

import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'

export interface ChartPoint {
  turn: number
  anger: number
  frustration: number
  neutral: number
  joy: number
}

interface TooltipPayloadEntry {
  name: string
  value: number
  color: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: TooltipPayloadEntry[]
  label?: string | number
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div
      style={{
        background: '#1f2937',
        border: '1px solid #374151',
        borderRadius: '8px',
        padding: '10px 14px',
      }}
    >
      <p style={{ color: '#9ca3af', fontSize: 11, marginBottom: 6 }}>
        Turn {label}
      </p>
      {payload.map((entry) => (
        <p
          key={entry.name}
          style={{ color: entry.color, fontSize: 12, margin: '2px 0' }}
        >
          <span style={{ textTransform: 'capitalize' }}>{entry.name}</span>:{' '}
          {Math.round(entry.value * 100)}%
        </p>
      ))}
    </div>
  )
}

interface EmotionChartProps {
  data: ChartPoint[]
}

export default function EmotionChart({ data }: EmotionChartProps) {
  if (data.length === 0) {
    return (
      <div className="h-full min-h-[200px] flex items-center justify-center">
        <p className="text-gray-600 text-sm text-center">
          Run an evaluation to see the emotional arc
        </p>
      </div>
    )
  }

  return (
    <div className="h-full min-h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
        >
          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="turn"
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            label={{
              value: 'Turn',
              position: 'insideBottom',
              offset: -2,
              fill: '#6b7280',
              fontSize: 11,
            }}
          />
          <YAxis
            domain={[0, 1]}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            tick={{ fill: '#6b7280', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={42}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              fontSize: 11,
              color: '#9ca3af',
              paddingTop: 8,
            }}
            formatter={(value: string) =>
              value.charAt(0).toUpperCase() + value.slice(1)
            }
          />
          <Line
            type="monotone"
            dataKey="anger"
            stroke="#f87171"
            strokeWidth={2}
            dot={{ fill: '#f87171', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="frustration"
            stroke="#fbbf24"
            strokeWidth={2}
            dot={{ fill: '#fbbf24', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="neutral"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ fill: '#60a5fa', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
          <Line
            type="monotone"
            dataKey="joy"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ fill: '#34d399', r: 3, strokeWidth: 0 }}
            activeDot={{ r: 5, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
