-- 1. Add club_id column to staff if it doesn't exist
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE;

-- 2. Set the default value to automatically assign the user's club_id on insert
ALTER TABLE public.staff ALTER COLUMN club_id SET DEFAULT public.get_my_club_id();

-- 3. Assign any existing staff members with NULL club_id to the first club so they don't disappear
UPDATE public.staff 
SET club_id = (SELECT id FROM public.clubs LIMIT 1)
WHERE club_id IS NULL;

-- 4. Enable Row Level Security (RLS) on the staff table
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 5. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Users can manage their club staff" ON public.staff;
DROP POLICY IF EXISTS "Allow public read access" ON public.staff;
DROP POLICY IF EXISTS "Allow public insert access" ON public.staff;
DROP POLICY IF EXISTS "Allow public update access" ON public.staff;
DROP POLICY IF EXISTS "Allow public delete access" ON public.staff;

-- 6. Create RLS policy so users can only manage staff belonging to their own club
CREATE POLICY "Users can manage their club staff" ON public.staff
    FOR ALL
    USING (club_id = public.get_my_club_id())
    WITH CHECK (club_id = public.get_my_club_id());

-- 7. Force reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
