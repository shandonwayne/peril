/*
  # Add game_sessions to realtime publication

  game_sessions was missing from supabase_realtime, so player clients
  never received buzzer_question_id updates.
*/
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
