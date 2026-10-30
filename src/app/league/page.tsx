"use client";

import React, { useState, useEffect, useRef } from "react";
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
    Zap,
    ArrowUp,
    ArrowDown,
    Minus,
    X
} from "lucide-react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";

type FormResult = 'W' | 'D' | 'L';

type LeagueRow = {
    position: number;
    previous_position?: number;
    team_name: string;
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goals_for: number;
    goals_against: number;
    goal_difference: number;
    points: number;
    form?: FormResult[];
    is_our_club: boolean;
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

    // Column Sorting State (#1)
    type SortField = 'position' | 'played' | 'won' | 'drawn' | 'lost' | 'goals_for' | 'goals_against' | 'goal_difference' | 'points' | 'ppg';
    const [sortField, setSortField] = useState<SortField>('position');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

    const handleSortColumn = (field: SortField) => {
        if (sortField === field) {
            setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'));
        } else {
            setSortField(field);
            // Position and Goals Against default to ascending (1st / fewest conceded first); stats default to descending
            setSortDir(field === 'position' || field === 'goals_against' ? 'asc' : 'desc');
        }
    };

    // Feature #7: 1-Click Social Media Standings Graphic Modal
    const [showShareModal, setShowShareModal] = useState(false);
    const [graphicFormat, setGraphicFormat] = useState<'story' | 'post'>('post');
    const [graphicScope, setGraphicScope] = useState<'full' | 'top8'>('full');
    const [copiedGraphic, setCopiedGraphic] = useState(false);
    const [mobileTableView, setMobileTableView] = useState<'overview' | 'full' | 'form'>('overview');
    const [expandedMobileTeam, setExpandedMobileTeam] = useState<string | null>(null);
    const shareCanvasRef = useRef<HTMLCanvasElement>(null);

    const storageKey = clubId ? `clubflow_league_table_${clubId}` : "clubflow_league_table";
    const syncTimestampKey = `${storageKey}_synced_at`;
    const appliedFixturesKey = `${storageKey}_applied_fixtures`;
    const faLrCodeKey = `${storageKey}_fa_lrcode`;
    const prevPositionsKey = `${storageKey}_prev_positions`;

    const isOurClubName = (teamName?: string): boolean => {
        if (!teamName) return false;
        const clubLower = (settings.name || "ClubFlow").toLowerCase().trim();
        const clubCore = clubLower.replace(/\bfc\b/g, "").trim();
        const candidate = String(teamName).toLowerCase().trim();
        if (candidate === clubLower) return true;
        if (clubCore.length >= 4 && candidate === clubCore) return true;
        return candidate.includes(clubLower);
    };

    const normalizeTeamKey = (name?: string): string => {
        if (!name) return "";
        return String(name)
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

    // Feature #6 & #10: Attach Position Movement Arrows AND W/D/L Form Diffing
    const attachPositionMovements = (rawNewRows: any[], existingRows?: LeagueRow[] | null): LeagueRow[] => {
        const newRows: LeagueRow[] = (rawNewRows || [])
            .filter((r) => r && (r.team_name || r.team))
            .map((r, idx) => {
                const tName = String(r.team_name || r.team || "Club");
                return {
                    position: Number(r.position ?? r.pos ?? idx + 1),
                    previous_position: r.previous_position,
                    team_name: tName,
                    played: Number(r.played ?? 0),
                    won: Number(r.won ?? 0),
                    drawn: Number(r.drawn ?? 0),
                    lost: Number(r.lost ?? 0),
                    goals_for: Number(r.goals_for ?? r.gf ?? 0),
                    goals_against: Number(r.goals_against ?? r.ga ?? 0),
                    goal_difference: Number(r.goal_difference ?? r.gd ?? 0),
                    points: Number(r.points ?? r.pts ?? 0),
                    form: Array.isArray(r.form) ? r.form : undefined,
                    is_our_club: Boolean(r.is_our_club || isOurClubName(tName)),
                };
            });
        try {
            type TeamSnapshot = {
                position: number;
                played: number;
                won?: number;
                drawn?: number;
                lost?: number;
                form?: FormResult[];
            };
            let prevMap: Record<string, TeamSnapshot> = {};
            const savedPrev = localStorage.getItem(prevPositionsKey);
            if (savedPrev) {
                prevMap = JSON.parse(savedPrev);
            }

            const oldList = existingRows || currentTable;
            if (oldList && oldList.length > 0) {
                const oldTotalPlayed = oldList.reduce((sum, r) => sum + (r.played || 0), 0);
                const newTotalPlayed = newRows.reduce((sum, r) => sum + (r.played || 0), 0);

                if (newTotalPlayed > oldTotalPlayed) {
                    const updatedPrevMap: Record<string, TeamSnapshot> = { ...prevMap };
                    for (const oldRow of oldList) {
                        const key = normalizeTeamKey(oldRow.team_name);
                        updatedPrevMap[key] = {
                            position: oldRow.position,
                            played: oldRow.played,
                            won: oldRow.won,
                            drawn: oldRow.drawn,
                            lost: oldRow.lost,
                            form: oldRow.form || prevMap[key]?.form || []
                        };
                    }
                    prevMap = updatedPrevMap;
                } else if (Object.keys(prevMap).length === 0) {
                    for (const row of oldList) {
                        const key = normalizeTeamKey(row.team_name);
                        prevMap[key] = {
                            position: row.position,
                            played: row.played,
                            won: row.won,
                            drawn: row.drawn,
                            lost: row.lost,
                            form: row.form || []
                        };
                    }
                }
            } else if (Object.keys(prevMap).length === 0) {
                for (const row of newRows) {
                    const key = normalizeTeamKey(row.team_name);
                    prevMap[key] = {
                        position: row.position,
                        played: row.played,
                        won: row.won,
                        drawn: row.drawn,
                        lost: row.lost,
                        form: row.form || []
                    };
                }
            }

            const enriched = newRows.map(r => {
                const key = normalizeTeamKey(r.team_name);
                const prev = prevMap[key];
                let form: FormResult[] = Array.isArray(r.form) && r.form.length > 0
                    ? [...r.form]
                    : Array.isArray(prev?.form)
                        ? [...prev.form]
                        : [];

                // If live feed didn't supply form, infer new W/D/L from column diff when played count increases
                if ((!r.form || r.form.length === 0) && prev && r.played > prev.played) {
                    const wDiff = Math.max(0, (r.won || 0) - (prev.won || 0));
                    const dDiff = Math.max(0, (r.drawn || 0) - (prev.drawn || 0));
                    const lDiff = Math.max(0, (r.lost || 0) - (prev.lost || 0));
                    for (let i = 0; i < wDiff; i++) form.push('W');
                    for (let i = 0; i < dDiff; i++) form.push('D');
                    for (let i = 0; i < lDiff; i++) form.push('L');
                    form = form.slice(-5);
                }

                prevMap[key] = {
                    position: prev?.position ?? r.position,
                    played: r.played,
                    won: r.won,
                    drawn: r.drawn,
                    lost: r.lost,
                    form
                };

                return {
                    ...r,
                    previous_position: prev?.position ?? r.previous_position ?? r.position,
                    form: form.slice(-5)
                };
            });

            localStorage.setItem(prevPositionsKey, JSON.stringify(prevMap));
            return enriched;
        } catch (e) {
            return newRows;
        }
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

    const applyNewMatchResultsToTable = async (baseTable: LeagueRow[]): Promise<LeagueRow[]> => {
        if (!baseTable || baseTable.length === 0) return baseTable;
        try {
            let query = supabase
                .from('fixtures')
                .select('id, opponent, date, is_home, home_score, away_score, status, competition')
                .eq('status', 'completed')
                .order('date', { ascending: true });
            if (clubId) query = query.eq('club_id', clubId);
            const { data: completed } = await query;
            if (!completed || completed.length === 0) return baseTable;

            const leagueCompleted = completed.filter(f => {
                if (f.home_score === null || f.away_score === null) return false;
                const comp = (f.competition || "League").toLowerCase();
                return !comp.includes("cup") && !comp.includes("trophy") && !comp.includes("shield") && !comp.includes("friendly");
            });

            const updatedRows = baseTable.map(r => ({
                ...r,
                form: Array.isArray(r.form) ? [...r.form] : []
            }));

            // Backfill our own club's Last 5 Form from /matches if not already populated
            const ourIdx = updatedRows.findIndex(r => r.is_our_club || isOurClubName(r.team_name));
            if (ourIdx !== -1 && (!updatedRows[ourIdx].form || updatedRows[ourIdx].form!.length === 0) && leagueCompleted.length > 0) {
                const ourForm: FormResult[] = leagueCompleted.slice(-5).map(m => {
                    const ourGoals = m.is_home ? Number(m.home_score) : Number(m.away_score);
                    const oppGoals = m.is_home ? Number(m.away_score) : Number(m.home_score);
                    return ourGoals > oppGoals ? 'W' : ourGoals === oppGoals ? 'D' : 'L';
                });
                updatedRows[ourIdx].form = ourForm;
            }

            const savedIdsRaw = localStorage.getItem(appliedFixturesKey);
            if (!savedIdsRaw) {
                const initialIds = completed
                    .filter(f => f.home_score !== null && f.away_score !== null)
                    .map(f => String(f.id));
                localStorage.setItem(appliedFixturesKey, JSON.stringify(initialIds));
                return updatedRows;
            }

            const appliedSet = new Set<string>(JSON.parse(savedIdsRaw));
            let modified = false;

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

                const oppIdx = updatedRows.findIndex(r => !r.is_our_club && isMatchingTeamName(r.team_name, match.opponent || ""));

                if (ourIdx !== -1) {
                    const row = updatedRows[ourIdx];
                    row.played += 1;
                    row.goals_for = (row.goals_for || 0) + ourGoals;
                    row.goals_against = (row.goals_against || 0) + oppGoals;
                    const resChar: FormResult = ourGoals > oppGoals ? 'W' : ourGoals === oppGoals ? 'D' : 'L';
                    if (resChar === 'W') {
                        row.won += 1;
                        row.points += 3;
                    } else if (resChar === 'D') {
                        row.drawn += 1;
                        row.points += 1;
                    } else {
                        row.lost += 1;
                    }
                    row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                    row.form = [...(row.form || []), resChar].slice(-5);
                    modified = true;
                }

                if (oppIdx !== -1 && oppIdx !== ourIdx) {
                    const row = updatedRows[oppIdx];
                    row.played += 1;
                    row.goals_for = (row.goals_for || 0) + oppGoals;
                    row.goals_against = (row.goals_against || 0) + ourGoals;
                    const oppResChar: FormResult = oppGoals > ourGoals ? 'W' : oppGoals === ourGoals ? 'D' : 'L';
                    if (oppResChar === 'W') {
                        row.won += 1;
                        row.points += 3;
                    } else if (oppResChar === 'D') {
                        row.drawn += 1;
                        row.points += 1;
                    } else {
                        row.lost += 1;
                    }
                    row.goal_difference = (row.goals_for || 0) - (row.goals_against || 0);
                    row.form = [...(row.form || []), oppResChar].slice(-5);
                    modified = true;
                }

                appliedSet.add(matchId);
            }

            localStorage.setItem(appliedFixturesKey, JSON.stringify(Array.from(appliedSet)));

            if (modified) {
                const sorted = attachPositionMovements(sortStandings(updatedRows), baseTable);
                localStorage.setItem(storageKey, JSON.stringify(sorted));
                const ourRow = sorted.find(r => r.is_our_club);
                if (ourRow && ourRow.position !== settings.leaguePosition) {
                    updateSettings({ leaguePosition: ourRow.position }).catch(() => {});
                }
                return sorted;
            }
            return updatedRows;
        } catch (e) {
            console.warn("Auto-standings match calculation skipped:", e);
        }
        return baseTable;
    };

    const persistStandingsDirectly = async (rows: LeagueRow[], connectedUrl?: string) => {
        const nowIso = new Date().toISOString();
        const rowsWithMovement = attachPositionMovements(rows, currentTable);
        setCurrentTable(rowsWithMovement);
        setLastSyncedAt(nowIso);
        try {
            localStorage.setItem(storageKey, JSON.stringify(rowsWithMovement));
            localStorage.setItem(syncTimestampKey, nowIso);
        } catch (e) {}

        await snapshotBaselineFixtures();
        loadNextOpponent(rowsWithMovement);

        const ourRow = rowsWithMovement.find(r => r.is_our_club || isOurClubName(r.team_name));
        const newUpdates: any = {
            lastImportHistory: {
                ...(settings.lastImportHistory || {}),
                leagueTable: rowsWithMovement,
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

        for (const row of rowsWithMovement) {
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

        // Persist league table snapshot in Supabase so all devices & domains (localhost + clubflow.org.uk) stay in sync
        if (clubId) {
            try {
                const payloadStr = JSON.stringify({
                    teams: rowsWithMovement,
                    connectedUrl: connectedUrl || settings.leagueUrl || urlInput || undefined,
                    updatedAt: nowIso
                });
                const { data: existingCache } = await supabase
                    .from('documents')
                    .select('id')
                    .eq('club_id', clubId)
                    .eq('category', 'LEAGUE_TABLE_CACHE')
                    .maybeSingle();

                if (existingCache?.id) {
                    await supabase
                        .from('documents')
                        .update({ url: payloadStr, name: 'League Standings Cache' })
                        .eq('id', existingCache.id);
                } else {
                    await supabase
                        .from('documents')
                        .insert({
                            club_id: clubId,
                            name: 'League Standings Cache',
                            type: 'JSON',
                            category: 'LEAGUE_TABLE_CACHE',
                            url: payloadStr
                        });
                }
            } catch (e) {
                // Non-fatal if remote cache write fails
            }
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
                body: JSON.stringify({ url: targetUrl, clubName: settings.name || "ClubFlow", clubId })
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
        let hasFormPopulated = false;
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
                    loadedRows = attachPositionMovements(parsed, parsed);
                    hasValidCachedTable = true;
                    hasFormPopulated = loadedRows.some(r => Array.isArray(r.form) && r.form.length > 0);
                }
            } else if (
                settings.lastImportHistory?.leagueTable &&
                Array.isArray(settings.lastImportHistory.leagueTable) &&
                settings.lastImportHistory.leagueTable.length > 0
            ) {
                loadedRows = attachPositionMovements(settings.lastImportHistory.leagueTable, settings.lastImportHistory.leagueTable);
                hasValidCachedTable = true;
                hasFormPopulated = loadedRows.some(r => Array.isArray(r.form) && r.form.length > 0);
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
            if (clubId) {
                supabase
                    .from('documents')
                    .select('url')
                    .eq('club_id', clubId)
                    .eq('category', 'LEAGUE_TABLE_CACHE')
                    .maybeSingle()
                    .then(({ data: remoteDoc }) => {
                        if (remoteDoc?.url) {
                            try {
                                const parsedPayload = JSON.parse(remoteDoc.url);
                                if (Array.isArray(parsedPayload?.teams) && parsedPayload.teams.length > 0) {
                                    const remoteRows = attachPositionMovements(parsedPayload.teams, parsedPayload.teams);
                                    setCurrentTable(remoteRows);
                                    if (parsedPayload.updatedAt) {
                                        setLastSyncedAt(parsedPayload.updatedAt);
                                        localStorage.setItem(syncTimestampKey, parsedPayload.updatedAt);
                                    }
                                    localStorage.setItem(storageKey, JSON.stringify(remoteRows));
                                    loadNextOpponent(remoteRows);
                                    applyNewMatchResultsToTable(remoteRows).then(updated => {
                                        setCurrentTable(updated);
                                        loadNextOpponent(updated);
                                    });
                                }
                            } catch (e) {}
                        }
                    });
            }
        }

        // Sync if cache is older than 6h OR if cached table predates the new Form feature
        if (activeUrl && !hasAutoSyncedRef.current && (!hasValidCachedTable || !isCacheFresh || !hasFormPopulated)) {
            hasAutoSyncedRef.current = true;
            autoSyncFromUrl(activeUrl, true);
        }
    }, [clubId, settings.leagueUrl, settings.name]);

    // Render Social Media Standings Graphic onto HTML5 Canvas (Feature #7) — 2x Retina Ultra-HD
    useEffect(() => {
        if (!showShareModal || !shareCanvasRef.current || !currentTable || currentTable.length === 0) return;

        const canvas = shareCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const scale = 2; // 2x Retina Ultra-HD (2160px wide) for crystal-clear text on phones & social media
        const rowsToDraw = graphicScope === 'top8' ? currentTable.slice(0, 8) : currentTable;
        const width = 1080;
        const rowHeight = graphicScope === 'top8' ? 76 : Math.max(56, Math.min(68, Math.floor(960 / Math.max(rowsToDraw.length, 1))));
        const headerHeight = 340;
        const tableHeaderHeight = 58;
        const footerHeight = 110;
        const calculatedHeight = headerHeight + tableHeaderHeight + rowsToDraw.length * rowHeight + footerHeight;
        const height = graphicFormat === 'story' ? Math.max(1920, calculatedHeight) : Math.max(1350, calculatedHeight);

        canvas.width = width * scale;
        canvas.height = height * scale;

        const brandHex = (settings.primaryColor || settings.homeKitShirt || "#dc2626").trim();
        const secondaryHex = (settings.secondaryColor || "#111827").trim();

        const parseHexToRgb = (hex: string, fallback = { r: 220, g: 38, b: 38 }) => {
            const clean = hex.replace('#', '').trim();
            if (clean.length === 3) {
                const r = parseInt(clean[0] + clean[0], 16);
                const g = parseInt(clean[1] + clean[1], 16);
                const b = parseInt(clean[2] + clean[2], 16);
                return isNaN(r) ? fallback : { r, g, b };
            }
            if (clean.length >= 6) {
                const r = parseInt(clean.slice(0, 2), 16);
                const g = parseInt(clean.slice(2, 4), 16);
                const b = parseInt(clean.slice(4, 6), 16);
                return isNaN(r) ? fallback : { r, g, b };
            }
            return fallback;
        };

        const pRgb = parseHexToRgb(brandHex);
        const sRgb = parseHexToRgb(secondaryHex, { r: 17, g: 24, b: 39 });
        // If secondary is pure white or very bright, use darkened primary for the deep base
        const sLuminance = (0.299 * sRgb.r + 0.587 * sRgb.g + 0.114 * sRgb.b) / 255;
        const baseEndRgb = sLuminance > 0.6
            ? { r: Math.round(pRgb.r * 0.14), g: Math.round(pRgb.g * 0.14), b: Math.round(pRgb.b * 0.16) }
            : { r: Math.round(sRgb.r * 0.35), g: Math.round(sRgb.g * 0.35), b: Math.round(sRgb.b * 0.4) };

        const drawGraphic = (logoImg?: HTMLImageElement) => {
            ctx.save();
            ctx.scale(scale, scale);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";

            // Club-coloured background gradient derived from the user's club colours
            const bgGrad = ctx.createLinearGradient(0, 0, width, height);
            bgGrad.addColorStop(0, `rgb(${Math.round(pRgb.r * 0.36)}, ${Math.round(pRgb.g * 0.36)}, ${Math.round(pRgb.b * 0.38)})`);
            bgGrad.addColorStop(0.45, `rgb(${Math.round(pRgb.r * 0.16)}, ${Math.round(pRgb.g * 0.16)}, ${Math.round(pRgb.b * 0.20)})`);
            bgGrad.addColorStop(1, `rgb(${baseEndRgb.r}, ${baseEndRgb.g}, ${baseEndRgb.b})`);
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);

            // Top-right club colour spotlight glow
            const glowGrad = ctx.createRadialGradient(width * 0.85, 110, 20, width * 0.85, 110, 560);
            glowGrad.addColorStop(0, `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.42)`);
            glowGrad.addColorStop(1, "transparent");
            ctx.fillStyle = glowGrad;
            ctx.fillRect(0, 0, width, 620);

            // Top club colour bar
            ctx.fillStyle = brandHex;
            ctx.fillRect(0, 0, width, 14);

            const ourRow = currentTable.find(r => r.is_our_club) || currentTable[0];
            const ordinal = (n: number) => {
                const s = ["TH", "ST", "ND", "RD"];
                const v = n % 100;
                return n + (s[(v - 20) % 10] || s[v] || s[0]);
            };

            let textStartX = 64;
            if (logoImg) {
                const logoSize = 112;
                ctx.save();
                ctx.beginPath();
                ctx.arc(64 + logoSize / 2, 76 + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(logoImg, 64, 76, logoSize, logoSize);
                ctx.restore();
                textStartX = 200;
            }

            ctx.fillStyle = "rgba(255,255,255,0.92)";
            ctx.font = "800 25px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            ctx.fillText((settings.name || "CLUBFLOW").toUpperCase(), textStartX, 116);

            ctx.fillStyle = "#ffffff";
            ctx.font = "900 68px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            ctx.fillText("AS IT STANDS", textStartX, 182);

            const kpiY = 228;
            const kpis = [
                { label: "POSITION", value: ordinal(ourRow.position) },
                { label: "POINTS", value: `${ourRow.points} PTS` },
                { label: "RECORD", value: `${ourRow.won}W ${ourRow.drawn}D ${ourRow.lost}L` },
                { label: "GOAL DIFF", value: ourRow.goal_difference > 0 ? `+${ourRow.goal_difference}` : `${ourRow.goal_difference}` }
            ];
            const cardW = Math.floor((width - 128 - 36) / 4);
            kpis.forEach((k, i) => {
                const x = Math.round(64 + i * (cardW + 12));
                ctx.fillStyle = i === 0 ? `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.38)` : "rgba(255,255,255,0.08)";
                ctx.strokeStyle = i === 0 ? brandHex : `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.3)`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(x, kpiY, cardW, 78, 14);
                ctx.fill();
                ctx.stroke();

                ctx.fillStyle = "rgba(255,255,255,0.78)";
                ctx.font = "700 15px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillText(k.label, x + 20, kpiY + 28);

                ctx.fillStyle = "#ffffff";
                ctx.font = "900 29px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillText(k.value, x + 20, kpiY + 61);
            });

            const tableTop = headerHeight;
            ctx.fillStyle = `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.28)`;
            ctx.beginPath();
            ctx.roundRect(64, tableTop, width - 128, tableHeaderHeight, [14, 14, 0, 0]);
            ctx.fill();

            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.font = "800 20px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
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

            rowsToDraw.forEach((row, idx) => {
                const y = Math.round(tableTop + tableHeaderHeight + idx * rowHeight);
                const isOurs = row.is_our_club;
                const isNextOpp = nextOpponentInfo && !isOurs && isMatchingTeamName(row.team_name, nextOpponentInfo.opponent);

                ctx.fillStyle = isOurs
                    ? `rgba(${pRgb.r}, ${pRgb.g}, ${pRgb.b}, 0.42)`
                    : idx % 2 === 0
                        ? "rgba(255,255,255,0.05)"
                        : "rgba(255,255,255,0.02)";
                ctx.fillRect(64, y, width - 128, rowHeight);

                if (isOurs) {
                    ctx.fillStyle = brandHex;
                    ctx.fillRect(64, y, 8, rowHeight);
                } else if (isNextOpp) {
                    ctx.fillStyle = "#f59e0b";
                    ctx.fillRect(64, y, 6, rowHeight);
                }

                ctx.fillStyle = "rgba(255,255,255,0.09)";
                ctx.fillRect(64, y + rowHeight - 1, width - 128, 1);

                const textY = Math.round(y + rowHeight / 2 + 8);
                ctx.textAlign = "center";
                ctx.fillStyle = "#ffffff";
                ctx.font = isOurs
                    ? "900 25px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                    : "700 23px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillText(String(row.position), 110, textY);

                ctx.textAlign = "left";
                ctx.fillStyle = "#ffffff";
                ctx.font = isOurs
                    ? "900 26px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                    : "700 24px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                const maxClubName = row.team_name.length > 24 ? row.team_name.slice(0, 23) + "…" : row.team_name;
                ctx.fillText(maxClubName, 165, textY);

                if (isNextOpp) {
                    const nameWidth = ctx.measureText(maxClubName).width;
                    const badgeX = Math.round(Math.min(165 + nameWidth + 14, 510));
                    ctx.fillStyle = "rgba(245, 158, 11, 0.28)";
                    ctx.beginPath();
                    ctx.roundRect(badgeX, Math.round(y + rowHeight / 2 - 14), 92, 26, 6);
                    ctx.fill();
                    ctx.fillStyle = "#fbbf24";
                    ctx.font = "800 13px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                    ctx.fillText("NEXT UP", badgeX + 14, Math.round(y + rowHeight / 2 + 4));
                }

                ctx.textAlign = "center";
                ctx.font = isOurs
                    ? "800 24px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
                    : "600 23px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillStyle = "#ffffff";
                ctx.fillText(String(row.played), 640, textY);
                ctx.fillText(String(row.won), 705, textY);
                ctx.fillText(String(row.drawn), 770, textY);
                ctx.fillText(String(row.lost), 835, textY);

                const gdStr = row.goal_difference > 0 ? `+${row.goal_difference}` : String(row.goal_difference);
                ctx.fillStyle = row.goal_difference > 0 ? "#4ade80" : row.goal_difference < 0 ? "#f87171" : "#e2e8f0";
                ctx.font = "700 23px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillText(gdStr, 905, textY);

                ctx.fillStyle = "#ffffff";
                ctx.font = "900 26px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
                ctx.fillText(String(row.points), 975, textY);
            });

            // Footer with Club Colour accent dot + Powered by ClubFlow
            ctx.fillStyle = brandHex;
            ctx.beginPath();
            ctx.arc(72, height - 49, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.textAlign = "left";
            ctx.fillStyle = "rgba(255,255,255,0.82)";
            ctx.font = "700 21px system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
            ctx.fillText(`Powered by ClubFlow • ${settings.name || "ClubFlow"}`, 88, height - 42);

            ctx.restore();
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
    }, [showShareModal, graphicFormat, graphicScope, currentTable, settings.name, settings.primaryColor, settings.secondaryColor, settings.homeKitShirt, settings.logo, nextOpponentInfo]);

    const handleDownloadGraphic = () => {
        if (!shareCanvasRef.current) return;
        const link = document.createElement('a');
        const slug = (settings.name || "club").toLowerCase().replace(/[^a-z0-9]+/g, '-');
        link.download = `${slug}-league-standings.png`;
        link.href = shareCanvasRef.current.toDataURL('image/png', 1.0);
        link.click();
    };

    const handleCopyGraphic = async () => {
        if (!shareCanvasRef.current) return;
        try {
            const blob = await new Promise<Blob | null>(resolve => shareCanvasRef.current?.toBlob(resolve, 'image/png', 1.0));
            if (blob && typeof navigator !== 'undefined' && navigator.share && navigator.canShare) {
                const slug = (settings.name || "club").toLowerCase().replace(/[^a-z0-9]+/g, '-');
                const file = new File([blob], `${slug}-league-standings.png`, { type: 'image/png' });
                if (navigator.canShare({ files: [file] })) {
                    await navigator.share({
                        files: [file],
                        title: `${settings.name || "Club"} League Standings`,
                    });
                    return;
                }
            }
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
            const extractedForm: FormResult[] = [];
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
                        const chars = tok.toUpperCase().replace(/[^WDL]/g, '').split('') as FormResult[];
                        extractedForm.unshift(...chars);
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
                form: extractedForm.slice(-5),
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
            <div className="h-full flex flex-col gap-4 md:gap-6 max-w-4xl mx-auto py-3 md:py-8 pb-24 md:pb-8">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-xl md:text-2xl font-bold text-foreground">Edit League Standings</h2>
                        <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">Adjust any row below and tap Save.</p>
                    </div>
                    <span className="md:hidden text-xs font-semibold px-2.5 py-1 rounded-full bg-surface-2 border border-border text-muted-foreground">
                        {previewData.length} teams
                    </span>
                </div>

                {/* MOBILE EDIT VIEW (< 768px) */}
                <div className="md:hidden flex flex-col gap-2.5">
                    {previewData.map((row, idx) => (
                        <div
                            key={idx}
                            className={`rounded-xl border p-3 transition-colors ${
                                row.is_our_club
                                    ? 'bg-primary/10 border-primary/40 border-l-4 border-l-primary'
                                    : 'bg-surface-1 border-border'
                            }`}
                        >
                            <div className="flex items-center gap-2 mb-2.5">
                                <div className="flex items-center gap-1 shrink-0">
                                    <span className="text-[10px] font-bold uppercase text-muted-foreground">#</span>
                                    <Input
                                        type="number"
                                        value={row.position}
                                        onChange={(e) => handleRowChange(idx, 'position', parseInt(e.target.value) || 0)}
                                        className="w-11 h-8 px-1 text-center font-bold text-xs bg-background border-border"
                                    />
                                </div>
                                <Input
                                    type="text"
                                    value={row.team_name}
                                    onChange={(e) => handleRowChange(idx, 'team_name', e.target.value)}
                                    className={`h-8 px-2.5 text-xs flex-1 min-w-0 bg-background border-border ${
                                        row.is_our_club ? 'font-bold text-primary' : 'font-semibold text-foreground'
                                    }`}
                                />
                            </div>

                            <div className="grid grid-cols-8 gap-1 text-center">
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">P</span>
                                    <Input
                                        type="number"
                                        value={row.played}
                                        onChange={(e) => handleRowChange(idx, 'played', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">W</span>
                                    <Input
                                        type="number"
                                        value={row.won}
                                        onChange={(e) => handleRowChange(idx, 'won', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">D</span>
                                    <Input
                                        type="number"
                                        value={row.drawn}
                                        onChange={(e) => handleRowChange(idx, 'drawn', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">L</span>
                                    <Input
                                        type="number"
                                        value={row.lost}
                                        onChange={(e) => handleRowChange(idx, 'lost', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">GF</span>
                                    <Input
                                        type="number"
                                        value={row.goals_for}
                                        onChange={(e) => handleRowChange(idx, 'goals_for', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">GA</span>
                                    <Input
                                        type="number"
                                        value={row.goals_against}
                                        onChange={(e) => handleRowChange(idx, 'goals_against', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs bg-background border-border"
                                    />
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">GD</span>
                                    <div className="h-7 flex items-center justify-center rounded-md bg-surface-2 text-[11px] font-mono font-semibold text-muted-foreground">
                                        {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                    </div>
                                </div>
                                <div className="flex flex-col gap-0.5">
                                    <span className="text-[9px] font-bold uppercase text-brand">Pts</span>
                                    <Input
                                        type="number"
                                        value={row.points}
                                        onChange={(e) => handleRowChange(idx, 'points', parseInt(e.target.value) || 0)}
                                        className="h-7 px-0.5 text-center text-xs font-bold bg-background border-brand/40 text-foreground"
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* DESKTOP EDIT TABLE (>= 768px) — UNTOUCHED */}
                <Card className="hidden md:block border-border bg-surface-1">
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
                    <span className="hidden md:inline text-sm font-medium text-muted-foreground">{previewData.length} teams</span>
                    <div className="flex gap-2.5 w-full md:w-auto">
                        <Button variant="outline" onClick={() => setPreviewData(null)} disabled={isImporting} className="flex-1 md:flex-initial">
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmImport} className="bg-brand hover:bg-brand/90 text-white flex-1 md:flex-initial font-semibold" disabled={isImporting}>
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
        const ourRow = currentTable.find(r => r.is_our_club) || currentTable[0];
        const totalTeams = currentTable.length;
        const fullSeasonGames = Math.max((totalTeams - 1) * 2, ourRow.played);
        const ourPpg = ourRow.played > 0 ? ourRow.points / ourRow.played : 0;
        const projectedPoints = Math.round(ourPpg * fullSeasonGames);

        const ordinal = (n: number) => {
            const s = ["th", "st", "nd", "rd"];
            const v = n % 100;
            return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };

        const secondRow = currentTable[1];
        const standingSubtext =
            ourRow.position === 1 && secondRow
                ? `+${ourRow.points - secondRow.points} pt${ourRow.points - secondRow.points === 1 ? "" : "s"} clear of 2nd (${secondRow.team_name})`
                : `${currentTable[0].points - ourRow.points} pts off 1st (${currentTable[0].team_name})`;

        // Compute Division Attack Rank (highest GF, tie-break GF/game) & Defence Rank (lowest GA/game)
        const attackSorted = [...currentTable].sort((a, b) => (b.goals_for || 0) - (a.goals_for || 0));
        const attackRank = attackSorted.findIndex(r => r.team_name === ourRow.team_name) + 1;
        const gfPerGame = ourRow.played > 0 ? ((ourRow.goals_for || 0) / ourRow.played).toFixed(2) : "0.00";

        const defenceSorted = [...currentTable]
            .filter(r => r.played > 0)
            .sort((a, b) => ((a.goals_against || 0) / a.played) - ((b.goals_against || 0) / b.played));
        const defenceRank = Math.max(1, defenceSorted.findIndex(r => r.team_name === ourRow.team_name) + 1);
        const gaPerGame = ourRow.played > 0 ? ((ourRow.goals_against || 0) / ourRow.played).toFixed(2) : "0.00";

        const sortedRows = [...currentTable].sort((a, b) => {
            const getVal = (r: LeagueRow) => {
                if (sortField === 'ppg') return r.played > 0 ? r.points / r.played : 0;
                return Number((r as any)[sortField] ?? 0);
            };
            const diff = getVal(a) - getVal(b);
            if (diff !== 0) return sortDir === 'asc' ? diff : -diff;
            return a.position - b.position;
        });

        return (
            <div className="h-full w-full max-w-full overflow-x-hidden min-w-0 flex flex-col gap-3.5 md:gap-6 pb-20 md:pb-6">
                <div ref={hiddenFaContainerRef} className="hidden" aria-hidden="true" />

                {/* ================================================================= */}
                {/* MOBILE HEADER & ACTION BAR (< 768px)                              */}
                {/* ================================================================= */}
                <div className="md:hidden flex flex-col gap-2.5 w-full min-w-0">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="h-9 w-9 shrink-0 bg-brand/10 rounded-xl flex items-center justify-center border border-brand/20">
                                <Trophy className="h-4 w-4 text-brand" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <h2 className="text-base font-extrabold text-foreground truncate">League Standings</h2>
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-500 border border-emerald-500/20 shrink-0">
                                        <span className={`h-1.5 w-1.5 rounded-full bg-emerald-500 ${isAutoSyncing ? 'animate-ping' : ''}`} />
                                        {isAutoSyncing ? "Syncing" : "Live"}
                                    </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    {lastSyncedAt
                                        ? `Synced • Checked ${new Date(lastSyncedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
                                        : "Auto-updates from league feed & results"}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Compact Mobile Action Grid — fits 100% inside viewport with zero overhang */}
                    <div className="grid grid-cols-2 gap-1.5 w-full">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowShareModal(true)}
                            className="h-8 px-2 text-[11px] font-semibold border-brand/30 text-brand hover:bg-brand/10 w-full truncate"
                        >
                            <Share2 className="h-3.5 w-3.5 mr-1 shrink-0" />
                            <span className="truncate">Share</span>
                        </Button>
                        {urlInput ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isAutoSyncing}
                                onClick={() => autoSyncFromUrl(urlInput, false)}
                                className="h-8 px-2 text-[11px] w-full truncate"
                            >
                                {isAutoSyncing ? "Syncing..." : "🔄 Refresh Table"}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewData(currentTable)}
                                className="h-8 px-2 text-[11px] w-full truncate"
                            >
                                Edit Standings
                            </Button>
                        )}
                        {urlInput && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setPreviewData(currentTable)}
                                className="h-8 px-2 text-[11px] w-full truncate"
                            >
                                Edit Table
                            </Button>
                        )}
                        <Button
                            onClick={() => setShowImporter(true)}
                            variant="outline"
                            size="sm"
                            className={`h-8 px-2 text-[11px] w-full truncate ${!urlInput ? 'col-span-2' : ''}`}
                        >
                            Change League
                        </Button>
                    </div>
                </div>

                {/* ================================================================= */}
                {/* DESKTOP HEADER & ACTION BAR (>= 768px) — UNTOUCHED                */}
                {/* ================================================================= */}
                <div className="hidden md:flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 bg-brand/10 rounded-full flex items-center justify-center">
                            <Trophy className="h-5 w-5 text-brand" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground flex items-center gap-2 flex-wrap">
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
                        {/* Feature #7 Toggle: Share Social Graphic */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowShareModal(true)}
                            className="border-brand/30 text-brand hover:bg-brand/10"
                        >
                            <Share2 className="h-4 w-4 mr-1.5" />
                            Share
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

                {/* ================================================================= */}
                {/* MOBILE 2x2 PERFORMANCE BENTO GRID (< 768px)                       */}
                {/* ================================================================= */}
                <div className="md:hidden grid grid-cols-2 gap-2">
                    <div className="min-w-0 overflow-hidden rounded-xl border border-brand/30 bg-brand/5 p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand truncate">
                            Standing
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-black text-foreground leading-tight">
                                {ordinal(ourRow.position)}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground truncate">
                                of {totalTeams}
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={standingSubtext}>
                            {standingSubtext}
                        </p>
                    </div>

                    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1 p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                            Points / Game
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-black text-foreground leading-tight">
                                {ourPpg.toFixed(2)}
                            </span>
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                PPG
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            Pace: <strong className="text-foreground">{projectedPoints} pts</strong> ({fullSeasonGames}g)
                        </p>
                    </div>

                    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1 p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                            Attack Rank
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-black text-foreground leading-tight">
                                #{attackRank}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground truncate">
                                ({ourRow.goals_for ?? 0} GF)
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {gfPerGame} goals / game
                        </p>
                    </div>

                    <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-surface-1 p-2.5">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                            Defence Rank
                        </p>
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                            <span className="text-xl font-black text-foreground leading-tight">
                                #{defenceRank}
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground truncate">
                                ({ourRow.goals_against ?? 0} GA)
                            </span>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {gaPerGame}/gm • {ourRow.goal_difference > 0 ? `+${ourRow.goal_difference}` : ourRow.goal_difference} GD
                        </p>
                    </div>
                </div>

                {/* ================================================================= */}
                {/* DESKTOP 4-CARD PERFORMANCE HERO STRIP (>= 768px) — UNTOUCHED      */}
                {/* ================================================================= */}
                <div className="hidden md:grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                    <Card className="border-brand/30 bg-brand/5 shadow-xs">
                        <CardContent className="p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-brand">
                                Current Standing
                            </p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-black text-foreground">
                                    {ordinal(ourRow.position)}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                    of {totalTeams} clubs
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={standingSubtext}>
                                {standingSubtext}
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-surface-1 shadow-xs">
                        <CardContent className="p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                Points Per Game
                            </p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-black text-foreground">
                                    {ourPpg.toFixed(2)}
                                </span>
                                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                    PPG
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                On pace for <strong>{projectedPoints} pts</strong> ({fullSeasonGames} games)
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-surface-1 shadow-xs">
                        <CardContent className="p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                League Attack Rank
                            </p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-black text-foreground">
                                    #{attackRank}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                    ({ourRow.goals_for ?? 0} GF)
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {gfPerGame} goals scored per game
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border-border bg-surface-1 shadow-xs">
                        <CardContent className="p-4">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                League Defence Rank
                            </p>
                            <div className="flex items-baseline gap-2 mt-1">
                                <span className="text-2xl font-black text-foreground">
                                    #{defenceRank}
                                </span>
                                <span className="text-xs font-medium text-muted-foreground">
                                    ({ourRow.goals_against ?? 0} GA)
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                {gaPerGame} conceded/game • {ourRow.goal_difference > 0 ? `+${ourRow.goal_difference}` : ourRow.goal_difference} GD
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* ================================================================= */}
                {/* MOBILE STANDINGS VIEW (< 768px)                                   */}
                {/* ================================================================= */}
                <div className="md:hidden flex flex-col gap-2 w-full min-w-0">
                    {/* Mobile Table View Mode Switcher — full-width 3-col bar so nothing overflows */}
                    <div className="flex flex-col gap-1 w-full min-w-0">
                        <div className="grid grid-cols-3 bg-surface-2 p-1 rounded-xl border border-border w-full">
                            <button
                                type="button"
                                onClick={() => setMobileTableView('overview')}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors text-center truncate ${
                                    mobileTableView === 'overview'
                                        ? 'bg-brand text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Table
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileTableView('full')}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors text-center truncate ${
                                    mobileTableView === 'full'
                                        ? 'bg-brand text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Full W/D/L
                            </button>
                            <button
                                type="button"
                                onClick={() => setMobileTableView('form')}
                                className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors text-center truncate ${
                                    mobileTableView === 'form'
                                        ? 'bg-brand text-white shadow-xs'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                            >
                                Form & PPG
                            </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground font-medium text-right px-0.5 truncate">
                            Tap any club row to expand full stats
                        </p>
                    </div>

                    {/* Mobile Standings Card */}
                    <Card className="border-border bg-surface-1 overflow-hidden w-full">
                        <CardContent className="p-0">
                            <table className="w-full text-xs text-left table-fixed">
                                <thead className="text-[10px] text-muted-foreground uppercase bg-surface-2 border-b border-border select-none">
                                    {mobileTableView === 'overview' && (
                                        <tr>
                                            <th
                                                onClick={() => handleSortColumn('position')}
                                                className="w-9 pl-2 pr-0.5 py-2.5 font-bold cursor-pointer"
                                            >
                                                #
                                            </th>
                                            <th className="py-2.5 px-1 font-bold">Club</th>
                                            <th
                                                onClick={() => handleSortColumn('played')}
                                                className="w-[26px] py-2.5 text-center font-bold cursor-pointer"
                                            >
                                                P
                                            </th>
                                            <th
                                                onClick={() => handleSortColumn('goal_difference')}
                                                className="w-8 py-2.5 text-center font-bold cursor-pointer"
                                            >
                                                GD
                                            </th>
                                            <th
                                                onClick={() => handleSortColumn('points')}
                                                className="w-8 py-2.5 text-center font-bold cursor-pointer text-foreground"
                                            >
                                                Pts
                                            </th>
                                            <th className="w-[86px] pl-0.5 pr-2 py-2.5 text-right font-bold">Form</th>
                                        </tr>
                                    )}
                                    {mobileTableView === 'full' && (
                                        <tr>
                                            <th
                                                onClick={() => handleSortColumn('position')}
                                                className="w-7 pl-2 pr-0.5 py-2.5 font-bold cursor-pointer"
                                            >
                                                #
                                            </th>
                                            <th className="py-2.5 px-1 font-bold">Club</th>
                                            <th onClick={() => handleSortColumn('played')} className="w-6 py-2.5 text-center font-bold cursor-pointer">P</th>
                                            <th onClick={() => handleSortColumn('won')} className="w-6 py-2.5 text-center font-bold cursor-pointer">W</th>
                                            <th onClick={() => handleSortColumn('drawn')} className="w-6 py-2.5 text-center font-bold cursor-pointer">D</th>
                                            <th onClick={() => handleSortColumn('lost')} className="w-6 py-2.5 text-center font-bold cursor-pointer">L</th>
                                            <th onClick={() => handleSortColumn('goal_difference')} className="w-8 py-2.5 text-center font-bold cursor-pointer">GD</th>
                                            <th onClick={() => handleSortColumn('points')} className="w-8 pr-2 py-2.5 text-center font-bold cursor-pointer text-foreground">Pts</th>
                                        </tr>
                                    )}
                                    {mobileTableView === 'form' && (
                                        <tr>
                                            <th
                                                onClick={() => handleSortColumn('position')}
                                                className="w-8 pl-2 pr-0.5 py-2.5 font-bold cursor-pointer"
                                            >
                                                #
                                            </th>
                                            <th className="py-2.5 px-1 font-bold">Club</th>
                                            <th onClick={() => handleSortColumn('ppg')} className="w-11 py-2.5 text-center font-bold cursor-pointer">
                                                PPG
                                            </th>
                                            <th className="w-[114px] pl-1 pr-2 py-2.5 text-right font-bold">Last 5</th>
                                        </tr>
                                    )}
                                </thead>
                                <tbody>
                                    {sortedRows.map((row, idx) => {
                                        const isNextOpp =
                                            nextOpponentInfo &&
                                            !row.is_our_club &&
                                            isMatchingTeamName(row.team_name, nextOpponentInfo.opponent);

                                        const formattedNextDate = nextOpponentInfo?.date
                                            ? new Date(nextOpponentInfo.date + "T12:00:00").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                            : "";

                                        const posDiff = (row.previous_position ?? row.position) - row.position;
                                        const formItems = Array.isArray(row.form) ? row.form.slice(-5) : [];
                                        const rowPpg = row.played > 0 ? (row.points / row.played).toFixed(2) : "0.00";

                                        let trailingWins = 0;
                                        for (let i = formItems.length - 1; i >= 0; i--) {
                                            if (formItems[i] === 'W') trailingWins++;
                                            else break;
                                        }
                                        const isUnbeatenSeason = row.played >= 3 && row.lost === 0;
                                        const streakLabel = isUnbeatenSeason
                                            ? `🔥 ${row.played} Unbeaten`
                                            : trailingWins >= 4
                                                ? `🔥 ${trailingWins}W Streak`
                                                : null;

                                        const gdColorClass =
                                            row.goal_difference > 0
                                                ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                                : row.goal_difference < 0
                                                    ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                                    : 'text-muted-foreground';

                                        const isExpanded = expandedMobileTeam === row.team_name;
                                        const colSpanCount = mobileTableView === 'overview' ? 6 : mobileTableView === 'full' ? 8 : 4;

                                        return (
                                            <React.Fragment key={idx}>
                                                <tr
                                                    onClick={() => setExpandedMobileTeam(prev => prev === row.team_name ? null : row.team_name)}
                                                    className={`border-b border-border transition-colors cursor-pointer active:bg-surface-2/70 ${
                                                        row.is_our_club
                                                            ? 'bg-primary/10 border-l-4 border-l-primary'
                                                            : isNextOpp
                                                                ? 'bg-amber-500/5 border-l-4 border-l-amber-500/80'
                                                                : ''
                                                    }`}
                                                >
                                                    {/* Position cell */}
                                                    <td className="pl-2 pr-0.5 py-2.5 font-bold whitespace-nowrap">
                                                        <div className="flex items-center gap-0.5">
                                                            <span className="w-4 text-right text-[11px]">{row.position}</span>
                                                            {mobileTableView !== 'full' && (
                                                                posDiff > 0 ? (
                                                                    <ArrowUp className="h-2.5 w-2.5 text-emerald-500 stroke-[3] shrink-0" />
                                                                ) : posDiff < 0 ? (
                                                                    <ArrowDown className="h-2.5 w-2.5 text-rose-500 stroke-[3] shrink-0" />
                                                                ) : (
                                                                    <span className="w-2.5 shrink-0" />
                                                                )
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* Club Name + Sub-badges */}
                                                    <td className="py-2.5 px-1 min-w-0 overflow-hidden">
                                                        <div className="flex flex-col min-w-0 overflow-hidden">
                                                            <span className={`truncate leading-tight ${row.is_our_club ? 'font-extrabold text-primary' : 'font-semibold text-foreground'}`}>
                                                                {row.team_name}
                                                            </span>
                                                            {(isNextOpp || streakLabel) && (
                                                                <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                                                    {isNextOpp && (
                                                                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500 text-white px-1.5 py-0 text-[9px] font-extrabold uppercase tracking-tight max-w-full truncate">
                                                                            <Zap className="h-2.5 w-2.5 fill-white text-white shrink-0" />
                                                                            <span className="truncate">Next {formattedNextDate ? `• ${formattedNextDate}` : ""} ({nextOpponentInfo?.is_home ? "H" : "A"})</span>
                                                                        </span>
                                                                    )}
                                                                    {streakLabel && (
                                                                        <span className="inline-flex items-center rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/35 px-1.5 py-0 text-[9px] font-bold max-w-full truncate">
                                                                            {streakLabel}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {mobileTableView === 'overview' && (
                                                        <>
                                                            <td className="py-2.5 text-center text-muted-foreground font-medium">{row.played}</td>
                                                            <td className={`py-2.5 text-center font-mono text-[11px] ${gdColorClass}`}>
                                                                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                                            </td>
                                                            <td className="py-2.5 text-center font-extrabold text-foreground">{row.points}</td>
                                                            <td className="pl-0.5 pr-2 py-2.5 text-right whitespace-nowrap overflow-hidden">
                                                                {formItems.length > 0 ? (
                                                                    <div className="inline-flex items-center justify-end gap-[2px]">
                                                                        {formItems.map((res, fIdx) => {
                                                                            const dotColor =
                                                                                res === 'W'
                                                                                    ? 'bg-emerald-500 text-white'
                                                                                    : res === 'D'
                                                                                        ? 'bg-amber-500 text-white'
                                                                                        : 'bg-rose-500 text-white';
                                                                            return (
                                                                                <span
                                                                                    key={fIdx}
                                                                                    className={`inline-flex items-center justify-center w-[13px] h-[15px] rounded-[3px] text-[8px] font-black leading-none shrink-0 ${dotColor}`}
                                                                                >
                                                                                    {res}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground/40">—</span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}

                                                    {mobileTableView === 'full' && (
                                                        <>
                                                            <td className="py-2.5 text-center text-muted-foreground">{row.played}</td>
                                                            <td className="py-2.5 text-center text-foreground">{row.won}</td>
                                                            <td className="py-2.5 text-center text-muted-foreground">{row.drawn}</td>
                                                            <td className="py-2.5 text-center text-muted-foreground">{row.lost}</td>
                                                            <td className={`py-2.5 text-center font-mono text-[11px] ${gdColorClass}`}>
                                                                {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                                            </td>
                                                            <td className="pr-2 py-2.5 text-center font-extrabold text-foreground">{row.points}</td>
                                                        </>
                                                    )}

                                                    {mobileTableView === 'form' && (
                                                        <>
                                                            <td className="py-2.5 text-center font-mono text-[11px] font-semibold text-muted-foreground">
                                                                {rowPpg}
                                                            </td>
                                                            <td className="pl-1 pr-2 py-2.5 text-right whitespace-nowrap overflow-hidden">
                                                                {formItems.length > 0 ? (
                                                                    <div className="inline-flex items-center justify-end gap-1">
                                                                        {formItems.map((res, fIdx) => {
                                                                            const pillStyles =
                                                                                res === 'W'
                                                                                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/45'
                                                                                    : res === 'D'
                                                                                        ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/45'
                                                                                        : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/45';
                                                                            return (
                                                                                <span
                                                                                    key={fIdx}
                                                                                    className={`inline-flex items-center justify-center w-[17px] h-[17px] rounded text-[9px] font-bold border shrink-0 ${pillStyles}`}
                                                                                >
                                                                                    {res}
                                                                                </span>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-[10px] text-muted-foreground/40">—</span>
                                                                )}
                                                            </td>
                                                        </>
                                                    )}
                                                </tr>

                                                {/* Tap-to-Expand Full Team Stats Drawer on Mobile */}
                                                {isExpanded && (
                                                    <tr className="bg-surface-2/60 border-b border-border">
                                                        <td colSpan={colSpanCount} className="px-3 py-2.5">
                                                            <div className="flex flex-col gap-2">
                                                                <div className="grid grid-cols-5 gap-1.5 text-center">
                                                                    <div className="bg-surface-1 rounded-lg p-1.5 border border-border">
                                                                        <div className="text-[9px] uppercase text-muted-foreground font-bold">W - D - L</div>
                                                                        <div className="text-xs font-extrabold text-foreground mt-0.5">
                                                                            {row.won}-{row.drawn}-{row.lost}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-surface-1 rounded-lg p-1.5 border border-border">
                                                                        <div className="text-[9px] uppercase text-muted-foreground font-bold">GF : GA</div>
                                                                        <div className="text-xs font-extrabold text-foreground mt-0.5">
                                                                            {row.goals_for ?? 0}:{row.goals_against ?? 0}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-surface-1 rounded-lg p-1.5 border border-border">
                                                                        <div className="text-[9px] uppercase text-muted-foreground font-bold">GD</div>
                                                                        <div className={`text-xs font-extrabold mt-0.5 ${gdColorClass}`}>
                                                                            {row.goal_difference > 0 ? `+${row.goal_difference}` : row.goal_difference}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-surface-1 rounded-lg p-1.5 border border-border">
                                                                        <div className="text-[9px] uppercase text-muted-foreground font-bold">PPG</div>
                                                                        <div className="text-xs font-extrabold text-foreground mt-0.5">
                                                                            {rowPpg}
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-surface-1 rounded-lg p-1.5 border border-brand/30">
                                                                        <div className="text-[9px] uppercase text-brand font-bold">Points</div>
                                                                        <div className="text-xs font-black text-foreground mt-0.5">
                                                                            {row.points}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </CardContent>
                    </Card>
                </div>

                {/* ================================================================= */}
                {/* DESKTOP STANDINGS TABLE (>= 768px) — 100% UNTOUCHED               */}
                {/* ================================================================= */}
                <Card className="hidden md:block border-border bg-surface-1">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="text-xs text-muted-foreground uppercase bg-surface-2 border-b border-border select-none">
                                    <tr>
                                        <th
                                            onClick={() => handleSortColumn('position')}
                                            className="px-2.5 sm:px-4 py-3 font-medium cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            Pos {sortField === 'position' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th className="px-2.5 sm:px-4 py-3 font-medium">Club</th>
                                        <th
                                            onClick={() => handleSortColumn('played')}
                                            className="px-2 sm:px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            P {sortField === 'played' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('won')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            W {sortField === 'won' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('drawn')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            D {sortField === 'drawn' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('lost')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            L {sortField === 'lost' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('goals_for')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            GF {sortField === 'goals_for' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('goals_against')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            GA {sortField === 'goals_against' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('goal_difference')}
                                            className="px-2 sm:px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            GD {sortField === 'goal_difference' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('points')}
                                            className="px-2.5 sm:px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                        >
                                            Pts {sortField === 'points' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th
                                            onClick={() => handleSortColumn('ppg')}
                                            className="hidden md:table-cell px-4 py-3 font-medium text-center cursor-pointer hover:text-foreground transition-colors whitespace-nowrap"
                                            title="Click to sort by Points Per Game"
                                        >
                                            PPG {sortField === 'ppg' && (sortDir === 'asc' ? '▲' : '▼')}
                                        </th>
                                        <th className="px-2.5 sm:px-4 py-3 font-medium text-center">Last 5</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedRows.map((row, idx) => {
                                            const isNextOpp =
                                                nextOpponentInfo &&
                                                !row.is_our_club &&
                                                isMatchingTeamName(row.team_name, nextOpponentInfo.opponent);

                                            const formattedNextDate = nextOpponentInfo?.date
                                                ? new Date(nextOpponentInfo.date + "T12:00:00").toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                                                : "";

                                            const posDiff = (row.previous_position ?? row.position) - row.position;
                                            const formItems = Array.isArray(row.form) ? row.form.slice(-5) : [];
                                            const rowPpg = row.played > 0 ? (row.points / row.played).toFixed(2) : "0.00";

                                            // Feature #8: Unbeaten or Winning Streak Detection
                                            let trailingWins = 0;
                                            for (let i = formItems.length - 1; i >= 0; i--) {
                                                if (formItems[i] === 'W') trailingWins++;
                                                else break;
                                            }
                                            const isUnbeatenSeason = row.played >= 3 && row.lost === 0;
                                            const streakLabel = isUnbeatenSeason
                                                ? `🔥 ${row.played} Unbeaten`
                                                : trailingWins >= 4
                                                    ? `🔥 ${trailingWins}W Streak`
                                                    : null;

                                            // Feature #2: Colour-coded Goal Difference
                                            const gdColorClass =
                                                row.goal_difference > 0
                                                    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
                                                    : row.goal_difference < 0
                                                        ? 'text-rose-600 dark:text-rose-400 font-semibold'
                                                        : 'text-muted-foreground';

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
                                                    <td className="px-2.5 sm:px-4 py-3 font-semibold whitespace-nowrap">
                                                        <div className="flex items-center gap-1.5 sm:gap-2">
                                                            <span className="w-5 text-right">{row.position}</span>
                                                            {posDiff > 0 ? (
                                                                <span
                                                                    className="inline-flex items-center text-[10px] font-bold text-white bg-emerald-600 px-1.5 py-0.5 rounded shadow-xs"
                                                                    title={`Up ${posDiff} from #${row.previous_position}`}
                                                                >
                                                                    <ArrowUp className="h-2.5 w-2.5 mr-0.5 stroke-[3]" />
                                                                    {posDiff}
                                                                </span>
                                                            ) : posDiff < 0 ? (
                                                                <span
                                                                    className="inline-flex items-center text-[10px] font-bold text-white bg-rose-600 px-1.5 py-0.5 rounded shadow-xs"
                                                                    title={`Down ${Math.abs(posDiff)} from #${row.previous_position}`}
                                                                >
                                                                    <ArrowDown className="h-2.5 w-2.5 mr-0.5 stroke-[3]" />
                                                                    {Math.abs(posDiff)}
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center text-muted-foreground/50" title="No change">
                                                                    <Minus className="h-3 w-3" />
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className={`px-2.5 sm:px-4 py-3 ${row.is_our_club ? 'font-bold text-primary' : 'font-medium text-foreground'}`}>
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span>{row.team_name}</span>
                                                            {/* Feature #2: Next Opponent Spotlight Pill */}
                                                            {isNextOpp && (
                                                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 text-white px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-xs">
                                                                    <Zap className="h-3 w-3 fill-white text-white" />
                                                                    Next Up {formattedNextDate ? `• ${formattedNextDate}` : ""} ({nextOpponentInfo?.is_home ? "H" : "A"})
                                                                </span>
                                                            )}
                                                            {/* Feature #8: Unbeaten / Winning Streak Pill */}
                                                            {streakLabel && (
                                                                <span className="inline-flex items-center rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 border border-orange-500/35 px-2 py-0.5 text-[10px] font-bold tracking-tight">
                                                                    {streakLabel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-2 sm:px-4 py-3 text-center">{row.played}</td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center">{row.won}</td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center">{row.drawn}</td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center">{row.lost}</td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center text-muted-foreground">{row.goals_for ?? "-"}</td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center text-muted-foreground">{row.goals_against ?? "-"}</td>
                                                    <td className={`px-2 sm:px-4 py-3 text-center font-mono text-xs ${gdColorClass}`}>
                                                        {row.goal_difference > 0 ? '+' + row.goal_difference : row.goal_difference}
                                                    </td>
                                                    <td className="px-2.5 sm:px-4 py-3 text-center font-bold text-foreground whitespace-nowrap">
                                                        {row.points}
                                                    </td>
                                                    <td className="hidden md:table-cell px-4 py-3 text-center font-mono text-xs font-semibold text-muted-foreground whitespace-nowrap">
                                                        {rowPpg}
                                                    </td>
                                                    {/* Feature #6: Last 5 Form Pills */}
                                                    <td className="px-2.5 sm:px-4 py-3 text-center whitespace-nowrap">
                                                        {formItems.length > 0 ? (
                                                            <div className="inline-flex items-center gap-1">
                                                                {formItems.map((res, fIdx) => {
                                                                    const pillStyles =
                                                                        res === 'W'
                                                                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/45'
                                                                            : res === 'D'
                                                                                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/45'
                                                                                : 'bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-500/45';
                                                                    return (
                                                                        <span
                                                                            key={fIdx}
                                                                            className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold border ${pillStyles}`}
                                                                            title={fIdx === formItems.length - 1 ? `Latest match: ${res}` : res}
                                                                        >
                                                                            {res}
                                                                        </span>
                                                                    );
                                                                })}
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-muted-foreground/40">—</span>
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
                    <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                        <div className="bg-surface-1 border border-border rounded-2xl max-w-2xl w-full p-4 sm:p-6 space-y-3.5 sm:space-y-4 shadow-2xl my-auto">
                            <div className="flex items-center justify-between border-b border-border pb-3">
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                                        <Share2 className="h-4 w-4 sm:h-5 sm:w-5 text-brand" />
                                        <span>Share League Table Graphic</span>
                                    </h3>
                                    <p className="text-[11px] sm:text-xs text-muted-foreground">
                                        Ready for Instagram Stories, WhatsApp Squad Chats, or X/Twitter.
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setShowShareModal(false)} className="h-8 w-8 p-0">
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-border w-full sm:w-auto">
                                    <button
                                        onClick={() => setGraphicFormat('post')}
                                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${graphicFormat === 'post' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Feed Post (4:5)
                                    </button>
                                    <button
                                        onClick={() => setGraphicFormat('story')}
                                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${graphicFormat === 'story' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Story (9:16)
                                    </button>
                                </div>

                                <div className="flex items-center gap-1 bg-surface-2 p-1 rounded-lg border border-border w-full sm:w-auto">
                                    <button
                                        onClick={() => setGraphicScope('full')}
                                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${graphicScope === 'full' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Full Division ({currentTable.length})
                                    </button>
                                    <button
                                        onClick={() => setGraphicScope('top8')}
                                        className={`flex-1 sm:flex-initial px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${graphicScope === 'top8' ? 'bg-brand text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                    >
                                        Top 8 Spotlight
                                    </button>
                                </div>
                            </div>

                            <div className="bg-black/50 border border-border rounded-xl p-2.5 sm:p-3 flex justify-center max-h-[48vh] sm:max-h-[55vh] overflow-y-auto">
                                <canvas
                                    ref={shareCanvasRef}
                                    className="max-w-full h-auto rounded-lg shadow-lg"
                                    style={{ maxHeight: "44vh" }}
                                />
                            </div>

                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
                                <Button variant="outline" onClick={handleCopyGraphic} className="w-full sm:w-auto font-semibold">
                                    <Share2 className="h-4 w-4 mr-1.5" />
                                    {copiedGraphic ? "Copied to Clipboard!" : "Share"}
                                </Button>
                                <Button onClick={handleDownloadGraphic} className="bg-brand hover:bg-brand/90 text-white font-semibold w-full sm:w-auto">
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
            className="h-full flex flex-col gap-5 md:gap-6 max-w-2xl mx-auto py-4 md:py-12 pb-20 md:pb-12"
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

            <div className="text-center mb-1 md:mb-2">
                <div className="mx-auto h-14 w-14 md:h-16 md:w-16 bg-brand/10 rounded-full flex items-center justify-center mb-3 md:mb-4">
                    <Trophy className="h-7 w-7 md:h-8 md:w-8 text-brand" />
                </div>
                <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Set Up Your League Once</h2>
                <p className="text-muted-foreground mt-2 text-xs sm:text-base max-w-lg mx-auto">
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
                <CardContent className="p-4 sm:p-6 space-y-4">
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
                            "Paste your league link (Mitoo, FA Full-Time, Pitchero) OR paste your league table rows once:\n\nhttps://fulltime.thefa.com/...\nor\n1   ClubFlow United   11   8   2   0   45   8   +37   26"
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
