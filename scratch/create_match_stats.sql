-- Create the Match Player Stats bridging table
CREATE TABLE IF NOT EXISTS public.match_player_stats (
    id uuid primary key default uuid_generate_v4(),
    match_id uuid references public.matches(id) on delete cascade not null,
    player_id uuid references public.players(id) on delete cascade not null,
    club_id uuid references public.clubs(id) on delete cascade,
    goals integer default 0,
    assists integer default 0,
    yellow_cards integer default 0,
    red_cards integer default 0,
    minutes_played integer,
    created_at timestamp with time zone default timezone('utc'::text, now()),
    UNIQUE(match_id, player_id) -- A player can only have one stat record per match
);

-- Add Trigger to auto-set club_id on insert
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_match_player_stats_club_id') THEN
        CREATE TRIGGER set_match_player_stats_club_id
        BEFORE INSERT ON public.match_player_stats
        FOR EACH ROW
        EXECUTE FUNCTION public.set_club_id_from_user();
    END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE public.match_player_stats ENABLE ROW LEVEL SECURITY;

-- Create Security Policies
DROP POLICY IF EXISTS "Users can manage their club match stats" ON public.match_player_stats;
CREATE POLICY "Users can manage their club match stats" ON public.match_player_stats
FOR ALL
USING (club_id = public.get_my_club_id())
WITH CHECK (club_id = public.get_my_club_id());
