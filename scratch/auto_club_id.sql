-- ============================================================
-- FINAL TWEAK - AUTOMATIC CLUB ASSIGNMENT
-- ============================================================
-- This makes it so the app code doesn't have to manually pass
-- the club_id every time it saves something. The database will
-- automatically attach your secure club ID to everything you save!

DO $$ 
DECLARE 
    t_name text;
    tables text[] := ARRAY[
        'players', 'matches', 'training_sessions', 'finance_transactions',
        'recruits', 'sponsors', 'subscriptions', 'inventory_items', 
        'documents', 'staff', 'opposition_teams', 'matchday_xis', 
        'watcher_stats', 'club_settings'
    ];
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t_name) THEN
            EXECUTE format('ALTER TABLE %I ALTER COLUMN club_id SET DEFAULT get_my_club_id()', t_name);
        END IF;
    END LOOP;
END $$;

SELECT 'Automation enabled! No frontend code changes needed for inserts.' AS status;
