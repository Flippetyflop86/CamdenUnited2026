-- Migration: Player Status, Departures, and Historical Record Retention
-- Run this in the Supabase SQL Editor if you want dedicated SQL columns alongside the built-in notes metadata.

ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS club_status TEXT DEFAULT 'Active',
ADD COLUMN IF NOT EXISTS departure_reason TEXT,
ADD COLUMN IF NOT EXISTS departure_date DATE,
ADD COLUMN IF NOT EXISTS departure_notes TEXT;

-- Ensure match_player_stats does NOT cascade delete if a player record is ever removed, or keep foreign key safe
-- Note: The application now archives departing players instead of deleting them, preserving all historical records.
