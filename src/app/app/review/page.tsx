'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Deck } from '@/lib/types'

export default function ReviewStartPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const preselectedDeck = searchParams.get('deck')

  const [decks, setDecks] = useState<Deck[]>([])
  const [selectedDeck, setSelectedDeck] = useState<string>(preselectedDeck || 'all')
  const [cardCount, setCardCount] = useState(20)
  const [dueCount, setDueCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('decks')
        .select('*')
        .eq('user_id', user.id)
        .order('title')

      setDecks((data as Deck[]) || [])

      // Count due cards
      let query = supabase
        .from('card_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .lte('due', new Date().toISOString())

      if (preselectedDeck && preselectedDeck !== 'all') {
        // Get card IDs for this deck
        const { data: deckCards } = await supabase
          .from('cards')
          .select('id')
          .eq('deck_id', preselectedDeck)

        if (deckCards) {
          query = query.in('card_id', deckCards.map((c) => c.id))
        }
      }

      const { count } = await query
      setDueCount(count || 0)
      setLoading(false)
    }
    load()
  }, [preselectedDeck])

  useEffect(() => {
    async function updateDueCount() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (selectedDeck === 'all') {
        const { count } = await supabase
          .from('card_progress')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .lte('due', new Date().toISOString())
        setDueCount(count || 0)
      } else {
        const { data: deckCards } = await supabase
          .from('cards')
          .select('id')
          .eq('deck_id', selectedDeck)

        if (deckCards && deckCards.length > 0) {
          const { count } = await supabase
            .from('card_progress')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', user.id)
            .in('card_id', deckCards.map((c) => c.id))
            .lte('due', new Date().toISOString())
          setDueCount(count || 0)
        } else {
          setDueCount(0)
        }
      }
    }
    if (!loading) updateDueCount()
  }, [selectedDeck])

  function startSession() {
    const params = new URLSearchParams()
    if (selectedDeck !== 'all') params.set('deck', selectedDeck)
    params.set('count', String(Math.min(cardCount, dueCount)))
    router.push(`/app/review/session?${params.toString()}`)
  }

  const sessionCards = Math.min(cardCount, dueCount)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Start Review Session</h1>

      {dueCount === 0 && selectedDeck === 'all' ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 mb-2">No cards due for review!</p>
          <p className="text-sm text-zinc-500">Create a new deck to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Deck selector */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Deck</label>
            <select
              value={selectedDeck}
              onChange={(e) => setSelectedDeck(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All due cards</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title}
                </option>
              ))}
            </select>
          </div>

          {/* Card count slider */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Session size: {sessionCards} card{sessionCards !== 1 ? 's' : ''}
            </label>
            <input
              type="range"
              min={5}
              max={30}
              step={5}
              value={cardCount}
              onChange={(e) => setCardCount(parseInt(e.target.value))}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>5</span>
              <span>~{sessionCards} min</span>
              <span>30</span>
            </div>
          </div>

          {/* Due count info */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-400">
              <span className="text-white font-semibold">{dueCount}</span> card{dueCount !== 1 ? 's' : ''} due for review
            </p>
          </div>

          <button
            onClick={startSession}
            disabled={dueCount === 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg text-lg transition-colors"
          >
            Start Session
          </button>
        </div>
      )}
    </div>
  )
}
