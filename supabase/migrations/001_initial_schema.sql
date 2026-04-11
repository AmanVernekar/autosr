-- AutoSR Phase 1 Schema
-- Run this in your Supabase SQL Editor

-- Decks
CREATE TABLE decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf','url','youtube','text','epub')),
  source_url TEXT,
  source_filename TEXT,
  source_file_path TEXT,
  coverage_instructions JSONB,
  card_count INT DEFAULT 0,
  is_public BOOLEAN DEFAULT FALSE,
  share_slug TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('qa', 'cloze')),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  image_url TEXT,
  tags TEXT[],
  position INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted figures (for PDF processing)
CREATE TABLE deck_figures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  figure_url TEXT NOT NULL,
  page_number INT,
  figure_index INT,
  assigned_card_id UUID REFERENCES cards(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- SR State (one row per user per card)
CREATE TABLE card_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  stability FLOAT DEFAULT 0,
  difficulty FLOAT DEFAULT 0,
  elapsed_days INT DEFAULT 0,
  scheduled_days INT DEFAULT 0,
  reps INT DEFAULT 0,
  lapses INT DEFAULT 0,
  state TEXT DEFAULT 'new' CHECK (state IN ('new','learning','review','relearning')),
  due TIMESTAMPTZ DEFAULT now(),
  last_review TIMESTAMPTZ,
  UNIQUE(user_id, card_id)
);

-- Review log
CREATE TABLE review_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  deck_id UUID REFERENCES decks(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating IN (1,2,3,4)),
  reviewed_at TIMESTAMPTZ DEFAULT now(),
  time_taken_ms INT,
  scheduled_days INT,
  actual_days INT
);

-- Indexes
CREATE INDEX idx_card_progress_due ON card_progress(user_id, due);
CREATE INDEX idx_cards_deck ON cards(deck_id);
CREATE INDEX idx_review_logs_user ON review_logs(user_id, reviewed_at);

-- Row Level Security
ALTER TABLE decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE deck_figures ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_logs ENABLE ROW LEVEL SECURITY;

-- Decks: users can CRUD their own, read public decks
CREATE POLICY "Users can manage own decks" ON decks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read public decks" ON decks
  FOR SELECT USING (is_public = true);

-- Cards: users can CRUD cards in their decks, read cards in public decks
CREATE POLICY "Users can manage cards in own decks" ON cards
  FOR ALL USING (
    deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())
  );

CREATE POLICY "Anyone can read cards in public decks" ON cards
  FOR SELECT USING (
    deck_id IN (SELECT id FROM decks WHERE is_public = true)
  );

-- Deck figures: users can manage figures in their decks
CREATE POLICY "Users can manage figures in own decks" ON deck_figures
  FOR ALL USING (
    deck_id IN (SELECT id FROM decks WHERE user_id = auth.uid())
  );

-- Card progress: users can only access their own progress
CREATE POLICY "Users can manage own progress" ON card_progress
  FOR ALL USING (auth.uid() = user_id);

-- Review logs: users can only access their own logs
CREATE POLICY "Users can manage own review logs" ON review_logs
  FOR ALL USING (auth.uid() = user_id);
