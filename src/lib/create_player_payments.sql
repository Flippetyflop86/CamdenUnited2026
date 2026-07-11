-- =======================================================
-- SQL SCRIPT: CREATE STRIPE CONNECT & PAYMENT SYSTEM TABLES
-- =======================================================
-- Copy and paste this script into your Supabase SQL Editor
-- (found in your Supabase dashboard) to apply the payment updates!

-- 1. Add Stripe Connect details to clubs
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_connect_account_id text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_completed boolean DEFAULT false;

-- 2. Create the player payment requests table
CREATE TABLE IF NOT EXISTS player_payment_requests (
  id uuid primary key default uuid_generate_v4(),
  club_id uuid, -- Reference to clubs
  player_id uuid references players(id) on delete cascade,
  amount numeric not null,
  description text not null,
  status text not null default 'Unpaid', -- 'Unpaid', 'Paid'
  stripe_checkout_session_id text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  paid_at timestamp with time zone
);

-- 3. Enable RLS
ALTER TABLE player_payment_requests ENABLE ROW LEVEL SECURITY;

-- 4. Define Policies
CREATE POLICY "Allow anyone to select player_payment_requests" ON player_payment_requests 
    FOR SELECT USING (true);

CREATE POLICY "Allow managers to manage player_payment_requests" ON player_payment_requests 
    FOR ALL TO authenticated 
    USING (true);
