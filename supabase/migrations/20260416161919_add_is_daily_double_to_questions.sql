/*
  # Add is_daily_double to questions

  1. Modified Tables
    - `questions`
      - `is_daily_double` (boolean, default false) — flags a question as a Daily Double
        so the game can show the special animation before revealing the question.

  2. Notes
    - Safe non-destructive column addition with IF NOT EXISTS guard.
    - Default false so all existing questions are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'is_daily_double'
  ) THEN
    ALTER TABLE questions ADD COLUMN is_daily_double boolean NOT NULL DEFAULT false;
  END IF;
END $$;
