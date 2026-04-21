/*
  # Update point values from single digits to hundreds

  ## Summary
  Updates all existing question point values from the old scale (2, 4, 6, 8, 10)
  to the new scale (200, 400, 600, 800, 1000).

  ## Changes
  - `questions.point_value`: remaps 2→200, 4→400, 6→600, 8→800, 10→1000
*/

UPDATE questions SET point_value = CASE point_value
  WHEN 2  THEN 200
  WHEN 4  THEN 400
  WHEN 6  THEN 600
  WHEN 8  THEN 800
  WHEN 10 THEN 1000
  ELSE point_value
END
WHERE point_value IN (2, 4, 6, 8, 10);
