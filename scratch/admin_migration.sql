-- Run this script in your Supabase SQL Editor

ALTER TABLE public.clubs
ADD COLUMN IF NOT EXISTS home_ground text,
ADD COLUMN IF NOT EXISTS founding_year integer,
ADD COLUMN IF NOT EXISTS twitter_url text,
ADD COLUMN IF NOT EXISTS instagram_url text,
ADD COLUMN IF NOT EXISTS fine_categories jsonb DEFAULT '[{"name": "Yellow Card", "amount": 10}, {"name": "Red Card", "amount": 25}, {"name": "Late to Match", "amount": 5}]'::jsonb,
ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS notification_email text;
