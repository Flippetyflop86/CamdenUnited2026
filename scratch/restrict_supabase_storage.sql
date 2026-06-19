-- =====================================================================
-- STORAGE BUCKET SECURITY RULES MIGRATION
-- =====================================================================
-- Run this script in the Supabase SQL Editor to enforce size limits (2MB) 
-- and image-only formats directly at the Supabase Storage/CDN layer.
-- =====================================================================

-- 1. Create or update the storage bucket configuration for club logos & sponsors
-- Enforces: Max file size of 2MB (2,097,152 bytes) and only allows common web image formats
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'club_logos', 
  'club_logos', 
  true, 
  2097152, -- 2MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

SELECT 'Supabase Storage limits (2MB & web-safe images only) successfully configured!' AS status;
