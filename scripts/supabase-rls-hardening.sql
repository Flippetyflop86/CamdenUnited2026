-- ============================================================================
-- ClubFlow Multi-Tenant Supabase Row-Level Security (RLS) Hardening Script
-- Run this in Supabase Dashboard -> SQL Editor (after confirming
-- SUPABASE_SERVICE_ROLE_KEY is set in Vercel Environment Variables) to enforce
-- strict club-level isolation at the database layer.
-- Note: Server API routes (/api/*) using SUPABASE_SERVICE_ROLE_KEY continue to
-- work seamlessly for public 1-tap payment, RSVP, and 1-time invite pages.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.user_belongs_to_club(target_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = target_club_id
          AND cm.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.club_has_any_members(target_club_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.club_members cm
        WHERE cm.club_id = target_club_id
    );
$$;

-- 1. Standard club_id-scoped tenant tables
DO $$
DECLARE
    tbl text;
    pol record;
    tenant_tables text[] := ARRAY[
        'players',
        'matches',
        'fixtures',
        'league_teams',
        'squad_depths',
        'training_sessions',
        'finance_transactions',
        'sponsors',
        'inventory_items',
        'documents',
        'opposition_teams',
        'matchday_xis',
        'recruits',
        'staff',
        'club_payments',
        'player_payment_requests',
        'player_fines',
        'activity_logs',
        'email_history',
        'email_templates',
        'club_invitations'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

            FOR pol IN
                SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
            END LOOP;

            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.user_belongs_to_club(club_id)) WITH CHECK (public.user_belongs_to_club(club_id))',
                tbl || '_club_member_isolation',
                tbl
            );
        END IF;
    END LOOP;
END $$;

-- 2. clubs table: members can read/update their own club; newly signed-up managers can INSERT a new club during onboarding
DO $$
DECLARE
    pol record;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clubs') THEN
        ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'clubs' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.clubs', pol.policyname);
        END LOOP;

        CREATE POLICY clubs_select_member ON public.clubs
            FOR SELECT TO authenticated
            USING (public.user_belongs_to_club(id));

        CREATE POLICY clubs_update_member ON public.clubs
            FOR UPDATE TO authenticated
            USING (public.user_belongs_to_club(id))
            WITH CHECK (public.user_belongs_to_club(id));

        CREATE POLICY clubs_insert_onboarding ON public.clubs
            FOR INSERT TO authenticated
            WITH CHECK (auth.uid() IS NOT NULL);
    END IF;
END $$;

-- 3. club_members table: users can view/manage members in their club, or insert their own initial membership row during onboarding
DO $$
DECLARE
    pol record;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'club_members') THEN
        ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'club_members' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.club_members', pol.policyname);
        END LOOP;

        CREATE POLICY club_members_select_own_or_club ON public.club_members
            FOR SELECT TO authenticated
            USING (user_id = auth.uid() OR public.user_belongs_to_club(club_id));

        -- Only allow self-insert when founding a brand-new club (0 existing members); joining an existing club goes through server-verified /api/staff/invite or /api/player/activate
        CREATE POLICY club_members_insert_founder_or_member ON public.club_members
            FOR INSERT TO authenticated
            WITH CHECK (
                public.user_belongs_to_club(club_id)
                OR (user_id = auth.uid() AND NOT public.club_has_any_members(club_id))
            );

        CREATE POLICY club_members_update_own_or_club ON public.club_members
            FOR UPDATE TO authenticated
            USING (public.user_belongs_to_club(club_id))
            WITH CHECK (public.user_belongs_to_club(club_id));

        CREATE POLICY club_members_delete_club ON public.club_members
            FOR DELETE TO authenticated
            USING (public.user_belongs_to_club(club_id));
    END IF;
END $$;

-- 4. match_player_stats table (linked via match_id -> matches.club_id)
DO $$
DECLARE
    pol record;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'match_player_stats') THEN
        ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'match_player_stats' LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.match_player_stats', pol.policyname);
        END LOOP;

        CREATE POLICY match_player_stats_club_isolation ON public.match_player_stats
            FOR ALL TO authenticated
            USING (
                EXISTS (
                    SELECT 1 FROM public.matches m
                    WHERE m.id = match_player_stats.match_id
                      AND public.user_belongs_to_club(m.club_id)
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.matches m
                    WHERE m.id = match_player_stats.match_id
                      AND public.user_belongs_to_club(m.club_id)
                )
            );
    END IF;
END $$;
