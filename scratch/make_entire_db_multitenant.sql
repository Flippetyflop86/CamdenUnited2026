-- =====================================================================
-- MASTER MULTI-TENANT DATABASE MIGRATION SCRIPT
-- =====================================================================
-- Run this script in the Supabase SQL Editor to make the entire database
-- isolated and secured for multiple individual users and different clubs.
-- =====================================================================

-- 1. Helper function to get the current user's club ID
CREATE OR REPLACE FUNCTION public.get_my_club_id()
RETURNS uuid AS $$
  SELECT club_id 
  FROM public.club_members 
  WHERE user_id = auth.uid() 
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Define the list of tables that need club isolation
DO $$ 
DECLARE 
    t_name text;
    tables text[] := ARRAY[
        'players', 
        'matches', 
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
        'watcher_stats',
        'league_teams'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        -- Check if the table exists
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            
            -- A. Add club_id column if it does not exist
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE', t_name);
            
            -- B. Set default value to auto-inject the club_id on insert
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN club_id SET DEFAULT public.get_my_club_id()', t_name);
            
            -- C. Enable Row Level Security (RLS)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- D. Drop any old policies to prevent conflict
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Users can manage their club ' || t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public read access', t_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public insert access', t_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public update access', t_name);
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Allow public delete access', t_name);
            
            -- E. Create the master tenant isolation RLS policy
            EXECUTE format('
                CREATE POLICY %I ON public.%I
                FOR ALL
                USING (club_id = public.get_my_club_id())
                WITH CHECK (club_id = public.get_my_club_id())
            ', 'Users can manage their club ' || t_name, t_name);
            
        END IF;
    END LOOP;
END $$;

-- 3. Configure Row Level Security (RLS) on the master clubs settings table
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage their own club" ON public.clubs;
CREATE POLICY "Users can manage their own club" ON public.clubs
    FOR ALL
    USING (id = public.get_my_club_id())
    WITH CHECK (id = public.get_my_club_id());

-- 4. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
