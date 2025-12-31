-- Storage bucket setup for Froggie Frame photos
-- Run this in your Supabase SQL Editor

-- Create the photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'photos',
    'photos',
    false,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Storage Policies

-- Users can upload to their own folder
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own photos
CREATE POLICY "Users can view their photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can delete their own photos
CREATE POLICY "Users can delete their photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Service role can access all photos (for API key authenticated requests)
-- This is handled through the service role key in the API routes
