const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Read env variables
let envContent = '';
try {
    envContent = fs.readFileSync('.env.local', 'utf8');
} catch (e) {
    console.error("Error reading .env.local:", e.message);
    process.exit(1);
}

const lines = envContent.split('\n');
let supabaseUrl = '';
let supabaseAnonKey = '';

for (const line of lines) {
    if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
        supabaseUrl = line.split('=')[1].trim();
    }
    if (line.trim().startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
        supabaseAnonKey = line.split('=')[1].trim();
    }
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("Missing Supabase credentials in env.");
    process.exit(1);
}

console.log("=== ClubFlow Multi-Tenant Penetration Test ===");
console.log("Supabase URL:", supabaseUrl);

async function signUpUser(supabase, email, password, clubName) {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                club_name: clubName
            }
        }
    });
    if (error) {
        if (error.message.includes("Database error saving new user")) {
            console.error(`\n[CRITICAL ERROR] Trigger failed: ${error.message}`);
            console.error("Did you apply the scratch/harden_security.sql migration in the Supabase SQL Editor?");
            console.error("Signup trigger fails until the check constraint is removed or trigger role normalized.\n");
        }
        throw new Error(`Signup failed for ${email}: ${error.message}`);
    }
    return data;
}

async function signInUser(supabase, email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });
    if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);
    return data;
}

async function runPenetrationTest() {
    const emailA = `penetration-club-a-${Date.now()}@clubflow.test`;
    const emailB = `penetration-club-b-${Date.now()}@clubflow.test`;
    const password = 'TestSecurePassword123!';

    const clientAnon = createClient(supabaseUrl, supabaseAnonKey);

    console.log("1. Signing up simulated User A (Club A)...");
    const signUpA = await signUpUser(clientAnon, emailA, password, "Club A");
    const userA = signUpA.user;
    const sessionA = signUpA.session;
    const tokenA = sessionA ? sessionA.access_token : null;

    console.log("2. Signing up simulated User B (Club B)...");
    const signUpB = await signUpUser(clientAnon, emailB, password, "Club B");
    const userB = signUpB.user;
    const sessionB = signUpB.session;
    const tokenB = sessionB ? sessionB.access_token : null;

    // Log in to get tokens if not returned automatically (e.g. if email confirmation is off)
    let tokenA_final = tokenA;
    let tokenB_final = tokenB;

    if (!tokenA_final) {
        console.log("Email confirmation might be enabled. Logging in User A...");
        const loginA = await signInUser(clientAnon, emailA, password);
        tokenA_final = loginA.session.access_token;
    }
    if (!tokenB_final) {
        console.log("Email confirmation might be enabled. Logging in User B...");
        const loginB = await signInUser(clientAnon, emailB, password);
        tokenB_final = loginB.session.access_token;
    }

    // Initialize client instances with token
    const clientA = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${tokenA_final}` } }
    });

    const clientB = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${tokenB_final}` } }
    });

    // Get Club A ID
    const { data: memberA, error: errMemA } = await clientA.from('club_members').select('club_id').single();
    if (errMemA) throw errMemA;
    const clubIdA = memberA.club_id;
    console.log(`Club A resolved ID: ${clubIdA}`);

    // Get Club B ID
    const { data: memberB, error: errMemB } = await clientB.from('club_members').select('club_id').single();
    if (errMemB) throw errMemB;
    const clubIdB = memberB.club_id;
    console.log(`Club B resolved ID: ${clubIdB}`);

    let totalTests = 0;
    let failedTests = 0;

    function assertIsolation(condition, testName) {
        totalTests++;
        if (condition) {
            console.log(`[PASS] ${testName}`);
        } else {
            console.error(`[FAIL] ${testName}`);
            failedTests++;
        }
    }

    console.log("\n--- Commencing Penetration Actions ---");

    // TEST 1: User A creates a player. User B tries to view/modify/delete it.
    console.log("Test Case 1: Player Isolation");
    const { data: playerA, error: playerCreateError } = await clientA.from('players').insert([
        { first_name: 'Penetration', last_name: 'Player', position: 'Midfielder', squad: 'firstTeam' }
    ]).select();

    if (playerCreateError) {
        console.error("User A failed to insert player:", playerCreateError.message);
        process.exit(1);
    }
    const insertedPlayerId = playerA[0].id;

    // Client B tries to read the player
    const { data: readPlayers } = await clientB.from('players').select('*').eq('id', insertedPlayerId);
    assertIsolation(readPlayers.length === 0, "Club B cannot SELECT Club A's players");

    // Client B tries to update the player
    const { data: updatePlayers, error: updateErr } = await clientB.from('players').update({ first_name: 'Hacked' }).eq('id', insertedPlayerId).select();
    assertIsolation(!updatePlayers || updatePlayers.length === 0, "Club B cannot UPDATE Club A's players");

    // Client B tries to delete the player
    const { data: deletePlayers } = await clientB.from('players').delete().eq('id', insertedPlayerId).select();
    assertIsolation(!deletePlayers || deletePlayers.length === 0, "Club B cannot DELETE Club A's players");

    // TEST 2: User B tries to insert player spoofing Club A's club_id
    console.log("\nTest Case 2: Spoofing Club ID on INSERT");
    const { data: spoofedPlayer, error: spoofError } = await clientB.from('players').insert([
        { first_name: 'Spoofed', last_name: 'Player', position: 'Defender', squad: 'firstTeam', club_id: clubIdA }
    ]).select();

    if (spoofedPlayer && spoofedPlayer.length > 0) {
        // Assert that the database trigger mapped it to Club B instead of Club A, or that it failed RLS.
        const insertedClubId = spoofedPlayer[0].club_id;
        assertIsolation(insertedClubId === clubIdB, "Database RLS / trigger forces record to belong to User B's club (Spoof blocked)");
        // Cleanup
        await clientB.from('players').delete().eq('id', spoofedPlayer[0].id);
    } else {
        assertIsolation(spoofError && (spoofError.code === '42501' || spoofError.message.includes('violates')), "Spoof insert blocked by RLS");
    }

    // TEST 3: Check isolation on training sessions (specifically target of previous vulnerability)
    console.log("\nTest Case 3: Training Sessions Isolation (Vulnerability Verification)");
    const { data: trainingA } = await clientA.from('training_sessions').insert([
        { date: '2026-06-22', time: '19:00', location: 'Isolated Pitch', squad: 'firstTeam' }
    ]).select();
    
    if (trainingA && trainingA.length > 0) {
        const { data: readTraining } = await clientB.from('training_sessions').select('*').eq('id', trainingA[0].id);
        assertIsolation(readTraining.length === 0, "Club B cannot SELECT Club A's training sessions");
        // Cleanup
        await clientA.from('training_sessions').delete().eq('id', trainingA[0].id);
    }

    // TEST 4: Check finance transactions isolation
    console.log("\nTest Case 4: Finance Transactions Isolation");
    const { data: financeA } = await clientA.from('finance_transactions').insert([
        { date: '2026-06-22', description: 'Isolation Fee', amount: 100, type: 'Income', category: 'Sponsor' }
    ]).select();

    if (financeA && financeA.length > 0) {
        const { data: readFinance } = await clientB.from('finance_transactions').select('*').eq('id', financeA[0].id);
        assertIsolation(readFinance.length === 0, "Club B cannot SELECT Club A's finance transactions");
        // Cleanup
        await clientA.from('finance_transactions').delete().eq('id', financeA[0].id);
    }

    // Clean up created player
    await clientA.from('players').delete().eq('id', insertedPlayerId);

    console.log(`\n=== Penetration Test Summary ===`);
    console.log(`Passed: ${totalTests - failedTests} / ${totalTests}`);
    if (failedTests > 0) {
        console.error("❌ PENETRATION TEST FAILED: Isolation boundaries are broken!");
        process.exit(1);
    } else {
        console.log("✅ PENETRATION TEST PASSED: Club isolation is fully verified!");
        process.exit(0);
    }
}

runPenetrationTest().catch(e => {
    console.error("Penetration test runtime exception:", e.message);
    process.exit(1);
});
