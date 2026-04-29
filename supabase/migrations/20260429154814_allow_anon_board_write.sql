/*
  # Allow anonymous users to create and update boards

  The app has no authentication — the host operates as an anonymous user.
  The existing INSERT/UPDATE policies restrict to `authenticated` only, which
  blocks board creation. This migration replaces those policies to also permit
  the `anon` role.

  1. Changes
    - Drop existing insert/update policies on `boards`
    - Re-create them allowing both `anon` and `authenticated` roles
*/

DROP POLICY IF EXISTS "Authenticated users can insert boards" ON boards;
DROP POLICY IF EXISTS "Authenticated users can update boards" ON boards;

CREATE POLICY "Anyone can insert boards"
  ON boards FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update boards"
  ON boards FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
