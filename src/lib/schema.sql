-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Players Table
create table players (
  id uuid primary key default uuid_generate_v4(),
  first_name text not null,
  last_name text not null,
  position text not null,
  squad_number integer,
  age integer,
  date_of_birth date,
  nationality text,
  squad text not null, -- 'firstTeam', 'midweek', 'youth'
  medical_status text default 'Available',
  medical_notes text,
  availability boolean default true,
  contract_expiry date,
  image_url text,
  appearances integer default 0,
  goals integer default 0,
  assists integer default 0,
  notes text,
  is_in_training_squad boolean default true
);

-- 2. Matches Table
create table matches (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time text,
  opponent text not null,
  is_home boolean not null,
  competition text,
  scoreline text,
  result text, -- 'Win', 'Loss', 'Draw', 'Pending'
  goalscorers text,
  assists text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Training Sessions
create table training_sessions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  time text not null,
  location text not null,
  topic text,
  squad text not null,
  attendance jsonb default '[]'::jsonb, -- Store array of { playerId, status, notes }
  notes text
);

-- 4. Finance Transactions
create table finance_transactions (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  description text not null,
  amount numeric not null,
  type text not null, -- 'Income', 'Expense'
  category text,
  is_recurring boolean default false,
  frequency text -- 'Weekly', 'Monthly', 'Yearly'
);

-- 5. Finance Users (Simple Role Management)
create table app_users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null, 
  role text not null, -- 'Admin', 'Coach', etc.
  name text,
  password text -- Ideally handled by Supabase Auth, but storing here for legacy sync if needed temporarily
);

-- 6. Sponsors
create table sponsors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  amount numeric,
  frequency text,
  description text,
  website text,
  start_date date,
  end_date date,
  responsibilities text
);

-- 7. Subscriptions
create table subscriptions (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  cost numeric not null,
  frequency text,
  next_payment_date date,
  category text
);

-- 8. Inventory
create table inventory_items (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  quantity integer default 0,
  category text,
  status text default 'Good',
  assigned_to text,
  notes text,
  last_updated timestamp with time zone default timezone('utc'::text, now())
);

-- 9. Documents
create table documents (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  type text not null, -- 'Link', 'PDF', etc.
  url text not null,
  category text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 10. Club Settings (Single Row Pattern)
create table club_settings (
  id integer primary key default 1,
  name text not null default 'My Club',
  logo text,
  primary_color text default '#ef4444',
  check (id = 1) -- Enforce single row
);

-- 11. Watcher Stats
create table watcher_stats (
  id uuid primary key default uuid_generate_v4(),
  match_id text, -- Can link to matches.id if UUID, or keep text if legacy
  stats jsonb not null, -- Store the complex nested stats object
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 12. Opposition Teams
create table opposition_teams (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  formation text,
  notes jsonb, -- Store the structured notes object
  lineup jsonb, -- Store array of strings
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 13. Matchday XI
create table matchday_xis (
  id uuid primary key default uuid_generate_v4(),
  formation text,
  starters jsonb, -- Key-value map of position -> playerId
  substitutes jsonb, -- Array of playerIds
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 14. Recruitment
create table recruits (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  primary_position text,
  secondary_position text,
  age integer,
  location text,
  status text, -- 'Attached', 'Unattached'
  current_club text,
  on_trial boolean default false,
  scouted_role text,
  notes text,
  club_connection text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);
