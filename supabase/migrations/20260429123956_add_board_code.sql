/*
  # Add board_code to boards

  1. Changes
    - `boards` gets a new `board_code` column (text, unique) — a short uppercase code
      that the host can use to reload the same board later across sessions.
    - Existing board gets a code derived from its id so it is not null.

  2. Notes
    - The code is generated application-side (same alphabet as join codes).
    - A unique constraint is added so two boards can't share a code.
*/

ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS board_code text UNIQUE;

-- Back-fill existing boards with a code based on the first 8 chars of their id
UPDATE boards
SET board_code = upper(substring(replace(id::text, '-', ''), 1, 8))
WHERE board_code IS NULL;

-- Now make it NOT NULL
ALTER TABLE boards
  ALTER COLUMN board_code SET NOT NULL;
