const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL || 'https://zvwvyfmaklesgjnfdfyu.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp2d3Z5Zm1ha2xlc2dqbmZkZnl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwMzIzNjcsImV4cCI6MjA4NTYwODM2N30.MIHWWEtV5vSMJcGqysPJqtsZdsBKpqt9rzRnpV2BVLQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const payload = {
        first_name: "Test",
        last_name: "Player",
        position: "GK",
        squad_number: 1,
        date_of_birth: "2000-01-01",
        nationality: "English",
        squad: "First Team",
        medical_status: "Available",
        availability: true,
        is_in_training_squad: true,
        is_contracted: false,
        contract_amount: 0,
        contract_frequency: "Weekly"
    };

    const { data, error } = await supabase.from('players').insert([payload]);
    console.log("Error:", error);
}

test();
