-- Add squads column to clubs table
ALTER TABLE clubs
ADD COLUMN IF NOT EXISTS squads JSONB DEFAULT '["First Team", "Academy"]'::jsonb;

-- Ensure RLS allows updating it
-- (No new RLS policies needed as long as existing clubs update policies allow editing full row)
