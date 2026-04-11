import { NextRequest, NextResponse } from 'next/server'
import pdf from 'pdf-parse'

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

    const buffer = Buffer.from(await file.arrayBuffer())
    const data = await pdf(buffer)

    return NextResponse.json({
      text: data.text,
      pages: data.numpages,
      filename: file.name,
    })
  } catch (error) {
    console.error('PDF extraction error:', error)
    return NextResponse.json({ error: 'Failed to extract text from PDF' }, { status: 500 })
  }
}
