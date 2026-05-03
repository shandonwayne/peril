/*
  # Add Daily Double wager fields to game_sessions

  ## Summary
  Adds two columns to support the daily double wager flow:

  1. Modified Tables
     - `game_sessions`
       - `daily_double_player_id` (uuid, nullable) — the player whose turn it is to wager
       - `daily_double_wager` (integer, nullable) — the amount the player wagered; null until submitted

  ## Notes
  - These columns are reset to null when a new question is opened or the session resets
  - The host reads these to know the wager amount when judging correct/incorrect
  - Players watch for their own id appearing in daily_double_player_id to show the wager UI
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'daily_double_player_id'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN daily_double_player_id uuid REFERENCES players(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'daily_double_wager'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN daily_double_wager integer DEFAULT NULL;
  END IF;
END $$;
