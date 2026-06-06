import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MirrorMatch — Emotional IQ Evals',
  description: 'Real-time emotion evaluation dashboard for AI agent conversations',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
