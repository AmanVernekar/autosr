import { NextRequest, NextResponse } from 'next/server'
import { extractText } from 'unpdf'

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const data = new Uint8Array(buffer)

    const result = await extractText(data)
    const text = result.text.join('\n\n')

    return NextResponse.json({
      text,
      pages: result.totalPages,
      filename: file.name,
    })
  } catch (error) {
    console.error('PDF extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 })
  }
}
