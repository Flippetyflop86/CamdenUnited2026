import { Player } from "@/types";
import { formatPlayerName } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Activity, ShieldAlert, CheckCircle2, Trash2, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { getImage } from "@/lib/db";

interface PlayerCardProps {
    player: Player;
    onDelete?: (id: string) => void;
    onEdit?: (player: Player) => void;
    onStatusToggle?: (player: Player) => void;
}

export function PlayerCard({ player, onDelete, onEdit, onStatusToggle }: PlayerCardProps) {
    const getPositionBorder = (pos: string) => {
        if (pos === "GK") return "border-amber-500";
        if (["DEF", "CB", "RB", "LB"].includes(pos)) return "border-sky-500";
        if (["MID", "CM", "CDM", "CAM", "RM", "LM"].includes(pos)) return "border-emerald-500";
        return "border-rose-500"; // FWD
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Available": return "bg-green-500/20 text-green-500 border-green-500/50 hover:bg-green-500/30";
            case "Unavailable": return "bg-slate-500/20 text-slate-500 border-slate-500/50 hover:bg-slate-500/30";
            case "Holiday": return "bg-sky-500/20 text-sky-500 border-sky-500/50 hover:bg-sky-500/30";
            case "Injured": return "bg-red-500/20 text-red-500 border-red-500/50 hover:bg-red-500/30";
            case "Suspended": return "bg-orange-500/20 text-orange-500 border-orange-500/50 hover:bg-orange-500/30"; // Handled nicely
            default: return "bg-slate-500/20 text-slate-500 border-slate-500/50";
        }
    };

    const positionBorderClass = getPositionBorder(player.position);
    const statusClass = getStatusColor(player.medicalStatus);

    const [displayImage, setDisplayImage] = useState(player.imageUrl || "/placeholder-player.png");

    useEffect(() => {
        const load = async () => {
            if (player.imageUrl?.startsWith("idb:")) {
                const id = player.imageUrl.split(":")[1];
                try {
                    const blob = await getImage(id);
                    if (blob) {
                        setDisplayImage(blob);
                    } else {
                        // Fallback if IDB image is missing (e.g. data cleared or not synced)
                        setDisplayImage("/placeholder-player.png");
                    }
                } catch (e) {
                    setDisplayImage("/placeholder-player.png");
                }
            } else {
                setDisplayImage(player.imageUrl || "/placeholder-player.png");
            }
        };
        load();
    }, [player.imageUrl]);

    const squadLabel = player.squad
        ? player.squad.split(',').map((s: string) => {
            const clean = s.trim();
            const SQUAD_LABELS: Record<string, string> = { firstTeam: "First Team", midweek: "Midweek", youth: "Youth" };
            return SQUAD_LABELS[clean] || clean;
        }).join(', ')
        : '';

    let displayAge = player.age;
    if (player.dateOfBirth) {
        const birthDate = new Date(player.dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        displayAge = age;
    }

    return (
        <Card className={`overflow-hidden hover:shadow-lg transition-all duration-200 group relative border-2 bg-slate-950 ${positionBorderClass} flex flex-col h-full`}>
            <CardHeader className="p-0 flex-1 flex flex-col">
                <div className="bg-slate-900 p-3 sm:p-6 flex flex-col items-center justify-center flex-1 relative border-b border-slate-800">
                    {onDelete && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (confirm('Delete this player?')) onDelete(player.id);
                            }}
                            className="absolute top-2 sm:top-3 left-2 sm:left-3 p-1.5 sm:p-2 bg-slate-800 hover:bg-red-900/50 rounded-full text-slate-400 hover:text-red-500 z-20"
                            title="Delete Player"
                        >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                    )}
                    {onEdit && (
                        <button
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                onEdit(player);
                            }}
                            className="absolute top-2 sm:top-3 left-9 sm:left-12 p-1.5 sm:p-2 bg-slate-800 hover:bg-blue-900/50 rounded-full text-slate-400 hover:text-blue-500 z-20"
                            title="Edit Player"
                        >
                            <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                    )}
                    <Badge
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onStatusToggle?.(player);
                        }}
                        className={`absolute top-2 sm:top-3 right-2 sm:right-3 border cursor-pointer select-none text-[10px] sm:text-xs px-1.5 py-0.5 ${statusClass}`}
                    >
                        {player.medicalStatus}
                    </Badge>
                    <Avatar className="h-16 w-16 sm:h-24 sm:w-24 border-2 sm:border-4 border-slate-700 shadow-xl mt-6 sm:mt-0">
                        <AvatarImage src={displayImage} />
                        <AvatarFallback className="text-xl sm:text-2xl font-bold bg-slate-200 text-slate-800">
                            {player.firstName[0]}{player.lastName[0]}
                        </AvatarFallback>
                    </Avatar>
                    <div className="mt-2 sm:mt-4 text-center">
                        <CardTitle className="text-white text-sm sm:text-lg truncate max-w-[140px] sm:max-w-none">{formatPlayerName(player)}</CardTitle>
                        <p className="text-slate-400 text-xs sm:text-sm font-medium">{player.position} • {squadLabel} • {displayAge} yo</p>

                        {player.medicalStatus === "Holiday" && player.holidayStart && player.holidayEnd && (
                            <p className="text-slate-300 text-[10px] sm:text-xs">Holiday: {player.holidayStart} to {player.holidayEnd}</p>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-2 sm:p-4 flex justify-between items-center text-center text-xs sm:text-sm overflow-x-auto no-scrollbar">
                <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-slate-500 text-[10px] sm:text-xs">Apps</p>
                    <p className="font-bold text-white">{player.appearances ?? 0}</p>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-slate-500 text-[10px] sm:text-xs">Goals</p>
                    <p className="font-bold text-white">{player.goals ?? 0}</p>
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                    <p className="text-slate-500 text-[10px] sm:text-xs">Assists</p>
                    <p className="font-bold text-white">{player.assists ?? 0}</p>
                </div>
                {player.yellow_cards !== undefined && player.yellow_cards > 0 && (
                    <div className="space-y-0.5 sm:space-y-1">
                        <p className="text-yellow-400 text-[10px] sm:text-xs font-bold">YC</p>
                        <p className="font-bold text-white">{player.yellow_cards}</p>
                    </div>
                )}
                {player.red_cards !== undefined && player.red_cards > 0 && (
                    <div className="space-y-0.5 sm:space-y-1">
                        <p className="text-red-500 text-[10px] sm:text-xs font-bold">RC</p>
                        <p className="font-bold text-white">{player.red_cards}</p>
                    </div>
                )}
            </CardContent>
            <CardFooter className="p-2 sm:p-4 pt-0 sm:pt-0 mt-auto">
                <Button asChild className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-slate-900 hover:bg-slate-800">
                    <Link href={`/squad/${player.id}`}>View Profile</Link>
                </Button>
            </CardFooter>
        </Card>
    );
}
