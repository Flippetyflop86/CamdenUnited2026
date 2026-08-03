const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync('.env.local', 'utf8');
envLocal.split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && val.length > 0) {
        process.env[key.trim()] = val.join('=').trim().replace(/['"]/g, '');
    }
});

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
    const { data: clubs, error } = await supabase.from('clubs').select('id, name');
    if (error) console.error("ERR:", error);
    else {
        clubs.forEach(c => {
            console.log(`- ${c.name} | club: ${c.id}`);
        });
    }
}
check();
