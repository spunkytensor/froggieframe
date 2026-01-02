-- AI Photo Tagging & Mood Detection Schema
-- Migration: 004_ai_photo_tagging.sql

-- Create photo_tags table for storing AI-generated tags
CREATE TABLE photo_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('person', 'place', 'object', 'event')),
    confidence FLOAT CHECK (confidence >= 0 AND confidence <= 1),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_photo_tags_photo_id ON photo_tags(photo_id);
CREATE INDEX idx_photo_tags_tag ON photo_tags(tag);
CREATE INDEX idx_photo_tags_category ON photo_tags(category);

-- Add AI-related columns to photos table
ALTER TABLE photos ADD COLUMN mood TEXT CHECK (mood IN ('calmer', 'darker', 'vibrant', 'relaxing', 'energetic', 'neutral'));
ALTER TABLE photos ADD COLUMN mood_confidence FLOAT CHECK (mood_confidence >= 0 AND mood_confidence <= 1);
ALTER TABLE photos ADD COLUMN ai_status TEXT DEFAULT 'pending' CHECK (ai_status IN ('pending', 'processing', 'complete', 'failed'));
ALTER TABLE photos ADD COLUMN ai_analyzed_at TIMESTAMPTZ;
ALTER TABLE photos ADD COLUMN ai_error TEXT;

-- Create index for AI status queries
CREATE INDEX idx_photos_ai_status ON photos(ai_status);

-- RLS Policies for photo_tags

-- Enable RLS on photo_tags table
ALTER TABLE photo_tags ENABLE ROW LEVEL SECURITY;

-- Users can view tags for their own photos
CREATE POLICY "Users can view own photo tags" ON photo_tags
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM photos 
            WHERE photos.id = photo_tags.photo_id 
            AND photos.user_id = auth.uid()
        )
    );

-- Users can insert tags for their own photos (for manual tagging in future)
CREATE POLICY "Users can insert own photo tags" ON photo_tags
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM photos 
            WHERE photos.id = photo_tags.photo_id 
            AND photos.user_id = auth.uid()
        )
    );

-- Users can delete tags for their own photos
CREATE POLICY "Users can delete own photo tags" ON photo_tags
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM photos 
            WHERE photos.id = photo_tags.photo_id 
            AND photos.user_id = auth.uid()
        )
    );

-- Service role can manage all tags (for AI background worker)
CREATE POLICY "Service role can manage all tags" ON photo_tags
    FOR ALL USING (auth.role() = 'service_role');

-- Enable realtime for photos table to broadcast AI status updates
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
