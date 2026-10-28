"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Match } from "@/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, CalendarDays, Clock, MapPin, Trophy, Target, Upload, Activity, Edit2, Filter, ArrowUpDown, Instagram, MessageCircle, Copy, ExternalLink, CloudRain, Snowflake, Thermometer, CloudLightning, Sun, AlertCircle, BarChart3, Share2, Coins, ClipboardPaste, Search, CheckSquare, Square, RotateCcw, CheckCircle2, AlertTriangle, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { RefreshCw } from "lucide-react";
import { MatchStatsDialog } from "@/components/matches/match-stats-dialog";
import { FORMATIONS } from "@/lib/formations";
import { calculateMeetTime, generateWhatsAppMessage } from "@/lib/whatsapp-utils";
import { FootballDataImportCentre } from "./components/FootballDataImportCentre";
import { NextMatchHero } from "./components/NextMatchHero";
import { UpcomingFixtures } from "./components/UpcomingFixtures";
import { RecentResults } from "./components/RecentResults";
import { QuickResultScorersModal } from "./components/QuickResultScorersModal";
import { WeeklyFootballCalendar } from "@/components/calendar/WeeklyFootballCalendar";
import { parseMatchScoreline, parseStatTextString, extractLineupFromRawNotes } from "@/lib/match-stats-sync";

export default function MatchesPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [matches, setMatches] = useState<Match[]>([]);
    const [weatherForecast, setWeatherForecast] = useState<Record<string, { tempMax: number, tempMin: number, rain: number, snow: number, code: number }>>({});
    const [leagueTeams, setLeagueTeams] = useState<any[]>([]);

    useEffect(() => {
        if (searchParams?.get("add") === "true") {
            setIsAddOpen(true);
        }
    }, [searchParams]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const { settings, updateSettings } = useClub();
    const { clubId } = useAuth();
    const [isSyncing, setIsSyncing] = useState(false);
    const [isEditingUrl, setIsEditingUrl] = useState(false);
    const [tempUrl, setTempUrl] = useState("");

    // New Redesign States (#1-#20)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [lastImportedIds, setLastImportedIds] = useState<string[]>([]);
    const [quickResultMatch, setQuickResultMatch] = useState<Match | null>(null);
    const [viewSection, setViewSection] = useState<"all" | "upcoming" | "results">("all");
    const [opponentSearch, setOpponentSearch] = useState("");
    const [isBulkSelectMode, setIsBulkSelectMode] = useState(false);
    const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set());

    // Quick-Add Fixture Bar State (#3)
    const [quickDate, setQuickDate] = useState(() => new Date().toISOString().split("T")[0]);
    const [quickTime, setQuickTime] = useState("14:00");
    const [quickIsHome, setQuickIsHome] = useState(true);
    const [quickOpponent, setQuickOpponent] = useState("");
    const [quickCompetition, setQuickCompetition] = useState("League");
    const [isQuickAdding, setIsQuickAdding] = useState(false);
    const [isMobileQuickAddOpen, setIsMobileQuickAddOpen] = useState(false);

    const [opponentInstagram, setOpponentInstagram] = useState("");
    const [opponentBadgeUrl, setOpponentBadgeUrl] = useState("");
    const [isUploadingBadge, setIsUploadingBadge] = useState(false);

    // WhatsApp Generated Availability Poll State
    const [activeShareMatch, setActiveShareMatch] = useState<Match | null>(null);
    const [includeOpponent, setIncludeOpponent] = useState(true);
    const [includeCompetition, setIncludeCompetition] = useState(true);
    const [includeVenue, setIncludeVenue] = useState(true);
    const [includeKickoff, setIncludeKickoff] = useState(true);
    const [includeMeetTime, setIncludeMeetTime] = useState(true);
    const [meetTime, setMeetTime] = useState("");

    // Matchday Expenses State
    const [isExpenseOpen, setIsExpenseOpen] = useState(false);
    const [selectedExpenseMatch, setSelectedExpenseMatch] = useState<Match | null>(null);
    const [expenseAmount, setExpenseAmount] = useState("");
    const [expenseCategory, setExpenseCategory] = useState("Ref Fees");
    const [expenseNotes, setExpenseNotes] = useState("");



    const handleSaveExpense = async () => {
        if (!selectedExpenseMatch) return;
        const amt = parseFloat(expenseAmount);
        if (isNaN(amt) || amt <= 0) {
            alert("Please enter a valid expense amount.");
            return;
        }

        const notesPart = expenseNotes.trim() ? ` (${expenseNotes.trim()})` : "";
        const desc = `${expenseCategory} - vs ${selectedExpenseMatch.opponent}${notesPart}`;

        const payload = {
            date: selectedExpenseMatch.date,
            description: desc,
            amount: amt,
            type: "Expense",
            category: expenseCategory,
            is_recurring: false,
            frequency: null
        };

        try {
            const { error } = await supabase
                .from("finance_transactions")
                .insert([payload]);

            if (error) throw error;
            alert("Expense logged successfully!");
            setIsExpenseOpen(false);
            setExpenseAmount("");
            setExpenseNotes("");
        } catch (e: any) {
            alert("Failed to log expense: " + e.message);
        }
    };
    const [meetLocation, setMeetLocation] = useState("");
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

    // Opposition & Referee Confirmation Modal States
    const [selectedConfirmMatch, setSelectedConfirmMatch] = useState<Match | null>(null);
    const [confirmStadiumAddress, setConfirmStadiumAddress] = useState("");
    const [confirmSurfaceType, setConfirmSurfaceType] = useState("3G Pitch");
    const [confirmRefFee, setConfirmRefFee] = useState("45");
    const [confirmPaymentMethod, setConfirmPaymentMethod] = useState("Bank Transfer");
    const [confirmDietaryDetails, setConfirmDietaryDetails] = useState("Plates of chips/pizza at the clubhouse");
    const [confirmKitColors, setConfirmKitColors] = useState("Red Shirts, Black Shorts, Red Socks");
    const [confirmMeetTimeOffset, setConfirmMeetTimeOffset] = useState("-60");
    const [confirmRefName, setConfirmRefName] = useState("Referee");
    const [confirmCopyStatus, setConfirmCopyStatus] = useState<"idle" | "opp_copied" | "ref_copied">("idle");

    const getCurrentSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0 = Jan, 5 = Jun
        return month >= 5 
            ? `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`
            : `${(year - 1).toString().slice(2)}/${year.toString().slice(2)}`;
    };

    const getNextSeasonStr = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = d.getMonth();
        return month >= 5
            ? `${(year + 1).toString().slice(2)}/${(year + 2).toString().slice(2)}`
            : `${year.toString().slice(2)}/${(year + 1).toString().slice(2)}`;
    };

    // UI State
    const [filterType, setFilterType] = useState<"all" | "league" | "cup" | "friendly">("all");
    const [seasonFilter, setSeasonFilter] = useState<string>("26/27");
    const [resultSort, setResultSort] = useState<"desc" | "asc">("desc"); // desc = Newest First

    const [players, setPlayers] = useState<any[]>([]);

    const fetchPlayers = async () => {
        const { data, error } = await supabase
            .from('players')
            .select('id, first_name, last_name, nickname, use_nickname')
            .order('first_name');
        if (data) setPlayers(data);
    };

    // Format name correctly (first initial + last name) e.g. "J.Smith"
    const getFormattedPlayerName = (player: any) => {
        if (!player) return "";
        const firstInitial = player.first_name ? player.first_name[0] : "";
        return `${firstInitial}.${player.last_name}`;
    };

    // Form State
    const [formData, setFormData] = useState<any>({
        date: "",
        time: "15:00",
        meetTime: "14:00",
        opponent: "",
        isHome: true,
        competition: "League Match",
        scoreline: "",
        goalscorers: "",
        assists: "",
        yellow_cards: "",
        red_cards: "",
        notes: "",
        surface: "4G",
        location: "",
        lockType: "Never",
        lockTime: ""
    });

    const hasLoadedRef = useRef(false);

    // Restore fixture editing form draft on mount
    useEffect(() => {
        const savedDraft = sessionStorage.getItem("fixture_form_draft");
        if (savedDraft) {
            try {
                const parsed = JSON.parse(savedDraft);
                if (parsed.isAddOpen !== undefined) setIsAddOpen(parsed.isAddOpen);
                if (parsed.editingId !== undefined) setEditingId(parsed.editingId);
                if (parsed.formData !== undefined) setFormData(parsed.formData);
                if (parsed.opponentInstagram !== undefined) setOpponentInstagram(parsed.opponentInstagram);
                if (parsed.opponentBadgeUrl !== undefined) setOpponentBadgeUrl(parsed.opponentBadgeUrl);
            } catch (e) {
                console.error("Error restoring fixture form draft:", e);
            }
        }
        hasLoadedRef.current = true;
    }, []);

    // Save fixture editing form draft on modification
    useEffect(() => {
        if (!hasLoadedRef.current) return;
        const draft = {
            isAddOpen,
            editingId,
            formData,
            opponentInstagram,
            opponentBadgeUrl
        };
        sessionStorage.setItem("fixture_form_draft", JSON.stringify(draft));
    }, [isAddOpen, editingId, formData, opponentInstagram, opponentBadgeUrl]);

    const getLocalDateString = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Load Matches and League Teams from Supabase
    useEffect(() => {
        fetchMatches();
        fetchLeagueTeams();
        fetchPlayers();

        const fetchWeather = async () => {
            try {
                // Free keyless forecast for London (Camden area)
                const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=51.5074&longitude=-0.1278&daily=weathercode,temperature_2m_max,temperature_2m_min,rain_sum,snowfall_sum&timezone=Europe/London");
                const data = await res.json();
                if (data && data.daily) {
                    const forecast: Record<string, { tempMax: number, tempMin: number, rain: number, snow: number, code: number }> = {};
                    data.daily.time.forEach((dateStr: string, idx: number) => {
                        forecast[dateStr] = {
                            tempMax: data.daily.temperature_2m_max[idx],
                            tempMin: data.daily.temperature_2m_min[idx],
                            rain: data.daily.rain_sum[idx],
                            snow: data.daily.snowfall_sum[idx],
                            code: data.daily.weathercode[idx]
                        };
                    });
                    setWeatherForecast(forecast);
                }
            } catch (e) {
                console.error("Failed to load weather forecast:", e);
            }
        };
        fetchWeather();

        const channel = supabase
            .channel("public:matches")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "matches" },
                () => fetchMatches()
            )
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, []);

    useEffect(() => {
        if (clubId) {
            fetchMatches();
        }
    }, [clubId]);

    async function fetchLeagueTeams() {
        const { data } = await supabase.from("league_teams").select("*");
        if (data) setLeagueTeams(data);
    }

    function extractLineupBlock(rawNotesStr: string) {
        return extractLineupFromRawNotes(rawNotesStr);
    }

    async function fetchMatches() {
        let query = supabase.from("matches").select("*");
        if (clubId) {
            query = query.eq("club_id", clubId);
        }
        const { data, error } = await query;
        if (error) {
            console.warn("Error fetching matches:", error.message || error);
            return;
        }

        const mapped: Match[] = (data || []).map((m: any) => {
            const extracted = extractLineupBlock(m.notes || "");
            if (extracted.wasRepaired && extracted.normalizedRawNotes) {
                supabase.from("matches").update({ notes: extracted.normalizedRawNotes }).eq("id", m.id).then(() => {});
            }

            const parsedLineup = extracted.parsedLineup;
            const notesToScan = extracted.normalizedRawNotes || m.notes || "";
            const locationMatch = notesToScan ? notesToScan.match(/\[Location:\s*([^\]]*)\]/i) : null;
            const rawLocFromTag = locationMatch ? locationMatch[1].trim() : "";
            const location = (parsedLineup?.venueNotes && parsedLineup.venueNotes.trim())
                ? parsedLineup.venueNotes.trim()
                : rawLocFromTag;

            const surfaceMatch = notesToScan ? notesToScan.match(/\[Surface:\s*([^\]]*)\]/i) : null;
            const surface = surfaceMatch ? surfaceMatch[1].trim() : "4G";

            const meetTimeMatch = notesToScan ? notesToScan.match(/\[MeetTime:\s*([^\]]*)\]/i) : null;
            const rawMeetFromTag = meetTimeMatch ? meetTimeMatch[1].trim() : "";
            const fallbackOffset = typeof parsedLineup?.meetOffsetMinutes === "number" && parsedLineup.meetOffsetMinutes !== 0
                ? -Math.abs(parsedLineup.meetOffsetMinutes)
                : (m.is_home ? -60 : -75);
            const meetTime = (parsedLineup?.meetTime && parsedLineup.meetTime.trim())
                ? parsedLineup.meetTime.trim()
                : (rawMeetFromTag || (m.time ? calculateMeetTime(m.time, fallbackOffset) : ""));

            let cleanNotes = extracted.cleanNotes;
            cleanNotes = cleanNotes.replace(/\[Location: .*?\]\n?/gi, "");
            cleanNotes = cleanNotes.replace(/\[Surface: .*?\]\n?/gi, "");
            cleanNotes = cleanNotes.replace(/\[MeetTime: .*?\]\n?/gi, "");
            cleanNotes = cleanNotes.replace(/(?:,?\s*["']usedSubstitutes["']\s*:\s*\[\]\s*\}\s*)+/g, "");
            cleanNotes = cleanNotes.replace(/^,\s*/, "").replace(/^[,\s\}\{]+/, "").trim();
            
            const isKnownCupFixture = (m.date === "2026-11-10" && /samurai/i.test(m.opponent || "")) || (m.date === "2026-11-21" && /wood\s+lane/i.test(m.opponent || ""));
            const isKnownMislabelledLeague = ["2026-11-14", "2026-11-28", "2026-12-05", "2026-12-12", "2026-12-19", "2027-01-09"].includes(m.date) && m.competition === "Cup";
            const normalizedCompetition = isKnownCupFixture
                ? (m.competition && m.competition !== "League" ? m.competition : "Cup")
                : (isKnownMislabelledLeague ? "League" : (m.competition || "League"));
            if (normalizedCompetition !== m.competition) {
                supabase.from("matches").update({ competition: normalizedCompetition }).eq("id", m.id).then(() => {});
            }

            return {
                id: m.id,
                date: m.date,
                time: m.time,
                meetTime: meetTime,
                opponent: m.opponent,
                isHome: m.is_home,
                competition: normalizedCompetition,
                scoreline: m.scoreline,
                result: m.result,
                goalscorers: m.goalscorers,
                assists: m.assists,
                yellow_cards: m.yellow_cards,
                red_cards: m.red_cards,
                notes: cleanNotes,
                rawNotes: extracted.normalizedRawNotes || m.notes || "",
                surface: surface,
                location: location,
                lineup: parsedLineup,
                is_squad_confirmed: Boolean(m.is_squad_confirmed || (parsedLineup && Object.values(parsedLineup.starters || {}).some(Boolean)))
            } as any;
        });

        setMatches(mapped);
    }

    const autoCalculateMeetTime = (kickoffTime: string, isHome: boolean): string => {
        const offset = isHome ? -60 : -75;
        return calculateMeetTime(kickoffTime, offset);
    };

    const handleKickoffChange = (newTime: string) => {
        const computed = autoCalculateMeetTime(newTime, formData.isHome);
        setFormData((prev: any) => ({
            ...prev,
            time: newTime,
            meetTime: computed
        }));
    };

    const handleVenueChange = (isHome: boolean) => {
        const computed = autoCalculateMeetTime(formData.time, isHome);
        setFormData((prev: any) => ({
            ...prev,
            isHome,
            meetTime: computed
        }));
    };

    // Quick-Add 1-line fixture handler (#3)
    const handleQuickAddFixture = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!quickOpponent.trim() || !quickDate) return;
        setIsQuickAdding(true);
        try {
            const meet = autoCalculateMeetTime(quickTime || "14:00", quickIsHome);
            const loc = quickIsHome ? (settings.homeGround || "Home") : "Away";
            const payload: any = {
                club_id: clubId || undefined,
                date: quickDate,
                time: quickTime || "14:00",
                opponent: quickOpponent.trim(),
                is_home: quickIsHome,
                competition: quickCompetition || "League",
                scoreline: "",
                result: "Pending",
                notes: `[Location: ${loc}][Surface: 4G][MeetTime: ${meet}]`,
                event_token: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            };
            const { error } = await supabase.from("matches").insert([payload]);
            if (error) throw error;
            setQuickOpponent("");
            await fetchMatches();
        } catch (err: any) {
            alert("Failed to quick-add fixture: " + err.message);
        } finally {
            setIsQuickAdding(false);
        }
    };

    const handleSaveMatch = async () => {
        if (!formData.opponent || !formData.date) return;

        let cleanScoreline = formData.scoreline;
        if (cleanScoreline && cleanScoreline.includes('-')) {
            const parts = cleanScoreline.split('-');
            if (parts[0].trim() === "" && parts[1].trim() === "") {
                cleanScoreline = "";
            } else {
                const home = parts[0].trim() || "0";
                const away = parts[1].trim() || "0";
                cleanScoreline = `${home} - ${away}`;
            }
        }

        const result = determineResult(cleanScoreline, formData.isHome);
        const isNew = !editingId;

        // Build combined metadata in the notes column
        const locationPrefix = `[Location: ${formData.location || ""}]`;
        const surfacePrefix = `[Surface: ${formData.surface || "4G"}]`;
        const meetTimePrefix = `[MeetTime: ${formData.meetTime || ""}]`;
        
        let lineupTag = "";
        let existingUserNotes = "";
        if (editingId) {
            const currentMatch = matches.find(m => m.id === editingId);
            if (currentMatch) {
                if ((currentMatch as any).rawNotes && (currentMatch as any).rawNotes.includes("[Lineup: ")) {
                    const extracted = extractLineupBlock((currentMatch as any).rawNotes);
                    if (extracted.parsedLineup) {
                        const updatedLineupObj = { ...extracted.parsedLineup };
                        if (formData.meetTime) {
                            updatedLineupObj.meetTime = formData.meetTime.trim();
                            const [koH, koM] = (formData.time || "14:00").split(":").map(Number);
                            const [mtH, mtM] = formData.meetTime.trim().split(":").map(Number);
                            if (!isNaN(koH) && !isNaN(koM) && !isNaN(mtH) && !isNaN(mtM)) {
                                let diff = (koH * 60 + koM) - (mtH * 60 + mtM);
                                if (diff < 0) diff += 24 * 60;
                                if (diff > 0 && diff <= 240) {
                                    updatedLineupObj.meetOffsetMinutes = diff;
                                }
                            }
                        }
                        if (formData.location && formData.location !== "Home" && formData.location !== "Away") {
                            updatedLineupObj.venueNotes = formData.location.trim();
                        }
                        lineupTag = `[Lineup: ${JSON.stringify(updatedLineupObj)}]\n`;
                    } else if (extracted.lineupTag) {
                        lineupTag = extracted.lineupTag + "\n";
                    }
                }
                
                // Check if there is actual plain-text user note existing
                if (currentMatch.notes) {
                    const onlyLettersNumbers = currentMatch.notes.replace(/[\{\}\[\]\s,]+/g, "").trim();
                    // If the cleaned text has actual words and isn't just leftover garbage brackets
                    if (onlyLettersNumbers && onlyLettersNumbers !== "1") {
                        existingUserNotes = currentMatch.notes;
                    }
                }
            }
        }
        
        const finalUserNotes = (formData.notes || "").trim() || existingUserNotes;
        const combinedNotes = `${lineupTag}${locationPrefix}${surfacePrefix}${meetTimePrefix}\n${finalUserNotes}`.trim();

        const payload: any = {
            date: formData.date,
            time: formData.time,
            opponent: formData.opponent,
            is_home: formData.isHome,
            competition: formData.competition,
            scoreline: cleanScoreline,
            result: result,
            goalscorers: formData.goalscorers,
            assists: formData.assists,
            yellow_cards: formData.yellow_cards,
            red_cards: formData.red_cards,
            notes: combinedNotes,
            lock_type: formData.lockType || "Never",
            lock_time: formData.lockTime ? new Date(formData.lockTime).toISOString() : null
        };

        try {
            let matchId = editingId;
            if (isNew) {
                if (clubId) payload.club_id = clubId;
                payload.event_token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                const { data, error } = await supabase.from("matches").insert([payload]).select().single();
                if (error) throw error;
                matchId = data.id;
            } else {
                const { error } = await supabase.from("matches").update(payload).eq("id", editingId);
                if (error) throw error;
            }

            // Sync details to league_teams inline
            try {
                const teamNameClean = formData.opponent.trim();
                if (teamNameClean) {
                    const existingTeam = leagueTeams.find(t => (t.name || t.team_name || "").toLowerCase() === teamNameClean.toLowerCase());
                    const teamPayload = {
                        name: teamNameClean,
                        badge_url: opponentBadgeUrl || null,
                        instagram_handle: opponentInstagram || null
                    };

                    if (existingTeam) {
                        await supabase.from("league_teams").update({
                            badge_url: opponentBadgeUrl || null,
                            instagram_handle: opponentInstagram || null
                        }).eq("id", existingTeam.id);
                    } else {
                        await supabase.from("league_teams").insert([teamPayload]);
                    }
                    await fetchLeagueTeams();
                }
            } catch (teamError) {
                console.error("Failed to sync opponent settings:", teamError);
            }

            // Explicitly fetch matches to ensure the screen updates instantly
            await fetchMatches();
            resetForm();
        } catch (e: any) {
            alert("Error saving match: " + e.message);
        }
    };

    const handleEditMatch = async (match: Match) => {
        setFormData({
            date: match.date,
            time: match.time,
            meetTime: (match as any).meetTime || autoCalculateMeetTime(match.time, match.isHome),
            opponent: match.opponent,
            isHome: match.isHome,
            competition: match.competition,
            scoreline: match.scoreline || "",
            goalscorers: match.goalscorers || "",
            assists: match.assists || "",
            yellow_cards: match.yellow_cards || "",
            red_cards: match.red_cards || "",
            notes: "", // Leave blank by default so users can add custom notes/adjustments
            surface: match.surface || "4G",
            location: match.location || "",
            lockType: (match as any).lock_type || "Never",
            lockTime: (match as any).lock_time ? new Date((match as any).lock_time).toISOString().slice(0, 16) : ""
        });
        setEditingId(match.id);
        const teamMatch = leagueTeams.find(t => (t.name || t.team_name || "").toLowerCase() === match.opponent.toLowerCase());
        if (teamMatch) {
            setOpponentInstagram(teamMatch.instagram_handle || "");
            setOpponentBadgeUrl(teamMatch.badge_url || "");
        } else {
            setOpponentInstagram("");
            setOpponentBadgeUrl("");
        }
        setIsAddOpen(true);
    };

    const handleDeleteMatch = async (id: string) => {
        if (!confirm("Are you sure you want to delete this match?")) return;
        
        // Optimistically remove from UI instantly
        setMatches(prev => prev.filter(m => m.id !== id));
        setSelectedMatchIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
        
        try {
            await supabase.from('match_player_stats').delete().eq('match_id', id);
            const { error } = await supabase.from('matches').delete().eq('id', id);
            if (error) {
                fetchMatches();
                throw error;
            }
            await fetchMatches();
        } catch (e: any) {
            alert("Failed to delete match: " + e.message);
        }
    };

    const toggleSelectMatch = (id: string) => {
        setSelectedMatchIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleBulkDelete = async () => {
        const ids = Array.from(selectedMatchIds);
        if (ids.length === 0) return;
        if (!confirm(`Delete ${ids.length} selected fixture(s)?`)) return;

        setMatches(prev => prev.filter(m => !selectedMatchIds.has(m.id)));
        setSelectedMatchIds(new Set());
        setIsBulkSelectMode(false);

        try {
            await supabase.from('match_player_stats').delete().in('match_id', ids);
            const { error } = await supabase.from('matches').delete().in('id', ids);
            if (error) throw error;
            await fetchMatches();
        } catch (err: any) {
            alert("Failed to delete selected fixtures: " + err.message);
            fetchMatches();
        }
    };

    const handleUndoLastImport = async () => {
        if (lastImportedIds.length === 0) return;
        if (!confirm(`Undo last import and remove ${lastImportedIds.length} imported fixture(s)?`)) return;
        const idsToDelete = [...lastImportedIds];
        setLastImportedIds([]);
        setMatches(prev => prev.filter(m => !idsToDelete.includes(m.id)));
        try {
            await supabase.from('matches').delete().in('id', idsToDelete);
            await fetchMatches();
        } catch (err: any) {
            alert("Failed to undo import: " + err.message);
            fetchMatches();
        }
    };

    const formatMatchdayDate = (dateStr: string) => {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
        const day = d.getDate();
        const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);
        return `${weekday} ${day} ${month}`;
    };

    const handleOpenConfirmDetails = (match: Match) => {
        setSelectedConfirmMatch(match);
        setConfirmStadiumAddress(settings.homeGround || match.location || "");
        setConfirmSurfaceType("3G Pitch");
        setConfirmRefFee("45");
        setConfirmPaymentMethod("Bank Transfer");
        setConfirmDietaryDetails("Plates of chips/pizza at the clubhouse");
        setConfirmKitColors("Red Shirts, Black Shorts, Red Socks");
        setConfirmMeetTimeOffset("-60");
        setConfirmRefName("Referee");
        setConfirmCopyStatus("idle");
    };

    const handleOpenShare = (match: Match) => {
        const computedMeetTime = calculateMeetTime(match.time, -60);
        const computedMeetLocation = match.isHome ? (settings.homeGround || match.location || "") : (match.location || "");
        
        setActiveShareMatch(match);
        setMeetTime(computedMeetTime);
        setMeetLocation(computedMeetLocation);
        setAdditionalNotes("");
        setCopyStatus("idle");
        
        setIncludeOpponent(true);
        setIncludeCompetition(true);
        setIncludeVenue(true);
        setIncludeKickoff(true);
        setIncludeMeetTime(true);
    };

    const getGeneratedPollText = () => {
        if (!activeShareMatch) return "";

        let parts: string[] = [];
        parts.push("\u26BD MATCH AVAILABILITY");

        if (includeOpponent) {
            const homeTeam = activeShareMatch.isHome ? settings.name : activeShareMatch.opponent;
            const awayTeam = activeShareMatch.isHome ? activeShareMatch.opponent : settings.name;
            parts.push(`\ud83c\udfc6 ${homeTeam} vs ${awayTeam}`);
        }

        let details: string[] = [];
        const dateFormatted = formatMatchdayDate(activeShareMatch.date);
        details.push(`\ud83d\udcc5 ${dateFormatted}`);

        if (includeKickoff) {
            details.push(`\ud83d\udd52 Kick Off: ${activeShareMatch.time}`);
        }

        if (includeMeetTime && meetTime) {
            const locStr = meetLocation ? ` @ ${meetLocation}` : "";
            details.push(`\u23F0 Meet: ${meetTime}${locStr}`);
        }

        if (includeVenue && activeShareMatch.location) {
            const venueType = activeShareMatch.isHome ? "Home" : "Away";
            details.push(`\ud83c\udfdf Venue (${venueType}): ${activeShareMatch.location}`);
        }

        if (includeCompetition && activeShareMatch.competition) {
            details.push(`\ud83c\udfc6 Competition: ${activeShareMatch.competition}`);
        }

        parts.push(details.join("\n"));

        if (additionalNotes.trim()) {
            parts.push(additionalNotes.trim());
        }

        const checkinLink = `${window.location.origin}/respond/${activeShareMatch.event_token || activeShareMatch.id}`;
        parts.push(`\ud83d\udd17 Log availability here:\n${checkinLink}`);

        return parts.join("\n\n");
    };

    const handleCopyShareText = () => {
        const text = getGeneratedPollText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setCopyStatus("copied");
            setTimeout(() => setCopyStatus("idle"), 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
            alert("Failed to copy to clipboard.");
        });
    };

    const handleSendWhatsApp = () => {
        const text = getGeneratedPollText();
        if (!text) return;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const getOpponentConfirmText = () => {
        if (!selectedConfirmMatch) return "";
        const dateFormatted = formatMatchdayDate(selectedConfirmMatch.date);
        const meetTime = calculateMeetTime(selectedConfirmMatch.time, parseInt(confirmMeetTimeOffset));
        return `⚽️ MATCHDAY CONFIRMATION\nHi, hope you're well. Just confirming the match details for this weekend's home game:\n\n🗓 Date: ${dateFormatted}\n⏰ Kick-off: ${selectedConfirmMatch.time} (Meet: ${meetTime})\n🏆 Competition: ${selectedConfirmMatch.competition}\n🆚 ${settings.name} vs ${selectedConfirmMatch.opponent}\n\n📍 Venue: ${confirmStadiumAddress}\n🟢 Pitch Surface: ${confirmSurfaceType}\n👕 Kit Colors: ${confirmKitColors} (Please let us know if there is a kit clash!)\n\n🍔 Post-Match: ${confirmDietaryDetails}\n\nLooking forward to a good game. Let us know if you have any questions!`;
    };

    const getRefConfirmText = () => {
        if (!selectedConfirmMatch) return "";
        const dateFormatted = formatMatchdayDate(selectedConfirmMatch.date);
        return `🏁 REFEREE CONFIRMATION\nHi ${confirmRefName}, hope you're well. Just confirming match details for this weekend's home game:\n\n🗓 Date: ${dateFormatted}\n⏰ Kick-off: ${selectedConfirmMatch.time}\n🏆 Competition: ${selectedConfirmMatch.competition}\n🆚 ${settings.name} vs ${selectedConfirmMatch.opponent}\n\n📍 Venue: ${confirmStadiumAddress}\n🟢 Pitch Surface: ${confirmSurfaceType}\n💰 Ref Fee: £${confirmRefFee} (${confirmPaymentMethod})\n\nLet us know if you can still cover this fixture. Thank you!`;
    };

    const handleCopyOpponentText = () => {
        const text = getOpponentConfirmText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setConfirmCopyStatus("opp_copied");
            setTimeout(() => setConfirmCopyStatus("idle"), 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
            alert("Failed to copy to clipboard.");
        });
    };

    const handleCopyRefText = () => {
        const text = getRefConfirmText();
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            setConfirmCopyStatus("ref_copied");
            setTimeout(() => setConfirmCopyStatus("idle"), 2000);
        }).catch(err => {
            console.error("Failed to copy text:", err);
            alert("Failed to copy to clipboard.");
        });
    };

    const handleSendOpponentWhatsApp = () => {
        const text = getOpponentConfirmText();
        if (!text) return;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleSendRefWhatsApp = () => {
        const text = getRefConfirmText();
        if (!text) return;
        window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
    };

    const handleSyncFixtures = async () => {
        if (!settings.leagueUrl) {
            alert("Please set your League URL in the Club Settings (Settings -> League Integration) first.");
            return;
        }

        setIsSyncing(true);
        try {
            const res = await fetch('/api/sync-fixtures', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: settings.leagueUrl, clubName: settings.name })
            });

            const data = await res.json();
            
            if (data.success && data.matches.length > 0) {
                // Upsert logic: For each scraped match, check if it exists by Date + Opponent
                let hasError = false;
                for (const match of data.matches) {
                    const { data: existing } = await supabase
                        .from('matches')
                        .select('id')
                        .eq('date', match.date)
                        .eq('opponent', match.opponent)
                        .single();

                    if (existing) {
                        // Update existing match result
                        const { error } = await supabase
                            .from('matches')
                            .update({
                                time: match.time,
                                is_home: match.is_home,
                                result: match.result,
                                scoreline: match.scoreline,
                                competition: match.competition
                            })
                            .eq('id', existing.id);
                        if (error) { alert("Failed to sync match: " + error.message); hasError = true; break; }
                    } else {
                        // Insert new match
                        const { error } = await supabase
                            .from('matches')
                            .insert({
                                date: match.date,
                                time: match.time,
                                opponent: match.opponent,
                                is_home: match.is_home,
                                competition: match.competition,
                                result: match.result,
                                scoreline: match.scoreline,
                                notes: match.notes
                            });
                        if (error) { alert("Failed to insert match: " + error.message); hasError = true; break; }
                    }
                }
                
                if (!hasError) {
                    alert(`Successfully synced ${data.matches.length} fixtures!`);
                    fetchMatches();
                }
            } else if (data.success) {
                alert("No fixtures found for your club on that page. Make sure your Club Name matches exactly.");
            } else {
                alert("Sync failed: " + data.error);
            }
        } catch (err: any) {
            alert("Error connecting to sync server: " + err.message);
        } finally {
            setIsSyncing(false);
        }
    };

    const resetForm = () => {
        sessionStorage.removeItem("fixture_form_draft");
        setIsAddOpen(false);
        setEditingId(null);
        setFormData({
            date: "",
            time: "15:00",
            meetTime: "14:00",
            opponent: "",
            isHome: true,
            competition: "League Match",
            scoreline: "",
            goalscorers: "",
            assists: "",
            yellow_cards: "",
            red_cards: "",
            notes: "",
            surface: "4G",
            location: "",
            lockType: "Never",
            lockTime: ""
        });
        setOpponentInstagram("");
        setOpponentBadgeUrl("");
    };

    const handleBadgeFile = async (file: File) => {
        if (!file) return;
        setIsUploadingBadge(true);
        try {
            const nameBase = `${Date.now()}_${file.name}`;
            const fileName = clubId ? `${clubId}/${nameBase}` : nameBase;
            const { data, error } = await supabase.storage
                .from('player-avatars')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (error) throw error;

            const { data: { publicUrl } } = supabase.storage.from('player-avatars').getPublicUrl(data.path);
            setOpponentBadgeUrl(publicUrl);
        } catch (e: any) {
            console.error("Error uploading:", e);
            alert("Upload failed: " + e.message);
        } finally {
            setIsUploadingBadge(false);
        }
    };

    const handleBadgeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleBadgeFile(file);
    };

    const handleBadgeDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleBadgeFile(file);
    };

    const handleBadgePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const file = e.clipboardData.files?.[0];
        if (file) handleBadgeFile(file);
    };

    const determineResult = (score?: string, isHome?: boolean): "Win" | "Loss" | "Draw" | "Pending" | undefined => {
        if (!score) return "Pending";
        const parts = score.split(/[-:]/);
        if (parts.length !== 2) return "Pending";

        const homeStr = parts[0].trim() || "0";
        const awayStr = parts[1].trim() || "0";
        
        const homeScore = parseInt(homeStr);
        const awayScore = parseInt(awayStr);

        if (isNaN(homeScore) || isNaN(awayScore)) return "Pending";
        if (homeScore === awayScore) return "Draw";

        if (isHome) {
            return homeScore > awayScore ? "Win" : "Loss";
        } else {
            // We are Away. Score is Home - Away.
            return awayScore > homeScore ? "Win" : "Loss";
        }
    };

    // Helper result styling
    const getResultColor = (result?: string) => {
        switch (result) {
            case "Win": return "text-emerald-800 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-500/15 border-emerald-400/60 dark:border-emerald-500/30 font-bold";
            case "Loss": return "text-rose-800 dark:text-rose-300 bg-rose-100/90 dark:bg-rose-500/15 border-rose-400/60 dark:border-rose-500/30 font-bold";
            case "Draw": return "text-amber-800 dark:text-amber-300 bg-amber-100/90 dark:bg-amber-500/15 border-amber-400/60 dark:border-amber-500/30 font-bold";
            default: return "text-muted-foreground bg-surface-2 border-border";
        }
    };

    // --- Filtering & Sorting Logic ---
    const getSeasonFromDate = (dateString: string) => {
        if (!dateString) return getCurrentSeasonStr();
        const d = new Date(dateString);
        if (isNaN(d.getTime())) return getCurrentSeasonStr();
        const year = d.getFullYear();
        const month = d.getMonth(); // 0-11, 5 is June
        if (month >= 5) {
            return `${year.toString().slice(-2)}/${(year + 1).toString().slice(-2)}`;
        } else {
            return `${(year - 1).toString().slice(-2)}/${year.toString().slice(-2)}`;
        }
    };

    const availableSeasons = Array.from(new Set([...matches.map(m => getSeasonFromDate(m.date)), getCurrentSeasonStr(), getNextSeasonStr()])).sort().reverse();

    // Known Opponents list for autocomplete & paste parser (#2, #4)
    const knownOpponents = Array.from(
        new Set(
            [
                ...leagueTeams.map(t => (t.name || t.team_name || "").trim()),
                ...matches.map(m => (m.opponent || "").trim())
            ].filter(name => name && name.toLowerCase() !== (settings.name || "camden united").toLowerCase() && !/^premier division$/i.test(name))
        )
    ).sort((a, b) => a.localeCompare(b));

    const getCompetitionType = (comp: string): "league" | "cup" | "friendly" => {
        const lower = (comp || "").toLowerCase();
        if (lower.includes("cup") || lower.includes("trophy") || lower.includes("shield")) return "cup";
        if (lower.includes("friendly")) return "friendly";
        return "league";
    };

    const filteredMatches = matches.filter(match => {
        if (seasonFilter !== "All" && getSeasonFromDate(match.date) !== seasonFilter) return false;
        if (opponentSearch.trim() && !(match.opponent || "").toLowerCase().includes(opponentSearch.trim().toLowerCase())) return false;
        if (filterType === "all") return true;
        const type = getCompetitionType(match.competition);
        return type === filterType;
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upcoming: Date is in future (or today pending) and no scoreline logged
    const upcomingMatches = filteredMatches.filter(m => {
        const d = new Date(m.date);
        const hasResult = Boolean((m.scoreline && m.scoreline.trim()) || (m.result && m.result !== "Pending"));
        return d >= today && !hasResult;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Past: Date is in past OR result is documented
    const pastMatches = filteredMatches.filter(m => {
        const d = new Date(m.date);
        const hasResult = Boolean((m.scoreline && m.scoreline.trim()) || (m.result && m.result !== "Pending"));
        return d < today || hasResult;
    }).sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return resultSort === "desc" ? dateB - dateA : dateA - dateB;
    });

    const MatchCard = ({ match, isPast, isNextUp }: { match: Match; isPast?: boolean; isNextUp?: boolean }) => {
        const [showLineup, setShowLineup] = useState(false);
        const teamInfo = leagueTeams.find(t => (t.name || t.team_name || "").toLowerCase() === (match.opponent || "").toLowerCase());
        const isSelectedForBulk = selectedMatchIds.has(match.id);

        const localDate = getLocalDateString(match.date);
        const dayWeather = weatherForecast[localDate];

        let weatherIcon = <Sun className="h-4 w-4 text-amber-500" />;
        let weatherLabel = "Sunny / Clear";
        let isWarning = false;
        let warningText = "";

        if (dayWeather) {
            const { code, tempMax, tempMin, rain, snow } = dayWeather;
            if (code >= 95) {
                weatherIcon = <CloudLightning className="h-4 w-4 text-purple-500 animate-pulse" />;
                weatherLabel = "Thunderstorms";
                isWarning = true;
                warningText = "Thunderstorms forecasted. Risk of pitch cancellation.";
            } else if (snow > 0 || (code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
                weatherIcon = <Snowflake className="h-4 w-4 text-sky-400 animate-spin" style={{ animationDuration: '3s' }} />;
                weatherLabel = "Snowfall";
                isWarning = true;
                warningText = "Snow forecasted. Risk of frozen pitch.";
            } else if (tempMin <= 1) {
                weatherIcon = <Thermometer className="h-4 w-4 text-blue-500" />;
                weatherLabel = `Freezing (${tempMin}°C)`;
                isWarning = true;
                warningText = `Sub-zero temperatures (${tempMin}°C) expected. Risk of frozen pitch.`;
            } else if (rain > 8 || code === 63 || code === 65 || code === 82) {
                weatherIcon = <CloudRain className="h-4 w-4 text-blue-600" />;
                weatherLabel = "Heavy Rain";
                isWarning = true;
                warningText = "Heavy rain expected. Risk of waterlogged pitch.";
            } else if (rain > 1 || (code >= 51 && code <= 55) || code === 61 || code === 80 || code === 81) {
                weatherIcon = <CloudRain className="h-4 w-4 text-blue-400" />;
                weatherLabel = "Light Rain";
            } else if (code >= 1 && code <= 3) {
                weatherLabel = "Partly Cloudy";
                weatherIcon = <Sun className="h-4 w-4 text-slate-400" />;
            } else if (code >= 45 && code <= 48) {
                weatherLabel = "Foggy";
                weatherIcon = <Sun className="h-4 w-4 text-slate-350" />;
            }
        }

        // Parse scorer/assist tokens & scoreline goal validation (#19, #20)
        const goalTokens = parseStatTextString(match.goalscorers, players);
        const assistTokens = parseStatTextString(match.assists, players);
        const totalLoggedGoals = goalTokens.reduce((acc, t) => acc + (t.count || 0), 0);
        const parsedScore = parseMatchScoreline(match.scoreline, Boolean(match.isHome));
        const clubExpectedGoals = parsedScore ? parsedScore.clubGoals : null;
        const hasGoalMismatch = isPast && clubExpectedGoals !== null && clubExpectedGoals > 0 && totalLoggedGoals !== clubExpectedGoals;

        const isHome = Boolean(match.isHome);
        const homeTeamName = isHome ? settings.name : match.opponent;
        const awayTeamName = !isHome ? settings.name : match.opponent;
        const shortDateStr = new Date(match.date).toLocaleDateString("en-GB", {
            weekday: "short",
            day: "numeric",
            month: "short",
        });

        return (
            <div id={`match-card-${match.id}`}>
                {/* =============================================================
                    MOBILE MATCH CARD (< 768px)
                   ============================================================= */}
                <div
                    className={`md:hidden rounded-xl border border-border bg-surface-1 overflow-hidden shadow-xs transition-all ${
                        isNextUp ? "border-l-4 border-l-brand" : ""
                    } ${isSelectedForBulk ? "ring-2 ring-brand bg-brand/5" : ""}`}
                >
                    {/* Top Metadata Bar */}
                    <div className="px-3 py-2 bg-surface-2/60 border-b border-border flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                            {isBulkSelectMode && (
                                <button
                                    type="button"
                                    onClick={() => toggleSelectMatch(match.id)}
                                    className="text-foreground hover:text-brand transition-colors mr-0.5 shrink-0"
                                >
                                    {isSelectedForBulk ? (
                                        <CheckSquare className="h-4 w-4 text-brand" />
                                    ) : (
                                        <Square className="h-4 w-4 text-muted-foreground" />
                                    )}
                                </button>
                            )}
                            {isNextUp && (
                                <span className="bg-brand text-brand-foreground text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded shrink-0">
                                    Next Up
                                </span>
                            )}
                            <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold border truncate max-w-[130px] ${
                                    (match.competition || "").toLowerCase().includes("cup")
                                        ? "bg-amber-100/90 dark:bg-amber-500/15 border-amber-400/70 dark:border-amber-500/40 text-amber-800 dark:text-amber-300"
                                        : "bg-surface-2 border-border text-foreground"
                                }`}
                            >
                                {match.competition || "League"}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-semibold truncate">
                                {shortDateStr}
                                {match.time ? ` • ${match.time.slice(0, 5)}` : ""}
                                {!isPast && (match as any).meetTime ? ` (Meet ${(match as any).meetTime})` : ""}
                            </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                            {match.result && match.result !== "Pending" && (
                                <span className={`px-1.5 py-0.5 rounded text-[9px] uppercase font-extrabold border ${getResultColor(match.result)}`}>
                                    {match.result === "Win" ? "W" : match.result === "Loss" ? "L" : "D"}
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={() => handleEditMatch(match)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-2 transition-colors"
                                title="Edit Match"
                            >
                                <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                                type="button"
                                onClick={() => handleDeleteMatch(match.id)}
                                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Delete Match"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Center Horizontal Scoreboard Row */}
                    <div className="p-3 space-y-2.5">
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                            {/* Home Team */}
                            <div className="flex items-center justify-end gap-1.5 text-right min-w-0">
                                <div className="min-w-0">
                                    <p className={`text-xs font-extrabold leading-tight truncate ${isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                        {homeTeamName}
                                    </p>
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">Home</span>
                                </div>
                                {isHome && settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="h-6 w-6 object-contain shrink-0 rounded-full" />
                                ) : !isHome && teamInfo?.badge_url ? (
                                    <img src={teamInfo.badge_url} alt="Badge" className="h-6 w-6 object-contain shrink-0" />
                                ) : null}
                            </div>

                            {/* Tappable Scorebox */}
                            <button
                                type="button"
                                onClick={() => setQuickResultMatch(match)}
                                className="px-2.5 py-1.5 rounded-lg bg-surface-2/90 border border-border hover:border-brand/50 transition-colors min-w-[66px] text-center shrink-0 shadow-2xs"
                                title="Tap to log or edit scoreline & scorers"
                            >
                                {match.scoreline ? (
                                    <span className="text-sm font-black text-foreground tracking-tight tabular-nums">
                                        {match.scoreline.includes("-")
                                            ? `${match.scoreline.split("-")[0].trim() || "0"} - ${match.scoreline.split("-")[1].trim() || "0"}`
                                            : match.scoreline}
                                    </span>
                                ) : (
                                    <span className="text-xs font-extrabold text-brand uppercase">
                                        {match.time ? match.time.slice(0, 5) : "VS"}
                                    </span>
                                )}
                            </button>

                            {/* Away Team */}
                            <div className="flex items-center justify-start gap-1.5 text-left min-w-0">
                                {!isHome && settings.logo ? (
                                    <img src={settings.logo} alt="Logo" className="h-6 w-6 object-contain shrink-0 rounded-full" />
                                ) : isHome && teamInfo?.badge_url ? (
                                    <img src={teamInfo.badge_url} alt="Badge" className="h-6 w-6 object-contain shrink-0" />
                                ) : null}
                                <div className="min-w-0">
                                    <p className={`text-xs font-extrabold leading-tight truncate ${!isHome ? "text-foreground" : "text-muted-foreground"}`}>
                                        {awayTeamName}
                                    </p>
                                    <span className="text-[9px] font-bold uppercase text-muted-foreground">Away</span>
                                </div>
                            </div>
                        </div>

                        {/* Location & Weather Row */}
                        {(match.location || (dayWeather && !isPast)) && (
                            <div className="flex flex-wrap items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                                {match.location && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2/80 border border-border truncate max-w-[210px]">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                                        <span className="truncate">{match.location}</span>
                                    </span>
                                )}
                                {dayWeather && !isPast && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-2/80 border border-border">
                                        {weatherIcon}
                                        <span>{dayWeather.tempMin}°–{dayWeather.tempMax}°C</span>
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Weather Warning */}
                        {isWarning && warningText && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-[10px] text-amber-500 font-semibold flex items-center gap-1.5">
                                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                                <span>{warningText}</span>
                            </div>
                        )}

                        {/* Scorers, Assists & Lineup Pills */}
                        {(goalTokens.length > 0 || assistTokens.length > 0 || hasGoalMismatch || match.lineup) && (
                            <div className="pt-2 border-t border-border/70 flex flex-col items-center space-y-2">
                                {(goalTokens.length > 0 || assistTokens.length > 0 || hasGoalMismatch) && (
                                    <div className="flex flex-wrap items-center justify-center gap-1">
                                        {goalTokens.map((g, idx) => (
                                            <button
                                                type="button"
                                                key={`mg-${idx}`}
                                                onClick={() => setQuickResultMatch(match)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30"
                                            >
                                                <span>⚽</span>
                                                <span>{g.rawName}{g.count > 1 ? ` (${g.count})` : ""}</span>
                                            </button>
                                        ))}
                                        {assistTokens.map((a, idx) => (
                                            <button
                                                type="button"
                                                key={`ma-${idx}`}
                                                onClick={() => setQuickResultMatch(match)}
                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100/90 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/70 dark:border-sky-500/30"
                                            >
                                                <span>👟</span>
                                                <span>{a.rawName}{a.count > 1 ? ` (${a.count})` : ""}</span>
                                            </button>
                                        ))}
                                        {hasGoalMismatch && (
                                            <button
                                                type="button"
                                                onClick={() => setQuickResultMatch(match)}
                                                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40"
                                            >
                                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                                <span>
                                                    {totalLoggedGoals === 0
                                                        ? `+ Add Scorers (${clubExpectedGoals} unassigned)`
                                                        : `${totalLoggedGoals}/${clubExpectedGoals} goals assigned`}
                                                </span>
                                            </button>
                                        )}
                                    </div>
                                )}

                                {match.lineup && (
                                    <div className="w-full flex flex-col items-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowLineup(!showLineup)}
                                            className="text-[10px] font-bold bg-surface-2 hover:bg-surface-3 text-foreground border border-border px-2.5 py-1 rounded-full flex items-center gap-1"
                                        >
                                            <span>📋</span>
                                            <span>{showLineup ? "Hide Lineup" : `Saved Lineup (${match.lineup.formation})`}</span>
                                        </button>

                                        {showLineup && (
                                            <div className="w-full mt-2 p-2.5 rounded-lg bg-surface-2/80 border border-border text-left space-y-2">
                                                <div>
                                                    <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Starting XI</span>
                                                    <div className="mt-1 flex flex-wrap gap-1">
                                                        {Object.entries(match.lineup.starters || {})
                                                            .filter(([, id]) => id)
                                                            .map(([pos, id]) => {
                                                                const p = players.find(x => x.id === id);
                                                                const name = p ? `${p.first_name[0]}.${p.last_name}` : "Unknown";
                                                                return (
                                                                    <span key={pos} className="inline-flex items-center bg-surface-1 border border-border px-1.5 py-0.5 rounded text-[10px]">
                                                                        <span className="text-[8px] uppercase font-extrabold text-muted-foreground mr-1">{pos}:</span>
                                                                        <span className="font-semibold text-foreground">{name}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                                {match.lineup.substitutes && match.lineup.substitutes.filter(id => id).length > 0 && (
                                                    <div className="border-t border-border pt-1.5">
                                                        <span className="text-[9px] uppercase font-bold tracking-wider text-muted-foreground">Subs</span>
                                                        <div className="mt-1 flex flex-wrap gap-1">
                                                            {match.lineup.substitutes
                                                                .filter(id => id)
                                                                .map((id, index) => {
                                                                    const p = players.find(x => x.id === id);
                                                                    const name = p ? `${p.first_name[0]}.${p.last_name}` : "Unknown";
                                                                    return (
                                                                        <span key={index} className="inline-flex items-center bg-surface-1 border border-border px-1.5 py-0.5 rounded text-[10px] font-semibold text-foreground">
                                                                            {name}
                                                                        </span>
                                                                    );
                                                                })}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Bottom Touch Action Strip */}
                    <div className={`px-2.5 py-2 bg-surface-2/50 border-t border-border grid ${!isPast ? "grid-cols-4" : "grid-cols-3"} gap-1.5`}>
                        <button
                            type="button"
                            onClick={() => setQuickResultMatch(match)}
                            className="h-8 rounded-lg text-[11px] font-bold bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30 flex items-center justify-center gap-1"
                        >
                            <span>⚽</span>
                            <span>{match.scoreline ? "Scorers" : "Result"}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push(`/matchday-xi?match=${match.id}`)}
                            className="h-8 rounded-lg text-[11px] font-bold bg-surface-1 text-foreground border border-border flex items-center justify-center gap-1"
                        >
                            <Users className="h-3 w-3 text-brand shrink-0" />
                            <span>Match XI</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setSelectedExpenseMatch(match);
                                setIsExpenseOpen(true);
                            }}
                            className="h-8 rounded-lg text-[11px] font-bold bg-surface-1 text-foreground border border-border flex items-center justify-center gap-1"
                        >
                            <Coins className="h-3 w-3 text-amber-500 shrink-0" />
                            <span>Expense</span>
                        </button>
                        {!isPast && (
                            <button
                                type="button"
                                onClick={() => (match.isHome ? handleOpenConfirmDetails(match) : handleOpenShare(match))}
                                className="h-8 rounded-lg text-[11px] font-bold bg-surface-1 text-foreground border border-border flex items-center justify-center gap-1"
                            >
                                <Share2 className="h-3 w-3 text-sky-400 shrink-0" />
                                <span>{match.isHome ? "Confirm" : "Poll"}</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* =============================================================
                    DESKTOP MATCH CARD (>= 768px) — UNTOUCHED
                   ============================================================= */}
            <Card
                className={`hidden md:block overflow-hidden hover:shadow-md transition-all border-border bg-surface-1 ${
                    isNextUp ? "border-l-4 border-l-brand" : ""
                } ${isSelectedForBulk ? "ring-2 ring-brand bg-brand/5" : ""}`}
            >
                <CardHeader className="py-3.5 bg-surface-2/50 border-border border-b flex flex-row items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        {isBulkSelectMode && (
                            <button
                                type="button"
                                onClick={() => toggleSelectMatch(match.id)}
                                className="text-foreground hover:text-brand transition-colors mr-1"
                                title="Select fixture for bulk action"
                            >
                                {isSelectedForBulk ? (
                                    <CheckSquare className="h-4 w-4 text-brand" />
                                ) : (
                                    <Square className="h-4 w-4 text-muted-foreground" />
                                )}
                            </button>
                        )}
                        {isNextUp && (
                            <Badge className="bg-brand text-brand-foreground text-[10px] uppercase font-extrabold px-2 py-0.5">
                                Next Up
                            </Badge>
                        )}
                        <Badge variant="outline" className={`font-semibold ${(match.competition || "").toLowerCase().includes("cup") ? "bg-amber-100/90 dark:bg-amber-500/15 border-amber-400/70 dark:border-amber-500/40 text-amber-800 dark:text-amber-300" : "bg-surface-2 border-border"}`}>
                            {match.competition || "League"}
                        </Badge>
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1 font-medium">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {new Date(match.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                            {match.time ? ` · KO ${match.time.slice(0, 5)}` : ""}
                            {!isPast && (match as any).meetTime ? ` · Meet ${(match as any).meetTime}` : ""}
                        </span>
                        {dayWeather && !isPast && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1 bg-surface-2/80 border border-border px-2 py-0.5 rounded-full" title={`Temp: ${dayWeather.tempMin}°C to ${dayWeather.tempMax}°C, Rain: ${dayWeather.rain}mm`}>
                                {weatherIcon} <span>{weatherLabel} ({dayWeather.tempMin}° - {dayWeather.tempMax}°)</span>
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setQuickResultMatch(match)}
                            className="h-7 px-2.5 text-[11px] font-bold bg-emerald-100/90 dark:bg-emerald-500/15 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25 text-emerald-800 dark:text-emerald-300 border-emerald-400/70 dark:border-emerald-500/30 mr-1"
                            title="Quickly log scoreline, goalscorers & assists"
                        >
                            ⚽ {match.scoreline ? "Edit Result / Scorers" : "Log Result"}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-brand"
                            onClick={() => router.push(`/matchday-xi?match=${match.id}`)}
                            title="Open Matchday XI for this match"
                        >
                            <Users className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10"
                            onClick={() => {
                                setSelectedExpenseMatch(match);
                                setIsExpenseOpen(true);
                            }}
                            title="Log Matchday Expense"
                        >
                            <Coins className="h-4 w-4" />
                        </Button>
                        {!isPast && match.isHome && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-sky-400 hover:text-sky-300 hover:bg-sky-500/10"
                                onClick={() => handleOpenConfirmDetails(match)}
                                title="Confirm Details with Opponent & Ref"
                            >
                                <Share2 className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEditMatch(match)} title="Edit Match Details">
                            <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-rose-500" onClick={() => handleDeleteMatch(match.id)} title="Delete Match">
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="py-4">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        {/* Home Team */}
                        <div className="flex-1 flex items-center justify-end gap-3 text-right">
                            {!match.isHome && teamInfo?.instagram_handle && (
                                <a href={`https://instagram.com/${teamInfo.instagram_handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 transition-colors shrink-0">
                                    <Instagram className="h-4 w-4" />
                                </a>
                            )}
                            {match.isHome && settings.logo && (
                                <img src={settings.logo} alt="Club Logo" className="h-6 w-6 object-contain shrink-0 rounded-full" />
                            )}
                            {!match.isHome && teamInfo?.badge_url && (
                                <img src={teamInfo.badge_url} alt="Badge" className="h-6 w-6 object-contain shrink-0" />
                            )}
                            <span className={`font-bold text-lg ${match.isHome ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {match.isHome ? settings.name : match.opponent}
                            </span>
                            {match.isHome && <span className="text-xs px-1.5 py-0.5 bg-surface-2 border border-border text-muted-foreground rounded shrink-0">H</span>}
                        </div>

                        {/* Score / VS */}
                        <div className="flex flex-col items-center min-w-[110px]">
                            <button
                                type="button"
                                onClick={() => setQuickResultMatch(match)}
                                title="Click to log or edit scoreline & scorers"
                                className="text-2xl font-black text-foreground tracking-tight flex items-center justify-center min-w-[84px] px-2.5 py-0.5 rounded-lg hover:bg-surface-2 transition-colors"
                            >
                                {match.scoreline ? (
                                    match.scoreline.includes('-') ? (
                                        <div className="flex items-center gap-2">
                                            <span>{match.scoreline.split('-')[0].trim() || "0"}</span>
                                            <span className="text-muted-foreground">-</span>
                                            <span>{match.scoreline.split('-')[1].trim() || "0"}</span>
                                        </div>
                                    ) : match.scoreline
                                ) : "v"}
                            </button>
                            {match.result && match.result !== "Pending" && (
                                <Badge variant="outline" className={`mt-1 text-[10px] uppercase px-2 py-0 ${getResultColor(match.result)}`}>
                                    {match.result}
                                </Badge>
                            )}
                            {match.location && (
                                <span className="text-xs text-muted-foreground mt-1.5 flex items-center justify-center gap-1 bg-surface-2/80 px-2 py-0.5 rounded-full font-medium">
                                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" /> {match.location}
                                </span>
                            )}
                        </div>

                        {/* Away Team */}
                        <div className="flex-1 flex items-center justify-start gap-3 text-left">
                            {!match.isHome && <span className="text-xs px-1.5 py-0.5 bg-surface-2 border border-border text-muted-foreground rounded shrink-0">A</span>}
                            <span className={`font-bold text-lg flex items-center gap-2 ${!match.isHome ? 'text-foreground' : 'text-muted-foreground'}`}>
                                {!match.isHome && settings.logo && (
                                    <img src={settings.logo} alt="Club Logo" className="h-6 w-6 object-contain shrink-0 rounded-full" />
                                )}
                                {match.isHome && teamInfo?.badge_url && (
                                    <img src={teamInfo.badge_url} alt="Badge" className="h-6 w-6 object-contain shrink-0" />
                                )}
                                {!match.isHome ? settings.name : match.opponent}
                            </span>
                            {match.isHome && teamInfo?.instagram_handle && (
                                <a href={`https://instagram.com/${teamInfo.instagram_handle.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:text-pink-400 transition-colors shrink-0">
                                    <Instagram className="h-4 w-4" />
                                </a>
                            )}
                        </div>
                    </div>

                    {/* Visual Scorer & Assist Pills + Goal Validation (#19, #20) */}
                    {(goalTokens.length > 0 || assistTokens.length > 0 || hasGoalMismatch || match.lineup) && (
                        <div className="mt-4 pt-3.5 border-t border-border flex flex-col items-center text-center space-y-2.5 w-full">
                            {(goalTokens.length > 0 || assistTokens.length > 0 || hasGoalMismatch) && (
                                <div className="flex flex-wrap items-center justify-center gap-1.5">
                                    {goalTokens.map((g, idx) => (
                                        <button
                                            type="button"
                                            key={`g-${idx}`}
                                            onClick={() => setQuickResultMatch(match)}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-400/70 dark:border-emerald-500/30 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25 transition-colors"
                                            title="Click to edit goalscorers"
                                        >
                                            <span>⚽</span>
                                            <span>{g.rawName}{g.count > 1 ? ` (${g.count})` : ""}</span>
                                        </button>
                                    ))}

                                    {assistTokens.map((a, idx) => (
                                        <button
                                            type="button"
                                            key={`a-${idx}`}
                                            onClick={() => setQuickResultMatch(match)}
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100/90 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border border-sky-400/70 dark:border-sky-500/30 hover:bg-sky-200/80 dark:hover:bg-sky-500/25 transition-colors"
                                            title="Click to edit assists"
                                        >
                                            <span>👟</span>
                                            <span>{a.rawName}{a.count > 1 ? ` (${a.count})` : ""}</span>
                                        </button>
                                    ))}

                                    {hasGoalMismatch && (
                                        <button
                                            type="button"
                                            onClick={() => setQuickResultMatch(match)}
                                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-500/20 text-amber-900 dark:text-amber-300 border border-amber-400 dark:border-amber-500/40 hover:bg-amber-200/90 dark:hover:bg-amber-500/30 transition-colors shadow-xs"
                                            title="Scoreline goals don't match assigned player goals — click to assign scorers"
                                        >
                                            <AlertTriangle className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0" />
                                            <span>
                                                {totalLoggedGoals === 0
                                                    ? `+ Add Scorers (${clubExpectedGoals} ${clubExpectedGoals === 1 ? "goal" : "goals"} unassigned)`
                                                    : `${totalLoggedGoals}/${clubExpectedGoals} goals assigned`}
                                            </span>
                                        </button>
                                    )}
                                </div>
                            )}

                            {match.lineup && (
                                <div className="w-full pt-2 flex flex-col items-center">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowLineup(!showLineup)}
                                        className="text-xs font-bold bg-surface-2 hover:bg-surface-3 text-foreground border border-border px-3 py-1 flex items-center gap-1.5 h-7 transition-colors shadow-sm"
                                    >
                                        <span>📋</span> {showLineup ? "Hide Saved Lineup" : `Show Saved Lineup (${match.lineup.formation})`}
                                    </Button>

                                    {showLineup && (
                                        <div className="w-full mt-2.5 p-3 rounded-xl bg-surface-2/80 border border-border text-left space-y-2.5">
                                            <div>
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Starting XI</span>
                                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                    {Object.entries(match.lineup.starters || {})
                                                        .filter(([pos, id]) => id)
                                                        .map(([pos, id]) => {
                                                            const p = players.find(x => x.id === id);
                                                            const name = p ? `${p.first_name[0]}.${p.last_name}` : "Unknown";
                                                            return (
                                                                <span key={pos} className="inline-flex items-center bg-surface-1 border border-border px-2 py-0.5 rounded-full shadow-sm text-[11px]">
                                                                    <span className="text-[9px] uppercase font-extrabold text-muted-foreground mr-1">{pos}:</span>
                                                                    <span className="font-semibold text-foreground">{name}</span>
                                                                </span>
                                                            );
                                                        })}
                                                </div>
                                            </div>

                                            {match.lineup.substitutes && match.lineup.substitutes.filter(id => id).length > 0 && (
                                                <div className="border-t border-border pt-2.5">
                                                    <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Substitutes</span>
                                                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                                                        {match.lineup.substitutes
                                                            .filter(id => id)
                                                            .map((id, index) => {
                                                                const p = players.find(x => x.id === id);
                                                                const name = p ? `${p.first_name[0]}.${p.last_name}` : "Unknown";
                                                                return (
                                                                    <span key={index} className="inline-flex items-center bg-surface-1 border border-border px-2 py-0.5 rounded-full shadow-sm text-[11px]">
                                                                        <span className="font-semibold text-foreground">{name}</span>
                                                                    </span>
                                                                );
                                                            })}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Weather Warning Banner */}
                    {isWarning && warningText && (
                        <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs text-amber-400 font-semibold flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
                            <span>{warningText}</span>
                        </div>
                    )}
                </CardContent>
                {isPast && (
                    <div className="p-3 bg-surface-2/60 border-t border-border grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setQuickResultMatch(match)}
                            className="w-full text-xs font-bold border-emerald-400/70 dark:border-emerald-500/30 bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25 flex items-center justify-center gap-1.5"
                        >
                            <Trophy className="h-3.5 w-3.5" />
                            Quick Result &amp; Scorers
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push(`/matchday-xi?match=${match.id}`)}
                            className="w-full text-xs font-bold border-border text-foreground hover:bg-surface-2 flex items-center justify-center gap-1.5"
                        >
                            <Users className="h-3.5 w-3.5" />
                            Matchday XI &amp; Subs
                        </Button>
                    </div>
                )}
            </Card>
            </div>
        );
    };

    // Mobile Season Summary Stats (computed from filtered pastMatches)
    const mobileSeasonStats = pastMatches.reduce(
        (acc, m) => {
            if (!m.scoreline || !m.scoreline.includes("-")) return acc;
            const parts = m.scoreline.split("-");
            const homeScore = parseInt(parts[0]?.trim() || "", 10);
            const awayScore = parseInt(parts[1]?.trim() || "", 10);
            if (isNaN(homeScore) || isNaN(awayScore)) return acc;

            const ourScore = m.isHome ? homeScore : awayScore;
            const theirScore = m.isHome ? awayScore : homeScore;

            acc.played += 1;
            acc.gf += ourScore;
            acc.ga += theirScore;
            if (ourScore > theirScore) acc.wins += 1;
            else if (ourScore === theirScore) acc.draws += 1;
            else acc.losses += 1;
            return acc;
        },
        { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 }
    );

    return (
        <div className="space-y-4 md:space-y-6 pb-8 md:pb-0">
            {/* Shared Opponent Autocomplete Datalist (#4) */}
            <datalist id="known-opponents-list">
                {knownOpponents.map(opp => (
                    <option key={opp} value={opp} />
                ))}
            </datalist>

            {/* ================================================================= */}
            {/* MOBILE HEADER & 4-STAT SEASON BENTO STRIP (< 768px)               */}
            {/* ================================================================= */}
            <div className="md:hidden space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <h2 className="text-xl font-black tracking-tight text-foreground">Fixtures &amp; Results</h2>
                        <p className="text-[11px] text-muted-foreground">Matchday schedule, results &amp; squads</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsImportModalOpen(true)}
                            className="h-8 px-2.5 text-xs bg-surface-1 border-border font-bold"
                        >
                            <ClipboardPaste className="h-3.5 w-3.5 mr-1 text-emerald-500" />
                            Import
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                resetForm();
                                setIsAddOpen(true);
                            }}
                            className="h-8 px-3 text-xs bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Match
                        </Button>
                    </div>
                </div>

                {/* Undo Import Banner on Mobile if active */}
                {lastImportedIds.length > 0 && (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
                        <span className="text-[11px] font-bold text-amber-400">
                            Imported {lastImportedIds.length} fixtures
                        </span>
                        <button
                            type="button"
                            onClick={handleUndoLastImport}
                            className="inline-flex items-center gap-1 text-[11px] font-black text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30"
                        >
                            <RotateCcw className="h-3 w-3" />
                            Undo
                        </button>
                    </div>
                )}

                {/* 4-Stat Season Bento Strip */}
                <div className="grid grid-cols-4 gap-2">
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 flex flex-col justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Upcoming</span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-base font-black text-foreground tabular-nums">{upcomingMatches.length}</span>
                            <span className="text-[9px] font-semibold text-muted-foreground">left</span>
                        </div>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 flex flex-col justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Played</span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-base font-black text-foreground tabular-nums">{mobileSeasonStats.played}</span>
                            <span className="text-[9px] font-semibold text-muted-foreground">games</span>
                        </div>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 flex flex-col justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Record</span>
                        <div className="flex items-center gap-1 mt-1 text-xs font-black tabular-nums">
                            <span className="text-emerald-500">{mobileSeasonStats.wins}W</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-amber-500">{mobileSeasonStats.draws}D</span>
                            <span className="text-muted-foreground/50">·</span>
                            <span className="text-rose-500">{mobileSeasonStats.losses}L</span>
                        </div>
                    </div>
                    <div className="bg-surface-1 border border-border rounded-xl p-2.5 flex flex-col justify-between">
                        <span className="text-[9px] font-extrabold uppercase tracking-wider text-muted-foreground">Goals</span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-sm font-black text-foreground tabular-nums">
                                {mobileSeasonStats.gf}:{mobileSeasonStats.ga}
                            </span>
                            <span className={`text-[9px] font-bold tabular-nums ${mobileSeasonStats.gf - mobileSeasonStats.ga >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                                ({mobileSeasonStats.gf - mobileSeasonStats.ga >= 0 ? `+${mobileSeasonStats.gf - mobileSeasonStats.ga}` : mobileSeasonStats.gf - mobileSeasonStats.ga})
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* DESKTOP HEADER & CONTROLS (>= 768px — UNTOUCHED)                  */}
            {/* ================================================================= */}
            <div className="hidden md:flex flex-col md:flex-row gap-4 md:items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Fixtures &amp; Results</h2>
                    <p className="text-sm text-muted-foreground">Manage your schedule, results, goalscorers, and matchday squads.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {lastImportedIds.length > 0 && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleUndoLastImport}
                            className="border-amber-400/70 dark:border-amber-500/40 bg-amber-100/90 dark:bg-amber-500/15 text-amber-900 dark:text-amber-300 hover:bg-amber-200/80 dark:hover:bg-amber-500/25 font-bold"
                        >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            Undo Last Import ({lastImportedIds.length})
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setIsBulkSelectMode(prev => !prev);
                            setSelectedMatchIds(new Set());
                        }}
                        className={`border-border ${isBulkSelectMode ? "bg-brand/15 text-brand border-brand/40" : "bg-surface-1 text-muted-foreground hover:text-foreground"}`}
                    >
                        <CheckSquare className="h-4 w-4 mr-1.5" />
                        {isBulkSelectMode ? "Cancel Select" : "Select Multiple"}
                    </Button>

                    {isBulkSelectMode && selectedMatchIds.size > 0 && (
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleBulkDelete}
                            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
                        >
                            <Trash2 className="h-4 w-4 mr-1.5" />
                            Delete Selected ({selectedMatchIds.size})
                        </Button>
                    )}

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-surface-1 border-border hover:bg-surface-2 text-foreground font-semibold"
                    >
                        <ClipboardPaste className="h-4 w-4 mr-1.5 text-emerald-500" />
                        Paste / Import
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => {
                            resetForm();
                            setIsAddOpen(true);
                        }}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold"
                    >
                        <Plus className="h-4 w-4 mr-1.5" /> Add Match
                    </Button>
                </div>
            </div>

            {/* Shared Add / Edit Match Dialog (Mobile & Desktop) */}
            <Dialog open={isAddOpen} onOpenChange={(open: boolean) => {
                setIsAddOpen(open);
                if (!open) resetForm();
            }}>
                <DialogContent className="z-[60] w-[95vw] sm:max-w-[600px] max-h-[90dvh] flex flex-col p-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
                        <DialogTitle>{editingId ? "Edit Match" : "Add New Match"}</DialogTitle>
                        <DialogDescription>{editingId ? "Update match details." : "Enter fixture details and scoreline."}</DialogDescription>
                    </DialogHeader>

                    <Tabs defaultValue="fixture" className="flex-1 flex flex-col min-h-0">
                        <TabsList className="grid grid-cols-2 mx-4 sm:mx-6 my-2 shrink-0">
                            <TabsTrigger value="fixture" className="text-xs font-bold">1. Fixture Info</TabsTrigger>
                            <TabsTrigger value="result" className="text-xs font-bold">2. Match Record</TabsTrigger>
                        </TabsList>

                        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-2 space-y-4">
                            <TabsContent value="fixture" className="space-y-3 mt-0 py-1">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
                                    <div className="col-span-1 space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Date</Label>
                                        <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} className="h-9 text-xs" />
                                    </div>
                                    <div className="grid grid-cols-2 sm:contents gap-2.5">
                                        <div className="col-span-1 space-y-1">
                                            <Label className="text-xs font-bold text-muted-foreground">Time (Kick Off)</Label>
                                            <Input type="time" value={formData.time} onChange={e => handleKickoffChange(e.target.value)} className="h-9 text-xs" />
                                        </div>
                                        <div className="col-span-1 space-y-1">
                                            <Label className="text-xs font-bold text-muted-foreground flex items-center justify-between">
                                                <span>Meet Time</span>
                                                <span className="text-[9px] text-slate-400 font-normal lowercase">(auto)</span>
                                            </Label>
                                            <Input type="time" value={formData.meetTime} onChange={e => setFormData({ ...formData, meetTime: e.target.value })} className="h-9 text-xs" />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
                                    <div className="col-span-1 space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Venue</Label>
                                        <Select
                                            value={formData.isHome ? "Home" : "Away"}
                                            onValueChange={(v: string) => handleVenueChange(v === "Home")}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="Home" className="text-xs">Home</SelectItem>
                                                <SelectItem value="Away" className="text-xs">Away</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Opponent</Label>
                                        <Input
                                            list="known-opponents-list"
                                            placeholder="Type opponent name"
                                            value={formData.opponent}
                                            onChange={e => {
                                                const val = e.target.value;
                                                setFormData({ ...formData, opponent: val });
                                                const teamMatch = leagueTeams.find(t => (t.name || t.team_name || "").toLowerCase() === val.toLowerCase());
                                                if (teamMatch) {
                                                    setOpponentInstagram(teamMatch.instagram_handle || "");
                                                    setOpponentBadgeUrl(teamMatch.badge_url || "");
                                                } else {
                                                    setOpponentInstagram("");
                                                    setOpponentBadgeUrl("");
                                                }
                                            }}
                                            className="h-9 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Competition</Label>
                                        <Select
                                            value={formData.competition}
                                            onValueChange={(v: string) => setFormData({ ...formData, competition: v })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Competition" />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="League Match" className="text-xs">League Match</SelectItem>
                                                <SelectItem value="Alec Smith Premier Division Cup" className="text-xs">Alec Smith Cup</SelectItem>
                                                <SelectItem value="Middlesex Cup" className="text-xs">Middlesex Cup</SelectItem>
                                                <SelectItem value="Friendly" className="text-xs">Friendly</SelectItem>
                                                <SelectItem value="Trial Match" className="text-xs">Trial Match</SelectItem>
                                                {formData.competition && !["League Match", "Alec Smith Premier Division Cup", "Middlesex Cup", "Friendly", "Trial Match"].includes(formData.competition) && (
                                                    <SelectItem value={formData.competition} className="text-xs">{formData.competition}</SelectItem>
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Surface</Label>
                                        <Select
                                            value={formData.surface || "4G"}
                                            onValueChange={(v) => setFormData({ ...formData, surface: v as "4G" | "Grass" })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Surface" />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="Grass" className="text-xs">Grass</SelectItem>
                                                <SelectItem value="4G" className="text-xs">4G</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Location / Venue Address</Label>
                                    <Input
                                        placeholder="e.g. Market Road Pitches, N7 9PL"
                                        value={formData.location || ""}
                                        onChange={e => setFormData({ ...formData, location: e.target.value })}
                                        className="h-9 text-xs"
                                    />
                                </div>

                                {formData.opponent && (
                                    <div className="bg-surface-2 p-2.5 rounded-lg border border-border space-y-2 mt-1">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Opponent Info</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                                <Label className="text-[10px] font-bold text-slate-505">Instagram</Label>
                                                <Input
                                                    placeholder="e.g. camden_utd"
                                                    value={opponentInstagram}
                                                    onChange={e => setOpponentInstagram(e.target.value)}
                                                    className="h-8 text-[11px]"
                                                />
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-[10px] font-bold text-slate-505">Badge Image URL</Label>
                                                <Input
                                                    placeholder="https://..."
                                                    value={opponentBadgeUrl}
                                                    onChange={e => setOpponentBadgeUrl(e.target.value)}
                                                    className="h-8 text-[11px]"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1">
                                            <div
                                                onDragOver={e => e.preventDefault()}
                                                onDrop={handleBadgeDrop}
                                                onPaste={handleBadgePaste}
                                                className="border border-dashed border-border rounded-lg p-2 flex items-center justify-center bg-surface-2 cursor-pointer hover:border-indigo-400 transition-colors relative"
                                            >
                                                <input
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleBadgeFileChange}
                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                />
                                                <Upload className="h-4 w-4 text-slate-400 mr-1.5" />
                                                <span className="text-[10px] text-muted-foreground font-medium">
                                                    {isUploadingBadge ? "Uploading..." : "Upload or paste opponent badge"}
                                                </span>
                                            </div>
                                            {opponentBadgeUrl && (
                                                <div className="flex items-center gap-2 mt-1.5 bg-surface-2 p-1.5 rounded border border-border">
                                                    <img src={opponentBadgeUrl} alt="Badge Preview" className="h-6 w-6 object-contain rounded" />
                                                    <span className="text-[10px] text-slate-400 truncate flex-1">{opponentBadgeUrl}</span>
                                                    <Button type="button" variant="ghost" size="sm" className="h-5 text-red-500 hover:text-red-650 p-1 text-[10px]" onClick={() => setOpponentBadgeUrl("")}>Remove</Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </TabsContent>

                            <TabsContent value="result" className="space-y-3 mt-0 py-1">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Scoreline</Label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-muted-foreground w-10 text-right">Home</span>
                                            <Input
                                                className="w-14 h-8 text-center font-bold text-sm"
                                                placeholder="0"
                                                value={(formData.scoreline || "").split('-')[0]?.trim() || ""}
                                                onChange={e => {
                                                    const home = e.target.value;
                                                    const away = (formData.scoreline || "").split('-')[1]?.trim() || "";
                                                    setFormData({ ...formData, scoreline: `${home}-${away}` });
                                                }}
                                            />
                                        </div>
                                        <span className="text-slate-300 font-bold">-</span>
                                        <div className="flex items-center gap-2">
                                            <Input
                                                className="w-14 h-8 text-center font-bold text-sm"
                                                placeholder="0"
                                                value={(formData.scoreline || "").split('-')[1]?.trim() || ""}
                                                onChange={e => {
                                                    const home = (formData.scoreline || "").split('-')[0]?.trim() || "";
                                                    const away = e.target.value;
                                                    setFormData({ ...formData, scoreline: `${home}-${away}` });
                                                }}
                                            />
                                            <span className="text-xs font-bold text-muted-foreground w-10">Away</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Yellow Cards</Label>
                                        <Textarea
                                            placeholder="e.g. J.Smith, P.Maldini"
                                            value={formData.yellow_cards}
                                            onChange={(e) => setFormData({ ...formData, yellow_cards: e.target.value })}
                                            className="h-14 text-xs"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Red Cards</Label>
                                        <Textarea
                                            placeholder="e.g. S.Ramos"
                                            value={formData.red_cards}
                                            onChange={(e) => setFormData({ ...formData, red_cards: e.target.value })}
                                            className="h-14 text-xs"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 pb-2 border-b border-dashed border-border">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-muted-foreground">Availability Lock</Label>
                                        <Select
                                            value={formData.lockType || "Never"}
                                            onValueChange={(v) => setFormData({ ...formData, lockType: v })}
                                        >
                                            <SelectTrigger className="h-9 text-xs">
                                                <SelectValue placeholder="Select Lock Type" />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="Never">Never Lock</SelectItem>
                                                <SelectItem value="Start">At Match Start</SelectItem>
                                                <SelectItem value="30m">30 Mins Before</SelectItem>
                                                <SelectItem value="1h">1 Hour Before</SelectItem>
                                                <SelectItem value="Custom">Custom Time</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {formData.lockType === "Custom" && (
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-muted-foreground">Custom Lock Time</Label>
                                            <Input
                                                type="datetime-local"
                                                value={formData.lockTime || ""}
                                                onChange={(e) => setFormData({ ...formData, lockTime: e.target.value })}
                                                className="h-9 text-xs"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-muted-foreground">Notes / Adjustments</Label>
                                    <Textarea
                                        className="min-h-[50px] text-xs"
                                        placeholder="Any special notes (e.g. Points adjustment)"
                                        value={formData.notes || ""}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    />
                                </div>
                            </TabsContent>
                        </div>
                    </Tabs>

                    <DialogFooter className="flex-row items-center justify-end gap-2 p-3 sm:p-4 border-t bg-surface-2 shrink-0">
                        {editingId && formData.scoreline && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setFormData({ ...formData, scoreline: "", goalscorers: "", assists: "", yellow_cards: "", red_cards: "", notes: "" })}
                                className="h-9 text-xs text-muted-foreground bg-amber-50 hover:bg-amber-100 border border-amber-200 mr-auto"
                            >
                                Reset to Upcoming
                            </Button>
                        )}
                        <Button variant="outline" onClick={resetForm} className="h-9 text-xs">Cancel</Button>
                        <Button onClick={handleSaveMatch} className="bg-red-600 hover:bg-red-700 h-9 text-xs">
                            {editingId ? "Update Match" : "Save Match"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 14-Day Calendar Strip synced directly with matches (#9, #13, #14, #15) */}
            <WeeklyFootballCalendar
                matches={matches}
                title="Next 14 Days"
                daysToShow={14}
                onSelectMatch={(matchId) => {
                    const target = matches.find(m => m.id === matchId);
                    if (target) {
                        const el = document.getElementById(`match-card-${matchId}`);
                        if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                        } else {
                            setQuickResultMatch(target);
                        }
                    }
                }}
            />

            {/* Next Match Hero with Delete, Quick Result, and folded Match Prep (#6, #8, #12) */}
            {upcomingMatches.length > 0 && (
                <NextMatchHero
                    match={upcomingMatches[0]}
                    leagueTeams={leagueTeams}
                    onManageMatch={handleEditMatch}
                    onShareMatch={handleOpenShare}
                    onDeleteMatch={handleDeleteMatch}
                    onQuickLogResult={(m) => setQuickResultMatch(m)}
                />
            )}

            {/* ================================================================= */}
            {/* MOBILE COLLAPSIBLE QUICK-ADD FIXTURE DRAWER (< 768px)             */}
            {/* ================================================================= */}
            <div className="md:hidden">
                {!isMobileQuickAddOpen ? (
                    <button
                        type="button"
                        onClick={() => setIsMobileQuickAddOpen(true)}
                        className="w-full py-2.5 px-3.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-dashed border-border flex items-center justify-between text-xs font-bold text-muted-foreground transition-colors"
                    >
                        <span className="flex items-center gap-1.5 text-foreground">
                            <Plus className="h-3.5 w-3.5 text-brand" />
                            Quick-Add Single Fixture
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">Tap to expand</span>
                    </button>
                ) : (
                    <form
                        onSubmit={(e) => {
                            handleQuickAddFixture(e);
                            setIsMobileQuickAddOpen(false);
                        }}
                        className="bg-surface-1 border border-border rounded-xl p-3 shadow-sm space-y-2.5"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-brand">
                                Quick-Add Fixture
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsMobileQuickAddOpen(false)}
                                className="text-[11px] font-semibold text-muted-foreground hover:text-foreground"
                            >
                                Close ✕
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                type="date"
                                value={quickDate}
                                onChange={(e) => setQuickDate(e.target.value)}
                                className="h-9 text-xs bg-surface-2 border-border"
                                required
                            />
                            <Input
                                type="time"
                                value={quickTime}
                                onChange={(e) => setQuickTime(e.target.value)}
                                className="h-9 text-xs bg-surface-2 border-border"
                            />
                            <button
                                type="button"
                                onClick={() => setQuickIsHome(h => !h)}
                                className={`h-9 px-3 rounded-lg text-xs font-black border transition-colors ${
                                    quickIsHome
                                        ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                        : "bg-sky-500/15 text-sky-400 border-sky-500/30"
                                }`}
                            >
                                {quickIsHome ? "HOME (H)" : "AWAY (A)"}
                            </button>
                            <select
                                value={quickCompetition}
                                onChange={(e) => setQuickCompetition(e.target.value)}
                                className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-foreground font-semibold outline-none"
                            >
                                <option value="League">League</option>
                                <option value="Middlesex Cup">Cup</option>
                                <option value="Friendly">Friendly</option>
                            </select>
                            <Input
                                type="text"
                                list="known-opponents-list"
                                placeholder="Opponent name (e.g. Hackney Wick)..."
                                value={quickOpponent}
                                onChange={(e) => setQuickOpponent(e.target.value)}
                                className="h-9 text-xs bg-surface-2 border-border col-span-2 font-medium"
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            size="sm"
                            disabled={isQuickAdding || !quickOpponent.trim()}
                            className="w-full h-9 bg-brand hover:bg-brand/90 text-brand-foreground font-bold text-xs"
                        >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            Add Fixture to Schedule
                        </Button>
                    </form>
                )}
            </div>

            {/* ================================================================= */}
            {/* DESKTOP 1-LINE QUICK-ADD FIXTURE BAR (>= 768px — UNTOUCHED)       */}
            {/* ================================================================= */}
            <form
                onSubmit={handleQuickAddFixture}
                className="hidden md:flex bg-surface-1 border border-border rounded-xl p-3 shadow-sm flex-col lg:flex-row lg:items-center gap-2.5"
            >
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground shrink-0 px-1">
                    Quick Add:
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-5 lg:flex lg:flex-1 items-center gap-2">
                    <Input
                        type="date"
                        value={quickDate}
                        onChange={(e) => setQuickDate(e.target.value)}
                        className="h-8 text-xs bg-surface-2 border-border lg:w-36"
                        required
                    />
                    <Input
                        type="time"
                        value={quickTime}
                        onChange={(e) => setQuickTime(e.target.value)}
                        className="h-8 text-xs bg-surface-2 border-border lg:w-28"
                    />
                    <button
                        type="button"
                        onClick={() => setQuickIsHome(h => !h)}
                        className={`h-8 px-3 rounded-md text-xs font-bold border transition-colors shrink-0 ${
                            quickIsHome
                                ? "bg-emerald-100/90 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border-emerald-400/70 dark:border-emerald-500/30 hover:bg-emerald-200/80 dark:hover:bg-emerald-500/25"
                                : "bg-sky-100/90 dark:bg-sky-500/15 text-sky-800 dark:text-sky-300 border-sky-400/70 dark:border-sky-500/30 hover:bg-sky-200/80 dark:hover:bg-sky-500/25"
                        }`}
                        title="Click to toggle Home / Away"
                    >
                        {quickIsHome ? "HOME (H)" : "AWAY (A)"}
                    </button>
                    <Input
                        type="text"
                        list="known-opponents-list"
                        placeholder="Opponent name (e.g. Hackney Wick)..."
                        value={quickOpponent}
                        onChange={(e) => setQuickOpponent(e.target.value)}
                        className="h-8 text-xs bg-surface-2 border-border col-span-2 sm:col-span-2 lg:flex-1 font-medium"
                        required
                    />
                    <select
                        value={quickCompetition}
                        onChange={(e) => setQuickCompetition(e.target.value)}
                        className="h-8 rounded-md border border-border bg-surface-2 px-2.5 text-xs text-foreground outline-none lg:w-32"
                    >
                        <option value="League">League</option>
                        <option value="Middlesex Cup">Cup</option>
                        <option value="Friendly">Friendly</option>
                    </select>
                </div>
                <Button
                    type="submit"
                    size="sm"
                    disabled={isQuickAdding || !quickOpponent.trim()}
                    className="h-8 bg-brand hover:bg-brand/90 text-brand-foreground font-semibold text-xs shrink-0"
                >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Add Fixture
                </Button>
            </form>

            {/* ================================================================= */}
            {/* MOBILE SUB-TABS, SEARCH & SCROLLABLE FILTERS (< 768px)            */}
            {/* ================================================================= */}
            <div className="md:hidden space-y-2.5 pb-2 border-b border-border">
                {/* Full-Width 3-Tab Switcher */}
                <div className="grid grid-cols-3 gap-1 bg-surface-1 p-1 rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => setViewSection("all")}
                        className={`py-2 rounded-lg text-xs font-extrabold transition-colors text-center ${
                            viewSection === "all"
                                ? "bg-brand text-brand-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        All ({upcomingMatches.length + pastMatches.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewSection("upcoming")}
                        className={`py-2 rounded-lg text-xs font-extrabold transition-colors text-center ${
                            viewSection === "upcoming"
                                ? "bg-brand text-brand-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Upcoming ({upcomingMatches.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewSection("results")}
                        className={`py-2 rounded-lg text-xs font-extrabold transition-colors text-center ${
                            viewSection === "results"
                                ? "bg-brand text-brand-foreground shadow-sm"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        Results ({pastMatches.length})
                    </button>
                </div>

                {/* 2-Column Search + Season Selector */}
                <div className="grid grid-cols-[1fr_auto] gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Search opponent..."
                            value={opponentSearch}
                            onChange={(e) => setOpponentSearch(e.target.value)}
                            className="pl-8 h-9 text-xs bg-surface-1 border-border rounded-xl"
                        />
                    </div>
                    <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                        <SelectTrigger className="h-9 w-[125px] text-xs bg-surface-1 border-border rounded-xl font-bold">
                            <SelectValue placeholder="Season" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Seasons</SelectItem>
                            {availableSeasons.map(season => (
                                <SelectItem key={season} value={season}>20{season.split('/')[0]}/{season.split('/')[1]}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Horizontal Scrollable Competition Pills + Bulk Select Toggle */}
                <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar pb-0.5">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setFilterType("all")}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                filterType === "all"
                                    ? "bg-foreground text-background"
                                    : "bg-surface-1 text-muted-foreground border border-border"
                            }`}
                        >
                            All
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType("league")}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                filterType === "league"
                                    ? "bg-foreground text-background"
                                    : "bg-surface-1 text-muted-foreground border border-border"
                            }`}
                        >
                            League
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType("cup")}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                filterType === "cup"
                                    ? "bg-foreground text-background"
                                    : "bg-surface-1 text-muted-foreground border border-border"
                            }`}
                        >
                            Cups
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterType("friendly")}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-colors ${
                                filterType === "friendly"
                                    ? "bg-foreground text-background"
                                    : "bg-surface-1 text-muted-foreground border border-border"
                            }`}
                        >
                            Friendlies
                        </button>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {isBulkSelectMode && selectedMatchIds.size > 0 && (
                            <button
                                type="button"
                                onClick={handleBulkDelete}
                                className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-600 text-white flex items-center gap-1"
                            >
                                <Trash2 className="h-3 w-3" />
                                Delete ({selectedMatchIds.size})
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => {
                                setIsBulkSelectMode(prev => !prev);
                                setSelectedMatchIds(new Set());
                            }}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                                isBulkSelectMode
                                    ? "bg-brand/15 text-brand border-brand/40"
                                    : "bg-surface-1 text-muted-foreground border-border"
                            }`}
                        >
                            <CheckSquare className="h-3 w-3" />
                            {isBulkSelectMode ? "Done" : "Select"}
                        </button>
                    </div>
                </div>
            </div>

            {/* ================================================================= */}
            {/* DESKTOP SUB-TABS, SEARCH & FILTERS (>= 768px — UNTOUCHED)         */}
            {/* ================================================================= */}
            <div className="hidden md:flex flex-col gap-3 pb-3 border-b border-border">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* View Section Switcher */}
                    <div className="flex items-center gap-1 bg-surface-1 p-1 rounded-xl border border-border w-fit">
                        <button
                            type="button"
                            onClick={() => setViewSection("all")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                viewSection === "all"
                                    ? "bg-brand text-brand-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            All ({upcomingMatches.length + pastMatches.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewSection("upcoming")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                viewSection === "upcoming"
                                    ? "bg-brand text-brand-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Upcoming ({upcomingMatches.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewSection("results")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                                viewSection === "results"
                                    ? "bg-brand text-brand-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            Results &amp; Season Log ({pastMatches.length})
                        </button>
                    </div>

                    {/* Opponent Search + Season Selector */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative w-full sm:w-52">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search opponent..."
                                value={opponentSearch}
                                onChange={(e) => setOpponentSearch(e.target.value)}
                                className="pl-8 h-8 text-xs bg-surface-1 border-border"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-muted-foreground hidden sm:inline-block">Season:</span>
                            <Select value={seasonFilter} onValueChange={setSeasonFilter}>
                                <SelectTrigger className="h-8 w-[140px] text-xs bg-surface-1 border-border shadow-sm font-medium">
                                    <SelectValue placeholder="Select Season" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Seasons</SelectItem>
                                    {availableSeasons.map(season => (
                                        <SelectItem key={season} value={season}>20{season.split('/')[0]}/20{season.split('/')[1]}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Competition Pill Filters */}
                <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                        variant={filterType === "all" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("all")}
                        className="rounded-full h-7 text-xs px-3"
                    >
                        All Competitions
                    </Button>
                    <Button
                        variant={filterType === "league" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("league")}
                        className="rounded-full h-7 text-xs px-3"
                    >
                        League
                    </Button>
                    <Button
                        variant={filterType === "cup" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("cup")}
                        className="rounded-full h-7 text-xs px-3"
                    >
                        Cups
                    </Button>
                    <Button
                        variant={filterType === "friendly" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setFilterType("friendly")}
                        className="rounded-full h-7 text-xs px-3"
                    >
                        Friendlies
                    </Button>
                </div>
            </div>

            {/* Paste / Import Modal (#1, #2, #5) */}
            <FootballDataImportCentre
                clubId={clubId || ""}
                clubName={settings.name}
                clubSettings={settings}
                knownOpponents={knownOpponents}
                isOpen={isImportModalOpen}
                onOpenChange={setIsImportModalOpen}
                onImportComplete={(importedIds) => {
                    if (importedIds && importedIds.length > 0) {
                        setLastImportedIds(importedIds);
                    }
                    fetchMatches();
                }}
            />

            {/* Quick Result, Goals & Assists Modal (#16, #17, #18, #20) */}
            <QuickResultScorersModal
                match={quickResultMatch}
                clubName={settings.name || "Camden United"}
                isOpen={quickResultMatch !== null}
                onClose={() => setQuickResultMatch(null)}
                onSaved={fetchMatches}
            />

            {/* Upcoming Fixtures List — keeps Next Match visible with 'NEXT UP' badge (#7) */}
            {(viewSection === "all" || viewSection === "upcoming") && (
                <UpcomingFixtures
                    matches={upcomingMatches}
                    renderCard={(match) => (
                        <MatchCard
                            key={match.id}
                            match={match}
                            isPast={false}
                            isNextUp={upcomingMatches[0]?.id === match.id}
                        />
                    )}
                />
            )}

            {/* Recent Results & Season Log */}
            {(viewSection === "all" || viewSection === "results") && (
                <RecentResults
                    matches={pastMatches}
                    renderCard={(match) => <MatchCard key={match.id} match={match} isPast={true} />}
                />
            )}

            {/* Share WhatsApp Poll Modal */}
            <Dialog open={activeShareMatch !== null} onOpenChange={(open) => { if (!open) setActiveShareMatch(null); }}>
                <DialogContent className="z-[60] w-[95vw] sm:max-w-[620px] max-h-[88dvh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-emerald-700">
                            <MessageCircle className="h-5 w-5" /> Generate Match Availability Poll
                        </DialogTitle>
                        <DialogDescription>
                            Configure the details to generate an availability message for {activeShareMatch?.opponent ? `vs ${activeShareMatch.opponent}` : ""}.
                        </DialogDescription>
                    </DialogHeader>

                    {activeShareMatch && (
                        <div className="grid gap-4 py-2 text-slate-800">
                            {/* Toggle switches/checkboxes */}
                            <div className="space-y-2 border-b border-border pb-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Include Details:</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1.5 hover:bg-surface-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeOpponent}
                                            onChange={(e) => setIncludeOpponent(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Opponent</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1.5 hover:bg-surface-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeCompetition}
                                            onChange={(e) => setIncludeCompetition(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Competition</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1.5 hover:bg-surface-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeVenue}
                                            onChange={(e) => setIncludeVenue(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Venue Location</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1.5 hover:bg-surface-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeKickoff}
                                            onChange={(e) => setIncludeKickoff(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Kick Off Time</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-1.5 hover:bg-surface-2 rounded">
                                        <input
                                            type="checkbox"
                                            checked={includeMeetTime}
                                            onChange={(e) => setIncludeMeetTime(e.target.checked)}
                                            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <span>Meet Details</span>
                                    </label>
                                </div>
                            </div>

                            {/* Meet Details Fields */}
                            {includeMeetTime && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-surface-2 p-3 rounded-lg border border-border">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Meet Time</Label>
                                        <Input
                                            type="time"
                                            value={meetTime}
                                            onChange={(e) => setMeetTime(e.target.value)}
                                            className="text-sm bg-surface-2 border-border"
                                        />
                                        <p className="text-[10px] text-slate-400">Prefilled to 60 mins before kickoff ({activeShareMatch.time})</p>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Meet Location / Venue</Label>
                                        <Input
                                            value={meetLocation}
                                            onChange={(e) => setMeetLocation(e.target.value)}
                                            placeholder="e.g. Market Road"
                                            className="text-sm bg-surface-2 border-border"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Additional Notes Textarea */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-semibold">Additional Notes (Optional)</Label>
                                <Textarea
                                    value={additionalNotes}
                                    onChange={(e) => setAdditionalNotes(e.target.value)}
                                    placeholder="e.g. ⚠ Bring running trainers."
                                    className="text-xs min-h-[60px] border-border"
                                />
                            </div>

                            {/* Live Preview block */}
                            <div className="space-y-1.5 border-t border-border pt-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Live Preview</Label>
                                <div className="relative">
                                    <Textarea
                                        value={getGeneratedPollText()}
                                        readOnly
                                        className="text-xs min-h-[200px] font-mono bg-surface-2 border-border text-muted-foreground focus-visible:ring-0 cursor-default"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-3">
                        <Button variant="outline" onClick={() => setActiveShareMatch(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant={copyStatus === "copied" ? "default" : "secondary"}
                            onClick={handleCopyShareText}
                            className={`font-semibold min-w-[160px] transition-all ${
                                copyStatus === "copied" 
                                    ? "bg-green-600 hover:bg-green-600 text-white" 
                                    : "bg-surface-3 hover:bg-surface-4 text-foreground"
                            }`}
                        >
                            {copyStatus === "copied" ? "✓ Copied Successfully" : "Copy to Clipboard"}
                        </Button>
                        <Button
                            onClick={handleSendWhatsApp}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" /> Send to WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Opposition & Referee Confirmation Modal */}
            <Dialog open={selectedConfirmMatch !== null} onOpenChange={(open) => { if (!open) setSelectedConfirmMatch(null); }}>
                <DialogContent className="z-[60] w-[95vw] sm:max-w-[800px] max-h-[90dvh] overflow-y-auto rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-blue-700">
                            <Share2 className="h-5 w-5" /> Home Game Confirmation Details
                        </DialogTitle>
                        <DialogDescription>
                            Review and customize the matchday details for opposition managers, secretaries, and referees.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedConfirmMatch && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2 text-slate-800">
                            {/* Left Column: Settings Form */}
                            <div className="space-y-4 pr-0 md:pr-4 md:border-r border-border">
                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Matchday Variables</h4>
                                
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Stadium / Home Ground Address</Label>
                                    <Input 
                                        value={confirmStadiumAddress}
                                        onChange={(e) => setConfirmStadiumAddress(e.target.value)}
                                        className="text-xs border-border"
                                        placeholder="Enter stadium address"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Pitch Surface</Label>
                                        <Select value={confirmSurfaceType} onValueChange={setConfirmSurfaceType}>
                                            <SelectTrigger className="text-xs border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="3G Pitch">3G Pitch</SelectItem>
                                                <SelectItem value="4G Pitch">4G Pitch</SelectItem>
                                                <SelectItem value="Grass">Grass</SelectItem>
                                                <SelectItem value="AstroTurf">AstroTurf</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Meet Time (Offset)</Label>
                                        <Select value={confirmMeetTimeOffset} onValueChange={setConfirmMeetTimeOffset}>
                                            <SelectTrigger className="text-xs border-border">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="z-[70]">
                                                <SelectItem value="-30">30m before KO</SelectItem>
                                                <SelectItem value="-45">45m before KO</SelectItem>
                                                <SelectItem value="-60">60m before KO</SelectItem>
                                                <SelectItem value="-75">75m before KO</SelectItem>
                                                <SelectItem value="-90">90m before KO</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Our Kit Colors</Label>
                                    <Input 
                                        value={confirmKitColors}
                                        onChange={(e) => setConfirmKitColors(e.target.value)}
                                        className="text-xs border-border"
                                        placeholder="e.g. Red Shirts, Black Shorts"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold">Post-Match Hospitality / Dietary</Label>
                                    <Input 
                                        value={confirmDietaryDetails}
                                        onChange={(e) => setConfirmDietaryDetails(e.target.value)}
                                        className="text-xs border-border"
                                        placeholder="e.g. Food provided at the pub"
                                    />
                                </div>

                                <div className="border-t border-border pt-3 space-y-3">
                                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referee Settings</h4>
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-semibold">Referee Name</Label>
                                        <Input 
                                            value={confirmRefName}
                                            onChange={(e) => setConfirmRefName(e.target.value)}
                                            className="text-xs border-border"
                                            placeholder="e.g. Mark, Sir, etc."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Referee Fee (£)</Label>
                                            <Input 
                                                value={confirmRefFee}
                                                onChange={(e) => setConfirmRefFee(e.target.value)}
                                                className="text-xs border-border"
                                                placeholder="e.g. 45"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-semibold">Payment Method</Label>
                                            <Select value={confirmPaymentMethod} onValueChange={setConfirmPaymentMethod}>
                                                <SelectTrigger className="text-xs border-border">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="z-[70]">
                                                    <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                                                    <SelectItem value="Cash">Cash</SelectItem>
                                                    <SelectItem value="Paid by Club">Paid by Club</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column: Previews and Share Buttons */}
                            <div className="space-y-4">
                                <Tabs defaultValue="opponent" className="w-full">
                                    <TabsList className="grid w-full grid-cols-2 bg-surface-3">
                                        <TabsTrigger value="opponent" className="text-xs font-semibold">Opponent Manager</TabsTrigger>
                                        <TabsTrigger value="referee" className="text-xs font-semibold">Referee</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="opponent" className="space-y-3 pt-2">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Opponent Message Preview</Label>
                                        <Textarea
                                            value={getOpponentConfirmText()}
                                            readOnly
                                            className="text-xs min-h-[220px] font-mono bg-surface-2 border-border text-muted-foreground focus-visible:ring-0 cursor-default"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant={confirmCopyStatus === "opp_copied" ? "default" : "secondary"}
                                                onClick={handleCopyOpponentText}
                                                className={`text-xs font-semibold flex-1 transition-all ${
                                                    confirmCopyStatus === "opp_copied" 
                                                        ? "bg-green-600 hover:bg-green-600 text-white" 
                                                        : "bg-surface-3 hover:bg-surface-4 text-foreground"
                                                }`}
                                            >
                                                {confirmCopyStatus === "opp_copied" ? "✓ Copied" : "Copy Message"}
                                            </Button>
                                            <Button
                                                onClick={handleSendOpponentWhatsApp}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex-1"
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1.5" /> Send WhatsApp
                                            </Button>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="referee" className="space-y-3 pt-2">
                                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Referee Message Preview</Label>
                                        <Textarea
                                            value={getRefConfirmText()}
                                            readOnly
                                            className="text-xs min-h-[220px] font-mono bg-surface-2 border-border text-muted-foreground focus-visible:ring-0 cursor-default"
                                        />
                                        <div className="flex gap-2">
                                            <Button
                                                variant={confirmCopyStatus === "ref_copied" ? "default" : "secondary"}
                                                onClick={handleCopyRefText}
                                                className={`text-xs font-semibold flex-1 transition-all ${
                                                    confirmCopyStatus === "ref_copied" 
                                                        ? "bg-green-600 hover:bg-green-600 text-white" 
                                                        : "bg-surface-3 hover:bg-surface-4 text-foreground"
                                                }`}
                                            >
                                                {confirmCopyStatus === "ref_copied" ? "✓ Copied" : "Copy Message"}
                                            </Button>
                                            <Button
                                                onClick={handleSendRefWhatsApp}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs flex-1"
                                            >
                                                <ExternalLink className="h-3 w-3 mr-1.5" /> Send WhatsApp
                                            </Button>
                                        </div>
                                    </TabsContent>
                                </Tabs>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="border-t border-border pt-3">
                        <Button variant="outline" onClick={() => setSelectedConfirmMatch(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Quick Match Expense Modal */}
            <Dialog open={isExpenseOpen} onOpenChange={setIsExpenseOpen}>
                <DialogContent className="z-[60] w-[95vw] sm:max-w-[400px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-slate-900">
                            <Coins className="h-5 w-5 text-amber-500" /> Log Matchday Expense
                        </DialogTitle>
                        <DialogDescription>
                            Quickly log referee fees, pitch hire, or other cash payouts for the match vs <span className="font-bold text-slate-800">{selectedExpenseMatch?.opponent}</span> ({selectedExpenseMatch?.date}).
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2 text-slate-900">
                        <div className="space-y-1">
                            <Label htmlFor="expenseAmount" className="text-xs font-bold text-muted-foreground">Amount (£)</Label>
                            <Input
                                id="expenseAmount"
                                type="number"
                                step="0.01"
                                placeholder="e.g. 40.00"
                                value={expenseAmount}
                                onChange={e => setExpenseAmount(e.target.value)}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="expenseCategory" className="text-xs font-bold text-muted-foreground">Category</Label>
                            <select
                                id="expenseCategory"
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                value={expenseCategory}
                                onChange={e => setExpenseCategory(e.target.value)}
                            >
                                <option value="Ref Fees">Ref Fees</option>
                                <option value="Pitch Hire">Pitch Hire</option>
                                <option value="Equipment">Equipment</option>
                                <option value="Matchday Food/Drink">Matchday Food/Drink</option>
                                <option value="Other">Other</option>
                            </select>
                        </div>

                        <div className="space-y-1">
                            <Label htmlFor="expenseNotes" className="text-xs font-bold text-muted-foreground">Notes (Optional)</Label>
                            <Input
                                id="expenseNotes"
                                placeholder="e.g. Cash paid to ref John"
                                value={expenseNotes}
                                onChange={e => setExpenseNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="flex-row justify-end gap-2">
                        <Button variant="outline" onClick={() => setIsExpenseOpen(false)}>Cancel</Button>
                        <Button onClick={handleSaveExpense} className="bg-amber-600 hover:bg-amber-700 text-white">Save Expense</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
