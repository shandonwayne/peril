/*
  # Allow anonymous users to delete players

  The host operates as the anon role. No DELETE policy existed on the players
  table, so host-initiated player removal was silently blocked by RLS.

  1. Changes
    - Add DELETE policy on players for anon and authenticated roles
*/

CREATE POLICY "Anyone can delete players"
  ON players FOR DELETE
  TO anon, authenticated
  USING (true);
