-- Run this in your Supabase SQL Editor to create or fix the training_sessions table
-- This ensures the table exists and has the correct permissions (RLS) enabled.

-- 1. Create the table if it doesn't exist
create table if not exists public.training_sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time text not null,
  location text not null,
  topic text,
  squad text not null,
  attendance jsonb default '[]'::jsonb, -- Store array of { playerId, status, notes }
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Enable Row Level Security (RLS)
alter table public.training_sessions enable row level security;

-- 3. Create policies for public access (Anon)
-- drop policy if exists "Allow public read access" on public.training_sessions;
-- drop policy if exists "Allow public insert access" on public.training_sessions;
-- drop policy if exists "Allow public update access" on public.training_sessions;
-- drop policy if exists "Allow public delete access" on public.training_sessions;

create policy "Allow public read access" on public.training_sessions for select using (true);
create policy "Allow public insert access" on public.training_sessions for insert with check (true);
create policy "Allow public update access" on public.training_sessions for update using (true);
create policy "Allow public delete access" on public.training_sessions for delete using (true);

-- 4. Enable realtime for this table if not already
alter publication supabase_realtime add table training_sessions;
