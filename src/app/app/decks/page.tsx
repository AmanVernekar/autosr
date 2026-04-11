import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import type { Deck } from '@/lib/types'

export default async function DecksPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: decks } = await supabase
    .from('decks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false }) as { data: Deck[] | null }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Decks</h1>
        <Link
          href="/app/decks/new"
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          New Deck
        </Link>
      </div>

      {!decks || decks.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
          <p className="text-zinc-400 mb-4">No decks yet. Upload a resource to get started.</p>
          <Link
            href="/app/decks/new"
            className="text-indigo-400 hover:text-indigo-300"
          >
            Create your first deck
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
              {deck.description && (
                <p className="text-sm text-zinc-500 mb-2 line-clamp-2">{deck.description}</p>
              )}
              <p className="text-sm text-zinc-400">
                {deck.card_count} card{deck.card_count !== 1 ? 's' : ''} &middot;{' '}
                {deck.source_type.toUpperCase()}
              </p>
              <p className="text-xs text-zinc-600 mt-2">
                {new Date(deck.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
