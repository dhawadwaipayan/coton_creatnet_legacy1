-- Create the storage bucket for board videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-videos',
  'board-videos',
  true,
  104857600, -- 100MB limit for videos
  ARRAY['video/mp4', 'video/webm', 'video/avi', 'video/mov', 'video/quicktime']
);

-- Set up RLS policies for board videos
-- Allow users to upload videos to their user folders
CREATE POLICY "Users can upload videos to their own folders" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'board-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to view videos from their own folders
CREATE POLICY "Users can view videos from their own folders" ON storage.objects
FOR SELECT USING (
  bucket_id = 'board-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to update videos in their own folders
CREATE POLICY "Users can update videos in their own folders" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'board-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow users to delete videos from their own folders
CREATE POLICY "Users can delete videos from their own folders" ON storage.objects
FOR DELETE USING (
  bucket_id = 'board-videos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow service role to manage all videos (for API operations)
CREATE POLICY "Service role can manage all videos" ON storage.objects
FOR ALL USING (
  bucket_id = 'board-videos' 
  AND auth.role() = 'service_role'
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_board_videos_user_folder ON storage.objects (bucket_id, name) 
WHERE bucket_id = 'board-videos';
