-- Make board-images bucket public for Segmind API access
-- This allows external APIs to access images via public URLs

-- Update the bucket to be public
UPDATE storage.buckets 
SET public = true 
WHERE id = 'board-images';

-- Add a public read policy for the board-images bucket
CREATE POLICY IF NOT EXISTS "board_images_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'board-images');

-- Keep the existing authenticated user policies for write operations
-- The existing policies for authenticated users remain unchanged
