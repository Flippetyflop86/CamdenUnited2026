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
    "DEF",
    "CB",
    "RB",
    "LB",
    "MID",
    "CDM",
    "CM",
    "CAM",
    "FWD",
    "RW",
    "LW",
    "CF",
    "ST",
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

export function exportRecruitsToCSV(recruits: Recruit[], clubName: string) {
    const rows = recruits.map((r) => ({
        Name: r.name,
        "Primary Position": r.primaryPosition,
        "Secondary Position": r.secondaryPosition || "",
        Age: r.age || "",
        "Preferred Foot": r.preferredFoot || "Right",
        "Star Rating": r.starRating || 3,
        "Scouted Role": r.scoutedRole,
        "Pipeline Stage": r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted"),
        Status: r.status,
        "Current Club": r.status === "Unattached" ? "Free Agent" : r.currentClub || "",
        "Highest Level / Step": r.highestLevel || "",
        "Previous Clubs": r.previousClubs || "",
        "On Trial": r.onTrial ? "Yes" : "No",
        Location: r.location || "",
        "Commute Practicality": r.commutePracticality || "Easy / Local",
        "Phone / WhatsApp": r.phone || "",
        Instagram: r.instagram || "",
        Email: r.email || "",
        "Club Connection": r.clubConnection || "",
        "Scouting Notes": r.notes || "",
        "Last Updated": r.updatedAt ? new Date(r.updatedAt).toLocaleDateString("en-GB") : "",
    }));

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

    const headers = [
        "Name",
        "Primary Pos",
        "Secondary Pos",
        "Age",
        "Preferred Foot",
        "Star Rating",
        "Scouted Role",
        "Pipeline Stage",
        "Status",
        "Current Club",
        "Highest Level / Step",
        "Previous Clubs",
        "On Trial",
        "Location",
        "Commute Practicality",
        "Phone / WhatsApp",
        "Instagram",
        "Email",
        "Club Connection",
        "Scouting Notes",
    ];

    const rowsHtml = recruits
        .map((r) => {
            const stars = "★".repeat(r.starRating || 3) + "☆".repeat(5 - (r.starRating || 3));
            const cols = [
                r.name,
                r.primaryPosition,
                r.secondaryPosition || "",
                r.age || "",
                r.preferredFoot || "Right",
                `${r.starRating || 3}/5 (${stars})`,
                r.scoutedRole,
                r.pipelineStage || (r.onTrial ? "On Trial" : "Scouted"),
                r.status,
                r.status === "Unattached" ? "Free Agent" : r.currentClub || "",
                r.highestLevel || "",
                r.previousClubs || "",
                r.onTrial ? "Yes" : "No",
                r.location || "",
                r.commutePracticality || "Easy / Local",
                r.phone || "",
                r.instagram || "",
                r.email || "",
                r.clubConnection || "",
                r.notes || "",
            ];
            return `<tr>${cols
                .map(
                    (c, idx) =>
                        `<td style="border:1px solid #cbd5e1; padding:6px 8px; vertical-align:top; ${
                            idx === 0 ? "font-weight:bold;" : ""
                        }">${escapeHtml(c)}</td>`
                )
                .join("")}</tr>`;
        })
        .join("");

    const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8" />
            <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Recruitment Black Book</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        </head>
        <body>
            <table border="1" style="border-collapse:collapse; font-family:Calibri, Arial, sans-serif; font-size:11pt;">
                <thead>
                    <tr style="background-color:#0f172a; color:#ffffff; font-weight:bold;">
                        ${headers
                            .map(
                                (h) =>
                                    `<th style="border:1px solid #334155; padding:8px 10px; background-color:#0f172a; color:#ffffff;">${escapeHtml(
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
            Name: "Marcus Sterling",
            "Primary Position": "ST",
            "Secondary Position": "LW",
            Age: 23,
            "Preferred Foot": "Right",
            "Star Rating": 5,
            "Scouted Role": "Star Player",
            "Pipeline Stage": "Contacted",
            Status: "Attached",
            "Current Club": "Hendon Reserves",
            "Highest Level / Step": "Step 5",
            "Previous Clubs": "Wingate & Finchley U23, Edgware Town",
            "On Trial": "No",
            Location: "Camden / NW London",
            "Commute Practicality": "Easy / Local",
            "Phone / WhatsApp": "07700900123",
            Instagram: "@marcus9",
            Email: "",
            "Club Connection": "Played with Kieran Ali",
            "Scouting Notes": "Rapid in behind, clinical finisher, looking for 1st team minutes",
        },
        {
            Name: "Jayden Osei",
            "Primary Position": "LCB",
            "Secondary Position": "LB",
            Age: 21,
            "Preferred Foot": "Left",
            "Star Rating": 4,
            "Scouted Role": "1st Team Player",
            "Pipeline Stage": "Invited to Training",
            Status: "Unattached",
            "Current Club": "",
            "Highest Level / Step": "Step 6",
            "Previous Clubs": "St Panteleimon, Cockfosters",
            "On Trial": "Yes",
            Location: "Tottenham",
            "Commute Practicality": "Easy / Local",
            "Phone / WhatsApp": "07700900456",
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

        const rawPos = getVal(row, [
            "primary position",
            "primary pos",
            "position",
            "pos",
        ]);
        const primaryPosition = normalizeRecruitPosition(rawPos);
        const secondaryPosition = getVal(row, [
            "secondary position",
            "secondary pos",
            "sec pos",
            "other positions",
        ]).toUpperCase();

        const ageNum = parseInt(getVal(row, ["age", "yo", "years"]), 10) || 21;

        const rawFoot = getVal(row, ["preferred foot", "foot", "footed"]).toLowerCase();
        const preferredFoot: "Right" | "Left" | "Both" = rawFoot.startsWith("l")
            ? "Left"
            : rawFoot.startsWith("b") || rawFoot.includes("either")
            ? "Both"
            : "Right";

        const rawRating = parseInt(getVal(row, ["star rating", "rating", "stars", "grade"]), 10);
        const starRating = !isNaN(rawRating) ? Math.min(5, Math.max(1, rawRating)) : 3;

        const rawRole = getVal(row, ["scouted role", "role", "potential role", "tier"]);
        const matchedRole =
            RECRUIT_ROLES.find((r) => r.toLowerCase() === rawRole.toLowerCase()) ||
            (starRating === 5 ? "Star Player" : starRating === 4 ? "1st Team Player" : "Rotation Player");

        const rawStage = getVal(row, ["pipeline stage", "stage", "pipeline", "crm stage"]);
        const matchedStage =
            PIPELINE_STAGES.find((s) => s.toLowerCase() === rawStage.toLowerCase()) || "Scouted";

        const rawClub = getVal(row, ["current club", "club", "team"]);
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
            location: getVal(row, ["location", "area", "postcode", "city"]),
            status: isUnattached ? "Unattached" : "Attached",
            currentClub: isUnattached ? "" : rawClub,
            onTrial,
            scoutedRole: matchedRole,
            notes: getVal(row, ["scouting notes", "notes", "report", "comments"]),
            clubConnection: getVal(row, ["club connection", "connection", "referral", "source"]),
            preferredFoot,
            phone: getVal(row, ["phone / whatsapp", "phone", "whatsapp", "mobile", "contact", "number"]),
            instagram: getVal(row, ["instagram", "ig", "socials"]),
            email: getVal(row, ["email", "e-mail"]),
            highestLevel: getVal(row, ["highest level / step", "highest level", "step", "level"]),
            previousClubs: getVal(row, ["previous clubs", "former clubs", "history", "past clubs"]),
            starRating,
            pipelineStage: onTrial && matchedStage === "Scouted" ? "On Trial" : matchedStage,
            commutePracticality,
        });
    }

    return results;
}
