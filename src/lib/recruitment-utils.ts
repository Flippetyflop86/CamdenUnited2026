import Papa from "papaparse";
import { Recruit, RecruitPipelineStage, CommutePracticality } from "@/types";

export const PIPELINE_STAGES: RecruitPipelineStage[] = [
    "Scouted",
    "Contacted",
    "Invited to Training",
    "On Trial",
    "Approach In (7-Day)",
    "Keep Warm",
    "Signed",
];

export const COMMUTE_OPTIONS: CommutePracticality[] = [
    "Easy / Local",
    "Moderate",
    "Long Commute",
];

export const STEP_LEVEL_OPTIONS: string[] = [
    "Pro / Academy",
    "Step 1–2 (National)",
    "Step 3–4 (Isthmian / Southern)",
    "Step 5",
    "Step 6",
    "Step 7 / County Premier",
    "University 1st XI",
    "Saturday Grassroots",
    "Sunday League",
];

export const RECRUIT_ROLES: Recruit["scoutedRole"][] = [
    "Star Player",
    "1st Team Player",
    "Rotation Player",
    "Back-up",
    "Prospect",
];

export const ALL_RECRUIT_POSITIONS = [
    "GK",
    "RB",
    "CB",
    "LB",
    "DEF",
    "CDM",
    "CM",
    "CAM",
    "MID",
    "RW",
    "LW",
    "CF",
    "ST",
    "FWD",
];

interface BlackBookMeta {
    preferredFoot?: "Right" | "Left" | "Both";
    phone?: string;
    email?: string;
    instagram?: string;
    highestLevel?: string;
    previousClubs?: string;
    starRating?: number;
    pipelineStage?: RecruitPipelineStage;
    commutePracticality?: CommutePracticality;
}

const META_PREFIX = "[BlackBookMeta: ";

export function extractBlackBookMetaFromNotes(rawNotes: string | null | undefined): {
    cleanNotes: string;
    meta: BlackBookMeta;
} {
    const str = String(rawNotes || "");
    const idx = str.indexOf(META_PREFIX);
    if (idx === -1) {
        return { cleanNotes: str.trim(), meta: {} };
    }
    const cleanNotes = str.slice(0, idx).trim();
    const afterPrefix = str.slice(idx + META_PREFIX.length);
    const closingIdx = afterPrefix.lastIndexOf("}]");
    if (closingIdx === -1) {
        return { cleanNotes, meta: {} };
    }
    const jsonCandidate = afterPrefix.slice(0, closingIdx + 1);
    try {
        const parsed = JSON.parse(jsonCandidate);
        return {
            cleanNotes,
            meta: typeof parsed === "object" && parsed !== null ? parsed : {},
        };
    } catch {
        return { cleanNotes, meta: {} };
    }
}

export function buildNotesWithBlackBookMeta(cleanNotes: string, meta: BlackBookMeta): string {
    const trimmed = (cleanNotes || "").trim();
    const cleanedMeta: BlackBookMeta = {};
    if (meta.preferredFoot) cleanedMeta.preferredFoot = meta.preferredFoot;
    if (meta.phone?.trim()) cleanedMeta.phone = meta.phone.trim();
    if (meta.email?.trim()) cleanedMeta.email = meta.email.trim();
    if (meta.instagram?.trim()) cleanedMeta.instagram = meta.instagram.trim();
    if (meta.highestLevel?.trim()) cleanedMeta.highestLevel = meta.highestLevel.trim();
    if (meta.previousClubs?.trim()) cleanedMeta.previousClubs = meta.previousClubs.trim();
    if (typeof meta.starRating === "number" && meta.starRating >= 1 && meta.starRating <= 5) {
        cleanedMeta.starRating = meta.starRating;
    }
    if (meta.pipelineStage) cleanedMeta.pipelineStage = meta.pipelineStage;
    if (meta.commutePracticality) cleanedMeta.commutePracticality = meta.commutePracticality;

    const metaJson = JSON.stringify(cleanedMeta);
    if (metaJson === "{}") return trimmed;
    return trimmed ? `${trimmed}\n\n${META_PREFIX}${metaJson}]` : `${META_PREFIX}${metaJson}]`;
}

export function defaultStarRatingForRole(role?: string): number {
    if (role === "Star Player") return 5;
    if (role === "1st Team Player") return 4;
    if (role === "Rotation Player") return 3;
    if (role === "Prospect") return 3;
    if (role === "Back-up") return 2;
    return 3;
}

export function parseRecruitFromDbRow(r: any): Recruit {
    const { cleanNotes, meta } = extractBlackBookMetaFromNotes(r.notes);
    const onTrial = Boolean(r.on_trial) || meta.pipelineStage === "On Trial";
    const pipelineStage: RecruitPipelineStage =
        meta.pipelineStage || (r.on_trial ? "On Trial" : "Scouted");
    const starRating =
        typeof meta.starRating === "number" && meta.starRating >= 1 && meta.starRating <= 5
            ? meta.starRating
            : defaultStarRatingForRole(r.scouted_role);

    return {
        id: r.id,
        name: r.name || "Unknown Player",
        primaryPosition: (r.primary_position || "MID").toUpperCase(),
        secondaryPosition: r.secondary_position || "",
        age: Number(r.age) || 0,
        location: r.location || "",
        status: r.status === "Unattached" ? "Unattached" : "Attached",
        currentClub: r.current_club || "",
        onTrial,
        scoutedRole: r.scouted_role || "1st Team Player",
        notes: cleanNotes,
        clubConnection: r.club_connection || "",
        preferredFoot: meta.preferredFoot || "Right",
        phone: meta.phone || "",
        email: meta.email || "",
        instagram: meta.instagram || "",
        highestLevel: meta.highestLevel || "",
        previousClubs: meta.previousClubs || "",
        starRating,
        pipelineStage,
        commutePracticality: meta.commutePracticality || "Easy / Local",
        createdAt: r.created_at || new Date().toISOString(),
        updatedAt: r.updated_at || new Date().toISOString(),
    };
}

export function serializeRecruitForDb(form: {
    name: string;
    primaryPosition: string;
    secondaryPosition?: string;
    age: number | string;
    location?: string;
    status: "Attached" | "Unattached";
    currentClub?: string;
    onTrial?: boolean;
    scoutedRole: Recruit["scoutedRole"];
    notes?: string;
    clubConnection?: string;
    preferredFoot?: "Right" | "Left" | "Both";
    phone?: string;
    email?: string;
    instagram?: string;
    highestLevel?: string;
    previousClubs?: string;
    starRating?: number;
    pipelineStage?: RecruitPipelineStage;
    commutePracticality?: CommutePracticality;
}) {
    const stage: RecruitPipelineStage =
        form.pipelineStage || (form.onTrial ? "On Trial" : "Scouted");
    const isTrial = Boolean(form.onTrial) || stage === "On Trial";

    const packedNotes = buildNotesWithBlackBookMeta(form.notes || "", {
        preferredFoot: form.preferredFoot || "Right",
        phone: form.phone || "",
        email: form.email || "",
        instagram: form.instagram || "",
        highestLevel: form.highestLevel || "",
        previousClubs: form.previousClubs || "",
        starRating: Number(form.starRating) || defaultStarRatingForRole(form.scoutedRole),
        pipelineStage: stage,
        commutePracticality: form.commutePracticality || "Easy / Local",
    });

    return {
        name: form.name.trim(),
        primary_position: (form.primaryPosition || "MID").toUpperCase().trim(),
        secondary_position: (form.secondaryPosition || "").toUpperCase().trim(),
        age: typeof form.age === "number" ? form.age : parseInt(String(form.age), 10) || 0,
        location: (form.location || "").trim(),
        status: form.status === "Unattached" ? "Unattached" : "Attached",
        current_club: form.status === "Unattached" ? "" : (form.currentClub || "").trim(),
        on_trial: isTrial,
        scouted_role: form.scoutedRole || "1st Team Player",
        notes: packedNotes,
        club_connection: (form.clubConnection || "").trim(),
        updated_at: new Date().toISOString(),
    };
}

export function formatWhatsAppUrl(phone: string, playerName?: string, clubName?: string): string | null {
    if (!phone) return null;
    let digits = phone.replace(/[^0-9+]/g, "");
    if (!digits) return null;
    if (digits.startsWith("07") && digits.length === 11) {
        digits = "44" + digits.slice(1);
    } else if (digits.startsWith("+")) {
        digits = digits.slice(1);
    }
    if (digits.length < 7) return null;
    const firstName = playerName ? playerName.trim().split(/\s+/)[0] : "";
    const greeting = firstName
        ? `Hi ${firstName}, hope you're well! Reaching out from ${clubName || "the club"} regarding football.`
        : "";
    return greeting
        ? `https://wa.me/${digits}?text=${encodeURIComponent(greeting)}`
        : `https://wa.me/${digits}`;
}

const TACTICAL_POSITION_ORDER: Record<string, number> = {
    GK: 1,
    RB: 2,
    RWB: 3,
    RCB: 4,
    CB: 5,
    LCB: 6,
    LB: 7,
    LWB: 8,
    DEF: 9,
    CDM: 10,
    DM: 11,
    CM: 12,
    RM: 13,
    LM: 14,
    CAM: 15,
    AM: 16,
    MID: 17,
    RW: 18,
    LW: 19,
    CF: 20,
    ST: 21,
    FWD: 22,
};

export function getPositionUnitOrder(pos?: string): number {
    const p = (pos || "").toUpperCase().trim();
    if (p === "GK") return 1;
    if (["DEF", "CB", "LCB", "RCB", "RB", "LB", "RWB", "LWB"].includes(p)) return 2;
    if (["MID", "CDM", "DM", "CM", "CAM", "AM", "RM", "LM"].includes(p)) return 3;
    return 4;
}

export function getTacticalPositionOrder(pos?: string): number {
    const p = (pos || "").toUpperCase().trim();
    return TACTICAL_POSITION_ORDER[p] ?? 99;
}

function getPositionUnitLabel(pos?: string): "Goalkeepers" | "Defenders" | "Midfielders" | "Forwards" {
    const order = getPositionUnitOrder(pos);
    if (order === 1) return "Goalkeepers";
    if (order === 2) return "Defenders";
    if (order === 3) return "Midfielders";
    return "Forwards";
}

export function sortRecruitsByPosition(recruits: Recruit[]): Recruit[] {
    return [...recruits].sort((a, b) => {
        const unitDiff = getPositionUnitOrder(a.primaryPosition) - getPositionUnitOrder(b.primaryPosition);
        if (unitDiff !== 0) return unitDiff;
        const posDiff = getTacticalPositionOrder(a.primaryPosition) - getTacticalPositionOrder(b.primaryPosition);
        if (posDiff !== 0) return posDiff;
        const ratingDiff = (b.starRating || 3) - (a.starRating || 3);
        if (ratingDiff !== 0) return ratingDiff;
        return (a.name || "").localeCompare(b.name || "");
    });
}

export function exportRecruitsToCSV(recruits: Recruit[], clubName: string) {
    const sorted = sortRecruitsByPosition(recruits);
    const rows = sorted.map((r, index) => {
        const rating = r.starRating || 3;
        const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
        const stage = r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted");
        const isFreeAgent = r.status === "Unattached";
        const phoneFormatted = r.phone ? (r.phone.startsWith("0") || r.phone.startsWith("+") ? ` ${r.phone}` : r.phone) : "—";

        return {
            "#": index + 1,
            "Primary Position": r.primaryPosition,
            "Player Name": r.name,
            "Secondary Position": r.secondaryPosition || "—",
            "Age": r.age || "—",
            "Preferred Foot": r.preferredFoot || "Right",
            "Star Rating": `${stars} (${rating}/5)`,
            "Scouted Role": r.scoutedRole,
            "Pipeline Stage": stage,
            "Current Club": isFreeAgent ? "Free Agent" : r.currentClub || "—",
            "Highest Level / Step": r.highestLevel || "—",
            "Previous Clubs": r.previousClubs || "—",
            "Location": r.location || "—",
            "Commute Practicality": r.commutePracticality || "Easy / Local",
            "Phone / WhatsApp": phoneFormatted,
            "Instagram": r.instagram || "—",
            "Club Connection": r.clubConnection || "—",
            "Scouting Notes": (r.notes || "").replace(/\r?\n+/g, " | ") || "—",
        };
    });

    const csv = Papa.unparse(rows);
    // Add UTF-8 BOM so Microsoft Excel opens symbols & characters properly
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeClub = (clubName || "Club").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `${safeClub}_Recruitment_Black_Book_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function exportRecruitsToExcelXLS(recruits: Recruit[], clubName: string) {
    const escapeHtml = (val: any) =>
        String(val ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

    const sorted = sortRecruitsByPosition(recruits);

    // Harmonious, easy-on-the-eye palette for the 4 positional units
    const getUnitPalette = (pos?: string) => {
        const unit = getPositionUnitOrder(pos);
        if (unit === 1) {
            // Goalkeepers — Soft Warm Gold / Amber
            return {
                badgeBg: "#FEF3C7",
                badgeText: "#92400E",
                accentBorder: "#F59E0B",
                sectionBg: "#FFFBEB",
                sectionText: "#92400E",
                rowEven: "#FFFFFF",
                rowOdd: "#FFFDF7",
            };
        }
        if (unit === 2) {
            // Defenders — Soft Ice Sky Blue
            return {
                badgeBg: "#E0F2FE",
                badgeText: "#0369A1",
                accentBorder: "#0EA5E9",
                sectionBg: "#F0F9FF",
                sectionText: "#075985",
                rowEven: "#FFFFFF",
                rowOdd: "#F8FCFF",
            };
        }
        if (unit === 3) {
            // Midfielders — Soft Mint Emerald
            return {
                badgeBg: "#D1FAE5",
                badgeText: "#065F46",
                accentBorder: "#10B981",
                sectionBg: "#ECFDF5",
                sectionText: "#065F46",
                rowEven: "#FFFFFF",
                rowOdd: "#F7FEFA",
            };
        }
        // Forwards — Soft Blush Rose
        return {
            badgeBg: "#FFE4E6",
            badgeText: "#9F1239",
            accentBorder: "#F43F5E",
            sectionBg: "#FFF1F2",
            sectionText: "#9F1239",
            rowEven: "#FFFFFF",
            rowOdd: "#FFF9FA",
        };
    };

    const getStagePill = (stage?: string) => {
        switch (stage) {
            case "Signed":
                return { bg: "#DCFCE7", text: "#166534" };
            case "On Trial":
                return { bg: "#FEF3C7", text: "#92400E" };
            case "Invited to Training":
                return { bg: "#E0E7FF", text: "#3730A3" };
            case "Approach In (7-Day)":
                return { bg: "#F3E8FF", text: "#6B21A8" };
            case "Contacted":
                return { bg: "#E0F2FE", text: "#075985" };
            case "Keep Warm":
                return { bg: "#FFEDD5", text: "#9A3412" };
            default:
                return { bg: "#F1F5F9", text: "#475569" };
        }
    };

    const getCommuteTextStyle = (commute?: string) => {
        if (commute === "Long Commute") return { text: "#BE123C", weight: "600" };
        if (commute === "Moderate") return { text: "#B45309", weight: "600" };
        return { text: "#047857", weight: "600" };
    };

    const colWidths = [
        44,  // #
        90,  // Primary Position
        205, // Player Name
        90,  // Secondary Position
        56,  // Age
        95,  // Preferred Foot
        120, // Star Rating
        135, // Scouted Role
        150, // Pipeline Stage
        170, // Current Club
        150, // Highest Level / Step
        185, // Previous Clubs
        140, // Location
        130, // Commute Practicality
        140, // Phone / WhatsApp
        125, // Instagram
        165, // Club Connection
        340, // Scouting Notes
    ];

    const headers = [
        "#",
        "Primary Position",
        "Player Name",
        "Secondary Position",
        "Age",
        "Preferred Foot",
        "Star Rating",
        "Scouted Role",
        "Pipeline Stage",
        "Current Club",
        "Highest Level / Step",
        "Previous Clubs",
        "Location",
        "Commute Practicality",
        "Phone / WhatsApp",
        "Instagram",
        "Club Connection",
        "Scouting Notes",
    ];

    const totalTargets = sorted.length;
    const star5Count = sorted.filter((r) => (r.starRating || 3) >= 5).length;
    const trialCount = sorted.filter((r) => r.onTrial || r.pipelineStage === "On Trial").length;
    const freeAgentCount = sorted.filter((r) => r.status === "Unattached").length;
    const gkCount = sorted.filter((r) => getPositionUnitOrder(r.primaryPosition) === 1).length;
    const defCount = sorted.filter((r) => getPositionUnitOrder(r.primaryPosition) === 2).length;
    const midCount = sorted.filter((r) => getPositionUnitOrder(r.primaryPosition) === 3).length;
    const fwdCount = sorted.filter((r) => getPositionUnitOrder(r.primaryPosition) === 4).length;

    let lastUnitOrder = 0;
    let unitRowCounter = 0;

    const rowsHtml = sorted
        .map((r, idx) => {
            const unitOrder = getPositionUnitOrder(r.primaryPosition);
            const unitLabel = getPositionUnitLabel(r.primaryPosition);
            const palette = getUnitPalette(r.primaryPosition);

            let sectionHeaderHtml = "";
            if (unitOrder !== lastUnitOrder) {
                lastUnitOrder = unitOrder;
                unitRowCounter = 0;
                const unitCount = sorted.filter((x) => getPositionUnitOrder(x.primaryPosition) === unitOrder).length;
                sectionHeaderHtml = `
                    <tr style="height:30px;">
                        <td colspan="${headers.length}" style="background-color:${palette.sectionBg}; color:${palette.sectionText}; font-weight:bold; font-size:9.5pt; padding:6px 14px; border-top:2px solid ${palette.accentBorder}; border-bottom:1px solid ${palette.accentBorder}; letter-spacing:0.6px;">
                            &#9679;&nbsp; ${escapeHtml(unitLabel.toUpperCase())} (${unitCount})
                        </td>
                    </tr>
                `;
            }

            const rowBg = unitRowCounter % 2 === 0 ? palette.rowEven : palette.rowOdd;
            unitRowCounter++;

            const rating = r.starRating || 3;
            const stars = "★".repeat(rating) + "☆".repeat(Math.max(0, 5 - rating));
            const stage = r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted");
            const isFreeAgent = r.status === "Unattached";
            const stagePill = getStagePill(stage);
            const commuteStyle = getCommuteTextStyle(r.commutePracticality);

            const starTextColor = rating >= 5 ? "#B45309" : rating === 4 ? "#D97706" : "#64748B";
            const roleTextColor =
                r.scoutedRole === "Star Player"
                    ? "#92400E"
                    : r.scoutedRole === "1st Team Player"
                    ? "#0F172A"
                    : "#475569";
            const roleFontWeight =
                r.scoutedRole === "Star Player" || r.scoutedRole === "1st Team Player" ? "bold" : "normal";

            const cellBase = `border-top:1px solid #E2E8F0; border-bottom:1px solid #E2E8F0; border-left:1px solid #F1F5F9; border-right:1px solid #F1F5F9; padding:9px 12px; vertical-align:middle; font-size:10pt; background-color:${rowBg};`;

            return `${sectionHeaderHtml}<tr style="height:36px;">
                <td style="${cellBase} color:#94A3B8; text-align:center; font-size:9pt; border-left:3px solid ${palette.accentBorder};">${idx + 1}</td>
                <td style="${cellBase} background-color:${palette.badgeBg}; color:${palette.badgeText}; font-weight:bold; text-align:center; font-size:9.5pt;">${escapeHtml(r.primaryPosition)}</td>
                <td style="${cellBase} color:#0F172A; font-weight:bold; font-size:10.5pt;">${escapeHtml(r.name)}</td>
                <td style="${cellBase} color:#64748B; text-align:center; font-size:9.5pt;">${escapeHtml(r.secondaryPosition || "—")}</td>
                <td style="${cellBase} color:#334155; text-align:center;">${escapeHtml(r.age || "—")}</td>
                <td style="${cellBase} color:#334155; text-align:center;">${escapeHtml(r.preferredFoot || "Right")}</td>
                <td style="${cellBase} color:${starTextColor}; font-weight:bold; text-align:center; letter-spacing:0.5px;">${stars} <span style="color:#64748B; font-weight:normal; font-size:9pt;">(${rating}/5)</span></td>
                <td style="${cellBase} color:${roleTextColor}; font-weight:${roleFontWeight}; text-align:center;">${escapeHtml(r.scoutedRole)}</td>
                <td style="${cellBase} background-color:${stagePill.bg}; color:${stagePill.text}; font-weight:bold; text-align:center; font-size:9.5pt;">${escapeHtml(stage)}</td>
                <td style="${cellBase} color:${isFreeAgent ? "#047857" : "#0F172A"}; font-weight:${isFreeAgent ? "bold" : "normal"};">${escapeHtml(isFreeAgent ? "Free Agent" : r.currentClub || "—")}</td>
                <td style="${cellBase} color:#334155; font-weight:600;">${escapeHtml(r.highestLevel || "—")}</td>
                <td style="${cellBase} color:#64748B;">${escapeHtml(r.previousClubs || "—")}</td>
                <td style="${cellBase} color:#334155;">${escapeHtml(r.location || "—")}</td>
                <td style="${cellBase} color:${commuteStyle.text}; font-weight:${commuteStyle.weight}; text-align:center; font-size:9.5pt;">${escapeHtml(r.commutePracticality || "Easy / Local")}</td>
                <td style="${cellBase} color:#0F172A; font-weight:600; mso-number-format:'\\@';">${escapeHtml(r.phone || "—")}</td>
                <td style="${cellBase} color:#0284C7;">${escapeHtml(r.instagram || "—")}</td>
                <td style="${cellBase} color:#475569;">${escapeHtml(r.clubConnection || "—")}</td>
                <td style="${cellBase} color:#334155; white-space:normal;">${escapeHtml(r.notes || "—")}</td>
            </tr>`;
        })
        .join("");

    const exportDateFormatted = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]>
            <xml>
                <x:ExcelWorkbook>
                    <x:ExcelWorksheets>
                        <x:ExcelWorksheet>
                            <x:Name>Recruitment Black Book</x:Name>
                            <x:WorksheetOptions>
                                <x:DisplayGridlines/>
                                <x:FreezePanes/>
                                <x:FrozenNoSplit/>
                                <x:SplitHorizontal>3</x:SplitHorizontal>
                                <x:TopRowBottomPane>3</x:TopRowBottomPane>
                                <x:ActivePane>2</x:ActivePane>
                            </x:WorksheetOptions>
                        </x:ExcelWorksheet>
                    </x:ExcelWorksheets>
                </x:ExcelWorkbook>
            </xml>
            <![endif]-->
        </head>
        <body style="font-family:'Segoe UI', Calibri, Arial, sans-serif; background-color:#FFFFFF; margin:0; padding:0;">
            <table border="1" style="border-collapse:collapse; font-family:'Segoe UI', Calibri, Arial, sans-serif; font-size:10pt; border:1px solid #CBD5E1;">
                <colgroup>
                    ${colWidths.map((w) => `<col width="${w}" style="width:${w}px;" />`).join("")}
                </colgroup>
                <thead>
                    <!-- Row 1: Clean Dark Slate Executive Title Banner -->
                    <tr style="height:42px;">
                        <th colspan="${headers.length}" style="background-color:#0F172A; color:#F8FAFC; font-size:14pt; font-weight:bold; text-align:left; padding:10px 16px; border:1px solid #0F172A; letter-spacing:0.4px;">
                            ${escapeHtml((clubName || "CLUBFLOW").toUpperCase())} &mdash; PLAYER RECRUITMENT SHORTLIST
                        </th>
                    </tr>
                    <!-- Row 2: Calm Subtitle & Summary Strip -->
                    <tr style="height:28px;">
                        <th colspan="${headers.length}" style="background-color:#1E293B; color:#CBD5E1; font-size:9.5pt; font-weight:normal; text-align:left; padding:6px 16px; border:1px solid #1E293B;">
                            Sorted by Position Order (GK &rarr; DEF &rarr; MID &rarr; FWD) &nbsp;&bull;&nbsp;
                            Exported ${escapeHtml(exportDateFormatted)} &nbsp;&bull;&nbsp;
                            <b style="color:#FFFFFF;">${totalTargets} Targets</b> (GK: ${gkCount}, DEF: ${defCount}, MID: ${midCount}, FWD: ${fwdCount}) &nbsp;&bull;&nbsp;
                            5&#9733; Targets: <b style="color:#FDE68A;">${star5Count}</b> &nbsp;&bull;&nbsp;
                            On Trial: <b style="color:#FDE68A;">${trialCount}</b> &nbsp;&bull;&nbsp;
                            Free Agents: <b style="color:#A7F3D0;">${freeAgentCount}</b>
                        </th>
                    </tr>
                    <!-- Row 3: Column Headers -->
                    <tr style="height:34px; background-color:#334155; color:#FFFFFF; font-weight:bold;">
                        ${headers
                            .map(
                                (h) =>
                                    `<th style="border:1px solid #475569; padding:8px 12px; background-color:#334155; color:#F8FAFC; font-size:9.5pt; text-align:center; white-space:nowrap;">${escapeHtml(
                                        h
                                    )}</th>`
                            )
                            .join("")}
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(["\uFEFF" + html], {
        type: "application/vnd.ms-excel;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeClub = (clubName || "Club").replace(/[^a-zA-Z0-9_-]/g, "_");
    const dateStr = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.setAttribute("download", `${safeClub}_Recruitment_Black_Book_${dateStr}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function downloadBlankRecruitTemplateCSV() {
    const sampleRows = [
        {
            "Player Name": "Marcus Sterling",
            "Primary Position": "ST",
            "Secondary Position": "LW",
            Age: 23,
            "Preferred Foot": "Right",
            "Star Rating": "★★★★★ (5/5)",
            "Scouted Role": "Star Player",
            "Pipeline Stage": "Contacted",
            Status: "Attached",
            "Current Club": "Hendon Reserves",
            "Highest Level / Step": "Step 5",
            "Previous Clubs": "Wingate & Finchley U23, Edgware Town",
            "On Trial": "No",
            Location: "Camden / NW London",
            "Commute Practicality": "Easy / Local",
            "Phone / WhatsApp": " 07700900123",
            Instagram: "@marcus9",
            Email: "",
            "Club Connection": "Played with Kieran Ali",
            "Scouting Notes": "Rapid in behind, clinical finisher, looking for 1st team minutes",
        },
        {
            "Player Name": "Jayden Osei",
            "Primary Position": "LCB",
            "Secondary Position": "LB",
            Age: 21,
            "Preferred Foot": "Left",
            "Star Rating": "★★★★☆ (4/5)",
            "Scouted Role": "1st Team Player",
            "Pipeline Stage": "Invited to Training",
            Status: "Free Agent (Unattached)",
            "Current Club": "Free Agent",
            "Highest Level / Step": "Step 6",
            "Previous Clubs": "St Panteleimon, Cockfosters",
            "On Trial": "Yes",
            Location: "Tottenham",
            "Commute Practicality": "Easy / Local",
            "Phone / WhatsApp": " 07700900456",
            Instagram: "@jayden_osei",
            Email: "",
            "Club Connection": "Recommended by Assistant Coach",
            "Scouting Notes": "Composed left-footed centre half, aggressive in aerial duels",
        },
    ];

    const csv = Papa.unparse(sampleRows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "Recruitment_Black_Book_Import_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export function normalizeRecruitPosition(raw: string): string {
    const clean = (raw || "").toUpperCase().trim();
    if (!clean) return "MID";
    if (["GK", "GOALKEEPER", "KEEPER"].includes(clean)) return "GK";
    if (["CB", "LCB", "RCB", "CENTRE BACK", "CENTER BACK"].includes(clean)) return "CB";
    if (["RB", "RWB", "RIGHT BACK"].includes(clean)) return "RB";
    if (["LB", "LWB", "LEFT BACK"].includes(clean)) return "LB";
    if (["DEF", "DEFENDER", "DF", "FB"].includes(clean)) return "DEF";
    if (["CDM", "DM", "HOLDING MID"].includes(clean)) return "CDM";
    if (["CM", "CENTRAL MID"].includes(clean)) return "CM";
    if (["CAM", "AM", "10", "NUMBER 10"].includes(clean)) return "CAM";
    if (["MID", "MF", "MIDFIELDER", "RM", "LM"].includes(clean)) return "MID";
    if (["RW", "RIGHT WING", "RWF"].includes(clean)) return "RW";
    if (["LW", "LEFT WING", "LWF"].includes(clean)) return "LW";
    if (["CF", "CENTRE FORWARD"].includes(clean)) return "CF";
    if (["ST", "STRIKER", "9", "FWD", "FW", "FORWARD", "ATT"].includes(clean)) return "ST";
    // Check first token if slash separated like "ST/LW"
    const firstPart = clean.split(/[\/,\s]+/)[0];
    if (ALL_RECRUIT_POSITIONS.includes(firstPart)) return firstPart;
    return "MID";
}

export function parseBulkRecruitImportText(
    rawText: string
): Omit<Recruit, "id" | "createdAt" | "updatedAt">[] {
    if (!rawText || !rawText.trim()) return [];

    const parsed = Papa.parse<Record<string, any>>(rawText.trim(), {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim().toLowerCase(),
    });

    const results: Omit<Recruit, "id" | "createdAt" | "updatedAt">[] = [];

    const getVal = (row: Record<string, any>, keys: string[]): string => {
        for (const k of keys) {
            if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== "") {
                return String(row[k]).trim();
            }
        }
        return "";
    };

    for (const row of parsed.data) {
        const name = getVal(row, [
            "name",
            "player",
            "player name",
            "full name",
            "target",
        ]);
        if (!name) continue;

        const cleanDash = (v: string) => (v === "—" || v === "-" ? "" : v);

        const rawPos = getVal(row, [
            "primary position",
            "primary pos",
            "position",
            "pos",
        ]);
        const primaryPosition = normalizeRecruitPosition(rawPos);
        const secondaryPosition = cleanDash(
            getVal(row, [
                "secondary position",
                "secondary pos",
                "sec pos",
                "other positions",
            ])
        ).toUpperCase();

        const ageNum = parseInt(getVal(row, ["age", "yo", "years"]), 10) || 21;

        const rawFoot = getVal(row, ["preferred foot", "foot", "footed"]).toLowerCase();
        const preferredFoot: "Right" | "Left" | "Both" = rawFoot.startsWith("l")
            ? "Left"
            : rawFoot.startsWith("b") || rawFoot.includes("either")
            ? "Both"
            : "Right";

        const rawRatingStr = getVal(row, ["star rating", "rating", "stars", "grade"]);
        const digitMatch = rawRatingStr.match(/([1-5])/);
        const filledStarsCount = (rawRatingStr.match(/★/g) || []).length;
        const parsedRating = digitMatch
            ? parseInt(digitMatch[1], 10)
            : filledStarsCount > 0
            ? filledStarsCount
            : parseInt(rawRatingStr, 10);
        const starRating = !isNaN(parsedRating) ? Math.min(5, Math.max(1, parsedRating)) : 3;

        const rawRole = getVal(row, ["scouted role", "role", "potential role", "tier"]);
        const matchedRole =
            RECRUIT_ROLES.find((r) => r.toLowerCase() === rawRole.toLowerCase()) ||
            (starRating === 5 ? "Star Player" : starRating === 4 ? "1st Team Player" : "Rotation Player");

        const rawStage = getVal(row, ["pipeline stage", "stage", "pipeline", "crm stage"]);
        const matchedStage =
            PIPELINE_STAGES.find((s) => s.toLowerCase() === rawStage.toLowerCase()) || "Scouted";

        const rawClub = cleanDash(getVal(row, ["current club", "club", "team"]));
        const rawStatus = getVal(row, ["status", "contract status"]).toLowerCase();
        const isUnattached =
            rawStatus.includes("unattached") ||
            rawStatus.includes("free") ||
            rawClub.toLowerCase() === "free agent" ||
            rawClub.toLowerCase() === "none";

        const rawTrial = getVal(row, ["on trial", "trial", "trialist"]).toLowerCase();
        const onTrial =
            rawTrial === "yes" ||
            rawTrial === "true" ||
            rawTrial === "y" ||
            matchedStage === "On Trial";

        const rawCommute = getVal(row, [
            "commute practicality",
            "commute",
            "travel",
            "distance",
        ]).toLowerCase();
        const commutePracticality: CommutePracticality = rawCommute.includes("long") ||
            rawCommute.includes("hard")
            ? "Long Commute"
            : rawCommute.includes("mod") || rawCommute.includes("med")
            ? "Moderate"
            : "Easy / Local";

        results.push({
            name,
            primaryPosition,
            secondaryPosition,
            age: ageNum,
            location: cleanDash(getVal(row, ["location", "area", "postcode", "city"])),
            status: isUnattached ? "Unattached" : "Attached",
            currentClub: isUnattached ? "" : rawClub,
            onTrial,
            scoutedRole: matchedRole,
            notes: cleanDash(getVal(row, ["scouting notes", "notes", "report", "comments"])),
            clubConnection: cleanDash(getVal(row, ["club connection", "connection", "referral", "source"])),
            preferredFoot,
            phone: cleanDash(getVal(row, ["phone / whatsapp", "phone", "whatsapp", "mobile", "contact", "number"])),
            instagram: cleanDash(getVal(row, ["instagram", "ig", "socials"])),
            email: cleanDash(getVal(row, ["email", "e-mail"])),
            highestLevel: cleanDash(getVal(row, ["highest level / step", "highest level", "step", "level"])),
            previousClubs: cleanDash(getVal(row, ["previous clubs", "former clubs", "history", "past clubs"])),
            starRating,
            pipelineStage: onTrial && matchedStage === "Scouted" ? "On Trial" : matchedStage,
            commutePracticality,
        });
    }

    return results;
}
