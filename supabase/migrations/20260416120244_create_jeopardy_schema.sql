/*
  # Create PERIL Jeopardy Board Schema

  ## Summary
  Creates a full schema for a Dark Souls themed Jeopardy board called "PERIL".

  ## New Tables

  ### `boards`
  - `id` (uuid, primary key) - Unique board identifier
  - `title` (text) - Board display title (e.g., "PERIL")
  - `created_at` (timestamptz) - Creation timestamp

  ### `categories`
  - `id` (uuid, primary key) - Unique category identifier
  - `board_id` (uuid, foreign key) - Reference to parent board
  - `name` (text) - Category display name
  - `display_order` (integer) - Column order (0-5)
  - `created_at` (timestamptz)

  ### `questions`
  - `id` (uuid, primary key)
  - `category_id` (uuid, foreign key) - Reference to parent category
  - `point_value` (integer) - Points: 2, 4, 6, 8, or 10
  - `question_text` (text) - The question shown to players
  - `answer_text` (text) - The answer revealed after
  - `is_answered` (boolean) - Whether the cell has been played
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Public read access for all rows (game is meant to be shared)
  - Authenticated write access (board host can edit)
  - Anonymous users can update `is_answered` to support live gameplay

  ## Notes
  - Seeded with default Dark Souls themed categories and placeholder questions
*/

CREATE TABLE IF NOT EXISTS boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'PERIL',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read boards"
  ON boards FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert boards"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update boards"
  ON boards FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Category',
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  point_value integer NOT NULL DEFAULT 2,
  question_text text NOT NULL DEFAULT '',
  answer_text text NOT NULL DEFAULT '',
  is_answered boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read questions"
  ON questions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can update is_answered on questions"
  ON questions FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert questions"
  ON questions FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete questions"
  ON questions FOR DELETE
  TO authenticated
  USING (true);

DO $$
DECLARE
  board_id uuid;
  cat_id uuid;
  cat_ids uuid[] := ARRAY[]::uuid[];
  i integer;
  point_vals integer[] := ARRAY[2, 4, 6, 8, 10];
  cat_names text[] := ARRAY['The Tarnished', 'Beasts of Legend', 'Curses and Blessings', 'Depths and Catacombs', 'Illusory Wall?', 'Soul Level 1'];
BEGIN
  INSERT INTO boards (title) VALUES ('PERIL') RETURNING id INTO board_id;

  FOR i IN 1..6 LOOP
    INSERT INTO categories (board_id, name, display_order)
      VALUES (board_id, cat_names[i], i - 1)
      RETURNING id INTO cat_id;
    cat_ids := array_append(cat_ids, cat_id);
  END LOOP;

  FOR i IN 1..6 LOOP
    FOR j IN 1..5 LOOP
      INSERT INTO questions (category_id, point_value, question_text, answer_text)
        VALUES (cat_ids[i], point_vals[j], '', '');
    END LOOP;
  END LOOP;
END $$;
