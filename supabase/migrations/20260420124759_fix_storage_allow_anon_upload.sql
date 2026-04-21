/*
  # Fix storage upload policy to allow anonymous uploads

  The app does not use authentication, so uploads were failing because
  the INSERT policy was restricted to authenticated users only.
  This migration drops the existing INSERT policy and replaces it with
  one that allows all users (including anonymous) to upload to the
  question-images bucket.

  1. Changes
    - Drop "Authenticated users can upload question images" INSERT policy
    - Add "Anyone can upload question images" INSERT policy allowing anon access
*/

DROP POLICY IF EXISTS "Authenticated users can upload question images" ON storage.objects;

CREATE POLICY "Anyone can upload question images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'question-images');
