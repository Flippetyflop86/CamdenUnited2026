-- =====================================================================
-- MULTI-USER ACCESS & INVITATIONS MIGRATION SCRIPT
-- =====================================================================
-- Run this script in the Supabase SQL Editor to enable team member
-- management and invitation flow.
-- =====================================================================

-- 1. Create Invitations Table
CREATE TABLE IF NOT EXISTS public.club_invitations (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
    email text UNIQUE NOT NULL,
    role text NOT NULL DEFAULT 'Assistant Coach',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now())
);

-- Enable RLS on Invitations
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view invitations" ON public.club_invitations;
CREATE POLICY "Members can view invitations" ON public.club_invitations
    FOR SELECT
    USING (club_id = public.get_my_club_id());

DROP POLICY IF EXISTS "Members can manage invitations" ON public.club_invitations;
CREATE POLICY "Members can manage invitations" ON public.club_invitations
    FOR ALL
    USING (club_id = public.get_my_club_id())
    WITH CHECK (club_id = public.get_my_club_id());

-- 2. Configure RLS on club_members to allow team members to see each other
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view club_members" ON public.club_members;
CREATE POLICY "Members can view club_members" ON public.club_members
    FOR SELECT
    USING (club_id IN (
        SELECT cm.club_id 
        FROM public.club_members cm 
        WHERE cm.user_id = auth.uid()
    ));

DROP POLICY IF EXISTS "Managers can manage club_members" ON public.club_members;
CREATE POLICY "Managers can manage club_members" ON public.club_members
    FOR ALL
    USING (
        club_id IN (
            SELECT cm.club_id 
            FROM public.club_members cm 
            WHERE cm.user_id = auth.uid() AND cm.role = 'Manager'
        )
    );

-- 3. Replace/Create Auth User Created Trigger to support invitations
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
    invited_club_id uuid;
    invited_role text;
    new_club_id uuid;
    club_name_val text;
BEGIN
    -- Check if this email has a pending invitation
    SELECT club_id, role INTO invited_club_id, invited_role
    FROM public.club_invitations
    WHERE LOWER(email) = LOWER(new.email)
    LIMIT 1;

    IF invited_club_id IS NOT NULL THEN
        -- Add user as a member of the invited club
        INSERT INTO public.club_members (user_id, club_id, role)
        VALUES (new.id, invited_club_id, invited_role);

        -- Clean up invitation
        DELETE FROM public.club_invitations
        WHERE LOWER(email) = LOWER(new.email);
    ELSE
        -- No invitation, create a new club
        club_name_val := COALESCE(new.raw_user_meta_data->>'club_name', 'My Club');

        INSERT INTO public.clubs (name)
        VALUES (club_name_val)
        RETURNING id INTO new_club_id;

        INSERT INTO public.club_members (user_id, club_id, role)
        VALUES (new.id, new_club_id, 'Manager');
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create the trigger on auth.users just in case
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

SELECT 'Invitations and roles successfully configured!' AS status;
