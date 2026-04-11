'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { DocumentStructure, GeneratedCard, CoverageInstructions } from '@/lib/types'

type Step = 'upload' | 'coverage' | 'generating' | 'review'

export default function NewDeckPage() {
  const router = useRouter()
  const supabase = createClient()

  const [step, setStep] = useState<Step>('upload')
  const [sourceType, setSourceType] = useState<'text' | 'pdf'>('text')
  const [rawText, setRawText] = useState('')
  const [filename, setFilename] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Coverage instructions state
  const [structure, setStructure] = useState<DocumentStructure | null>(null)
  const [depth, setDepth] = useState<'introductory' | 'intermediate' | 'expert'>('intermediate')
  const [cardTypes, setCardTypes] = useState<('qa' | 'cloze')[]>(['qa', 'cloze'])
  const [cardCountMode, setCardCountMode] = useState<'ai_decides' | 'manual'>('ai_decides')
  const [cardCountTarget, setCardCountTarget] = useState(30)
  const [focusSections, setFocusSections] = useState<string[]>([])
  const [skipSections, setSkipSections] = useState('')
  const [freetextPrompt, setFreetextPrompt] = useState('')

  // Generated cards state
  const [, setGeneratedCards] = useState<GeneratedCard[]>([])
  const [editingCards, setEditingCards] = useState<GeneratedCard[]>([])
  const [saving, setSaving] = useState(false)

  // Step 1: Upload / paste content
  async function handleUpload() {
    setError(null)
    setLoading(true)

    try {
      let text = rawText

      if (sourceType === 'pdf') {
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement
        const file = fileInput?.files?.[0]
        if (!file) {
          setError('Please select a PDF file')
          setLoading(false)
          return
        }

        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch('/api/ingest/pdf', { method: 'POST', body: formData })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'Failed to extract PDF')
          setLoading(false)
          return
        }

        text = data.text
        setFilename(data.filename)
      }

      if (!text.trim()) {
        setError('No text content found')
        setLoading(false)
        return
      }

      setRawText(text)

      // Extract structure via Haiku
      const structRes = await fetch('/api/structure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })

      const structData = await structRes.json()

      if (!structRes.ok) {
        setError(structData.error || 'Failed to extract structure')
        setLoading(false)
        return
      }

      setStructure(structData)
      // Default: all sections selected
      setFocusSections(structData.sections.map((s: { heading: string }) => s.heading))
      setStep('coverage')
    } catch (err) {
      setError('Something went wrong')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: Generate cards
  async function handleGenerate() {
    setError(null)
    setStep('generating')

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: rawText,
          depth,
          selected_sections: focusSections,
          skip_text: skipSections,
          card_types: cardTypes,
          target_count: cardCountMode === 'manual' ? cardCountTarget : null,
          freetext_prompt: freetextPrompt,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to generate cards')
        setStep('coverage')
        return
      }

      setGeneratedCards(data.cards)
      setEditingCards(data.cards.map((c: GeneratedCard) => ({ ...c })))
      setStep('review')
    } catch (err) {
      setError('Failed to generate cards')
      setStep('coverage')
      console.error(err)
    }
  }

  // Step 3: Save cards
  async function handleSave() {
    setError(null)
    setSaving(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = structure?.title || filename || 'Untitled Deck'
      const coverageInstructions: CoverageInstructions = {
        depth,
        card_types: cardTypes,
        card_count_mode: cardCountMode,
        card_count_target: cardCountMode === 'manual' ? cardCountTarget : undefined,
        focus_sections: focusSections,
        skip_sections: skipSections,
        freetext_prompt: freetextPrompt,
      }

      // Create deck
      const { data: deck, error: deckError } = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          title,
          source_type: sourceType,
          source_filename: filename,
          coverage_instructions: coverageInstructions,
          card_count: editingCards.length,
        })
        .select()
        .single()

      if (deckError) throw deckError

      // Insert cards
      const cardsToInsert = editingCards.map((card, index) => ({
        deck_id: deck.id,
        card_type: card.type,
        front: card.front,
        back: card.back,
        tags: card.tags,
        position: index,
      }))

      const { error: cardsError } = await supabase.from('cards').insert(cardsToInsert)
      if (cardsError) throw cardsError

      // Create card_progress rows for each card
      const { data: insertedCards } = await supabase
        .from('cards')
        .select('id')
        .eq('deck_id', deck.id)

      if (insertedCards) {
        const progressRows = insertedCards.map((card) => ({
          user_id: user.id,
          card_id: card.id,
        }))
        await supabase.from('card_progress').insert(progressRows)
      }

      router.push(`/app/decks/${deck.id}`)
    } catch (err) {
      setError('Failed to save deck')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  function updateCard(index: number, field: 'front' | 'back', value: string) {
    setEditingCards((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }

  function deleteCard(index: number) {
    setEditingCards((prev) => prev.filter((_, i) => i !== index))
  }

  function addBlankCard() {
    setEditingCards((prev) => [
      ...prev,
      { type: 'qa', front: '', back: '', tags: [], image_hint: null },
    ])
  }

  function toggleCardType(type: 'qa' | 'cloze') {
    setCardTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  function toggleFocusSection(heading: string) {
    setFocusSections((prev) =>
      prev.includes(heading) ? prev.filter((s) => s !== heading) : [...prev, heading]
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">
        {step === 'upload' && 'Create New Deck'}
        {step === 'coverage' && 'Coverage Instructions'}
        {step === 'generating' && 'Generating Cards...'}
        {step === 'review' && 'Review Cards'}
      </h1>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <div className="space-y-6">
          <div className="flex gap-3">
            <button
              onClick={() => setSourceType('text')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sourceType === 'text'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Paste Text
            </button>
            <button
              onClick={() => setSourceType('pdf')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                sourceType === 'pdf'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              Upload PDF
            </button>
          </div>

          {sourceType === 'text' ? (
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={12}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              placeholder="Paste your learning material here..."
            />
          ) : (
            <div className="border-2 border-dashed border-zinc-700 rounded-lg p-8 text-center">
              <input
                id="pdf-upload"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) setFilename(file.name)
                }}
              />
              <label
                htmlFor="pdf-upload"
                className="cursor-pointer text-zinc-400 hover:text-white transition-colors"
              >
                {filename ? (
                  <span className="text-indigo-400">{filename}</span>
                ) : (
                  <>
                    <span className="block text-lg mb-1">Click to upload a PDF</span>
                    <span className="text-sm text-zinc-500">or drag and drop</span>
                  </>
                )}
              </label>
            </div>
          )}

          <button
            onClick={handleUpload}
            disabled={loading || (sourceType === 'text' && !rawText.trim())}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
          >
            {loading ? 'Extracting...' : 'Continue'}
          </button>
        </div>
      )}

      {/* Step 2: Coverage Instructions */}
      {step === 'coverage' && structure && (
        <div className="space-y-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">Detected title</h3>
            <p className="text-white">{structure.title}</p>
          </div>

          {/* Depth */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Depth</label>
            <div className="flex gap-3">
              {(['introductory', 'intermediate', 'expert'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDepth(d)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                    depth === d
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          {/* Card types */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Card Types</label>
            <div className="flex gap-3">
              {(['qa', 'cloze'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => toggleCardType(type)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    cardTypes.includes(type)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {type === 'qa' ? 'Q&A' : 'Cloze'}
                </button>
              ))}
            </div>
          </div>

          {/* Card count */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">Card Count</label>
            <div className="flex items-center gap-3 mb-2">
              <button
                onClick={() => setCardCountMode('ai_decides')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cardCountMode === 'ai_decides'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                AI decides
              </button>
              <button
                onClick={() => setCardCountMode('manual')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  cardCountMode === 'manual'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white'
                }`}
              >
                I want ~N cards
              </button>
            </div>
            {cardCountMode === 'manual' && (
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={10}
                  max={150}
                  step={5}
                  value={cardCountTarget}
                  onChange={(e) => setCardCountTarget(parseInt(e.target.value))}
                  className="flex-1 accent-indigo-500"
                />
                <span className="text-white text-sm w-12 text-right">{cardCountTarget}</span>
              </div>
            )}
          </div>

          {/* Focus areas */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Focus Areas ({focusSections.length}/{structure.sections.length} selected)
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {structure.sections.map((section) => (
                <label
                  key={section.heading}
                  className="flex items-start gap-2 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={focusSections.includes(section.heading)}
                    onChange={() => toggleFocusSection(section.heading)}
                    className="mt-1 accent-indigo-500"
                  />
                  <div>
                    <span className="text-sm text-white group-hover:text-indigo-300">
                      {section.heading}
                    </span>
                    <p className="text-xs text-zinc-500">{section.summary}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Skip sections */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">Skip Sections</label>
            <input
              type="text"
              value={skipSections}
              onChange={(e) => setSkipSections(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g. skip acknowledgements, skip historical background"
            />
          </div>

          {/* Freetext prompt */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1">
              Additional Instructions
            </label>
            <textarea
              value={freetextPrompt}
              onChange={(e) => setFreetextPrompt(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-y"
              placeholder="e.g. Focus on mechanisms and first principles. Flag counterintuitive results. Prioritise anything that would trip up an expert."
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('upload')}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              Back
            </button>
            <button
              onClick={handleGenerate}
              disabled={cardTypes.length === 0 || focusSections.length === 0}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              Generate Cards
            </button>
          </div>
        </div>
      )}

      {/* Generating state */}
      {step === 'generating' && (
        <div className="text-center py-16">
          <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-zinc-400">Generating flashcards with Claude...</p>
          <p className="text-sm text-zinc-600 mt-1">This may take 15–30 seconds</p>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 'review' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-zinc-400">
              {editingCards.length} card{editingCards.length !== 1 ? 's' : ''} generated
            </p>
            <button
              onClick={addBlankCard}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              + Add card
            </button>
          </div>

          {editingCards.map((card, index) => (
            <div
              key={index}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500 uppercase tracking-wide">
                  {card.type === 'qa' ? 'Q&A' : 'Cloze'} #{index + 1}
                </span>
                <button
                  onClick={() => deleteCard(index)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Front</label>
                <textarea
                  value={card.front}
                  onChange={(e) => updateCard(index, 'front', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>

              <div>
                <label className="block text-xs text-zinc-500 mb-1">Back</label>
                <textarea
                  value={card.back}
                  onChange={(e) => updateCard(index, 'back', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-y"
                />
              </div>

              {card.tags.length > 0 && (
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
          ))}

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setStep('coverage')
                setEditingCards([])
              }}
              className="px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              Re-generate
            </button>
            <button
              onClick={handleSave}
              disabled={saving || editingCards.length === 0}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : `Confirm & Save (${editingCards.length} cards)`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
