-- EXIF Metadata Schema
-- Migration: 006_exif_metadata.sql
-- Adds GPS location, capture date, and orientation from image EXIF data

-- Add EXIF metadata columns to photos table
ALTER TABLE photos ADD COLUMN exif_latitude DOUBLE PRECISION;
ALTER TABLE photos ADD COLUMN exif_longitude DOUBLE PRECISION;
ALTER TABLE photos ADD COLUMN exif_altitude DOUBLE PRECISION;
ALTER TABLE photos ADD COLUMN exif_captured_at TIMESTAMPTZ;
ALTER TABLE photos ADD COLUMN exif_orientation INTEGER CHECK (exif_orientation >= 1 AND exif_orientation <= 8);

-- Create index for location-based queries (e.g., finding photos near a location)
CREATE INDEX idx_photos_location ON photos(exif_latitude, exif_longitude) WHERE exif_latitude IS NOT NULL AND exif_longitude IS NOT NULL;

-- Create index for date-based queries
CREATE INDEX idx_photos_captured_at ON photos(exif_captured_at) WHERE exif_captured_at IS NOT NULL;

COMMENT ON COLUMN photos.exif_latitude IS 'GPS latitude from EXIF data (decimal degrees, positive = North)';
COMMENT ON COLUMN photos.exif_longitude IS 'GPS longitude from EXIF data (decimal degrees, positive = East)';
COMMENT ON COLUMN photos.exif_altitude IS 'GPS altitude from EXIF data (meters above sea level)';
COMMENT ON COLUMN photos.exif_captured_at IS 'Original capture timestamp from EXIF DateTimeOriginal';
COMMENT ON COLUMN photos.exif_orientation IS 'EXIF orientation value (1-8), see EXIF spec for rotation/flip mapping';
