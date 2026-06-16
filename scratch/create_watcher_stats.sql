CREATE TABLE IF NOT EXISTS public.watcher_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    stats JSONB NOT NULL DEFAULT '{"goals": [], "assists": [], "shots": []}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(match_id)
);

-- Set up Row Level Security
ALTER TABLE public.watcher_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON public.watcher_stats
    FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON public.watcher_stats
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON public.watcher_stats
    FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON public.watcher_stats
    FOR DELETE USING (true);
