import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const CARDS_PER_BATCH = 40

function buildPrompt(
  text: string,
  depth: string,
  selectedSections: string[] | null,
  skipText: string,
  cardTypes: string[] | null,
  batchSize: number,
  freetextPrompt: string,
  batchInfo: string,
) {
  return `You are an expert at creating spaced repetition flashcards. You understand the minimum information principle: each card tests exactly ONE atomic fact, concept, or connection.

DOCUMENT:
${text}

INSTRUCTIONS:
- Depth: ${depth || 'intermediate'}
- Focus on these sections: ${selectedSections?.join(', ') || 'all sections'}
- Skip: ${skipText || 'nothing'}
- Card types: ${cardTypes?.join(' and ') || 'qa and cloze'}
- Generate exactly ${batchSize} cards
- Additional instructions: ${freetextPrompt || 'none'}${batchInfo}

ATOMICITY RULES (critical):
- ONE fact per card. If you catch yourself writing "and" or listing multiple things on the back, STOP and split into separate cards.
- A card about a process? Make one card PER STEP, not one card for the whole process.
- A card about causes/reasons? Make one card PER CAUSE, not one card listing all causes.
- Exception: if items form a tightly linked set (e.g. 3 domains of life), one card listing them is OK — but the back should be SHORT (under 15 words).
- The front should be specific enough that there is exactly one correct answer.
- The back of a Q&A card should be 1-2 sentences MAX.

CARD FORMAT:
- Q&A: { "type": "qa", "front": "question", "back": "concise answer (1-2 sentences)" }
- Cloze: { "type": "cloze", "front": "sentence with {{term}} blanked", "back": "same sentence with term visible" }
- Cloze: blank exactly ONE term per card.

QUESTION QUALITY:
- Ask "why" and "how" questions, not just "what is"
- Use context to make questions unambiguous
- Avoid yes/no questions
- For definitions, prefer cloze
- For relationships, prefer Q&A

OTHER:
- Tags: 2-4 lowercase tags per card
- image_hint: short description if a source figure is relevant, otherwise null

Return ONLY a valid JSON array. No markdown fences, no preamble, no explanation.`
}

function parseCards(text: string): unknown[] {
  let responseText = text.trim()
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
  }

  try {
    return JSON.parse(responseText)
  } catch {
    // Salvage truncated JSON
    const lastCloseBrace = responseText.lastIndexOf('}')
    if (lastCloseBrace > 0) {
      try {
        return JSON.parse(responseText.slice(0, lastCloseBrace + 1) + ']')
      } catch {
        // ignore
      }
    }
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      text,
      depth,
      selected_sections,
      skip_text,
      card_types,
      target_count,
      freetext_prompt,
    } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    const truncated = text.slice(0, 100000)
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const totalTarget = target_count || 30
    const numBatches = Math.ceil(totalTarget / CARDS_PER_BATCH)

    // Split document into chunks for each batch so they cover different sections
    const chunkSize = Math.floor(truncated.length / numBatches)
    const allCards: unknown[] = []
    const failedBatches: number[] = []

    // Run batches sequentially to respect rate limits
    // Use request signal to abort if client disconnects
    const signal = request.signal

    for (let batch = 0; batch < numBatches; batch++) {
      if (signal.aborted) {
        console.log(`Generation aborted by client after batch ${batch}`)
        break
      }

      const batchSize = batch < numBatches - 1
        ? CARDS_PER_BATCH
        : totalTarget - (CARDS_PER_BATCH * (numBatches - 1))

      let docChunk: string
      let batchInfo: string
      if (numBatches === 1) {
        docChunk = truncated
        batchInfo = ''
      } else {
        const start = batch * chunkSize
        const end = batch === numBatches - 1 ? truncated.length : (batch + 1) * chunkSize
        docChunk = truncated.slice(start, end)
        batchInfo = `\nFOCUS: This is section ${batch + 1} of ${numBatches} of the document. Generate cards ONLY from the text provided above.`
      }

      console.log(`Batch ${batch + 1}/${numBatches}: ${batchSize} cards, ${docChunk.length} chars`)

      try {
        const message = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 8192,
          messages: [
            {
              role: 'user',
              content: buildPrompt(
                docChunk, depth, selected_sections, skip_text,
                card_types, batchSize, freetext_prompt, batchInfo,
              ),
            },
          ],
        })

        const content = message.content[0]
        if (content.type === 'text') {
          allCards.push(...parseCards(content.text))
        }
      } catch (batchError) {
        const msg = batchError instanceof Error ? batchError.message : 'Unknown error'
        console.error(`Batch ${batch + 1} failed: ${msg}`)
        failedBatches.push(batch + 1)

        // If it's a rate limit, stop trying more batches
        if (msg.includes('rate_limit')) break
      }
    }

    if (allCards.length === 0) {
      return NextResponse.json({ error: 'All batches failed. Please try again.' }, { status: 500 })
    }

    const warning = failedBatches.length > 0
      ? `Generated ${allCards.length} cards, but batch(es) ${failedBatches.join(', ')} of ${numBatches} failed. Some sections may be missing.`
      : undefined

    return NextResponse.json({ cards: allCards, warning })
  } catch (error) {
    console.error('Card generation error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('abort') || message.includes('cancel')) {
      return NextResponse.json({ error: 'Generation was cancelled.' }, { status: 499 })
    }
    return NextResponse.json({ error: `Card generation failed: ${message}` }, { status: 500 })
  }
}
