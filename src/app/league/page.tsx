"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    ExternalLink,
    AlertCircle,
    Trophy,
    Image as ImageIcon,
    CheckCircle2,
    Sparkles,
    Share2,
    Download,
    Copy,
    Plus,
    Trash2,
    RotateCcw,
    Zap,
    ArrowUp,
    ArrowDown,
    X
} from "lucide-react";
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

type SimulatedMatch = {
    id: string;
    homeTeam: string;
    awayTeam: string;
    homeScore: number | "";
    awayScore: number | "";
};

type NextOpponentInfo = {
    opponent: string;
    date: string;
    is_home: boolean;
    competition: string;
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

    // Feature #2: Next Opponent Spotlight
    const [nextOpponentInfo, setNextOpponentInfo] = useState<NextOpponentInfo | null>(null);

    // Feature #5: What-If Matchday Simulator
    const [showSimulator, setShowSimulator] = useState(false);
    const [simMatches, setSimMatches] = useState<SimulatedMatch[]>([]);

    // Feature #7: 1-Click Social Media Standings Graphic Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [graphicFormat, setGraphicFormat] = useState<'story' | 'post'>('post');
    const [graphicScope, setGraphicScope] = useState<'full' | 'top8'>('full');
    const [copiedGraphic, setCopiedGraphic] = useState(false);
    const shareCanvasRef = useRef<HTMLCanvasElement>(null);

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

    const normalizeTeamKey = (name: string): string => {
        return name
            .toLowerCase()
            .replace(/\b(fc|afc|first|1st|reserves|united|utd)\b/g, (m) => (m === 'utd' ? 'united' : m === 'fc' || m === 'afc' || m === 'first' || m === '1st' ? '' : m))
            .replace(/[^a-z0-9]/g, '')
            .trim();
    };

    const isMatchingTeamName = (a: string, b: string): boolean => {
        if (!a || !b) return false;
        const cleanA = a.toLowerCase().trim();
        const cleanB = b.toLowerCase().trim();
        if (cleanA === cleanB) return true;
        const normA = normalizeTeamKey(a);
        const normB = normalizeTeamKey(b);
        if (normA.length >= 4 && normB.length >= 4 && (normA === normB || normA.includes(normB) || normB.includes(normA))) {
            return true;
        }
        return false;
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

    // Fetch upcoming fixture for Feature #2 (Next Opponent Spotlight)
    const loadNextOpponent = async (tableRows?: LeagueRow[] | null) => {
        try {
            const todayStr = new Date().toISOString().split('T')[0];
            let query = supabase
                .from('fixtures')
                .select('id, opponent, date, is_home, status, competition, home_score, away_score')
                .gte('date', todayStr)
                .order('date', { ascending: true });
            if (clubId) query = query.eq('club_id', clubId);
            const { data } = await query;
            if (!data || data.length === 0) return;

            const upcoming = data.filter(f => f.status !== 'completed' && (f.home_score === null || f.away_score === null));
            if (upcoming.length === 0) return;

            const activeRows = tableRows || currentTable || [];
            // Prefer the next opponent that is in our league table, or fallback to the very next upcoming league match
            const nextInTable = upcoming.find(f =>
                activeRows.some(r => !r.is_our_club && isMatchingTeamName(r.team_name, f.opponent))
            );
            const chosen = nextInTable || upcoming[0];
            if (chosen) {
                setNextOpponentInfo({
                    opponent: chosen.opponent,
                    date: chosen.date,
                    is_home: Boolean(chosen.is_home),
                    competition: chosen.competition || "League"
                });
            }
        } catch (e) {}
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

                const ourIdx = updatedRows.findIndex(r => r.is_our_club || isOurClubName(r.team_name));
                const oppIdx = updatedRows.findIndex(r => !r.is_our_club && isMatchingTeamName(r.team_name, match.opponent || ""));

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
        loadNextOpponent(rows);

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
            loadNextOpponent(loadedRows);
            applyNewMatchResultsToTable(loadedRows).then(updated => {
                setCurrentTable(updated);
                loadNextOpponent(updated);
            });
        } else {
            loadNextOpponent(null);
        }

        if (activeUrl && !hasAutoSyncedRef.current && (!hasValidCachedTable || !isCacheFresh)) {
            hasAutoSyncedRef.current = true;
            autoSyncFromUrl(activeUrl, true);
        }
    }, [clubId, settings.leagueUrl, settings.name]);

    // Initialize default simulated match when opening What-If Simulator
    const handleToggleSimulator = () => {
        if (!showSimulator && simMatches.length === 0 && currentTable && currentTable.length >= 2) {
            const ourTeam = currentTable.find(r => r.is_our_club)?.team_name || currentTable[0].team_name;
            const matchedNextOpp = nextOpponentInfo
                ? currentTable.find(r => !r.is_our_club && isMatchingTeamName(r.team_name, nextOpponentInfo.opponent))?.team_name
                : null;
            const defaultOpponent =
                matchedNextOpp ||
                currentTable.find(r => r.team_name !== ourTeam)?.team_name ||
                currentTable[1].team_name;

            const isHome = nextOpponentInfo ? nextOpponentInfo.is_home : true;
            setSimMatches([
                {
                    id: "sim-1",
                    homeTeam: isHome ? ourTeam : defaultOpponent,
                    awayTeam: isHome ? defaultOpponent : ourTeam,
                    homeScore: 2,
                    awayScore: 0
                }
            ]);
        }
        setShowSimulator(!showSimulator);
    };

    const addSimulatedMatch = () => {
        if (!currentTable || currentTable.length < 2) return;
        const usedTeams = new Set(simMatches.flatMap(m => [m.homeTeam, m.awayTeam]));
        const available = currentTable.filter(r => !usedTeams.has(r.team_name));
        const home = available[0]?.team_name || currentTable[0].team_name;
        const away = available[1]?.team_name || currentTable[1].team_name;
        setSimMatches(prev => [
            ...prev,
            {
                id: `sim-${Date.now()}`,
                homeTeam: home,
                awayTeam: away,
                homeScore: 1,
                awayScore: 1
            }
        ]);
    };

    const updateSimMatch = (id: string, patch: Partial<SimulatedMatch>) => {
        setSimMatches(prev => prev.map(m => (m.id === id ? { ...m, ...patch } : m)));
    };

    const removeSimMatch = (id: string) => {
        setSimMatches(prev => prev.filter(m => m.id !== id));
    };

    // Compute live simulated standings + position/points deltas for Feature #5
    const simulatedData = useMemo(() => {
        if (!currentTable) return null;
        if (!showSimulator || simMatches.length === 0) {
            return {
                rows: currentTable.map(r => ({ ...r, posDelta: 0, ptsDelta: 0 })),
                hasActiveSim: false
            };
        }

        const basePosMap = new Map<string, number>();
        const basePtsMap = new Map<string, number>();
        currentTable.forEach(r => {
            basePosMap.set(r.team_name, r.position);
            basePtsMap.set(r.team_name, r.points);
        });

        const working = currentTable.map(r => ({ ...r }));
        let anyApplied = false;

        for (const m of simMatches) {
            if (m.homeScore === "" || m.awayScore === "" || m.homeTeam === m.awayTeam) continue;
            const hs = Number(m.homeScore);
            const as = Number(m.awayScore);
            if (isNaN(hs) || isNaN(as) || hs < 0 || as < 0) continue;

            const hIdx = working.findIndex(r => r.team_name === m.homeTeam);
            const aIdx = working.findIndex(r => r.team_name === m.awayTeam);

            if (hIdx !== -1) {
                const row = working[hIdx];
                row.played += 1;
                row.goals_for = (row.goals_for || 0) + hs;
                row.goals_against = (row.goals_against || 0) + as;
                if (hs > as) {
                    row.won += 1;
                    row.points += 3;
                } else if (hs === as) {
                    row.drawn += 1;
                    row.points += 1;
                } else {
                    row.lost += 1;
                }
                row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                anyApplied = true;
            }

            if (aIdx !== -1) {
                const row = working[aIdx];
                row.played += 1;
                row.goals_for = (row.goals_for || 0) + as;
                row.goals_against = (row.goals_against || 0) + hs;
                if (as > hs) {
                    row.won += 1;
                    row.points += 3;
                } else if (as === hs) {
                    row.drawn += 1;
                    row.points += 1;
                } else {
                    row.lost += 1;
                }
                row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                anyApplied = true;
            }
        }

        const sorted = sortStandings(working);
        return {
            rows: sorted.map(r => ({
                ...r,
                posDelta: (basePosMap.get(r.team_name) || r.position) - r.position,
                ptsDelta: r.points - (basePtsMap.get(r.team_name) ?? r.points)
            })),
            hasActiveSim: anyApplied
        };
    }, [currentTable, showSimulator, simMatches]);

    // Render Social Media Standings Graphic onto HTML5 Canvas (Feature #7)
    useEffect(() => {
        if (!showShareModal || !shareCanvasRef.current || !currentTable || currentTable.length === 0) return;

        const canvas = shareCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rowsToDraw = graphicScope === 'top8' ? currentTable.slice(0, 8) : currentTable;
        const width = 1080;
        const rowHeight = graphicScope === 'top8' ? 76 : Math.max(54, Math.min(68, Math.floor(960 / Math.max(rowsToDraw.length, 1))));
        const headerHeight = 340;
        const tableHeaderHeight = 58;
        const footerHeight = 110;
        const calculatedHeight = headerHeight + tableHeaderHeight + rowsToDraw.length * rowHeight + footerHeight;
        const height = graphicFormat === 'story' ? Math.max(1920, calculatedHeight) : Math.max(1350, calculatedHeight);

        canvas.width = width;
        canvas.height = height;

        const brandHex = settings.primaryColor || "#dc2626";

        const drawGraphic = (logoImg?: HTMLImageElement) => {
            // Deep stadium dark background gradient
            const bgGrad = ctx.createLinearGradient(0, 0, width, height);
            bgGrad.addColorStop(0, "#090d16");
            bgGrad.addColorStop(0.5, "#0f172a");
            bgGrad.addColorStop(1, "#090d16");
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // Top brand glow
            const glowGrad = ctx.createRadialGradient(width * 0.85, 120, 20, width * 0.85, 120, 520);
            glowGrad.addColorStop(0, `${brandHex}44`);
            glowGrad.addColorStop(1, "transparent");
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, width, 600);

            // Top accent bar
            ctx.fillStyle = brandHex;
            ctx.fillRect(0, 0, width, 12);

            const ourRow = currentTable.find(r => r.is_our_club) || currentTable[0];
            const ordinal = (n: number) => {
                const s = ["TH", "ST", "ND", "RD"];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            // Draw Club Logo if available
            let textStartX = 64;
            if (logoImg) {
                const logoSize = 116;
                ctx.save();
                ctx.beginPath();
                ctx.arc(64 + logoSize / 2, 78 + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(logoImg, 64, 78, logoSize, logoSize);
                ctx.restore();
                textStartX = 204;
            }

            // Club Name & Subtitle
            ctx.fillStyle = brandHex;
            ctx.font = "bold 24px Inter, system-ui, sans-serif";
            ctx.fillText((settings.name || "CAMDEN UNITED").toUpperCase(), textStartX, 108);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 58px Inter, system-ui, sans-serif";
            ctx.fillText("LEAGUE STANDINGS", textStartX, 168);

            ctx.fillStyle = "#94a3b8";
            ctx.font = "500 24px Inter, system-ui, sans-serif";
            const dateLabel = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
            ctx.fillText(`2026/27 Season • Updated ${dateLabel}`, textStartX, 206);

            // KPI Summary Strip
            const kpiY = 236;
            const kpis = [
                { label: "POSITION", value: ordinal(ourRow.position) },
                { label: "POINTS", value: `${ourRow.points} PTS` },
                { label: "RECORD", value: `${ourRow.won}W ${ourRow.drawn}D ${ourRow.lost}L` },
                { label: "GOAL DIFF", value: ourRow.goal_difference > 0 ? `+${ourRow.goal_difference}` : `${ourRow.goal_difference}` }
            ];
            const cardW = (width - 128 - 36) / 4;
            kpis.forEach((k, i) => {
                const x = 64 + i * (cardW + 12);
                ctx.fillStyle = i === 0 ? `${brandHex}26` : "rgba(255,255,255,0.04)";
                ctx.strokeStyle = i === 0 ? brandHex : "rgba(255,255,255,0.08)";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x, kpiY, cardW, 76, 14);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "#94a3b8";
                ctx.font = "bold 16px Inter, system-ui, sans-serif";
                ctx.fillText(k.label, x + 20, kpiY + 28);

                ctx.fillStyle = i === 0 ? "#ffffff" : "#f8fafc";
                ctx.font = "900 28px Inter, system-ui, sans-serif";
                ctx.fillText(k.value, x + 20, kpiY + 60);
            });

            // Table Container Header
            const tableTop = headerHeight;
            ctx.fillStyle = "rgba(255,255,255,0.06)";
            ctx.beginPath();
            ctx.roundRect(64, tableTop, width - 128, tableHeaderHeight, [14, 14, 0, 0]);
            ctx.fill();

            ctx.fillStyle = "#94a3b8";
            ctx.font = "bold 20px Inter, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("POS", 110, tableTop + 36);
            ctx.textAlign = "left";
            ctx.fillText("CLUB", 165, tableTop + 36);
            ctx.textAlign = "center";
            const cols = [
                { label: "P", x: 640 },
                { label: "W", x: 705 },
                { label: "D", x: 770 },
                { label: "L", x: 835 },
                { label: "GD", x: 905 },
                { label: "PTS", x: 975 }
            ];
            cols.forEach(c => ctx.fillText(c.label, c.x, tableTop + 36));

            // Table Rows
            rowsToDraw.forEach((row, idx) => {
                const y = tableTop + tableHeaderHeight + idx * rowHeight;
                const isOurs = row.is_our_club;
                const isNextOpp = nextOpponentInfo && !isOurs && isMatchingTeamName(row.team_name, nextOpponentInfo.opponent);

                ctx.fillStyle = isOurs
                    ? `${brandHex}33`
                    : idx % 2 === 0
                        ? "rgba(255,255,255,0.025)"
                        : "rgba(255,255,255,0.01)";
                ctx.fillRect(64, y, width - 128, rowHeight);

                if (isOurs) {
                    ctx.fillStyle = brandHex;
                    ctx.fillRect(64, y, 8, rowHeight);
                } else if (isNextOpp) {
                    ctx.fillStyle = "#f59e0b";
                    ctx.fillRect(64, y, 6, rowHeight);
                }

                // Row bottom border
                ctx.fillStyle = "rgba(255,255,255,0.06)";
                ctx.fillRect(64, y + rowHeight - 1, width - 128, 1);

                const textY = y + rowHeight / 2 + 8;
                ctx.textAlign = "center";
                ctx.fillStyle = isOurs ? "#ffffff" : "#cbd5e1";
                ctx.font = isOurs ? "900 24px Inter, system-ui, sans-serif" : "bold 22px Inter, system-ui, sans-serif";
                ctx.fillText(String(row.position), 110, textY);

                ctx.textAlign = "left";
                ctx.fillStyle = isOurs ? "#ffffff" : "#f1f5f9";
                ctx.font = isOurs ? "900 25px Inter, system-ui, sans-serif" : "600 23px Inter, system-ui, sans-serif";
                const maxClubName = row.team_name.length > 24 ? row.team_name.slice(0, 23) + "…" : row.team_name;
                ctx.fillText(maxClubName, 165, textY);

                if (isNextOpp) {
                    const nameWidth = ctx.measureText(maxClubName).width;
                    const badgeX = Math.min(165 + nameWidth + 14, 510);
                    ctx.fillStyle = "rgba(245, 158, 11, 0.2)";
                    ctx.beginPath();
                    ctx.roundRect(badgeX, y + rowHeight / 2 - 14, 92, 26, 6);
                    ctx.fill();
                    ctx.fillStyle = "#fbbf24";
                    ctx.font = "bold 13px Inter, system-ui, sans-serif";
                    ctx.fillText("NEXT UP", badgeX + 14, y + rowHeight / 2 + 4);
                }

                ctx.textAlign = "center";
                ctx.font = isOurs ? "bold 23px Inter, system-ui, sans-serif" : "500 22px Inter, system-ui, sans-serif";
                ctx.fillStyle = isOurs ? "#ffffff" : "#cbd5e1";
                ctx.fillText(String(row.played), 640, textY);
                ctx.fillText(String(row.won), 705, textY);
                ctx.fillText(String(row.drawn), 770, textY);
                ctx.fillText(String(row.lost), 835, textY);

                const gdStr = row.goal_difference > 0 ? `+${row.goal_difference}` : String(row.goal_difference);
                ctx.fillStyle = row.goal_difference > 0 ? "#34d399" : row.goal_difference < 0 ? "#f87171" : "#94a3b8";
                ctx.fillText(gdStr, 905, textY);

                ctx.fillStyle = "#ffffff";
                ctx.font = "900 25px Inter, system-ui, sans-serif";
                ctx.fillText(String(row.points), 975, textY);
            });

            // Footer Branding
            ctx.textAlign = "between" as any;
            ctx.textAlign = "left";
            ctx.fillStyle = "#64748b";
            ctx.font = "600 20px Inter, system-ui, sans-serif";
            ctx.fillText(`Powered by ClubFlow • ${settings.name || "Camden United"}`, 64, height - 42);
        };

        if (settings.logo) {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => drawGraphic(img);
            img.onerror = () => drawGraphic();
            img.src = settings.logo;
        } else {
            drawGraphic();
        }
    }, [showShareModal, graphicFormat, graphicScope, currentTable, settings.name, settings.primaryColor, settings.logo, nextOpponentInfo]);

    const handleDownloadGraphic = () => {
        if (!shareCanvasRef.current) return;
        const link = document.createElement('a');
        const slug = (settings.name || "club").toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.download = `${slug}-league-standings.png`;
        link.href = shareCanvasRef.current.toDataURL('image/png');
        link.click();
    };

    const handleCopyGraphic = async () => {
        if (!shareCanvasRef.current) return;
        try {
            const blob = await new Promise<Blob | null>(resolve => shareCanvasRef.current?.toBlob(resolve, 'image/png'));
            if (blob && navigator.clipboard && (window as any).ClipboardItem) {
                await navigator.clipboard.write([new (window as any).ClipboardItem({ 'image/png': blob })]);
                setCopiedGraphic(true);
                setTimeout(() => setCopiedGraphic(false), 2500);
            } else {
                handleDownloadGraphic();
            }
        } catch (e) {
            handleDownloadGraphic();
        }
    };

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

    const handleUniversalConnect = async () => {
        const raw = universalInput.trim();
        if (!raw) return;

        setExtractionError(null);

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

        const lines = raw.split(/\r?\n/).filter(Boolean);
        const urlMatch = raw.match(/https?:\/\/[^\s"'<>]+/i);
        if (lines.length === 1 && (urlMatch || /^(www\.|mitoofootball\.com|fulltime\.thefa\.com)/i.test(raw))) {
            const targetUrl = urlMatch ? urlMatch[0] : `https://${raw}`;
            await autoSyncFromUrl(targetUrl, false);
            return;
        }

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
        const displayRows = simulatedData?.rows || currentTable.map(r => ({ ...r, posDelta: 0, ptsDelta: 0 }));
        const ourSimRow = displayRows.find(r => r.is_our_club) || displayRows[0];
        const secondRow = displayRows[1];
        const gapToOther = ourSimRow.position === 1 && secondRow
            ? `${ourSimRow.points - secondRow.points} pts clear of 2nd (${secondRow.team_name})`
            : `${displayRows[0].points - ourSimRow.points} pts off 1st (${displayRows[0].team_name})`;

        return (
            <div className="h-full flex flex-col gap-6">
                <div ref={hiddenFaContainerRef} className="hidden" aria-hidden="true" />

                {/* Top Header & Action Bar */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand/10 rounded-full flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 flex-wrap">
                                <span>League Standings</span>
                                {simulatedData?.hasActiveSim ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-purple-400 border border-purple-500/30">
                                        🔮 What-If Simulation Active
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-500 border border-emerald-500/20">
                                        <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isAutoSyncing ? 'animate-ping' : ''}`} />
                                        {isAutoSyncing ? "Syncing live..." : "Auto-Updating"}
                                    </span>
                                )}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {lastSyncedAt
                                    ? `Automatically synced • Last checked ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                    : "Automatically updates from your league feed and recorded match results"}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {/* Feature #5 Toggle: What-If Matchday Simulator */}
                        <Button
                            variant={showSimulator ? "default" : "outline"}
                            size="sm"
                            onClick={handleToggleSimulator}
                            className={showSimulator ? "bg-purple-600 hover:bg-purple-700 text-white border-purple-500" : "border-purple-500/30 text-purple-400 hover:bg-purple-500/10"}
                        >
                            <Sparkles className="h-4 w-4 mr-1.5" />
                            {showSimulator ? "Hide What-If Simulator" : "What-If Simulator"}
                        </Button>

                        {/* Feature #7 Toggle: Share Social Graphic */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowShareModal(true)}
                            className="border-brand/30 text-brand hover:bg-brand/10"
                        >
                            <Share2 className="h-4 w-4 mr-1.5" />
                            Share Table Graphic
                        </Button>

                        {urlInput && (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isAutoSyncing}
                                onClick={() => autoSyncFromUrl(urlInput, false)}
                            >
                                {isAutoSyncing ? "Syncing..." : "🔄 Refresh"}
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setPreviewData(currentTable)}>
                            Edit
                        </Button>
                        <Button onClick={() => setShowImporter(true)} variant="outline" size="sm">
                            Change League
                        </Button>
                    </div>
                </div>

                {/* Feature #5: Interactive "What-If" Matchday Simulator Drawer */}
                {showSimulator && (
                    <Card className="border-purple-500/30 bg-purple-950/15 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <CardContent className="p-4 sm:p-5 space-y-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
                                <div>
                                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                                        <Sparkles className="h-4 w-4 text-purple-400" />
                                        <span>Matchday &quot;What-If&quot; Simulator</span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        Test upcoming weekend scores below and watch the league table re-sort in real time. Your real table is untouched.
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={addSimulatedMatch}
                                        className="h-8 text-xs"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" /> Add Rival Match
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setSimMatches([]);
                                            setShowSimulator(false);
                                        }}
                                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {simMatches.map((match) => (
                                    <div
                                        key={match.id}
                                        className="flex flex-col sm:flex-row items-center gap-2 sm:gap-3 bg-surface-1/90 border border-border rounded-xl p-2.5"
                                    >
                                        <select
                                            value={match.homeTeam}
                                            onChange={(e) => updateSimMatch(match.id, { homeTeam: e.target.value })}
                                            className="flex-1 w-full sm:w-auto h-9 rounded-lg bg-background border border-border px-2.5 text-xs font-semibold text-foreground"
                                        >
                                            {currentTable.map(t => (
                                                <option key={`h-${t.team_name}`} value={t.team_name}>
                                                    {t.position}. {t.team_name} (H)
                                                </option>
                                            ))}
                                        </select>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Input
                                                type="number"
                                                min={0}
                                                max={20}
                                                value={match.homeScore}
                                                onChange={(e) => updateSimMatch(match.id, { homeScore: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="w-14 h-9 text-center font-bold bg-background"
                                            />
                                            <span className="text-xs font-bold text-muted-foreground">vs</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={20}
                                                value={match.awayScore}
                                                onChange={(e) => updateSimMatch(match.id, { awayScore: e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0) })}
                                                className="w-14 h-9 text-center font-bold bg-background"
                                            />
                                        </div>

                                        <select
                                            value={match.awayTeam}
                                            onChange={(e) => updateSimMatch(match.id, { awayTeam: e.target.value })}
                                            className="flex-1 w-full sm:w-auto h-9 rounded-lg bg-background border border-border px-2.5 text-xs font-semibold text-foreground"
                                        >
                                            {currentTable.map(t => (
                                                <option key={`a-${t.team_name}`} value={t.team_name}>
                                                    {t.position}. {t.team_name} (A)
                                                </option>
                                            ))}
                                        </select>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => updateSimMatch(match.id, { homeScore: 2, awayScore: 0 })}
                                                className="h-7 px-2 text-[11px]"
                                                title="Home Win 2-0"
                                            >
                                                H Win
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => updateSimMatch(match.id, { homeScore: 1, awayScore: 1 })}
                                                className="h-7 px-2 text-[11px]"
                                                title="Draw 1-1"
                                            >
                                                Draw
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => updateSimMatch(match.id, { homeScore: 0, awayScore: 2 })}
                                                className="h-7 px-2 text-[11px]"
                                                title="Away Win 0-2"
                                            >
                                                A Win
                                            </Button>
                                            {simMatches.length > 1 && (
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeSimMatch(match.id)}
                                                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {simulatedData?.hasActiveSim && (
                                <div className="rounded-lg bg-purple-500/10 border border-purple-500/25 px-3.5 py-2.5 flex items-center justify-between flex-wrap gap-2 text-xs">
                                    <span className="font-medium text-purple-200">
                                        🔮 Projected outcome: <strong className="text-white">{ourSimRow.team_name}</strong> sits{" "}
                                        <strong className="text-emerald-400">#{ourSimRow.position}</strong> on{" "}
                                        <strong className="text-white">{ourSimRow.points} pts</strong> ({ourSimRow.goal_difference > 0 ? `+${ourSimRow.goal_difference}` : ourSimRow.goal_difference} GD) — {gapToOther}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Standings Table */}
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
                                    {displayRows.map((row, idx) => {
                                        const isNextOpp =
                                            nextOpponentInfo &&
                                            !row.is_our_club &&
                                            isMatchingTeamName(row.team_name, nextOpponentInfo.opponent);

                                        const formattedNextDate = nextOpponentInfo?.date
                                            ? new Date(nextOpponentInfo.date + "T12:00:00").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                            : "";

                                        return (
                                            <tr
                                                key={idx}
                                                className={`border-b border-border transition-colors ${
                                                    row.is_our_club
                                                        ? 'bg-primary/10 border-l-4 border-l-primary'
                                                        : isNextOpp
                                                            ? 'bg-amber-500/5 border-l-4 border-l-amber-500/80'
                                                            : ''
                                                }`}
                                            >
                                                <td className="px-4 py-3 font-semibold whitespace-nowrap">
                                                    <div className="flex items-center gap-1.5">
                                                        <span>{row.position}</span>
                                                        {row.posDelta > 0 && (
                                                            <span className="inline-flex items-center text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded">
                                                                <ArrowUp className="h-2.5 w-2.5 mr-0.5" />
                                                                {row.posDelta}
                                                            </span>
                                                        )}
                                                        {row.posDelta < 0 && (
                                                            <span className="inline-flex items-center text-[10px] font-bold text-red-400 bg-red-500/15 px-1.5 py-0.5 rounded">
                                                                <ArrowDown className="h-2.5 w-2.5 mr-0.5" />
                                                                {Math.abs(row.posDelta)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className={`px-4 py-3 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span>{row.team_name}</span>
                                                        {/* Feature #2: Next Opponent Spotlight Pill */}
                                                        {isNextOpp && (
                                                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                                                                <Zap className="h-3 w-3 fill-amber-400 text-amber-400" />
                                                                Next Up {formattedNextDate ? `• ${formattedNextDate}` : ""} ({nextOpponentInfo?.is_home ? "H" : "A"})
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-center">{row.played}</td>
                                                <td className="px-4 py-3 text-center">{row.won}</td>
                                                <td className="px-4 py-3 text-center">{row.drawn}</td>
                                                <td className="px-4 py-3 text-center">{row.lost}</td>
                                                <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_for ?? "-"}</td>
                                                <td className="px-4 py-3 text-center text-muted-foreground">{row.goals_against ?? "-"}</td>
                                                <td className="px-4 py-3 text-center font-mono text-xs text-muted-foreground">
                                                    {row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}
                                                </td>
                                                <td className="px-4 py-3 text-center font-bold text-foreground whitespace-nowrap">
                                                    <span>{row.points}</span>
                                                    {row.ptsDelta > 0 && (
                                                        <span className="ml-1.5 text-[10px] font-bold text-emerald-400">
                                                            +{row.ptsDelta}
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Feature #7: 1-Click Social Media "Standings Graphic" Studio Modal */}
                {showShareModal && (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                        <div className="bg-surface-1 border border-border rounded-2xl max-w-2xl w-full p-5 sm:p-6 space-y-4 shadow-2xl my-auto">
                            <div className="flex items-center justify-between border-b border-border pb-3">
                                <div>
                                    <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Share2 className="h-5 w-5 text-brand" />
                                        <span>Share League Table Graphic</span>
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Ready for Instagram Stories, WhatsApp Squad Chats, or X/Twitter.
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setShowShareModal(false)} className="h-8 w-8 p-0">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-lg border border-border">
                                    <button
                                        onClick={() => setGraphicFormat('post')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${graphicFormat === 'post' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Feed Post (4:5)
                                    </button>
                                    <button
                                        onClick={() => setGraphicFormat('story')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${graphicFormat === 'story' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Instagram / WhatsApp Story (9:16)
                                    </button>
                                </div>

                                <div className="flex items-center gap-1.5 bg-surface-2 p-1 rounded-lg border border-border">
                                    <button
                                        onClick={() => setGraphicScope('full')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${graphicScope === 'full' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Full Division ({currentTable.length})
                                    </button>
                                    <button
                                        onClick={() => setGraphicScope('top8')}
                                        className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${graphicScope === 'top8' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Top 8 Spotlight
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/50 border border-border rounded-xl p-3 flex justify-center max-h-[55vh] overflow-y-auto">
                                <canvas
                                    ref={shareCanvasRef}
                                    className="max-w-full h-auto rounded-lg shadow-lg"
                                    style={{ maxHeight: "50vh" }}
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2.5 pt-2">
                                <Button variant="outline" onClick={handleCopyGraphic}>
                                    <Copy className="h-4 w-4 mr-1.5" />
                                    {copiedGraphic ? "Copied to Clipboard!" : "Copy for WhatsApp / Social"}
                                </Button>
                                <Button onClick={handleDownloadGraphic} className="bg-brand hover:bg-brand/90 text-white font-semibold">
                                    <Download className="h-4 w-4 mr-1.5" />
                                    Download PNG
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
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
