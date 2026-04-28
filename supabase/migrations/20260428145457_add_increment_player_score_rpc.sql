/*
  # Add increment_player_score RPC

  Atomically increments (or decrements) a player's score by a delta.
  This avoids stale-read bugs where the client holds an outdated score value.
*/
CREATE OR REPLACE FUNCTION increment_player_score(player_id uuid, delta integer)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE players SET score = score + delta WHERE id = player_id;
$$;
