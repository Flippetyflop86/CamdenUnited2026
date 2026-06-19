-- 1. Add instagram_handle column if it doesn't exist
ALTER TABLE public.league_teams ADD COLUMN IF NOT EXISTS instagram_handle text;

-- 2. Ensure RLS is enabled
ALTER TABLE public.league_teams ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow public read access" ON public.league_teams;
DROP POLICY IF EXISTS "Allow public insert access" ON public.league_teams;
DROP POLICY IF EXISTS "Allow public update access" ON public.league_teams;
DROP POLICY IF EXISTS "Allow public delete access" ON public.league_teams;

-- 4. Create new public access policies for League Setup Page
CREATE POLICY "Allow public read access" ON public.league_teams FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.league_teams FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.league_teams FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON public.league_teams FOR DELETE USING (true);

-- 5. Force reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
