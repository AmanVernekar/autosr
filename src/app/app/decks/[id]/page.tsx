import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Deck, Card } from '@/lib/types'
import DeckCards from './deck-cards'

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: deck } = await supabase
    .from('decks')
    .select('*')
    .eq('id', id)
    .single() as { data: Deck | null }

  if (!deck) return notFound()

  const { data: cards } = await supabase
    .from('cards')
    .select('*')
    .eq('deck_id', id)
    .order('position', { ascending: true }) as { data: Card[] | null }

  // Count due cards for this deck
  const cardIds = cards?.map((c) => c.id) || []
  const { count: dueCount } = cardIds.length > 0
    ? await supabase
        .from('card_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .in('card_id', cardIds)
        .lte('due', new Date().toISOString())
    : { count: 0 }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Link href="/app/decks" className="text-sm text-zinc-500 hover:text-zinc-300 mb-2 block">
            &larr; All Decks
          </Link>
          <h1 className="text-2xl font-bold text-white">{deck.title}</h1>
          {deck.description && (
            <p className="text-zinc-400 mt-1">{deck.description}</p>
          )}
          <p className="text-sm text-zinc-500 mt-2">
            {deck.card_count} cards &middot; {deck.source_type.toUpperCase()} &middot;{' '}
            {new Date(deck.created_at).toLocaleDateString()}
          </p>
        </div>
        {(dueCount || 0) > 0 && (
          <Link
            href={`/app/review?deck=${deck.id}`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Review ({dueCount} due)
          </Link>
        )}
      </div>

      <DeckCards cards={cards || []} deckId={deck.id} />
    </div>
  )
}
