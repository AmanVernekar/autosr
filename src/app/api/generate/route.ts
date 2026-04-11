import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `You are an expert at creating spaced repetition flashcards for serious learners.

DOCUMENT:
${truncated}

INSTRUCTIONS:
- Depth: ${depth || 'intermediate'}
- Focus on these sections: ${selected_sections?.join(', ') || 'all sections'}
- Skip: ${skip_text || 'nothing'}
- Card types: ${card_types?.join(' and ') || 'qa and cloze'}
- Target card count: ${target_count || 'use your judgement'}
- Additional instructions: ${freetext_prompt || 'none'}

CARD FORMAT RULES:
- Q&A: { "type": "qa", "front": "question", "back": "answer" }
- Cloze: { "type": "cloze", "front": "sentence with {{term}} blanked", "back": "full sentence revealed" }
- Cloze: blank ONE concept per card. Never blank multiple things in one card.
- Cards must be atomic: one concept per card only
- Avoid yes/no questions
- Prefer "how" and "why" over "what" and "when"
- Back of Q&A should be complete but concise (2–4 sentences max)
- Tags: 2–4 lowercase tags per card drawn from the document's concepts
- image_hint: if a figure or diagram in the source document is directly relevant to this card, write a short description like "figure 3" or "diagram showing X". Otherwise null.

Return ONLY a valid JSON array. No preamble, no explanation, no markdown fences.

[
  {
    "type": "qa" | "cloze",
    "front": "...",
    "back": "...",
    "tags": ["tag1", "tag2"],
    "image_hint": "figure 3 showing heat pump cycle" | null
  }
]`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    // Try to parse the response, handling potential markdown fences
    let responseText = content.text.trim()
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const cards = JSON.parse(responseText)
    return NextResponse.json({ cards })
  } catch (error) {
    console.error('Card generation error:', error)
    return NextResponse.json({ error: 'Failed to generate cards' }, { status: 500 })
  }
}
