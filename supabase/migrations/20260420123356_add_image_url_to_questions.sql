/*
  # Add image_url to questions

  1. Changes
    - Adds `image_url` (text, nullable) column to the `questions` table
      to support optional image attachments for question cards.

  2. Notes
    - No existing data is affected; the column defaults to NULL.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'questions' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE questions ADD COLUMN image_url text;
  END IF;
END $$;
