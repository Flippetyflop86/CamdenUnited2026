-- =====================================================================
-- DATABASE MIGRATION: MULTI-TENANT SECURITY HARDENING
-- =====================================================================
-- Run this script in your Supabase SQL Editor (https://supabase.com)
-- =====================================================================

-- 1. Ensure uuid-ossp extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Drop any old public RLS policies on training_sessions
DROP POLICY IF EXISTS "Allow public read access" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow public insert access" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow public update access" ON public.training_sessions;
DROP POLICY IF EXISTS "Allow public delete access" ON public.training_sessions;
DROP POLICY IF EXISTS "Users can manage their club training_sessions" ON public.training_sessions;

-- Ensure RLS is active on training_sessions
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

-- Create secure RLS policy for training_sessions
CREATE POLICY "Users can manage their club training_sessions" ON public.training_sessions
    FOR ALL
    USING (club_id = public.get_my_club_id())
    WITH CHECK (club_id = public.get_my_club_id());

-- 3. Partition app_users Table by club_id & Ensure training_location column exists on clubs
-- Ensure training_location column exists on clubs
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS training_location text;

-- Drop the legacy global unique constraint on username if it exists
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_username_key;

-- Add club_id column if it does not exist
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;

-- Auto-inject club_id on insert
ALTER TABLE public.app_users ALTER COLUMN club_id SET DEFAULT public.get_my_club_id();

-- Add composite unique constraint for username per club
ALTER TABLE public.app_users DROP CONSTRAINT IF EXISTS app_users_club_username_key;
ALTER TABLE public.app_users ADD CONSTRAINT app_users_club_username_key UNIQUE (club_id, username);

-- Enable RLS on app_users
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

-- Drop old app_users policies if any exist
DROP POLICY IF EXISTS "Users can manage their club app_users" ON public.app_users;

-- Create RLS policy for app_users
CREATE POLICY "Users can manage their club app_users" ON public.app_users
    FOR ALL
    USING (club_id = public.get_my_club_id())
    WITH CHECK (club_id = public.get_my_club_id());

-- 4. Dynamically Drop Any Check Constraints on club_members(role)
-- This prevents lowercase 'manager' inserts from failing due to case-sensitive constraints
DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.club_members'::regclass 
      AND contype = 'c' 
      AND pg_get_constraintdef(oid) LIKE '%role%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.club_members DROP CONSTRAINT %I', constraint_name);
        RAISE NOTICE 'Dropped check constraint % on club_members', constraint_name;
    END IF;
END $$;

-- 5. Harden and Repair User Creation Trigger Function (handle_new_user)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    invited_club_id uuid;
    invited_role text;
    invited_display_name text;
    invited_page_permissions jsonb;
    new_club_id uuid;
    club_name_val text;
BEGIN
    -- Check if this email has a pending invitation
    SELECT club_id, role, display_name, page_permissions 
    INTO invited_club_id, invited_role, invited_display_name, invited_page_permissions
    FROM public.club_invitations
    WHERE LOWER(email) = LOWER(new.email)
    LIMIT 1;

    IF invited_club_id IS NOT NULL THEN
        -- Add user as a member of the invited club, copying role, email, display name and page permissions
        INSERT INTO public.club_members (user_id, club_id, role, email, display_name, page_permissions)
        VALUES (
            new.id, 
            invited_club_id, 
            LOWER(invited_role), -- Keep lowercase for app consistency
            new.email,
            COALESCE(new.raw_user_meta_data->>'full_name', invited_display_name, SPLIT_PART(new.email, '@', 1)), 
            COALESCE(invited_page_permissions, '[]'::jsonb)
        );

        -- Clean up invitation
        DELETE FROM public.club_invitations
        WHERE LOWER(email) = LOWER(new.email);
    ELSE
        -- No invitation, create a new club
        club_name_val := COALESCE(new.raw_user_meta_data->>'club_name', 'My Club');

        INSERT INTO public.clubs (name)
        VALUES (club_name_val)
        RETURNING id INTO new_club_id;

        INSERT INTO public.club_members (user_id, club_id, role, email, display_name, page_permissions)
        VALUES (
            new.id, 
            new_club_id, 
            'manager', -- Normalized to lowercase 'manager'
            new.email,
            COALESCE(new.raw_user_meta_data->>'full_name', SPLIT_PART(new.email, '@', 1)),
            '[]'::jsonb
        );
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-bind trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Define Secure SECURITY DEFINER RPC to lookup invites by token
-- This allows unauthenticated joiners to validate their token without opening RLS select policies.
CREATE OR REPLACE FUNCTION public.get_invitation_by_token(token_val uuid)
RETURNS TABLE (
    id uuid,
    club_id uuid,
    email text,
    role text,
    display_name text,
    page_permissions jsonb,
    club_name text,
    club_logo text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.id, 
        i.club_id, 
        i.email, 
        i.role, 
        i.display_name, 
        i.page_permissions,
        c.name::text AS club_name,
        c.logo::text AS club_logo
    FROM public.club_invitations i
    JOIN public.clubs c ON i.club_id = c.id
    WHERE i.token = token_val AND i.accepted_at IS NULL
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'Multi-tenant database security migration completed successfully!' AS status;
