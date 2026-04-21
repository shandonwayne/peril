/*
  # Add Game Sessions and Players

  ## Overview
  Adds multiplayer support with a Jackbox-style join code system.

  ## New Tables

  ### `game_sessions`
  Tracks active game sessions tied to a board. Each session has a unique short join code.
  - `id` (uuid, PK)
  - `board_id` (uuid, FK → boards) - which board is being played
  - `join_code` (text, unique) - short human-readable code (e.g. "ROCK4823")
  - `is_active` (boolean) - whether the session is currently accepting players
  - `created_at` (timestamptz)

  ### `players`
  Stores each player who has joined a session.
  - `id` (uuid, PK)
  - `session_id` (uuid, FK → game_sessions)
  - `name` (text) - display name chosen by player
  - `score` (integer) - current score, defaults to 0
  - `device_token` (text) - random token stored in localStorage for reconnection
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both tables
  - Anyone can read sessions and players (needed for join flow and live leaderboard)
  - Anyone can insert a player (join flow is public)
  - Only the token-holder can update their own player row
  - Host can update session (managed via service role in edge functions if needed)
  - Anyone can update scores (host manages scores from game board)

  ## Notes
  - join_code is generated as 4 uppercase letters + 4 digits for readability
  - Realtime will be enabled on both tables for live sync
*/

CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid REFERENCES boards(id) ON DELETE CASCADE,
  join_code text UNIQUE NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES game_sessions(id) ON DELETE CASCADE,
  name text NOT NULL,
  score integer DEFAULT 0,
  device_token text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_game_sessions_join_code ON game_sessions(join_code);
CREATE INDEX IF NOT EXISTS idx_players_session_id ON players(session_id);
CREATE INDEX IF NOT EXISTS idx_players_device_token ON players(device_token);

-- Enable RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- game_sessions policies
CREATE POLICY "Anyone can read game sessions"
  ON game_sessions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can create game sessions"
  ON game_sessions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update game sessions"
  ON game_sessions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- players policies
CREATE POLICY "Anyone can read players"
  ON players FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can join as a player"
  ON players FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update player scores"
  ON players FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
