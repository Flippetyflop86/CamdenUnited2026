"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExternalLink, AlertCircle, Trophy, Image as ImageIcon, CheckCircle2, Sparkles } from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";

type LeagueRow = {
    position: number;
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    is_our_club: boolean;
};

export default function LeagueTablePage() {
    const { settings, updateSettings } = useClub();
    const { clubId } = useAuth();

    const [universalInput, setUniversalInput] = useState("");
    const [urlInput, setUrlInput] = useState("");
    const [faLrCode, setFaLrCode] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const hiddenFaContainerRef = useRef<HTMLDivElement>(null);

    const [isExtracting, setIsExtracting] = useState(false);
    const [isAutoSyncing, setIsAutoSyncing] = useState(false);
    const [extractionStatus, setExtractionStatus] = useState("");
    const [extractionError, setExtractionError] = useState<{ title: string; message: string } | null>(null);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

    const [previewData, setPreviewData] = useState<LeagueRow[] | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const [currentTable, setCurrentTable] = useState<LeagueRow[] | null>(null);
    const [showImporter, setShowImporter] = useState(false);
    const hasAutoSyncedRef = useRef(false);

    const storageKey = clubId ? `clubflow_league_table_${clubId}` : "clubflow_league_table";
    const syncTimestampKey = `${storageKey}_synced_at`;
    const appliedFixturesKey = `${storageKey}_applied_fixtures`;
    const faLrCodeKey = `${storageKey}_fa_lrcode`;

    const isOurClubName = (teamName: string): boolean => {
        const clubLower = (settings.name || "Camden United").toLowerCase().trim();
        const clubCore = clubLower.replace(/\bfc\b/g, "").trim();
        const candidate = teamName.toLowerCase().trim();
        if (candidate === clubLower) return true;
        if (clubCore.length >= 4 && candidate === clubCore) return true;
        return candidate.includes(clubLower);
    };

    const sortStandings = (rows: LeagueRow[]): LeagueRow[] => {
        const copy = [...rows].map(r => ({
            ...r,
            goal_difference: (r.goals_for || 0) - (r.goals_against || 0),
            is_our_club: r.is_our_club || isOurClubName(r.team_name)
        }));
        copy.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.goal_difference !== a.goal_difference) return b.goal_difference - a.goal_difference;
            if ((b.goals_for || 0) !== (a.goals_for || 0)) return (b.goals_for || 0) - (a.goals_for || 0);
            return a.team_name.localeCompare(b.team_name);
        });
        return copy.map((r, idx) => ({ ...r, position: idx + 1 }));
    };

    // Snapshot all currently completed League fixture IDs as baseline when a fresh table is imported/synced
    const snapshotBaselineFixtures = async () => {
        try {
            let query = supabase
                .from('fixtures')
                .select('id, status, competition, home_score, away_score')
                .eq('status', 'completed');
            if (clubId) query = query.eq('club_id', clubId);
            const { data } = await query;
            if (data) {
                const ids = data
                    .filter(f => f.home_score !== null && f.away_score !== null)
                    .map(f => String(f.id));
                localStorage.setItem(appliedFixturesKey, JSON.stringify(ids));
            }
        } catch (e) {}
    };

    // Automatically apply any newly completed League match results from /matches onto the saved standings
    const applyNewMatchResultsToTable = async (baseTable: LeagueRow[]): Promise<LeagueRow[]> => {
        if (!baseTable || baseTable.length === 0) return baseTable;
        try {
            let query = supabase
                .from('fixtures')
                .select('id, opponent, is_home, home_score, away_score, status, competition')
                .eq('status', 'completed');
            if (clubId) query = query.eq('club_id', clubId);
            const { data: completed } = await query;
            if (!completed || completed.length === 0) return baseTable;

            const savedIdsRaw = localStorage.getItem(appliedFixturesKey);
            // If no baseline exists yet, initialize baseline with current completed fixtures so we don't double-count
            if (!savedIdsRaw) {
                const initialIds = completed
                    .filter(f => f.home_score !== null && f.away_score !== null)
                    .map(f => String(f.id));
                localStorage.setItem(appliedFixturesKey, JSON.stringify(initialIds));
                return baseTable;
            }

            const appliedSet = new Set<string>(JSON.parse(savedIdsRaw));
            let modified = false;
            const updatedRows = baseTable.map(r => ({ ...r }));

            for (const match of completed) {
                const matchId = String(match.id);
                if (appliedSet.has(matchId)) continue;
                if (match.home_score === null || match.away_score === null) continue;

                const comp = (match.competition || "League").toLowerCase();
                if (comp.includes("cup") || comp.includes("trophy") || comp.includes("shield") || comp.includes("friendly")) {
                    appliedSet.add(matchId);
                    continue;
                }

                const ourGoals = match.is_home ? Number(match.home_score) : Number(match.away_score);
                const oppGoals = match.is_home ? Number(match.away_score) : Number(match.home_score);
                const oppNameLower = (match.opponent || "").toLowerCase().trim();

                const ourIdx = updatedRows.findIndex(r => r.is_our_club || isOurClubName(r.team_name));
                const oppIdx = updatedRows.findIndex(r => {
                    const t = r.team_name.toLowerCase().trim();
                    return t === oppNameLower || (oppNameLower.length >= 4 && (t.includes(oppNameLower) || oppNameLower.includes(t)));
                });

                if (ourIdx !== -1) {
                    const row = updatedRows[ourIdx];
                    row.played += 1;
                    row.goals_for = (row.goals_for || 0) + ourGoals;
                    row.goals_against = (row.goals_against || 0) + oppGoals;
                    if (ourGoals > oppGoals) {
                        row.won += 1;
                        row.points += 3;
                    } else if (ourGoals === oppGoals) {
                        row.drawn += 1;
                        row.points += 1;
                    } else {
                        row.lost += 1;
                    }
                    row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                    modified = true;
                }

                if (oppIdx !== -1 && oppIdx !== ourIdx) {
                    const row = updatedRows[oppIdx];
                    row.played += 1;
                    row.goals_for = (row.goals_for || 0) + oppGoals;
                    row.goals_against = (row.goals_against || 0) + ourGoals;
                    if (oppGoals > ourGoals) {
                        row.won += 1;
                        row.points += 3;
                    } else if (oppGoals === ourGoals) {
                        row.drawn += 1;
                        row.points += 1;
                    } else {
                        row.lost += 1;
                    }
                    row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                    modified = true;
                }

                appliedSet.add(matchId);
            }

            localStorage.setItem(appliedFixturesKey, JSON.stringify(Array.from(appliedSet)));

            if (modified) {
                const sorted = sortStandings(updatedRows);
                localStorage.setItem(storageKey, JSON.stringify(sorted));
                const ourRow = sorted.find(r => r.is_our_club);
                if (ourRow && ourRow.position !== settings.leaguePosition) {
                    updateSettings({ leaguePosition: ourRow.position }).catch(() => {});
                }
                return sorted;
            }
        } catch (e) {
            console.warn("Auto-standings match calculation skipped:", e);
        }
        return baseTable;
    };

    const persistStandingsDirectly = async (rows: LeagueRow[], connectedUrl?: string) => {
        const nowIso = new Date().toISOString();
        setCurrentTable(rows);
        setLastSyncedAt(nowIso);
        try {
            localStorage.setItem(storageKey, JSON.stringify(rows));
            localStorage.setItem(syncTimestampKey, nowIso);
        } catch (e) {}

        await snapshotBaselineFixtures();

        const ourRow = rows.find(r => r.is_our_club || isOurClubName(r.team_name));
        const newUpdates: any = {
            lastImportHistory: {
                ...(settings.lastImportHistory || {}),
                leagueTable: rows,
                updatedAt: nowIso
            }
        };
        if (ourRow && ourRow.position) {
            newUpdates.leaguePosition = ourRow.position;
        }
        if (connectedUrl) {
            newUpdates.leagueUrl = connectedUrl;
        }
        updateSettings(newUpdates).catch(() => {});

        // Ensure opponent teams exist in league_teams for fixture autocomplete
        for (const row of rows) {
            if (!row.team_name || isOurClubName(row.team_name)) continue;
            supabase
                .from('league_teams')
                .select('id')
                .ilike('name', row.team_name.trim())
                .maybeSingle()
                .then(({ data: existing }) => {
                    if (!existing) {
                        supabase.from('league_teams').insert({
                            name: row.team_name.trim(),
                            club_id: clubId || undefined
                        }).then(() => {});
                    }
                });
        }
    };

    // Auto-sync live league table from URL
    const autoSyncFromUrl = async (targetUrl: string, silent = true): Promise<boolean> => {
        if (!targetUrl) return false;
        if (silent) setIsAutoSyncing(true);
        else {
            setIsExtracting(true);
            setExtractionError(null);
            setExtractionStatus("Connecting to your league and syncing live standings...");
        }

        try {
            const res = await fetch('/api/sync-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl, clubName: settings.name || "Camden United", clubId })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.teams) && data.teams.length > 0) {
                const resolved = data.resolvedUrl || targetUrl;
                setUrlInput(resolved);
                await persistStandingsDirectly(data.teams, resolved);
                setShowImporter(false);
                return true;
            } else if (!silent) {
                if (data.errorType === 'RATE_LIMITED') {
                    setExtractionError({
                        title: "Daily sync limit reached (10/day)",
                        message: data.error || "You have reached the maximum of 10 live syncs per 24 hours."
                    });
                } else {
                    setExtractionError({
                        title: "Paste your league table rows once into the box below",
                        message: "This website requires a one-time table paste. Once pasted, ClubFlow will automatically keep your standings updated as match results come in."
                    });
                }
            }
        } catch (err) {
            if (!silent) {
                setExtractionError({
                    title: "Connection error",
                    message: "Could not reach the league website. You can paste your league table rows directly into the box below."
                });
            }
        } finally {
            setIsAutoSyncing(false);
            setIsExtracting(false);
            setExtractionStatus("");
        }
        return false;
    };

    // Silent background FA lrcode script loader (if user pasted an FA code)
    useEffect(() => {
        if (!faLrCode || !hiddenFaContainerRef.current) return;
        const container = hiddenFaContainerRef.current;
        container.innerHTML = `<div id="lrep${faLrCode}"></div>`;
        (window as any).lrcode = faLrCode;

        const script = document.createElement('script');
        script.src = 'https://fulltime.thefa.com/client/api/js/cs1.js';
        script.async = true;
        container.appendChild(script);

        const observer = new MutationObserver(() => {
            const tableEl = container.querySelector('table');
            if (tableEl) {
                const text = tableEl.innerText || tableEl.textContent || "";
                const parsed = parseLeagueStandingsText(text);
                if (parsed.length > 0) {
                    persistStandingsDirectly(parsed);
                    observer.disconnect();
                }
            }
        });
        observer.observe(container, { childList: true, subtree: true });
        return () => observer.disconnect();
    }, [faLrCode]);

    // Load saved league table, apply any new match results, and auto-sync if cache is >6h old
    useEffect(() => {
        const defaultMitooUrl = (settings.name || "").toLowerCase().includes("camden")
            ? "https://mitoofootball.com/LeagueTab.cfm?TblName=Matches&DivisionID=64&LeagueCode=MDX2026"
            : "";
        const activeUrl = settings.leagueUrl || defaultMitooUrl;

        if (activeUrl && !urlInput) {
            setUrlInput(activeUrl);
            if (!universalInput) setUniversalInput(activeUrl);
        }

        let hasValidCachedTable = false;
        let isCacheFresh = false;
        let loadedRows: LeagueRow[] | null = null;

        try {
            const savedLr = localStorage.getItem(faLrCodeKey);
            if (savedLr) setFaLrCode(savedLr);

            const saved = localStorage.getItem(storageKey);
            const savedAt = localStorage.getItem(syncTimestampKey);
            if (savedAt) {
                setLastSyncedAt(savedAt);
                const ageMs = Date.now() - new Date(savedAt).getTime();
                if (ageMs < 6 * 60 * 60 * 1000) {
                    isCacheFresh = true;
                }
            }
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    loadedRows = parsed;
                    hasValidCachedTable = true;
                }
            } else if (
                settings.lastImportHistory?.leagueTable &&
                Array.isArray(settings.lastImportHistory.leagueTable) &&
                settings.lastImportHistory.leagueTable.length > 0
            ) {
                loadedRows = settings.lastImportHistory.leagueTable;
                hasValidCachedTable = true;
            }
        } catch (e) {
            console.warn("Failed to load cached league table:", e);
        }

        if (loadedRows) {
            setCurrentTable(loadedRows);
            // Automatically apply any new completed League fixtures from /matches
            applyNewMatchResultsToTable(loadedRows).then(updated => {
                setCurrentTable(updated);
            });
        }

        if (activeUrl && !hasAutoSyncedRef.current && (!hasValidCachedTable || !isCacheFresh)) {
            hasAutoSyncedRef.current = true;
            autoSyncFromUrl(activeUrl, true);
        }
    }, [clubId, settings.leagueUrl, settings.name]);

    const parseLeagueStandingsText = (raw: string): LeagueRow[] => {
        const lines = raw
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean);

        const rows: LeagueRow[] = [];

        for (const line of lines) {
            if (/^(pos|position|rank|#)?\s*(team|club|played|p\s+w\s+d\s+l|overall|home|away)\b/i.test(line) && !/\d+\s+\d+\s+\d+/.test(line)) {
                continue;
            }
            if (/^(fa full-time|premier division|division\s+\d+|standings|table|key|legend|last updated)/i.test(line) && !/\d+\s+\d+\s+\d+/.test(line)) {
                continue;
            }

            const tokens = line.split(/\t+|\s{2,}|\s+/).filter(Boolean);
            if (tokens.length < 5) continue;

            const nums: number[] = [];
            let idx = tokens.length - 1;
            while (idx >= 0) {
                const tok = tokens[idx].replace(/^\+/, '');
                if (/^\d+[\-:]\d+$/.test(tok)) {
                    const [f, a] = tok.split(/[\-:]/).map(Number);
                    nums.unshift(f, a);
                    idx--;
                    continue;
                }
                if (/^-?\d+$/.test(tok)) {
                    nums.unshift(parseInt(tok, 10));
                    idx--;
                } else {
                    if (nums.length === 0 && /^[WDL\-]{1,6}$/i.test(tok)) {
                        idx--;
                        continue;
                    }
                    break;
                }
            }

            if (nums.length < 4) continue;

            const leftTokens = tokens.slice(0, idx + 1);
            let position = rows.length + 1;
            let nameTokens = leftTokens;

            if (leftTokens.length > 1 && /^\d+\.?$/.test(leftTokens[0])) {
                position = parseInt(leftTokens[0], 10);
                nameTokens = leftTokens.slice(1);
            } else if (leftTokens.length === 0 && nums.length >= 7) {
                continue;
            }

            const teamName = nameTokens
                .join(" ")
                .replace(/^[\-\d\.\)]+\s*/, "")
                .trim();

            if (!teamName || teamName.length < 2 || /^(total|overall|home|away|pos|team|club|p|w|d|l|pts)$/i.test(teamName)) {
                continue;
            }

            let played = 0, won = 0, drawn = 0, lost = 0, goals_for = 0, goals_against = 0, goal_difference = 0, points = 0;

            if (nums.length >= 13) {
                const slice = nums.slice(-13);
                played = slice[0];
                won = slice[1] + slice[6];
                drawn = slice[2] + slice[7];
                lost = slice[3] + slice[8];
                goals_for = slice[4] + slice[9];
                goals_against = slice[5] + slice[10];
                goal_difference = slice[11];
                points = slice[12];
            } else if (nums.length === 11) {
                played = nums[0];
                won = nums[1] + nums[4];
                drawn = nums[2] + nums[5];
                lost = nums[3] + nums[6];
                goals_for = nums[7];
                goals_against = nums[8];
                goal_difference = nums[9];
                points = nums[10];
            } else if (nums.length >= 8) {
                const slice = nums.slice(0, 8);
                played = slice[0];
                won = slice[1];
                drawn = slice[2];
                lost = slice[3];
                goals_for = slice[4];
                goals_against = slice[5];
                goal_difference = slice[6];
                points = slice[7];
            } else if (nums.length === 7) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3];
                goals_for = nums[4];
                goals_against = nums[5];
                goal_difference = goals_for - goals_against;
                points = nums[6];
            } else if (nums.length === 6) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3];
                goal_difference = nums[4];
                points = nums[5];
            } else if (nums.length >= 4) {
                played = nums[0];
                won = nums[1];
                drawn = nums[2];
                lost = nums[3] ?? 0;
                points = nums[nums.length - 1];
            }

            rows.push({
                position: position || rows.length + 1,
                team_name: teamName,
                played,
                won,
                drawn,
                lost,
                goals_for,
                goals_against,
                goal_difference,
                points,
                is_our_club: isOurClubName(teamName)
            });
        }

        return rows.map((r, i) => ({
            ...r,
            position: r.position || i + 1
        }));
    };

    // Unified 1-click handler: detects URL vs FA code vs pasted table rows automatically
    const handleUniversalConnect = async () => {
        const raw = universalInput.trim();
        if (!raw) return;

        setExtractionError(null);

        // 1. Check if user pasted an FA code (lrcode / lrep)
        const lrMatch = raw.match(/lrcode\s*=\s*['"]?(\d+)['"]?/i) || raw.match(/lrep(\d+)/i);
        if (lrMatch && lrMatch[1]) {
            const code = lrMatch[1];
            localStorage.setItem(faLrCodeKey, code);
            setFaLrCode(code);
            setIsExtracting(true);
            setExtractionStatus("Connecting live league feed...");
            setTimeout(() => {
                setIsExtracting(false);
                setExtractionStatus("");
                setShowImporter(false);
            }, 1500);
            return;
        }

        // 2. Check if user pasted a URL (single line starting with http or www)
        const lines = raw.split(/\r?\n/).filter(Boolean);
        const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
        if (lines.length === 1 && (urlMatch || /^(www\.|mitoofootball\.com|fulltime\.thefa\.com)/i.test(raw))) {
            const targetUrl = urlMatch ? urlMatch[0] : `https://${raw}`;
            await autoSyncFromUrl(targetUrl, false);
            return;
        }

        // 3. Otherwise, treat as pasted league table text and save immediately in 1 step
        setIsExtracting(true);
        setExtractionStatus("Setting up your automatic league table...");
        const parsed = parseLeagueStandingsText(raw);
        setIsExtracting(false);
        setExtractionStatus("");

        if (parsed.length > 0) {
            await persistStandingsDirectly(parsed);
            setShowImporter(false);
            return;
        }

        // 4. If text contained a URL inside multiple lines, try the URL
        if (urlMatch) {
            await autoSyncFromUrl(urlMatch[0], false);
            return;
        }

        setExtractionError({
            title: "Couldn't recognise that input",
            message: "Paste your league website link (e.g. Mitoo or FA Full-Time) or copy and paste the rows from your league table."
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            loadImage(file);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.startsWith('image/')) {
                const file = items[i].getAsFile();
                if (file) loadImage(file);
                break;
            }
        }
    };

    const processScreenshot = async (base64Image: string) => {
        setIsExtracting(true);
        setExtractionError(null);
        setExtractionStatus("Reading league screenshot...");

        try {
            const res = await fetch('/api/parse-league', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: base64Image, clubName: settings.name, clubId })
            });

            const data = await res.json();
            if (!data.success || !Array.isArray(data.teams) || data.teams.length === 0) {
                setExtractionError({
                    title: "Extraction failed",
                    message: data.error || "Could not read the screenshot clearly. Try pasting the league link or table text instead."
                });
            } else {
                await persistStandingsDirectly(data.teams);
                setShowImporter(false);
            }
        } catch (error) {
            setExtractionError({
                title: "Network error",
                message: "Could not reach the extraction service."
            });
        } finally {
            setIsExtracting(false);
            setExtractionStatus("");
        }
    };

    const loadImage = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (e.target?.result) {
                processScreenshot(e.target.result as string);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleRowChange = (index: number, field: keyof LeagueRow, value: any) => {
        if (!previewData) return;
        const newData = [...previewData];
        // @ts-ignore
        newData[index][field] = value;
        if (field === 'team_name') {
            newData[index].is_our_club = isOurClubName(String(value));
        }

        if (['won', 'drawn', 'lost', 'goals_for', 'goals_against'].includes(field)) {
            const row = newData[index];
            if (field === 'goals_for' || field === 'goals_against') {
                row.goal_difference = row.goals_for - row.goals_against;
            }
            if (field === 'won' || field === 'drawn') {
                row.points = (row.won * 3) + row.drawn;
            }
        }

        setPreviewData(newData);
    };

    const handleConfirmImport = async () => {
        if (!previewData || previewData.length === 0) return;
        setIsImporting(true);
        try {
            await persistStandingsDirectly(previewData, urlInput || undefined);
            setPreviewData(null);
            setShowImporter(false);
            setIsSuccess(true);
        } catch (error) {
            console.error(error);
        } finally {
            setIsImporting(false);
        }
    };

    // Review Screen (if user manually edits table)
    if (previewData) {
        return (
            <div className="h-full flex flex-col gap-6 max-w-4xl mx-auto py-8">
                <div>
                    <h2 className="text-2xl font-bold text-foreground">Edit League Standings</h2>
                    <p className="text-muted-foreground mt-1">Adjust any row below and click Save.</p>
                </div>

                <Card className="border-border bg-surface-1">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Pos</th>
                                        <th className="px-4 py-3 font-medium">Club</th>
                                        <th className="px-4 py-3 font-medium text-center">P</th>
                                        <th className="px-4 py-3 font-medium text-center">W</th>
                                        <th className="px-4 py-3 font-medium text-center">D</th>
                                        <th className="px-4 py-3 font-medium text-center">L</th>
                                        <th className="px-4 py-3 font-medium text-center">GF</th>
                                        <th className="px-4 py-3 font-medium text-center">GA</th>
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {previewData.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.position} onChange={(e) => handleRowChange(idx, 'position', parseInt(e.target.value) || 0)} className="w-14 h-8 px-1 text-center font-semibold bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className={`px-2 py-2 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                <Input type="text" value={row.team_name} onChange={(e) => handleRowChange(idx, 'team_name', e.target.value)} className="h-8 px-2 bg-transparent border-transparent hover:border-border focus:bg-background w-full min-w-[160px]" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.played} onChange={(e) => handleRowChange(idx, 'played', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.won} onChange={(e) => handleRowChange(idx, 'won', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.drawn} onChange={(e) => handleRowChange(idx, 'drawn', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.lost} onChange={(e) => handleRowChange(idx, 'lost', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.goals_for} onChange={(e) => handleRowChange(idx, 'goals_for', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.goals_against} onChange={(e) => handleRowChange(idx, 'goals_against', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                            <td className="px-2 py-2 text-center text-muted-foreground font-mono text-xs">{row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}</td>
                                            <td className="px-2 py-2">
                                                <Input type="number" value={row.points} onChange={(e) => handleRowChange(idx, 'points', parseInt(e.target.value) || 0)} className="w-12 h-8 px-1 text-center font-bold text-foreground bg-transparent border-transparent hover:border-border focus:bg-background" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium text-muted-foreground">{previewData.length} teams</span>
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setPreviewData(null)} disabled={isImporting}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmImport} className="bg-brand hover:bg-brand/90 text-white" disabled={isImporting}>
                            {isImporting ? "Saving..." : "Save League Table"}
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (isSuccess) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-4 py-20 max-w-md mx-auto text-center">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">League table connected</h2>
                <p className="text-muted-foreground">Your standings will now stay updated automatically across ClubFlow.</p>
                <div className="flex gap-3 mt-4 w-full">
                    <Button className="flex-1 bg-brand hover:bg-brand/90 text-white" onClick={() => { setIsSuccess(false); setShowImporter(false); }}>View Standings</Button>
                </div>
            </div>
        );
    }

    // Main Live Standings Table View
    if (currentTable && currentTable.length > 0 && !showImporter) {
        return (
            <div className="h-full flex flex-col gap-6">
                <div ref={hiddenFaContainerRef} className="hidden" aria-hidden="true" />
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand/10 rounded-full flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                                <span>League Standings</span>
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                                    <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isAutoSyncing ? 'animate-ping' : ''}`} />
                                    {isAutoSyncing ? "Syncing live..." : "Auto-Updating"}
                                </span>
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {lastSyncedAt
                                    ? `Automatically synced • Last checked ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                    : "Automatically updates from your league feed and recorded match results"}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {urlInput && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isAutoSyncing}
                                onClick={() => autoSyncFromUrl(urlInput, false)}
                            >
                                {isAutoSyncing ? "Syncing..." : "🔄 Refresh Now"}
                            </Button>
                        )}
                        {urlInput && (
                            <Button variant="outline" size="sm" onClick={() => window.open(urlInput, '_blank')}>
                                <ExternalLink className="h-4 w-4 mr-1.5" /> League Page
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setPreviewData(currentTable)}>
                            Edit Rows
                        </Button>
                        <Button onClick={() => setShowImporter(true)} className="bg-brand hover:bg-brand/90 text-white" size="sm">
                            Change League
                        </Button>
                    </div>
                </div>

                <Card className="border-border bg-surface-1">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border">
                                    <tr>
                                        <th className="px-4 py-3 font-medium">Pos</th>
                                        <th className="px-4 py-3 font-medium">Club</th>
                                        <th className="px-4 py-3 font-medium text-center">P</th>
                                        <th className="px-4 py-3 font-medium text-center">W</th>
                                        <th className="px-4 py-3 font-medium text-center">D</th>
                                        <th className="px-4 py-3 font-medium text-center">L</th>
                                        <th className="px-4 py-3 font-medium text-center">GF</th>
                                        <th className="px-4 py-3 font-medium text-center">GA</th>
                                        <th className="px-4 py-3 font-medium text-center">GD</th>
                                        <th className="px-4 py-3 font-medium text-center">Pts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentTable.map((row, idx) => (
                                        <tr key={idx} className={`border-b border-border transition-colors ${row.is_our_club ? 'bg-primary/10 border-l-4 border-l-primary' : ''}`}>
                                            <td className="px-4 py-3 font-semibold">{row.position}</td>
                                            <td className={`px-4 py-3 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                {row.team_name}
                                            </td>
                                            <td className="px-4 py-3 text-center">{row.played}</td>
                                            <td className="px-4 py-3 text-center">{row.won}</td>
                                            <td className="px-4 py-3 text-center">{row.drawn}</td>
                                            <td className="px-4 py-3 text-center">{row.lost}</td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_for ?? "-"}</td>
                                            <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_against ?? "-"}</td>
                                            <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">{row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}</td>
                                            <td className="px-4 py-3 text-center font-bold text-foreground">{row.points}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // One-Step "Paste Your League Once" Setup View
    return (
        <div
            className="h-full flex flex-col gap-6 max-w-2xl mx-auto py-12"
            onPaste={handlePaste}
        >
            <div ref={hiddenFaContainerRef} className="hidden" aria-hidden="true" />
            <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
            />

            <div className="text-center mb-2">
                <div className="mx-auto h-16 w-16 bg-brand/10 rounded-full flex items-center justify-center mb-4">
                    <Trophy className="h-8 w-8 text-brand" />
                </div>
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Set Up Your League Once</h2>
                <p className="text-muted-foreground mt-2 text-sm sm:text-base max-w-lg mx-auto">
                    Paste your league website link or copy-paste your league table once below. ClubFlow will automatically keep your standings and league position updated from then on.
                </p>
                {currentTable && currentTable.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setShowImporter(false)} className="mt-2 text-xs text-muted-foreground">
                        ← Back to Standings
                    </Button>
                )}
            </div>

            {extractionError && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                    <div>
                        <h4 className="font-semibold text-amber-500 text-sm">{extractionError.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{extractionError.message}</p>
                    </div>
                </div>
            )}

            <Card className="border-border bg-surface-1 shadow-sm">
                <CardContent className="p-6 space-y-4">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Label htmlFor="universal-league-input" className="text-sm font-semibold flex items-center gap-1.5">
                            <Sparkles className="h-4 w-4 text-brand" />
                            League Website Link or League Table
                        </Label>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-7 text-xs"
                            disabled={isExtracting}
                        >
                            <ImageIcon className="h-3.5 w-3.5 mr-1.5" /> Or Upload Screenshot
                        </Button>
                    </div>

                    <Textarea
                        id="universal-league-input"
                        placeholder={
                            "Paste your league link (Mitoo, FA Full-Time, Pitchero) OR paste your league table rows once:\n\nhttps://fulltime.thefa.com/...\nor\n1   Camden United   11   8   2   0   45   8   +37   26"
                        }
                        value={universalInput}
                        onChange={(e) => setUniversalInput(e.target.value)}
                        className="min-h-[150px] bg-background font-mono text-xs"
                    />

                    <p className="text-xs text-muted-foreground">
                        Works with any league (FA Full-Time, Football Mitoo, Pitchero, or copied standings). Once connected, ClubFlow automatically updates your table and points as matches are played.
                    </p>

                    <Button
                        onClick={handleUniversalConnect}
                        className="w-full bg-brand hover:bg-brand/90 text-white font-semibold h-11"
                        disabled={!universalInput.trim() || isExtracting}
                    >
                        {isExtracting ? extractionStatus || "Connecting League..." : "Connect League (One-Time Setup)"}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
