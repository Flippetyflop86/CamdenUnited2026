CREATE TABLE IF NOT EXISTS public.staff (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    email TEXT,
    is_contracted BOOLEAN DEFAULT false,
    contract_amount NUMERIC,
    contract_frequency TEXT,
    contract_start_date DATE,
    contract_end_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
