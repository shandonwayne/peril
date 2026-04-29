/*
  # Add avatar_id to players table

  1. Changes
    - `players` table: add `avatar_id` column (smallint, default 0)
      - Values 0-5 map to the 6 selectable pixel avatars
      - Default 0 ensures existing players get the first avatar
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'players' AND column_name = 'avatar_id'
  ) THEN
    ALTER TABLE players ADD COLUMN avatar_id smallint NOT NULL DEFAULT 0;
  END IF;
END $$;
