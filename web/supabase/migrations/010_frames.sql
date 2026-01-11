-- Frames as First-Class Entities
-- Each frame has its own persistent identity, independent of streams

-- Frames table
CREATE TABLE IF NOT EXISTS frames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(255),
    timezone VARCHAR(100) DEFAULT 'UTC',
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Device token for authentication (single token per frame)
    device_token_hash VARCHAR(64) UNIQUE,
    
    -- Display preferences
    brightness INTEGER DEFAULT 100 CHECK (brightness >= 0 AND brightness <= 100),
    orientation VARCHAR(20) DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait', 'auto')),
    transition_effect VARCHAR(20) DEFAULT 'fade',
    slideshow_interval INTEGER DEFAULT 30 CHECK (slideshow_interval >= 5),
    
    -- Schedule
    wake_time TIME,
    sleep_time TIME,
    
    -- Status
    is_online BOOLEAN DEFAULT false,
    last_seen_at TIMESTAMPTZ,
    firmware_version VARCHAR(50),
    
    -- Content configuration
    shuffle BOOLEAN DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Frame sources - links frames to content sources (streams or external)
CREATE TYPE source_type AS ENUM ('stream', 'google_photos', 'direct_upload', 'url_feed');

CREATE TABLE IF NOT EXISTS frame_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    frame_id UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
    source_type source_type NOT NULL DEFAULT 'stream',
    
    -- For stream sources
    stream_id UUID REFERENCES photo_streams(id) ON DELETE CASCADE,
    
    -- For external sources (future use)
    external_config JSONB,
    
    -- Source weighting and configuration
    weight INTEGER DEFAULT 100 CHECK (weight >= 0 AND weight <= 100),
    is_enabled BOOLEAN DEFAULT true,
    
    -- Sync configuration
    sync_frequency VARCHAR(20) DEFAULT 'realtime' CHECK (sync_frequency IN ('realtime', 'hourly', 'daily')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Ensure each stream can only be linked once per frame
    UNIQUE(frame_id, stream_id)
);

-- Smart playlists for frames
CREATE TYPE playlist_type AS ENUM (
    'all_sources',      -- Unified stream from all connected sources
    'favorites',        -- Aggregate favorites/likes from all services
    'on_this_day',      -- "On this day" from all sources
    'people',           -- Photos containing specific people
    'location',         -- Photos from specific places
    'recent',           -- Last 30/60/90 days
    'mood',             -- Filter by mood
    'custom'            -- Custom filters
);

CREATE TABLE IF NOT EXISTS frame_playlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    frame_id UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    playlist_type playlist_type NOT NULL DEFAULT 'all_sources',
    
    -- Configuration for the playlist
    config JSONB DEFAULT '{}',
    -- e.g., {"days": 30} for recent, {"moods": ["vibrant", "relaxing"]} for mood
    
    -- Weighting for mixed display
    weight INTEGER DEFAULT 100,
    is_active BOOLEAN DEFAULT true,
    
    -- Scheduling (optional)
    schedule_start TIME,
    schedule_end TIME,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Display rules for frames
CREATE TABLE IF NOT EXISTS frame_display_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    frame_id UUID NOT NULL REFERENCES frames(id) ON DELETE CASCADE,
    
    -- Content filters
    exclude_screenshots BOOLEAN DEFAULT true,
    exclude_duplicates BOOLEAN DEFAULT true,
    min_quality_score INTEGER DEFAULT 0 CHECK (min_quality_score >= 0 AND min_quality_score <= 100),
    
    -- Orientation matching
    prefer_matching_orientation BOOLEAN DEFAULT true,
    aspect_ratio_handling VARCHAR(20) DEFAULT 'letterbox' CHECK (aspect_ratio_handling IN ('crop', 'letterbox', 'skip')),
    
    -- Freshness weighting (0-100, higher = prefer newer photos)
    freshness_weight INTEGER DEFAULT 50 CHECK (freshness_weight >= 0 AND freshness_weight <= 100),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(frame_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_frames_user_id ON frames(user_id);
CREATE INDEX IF NOT EXISTS idx_frames_device_token_hash ON frames(device_token_hash);
CREATE INDEX IF NOT EXISTS idx_frame_sources_frame_id ON frame_sources(frame_id);
CREATE INDEX IF NOT EXISTS idx_frame_sources_stream_id ON frame_sources(stream_id);
CREATE INDEX IF NOT EXISTS idx_frame_playlists_frame_id ON frame_playlists(frame_id);
CREATE INDEX IF NOT EXISTS idx_frame_display_rules_frame_id ON frame_display_rules(frame_id);

-- Apply updated_at trigger to new tables
CREATE TRIGGER update_frames_updated_at
    BEFORE UPDATE ON frames
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_frame_sources_updated_at
    BEFORE UPDATE ON frame_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_frame_playlists_updated_at
    BEFORE UPDATE ON frame_playlists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_frame_display_rules_updated_at
    BEFORE UPDATE ON frame_display_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security for frames
ALTER TABLE frames ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE frame_display_rules ENABLE ROW LEVEL SECURITY;

-- Policies for frames
CREATE POLICY "Users can view their own frames"
    ON frames FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own frames"
    ON frames FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own frames"
    ON frames FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own frames"
    ON frames FOR DELETE
    USING (auth.uid() = user_id);

-- Policies for frame_sources
CREATE POLICY "Users can view sources for their frames"
    ON frame_sources FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_sources.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert sources for their frames"
    ON frame_sources FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_sources.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can update sources for their frames"
    ON frame_sources FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_sources.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete sources for their frames"
    ON frame_sources FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_sources.frame_id AND frames.user_id = auth.uid()
    ));

-- Policies for frame_playlists
CREATE POLICY "Users can view playlists for their frames"
    ON frame_playlists FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_playlists.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert playlists for their frames"
    ON frame_playlists FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_playlists.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can update playlists for their frames"
    ON frame_playlists FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_playlists.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete playlists for their frames"
    ON frame_playlists FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_playlists.frame_id AND frames.user_id = auth.uid()
    ));

-- Policies for frame_display_rules
CREATE POLICY "Users can view display rules for their frames"
    ON frame_display_rules FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_display_rules.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can insert display rules for their frames"
    ON frame_display_rules FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_display_rules.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can update display rules for their frames"
    ON frame_display_rules FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_display_rules.frame_id AND frames.user_id = auth.uid()
    ));

CREATE POLICY "Users can delete display rules for their frames"
    ON frame_display_rules FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM frames WHERE frames.id = frame_display_rules.frame_id AND frames.user_id = auth.uid()
    ));
