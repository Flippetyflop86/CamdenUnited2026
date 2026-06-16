CREATE TABLE IF NOT EXISTS public.opposition_teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    formation TEXT NOT NULL DEFAULT '4-4-2',
    notes JSONB NOT NULL DEFAULT '{}'::jsonb,
    lineup JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Set up Row Level Security
ALTER TABLE public.opposition_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.opposition_teams
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.opposition_teams
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.opposition_teams
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.opposition_teams
    FOR DELETE USING (true);
