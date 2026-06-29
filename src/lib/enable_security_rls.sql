-- =======================================================
-- SQL SCRIPT: ENABLE ROW LEVEL SECURITY & DEFINE POLICIES
-- =======================================================
-- Copy and paste this entire script into your Supabase SQL Editor 
-- (found in your Supabase dashboard) to secure your database tables!

-- 1. Enable RLS on all main tables
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchday_xis ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sponsors ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opposition_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruits ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE club_members ENABLE ROW LEVEL SECURITY;

-- 2. Define Policies for Club Members (Admins/Managers/Coaches)
-- Only registered club members (authenticated users) can edit data.

-- Club Members table: Users can view their own membership status.
CREATE POLICY "Allow members to view status" ON club_members
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Allow admins to manage membership" ON club_members
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Players table
CREATE POLICY "Allow members to view players" ON players
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow managers to write players" ON players
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Matches table
CREATE POLICY "Allow anyone to view matches" ON matches
    FOR SELECT USING (true); -- Public needs to see match details to RSVP

CREATE POLICY "Allow managers to manage matches" ON matches
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Training Sessions table
CREATE POLICY "Allow anyone to view sessions" ON training_sessions
    FOR SELECT USING (true); -- Public needs to see training details to RSVP

CREATE POLICY "Allow managers to manage sessions" ON training_sessions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Matchday XI table
CREATE POLICY "Allow anyone to view lineups" ON matchday_xis
    FOR SELECT USING (true);

CREATE POLICY "Allow managers to manage lineups" ON matchday_xis
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Finance Transactions table
CREATE POLICY "Allow managers to view transactions" ON finance_transactions
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Allow managers to edit transactions" ON finance_transactions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Sponsors table
CREATE POLICY "Allow anyone to view sponsors" ON sponsors
    FOR SELECT USING (true);

CREATE POLICY "Allow managers to manage sponsors" ON sponsors
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Subscriptions table
CREATE POLICY "Allow managers to manage subscriptions" ON subscriptions
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Opposition Teams table
CREATE POLICY "Allow managers to manage opposition data" ON opposition_teams
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Recruits table
CREATE POLICY "Allow managers to manage recruitment" ON recruits
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Staff table
CREATE POLICY "Allow anyone to view staff" ON staff
    FOR SELECT USING (true);

CREATE POLICY "Allow managers to manage staff" ON staff
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );

-- Activity Logs table
CREATE POLICY "Allow anyone to view activities" ON activity_logs
    FOR SELECT USING (true);

CREATE POLICY "Allow anyone to insert checkin logs" ON activity_logs
    FOR INSERT WITH CHECK (true); -- Required for public RSVPs to write activity history

CREATE POLICY "Allow managers to manage activity logs" ON activity_logs
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM club_members 
            WHERE user_id = auth.uid() AND (role = 'Admin' OR role = 'Manager')
        )
    );
