-- ============================================================================
-- ClubFlow Multi-Tenant Supabase Row-Level Security (RLS) Hardening Script
-- Run this in Supabase Dashboard -> SQL Editor to enforce strict club-level
-- isolation at the database layer (preventing anonymous writes & cross-club reads).
-- Note: Server API routes (/api/*) using SUPABASE_SERVICE_ROLE_KEY continue to
-- work seamlessly for public 1-tap payment and responder pages.
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
        'email_history',
        'email_templates'
    ];
BEGIN
    FOREACH tbl IN ARRAY tenant_tables LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = tbl
        ) THEN
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);

            -- Drop overly permissive legacy policies on tenant tables
            FOR pol IN
                SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = tbl
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, tbl);
            END LOOP;

            -- Create strict authenticated club-member policy
            EXECUTE format(
                'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.user_belongs_to_club(club_id)) WITH CHECK (public.user_belongs_to_club(club_id))',
                tbl || '_club_member_isolation',
                tbl
            );
        END IF;
    END LOOP;
END $$;
