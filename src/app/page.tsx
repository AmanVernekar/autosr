import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <span className="text-xl font-bold text-white">AutoSR</span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm text-zinc-300 hover:text-white transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/signup"
            className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Learn anything with
            <br />
            <span className="text-indigo-400">AI-generated flashcards</span>
          </h1>
          <p className="text-lg text-zinc-400 mb-8 max-w-xl mx-auto">
            Upload a PDF, paste text, or drop a link. AutoSR extracts the key concepts and generates
            spaced repetition flashcards using Claude AI and the FSRS-4.5 algorithm.
          </p>
          <Link
            href="/signup"
            className="inline-block px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg text-lg transition-colors"
          >
            Start learning
          </Link>
        </div>
      </main>
    </div>
  )
}
