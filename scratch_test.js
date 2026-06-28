const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://zvwvyfmaklesgjnfdfyu.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3Z5Zm1ha2xlc2dqbmZkZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzIzNjcsImV4cCI6MjA4NTYwODM2N30.MIHWWEtV5vSMJcGqysPJqtsZdsBKpqt9rzRnpV2BVLQ';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const players = await supabase.from('players').select('*', { count: 'exact' });
    const matches = await supabase.from('matches').select('*', { count: 'exact' });
    const clubs = await supabase.from('clubs').select('*');
    console.log("PLAYERS COUNT:", players.count, "ERROR:", players.error);
    console.log("MATCHES COUNT:", matches.count, "ERROR:", matches.error);
    console.log("CLUBS:", clubs.data);
}
run();
