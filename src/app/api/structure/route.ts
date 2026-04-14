import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 })
    }

    // For structure extraction, send the first and last chunks plus sampled sections
    // This covers the TOC, intro, and later chapters without hitting token limits
    const totalLen = text.length
    const chunkSize = 50000
    let sampledText: string

    if (totalLen <= chunkSize * 2) {
      sampledText = text
    } else {
      const first = text.slice(0, chunkSize)
      const mid = text.slice(Math.floor(totalLen / 2) - chunkSize / 4, Math.floor(totalLen / 2) + chunkSize / 4)
      const last = text.slice(-chunkSize / 2)
      sampledText = first + '\n\n[... middle section ...]\n\n' + mid + '\n\n[... later section ...]\n\n' + last
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are extracting the COMPLETE structure from a document to help plan flashcard generation. The document may be sampled (beginning, middle, end) — infer ALL chapters/sections even if some text is omitted.

Document text (${totalLen} characters total):
${sampledText}

Return ONLY valid JSON (no markdown fences, no explanation) with this shape:
{
  "title": "inferred document title",
  "sections": [
    { "heading": "section or chapter heading", "summary": "one sentence summary" }
  ],
  "key_concepts": ["concept1", "concept2"]
}

IMPORTANT: Include ALL chapters and major sections of the document, not just the ones visible in the sample.`,
        },
      ],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'Unexpected response' }, { status: 500 })
    }

    let responseText = content.text.trim()
    if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    }

    const structure = JSON.parse(responseText)
    return NextResponse.json(structure)
  } catch (error) {
    console.error('Structure extraction error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    if (message.includes('rate_limit')) {
      return NextResponse.json({ error: 'Rate limited by Anthropic API. Please wait a minute and try again.' }, { status: 429 })
    }
    return NextResponse.json({ error: `Structure extraction failed: ${message}` }, { status: 500 })
  }
}
