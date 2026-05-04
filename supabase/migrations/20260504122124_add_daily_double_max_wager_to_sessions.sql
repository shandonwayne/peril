/*
  # Add daily_double_max_wager to game_sessions

  Stores the maximum allowed wager for the current daily double question
  (2x the question's point value) so the player's device can enforce the cap.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'game_sessions' AND column_name = 'daily_double_max_wager'
  ) THEN
    ALTER TABLE game_sessions ADD COLUMN daily_double_max_wager integer DEFAULT NULL;
  END IF;
END $$;
