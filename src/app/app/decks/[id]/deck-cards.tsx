'use client'

import { useState } from 'react'
import type { Card } from '@/lib/types'

export default function DeckCards({ cards, deckId }: { cards: Card[]; deckId: string }) {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-white">
        Cards ({cards.length})
      </h2>

      {cards.length === 0 ? (
        <p className="text-zinc-500">No cards in this deck.</p>
      ) : (
        cards.map((card) => (
          <div
            key={card.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
          >
            <button
              onClick={() =>
                setExpandedCard(expandedCard === card.id ? null : card.id)
              }
              className="w-full px-4 py-3 text-left flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <span className="text-xs text-zinc-500 uppercase tracking-wide mr-2">
                  {card.card_type === 'qa' ? 'Q&A' : 'Cloze'}
                </span>
                <span className="text-sm text-white truncate">{card.front}</span>
              </div>
              <svg
                className={`w-4 h-4 text-zinc-500 transition-transform ${
                  expandedCard === card.id ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {expandedCard === card.id && (
              <div className="px-4 pb-4 border-t border-zinc-800 pt-3">
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-1">Front</p>
                  <p className="text-sm text-white">{card.front}</p>
                </div>
                <div className="mb-3">
                  <p className="text-xs text-zinc-500 mb-1">Back</p>
                  <p className="text-sm text-zinc-300">{card.back}</p>
                </div>
                {card.tags && card.tags.length > 0 && (
                  <div className="flex gap-1.5 flex-wrap">
                    {card.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded text-xs"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
