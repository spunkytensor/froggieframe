-- Increase storage limit for photos bucket
-- Migration: 005_increase_storage_limit.sql

-- Update the photos bucket file size limit from 10MB to 100MB
UPDATE storage.buckets
SET file_size_limit = 104857600  -- 100MB
WHERE id = 'photos';
