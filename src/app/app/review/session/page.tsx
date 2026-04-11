'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { scheduleCard } from '@/lib/fsrs'
import type { Card, CardProgress } from '@/lib/types'

interface ReviewCard {
  card: Card
  progress: CardProgress
}

interface SessionStats {
  again: number
  hard: number
  good: number
  easy: number
  totalTime: number
}

export default function ReviewSessionPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const deckId = searchParams.get('deck')
  const count = parseInt(searchParams.get('count') || '20')

  const [cards, setCards] = useState<ReviewCard[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showAnswer, setShowAnswer] = useState(false)
  const [cardStartTime, setCardStartTime] = useState(Date.now())
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<SessionStats>({
    again: 0,
    hard: 0,
    good: 0,
    easy: 0,
    totalTime: 0,
  })

  useEffect(() => {
    async function loadCards() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get due card progress
      let progressQuery = supabase
        .from('card_progress')
        .select('*')
        .eq('user_id', user.id)
        .lte('due', new Date().toISOString())
        .order('due', { ascending: true })
        .limit(count)

      if (deckId) {
        const { data: deckCards } = await supabase
          .from('cards')
          .select('id')
          .eq('deck_id', deckId)

        if (deckCards) {
          progressQuery = progressQuery.in('card_id', deckCards.map((c) => c.id))
        }
      }

      const { data: progressData } = await progressQuery

      if (!progressData || progressData.length === 0) {
        router.push('/app/review')
        return
      }

      // Fetch the actual card content
      const cardIds = progressData.map((p) => p.card_id)
      const { data: cardsData } = await supabase
        .from('cards')
        .select('*')
        .in('id', cardIds)

      if (!cardsData) {
        router.push('/app/review')
        return
      }

      // Combine and sort: review cards first (by due date), then new cards
      const cardMap = new Map(cardsData.map((c) => [c.id, c as Card]))
      const reviewCards: ReviewCard[] = []

      for (const progress of progressData as CardProgress[]) {
        const card = cardMap.get(progress.card_id)
        if (card) {
          reviewCards.push({ card, progress })
        }
      }

      // Sort: overdue review cards first, then new cards
      reviewCards.sort((a, b) => {
        if (a.progress.state === 'new' && b.progress.state !== 'new') return 1
        if (a.progress.state !== 'new' && b.progress.state === 'new') return -1
        return new Date(a.progress.due).getTime() - new Date(b.progress.due).getTime()
      })

      setCards(reviewCards)
      setCardStartTime(Date.now())
      setLoading(false)
    }
    loadCards()
  }, [])

  const handleRating = useCallback(async (rating: 1 | 2 | 3 | 4) => {
    const current = cards[currentIndex]
    if (!current) return

    const timeTaken = Date.now() - cardStartTime

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Compute new FSRS state
    const newState = scheduleCard(current.progress, rating)

    // Update card_progress
    await supabase
      .from('card_progress')
      .update({
        stability: newState.stability,
        difficulty: newState.difficulty,
        elapsed_days: newState.elapsed_days,
        scheduled_days: newState.scheduled_days,
        reps: newState.reps,
        lapses: newState.lapses,
        state: newState.state,
        due: newState.due,
        last_review: newState.last_review,
      })
      .eq('id', current.progress.id)

    // Insert review log
    const deckIdForLog = current.card.deck_id
    await supabase.from('review_logs').insert({
      user_id: user.id,
      card_id: current.card.id,
      deck_id: deckIdForLog,
      rating,
      time_taken_ms: timeTaken,
      scheduled_days: current.progress.scheduled_days,
      actual_days: current.progress.elapsed_days,
    })

    // Update stats
    const ratingKey = { 1: 'again', 2: 'hard', 3: 'good', 4: 'easy' } as const
    setStats((prev) => ({
      ...prev,
      [ratingKey[rating]]: prev[ratingKey[rating]] + 1,
      totalTime: prev.totalTime + timeTaken,
    }))

    // Next card or complete
    if (currentIndex + 1 >= cards.length) {
      // Session complete — store stats and redirect
      const finalStats = {
        ...stats,
        [ratingKey[rating]]: stats[ratingKey[rating]] + 1,
        totalTime: stats.totalTime + timeTaken,
        totalCards: cards.length,
      }
      sessionStorage.setItem('reviewStats', JSON.stringify(finalStats))
      router.push('/app/review/complete')
    } else {
      setCurrentIndex((prev) => prev + 1)
      setShowAnswer(false)
      setCardStartTime(Date.now())
    }
  }, [cards, currentIndex, cardStartTime, stats, router, supabase])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const current = cards[currentIndex]
  if (!current) return null

  const isCloze = current.card.card_type === 'cloze'
  const progress = ((currentIndex) / cards.length) * 100

  // Render cloze front: replace {{term}} with blank
  const frontText = isCloze
    ? current.card.front.replace(/\{\{([^}]+)\}\}/g, '_______')
    : current.card.front

  // Render cloze back: highlight the answer
  const backText = isCloze
    ? current.card.back.replace(
        /\{\{([^}]+)\}\}/g,
        '<span class="text-green-400 font-semibold">$1</span>'
      )
    : current.card.back

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-zinc-500">
          {currentIndex + 1}/{cards.length}
        </span>
      </div>

      {/* Card */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
        {/* Front */}
        <div className="p-6">
          <span className="text-xs text-zinc-500 uppercase tracking-wide mb-3 block">
            {isCloze ? 'Fill in the blank' : 'Question'}
          </span>
          <p className="text-lg text-white leading-relaxed">{frontText}</p>

          {current.card.image_url && (
            <img
              src={current.card.image_url}
              alt="Card image"
              className="mt-4 rounded-lg max-h-64 object-contain cursor-pointer"
            />
          )}
        </div>

        {/* Answer */}
        {showAnswer ? (
          <>
            <div className="border-t border-zinc-800 p-6">
              <span className="text-xs text-zinc-500 uppercase tracking-wide mb-3 block">
                Answer
              </span>
              {isCloze ? (
                <p
                  className="text-lg text-zinc-200 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: backText }}
                />
              ) : (
                <p className="text-lg text-zinc-200 leading-relaxed">{backText}</p>
              )}
            </div>

            {/* Rating buttons */}
            <div className="border-t border-zinc-800 p-4 grid grid-cols-4 gap-2">
              <button
                onClick={() => handleRating(1)}
                className="py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors"
              >
                Again
              </button>
              <button
                onClick={() => handleRating(2)}
                className="py-3 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-sm font-medium transition-colors"
              >
                Hard
              </button>
              <button
                onClick={() => handleRating(3)}
                className="py-3 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-sm font-medium transition-colors"
              >
                Good
              </button>
              <button
                onClick={() => handleRating(4)}
                className="py-3 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-sm font-medium transition-colors"
              >
                Easy
              </button>
            </div>
          </>
        ) : (
          <div className="border-t border-zinc-800 p-4">
            <button
              onClick={() => setShowAnswer(true)}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              Show Answer
            </button>
          </div>
        )}
      </div>

      {/* Tags */}
      {current.card.tags && current.card.tags.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mt-4 justify-center">
          {current.card.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-zinc-900 text-zinc-500 rounded text-xs"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
