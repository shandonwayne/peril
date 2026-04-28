/*
  # Add Buzzer System

  ## Summary
  Adds real-time buzzer functionality to the Jeopardy game.

  ## Changes

  ### Modified Tables
  - `game_sessions`: Add `buzzer_open` (boolean) and `buzzer_question_id` (text) columns
    - `buzzer_open`: Whether the buzzer is currently accepting buzz-ins
    - `buzzer_question_id`: Which question the current buzzer round is for

  ### New Tables
  - `buzzer_events`: Records each player's buzz-in for ordering by server timestamp
    - `id`: UUID primary key
    - `session_id`: Foreign key to game_sessions
    - `player_id`: Foreign key to players
    - `question_id`: Which question was being buzzed on
    - `buzzed_at`: Microsecond-precision server timestamp for ordering
    - `status`: 'pending' | 'correct' | 'incorrect'

  ## Security
  - RLS enabled on buzzer_events
  - Anon users can insert (players buzzing in) and read (host seeing buzz order)
  - Authenticated and anon can update status (host adjudicating)
*/

-- Add buzzer columns to game_sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'buzzer_open'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN buzzer_open boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'buzzer_question_id'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN buzzer_question_id text DEFAULT NULL;
  END IF;
END $$;

-- Create buzzer_events table
CREATE TABLE IF NOT EXISTS buzzer_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  question_id text NOT NULL,
  buzzed_at timestamptz DEFAULT now(),
  status text DEFAULT 'pending'
);

ALTER TABLE buzzer_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert buzzer events"
  ON buzzer_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can read buzzer events"
  ON buzzer_events FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update buzzer event status"
  ON buzzer_events FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- Index for fast ordering by session + question + time
CREATE INDEX IF NOT EXISTS buzzer_events_session_question_idx
  ON buzzer_events(session_id, question_id, buzzed_at ASC);

-- Enable realtime for buzzer_events and game_sessions updates
ALTER PUBLICATION supabase_realtime ADD TABLE buzzer_events;
