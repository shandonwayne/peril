/*
  # Storage policies for question-images bucket

  Allows authenticated users to upload and manage images,
  and allows public read access so images can be displayed
  to game players without authentication.
*/

CREATE POLICY "Public read access for question images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can upload question images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can update question images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'question-images')
  WITH CHECK (bucket_id = 'question-images');

CREATE POLICY "Authenticated users can delete question images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'question-images');
