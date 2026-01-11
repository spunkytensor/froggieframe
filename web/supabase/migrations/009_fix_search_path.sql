-- Fix mutable search_path vulnerability in update_updated_at_column
-- Setting search_path to empty string prevents search_path injection attacks

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';
