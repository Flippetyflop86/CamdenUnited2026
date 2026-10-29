"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Recruit, RecruitPipelineStage, CommutePracticality } from "@/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Plus,
    Trash2,
    Edit2,
    MapPin,
    Star,
    ChevronDown,
    ChevronRight,
    FileDown,
    FileSpreadsheet,
    Upload,
    ArrowUpRight,
    Phone,
    Mail,
    Instagram,
    MessageCircle,
    LayoutGrid,
    Table as TableIcon,
    GitCompare,
    Filter,
    X,
    Footprints,
    Award,
    Car,
    Check,
    Users,
    Download,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { useClub } from "@/context/club-context";
import {
    PIPELINE_STAGES,
    COMMUTE_OPTIONS,
    STEP_LEVEL_OPTIONS,
    RECRUIT_ROLES,
    ALL_RECRUIT_POSITIONS,
    parseRecruitFromDbRow,
    serializeRecruitForDb,
    formatWhatsAppUrl,
    exportRecruitsToCSV,
    exportRecruitsToExcelXLS,
    downloadBlankRecruitTemplateCSV,
    parseBulkRecruitImportText,
} from "@/lib/recruitment-utils";

interface SquadComparisonPlayer {
    id: string;
    name: string;
    primaryPosition: string;
    secondaryPosition: string;
    age: number;
    preferredFoot: string;
    appearances: number;
    goals: number;
    assists: number;
    notes: string;
}

export default function RecruitmentPage() {
    const { settings } = useClub();
    const [recruits, setRecruits] = useState<Recruit[]>([]);
    const [squadPlayers, setSquadPlayers] = useState<SquadComparisonPlayer[]>([]);

    // View & UI State (#21)
    const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
    const [expandedPositions, setExpandedPositions] = useState<string[]>(["GK", "DEF", "MID", "FWD"]);
    const [enlargedRecruit, setEnlargedRecruit] = useState<Recruit | null>(null);

    // Multi-Filter State (#23)
    const [searchTerm, setSearchTerm] = useState("");
    const [positionFilter, setPositionFilter] = useState<string>("ALL");
    const [stageFilter, setStageFilter] = useState<string>("ALL");
    const [statusFilter, setStatusFilter] = useState<string>("ALL");
    const [footFilter, setFootFilter] = useState<string>("ALL");
    const [minRatingFilter, setMinRatingFilter] = useState<number>(0);
    const [roleFilter, setRoleFilter] = useState<string>("ALL");
    const [commuteFilter, setCommuteFilter] = useState<string>("ALL");
    const [onlyTrialists, setOnlyTrialists] = useState<boolean>(false);
    const [sortBy, setSortBy] = useState<"rating" | "name" | "age" | "recent">("rating");

    // Add / Edit Modal State
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingRecruit, setEditingRecruit] = useState<Recruit | null>(null);

    // Bulk Import Modal State (#2)
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importRawText, setImportRawText] = useState("");
    const [isImporting, setIsImporting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Side-by-Side Comparison State (#24)
    const [compareIds, setCompareIds] = useState<string[]>([]);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [compareSlotA, setCompareSlotA] = useState<string>("");
    const [compareSlotB, setCompareSlotB] = useState<string>(""); // Can be recruit ID or "squad:<id>"

    const [formData, setFormData] = useState({
        name: "",
        primaryPosition: "MID",
        secondaryPosition: "",
        age: "",
        location: "",
        status: "Attached" as "Attached" | "Unattached",
        currentClub: "",
        onTrial: false,
        scoutedRole: "1st Team Player" as Recruit["scoutedRole"],
        notes: "",
        clubConnection: "",
        preferredFoot: "Right" as "Right" | "Left" | "Both",
        phone: "",
        email: "",
        instagram: "",
        highestLevel: "",
        previousClubs: "",
        starRating: 4,
        pipelineStage: "Scouted" as RecruitPipelineStage,
        commutePracticality: "Easy / Local" as CommutePracticality,
    });

    useEffect(() => {
        fetchRecruits();
        fetchSquadPlayersForComparison();
        const channel = supabase
            .channel("public:recruits")
            .on("postgres_changes", { event: "*", schema: "public", table: "recruits" }, fetchRecruits)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchRecruits = async () => {
        const { data } = await supabase.from("recruits").select("*").order("updated_at", { ascending: false });
        if (data) {
            setRecruits(data.map(parseRecruitFromDbRow));
        }
    };

    const fetchSquadPlayersForComparison = async () => {
        const { data: pData } = await supabase
            .from("players")
            .select("id, first_name, last_name, position, secondary_positions, age, preferred_foot, appearances, goals, assists, notes")
            .order("last_name");
        if (pData) {
            setSquadPlayers(
                pData.map((p: any) => ({
                    id: p.id,
                    name: `${p.first_name || ""} ${p.last_name || ""}`.trim(),
                    primaryPosition: p.position || "MID",
                    secondaryPosition: Array.isArray(p.secondary_positions) ? p.secondary_positions.join(", ") : "",
                    age: Number(p.age) || 0,
                    preferredFoot: p.preferred_foot || "Right",
                    appearances: Number(p.appearances) || 0,
                    goals: Number(p.goals) || 0,
                    assists: Number(p.assists) || 0,
                    notes: p.notes || "",
                }))
            );
        }
    };

    const getPositionBorder = (pos: string) => {
        const p = (pos || "").toUpperCase();
        if (p === "GK") return "border-amber-500/70";
        if (["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p)) return "border-sky-500/70";
        if (["MID", "CM", "CDM", "CAM", "RM", "LM"].includes(p)) return "border-emerald-500/70";
        return "border-rose-500/70";
    };

    const getPipelineBadgeStyle = (stage?: RecruitPipelineStage) => {
        switch (stage) {
            case "Scouted":
                return "bg-slate-500/20 text-slate-300 border-slate-500/40";
            case "Contacted":
                return "bg-sky-500/20 text-sky-300 border-sky-500/40";
            case "Invited to Training":
                return "bg-indigo-500/20 text-indigo-300 border-indigo-500/40";
            case "On Trial":
                return "bg-amber-500/20 text-amber-300 border-amber-500/40";
            case "Approach In (7-Day)":
                return "bg-purple-500/20 text-purple-300 border-purple-500/40";
            case "Keep Warm":
                return "bg-orange-500/20 text-orange-300 border-orange-500/40";
            case "Signed":
                return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
            default:
                return "bg-slate-500/20 text-slate-300 border-slate-500/40";
        }
    };

    const getCommuteBadgeStyle = (commute?: CommutePracticality) => {
        switch (commute) {
            case "Easy / Local":
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
            case "Moderate":
                return "bg-amber-500/15 text-amber-400 border-amber-500/30";
            case "Long Commute":
                return "bg-rose-500/15 text-rose-400 border-rose-500/30";
            default:
                return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
        }
    };

    const handleAddOrEdit = async () => {
        if (!formData.name.trim()) return;

        const payload = serializeRecruitForDb(formData);

        if (editingRecruit) {
            const { error } = await supabase.from("recruits").update(payload).eq("id", editingRecruit.id);
            if (error) {
                alert("Error updating recruit: " + error.message);
                return;
            }
        } else {
            const { error } = await supabase.from("recruits").insert([payload]);
            if (error) {
                alert("Error inserting recruit: " + error.message);
                return;
            }
        }

        await fetchRecruits();
        handleCloseDialog();
    };

    const handleQuickUpdateRecruit = async (
        recruit: Recruit,
        updates: Partial<Pick<Recruit, "pipelineStage" | "starRating" | "onTrial">>
    ) => {
        const nextStage = updates.pipelineStage ?? recruit.pipelineStage ?? "Scouted";
        const nextTrial =
            updates.onTrial !== undefined
                ? updates.onTrial
                : nextStage === "On Trial"
                ? true
                : recruit.onTrial && updates.pipelineStage && updates.pipelineStage !== "On Trial"
                ? false
                : recruit.onTrial;
        const nextRating = updates.starRating ?? recruit.starRating ?? 3;

        const merged: Recruit = {
            ...recruit,
            pipelineStage: nextStage,
            onTrial: nextTrial,
            starRating: nextRating,
        };

        setRecruits((prev) => prev.map((r) => (r.id === recruit.id ? merged : r)));
        if (enlargedRecruit?.id === recruit.id) {
            setEnlargedRecruit(merged);
        }

        const payload = serializeRecruitForDb(merged);
        await supabase.from("recruits").update(payload).eq("id", recruit.id);
    };

    const handleEdit = (recruit: Recruit) => {
        setEditingRecruit(recruit);
        setFormData({
            name: recruit.name,
            primaryPosition: recruit.primaryPosition,
            secondaryPosition: recruit.secondaryPosition || "",
            age: recruit.age ? recruit.age.toString() : "",
            location: recruit.location || "",
            status: recruit.status,
            currentClub: recruit.currentClub || "",
            onTrial: recruit.onTrial,
            scoutedRole: recruit.scoutedRole,
            notes: recruit.notes || "",
            clubConnection: recruit.clubConnection || "",
            preferredFoot: recruit.preferredFoot || "Right",
            phone: recruit.phone || "",
            email: recruit.email || "",
            instagram: recruit.instagram || "",
            highestLevel: recruit.highestLevel || "",
            previousClubs: recruit.previousClubs || "",
            starRating: recruit.starRating || 3,
            pipelineStage: recruit.pipelineStage || (recruit.onTrial ? "On Trial" : "Scouted"),
            commutePracticality: recruit.commutePracticality || "Easy / Local",
        });
        setIsDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this player from your Recruitment Black Book?")) {
            const { error } = await supabase.from("recruits").delete().eq("id", id);
            if (error) {
                alert("Error deleting recruit: " + error.message);
                return;
            }
            setCompareIds((prev) => prev.filter((cid) => cid !== id));
            await fetchRecruits();
        }
    };

    const handleCloseDialog = () => {
        setIsDialogOpen(false);
        setEditingRecruit(null);
        setFormData({
            name: "",
            primaryPosition: "MID",
            secondaryPosition: "",
            age: "",
            location: "",
            status: "Attached",
            currentClub: "",
            onTrial: false,
            scoutedRole: "1st Team Player",
            notes: "",
            clubConnection: "",
            preferredFoot: "Right",
            phone: "",
            email: "",
            instagram: "",
            highestLevel: "",
            previousClubs: "",
            starRating: 4,
            pipelineStage: "Scouted",
            commutePracticality: "Easy / Local",
        });
    };

    const handleSignPlayer = async (recruit: Recruit) => {
        if (!window.confirm(`Sign ${recruit.name} to the First Team squad?`)) return;

        const nameParts = recruit.name.trim().split(/\s+/);
        const firstName = nameParts[0] || "Unknown";
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

        const { error: insertError } = await supabase.from("players").insert([
            {
                first_name: firstName,
                last_name: lastName,
                position: recruit.primaryPosition,
                age: recruit.age || 21,
                preferred_foot: recruit.preferredFoot || "Right",
                squad: "firstTeam",
                medical_status: "Available",
                availability: true,
                notes: `Signed from Recruitment Black Book.${recruit.highestLevel ? ` Level: ${recruit.highestLevel}.` : ""}${recruit.previousClubs ? ` Former clubs: ${recruit.previousClubs}.` : ""} ${recruit.notes || ""}`.trim(),
            },
        ]);

        if (insertError) {
            alert("Error signing player: " + insertError.message);
            return;
        }

        await supabase.from("recruits").delete().eq("id", recruit.id);
        await fetchRecruits();
        await fetchSquadPlayersForComparison();
        alert(`${recruit.name} has been signed and added to the Squad page!`);
    };

    // #2: Bulk CSV / Excel Import Handlers
    const previewImportedRecruits = useMemo(() => {
        return parseBulkRecruitImportText(importRawText);
    }, [importRawText]);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const text = String(evt.target?.result || "");
            setImportRawText(text);
        };
        reader.readAsText(file);
    };

    const handleConfirmBulkImport = async () => {
        if (previewImportedRecruits.length === 0) return;
        setIsImporting(true);
        try {
            const payloads = previewImportedRecruits.map((r) => serializeRecruitForDb(r));
            const { error } = await supabase.from("recruits").insert(payloads);
            if (error) {
                alert("Bulk import failed: " + error.message);
                return;
            }
            await fetchRecruits();
            setImportRawText("");
            setIsImportModalOpen(false);
        } finally {
            setIsImporting(false);
        }
    };

    // #24: Toggle compare selection
    const toggleCompareRecruit = (id: string) => {
        setCompareIds((prev) => {
            if (prev.includes(id)) {
                return prev.filter((x) => x !== id);
            }
            if (prev.length >= 2) {
                return [prev[1], id];
            }
            return [...prev, id];
        });
    };

    const openComparisonModal = (firstId?: string, secondId?: string) => {
        const a = firstId || compareIds[0] || recruits[0]?.id || "";
        const b =
            secondId ||
            compareIds[1] ||
            recruits.find((r) => r.id !== a)?.id ||
            (squadPlayers[0] ? `squad:${squadPlayers[0].id}` : "");
        setCompareSlotA(a);
        setCompareSlotB(b);
        setIsCompareModalOpen(true);
    };

    const sections = [
        { id: "GK", title: "Goalkeepers", positions: ["GK"] },
        { id: "DEF", title: "Defenders", positions: ["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"] },
        { id: "MID", title: "Midfielders", positions: ["MID", "CDM", "CM", "CAM", "RM", "LM"] },
        { id: "FWD", title: "Forwards", positions: ["FWD", "RW", "LW", "CF", "ST"] },
    ];

    // #23: Multi-Filter & Sort logic
    const filteredRecruits = useMemo(() => {
        return recruits
            .filter((r) => {
                if (searchTerm.trim()) {
                    const q = searchTerm.toLowerCase();
                    const hay = [
                        r.name,
                        r.primaryPosition,
                        r.secondaryPosition,
                        r.location,
                        r.currentClub,
                        r.highestLevel,
                        r.previousClubs,
                        r.clubConnection,
                        r.notes,
                        r.phone,
                        r.instagram,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase();
                    if (!hay.includes(q)) return false;
                }

                if (positionFilter !== "ALL") {
                    const sec = (r.secondaryPosition || "").toUpperCase();
                    const prim = (r.primaryPosition || "").toUpperCase();
                    const groupSection = sections.find((s) => s.id === positionFilter);
                    if (groupSection) {
                        const inGroup =
                            groupSection.positions.includes(prim) ||
                            groupSection.positions.some((gp) => sec.includes(gp));
                        if (!inGroup) return false;
                    } else if (prim !== positionFilter && !sec.includes(positionFilter)) {
                        return false;
                    }
                }

                if (stageFilter !== "ALL") {
                    const st = r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted");
                    if (st !== stageFilter) return false;
                }

                if (statusFilter !== "ALL" && r.status !== statusFilter) {
                    return false;
                }

                if (footFilter !== "ALL" && (r.preferredFoot || "Right") !== footFilter) {
                    return false;
                }

                if (minRatingFilter > 0 && (r.starRating || 3) < minRatingFilter) {
                    return false;
                }

                if (roleFilter !== "ALL" && r.scoutedRole !== roleFilter) {
                    return false;
                }

                if (commuteFilter !== "ALL" && (r.commutePracticality || "Easy / Local") !== commuteFilter) {
                    return false;
                }

                if (onlyTrialists && !r.onTrial && r.pipelineStage !== "On Trial") {
                    return false;
                }

                return true;
            })
            .sort((a, b) => {
                if (sortBy === "rating") {
                    const diff = (b.starRating || 3) - (a.starRating || 3);
                    if (diff !== 0) return diff;
                    return a.name.localeCompare(b.name);
                }
                if (sortBy === "name") {
                    return a.name.localeCompare(b.name);
                }
                if (sortBy === "age") {
                    return (a.age || 99) - (b.age || 99);
                }
                return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
            });
    }, [
        recruits,
        searchTerm,
        positionFilter,
        stageFilter,
        statusFilter,
        footFilter,
        minRatingFilter,
        roleFilter,
        commuteFilter,
        onlyTrialists,
        sortBy,
    ]);

    const activeFilterCount = useMemo(() => {
        let count = 0;
        if (searchTerm.trim()) count++;
        if (positionFilter !== "ALL") count++;
        if (stageFilter !== "ALL") count++;
        if (statusFilter !== "ALL") count++;
        if (footFilter !== "ALL") count++;
        if (minRatingFilter > 0) count++;
        if (roleFilter !== "ALL") count++;
        if (commuteFilter !== "ALL") count++;
        if (onlyTrialists) count++;
        return count;
    }, [
        searchTerm,
        positionFilter,
        stageFilter,
        statusFilter,
        footFilter,
        minRatingFilter,
        roleFilter,
        commuteFilter,
        onlyTrialists,
    ]);

    const resetAllFilters = () => {
        setSearchTerm("");
        setPositionFilter("ALL");
        setStageFilter("ALL");
        setStatusFilter("ALL");
        setFootFilter("ALL");
        setMinRatingFilter(0);
        setRoleFilter("ALL");
        setCommuteFilter("ALL");
        setOnlyTrialists(false);
    };

    const stageCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        PIPELINE_STAGES.forEach((s) => (counts[s] = 0));
        recruits.forEach((r) => {
            const st = r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted");
            counts[st] = (counts[st] || 0) + 1;
        });
        return counts;
    }, [recruits]);

    const getRecruitsForSection = (posList: string[]) => {
        return filteredRecruits.filter((r) => posList.includes(r.primaryPosition.toUpperCase()));
    };

    const togglePosition = (pos: string) => {
        setExpandedPositions((prev) =>
            prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
        );
    };

    const handleExportPDF = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const content = `
            <html>
            <head>
                <title>Recruitment Black Book - ${settings.name}</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 32px; color: #1e293b; line-height: 1.45; }
                    .header { text-align: center; border-bottom: 3px solid #ef4444; padding-bottom: 16px; margin-bottom: 24px; }
                    .logo { font-size: 22px; font-weight: bold; color: #ef4444; text-transform: uppercase; letter-spacing: 2px; }
                    h1 { margin: 4px 0; font-size: 24px; }
                    .date { color: #64748b; font-size: 0.85em; }
                    .section { margin-bottom: 32px; page-break-inside: avoid; }
                    .section-title { font-size: 1.2em; font-weight: bold; background: #f1f5f9; padding: 8px 12px; border-left: 5px solid #ef4444; margin-bottom: 12px; color: #0f172a; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; table-layout: fixed; }
                    th { text-align: left; padding: 8px; border-bottom: 2px solid #cbd5e1; font-size: 0.72em; color: #475569; text-transform: uppercase; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.8em; vertical-align: top; word-wrap: break-word; }
                    .player-name { font-weight: bold; color: #0f172a; font-size: 0.95em; }
                    .pos-badge { font-weight: bold; color: #ef4444; }
                    .stars { color: #d97706; font-weight: bold; letter-spacing: 1px; }
                    .notes { color: #334155; font-size: 0.85em; margin-top: 4px; background: #f8fafc; padding: 5px; border-radius: 4px; border: 1px solid #e2e8f0; }
                </style>
            </head>
            <body>
                <div class="header">
                    <div class="logo">${settings.name} Recruitment Hub</div>
                    <h1>MANAGER'S BLACK BOOK & SCOUTING REPORT</h1>
                    <div class="date">Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} • ${filteredRecruits.length} Targets</div>
                </div>
                ${sections
                    .map((section) => {
                        const sectionRecruits = getRecruitsForSection(section.positions);
                        if (sectionRecruits.length === 0) return "";
                        return `
                        <div class="section">
                            <div class="section-title">${section.title.toUpperCase()} (${sectionRecruits.length})</div>
                            <table>
                                <thead>
                                    <tr>
                                        <th style="width: 22%;">Player & Pos</th>
                                        <th style="width: 14%;">Rating & Role</th>
                                        <th style="width: 16%;">Stage & Club</th>
                                        <th style="width: 18%;">Pedigree & Contact</th>
                                        <th style="width: 30%;">Scouting Notes & Connection</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${sectionRecruits
                                        .map(
                                            (r) => `
                                        <tr>
                                            <td>
                                                <div class="player-name">${r.name} (${r.age || "?"} yo)</div>
                                                <div class="pos-badge">${r.primaryPosition}${r.secondaryPosition ? ` (${r.secondaryPosition})` : ""} • ${r.preferredFoot || "Right"} Foot</div>
                                                <div style="font-size:0.8em;color:#64748b;">📍 ${r.location || "Unknown"} (${r.commutePracticality || "Easy / Local"})</div>
                                            </td>
                                            <td>
                                                <div class="stars">${"★".repeat(r.starRating || 3)}${"☆".repeat(5 - (r.starRating || 3))}</div>
                                                <div><strong>${r.scoutedRole}</strong></div>
                                            </td>
                                            <td>
                                                <div><strong>${r.pipelineStage || "Scouted"}</strong></div>
                                                <div>${r.status === "Unattached" ? "Free Agent" : r.currentClub || "Attached"}</div>
                                            </td>
                                            <td>
                                                ${r.highestLevel ? `<div><strong>Level:</strong> ${r.highestLevel}</div>` : ""}
                                                ${r.previousClubs ? `<div style="font-size:0.8em;color:#475569;">Prev: ${r.previousClubs}</div>` : ""}
                                                ${r.phone ? `<div style="font-size:0.8em;">📞 ${r.phone}</div>` : ""}
                                                ${r.instagram ? `<div style="font-size:0.8em;">📸 ${r.instagram}</div>` : ""}
                                            </td>
                                            <td>
                                                ${r.clubConnection ? `<div style="color:#dc2626;font-style:italic;font-size:0.85em;">🔗 ${r.clubConnection}</div>` : ""}
                                                <div class="notes">${r.notes || "No specific notes recorded."}</div>
                                            </td>
                                        </tr>
                                    `
                                        )
                                        .join("")}
                                </tbody>
                            </table>
                        </div>
                    `;
                    })
                    .join("")}
            </body>
            </html>
        `;

        printWindow.document.write(content);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 400);
    };

    const resolveComparisonEntity = (slotValue: string) => {
        if (!slotValue) return null;
        if (slotValue.startsWith("squad:")) {
            const pid = slotValue.replace("squad:", "");
            const sp = squadPlayers.find((p) => p.id === pid);
            if (!sp) return null;
            return {
                isSquadPlayer: true,
                name: sp.name,
                primaryPosition: sp.primaryPosition,
                secondaryPosition: sp.secondaryPosition || "—",
                age: sp.age || "—",
                preferredFoot: sp.preferredFoot || "Right",
                starRating: null as number | null,
                scoutedRole: "Current Squad Player",
                pipelineStage: "Signed / In Squad",
                clubOrStatus: `${settings.name} (${sp.appearances} Apps, ${sp.goals}G, ${sp.assists}A)`,
                highestLevel: "Current 1st Team",
                previousClubs: "—",
                location: "In Squad",
                commute: "Current Squad",
                connection: "Current Squad Member",
                contact: "—",
                notes: sp.notes || "Active member of the squad.",
            };
        }
        const rec = recruits.find((r) => r.id === slotValue);
        if (!rec) return null;
        return {
            isSquadPlayer: false,
            name: rec.name,
            primaryPosition: rec.primaryPosition,
            secondaryPosition: rec.secondaryPosition || "—",
            age: rec.age || "—",
            preferredFoot: rec.preferredFoot || "Right",
            starRating: rec.starRating || 3,
            scoutedRole: rec.scoutedRole,
            pipelineStage: rec.pipelineStage || (rec.onTrial ? "On Trial" : "Scouted"),
            clubOrStatus: rec.status === "Unattached" ? "Free Agent (Unattached)" : rec.currentClub || "Attached",
            highestLevel: rec.highestLevel || "—",
            previousClubs: rec.previousClubs || "—",
            location: rec.location || "—",
            commute: rec.commutePracticality || "Easy / Local",
            connection: rec.clubConnection || "—",
            contact: [rec.phone, rec.instagram, rec.email].filter(Boolean).join(" • ") || "—",
            notes: rec.notes || "No notes recorded.",
        };
    };

    const entityA = resolveComparisonEntity(compareSlotA);
    const entityB = resolveComparisonEntity(compareSlotB);

    return (
        <div className="space-y-5">
            {/* ================================================================= */}
            {/* HEADER & EXPORT / IMPORT / COMPARE TOOLBAR (#1, #2, #21, #24)     */}
            {/* ================================================================= */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                        Recruitment &amp; Manager&apos;s Black Book
                    </h2>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                        Build your long-term player black book, track recruitment pipeline stages, compare targets &amp; export to Excel
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* #1: Export to Excel (.xls) & CSV */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportRecruitsToExcelXLS(filteredRecruits, settings.name)}
                        className="h-9 text-xs font-bold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                        title="Export filtered Black Book to a styled Microsoft Excel (.xls) spreadsheet"
                    >
                        <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
                        Export Excel (.xls)
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => exportRecruitsToCSV(filteredRecruits, settings.name)}
                        className="h-9 text-xs font-bold border-border bg-surface-1 hover:bg-surface-2"
                        title="Export filtered Black Book to CSV"
                    >
                        <Download className="h-3.5 w-3.5 mr-1.5 text-sky-500" />
                        CSV
                    </Button>

                    {/* #2: Bulk Import from Excel / CSV */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsImportModalOpen(true)}
                        className="h-9 text-xs font-bold border-border bg-surface-1 hover:bg-surface-2"
                    >
                        <Upload className="h-3.5 w-3.5 mr-1.5 text-indigo-500" />
                        Import Excel/CSV
                    </Button>

                    {/* #24: Side-by-Side Comparison Trigger */}
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openComparisonModal()}
                        className="h-9 text-xs font-bold border-border bg-surface-1 hover:bg-surface-2"
                    >
                        <GitCompare className="h-3.5 w-3.5 mr-1.5 text-amber-500" />
                        Compare {compareIds.length > 0 ? `(${compareIds.length})` : "Targets"}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExportPDF}
                        className="h-9 text-xs font-bold border-border bg-surface-1 hover:bg-surface-2"
                    >
                        <FileDown className="h-3.5 w-3.5 mr-1.5 text-rose-500" />
                        PDF Report
                    </Button>

                    <Button
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        className="h-9 text-xs font-extrabold bg-red-600 hover:bg-red-700 text-white"
                    >
                        <Plus className="h-4 w-4 mr-1.5" />
                        Add Target
                    </Button>
                </div>
            </div>

            {/* ================================================================= */}
            {/* #11: INTERACTIVE PIPELINE FUNNEL STRIP                            */}
            {/* ================================================================= */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                <button
                    type="button"
                    onClick={() => setStageFilter("ALL")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                        stageFilter === "ALL"
                            ? "bg-red-600 text-white border-red-500 shadow-sm"
                            : "bg-surface-1 border-border hover:border-red-500/40"
                    }`}
                >
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">Total Book</div>
                    <div className="text-lg font-black mt-0.5">{recruits.length}</div>
                </button>
                {PIPELINE_STAGES.map((stage) => {
                    const isSelected = stageFilter === stage;
                    return (
                        <button
                            key={stage}
                            type="button"
                            onClick={() => setStageFilter(isSelected ? "ALL" : stage)}
                            className={`p-2.5 rounded-xl border text-left transition-all ${
                                isSelected
                                    ? "bg-red-600 text-white border-red-500 shadow-sm"
                                    : "bg-surface-1 border-border hover:border-red-500/40"
                            }`}
                        >
                            <div className="text-[10px] font-bold uppercase tracking-wider truncate opacity-80">
                                {stage}
                            </div>
                            <div className="text-lg font-black mt-0.5">{stageCounts[stage] || 0}</div>
                        </button>
                    );
                })}
            </div>

            {/* ================================================================= */}
            {/* #23 & #21: MULTI-FILTER BAR + VIEW SWITCHER (CARDS VS TABLE)      */}
            {/* ================================================================= */}
            <Card className="bg-surface-1 border-border">
                <CardContent className="p-3.5 sm:p-4 space-y-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
                        {/* Search Input */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by name, club, step/level, previous clubs, location, connection, phone or notes..."
                                className="pl-9 h-9 text-xs sm:text-sm bg-surface-2 border-border"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>

                        {/* Sort + View Mode Toggle (#21) */}
                        <div className="flex items-center gap-2 shrink-0">
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-bold text-foreground"
                                title="Sort targets by"
                            >
                                <option value="rating">Sort: Highest ★ Rating</option>
                                <option value="recent">Sort: Recently Updated</option>
                                <option value="name">Sort: Name (A–Z)</option>
                                <option value="age">Sort: Youngest First</option>
                            </select>

                            <div className="inline-flex rounded-lg border border-border bg-surface-2 p-0.5">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("cards")}
                                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                        viewMode === "cards"
                                            ? "bg-red-600 text-white shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Cards</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("table")}
                                    className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5 transition-colors ${
                                        viewMode === "table"
                                            ? "bg-red-600 text-white shadow-xs"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <TableIcon className="h-3.5 w-3.5" />
                                    <span className="hidden sm:inline">Spreadsheet</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Multi-Filter Selects Row */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                        <select
                            value={positionFilter}
                            onChange={(e) => setPositionFilter(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value="ALL">All Positions</option>
                            <option value="GK">Goalkeepers (GK)</option>
                            <option value="DEF">Defenders (DEF)</option>
                            <option value="MID">Midfielders (MID)</option>
                            <option value="FWD">Forwards (FWD)</option>
                            {ALL_RECRUIT_POSITIONS.map((pos) => (
                                <option key={pos} value={pos}>
                                    Exact: {pos}
                                </option>
                            ))}
                        </select>

                        <select
                            value={stageFilter}
                            onChange={(e) => setStageFilter(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value="ALL">All Pipeline Stages</option>
                            {PIPELINE_STAGES.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>

                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value="ALL">Free Agent &amp; Attached</option>
                            <option value="Unattached">Free Agents Only</option>
                            <option value="Attached">Attached Only</option>
                        </select>

                        <select
                            value={footFilter}
                            onChange={(e) => setFootFilter(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value="ALL">Any Preferred Foot</option>
                            <option value="Left">Left Footed</option>
                            <option value="Right">Right Footed</option>
                            <option value="Both">Both Feet</option>
                        </select>

                        <select
                            value={minRatingFilter}
                            onChange={(e) => setMinRatingFilter(Number(e.target.value))}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value={0}>Any ★ Rating</option>
                            <option value={5}>★★★★★ (5★ Only)</option>
                            <option value={4}>★★★★☆ (4★ &amp; Up)</option>
                            <option value={3}>★★★☆☆ (3★ &amp; Up)</option>
                        </select>

                        <select
                            value={commuteFilter}
                            onChange={(e) => setCommuteFilter(e.target.value)}
                            className="h-8 rounded-lg border border-border bg-surface-2 px-2 text-xs font-semibold text-foreground"
                        >
                            <option value="ALL">Any Commute</option>
                            {COMMUTE_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setOnlyTrialists((v) => !v)}
                                className={`flex-1 h-8 px-2 rounded-lg border text-xs font-bold transition-colors truncate ${
                                    onlyTrialists
                                        ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                        : "bg-surface-2 text-muted-foreground border-border hover:text-foreground"
                                }`}
                            >
                                {onlyTrialists ? "✓ On Trial" : "Trialists"}
                            </button>
                            {activeFilterCount > 0 && (
                                <button
                                    type="button"
                                    onClick={resetAllFilters}
                                    className="h-8 px-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20"
                                    title="Clear all active filters"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                        <span>
                            Showing <strong className="text-foreground">{filteredRecruits.length}</strong> of{" "}
                            <strong className="text-foreground">{recruits.length}</strong> Black Book targets
                        </span>
                        {compareIds.length > 0 && (
                            <div className="flex items-center gap-2">
                                <span className="text-amber-400 font-bold">
                                    {compareIds.length} selected for comparison
                                </span>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => openComparisonModal()}
                                    className="h-6 px-2 text-[10px] font-bold"
                                >
                                    Open Comparison
                                </Button>
                                <button
                                    type="button"
                                    onClick={() => setCompareIds([])}
                                    className="text-[10px] text-muted-foreground hover:text-foreground underline"
                                >
                                    Clear
                                </button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* ================================================================= */}
            {/* #21 VIEW MODE A: COMPACT SPREADSHEET TABLE VIEW                   */}
            {/* ================================================================= */}
            {viewMode === "table" ? (
                <Card className="bg-surface-1 border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr className="border-b border-border bg-surface-2/80 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
                                    <th className="p-3 w-8 text-center">Cmp</th>
                                    <th className="p-3">Player</th>
                                    <th className="p-3">Pos &amp; Foot</th>
                                    <th className="p-3">Scout Rating</th>
                                    <th className="p-3">Pipeline Stage</th>
                                    <th className="p-3">Club &amp; Pedigree</th>
                                    <th className="p-3">Location / Commute</th>
                                    <th className="p-3">Direct Contact</th>
                                    <th className="p-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredRecruits.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                                            No recruitment targets match your current filters.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRecruits.map((recruit) => {
                                        const waUrl = formatWhatsAppUrl(recruit.phone || "", recruit.name, settings.name);
                                        const isCompared = compareIds.includes(recruit.id);
                                        return (
                                            <tr
                                                key={recruit.id}
                                                className="hover:bg-surface-2/40 transition-colors"
                                            >
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isCompared}
                                                        onChange={() => toggleCompareRecruit(recruit.id)}
                                                        title="Select for side-by-side comparison"
                                                        className="h-3.5 w-3.5 rounded border-border accent-red-600 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="p-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => setEnlargedRecruit(recruit)}
                                                        className="font-bold text-foreground hover:text-red-400 text-left block"
                                                    >
                                                        {recruit.name}
                                                    </button>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {recruit.age ? `${recruit.age} yo` : "Age —"} • {recruit.scoutedRole}
                                                    </div>
                                                    {recruit.clubConnection && (
                                                        <div className="text-[10px] text-red-400 italic truncate max-w-[190px]">
                                                            🔗 {recruit.clubConnection}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1 flex-wrap">
                                                        <Badge variant="outline" className="font-bold text-[10px] px-1.5 py-0">
                                                            {recruit.primaryPosition}
                                                        </Badge>
                                                        {recruit.secondaryPosition && (
                                                            <span className="text-[10px] text-muted-foreground">
                                                                ({recruit.secondaryPosition})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                                        🦶 {recruit.preferredFoot || "Right"}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-0.5">
                                                        {[1, 2, 3, 4, 5].map((star) => (
                                                            <button
                                                                key={star}
                                                                type="button"
                                                                onClick={() =>
                                                                    handleQuickUpdateRecruit(recruit, { starRating: star })
                                                                }
                                                                className="focus:outline-none"
                                                                title={`Set rating to ${star} stars`}
                                                            >
                                                                <Star
                                                                    className={`h-3.5 w-3.5 ${
                                                                        star <= (recruit.starRating || 3)
                                                                            ? "fill-amber-400 text-amber-400"
                                                                            : "text-slate-600"
                                                                    }`}
                                                                />
                                                            </button>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <select
                                                        value={
                                                            recruit.pipelineStage ||
                                                            (recruit.onTrial ? "On Trial" : "Scouted")
                                                        }
                                                        onChange={(e) =>
                                                            handleQuickUpdateRecruit(recruit, {
                                                                pipelineStage: e.target.value as RecruitPipelineStage,
                                                            })
                                                        }
                                                        className={`rounded-md border px-2 py-1 text-[10px] font-bold bg-slate-900 ${getPipelineBadgeStyle(
                                                            recruit.pipelineStage
                                                        )}`}
                                                    >
                                                        {PIPELINE_STAGES.map((st) => (
                                                            <option key={st} value={st} className="bg-slate-900 text-white">
                                                                {st}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="p-3">
                                                    <div className="font-semibold text-foreground">
                                                        {recruit.status === "Unattached" ? (
                                                            <span className="text-emerald-400">Free Agent</span>
                                                        ) : (
                                                            recruit.currentClub || "Attached"
                                                        )}
                                                    </div>
                                                    {recruit.highestLevel && (
                                                        <div className="text-[10px] text-amber-400 font-semibold">
                                                            🏆 {recruit.highestLevel}
                                                        </div>
                                                    )}
                                                    {recruit.previousClubs && (
                                                        <div className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                                            Prev: {recruit.previousClubs}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3">
                                                    <div className="text-foreground">{recruit.location || "—"}</div>
                                                    <span
                                                        className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded border ${getCommuteBadgeStyle(
                                                            recruit.commutePracticality
                                                        )}`}
                                                    >
                                                        {recruit.commutePracticality || "Easy / Local"}
                                                    </span>
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-1.5">
                                                        {waUrl && (
                                                            <a
                                                                href={waUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30"
                                                                title={`WhatsApp ${recruit.name} (${recruit.phone})`}
                                                            >
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                        {recruit.phone && (
                                                            <a
                                                                href={`tel:${recruit.phone}`}
                                                                className="p-1.5 rounded-lg bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/30"
                                                                title={`Call ${recruit.phone}`}
                                                            >
                                                                <Phone className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                        {recruit.instagram && (
                                                            <a
                                                                href={`https://instagram.com/${recruit.instagram.replace(/^@/, "")}`}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="p-1.5 rounded-lg bg-pink-500/15 text-pink-400 hover:bg-pink-500/25 border border-pink-500/30"
                                                                title={`Instagram: ${recruit.instagram}`}
                                                            >
                                                                <Instagram className="h-3.5 w-3.5" />
                                                            </a>
                                                        )}
                                                        {!recruit.phone && !recruit.instagram && !recruit.email && (
                                                            <span className="text-[10px] text-muted-foreground">—</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleEdit(recruit)}
                                                            className="h-7 w-7 p-0"
                                                            title="Edit Recruit"
                                                        >
                                                            <Edit2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleSignPlayer(recruit)}
                                                            className="h-7 px-2 text-[10px] font-bold bg-red-600 hover:bg-red-700 text-white"
                                                        >
                                                            Sign
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => handleDelete(recruit.id)}
                                                            className="h-7 w-7 p-0 text-rose-500 hover:text-rose-400"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </Card>
            ) : (
                /* ================================================================= */
                /* #21 VIEW MODE B: POSITION GROUP CARDS VIEW                        */
                /* ================================================================= */
                <Card className="bg-surface-1 border-border">
                    <CardContent className="p-0">
                        <div className="divide-y divide-border">
                            {sections.map((section) => {
                                const sectionRecruits = getRecruitsForSection(section.positions);
                                const isExpanded = expandedPositions.includes(section.id);

                                return (
                                    <div key={section.id} className="w-full">
                                        <button
                                            type="button"
                                            onClick={() => togglePosition(section.id)}
                                            className="w-full flex items-center justify-between p-4 hover:bg-surface-2/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                {isExpanded ? (
                                                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                                ) : (
                                                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                                )}
                                                <h3 className="font-bold text-foreground">{section.title}</h3>
                                                <Badge variant="outline" className="ml-1">
                                                    {sectionRecruits.length}
                                                </Badge>
                                            </div>
                                        </button>

                                        {isExpanded && (
                                            <div className="p-4 bg-surface-2/20">
                                                {sectionRecruits.length === 0 ? (
                                                    <div className="py-6 text-center text-muted-foreground text-xs">
                                                        No {section.title.toLowerCase()} matching current filters.
                                                    </div>
                                                ) : (
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                                                        {sectionRecruits.map((recruit) => {
                                                            const waUrl = formatWhatsAppUrl(
                                                                recruit.phone || "",
                                                                recruit.name,
                                                                settings.name
                                                            );
                                                            const isCompared = compareIds.includes(recruit.id);

                                                            return (
                                                                <Card
                                                                    key={recruit.id}
                                                                    className={`overflow-hidden hover:shadow-lg transition-all duration-200 group relative border-2 bg-slate-950 ${getPositionBorder(
                                                                        recruit.primaryPosition
                                                                    )} flex flex-col h-full`}
                                                                >
                                                                    <CardHeader className="p-0 flex-1 flex flex-col">
                                                                        <div className="bg-slate-900 p-3.5 flex flex-col items-center justify-center flex-1 relative border-b border-slate-800">
                                                                            {/* Top-left Quick Actions + Compare */}
                                                                            <div className="absolute top-2.5 left-2.5 flex items-center gap-1 z-20">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        toggleCompareRecruit(recruit.id);
                                                                                    }}
                                                                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold border transition-colors flex items-center gap-1 ${
                                                                                        isCompared
                                                                                            ? "bg-amber-500 text-slate-950 border-amber-400"
                                                                                            : "bg-slate-800/90 text-slate-300 border-slate-700 hover:border-amber-500/50"
                                                                                    }`}
                                                                                    title="Compare player side-by-side"
                                                                                >
                                                                                    <GitCompare className="h-2.5 w-2.5" />
                                                                                    {isCompared ? "Comparing" : "Compare"}
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleEdit(recruit);
                                                                                    }}
                                                                                    className="p-1.5 bg-slate-800 hover:bg-blue-900/50 rounded-full text-slate-400 hover:text-blue-400"
                                                                                    title="Edit Recruit"
                                                                                >
                                                                                    <Edit2 className="h-3 w-3" />
                                                                                </button>
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleDelete(recruit.id);
                                                                                    }}
                                                                                    className="p-1.5 bg-slate-800 hover:bg-red-900/50 rounded-full text-slate-400 hover:text-red-400"
                                                                                    title="Delete Recruit"
                                                                                >
                                                                                    <Trash2 className="h-3 w-3" />
                                                                                </button>
                                                                            </div>

                                                                            {/* Top-right Badges (#11 Pipeline Stage & Status) */}
                                                                            <div className="absolute top-2.5 right-2.5 flex flex-col items-end gap-1 z-20">
                                                                                <Badge
                                                                                    className={`text-[9px] px-1.5 py-0.5 border ${
                                                                                        recruit.status === "Unattached"
                                                                                            ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                                                                            : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                                                                                    }`}
                                                                                >
                                                                                    {recruit.status === "Unattached"
                                                                                        ? "Free Agent"
                                                                                        : "Attached"}
                                                                                </Badge>
                                                                                <span
                                                                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${getCommuteBadgeStyle(
                                                                                        recruit.commutePracticality
                                                                                    )}`}
                                                                                >
                                                                                    {recruit.commutePracticality || "Easy / Local"}
                                                                                </span>
                                                                            </div>

                                                                            {/* Avatar Circle */}
                                                                            <div
                                                                                onClick={() => setEnlargedRecruit(recruit)}
                                                                                className="cursor-pointer h-16 w-16 rounded-full bg-slate-800 flex items-center justify-center border-2 border-slate-700 shadow-xl mt-6 hover:border-red-500 transition-colors"
                                                                            >
                                                                                <span className="text-xl font-bold bg-gradient-to-br from-red-400 to-red-600 bg-clip-text text-transparent">
                                                                                    {recruit.name
                                                                                        .split(/\s+/)
                                                                                        .map((n) => n[0])
                                                                                        .join("")
                                                                                        .toUpperCase()
                                                                                        .slice(0, 2)}
                                                                                </span>
                                                                            </div>

                                                                            {/* Interactive 5-Star Rating (#10) */}
                                                                            <div className="flex items-center gap-0.5 mt-2">
                                                                                {[1, 2, 3, 4, 5].map((star) => (
                                                                                    <button
                                                                                        key={star}
                                                                                        type="button"
                                                                                        onClick={() =>
                                                                                            handleQuickUpdateRecruit(recruit, {
                                                                                                starRating: star,
                                                                                            })
                                                                                        }
                                                                                        title={`Rate ${star} stars`}
                                                                                    >
                                                                                        <Star
                                                                                            className={`h-3.5 w-3.5 ${
                                                                                                star <= (recruit.starRating || 3)
                                                                                                    ? "fill-amber-400 text-amber-400"
                                                                                                    : "text-slate-700"
                                                                                            }`}
                                                                                        />
                                                                                    </button>
                                                                                ))}
                                                                            </div>

                                                                            {/* Name, Position, Foot & Age */}
                                                                            <div className="mt-1.5 text-center w-full px-1">
                                                                                <CardTitle
                                                                                    onClick={() => setEnlargedRecruit(recruit)}
                                                                                    className="text-white text-sm sm:text-base font-bold truncate hover:text-red-400 cursor-pointer transition-colors"
                                                                                >
                                                                                    {recruit.name}
                                                                                </CardTitle>
                                                                                <p className="text-slate-400 text-[11px] font-medium mt-0.5">
                                                                                    <span className="text-red-400 font-bold">
                                                                                        {recruit.primaryPosition}
                                                                                    </span>
                                                                                    {recruit.secondaryPosition
                                                                                        ? ` (${recruit.secondaryPosition})`
                                                                                        : ""}{" "}
                                                                                    • {recruit.preferredFoot || "Right"} Foot •{" "}
                                                                                    {recruit.age || "?"} yo
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </CardHeader>

                                                                    <CardContent className="p-3 space-y-2 text-xs flex-none">
                                                                        {/* Inline Pipeline Stage Selector (#11) */}
                                                                        <div className="flex items-center justify-between gap-2 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
                                                                            <span className="text-[9px] uppercase font-bold text-slate-400">
                                                                                Stage
                                                                            </span>
                                                                            <select
                                                                                value={
                                                                                    recruit.pipelineStage ||
                                                                                    (recruit.onTrial ? "On Trial" : "Scouted")
                                                                                }
                                                                                onChange={(e) =>
                                                                                    handleQuickUpdateRecruit(recruit, {
                                                                                        pipelineStage: e.target
                                                                                            .value as RecruitPipelineStage,
                                                                                    })
                                                                                }
                                                                                className={`rounded px-2 py-0.5 text-[10px] font-bold border bg-slate-950 ${getPipelineBadgeStyle(
                                                                                    recruit.pipelineStage
                                                                                )}`}
                                                                            >
                                                                                {PIPELINE_STAGES.map((st) => (
                                                                                    <option
                                                                                        key={st}
                                                                                        value={st}
                                                                                        className="bg-slate-900 text-white"
                                                                                    >
                                                                                        {st}
                                                                                    </option>
                                                                                ))}
                                                                            </select>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                                                                            <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                                                                                <div className="text-slate-500 text-[9px] uppercase">
                                                                                    Current Club
                                                                                </div>
                                                                                <div className="font-bold text-white truncate">
                                                                                    {recruit.status === "Unattached"
                                                                                        ? "Free Agent"
                                                                                        : recruit.currentClub || "Unknown"}
                                                                                </div>
                                                                            </div>
                                                                            <div className="bg-slate-900/60 p-1.5 rounded border border-slate-800/60">
                                                                                <div className="text-slate-500 text-[9px] uppercase">
                                                                                    Highest Level
                                                                                </div>
                                                                                <div className="font-bold text-amber-400 truncate">
                                                                                    {recruit.highestLevel || recruit.scoutedRole}
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        {recruit.previousClubs && (
                                                                            <div className="text-[10px] text-slate-400 bg-slate-900/40 px-2 py-1 rounded border border-slate-800/50 truncate">
                                                                                <span className="text-slate-500 font-semibold">
                                                                                    Prev:{" "}
                                                                                </span>
                                                                                {recruit.previousClubs}
                                                                            </div>
                                                                        )}

                                                                        {recruit.clubConnection && (
                                                                            <div className="text-[10px] text-red-400 bg-red-950/20 border border-red-900/30 px-2 py-1 rounded truncate italic">
                                                                                🔗 {recruit.clubConnection}
                                                                            </div>
                                                                        )}

                                                                        {/* Direct Contact Bar (#6) */}
                                                                        {(recruit.phone || recruit.instagram || recruit.email) && (
                                                                            <div className="flex items-center justify-center gap-2 pt-0.5">
                                                                                {waUrl && (
                                                                                    <a
                                                                                        href={waUrl}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="flex-1 py-1 px-2 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold flex items-center justify-center gap-1"
                                                                                    >
                                                                                        <MessageCircle className="h-3 w-3" />
                                                                                        WhatsApp
                                                                                    </a>
                                                                                )}
                                                                                {recruit.phone && (
                                                                                    <a
                                                                                        href={`tel:${recruit.phone}`}
                                                                                        className="py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-bold flex items-center gap-1"
                                                                                        title={recruit.phone}
                                                                                    >
                                                                                        <Phone className="h-3 w-3" />
                                                                                    </a>
                                                                                )}
                                                                                {recruit.instagram && (
                                                                                    <a
                                                                                        href={`https://instagram.com/${recruit.instagram.replace(
                                                                                            /^@/,
                                                                                            ""
                                                                                        )}`}
                                                                                        target="_blank"
                                                                                        rel="noreferrer"
                                                                                        className="py-1 px-2 rounded bg-pink-500/15 hover:bg-pink-500/25 text-pink-400 border border-pink-500/30 text-[10px] font-bold flex items-center gap-1"
                                                                                        title={recruit.instagram}
                                                                                    >
                                                                                        <Instagram className="h-3 w-3" />
                                                                                    </a>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </CardContent>

                                                                    <CardFooter className="p-3 pt-0 mt-auto grid grid-cols-2 gap-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            onClick={() => setEnlargedRecruit(recruit)}
                                                                            className="w-full h-8 text-xs bg-slate-900 hover:bg-slate-800 text-white border-slate-800"
                                                                        >
                                                                            Full Dossier
                                                                        </Button>
                                                                        <Button
                                                                            onClick={() => handleSignPlayer(recruit)}
                                                                            className="w-full bg-red-600 hover:bg-red-700 text-white text-xs h-8 font-bold"
                                                                        >
                                                                            Sign Player
                                                                        </Button>
                                                                    </CardFooter>
                                                                </Card>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ================================================================= */}
            {/* ADD / EDIT RECRUITMENT TARGET DIALOG (#5, #6, #7, #10, #11, #15)  */}
            {/* ================================================================= */}
            <Dialog open={isDialogOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
                <DialogContent className="sm:max-w-[580px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-surface-1 border-border text-foreground">
                    <DialogHeader className="p-5 pb-3 border-b border-border">
                        <DialogTitle className="text-lg font-black">
                            {editingRecruit ? `Edit Black Book Target: ${editingRecruit.name}` : "Add Player to Recruitment Black Book"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                        {/* Row 1: Name & Age */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="sm:col-span-2 space-y-1">
                                <Label className="text-xs font-bold">Player Full Name *</Label>
                                <Input
                                    placeholder="e.g. Marcus Sterling"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Age</Label>
                                <Input
                                    type="number"
                                    placeholder="22"
                                    value={formData.age}
                                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                        </div>

                        {/* Row 2: Primary Pos, Secondary Pos, Preferred Foot (#5) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Primary Position</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.primaryPosition}
                                    onChange={(e) => setFormData({ ...formData, primaryPosition: e.target.value })}
                                >
                                    {ALL_RECRUIT_POSITIONS.map((pos) => (
                                        <option key={pos} value={pos}>
                                            {pos}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Secondary Position(s)</Label>
                                <Input
                                    placeholder="e.g. LW, CAM"
                                    value={formData.secondaryPosition}
                                    onChange={(e) => setFormData({ ...formData, secondaryPosition: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Preferred Foot</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.preferredFoot}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            preferredFoot: e.target.value as "Right" | "Left" | "Both",
                                        })
                                    }
                                >
                                    <option value="Right">Right Foot</option>
                                    <option value="Left">Left Foot</option>
                                    <option value="Both">Both Feet</option>
                                </select>
                            </div>
                        </div>

                        {/* Row 3: 5-Star Scout Rating (#10), Role, Pipeline Stage (#11) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Scout Star Rating (1–5)</Label>
                                <div className="h-9 px-2.5 rounded-md border border-border bg-surface-2 flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, starRating: star })}
                                            className="p-0.5"
                                        >
                                            <Star
                                                className={`h-4 w-4 ${
                                                    star <= formData.starRating
                                                        ? "fill-amber-400 text-amber-400"
                                                        : "text-muted-foreground"
                                                }`}
                                            />
                                        </button>
                                    ))}
                                    <span className="ml-auto text-[11px] font-bold text-amber-400">
                                        {formData.starRating}/5
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Projected Squad Role</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.scoutedRole}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            scoutedRole: e.target.value as Recruit["scoutedRole"],
                                        })
                                    }
                                >
                                    {RECRUIT_ROLES.map((role) => (
                                        <option key={role} value={role}>
                                            {role === "Star Player" ? "⭐ " : ""}
                                            {role}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Pipeline Stage</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.pipelineStage}
                                    onChange={(e) => {
                                        const nextStage = e.target.value as RecruitPipelineStage;
                                        setFormData({
                                            ...formData,
                                            pipelineStage: nextStage,
                                            onTrial: nextStage === "On Trial" ? true : formData.onTrial,
                                        });
                                    }}
                                >
                                    {PIPELINE_STAGES.map((st) => (
                                        <option key={st} value={st}>
                                            {st}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 4: Status, Current Club, Highest Level / Step (#7) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Contract Status</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.status}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            status: e.target.value as "Attached" | "Unattached",
                                        })
                                    }
                                >
                                    <option value="Attached">Attached to Club</option>
                                    <option value="Unattached">Unattached (Free Agent)</option>
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Current Club</Label>
                                <Input
                                    placeholder={formData.status === "Unattached" ? "Free Agent" : "e.g. Stonewall FC"}
                                    disabled={formData.status === "Unattached"}
                                    value={formData.currentClub}
                                    onChange={(e) => setFormData({ ...formData, currentClub: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>

                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Highest Level / Step</Label>
                                <Input
                                    list="step-level-options"
                                    placeholder="e.g. Step 5 / County Prem"
                                    value={formData.highestLevel}
                                    onChange={(e) => setFormData({ ...formData, highestLevel: e.target.value })}
                                    className="h-9 text-xs"
                                />
                                <datalist id="step-level-options">
                                    {STEP_LEVEL_OPTIONS.map((lvl) => (
                                        <option key={lvl} value={lvl} />
                                    ))}
                                </datalist>
                            </div>
                        </div>

                        {/* Row 5: Previous Clubs History (#7) */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Previous Clubs History</Label>
                            <Input
                                placeholder="e.g. Hendon U23, Wingate & Finchley, Edgware Town"
                                value={formData.previousClubs}
                                onChange={(e) => setFormData({ ...formData, previousClubs: e.target.value })}
                                className="h-9 text-xs"
                            />
                        </div>

                        {/* Row 6: Location & Commute Practicality (#15) */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Location / Area</Label>
                                <Input
                                    placeholder="e.g. Camden, NW London"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    className="h-9 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold">Travel / Commute Practicality</Label>
                                <select
                                    className="w-full h-9 rounded-md border border-border bg-surface-2 px-2.5 text-xs font-semibold"
                                    value={formData.commutePracticality}
                                    onChange={(e) =>
                                        setFormData({
                                            ...formData,
                                            commutePracticality: e.target.value as CommutePracticality,
                                        })
                                    }
                                >
                                    {COMMUTE_OPTIONS.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Row 7: Direct Contact Details & Socials (#6) */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-surface-2/60 border border-border">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold flex items-center gap-1">
                                    <Phone className="h-3 w-3 text-emerald-500" /> Phone / WhatsApp
                                </Label>
                                <Input
                                    placeholder="07700 900123"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold flex items-center gap-1">
                                    <Instagram className="h-3 w-3 text-pink-500" /> Instagram
                                </Label>
                                <Input
                                    placeholder="@playerhandle"
                                    value={formData.instagram}
                                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold flex items-center gap-1">
                                    <Mail className="h-3 w-3 text-sky-500" /> Email
                                </Label>
                                <Input
                                    placeholder="player@email.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="h-8 text-xs"
                                />
                            </div>
                        </div>

                        {/* Row 8: Connection & Notes */}
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Connection to Club / Referral</Label>
                            <Input
                                placeholder="e.g. Friend of Kieran Ali, scouted vs Stonewall, former academy teammate..."
                                value={formData.clubConnection}
                                onChange={(e) => setFormData({ ...formData, clubConnection: e.target.value })}
                                className="h-9 text-xs"
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs font-bold">Scouting Report &amp; Manager Notes</Label>
                            <Textarea
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="h-24 text-xs"
                                placeholder="Strengths, weaknesses, character, wage/expenses expectations, availability..."
                            />
                        </div>
                    </div>

                    <DialogFooter className="p-4 border-t border-border bg-surface-2/40 flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleCloseDialog}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            onClick={handleAddOrEdit}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold"
                        >
                            {editingRecruit ? "Save Changes" : "Save to Black Book"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ================================================================= */}
            {/* #2: BULK EXCEL / CSV IMPORT MODAL                                 */}
            {/* ================================================================= */}
            <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
                <DialogContent className="sm:max-w-[650px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-surface-1 border-border text-foreground">
                    <DialogHeader className="p-5 pb-3 border-b border-border">
                        <DialogTitle className="text-lg font-black flex items-center gap-2">
                            <Upload className="h-5 w-5 text-indigo-500" />
                            Bulk Import Players from Excel / CSV
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-surface-2 border border-border">
                            <div>
                                <div className="font-bold text-foreground">
                                    Upload a `.csv` file or paste directly from Excel
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                    Supports columns: Name, Primary Position, Secondary Position, Age, Preferred Foot, Star Rating, Pipeline Stage, Status, Current Club, Highest Level, Previous Clubs, Location, Commute, Phone, Instagram, Connection, Notes
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={downloadBlankRecruitTemplateCSV}
                                    className="h-8 text-xs font-bold"
                                >
                                    <Download className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                                    Template CSV
                                </Button>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.tsv,.txt"
                                    className="hidden"
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="h-8 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                                >
                                    Choose CSV File
                                </Button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold">
                                Or Paste CSV / Excel Rows (including header row):
                            </Label>
                            <Textarea
                                value={importRawText}
                                onChange={(e) => setImportRawText(e.target.value)}
                                placeholder={`Name,Primary Position,Age,Preferred Foot,Star Rating,Current Club,Highest Level,Phone,Scouting Notes\nMarcus Sterling,ST,23,Right,5,Hendon Reserves,Step 5,07700900123,Rapid in behind`}
                                className="h-32 font-mono text-[11px]"
                            />
                        </div>

                        {previewImportedRecruits.length > 0 && (
                            <div className="space-y-2">
                                <div className="font-bold text-emerald-500">
                                    ✓ Ready to import {previewImportedRecruits.length} players:
                                </div>
                                <div className="max-h-48 overflow-y-auto border border-border rounded-lg">
                                    <table className="w-full text-left text-[11px]">
                                        <thead className="bg-surface-2 border-b border-border">
                                            <tr>
                                                <th className="p-2">Name</th>
                                                <th className="p-2">Pos</th>
                                                <th className="p-2">Foot</th>
                                                <th className="p-2">Rating</th>
                                                <th className="p-2">Stage</th>
                                                <th className="p-2">Club / Level</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {previewImportedRecruits.map((p, idx) => (
                                                <tr key={idx}>
                                                    <td className="p-2 font-bold">{p.name}</td>
                                                    <td className="p-2">
                                                        {p.primaryPosition}
                                                        {p.secondaryPosition ? ` (${p.secondaryPosition})` : ""}
                                                    </td>
                                                    <td className="p-2">{p.preferredFoot}</td>
                                                    <td className="p-2 text-amber-400">{"★".repeat(p.starRating || 3)}</td>
                                                    <td className="p-2">{p.pipelineStage}</td>
                                                    <td className="p-2">
                                                        {p.currentClub || "Free Agent"}
                                                        {p.highestLevel ? ` • ${p.highestLevel}` : ""}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-border bg-surface-2/40 flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsImportModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            disabled={previewImportedRecruits.length === 0 || isImporting}
                            onClick={handleConfirmBulkImport}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                        >
                            {isImporting
                                ? "Importing..."
                                : `Import ${previewImportedRecruits.length} Players to Black Book`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ================================================================= */}
            {/* #24: SIDE-BY-SIDE TARGET COMPARISON MODAL                         */}
            {/* ================================================================= */}
            <Dialog open={isCompareModalOpen} onOpenChange={setIsCompareModalOpen}>
                <DialogContent className="sm:max-w-[740px] max-h-[90vh] flex flex-col p-0 overflow-hidden bg-surface-1 border-border text-foreground">
                    <DialogHeader className="p-5 pb-3 border-b border-border">
                        <DialogTitle className="text-lg font-black flex items-center gap-2">
                            <GitCompare className="h-5 w-5 text-amber-500" />
                            Side-by-Side Recruitment Comparison
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
                        {/* Player Selectors */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                                    Target A (Recruitment Black Book)
                                </Label>
                                <select
                                    value={compareSlotA}
                                    onChange={(e) => setCompareSlotA(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-bold"
                                >
                                    <option value="">Select Target A...</option>
                                    {recruits.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            🎯 {r.name} ({r.primaryPosition} • {r.starRating || 3}★)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-1">
                                <Label className="text-[11px] font-bold uppercase text-muted-foreground">
                                    Target B (Black Book or Current Squad Player)
                                </Label>
                                <select
                                    value={compareSlotB}
                                    onChange={(e) => setCompareSlotB(e.target.value)}
                                    className="w-full h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-xs font-bold"
                                >
                                    <option value="">Select Target B or Squad Player...</option>
                                    <optgroup label="Recruitment Black Book">
                                        {recruits.map((r) => (
                                            <option key={r.id} value={r.id}>
                                                🎯 {r.name} ({r.primaryPosition} • {r.starRating || 3}★)
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="Current First Team Squad">
                                        {squadPlayers.map((sp) => (
                                            <option key={`squad:${sp.id}`} value={`squad:${sp.id}`}>
                                                🛡️ {sp.name} ({sp.primaryPosition} • In Squad)
                                            </option>
                                        ))}
                                    </optgroup>
                                </select>
                            </div>
                        </div>

                        {entityA && entityB ? (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <table className="w-full text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-surface-2 border-b border-border">
                                            <th className="p-3 w-[24%] text-muted-foreground uppercase text-[10px]">
                                                Attribute
                                            </th>
                                            <th className="p-3 w-[38%] font-black text-sm text-red-400 border-l border-border">
                                                {entityA.name}
                                            </th>
                                            <th className="p-3 w-[38%] font-black text-sm text-sky-400 border-l border-border">
                                                {entityB.name}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Primary / Sec Pos</td>
                                            <td className="p-2.5 font-bold border-l border-border">
                                                {entityA.primaryPosition} ({entityA.secondaryPosition})
                                            </td>
                                            <td className="p-2.5 font-bold border-l border-border">
                                                {entityB.primaryPosition} ({entityB.secondaryPosition})
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Age &amp; Foot</td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityA.age} yo • <strong>{entityA.preferredFoot} Foot</strong>
                                            </td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityB.age} yo • <strong>{entityB.preferredFoot} Foot</strong>
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Scout Rating &amp; Role</td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityA.starRating ? (
                                                    <span className="text-amber-400 font-bold">
                                                        {"★".repeat(entityA.starRating)} ({entityA.starRating}/5)
                                                    </span>
                                                ) : (
                                                    "In Squad"
                                                )}{" "}
                                                • {entityA.scoutedRole}
                                            </td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityB.starRating ? (
                                                    <span className="text-amber-400 font-bold">
                                                        {"★".repeat(entityB.starRating)} ({entityB.starRating}/5)
                                                    </span>
                                                ) : (
                                                    "In Squad"
                                                )}{" "}
                                                • {entityB.scoutedRole}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Pipeline Stage</td>
                                            <td className="p-2.5 border-l border-border font-semibold">
                                                {entityA.pipelineStage}
                                            </td>
                                            <td className="p-2.5 border-l border-border font-semibold">
                                                {entityB.pipelineStage}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Current Club / Status</td>
                                            <td className="p-2.5 border-l border-border">{entityA.clubOrStatus}</td>
                                            <td className="p-2.5 border-l border-border">{entityB.clubOrStatus}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Highest Level / Step</td>
                                            <td className="p-2.5 border-l border-border text-amber-400 font-semibold">
                                                {entityA.highestLevel}
                                            </td>
                                            <td className="p-2.5 border-l border-border text-amber-400 font-semibold">
                                                {entityB.highestLevel}
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Previous Clubs</td>
                                            <td className="p-2.5 border-l border-border">{entityA.previousClubs}</td>
                                            <td className="p-2.5 border-l border-border">{entityB.previousClubs}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Location &amp; Commute</td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityA.location} ({entityA.commute})
                                            </td>
                                            <td className="p-2.5 border-l border-border">
                                                {entityB.location} ({entityB.commute})
                                            </td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Club Connection</td>
                                            <td className="p-2.5 border-l border-border italic">{entityA.connection}</td>
                                            <td className="p-2.5 border-l border-border italic">{entityB.connection}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2.5 font-bold text-muted-foreground">Scouting Notes</td>
                                            <td className="p-2.5 border-l border-border whitespace-pre-wrap leading-relaxed">
                                                {entityA.notes}
                                            </td>
                                            <td className="p-2.5 border-l border-border whitespace-pre-wrap leading-relaxed">
                                                {entityB.notes}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-8 text-center text-muted-foreground">
                                Select two players above to compare them side by side.
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-border bg-surface-2/40">
                        <Button variant="outline" size="sm" onClick={() => setIsCompareModalOpen(false)}>
                            Close Comparison
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ================================================================= */}
            {/* ENLARGED PLAYER DOSSIER DIALOG                                    */}
            {/* ================================================================= */}
            <Dialog open={enlargedRecruit !== null} onOpenChange={(open) => !open && setEnlargedRecruit(null)}>
                {enlargedRecruit && (
                    <DialogContent className="sm:max-w-[480px] max-h-[90vh] flex flex-col bg-slate-950 text-white border-2 border-red-600 p-0 overflow-hidden shadow-2xl">
                        <DialogHeader className="p-4 bg-slate-900 border-b border-slate-800 flex flex-row items-center justify-between shrink-0">
                            <DialogTitle className="text-white font-bold flex items-center gap-2 text-base">
                                Black Book Dossier: {enlargedRecruit.name}
                            </DialogTitle>
                        </DialogHeader>

                        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
                            <div
                                className={`relative p-5 rounded-xl bg-slate-900 border-2 ${getPositionBorder(
                                    enlargedRecruit.primaryPosition
                                )} shadow-lg flex flex-col items-center text-center space-y-3`}
                            >
                                <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
                                    <Badge
                                        className={`text-[10px] py-0.5 px-2 border ${getPipelineBadgeStyle(
                                            enlargedRecruit.pipelineStage
                                        )}`}
                                    >
                                        {enlargedRecruit.pipelineStage || "Scouted"}
                                    </Badge>
                                    <Badge
                                        className={`text-[10px] py-0.5 px-2 border ${
                                            enlargedRecruit.status === "Unattached"
                                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                                : "bg-indigo-500/20 text-indigo-400 border-indigo-500/40"
                                        }`}
                                    >
                                        {enlargedRecruit.status === "Unattached" ? "Free Agent" : "Contracted"}
                                    </Badge>
                                </div>

                                <div className="h-20 w-20 rounded-full bg-slate-800 border-4 border-slate-700 shadow-2xl flex items-center justify-center">
                                    <span className="text-2xl font-extrabold bg-gradient-to-br from-red-400 to-red-600 bg-clip-text text-transparent">
                                        {enlargedRecruit.name
                                            .split(/\s+/)
                                            .map((n) => n[0])
                                            .join("")
                                            .toUpperCase()
                                            .slice(0, 2)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-1">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <Star
                                            key={star}
                                            className={`h-4 w-4 ${
                                                star <= (enlargedRecruit.starRating || 3)
                                                    ? "fill-amber-400 text-amber-400"
                                                    : "text-slate-700"
                                            }`}
                                        />
                                    ))}
                                </div>

                                <div>
                                    <h3 className="text-xl font-extrabold tracking-tight text-white">
                                        {enlargedRecruit.name}
                                    </h3>
                                    <p className="text-red-400 font-bold text-sm mt-0.5">
                                        {enlargedRecruit.primaryPosition}{" "}
                                        {enlargedRecruit.secondaryPosition
                                            ? `(Secondary: ${enlargedRecruit.secondaryPosition})`
                                            : ""}{" "}
                                        • {enlargedRecruit.preferredFoot || "Right"} Foot
                                    </p>
                                    <p className="text-slate-400 text-xs mt-0.5">
                                        {enlargedRecruit.age} years old • {enlargedRecruit.location || "Location TBD"} (
                                        {enlargedRecruit.commutePracticality || "Easy / Local"})
                                    </p>
                                </div>

                                <div className="w-full grid grid-cols-2 gap-2.5 text-left text-xs pt-2">
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Projected Role</span>
                                        <span className="text-white font-bold text-xs block mt-0.5">
                                            {enlargedRecruit.scoutedRole}
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Current Club</span>
                                        <span className="text-white font-bold text-xs block mt-0.5 truncate">
                                            {enlargedRecruit.status === "Unattached"
                                                ? "Free Agent"
                                                : enlargedRecruit.currentClub || "Unknown"}
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Highest Level / Step</span>
                                        <span className="text-amber-400 font-bold text-xs block mt-0.5">
                                            {enlargedRecruit.highestLevel || "Not specified"}
                                        </span>
                                    </div>
                                    <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                        <span className="text-slate-500 text-[10px] block">Previous Clubs</span>
                                        <span className="text-white font-bold text-xs block mt-0.5 truncate">
                                            {enlargedRecruit.previousClubs || "None logged"}
                                        </span>
                                    </div>
                                </div>

                                {/* Direct Contact Actions */}
                                {(enlargedRecruit.phone || enlargedRecruit.instagram || enlargedRecruit.email) && (
                                    <div className="w-full flex flex-wrap items-center justify-center gap-2 pt-1">
                                        {formatWhatsAppUrl(
                                            enlargedRecruit.phone || "",
                                            enlargedRecruit.name,
                                            settings.name
                                        ) && (
                                            <a
                                                href={
                                                    formatWhatsAppUrl(
                                                        enlargedRecruit.phone || "",
                                                        enlargedRecruit.name,
                                                        settings.name
                                                    )!
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center gap-1.5"
                                            >
                                                <MessageCircle className="h-3.5 w-3.5" />
                                                WhatsApp ({enlargedRecruit.phone})
                                            </a>
                                        )}
                                        {enlargedRecruit.instagram && (
                                            <a
                                                href={`https://instagram.com/${enlargedRecruit.instagram.replace(
                                                    /^@/,
                                                    ""
                                                )}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="px-3 py-1.5 rounded-lg bg-pink-500/20 hover:bg-pink-500/30 text-pink-300 border border-pink-500/40 text-xs font-bold flex items-center gap-1.5"
                                            >
                                                <Instagram className="h-3.5 w-3.5" />
                                                {enlargedRecruit.instagram}
                                            </a>
                                        )}
                                        {enlargedRecruit.email && (
                                            <a
                                                href={`mailto:${enlargedRecruit.email}`}
                                                className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold flex items-center gap-1.5"
                                            >
                                                <Mail className="h-3.5 w-3.5" />
                                                {enlargedRecruit.email}
                                            </a>
                                        )}
                                    </div>
                                )}

                                {enlargedRecruit.clubConnection && (
                                    <div className="w-full bg-red-950/20 border border-red-900/40 p-2.5 rounded-lg text-left text-xs italic text-red-300">
                                        <span className="font-bold text-[9px] uppercase block tracking-wider not-italic text-red-400">
                                            🔗 Club Connection
                                        </span>
                                        {enlargedRecruit.clubConnection}
                                    </div>
                                )}
                            </div>

                            {enlargedRecruit.notes && (
                                <div className="space-y-1.5">
                                    <span className="text-slate-400 font-semibold text-[10px] uppercase tracking-wider block">
                                        Scouting Report &amp; Notes
                                    </span>
                                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 text-slate-300 text-xs whitespace-pre-wrap max-h-[140px] overflow-y-auto">
                                        {enlargedRecruit.notes}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2 shrink-0">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const r = enlargedRecruit;
                                    setEnlargedRecruit(null);
                                    openComparisonModal(r.id);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-amber-400 h-9 text-xs font-bold"
                            >
                                <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                                Compare
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => {
                                    const r = enlargedRecruit;
                                    setEnlargedRecruit(null);
                                    handleEdit(r);
                                }}
                                className="bg-slate-800 hover:bg-slate-700 border-slate-700 text-white h-9 text-xs"
                            >
                                <Edit2 className="h-3.5 w-3.5 mr-1.5" />
                                Edit
                            </Button>
                            <Button
                                onClick={() => {
                                    const r = enlargedRecruit;
                                    setEnlargedRecruit(null);
                                    handleSignPlayer(r);
                                }}
                                className="bg-red-600 hover:bg-red-700 text-white font-bold h-9 text-xs"
                            >
                                <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />
                                Sign Player
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
