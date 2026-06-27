"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Calendar, User, ShieldCheck, LogOut, CheckSquare, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function PlayerLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    
    const [loading, setLoading] = useState(true);
    const [playerName, setPlayerName] = useState("");

    useEffect(() => {
        const playerId = localStorage.getItem("cf_player_id");
        const deviceToken = localStorage.getItem("cf_player_device_token");

        if (!playerId || !deviceToken) {
            router.push("/");
            return;
        }

        async function verifyDevice() {
            try {
                const { data: player, error } = await supabase
                    .from("players")
                    .select("id, first_name, last_name, trusted_devices")
                    .eq("id", playerId)
                    .single();

                if (error || !player) {
                    throw new Error("Authentication failed");
                }

                const devices = Array.isArray(player.trusted_devices) ? player.trusted_devices : [];
                const isTrusted = devices.some((d: any) => d.token === deviceToken);

                if (!isTrusted) {
                    throw new Error("Device untrusted");
                }

                setPlayerName(`${player.first_name} ${player.last_name}`);
                setLoading(false);
            } catch (err) {
                console.error("Layout verification failed:", err);
                localStorage.clear();
                router.push("/");
            }
        }

        verifyDevice();
    }, [router]);

    const handleLogout = () => {
        localStorage.clear();
        router.push("/");
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
                <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="h-10 w-10 text-red-600 animate-spin" />
                    <p className="text-slate-400 text-sm font-medium">Authenticating profile session...</p>
                </div>
            </div>
        );
    }

    const navigation = [
        { name: "Home", href: "/player", icon: ShieldCheck },
        { name: "Availability", href: "/player/availability", icon: CheckSquare },
        { name: "Fixtures", href: "/player/fixtures", icon: Calendar },
        { name: "Profile", href: "/player/profile", icon: User },
    ];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
            {/* Header Navigation */}
            <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white text-sm">
                            CF
                        </div>
                        <span className="font-bold text-base tracking-tight text-white">Player Portal</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-slate-400 hidden sm:inline">
                            👤 {playerName}
                        </span>
                        <button 
                            onClick={handleLogout}
                            className="text-xs font-semibold text-slate-400 hover:text-red-400 flex items-center gap-1.5 transition-colors p-1"
                        >
                            <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main content grid */}
            <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 pb-20">
                {children}
            </main>

            {/* Bottom Mobile Tab Bar */}
            <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-40 sm:hidden">
                <div className="grid grid-cols-4 h-14">
                    {navigation.map((item) => {
                        const Icon = item.icon;
                        const active = pathname === item.href;
                        return (
                            <Link 
                                key={item.name} 
                                href={item.href}
                                className={`flex flex-col items-center justify-center text-[10px] font-bold ${
                                    active ? "text-red-500" : "text-slate-400 hover:text-slate-200"
                                }`}
                            >
                                <Icon className="h-5 w-5 mb-0.5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Sidebar navigation for desktop */}
            <nav className="hidden sm:block fixed left-4 top-24 w-40 space-y-1">
                {navigation.map((item) => {
                    const Icon = item.icon;
                    const active = pathname === item.href;
                    return (
                        <Link 
                            key={item.name} 
                            href={item.href}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                                active 
                                    ? "bg-red-600 text-white shadow-lg shadow-red-600/10" 
                                    : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                            }`}
                        >
                            <Icon className="h-4.5 w-4.5" />
                            {item.name}
                        </Link>
                    );
                })}
            </nav>
        </div>
    );
}
