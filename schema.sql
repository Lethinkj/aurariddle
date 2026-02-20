-- ============================================
-- HardWord - Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Events table
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code VARCHAR(6) UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed')),
  current_question_id UUID,
  current_question_index INT DEFAULT -1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table
CREATE TABLE questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  answer TEXT NOT NULL,
  question_order INT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add foreign key for current_question_id after questions table exists
ALTER TABLE events ADD CONSTRAINT fk_current_question
  FOREIGN KEY (current_question_id) REFERENCES questions(id) ON DELETE SET NULL;

-- Participants table
CREATE TABLE participants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  score INT DEFAULT 0,
  joined_at TIMESTAMPTZ DEFAULT NOW()
);

-- Answers table
CREATE TABLE answers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
  participant_id UUID REFERENCES participants(id) ON DELETE CASCADE NOT NULL,
  is_correct BOOLEAN DEFAULT FALSE,
  points_awarded INT DEFAULT 0,
  attempt_count INT DEFAULT 0,
  answered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(question_id, participant_id)
);

-- Migration for existing databases:
-- ALTER TABLE answers ADD COLUMN IF NOT EXISTS attempt_count INT DEFAULT 0;

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_questions_event_id ON questions(event_id);
CREATE INDEX idx_participants_event_id ON participants(event_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);
CREATE INDEX idx_answers_participant_id ON answers(participant_id);
CREATE INDEX idx_events_code ON events(code);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;

-- Events: anyone can read
CREATE POLICY "Events are viewable by everyone"
  ON events FOR SELECT USING (true);

-- Participants: anyone can read
CREATE POLICY "Participants are viewable by everyone"
  ON participants FOR SELECT USING (true);

-- Answers: anyone can read
CREATE POLICY "Answers are viewable by everyone"
  ON answers FOR SELECT USING (true);

-- Questions: anyone can read (answer is protected via API, not exposed directly)
CREATE POLICY "Questions are viewable by everyone"
  ON questions FOR SELECT USING (true);

-- Service role key bypasses RLS for all write operations

-- ============================================
-- REALTIME
-- ============================================

-- Enable realtime on events and participants tables
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE answers;

-- ============================================
-- HELPER FUNCTION: Get answer pattern without revealing answer
-- ============================================

CREATE OR REPLACE FUNCTION get_answer_pattern(answer_text TEXT)
RETURNS INT[] AS $$
BEGIN
  RETURN ARRAY(
    SELECT LENGTH(word)
    FROM unnest(string_to_array(answer_text, ' ')) AS word
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
