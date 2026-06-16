-- Create trigger for matches table to auto-inject club_id on insert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_matches_club_id') THEN
        CREATE TRIGGER set_matches_club_id
        BEFORE INSERT ON public.matches
        FOR EACH ROW
        EXECUTE FUNCTION public.set_club_id_from_user();
    END IF;
END $$;

-- Verify RLS policy exists and is correct
DROP POLICY IF EXISTS "Users can manage their club matches" ON matches;
CREATE POLICY "Users can manage their club matches" ON matches
FOR ALL
USING (club_id = public.get_my_club_id())
WITH CHECK (club_id = public.get_my_club_id());
