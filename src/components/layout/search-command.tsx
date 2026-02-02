"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Search, User, Calendar, ArrowRight, ClipboardList, BookOpen, ShieldCheck, FileText, LayoutDashboard, Users, Trophy, DollarSign, Package } from "lucide-react";
import { Player, Match } from "@/types";
import { supabase } from "@/lib/supabase";

export function SearchCommand() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<{
        type: 'player' | 'match' | 'recruit' | 'sponsor' | 'document' | 'page',
        label: string,
        subLabel: string,
        id?: string,
        link: string
    }[]>([]);

    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        const openEvent = () => setOpen(true);

        document.addEventListener("keydown", down);
        document.addEventListener("open-global-search", openEvent);
        return () => {
            document.removeEventListener("keydown", down);
            document.removeEventListener("open-global-search", openEvent);
        }
    }, []);


    // ... (keep props) ...

    const [dataLoaded, setDataLoaded] = useState(false);
    const [searchData, setSearchData] = useState<{
        players: Player[];
        matches: Match[];
        recruits: any[];
        sponsors: any[];
        documents: any[];
    }>({ players: [], matches: [], recruits: [], sponsors: [], documents: [] });

    useEffect(() => {
        // Pre-fetch data for search
        const loadSearchData = async () => {
            const [
                { data: players },
                { data: matches },
                { data: recruits },
                { data: sponsors },
                { data: documents }
            ] = await Promise.all([
                supabase.from('players').select('*'),
                supabase.from('matches').select('*'),
                supabase.from('recruits').select('*'),
                supabase.from('sponsors').select('*'),
                supabase.from('documents').select('*')
            ]);

            setSearchData({
                players: (players || []).map((p: any) => ({ ...p, firstName: p.first_name, lastName: p.last_name })), // Map some fields if needed
                matches: (matches || []) as any,
                recruits: (recruits || []) as any,
                sponsors: (sponsors || []) as any,
                documents: (documents || []) as any
            });
            setDataLoaded(true);
        };

        loadSearchData();
    }, []);

    useEffect(() => {
        if (!query) {
            setResults([]);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const found: typeof results = [];

        // 1. Static Pages
        const pages = [
            { label: 'Dashboard', link: '/dashboard', subLabel: 'Ovreview & Stats', icon: LayoutDashboard },
            { label: 'Squad Management', link: '/squad', subLabel: 'Players & Availability', icon: Users },
            { label: 'Match Hub', link: '/matches', subLabel: 'Fixtures & Results', icon: Trophy },
            { label: 'Recruitment Hub', link: '/recruitment', subLabel: 'Scouting & Targets', icon: Search },
            { label: 'Finance Hub', link: '/finance', subLabel: 'Budget & Transactions', icon: DollarSign },
            { label: 'Club Sponsors', link: '/sponsors', subLabel: 'Partners & Deals', icon: ShieldCheck },
            { label: 'Documents', link: '/documents', subLabel: 'Club Library', icon: BookOpen },
            { label: 'Inventory', link: '/inventory', subLabel: 'Kit & Equipment', icon: Package },
        ];

        pages.forEach(p => {
            if (p.label.toLowerCase().includes(lowerQuery) || p.subLabel.toLowerCase().includes(lowerQuery)) {
                found.push({ type: 'page', label: p.label, subLabel: p.subLabel, link: p.link });
            }
        });

        // 2. Search Players
        searchData.players.forEach(p => {
            const fullName = `${p.firstName} ${p.lastName}`.toLowerCase();
            if (fullName.includes(lowerQuery)) {
                found.push({
                    type: 'player',
                    label: `${p.firstName} ${p.lastName}`,
                    subLabel: `Squad Player • ${p.position}`,
                    id: p.id,
                    link: `/squad` // Could link to /squad/${p.id} if profile page existed
                });
            }
        });

        // 3. Search Recruits
        searchData.recruits.forEach((r: any) => {
            if (r.name.toLowerCase().includes(lowerQuery)) {
                found.push({
                    type: 'recruit',
                    label: r.name,
                    subLabel: `Recruitment Target • ${r.primary_position || r.primaryPosition}`,
                    id: r.id,
                    link: `/recruitment`
                });
            }
        });

        // 4. Search Matches
        searchData.matches.forEach(m => {
            const searchStr = `${m.opponent} ${m.competition}`.toLowerCase();
            if (searchStr.includes(lowerQuery)) {
                found.push({
                    type: 'match',
                    label: `vs ${m.opponent}`,
                    subLabel: `${new Date(m.date).toLocaleDateString()} • ${m.competition}`,
                    id: m.id,
                    link: `/matches`
                });
            }
        });

        // 5. Search Sponsors
        searchData.sponsors.forEach((s: any) => {
            if (s.name?.toLowerCase().includes(lowerQuery)) {
                found.push({
                    type: 'sponsor',
                    label: s.name,
                    subLabel: `Sponsor • ${s.frequency}`,
                    id: s.id,
                    link: `/sponsors`
                });
            }
        });

        // 6. Search Documents
        searchData.documents.forEach((d: any) => {
            if (d.name?.toLowerCase().includes(lowerQuery)) {
                found.push({
                    type: 'document',
                    label: d.name,
                    subLabel: `Document • ${d.category}`,
                    id: d.id,
                    link: `/documents`
                });
            }
        });

        setResults(found.slice(0, 10));
    }, [query, searchData]);

    const handleSelect = (link: string) => {
        setOpen(false);
        setQuery("");
        router.push(link);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[500px] p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <div className="flex items-center border-b px-3 pb-3 pt-4 border-slate-200 dark:border-slate-800">
                    <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                    <input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-slate-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-50"
                        placeholder="Type a command or search..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2">
                    {results.length === 0 && query && (
                        <p className="p-4 text-center text-sm text-slate-500">No results found.</p>
                    )}
                    {results.length === 0 && !query && (
                        <p className="p-4 text-center text-sm text-slate-500">Search for players or matches...</p>
                    )}
                    {results.map((result, i) => (
                        <div
                            key={i}
                            className="relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-slate-100 dark:hover:bg-slate-800 aria-selected:bg-slate-100 aria-selected:text-slate-900 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 cursor-pointer group"
                            onClick={() => handleSelect(result.link)}
                            aria-label={`Go to ${result.label}`}
                        >
                            <div className="mr-3 text-slate-400">
                                {result.type === 'player' && <User className="h-4 w-4 text-blue-500" />}
                                {result.type === 'match' && <Trophy className="h-4 w-4 text-amber-500" />}
                                {result.type === 'recruit' && <Search className="h-4 w-4 text-purple-500" />}
                                {result.type === 'sponsor' && <ShieldCheck className="h-4 w-4 text-red-500" />}
                                {result.type === 'document' && <FileText className="h-4 w-4 text-slate-500" />}
                                {result.type === 'page' && <LayoutDashboard className="h-4 w-4 text-indigo-500" />}
                            </div>
                            <div className="flex flex-col flex-1">
                                <span className="font-medium text-slate-900 dark:text-slate-100">{result.label}</span>
                                <span className="text-xs text-slate-500">{result.subLabel}</span>
                            </div>
                            <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                        </div>
                    ))}
                </div>
                <div className="border-t p-2 text-xs text-slate-500 flex justify-between bg-slate-50 dark:bg-slate-950">
                    <span>Press <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">ESC</kbd> to close</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
