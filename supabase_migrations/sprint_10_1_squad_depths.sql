-- Migration for Sprint 10.1: Squad Depths

CREATE TABLE IF NOT EXISTS public.squad_depths (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    squad TEXT NOT NULL,
    formation TEXT NOT NULL DEFAULT '4-3-3',
    depth_chart JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.squad_depths ENABLE ROW LEVEL SECURITY;

-- Allow anonymous access for demo (matching other tables like matchday_xis)
CREATE POLICY "Enable read access for all users" ON public.squad_depths FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.squad_depths FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.squad_depths FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.squad_depths FOR DELETE USING (true);
