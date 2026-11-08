-- =====================================================================
-- MASTER MULTI-TENANT DATABASE LOCKDOWN SCRIPT
-- =====================================================================
-- Run this script in the Supabase SQL Editor to guarantee every table
-- in ClubFlow is isolated and locked down per club.
-- =====================================================================

-- 1. Helper function to get the current logged-in user's club ID
CREATE OR REPLACE FUNCTION public.get_my_club_id()
RETURNS uuid AS $$
  SELECT club_id 
  FROM public.club_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Lock down all club-scoped tables with strict Row Level Security (RLS)
DO $$ 
DECLARE 
    t_name text;
    p_record record;
    tables text[] := ARRAY[
        'players', 
        'matches', 
        'fixtures',
        'training_sessions', 
        'finance_transactions',
        'recruits', 
        'sponsors', 
        'subscriptions', 
        'inventory_items', 
        'documents', 
        'staff', 
        'opposition_teams', 
        'matchday_xis', 
        'squad_depths',
        'watcher_stats',
        'league_teams',
        'club_payments',
        'player_payment_requests',
        'activity_logs',
        'email_history',
        'email_templates',
        'app_users'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            
            -- A. Add club_id column if it does not exist
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE', t_name);
            
            -- B. Auto-inject the user's club_id on insert
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN club_id SET DEFAULT public.get_my_club_id()', t_name);
            
            -- C. Enable Row Level Security (RLS)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- D. Drop all existing permissive/public policies on this table
            FOR p_record IN 
                SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_record.policyname, t_name);
            END LOOP;
            
            -- E. Create strict club-isolation RLS policy
            EXECUTE format('
                CREATE POLICY %I ON public.%I
                FOR ALL
                USING (club_id = public.get_my_club_id())
                WITH CHECK (club_id = public.get_my_club_id())
            ', 'Users can manage their club ' || t_name, t_name);
            
        END IF;
    END LOOP;
END $$;

-- 3. Lock down match_player_stats via parent player ownership
DO $$
DECLARE
    p_record record;
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_player_stats') THEN
        ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

        FOR p_record IN 
            SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'match_player_stats'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_player_stats', p_record.policyname);
        END LOOP;

        CREATE POLICY "Users can manage their club match_player_stats" ON public.match_player_stats
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM public.players p
                    WHERE p.id = match_player_stats.player_id
                      AND p.club_id = public.get_my_club_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.players p
                    WHERE p.id = match_player_stats.player_id
                      AND p.club_id = public.get_my_club_id()
                )
            );
    END IF;
END $$;

-- 4. Lock down the master clubs settings table
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own club" ON public.clubs;
CREATE POLICY "Users can manage their own club" ON public.clubs
    FOR ALL
    USING (id = public.get_my_club_id())
    WITH CHECK (id = public.get_my_club_id());

-- 5. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
