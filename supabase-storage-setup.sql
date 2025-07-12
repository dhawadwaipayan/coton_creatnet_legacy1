-- Supabase Storage Setup for Board Images
-- Run this in your Supabase SQL Editor

-- 1. Create the storage bucket for board images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'board-images',
  'board-images',
  true,
  52428800, -- 50MB limit
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
);

-- 2. Create RLS policies for the storage bucket
-- Allow authenticated users to upload images to their board folders
CREATE POLICY "Users can upload images to their board folders" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'board-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to view images from their board folders
CREATE POLICY "Users can view images from their board folders" ON storage.objects
FOR SELECT USING (
  bucket_id = 'board-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to update images in their board folders
CREATE POLICY "Users can update images in their board folders" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'board-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow authenticated users to delete images from their board folders
CREATE POLICY "Users can delete images from their board folders" ON storage.objects
FOR DELETE USING (
  bucket_id = 'board-images' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- 3. Enable RLS on storage.objects (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; 