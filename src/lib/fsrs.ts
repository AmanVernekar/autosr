import { createEmptyCard, fsrs, generatorParameters, Rating, type Card as FSRSCard, type RecordLog } from 'ts-fsrs'
import type { CardProgress } from './types'

const params = generatorParameters()
const f = fsrs(params)

export { Rating }

export function progressToFSRSCard(progress: CardProgress): FSRSCard {
  return {
    due: new Date(progress.due),
    stability: progress.stability,
    difficulty: progress.difficulty,
    elapsed_days: progress.elapsed_days,
    scheduled_days: progress.scheduled_days,
    reps: progress.reps,
    lapses: progress.lapses,
    state: stateToNumber(progress.state),
    last_review: progress.last_review ? new Date(progress.last_review) : undefined,
  } as FSRSCard
}

export function scheduleCard(progress: CardProgress, rating: 1 | 2 | 3 | 4) {
  const card = progress.reps === 0 && progress.state === 'new'
    ? createEmptyCard()
    : progressToFSRSCard(progress)

  const now = new Date()
  const result = f.repeat(card, now)
  const ratingKey = ratingToKey(rating)
  const scheduled = result[ratingKey]

  return {
    stability: scheduled.card.stability,
    difficulty: scheduled.card.difficulty,
    elapsed_days: scheduled.card.elapsed_days,
    scheduled_days: scheduled.card.scheduled_days,
    reps: scheduled.card.reps,
    lapses: scheduled.card.lapses,
    state: numberToState(scheduled.card.state),
    due: scheduled.card.due.toISOString(),
    last_review: now.toISOString(),
  }
}

function stateToNumber(state: string): number {
  switch (state) {
    case 'new': return 0
    case 'learning': return 1
    case 'review': return 2
    case 'relearning': return 3
    default: return 0
  }
}

function numberToState(num: number): 'new' | 'learning' | 'review' | 'relearning' {
  switch (num) {
    case 0: return 'new'
    case 1: return 'learning'
    case 2: return 'review'
    case 3: return 'relearning'
    default: return 'new'
  }
}

function ratingToKey(rating: 1 | 2 | 3 | 4): Rating {
  switch (rating) {
    case 1: return Rating.Again
    case 2: return Rating.Hard
    case 3: return Rating.Good
    case 4: return Rating.Easy
  }
}
