-- Migration: Football Data Import Centre (Sprint 11)

-- 1. Create entity_aliases table
CREATE TABLE IF NOT EXISTS public.entity_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('team', 'competition', 'venue', 'referee')),
    alias TEXT NOT NULL,
    canonical_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence INTEGER DEFAULT 100
);

-- Ensure fast lookups for parsing
CREATE INDEX IF NOT EXISTS idx_entity_aliases_club_type ON public.entity_aliases(club_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_alias ON public.entity_aliases(alias);

-- Enable RLS
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read aliases for their clubs"
    ON public.entity_aliases FOR SELECT
    USING (club_id IN (
        SELECT club_id FROM club_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can insert aliases for their clubs"
    ON public.entity_aliases FOR INSERT
    WITH CHECK (club_id IN (
        SELECT club_id FROM club_members WHERE user_id = auth.uid()
    ));

CREATE POLICY "Users can update aliases for their clubs"
    ON public.entity_aliases FOR UPDATE
    USING (club_id IN (
        SELECT club_id FROM club_members WHERE user_id = auth.uid()
    ));

-- 2. Add extended Club Settings to clubs table
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS default_home_kick_off TEXT,
    ADD COLUMN IF NOT EXISTS default_training_venue TEXT,
    ADD COLUMN IF NOT EXISTS preferred_surface TEXT,
    ADD COLUMN IF NOT EXISTS primary_kit TEXT,
    ADD COLUMN IF NOT EXISTS secondary_kit TEXT,
    ADD COLUMN IF NOT EXISTS season_start DATE,
    ADD COLUMN IF NOT EXISTS season_end DATE,
    ADD COLUMN IF NOT EXISTS default_competition TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/London';

-- 3. Add Import History to clubs table (or as a separate table. We'll use a JSONB field on clubs for simple history tracking)
ALTER TABLE public.clubs
    ADD COLUMN IF NOT EXISTS last_import_history JSONB;
