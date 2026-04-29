/*
  # Add players table to realtime publication

  The players table was missing from supabase_realtime, so score updates
  were never pushed to clients — they only saw changes after a full page refresh.
*/
ALTER PUBLICATION supabase_realtime ADD TABLE players;
