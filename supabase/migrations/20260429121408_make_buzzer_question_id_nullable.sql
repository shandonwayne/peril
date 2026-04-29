/*
  # Make buzzer_events.question_id nullable

  Allows players to buzz in at any time, even when no question is actively
  open on the host side.
*/
ALTER TABLE buzzer_events ALTER COLUMN question_id DROP NOT NULL;
