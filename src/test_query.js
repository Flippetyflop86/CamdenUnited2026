const fs = require('fs');
const path = require('path');
const { createClient } = require("@supabase/supabase-js");

const envPath = path.resolve(__dirname, "../.env.local");
const envContent = fs.readFileSync(envPath, "utf8");
const env = {};
envContent.split("\n").forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value.trim();
    }
});

const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function run() {
    console.log("Querying recruits...");
    const { data, error } = await supabase.from('recruits').select('*');
    console.log("Recruits Data:", data);
    console.log("Recruits Error:", error);

    console.log("Querying players...");
    const { data: pData, error: pError } = await supabase.from('players').select('*');
    console.log("Players Data:", pData);
    console.log("Players Error:", pError);
}

run();
