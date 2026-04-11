import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic()

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // Truncate to ~100k chars to stay within context limits
    const truncated = text.slice(0, 100000)

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: `You are extracting structure from a document to help plan flashcard generation.

Document text:
${truncated}

Return ONLY valid JSON with this shape:
{
  "title": "inferred document title",
  "sections": [
    { "heading": "section heading", "summary": "one sentence summary" }
  ],
  "key_concepts": ["concept1", "concept2"]
}`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    const structure = JSON.parse(content.text)
    return NextResponse.json(structure)
  } catch (error) {
    console.error('Structure extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract structure' }, { status: 500 })
  }
}
