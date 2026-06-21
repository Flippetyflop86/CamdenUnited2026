// Central definition of all controllable pages and their permission keys.
// The 'key' is what gets stored in the page_permissions JSON array on club_members.
// 'manager' role always bypasses this — they see everything.

export interface PagePermission {
    key: string;
    label: string;
    href: string;
    description: string;
    group: string;
}

export const ALL_PAGE_PERMISSIONS: PagePermission[] = [
    // On the Pitch
    { key: "squad",       label: "Squad",         href: "/squad",       description: "View and manage players",         group: "On the Pitch" },
    { key: "training",    label: "Training",       href: "/training",    description: "Training sessions and plans",     group: "On the Pitch" },
    { key: "matches",     label: "Fixtures",       href: "/matches",     description: "Fixtures and results",            group: "On the Pitch" },
    { key: "matchday-xi", label: "Matchday XI",    href: "/matchday-xi", description: "Lineup and tactics board",        group: "On the Pitch" },
    // Analysis
    { key: "analysis",   label: "Match Analysis",     href: "/analysis",   description: "Post-match video analysis",     group: "Analysis" },
    { key: "opposition", label: "Opposition Reports", href: "/opposition", description: "Scouting and opposition notes", group: "Analysis" },
    { key: "league",     label: "League Table",        href: "/league",     description: "Live league standings",         group: "Analysis" },
    // Off the Pitch
    { key: "sponsors",     label: "Sponsorships", href: "/sponsors",     description: "Sponsor deals and contacts",     group: "Off the Pitch" },
    { key: "recruitment",  label: "Recruitment",  href: "/recruitment",  description: "Player recruitment pipeline",    group: "Off the Pitch" },
    { key: "finance",      label: "Finance",      href: "/finance",      description: "Income, expenses and balances",  group: "Off the Pitch" },
    { key: "budgets",      label: "Player Budgets", href: "/budgets",    description: "Individual player budgets",      group: "Off the Pitch" },
    { key: "inventory",    label: "Inventory",    href: "/inventory",    description: "Kit and equipment tracker",      group: "Off the Pitch" },
    { key: "staff",        label: "Staff",        href: "/staff",        description: "Staff profiles and contracts",   group: "Off the Pitch" },
    { key: "documents",    label: "Documents",    href: "/documents",    description: "Club documents and files",       group: "Off the Pitch" },
    { key: "admin",        label: "Access Control", href: "/admin",       description: "Invite staff members and manage page permissions", group: "Off the Pitch" },
];

// Pages that are always manager-only (never shown to staff regardless of permissions)
export const MANAGER_ONLY_PAGES: string[] = [];

// Dashboard is always visible to all logged-in users.
export const ALWAYS_VISIBLE_PAGES = ["/dashboard"];

// These pages are pre-ticked by default when creating an invite, but can be revoked.
export const DEFAULT_GRANTED_PERMISSIONS = ["sponsors", "finance", "budgets"];

export const PERMISSION_GROUPS = [...new Set(ALL_PAGE_PERMISSIONS.map(p => p.group))];

/** Returns true if a user with the given permissions can view the given href */
export function canAccess(href: string, role: string | null, pagePermissions: string[]): boolean {
    const isManager = role === "manager";

    // Admin is accessible to managers, or anyone with 'admin' permission
    if (href.startsWith("/admin")) {
        return isManager || pagePermissions.includes("admin");
    }

    // Always-visible pages (e.g. dashboard) — open to everyone
    if (ALWAYS_VISIBLE_PAGES.some(p => href.startsWith(p))) return true;

    // If the manager has not set any explicit permissions for themselves,
    // they see everything (default full-access state).
    // Once they save a non-empty permissions set for themselves,
    // it acts as their personal page filter — Admin remains accessible above.
    if (isManager && pagePermissions.length === 0) return true;

    // Check the permission key for this href
    const page = ALL_PAGE_PERMISSIONS.find(p => href.startsWith(p.href));
    if (!page) return true; // Unknown/unguarded page — allow by default
    return pagePermissions.includes(page.key);
}
