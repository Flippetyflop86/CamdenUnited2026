const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
    const [key, ...values] = line.split('=');
    if (key && values.length > 0) {
        env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'] || env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    // Get the club ID. Assuming the user has one club.
    const { data: clubs, error: clubError } = await supabase.from('clubs').select('id').limit(1);
    if (clubError || !clubs || clubs.length === 0) {
        console.error("Could not find a club", clubError);
        return;
    }
    const clubId = clubs[0].id;

    const fixtures = [
        { date: '2026-08-15', opponent: 'Hayes & Yeading B Team', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-08-22', opponent: 'Stonewall', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-08-26', opponent: 'Kodak (Harrow)', is_home: true, time: '19:45', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-08-29', opponent: 'Sporting Duet M 1st XI', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-09-05', opponent: 'Kensington Dragons', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-09-12', opponent: 'FH Whistlers', is_home: true, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-09-19', opponent: 'LBS Lions', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-09-26', opponent: 'Explorers', is_home: true, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-10-03', opponent: 'Larkspur Rovers', is_home: false, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
        { date: '2026-10-10', opponent: 'Hayes & Hillingdon', is_home: true, time: '14:00', competition: 'League', result: 'Pending', club_id: clubId },
    ];

    const { error } = await supabase.from('matches').insert(fixtures);
    if (error) {
        console.error("Error inserting fixtures", error);
    } else {
        console.log("Successfully inserted 10 fixtures from screenshot!");
    }
}

main();
