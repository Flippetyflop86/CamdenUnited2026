-- Harden Security: Enable Row Level Security (RLS) and set up multi-tenant policies
-- Copy and run this script in your Supabase SQL Editor (https://supabase.com/dashboard)

-- 1. Create a security definer function to lookup the current user's club_id.
-- This function runs with the privileges of the creator (SECURITY DEFINER) to bypass RLS checks on club_members itself.
CREATE OR REPLACE FUNCTION public.get_user_club_id()
RETURNS uuid AS $$
  SELECT club_id FROM public.club_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER SET search_path = public;

-- 2. Enable Row Level Security on all core data tables
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.watcher_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opposition_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matchday_xis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies for Tenant Isolation (club_id matching)

-- Clubs Table
CREATE POLICY "Users can only read their own club settings" ON public.clubs
  FOR SELECT TO authenticated
  USING (id = public.get_user_club_id());

CREATE POLICY "Managers can update their own club settings" ON public.clubs
  FOR UPDATE TO authenticated
  USING (id = public.get_user_club_id());

-- Club Members Table
CREATE POLICY "Members can view other members in their club" ON public.club_members
  FOR SELECT TO authenticated
  USING (club_id = public.get_user_club_id());

CREATE POLICY "Only managers can modify club membership" ON public.club_members
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Players Table
CREATE POLICY "Allow members full access to club players" ON public.players
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Matches Table
CREATE POLICY "Allow members full access to club matches" ON public.matches
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Training Sessions Table
CREATE POLICY "Allow members full access to training sessions" ON public.training_sessions
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Finance Transactions Table
CREATE POLICY "Allow members full access to finance transactions" ON public.finance_transactions
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Sponsors Table
CREATE POLICY "Allow members full access to sponsors" ON public.sponsors
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Subscriptions Table
CREATE POLICY "Allow members full access to subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Inventory Items Table
CREATE POLICY "Allow members full access to inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Documents Table
CREATE POLICY "Allow members full access to documents" ON public.documents
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Watcher Stats Table
CREATE POLICY "Allow members full access to watcher stats" ON public.watcher_stats
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Opposition Teams Table
CREATE POLICY "Allow members full access to opposition reports" ON public.opposition_teams
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Matchday XI Table
CREATE POLICY "Allow members full access to matchday lineups" ON public.matchday_xis
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Recruitment Table (Crucial for sensitive plans)
CREATE POLICY "Allow members full access to recruits" ON public.recruits
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());

-- Staff Table
CREATE POLICY "Allow members full access to staff" ON public.staff
  FOR ALL TO authenticated
  USING (club_id = public.get_user_club_id())
  WITH CHECK (club_id = public.get_user_club_id());
