/*
  # Allow anonymous users to write categories and questions

  The app has no authentication — the host operates as the anon role.
  INSERT/UPDATE/DELETE policies on categories and questions were restricted
  to `authenticated` only. This migration opens them to `anon` as well.

  1. Changes
    - categories: drop and re-create INSERT, UPDATE, DELETE policies
    - questions: drop and re-create INSERT, DELETE policies
*/

-- categories
DROP POLICY IF EXISTS "Authenticated users can insert categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can update categories" ON categories;
DROP POLICY IF EXISTS "Authenticated users can delete categories" ON categories;

CREATE POLICY "Anyone can insert categories"
  ON categories FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update categories"
  ON categories FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete categories"
  ON categories FOR DELETE
  TO anon, authenticated
  USING (true);

-- questions
DROP POLICY IF EXISTS "Authenticated users can insert questions" ON questions;
DROP POLICY IF EXISTS "Authenticated users can delete questions" ON questions;

CREATE POLICY "Anyone can insert questions"
  ON questions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete questions"
  ON questions FOR DELETE
  TO anon, authenticated
  USING (true);
