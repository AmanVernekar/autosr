export interface Deck {
  id: string
  user_id: string
  title: string
  description: string | null
  source_type: 'pdf' | 'url' | 'youtube' | 'text' | 'epub'
  source_url: string | null
  source_filename: string | null
  source_file_path: string | null
  coverage_instructions: CoverageInstructions | null
  card_count: number
  is_public: boolean
  share_slug: string | null
  created_at: string
  updated_at: string
}

export interface Card {
  id: string
  deck_id: string
  card_type: 'qa' | 'cloze'
  front: string
  back: string
  image_url: string | null
  tags: string[]
  position: number | null
  created_at: string
}

export interface DeckFigure {
  id: string
  deck_id: string
  figure_url: string
  page_number: number | null
  figure_index: number | null
  assigned_card_id: string | null
  created_at: string
}

export interface CardProgress {
  id: string
  user_id: string
  card_id: string
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: 'new' | 'learning' | 'review' | 'relearning'
  due: string
  last_review: string | null
}

export interface ReviewLog {
  id: string
  user_id: string
  card_id: string
  deck_id: string
  rating: 1 | 2 | 3 | 4
  reviewed_at: string
  time_taken_ms: number | null
  scheduled_days: number | null
  actual_days: number | null
}

export interface CoverageInstructions {
  depth: 'introductory' | 'intermediate' | 'expert'
  card_types: ('qa' | 'cloze')[]
  card_count_mode: 'ai_decides' | 'manual'
  card_count_target?: number
  focus_sections: string[]
  skip_sections: string
  freetext_prompt: string
}

export interface DocumentStructure {
  title: string
  sections: { heading: string; summary: string }[]
  key_concepts: string[]
}

export interface GeneratedCard {
  type: 'qa' | 'cloze'
  front: string
  back: string
  tags: string[]
  image_hint: string | null
}
