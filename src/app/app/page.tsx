import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Deck } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch user's decks
  const { data: decks } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false }) as { data: Deck[] | null }

  // Count due cards
  const { count: dueCount } = await supabase
    .from('card_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('due', new Date().toISOString())

  // Calculate streak: consecutive days with at least 1 review
  const { data: recentReviews } = await supabase
    .from('review_logs')
    .select('reviewed_at')
    .eq('user_id', user.id)
    .order('reviewed_at', { ascending: false })
    .limit(100)

  const streak = calculateStreak(recentReviews?.map((r) => r.reviewed_at) || [])

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-6">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400 mb-1">Due today</p>
          <p className="text-3xl font-bold text-indigo-400">{dueCount || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400 mb-1">Decks</p>
          <p className="text-3xl font-bold text-white">{decks?.length || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <p className="text-sm text-zinc-400 mb-1">Streak</p>
          <p className="text-3xl font-bold text-white">{streak} day{streak !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 mb-8">
        <Link
          href="/app/decks/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Deck
        </Link>
        {(dueCount || 0) > 0 && (
          <Link
            href="/app/review"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Start Review
          </Link>
        )}
      </div>

      {/* Recent decks */}
      <h2 className="text-lg font-semibold text-white mb-3">Your Decks</h2>
      {!decks || decks.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 mb-4">No decks yet. Create your first one!</p>
          <Link
            href="/app/decks/new"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Create a deck
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {decks.map((deck) => (
            <Link
              key={deck.id}
              href={`/app/decks/${deck.id}`}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors"
            >
              <h3 className="font-semibold text-white mb-1 truncate">{deck.title}</h3>
              <p className="text-sm text-zinc-400">
                {deck.card_count} card{deck.card_count !== 1 ? 's' : ''} &middot;{' '}
                {deck.source_type.toUpperCase()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function calculateStreak(reviewDates: string[]): number {
  if (reviewDates.length === 0) return 0

  const uniqueDays = new Set(
    reviewDates.map((d) => new Date(d).toISOString().split('T')[0])
  )
  const sortedDays = Array.from(uniqueDays).sort().reverse()

  const today = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

  // Streak must include today or yesterday
  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) return 0

  let streak = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000

    if (diffDays === 1) {
      streak++
    } else {
      break
    }
  }

  return streak
}
