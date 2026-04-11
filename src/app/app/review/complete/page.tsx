'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface SessionStats {
  again: number
  hard: number
  good: number
  easy: number
  totalTime: number
  totalCards: number
}

export default function ReviewCompletePage() {
  const [stats, setStats] = useState<SessionStats | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('reviewStats')
    if (stored) {
      setStats(JSON.parse(stored))
      sessionStorage.removeItem('reviewStats')
    }
  }, [])

  if (!stats) {
    return (
      <div className="max-w-md mx-auto text-center py-16">
        <h1 className="text-2xl font-bold text-white mb-4">Session Complete!</h1>
        <Link href="/app" className="text-indigo-400 hover:text-indigo-300">
          Back to Dashboard
        </Link>
      </div>
    )
  }

  const totalReviewed = stats.again + stats.hard + stats.good + stats.easy
  const retentionRate =
    totalReviewed > 0
      ? Math.round(((stats.good + stats.easy) / totalReviewed) * 100)
      : 0
  const avgTimePerCard =
    totalReviewed > 0 ? Math.round(stats.totalTime / totalReviewed / 1000) : 0

  return (
    <div className="max-w-md mx-auto text-center">
      <div className="mb-8">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold text-white mb-2">Session Complete!</h1>
        <p className="text-zinc-400">
          You reviewed {totalReviewed} card{totalReviewed !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Retention</p>
          <p className="text-2xl font-bold text-green-400">{retentionRate}%</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-sm text-zinc-400">Avg. time</p>
          <p className="text-2xl font-bold text-white">{avgTimePerCard}s</p>
        </div>
      </div>

      {/* Rating breakdown */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-8">
        <h3 className="text-sm font-medium text-zinc-300 mb-3">Rating Breakdown</h3>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold text-red-400">{stats.again}</p>
            <p className="text-xs text-zinc-500">Again</p>
          </div>
          <div>
            <p className="text-lg font-bold text-orange-400">{stats.hard}</p>
            <p className="text-xs text-zinc-500">Hard</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-400">{stats.good}</p>
            <p className="text-xs text-zinc-500">Good</p>
          </div>
          <div>
            <p className="text-lg font-bold text-blue-400">{stats.easy}</p>
            <p className="text-xs text-zinc-500">Easy</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <Link
          href="/app/review"
          className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg text-center transition-colors"
        >
          Review More
        </Link>
        <Link
          href="/app"
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-center transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </div>
  )
}
