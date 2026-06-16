const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://zvwvyfmaklesgjnfdfyu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3Z5Zm1ha2xlc2dqbmZkZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzIzNjcsImV4cCI6MjA4NTYwODM2N30.MIHWWEtV5vSMJcGqysPJqtsZdsBKpqt9rzRnpV2BVLQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const payload = {
        name: "Test Sponsor 3",
        amount: 500,
        frequency: "Monthly",
        description: null,
        website: null,
        start_date: null,
        end_date: null,
        responsibilities: null
    };

    const { data, error } = await supabase.from('sponsors').insert([payload]);
    console.log("Error:", error);
    
    const { data: fetch, error: fetchErr } = await supabase.from('sponsors').select('*');
    console.log("Data:", fetch);
}

test();
