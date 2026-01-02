-- Storage policy hardening: add null checks for safer path validation
-- Fixes issue where policies could fail silently on malformed paths

-- Expected path format: {user_id}/{stream_id}/{filename}
-- Example: "550e8400-e29b-41d4-a716-446655440000/stream123/1234567890-abc123.jpg"
-- The first folder segment must be the authenticated user's ID

-- Drop existing policies
DROP POLICY IF EXISTS "Users can upload to their folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their photos" ON storage.objects;

-- Recreate with null checks
CREATE POLICY "Users can upload to their folder"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can view their photos"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'photos'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] IS NOT NULL
    AND auth.uid()::text = (storage.foldername(name))[1]
);
