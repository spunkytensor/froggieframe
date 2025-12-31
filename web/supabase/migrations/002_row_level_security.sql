-- Row Level Security Policies for Froggie Frame
-- These policies ensure users can only access their own data

-- Enable RLS on all tables
ALTER TABLE photo_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_secrets ENABLE ROW LEVEL SECURITY;

-- Photo Streams Policies
CREATE POLICY "Users can view their own streams"
    ON photo_streams FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create streams"
    ON photo_streams FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own streams"
    ON photo_streams FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own streams"
    ON photo_streams FOR DELETE
    USING (auth.uid() = user_id);

-- Photos Policies
CREATE POLICY "Users can view their own photos"
    ON photos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can upload photos to their streams"
    ON photos FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM photo_streams
            WHERE photo_streams.id = stream_id
            AND photo_streams.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their own photos"
    ON photos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own photos"
    ON photos FOR DELETE
    USING (auth.uid() = user_id);

-- API Keys Policies
CREATE POLICY "Users can view their own API keys"
    ON api_keys FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create API keys for their streams"
    ON api_keys FOR INSERT
    WITH CHECK (
        auth.uid() = user_id
        AND EXISTS (
            SELECT 1 FROM photo_streams
            WHERE photo_streams.id = stream_id
            AND photo_streams.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their own API keys"
    ON api_keys FOR DELETE
    USING (auth.uid() = user_id);

-- OTP Secrets Policies
CREATE POLICY "Users can view their own OTP settings"
    ON otp_secrets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own OTP settings"
    ON otp_secrets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OTP settings"
    ON otp_secrets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OTP settings"
    ON otp_secrets FOR DELETE
    USING (auth.uid() = user_id);
