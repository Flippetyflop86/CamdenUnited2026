const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://zvwvyfmaklesgjnfdfyu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3Z5Zm1ha2xlc2dqbmZkZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzIzNjcsImV4cCI6MjA4NTYwODM2N30.MIHWWEtV5vSMJcGqysPJqtsZdsBKpqt9rzRnpV2BVLQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: player } = await supabase.from('players').select('id').limit(1).single();
    if (!player) {
        console.log("No player found");
        return;
    }
    
    console.log("Updating player:", player.id);
    const { data, error } = await supabase.from('players').update({ 
        is_contracted: false, 
        contract_amount: null, 
        contract_frequency: null, 
        contract_start_date: null, 
        contract_end_date: null 
    }).eq('id', player.id);
    
    console.log("Error:", error);
}

test();
