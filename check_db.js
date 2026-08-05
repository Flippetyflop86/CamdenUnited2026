const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envContent = fs.readFileSync('.env.local', 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, ...value] = line.split('=');
    if (key && value.length > 0) {
        env[key.trim()] = value.join('=').trim();
    }
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function testQuery() {
    const { data, error } = await supabase.from('players').select('*').eq('club_id', 'undefined');
    console.log("Error for 'undefined':", error);

    const { data2, error2 } = await supabase.from('players').select('*').eq('club_id', 'null');
    console.log("Error for 'null':", error2);
}

testQuery();
