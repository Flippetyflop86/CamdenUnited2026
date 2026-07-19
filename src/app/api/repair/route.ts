import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdminClient() {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error("SUPABASE_SERVICE_ROLE_KEY environment variable is missing on the server.");
    }
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key
    );
}

function findClosingBrace(str: string, openIdx: number) {
    let count = 0;
    for (let i = openIdx; i < str.length; i++) {
        if (str[i] === '{') count++;
        else if (str[i] === '}') {
            count--;
            if (count === 0) return i;
        }
    }
    return -1;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const secret = searchParams.get("secret");
        
        if (secret !== "clubflow_cleanup_2026") {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const supabase = getAdminClient();
        console.log("Fetching matches from Supabase using Service Role Key (RLS Bypassed)...");
        const { data: matches, error } = await supabase.from('matches').select('id, opponent, date, notes');
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        let fixedCount = 0;
        const auditLog: string[] = [];

        for (const match of matches || []) {
            if (!match.notes) continue;

            const rawNotes = match.notes;
            let lineupTag = "";
            let restOfNotes = rawNotes;

            if (rawNotes.includes("[Lineup: ")) {
                const startIdx = rawNotes.indexOf("[Lineup: ");
                const jsonStartIdx = rawNotes.indexOf("{", startIdx);
                
                if (jsonStartIdx !== -1) {
                    const jsonEndIdx = findClosingBrace(rawNotes, jsonStartIdx);
                    if (jsonEndIdx !== -1) {
                        const jsonStr = rawNotes.substring(jsonStartIdx, jsonEndIdx + 1);
                        try {
                            const parsed = JSON.parse(jsonStr);
                            lineupTag = `[Lineup: ${JSON.stringify(parsed)}]\n`;
                        } catch (e) {
                            const formationMatch = jsonStr.match(/"formation"\s*:\s*"([^"]+)"/);
                            const formation = formationMatch ? formationMatch[1] : "4-3-3";
                            
                            const startersMatch = jsonStr.match(/"starters"\s*:\s*(\{.*?\})/);
                            let starters = {};
                            if (startersMatch) {
                                try { starters = JSON.parse(startersMatch[1]); } catch(e) {}
                            }
                            
                            const substitutesMatch = jsonStr.match(/"substitutes"\s*:\s*(\[[^\]]*\])/);
                            let substitutes = [];
                            if (substitutesMatch) {
                                try { substitutes = JSON.parse(substitutesMatch[1]); } catch(e) {}
                            }
                            
                            const parsedFallback = {
                                formation,
                                starters,
                                substitutes,
                                usedSubstitutes: []
                            };
                            lineupTag = `[Lineup: ${JSON.stringify(parsedFallback)}]\n`;
                        }
                        restOfNotes = rawNotes.substring(jsonEndIdx + 2);
                    }
                }
            }

            // Globally clean all residual fragments of "usedSubstitutes" junk from the rest of the notes
            let cleanedRest = restOfNotes;
            cleanedRest = cleanedRest.replace(/(?:,?\s*["']usedSubstitutes["']\s*:\s*\[\]\s*\}\s*\]?\s*)+/g, "");
            cleanedRest = cleanedRest.replace(/^[\]\}\,\s]+/, "").trim();

            const finalNotes = `${lineupTag}${cleanedRest}`.trim();

            if (finalNotes !== rawNotes) {
                const { error: updateErr } = await supabase
                    .from('matches')
                    .update({ notes: finalNotes })
                    .eq('id', match.id);

                if (updateErr) {
                    auditLog.push(`Failed vs ${match.opponent} (${match.date}): ${updateErr.message}`);
                } else {
                    auditLog.push(`Healed vs ${match.opponent} (${match.date})`);
                    fixedCount++;
                }
            }
        }

        return NextResponse.json({ success: true, fixedCount, auditLog });
    } catch (err: any) {
        return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
    }
}
