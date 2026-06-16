-- Add contract columns to players table
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS is_contracted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS contract_amount NUMERIC,
ADD COLUMN IF NOT EXISTS contract_frequency TEXT,
ADD COLUMN IF NOT EXISTS contract_start_date DATE,
ADD COLUMN IF NOT EXISTS contract_end_date DATE;

-- Create settings table for budget allowance
CREATE TABLE IF NOT EXISTS public.club_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert a default budget setting if it doesn't exist
INSERT INTO public.club_settings (key, value)
VALUES ('weekly_budget_allowance', '1000'::jsonb)
ON CONFLICT (key) DO NOTHING;
