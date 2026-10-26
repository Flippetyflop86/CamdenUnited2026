import { Player } from "@/types";
import { formatPlayerName, isFormerPlayer, parsePlayerDeparture, getLoanExpiryStatus } from "@/lib/utils";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Pencil, Calendar, Users, UserMinus, RotateCcw, Check, Building2, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { getImage } from "@/lib/db";

interface PlayerCardProps {
    player: Player;
    onDelete?: (id: string) => void;
    onMarkLeft?: (player: Player) => void;
    onRestore?: (player: Player) => void;
    onEdit?: (player: Player) => void;
    onStatusToggle?: (player: Player) => void;
    isBulkMode?: boolean;
    isSelected?: boolean;
    onToggleSelect?: (playerId: string) => void;
}

export function PlayerCard({
    player,
    onMarkLeft,
    onRestore,
    onEdit,
    onStatusToggle,
    isBulkMode = false,
    isSelected = false,
    onToggleSelect,
}: PlayerCardProps) {
    const departureInfo = parsePlayerDeparture(player);
    const isFormer = isFormerPlayer(player);
    const loanExpiry = getLoanExpiryStatus(player.loanEndDate);

    const getStatusColor = (status: string) => {
        switch (status) {
            case "Available": return "bg-status-success/10 text-status-success border-status-success/20 hover:bg-status-success/20";
            case "Unavailable": return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
            case "Holiday": return "bg-status-info/10 text-status-info border-status-info/20 hover:bg-status-info/20";
            case "Injured": return "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20";
            case "Suspended": return "bg-status-error/10 text-status-error border-status-error/20 hover:bg-status-error/20";
            case "Doubtful": return "bg-status-warning/10 text-status-warning border-status-warning/20 hover:bg-status-warning/20";
            case "At Parent Club": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20 hover:bg-purple-500/20";
            default: return "bg-muted text-muted-foreground border-border hover:bg-muted/80";
        }
    };

    const statusClass = getStatusColor(player.medicalStatus);

    const defaultImage = player.imageUrl && player.imageUrl !== "/placeholder-player.png" ? player.imageUrl : "";
    const [displayImage, setDisplayImage] = useState(defaultImage);

    useEffect(() => {
        const load = async () => {
            if (player.imageUrl?.startsWith("idb:")) {
                const id = player.imageUrl.split(":")[1];
                try {
                    const blob = await getImage(id);
                    if (blob) {
                        setDisplayImage(blob);
                    } else {
                        setDisplayImage("");
                    }
                } catch (e) {
                    setDisplayImage("");
                }
            } else {
                const img = player.imageUrl && player.imageUrl !== "/placeholder-player.png" ? player.imageUrl : "";
                setDisplayImage(img);
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

    const formattedDepartureDate = departureInfo.departureDate
        ? (() => {
            const d = new Date(departureInfo.departureDate + "T00:00:00");
            return isNaN(d.getTime())
                ? departureInfo.departureDate
                : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
        })()
        : null;

    return (
        <Card
            onClick={() => {
                if (isBulkMode && onToggleSelect) {
                    onToggleSelect(player.id);
                }
            }}
            className={`overflow-hidden hover:shadow-md transition-all duration-200 group relative border-border bg-card flex flex-col h-full rounded-xl ${
                isFormer ? "opacity-95 border-amber-500/20" : ""
            } ${isBulkMode ? "cursor-pointer select-none" : ""} ${
                isSelected ? "ring-2 ring-primary border-primary bg-primary/[0.02]" : ""
            }`}
        >

            <CardHeader className="p-5 pb-4 flex-1 flex flex-col items-center justify-center relative border-b border-border/50 bg-surface-1/50">
                
                {/* Position & Availability / Departure Strip */}
                <div className="w-full flex justify-between items-start mb-4 gap-2">
                    <div className="flex flex-col items-start gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            {isBulkMode && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onToggleSelect?.(player.id);
                                    }}
                                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                        isSelected
                                            ? "bg-primary border-primary text-primary-foreground"
                                            : "bg-background border-border hover:border-primary/60"
                                    }`}
                                    aria-label={`Select ${formatPlayerName(player)}`}
                                >
                                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                </button>
                            )}
                            <span className="text-xs font-bold px-2 py-1 bg-background border border-border rounded text-foreground uppercase tracking-wider shadow-sm">
                                {player.position}
                            </span>
                            {(player.registrationType === "Loan" || player.registrationType === "Dual") && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 rounded uppercase tracking-wider">
                                    {player.registrationType === "Loan"
                                        ? player.isParentClub
                                            ? "Out on Loan"
                                            : "Loan In"
                                        : "Dual Reg"}
                                </span>
                            )}
                        </div>
                        {player.squadNumber > 0 && (
                            <span className="text-[10px] font-semibold text-muted-foreground ml-1">
                                #{player.squadNumber}
                            </span>
                        )}
                    </div>
                    
                    {isFormer ? (
                        <Badge
                            className="border text-[10px] sm:text-xs px-2 py-0.5 rounded shadow-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 font-semibold text-right"
                        >
                            {departureInfo.departureReason || departureInfo.departureStatus}
                        </Badge>
                    ) : (
                        <Badge
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (isBulkMode && onToggleSelect) {
                                    onToggleSelect(player.id);
                                    return;
                                }
                                onStatusToggle?.(player);
                            }}
                            className={`border cursor-pointer select-none text-[10px] sm:text-xs px-2 py-0.5 rounded shadow-sm transition-colors ${statusClass}`}
                        >
                            {player.medicalStatus}
                        </Badge>
                    )}
                </div>

                {/* Avatar (Optional but prominent if exists) */}
                {displayImage ? (
                    <Avatar className="h-20 w-20 sm:h-24 sm:w-24 mb-4 border-2 border-border shadow-sm">
                        <AvatarImage src={displayImage} alt={formatPlayerName(player)} className="object-cover" />
                        <AvatarFallback className="bg-surface-2 text-muted-foreground font-bold text-xl">
                            {player.firstName?.charAt(0)}{player.lastName?.charAt(0)}
                        </AvatarFallback>
                    </Avatar>
                ) : (
                    <div className="h-20 w-20 sm:h-24 sm:w-24 mb-4 rounded-full bg-surface-2 border-2 border-border flex items-center justify-center text-muted-foreground font-bold text-2xl shadow-sm">
                        {player.firstName?.charAt(0)}{player.lastName?.charAt(0)}
                    </div>
                )}

                {/* Identity */}
                <div className="text-center w-full">
                    <CardTitle className="text-foreground text-lg sm:text-xl font-bold truncate">
                        {formatPlayerName(player)}
                    </CardTitle>
                    
                    <div className="flex items-center justify-center gap-3 mt-1.5 text-xs text-muted-foreground font-medium">
                        <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {displayAge} yrs
                        </div>
                        <div className="w-1 h-1 rounded-full bg-border" />
                        <div className="flex items-center gap-1 truncate max-w-[120px]">
                            <Users className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{squadLabel || "No Squad"}</span>
                        </div>
                    </div>

                    {/* Loan / Dual Club & Expiry Tracker */}
                    {(player.registrationType === "Loan" || player.registrationType === "Dual") && (player.loanClub || loanExpiry.status !== "none") && (
                        <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-[11px]">
                            {player.loanClub && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 font-medium max-w-full truncate">
                                    <Building2 className="w-3 h-3 shrink-0" />
                                    <span className="truncate">
                                        {player.registrationType === "Loan"
                                            ? player.isParentClub
                                                ? `To: ${player.loanClub}`
                                                : `From: ${player.loanClub}`
                                            : `Dual: ${player.loanClub}`}
                                    </span>
                                </span>
                            )}
                            {player.registrationType === "Loan" && loanExpiry.status !== "none" && (
                                <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold ${
                                        loanExpiry.status === "expired"
                                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
                                            : loanExpiry.status === "expiring_soon"
                                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                                            : "bg-muted text-muted-foreground border-border"
                                    }`}
                                >
                                    <Clock className="w-3 h-3 shrink-0" />
                                    {loanExpiry.label}
                                </span>
                            )}
                        </div>
                    )}
                    
                    {isFormer ? (
                        <div className="mt-2.5 pt-2 border-t border-border/50 text-[11px] space-y-0.5">
                            {formattedDepartureDate && (
                                <p className="text-muted-foreground font-medium">
                                    Left club: <span className="text-foreground font-semibold">{formattedDepartureDate}</span>
                                </p>
                            )}
                            {departureInfo.departureNotes && (
                                <p className="text-muted-foreground italic line-clamp-2 px-1" title={departureInfo.departureNotes}>
                                    &ldquo;{departureInfo.departureNotes}&rdquo;
                                </p>
                            )}
                        </div>
                    ) : (
                        <>
                            {player.medicalStatus === "Holiday" && (player.holidayStart || player.holidayEnd) && (
                                <p className="text-status-info text-[10px] sm:text-xs mt-2 font-medium">
                                    Holiday: {player.holidayStart && player.holidayEnd ? `${player.holidayStart} to ${player.holidayEnd}` : player.holidayEnd ? `Back ${player.holidayEnd}` : `From ${player.holidayStart}`}
                                </p>
                            )}
                            {(player.medicalStatus === "Injured" || player.medicalStatus === "Doubtful") && (player.injuryType || player.injuryDuration) && (
                                <p className="text-status-danger text-[10px] sm:text-xs mt-2 font-medium">
                                    {[player.injuryType, player.injuryDuration].filter(Boolean).join(" • ")}
                                </p>
                            )}
                            {player.medicalStatus === "Suspended" && (player.suspensionReason || player.suspensionDuration) && (
                                <p className="text-muted-foreground text-[10px] sm:text-xs mt-2 font-medium">
                                    {[player.suspensionReason, player.suspensionDuration].filter(Boolean).join(" • ")}
                                </p>
                            )}
                        </>
                    )}
                </div>
            </CardHeader>
            
            {/* Stats */}
            <CardContent className="p-3 sm:p-4 grid grid-cols-3 gap-y-3 gap-x-2 text-center text-xs bg-background">
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Apps</p>
                    <p className="font-bold text-foreground">{player.appearances ?? 0}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Starts</p>
                    <p className="font-bold text-foreground">{player.starts ?? 0}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Sub Apps</p>
                    <p className="font-bold text-foreground">{player.subApps ?? 0}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Goals</p>
                    <p className="font-bold text-foreground">{player.goals ?? 0}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Asts</p>
                    <p className="font-bold text-foreground">{player.assists ?? 0}</p>
                </div>
                <div className="space-y-1">
                    <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider">Mins</p>
                    <p className="font-bold text-foreground">{(player as any).minutes_played ?? 0}</p>
                </div>
            </CardContent>
            
            {/* Cards (Optional Strip) */}
            {((player.yellow_cards !== undefined && player.yellow_cards > 0) || (player.red_cards !== undefined && player.red_cards > 0)) && (
                <div className="px-4 pb-3 flex gap-2 justify-center text-[10px] bg-background">
                    {player.yellow_cards !== undefined && player.yellow_cards > 0 && (
                        <span className="font-bold text-muted-foreground flex items-center gap-1">
                            <div className="w-2 h-3 bg-yellow-400 rounded-sm" /> {player.yellow_cards}
                        </span>
                    )}
                    {player.red_cards !== undefined && player.red_cards > 0 && (
                        <span className="font-bold text-muted-foreground flex items-center gap-1">
                            <div className="w-2 h-3 bg-red-500 rounded-sm" /> {player.red_cards}
                        </span>
                    )}
                </div>
            )}
            
            <CardFooter className="p-3 sm:p-4 pt-0 sm:pt-0 mt-auto bg-background flex gap-2">
                <Button asChild variant="secondary" className="flex-1 h-8 sm:h-9 text-xs sm:text-sm font-bold bg-surface-2 hover:bg-border/50 text-foreground transition-colors shadow-sm">
                    <Link href={`/squad/${player.id}`}>View Profile</Link>
                </Button>
                {onEdit && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEdit(player);
                        }}
                        className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-foreground bg-surface-1 shadow-sm"
                        title="Edit Player"
                    >
                        <Pencil className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                )}
                {isFormer && onRestore && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onRestore(player);
                        }}
                        className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 bg-surface-1 shadow-sm"
                        title="Restore to Active Squad"
                    >
                        <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                )}
                {!isFormer && onMarkLeft && (
                    <Button
                        variant="outline"
                        size="icon"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onMarkLeft(player);
                        }}
                        className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 text-muted-foreground hover:text-amber-600 hover:border-amber-500/40 bg-surface-1 shadow-sm"
                        title="Mark as Left Club"
                    >
                        <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                )}
            </CardFooter>
        </Card>
    );
}

