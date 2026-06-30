"use client";

import { useEffect, useState } from "react";
import { TrainingSession, Player, AttendanceRecord, Position } from "@/types";
import { useRouter, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, MapPin, Clock, Download, Share2, Link2, MessageCircle, Bell } from "lucide-react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";

function formatSquad(squad: string) {
    if (squad === "firstTeam") return "First Team";
    if (squad === "midweek") return "Midweek";
    if (squad === "youth") return "Youth";
    return squad;
}

function formatFriendlyDate(dateStr: string) {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = new Intl.DateTimeFormat("en-GB", { month: 'long' }).format(d);

    let suffix = "th";
    if (day === 1 || day === 21 || day === 31) suffix = "st";
    else if (day === 2 || day === 22) suffix = "nd";
    else if (day === 3 || day === 23) suffix = "rd";

    return `${weekday} ${day}${suffix} of ${month}`;
}

export default function TrainingSessionPage() {
    const routeParams = useParams();
    const [session, setSession] = useState<TrainingSession | null>(null);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [unsavedChanges, setUnsavedChanges] = useState(false);
    const [attendanceStats, setAttendanceStats] = useState<Record<string, { present: number; total: number }>>({});
    const [guestName, setGuestName] = useState("");
    const [isReminding, setIsReminding] = useState(false);

    useEffect(() => {
        const fetchSessionData = async () => {
            const id = routeParams?.id;
            const sessionId = Array.isArray(id) ? id[0] : id;
            if (!sessionId) return;

            try {
                const [sessionRes, playersRes, recruitsRes, allSessionsRes] = await Promise.all([
                    supabase.from('training_sessions').select('*').eq('id', sessionId).single(),
                    supabase.from('players').select('*'),
                    supabase.from('recruits').select('*').eq('on_trial', true),
                    supabase.from('training_sessions').select('attendance')
                ]);

                if (playersRes.data) {
                    const mappedPlayers: Player[] = playersRes.data.map((p: any) => ({
                        id: p.id,
                        firstName: p.first_name,
                        lastName: p.last_name,
                        position: p.position,
                        squadNumber: p.squad_number,
                        age: p.age,
                        nationality: p.nationality,
                        squad: p.squad,
                        medicalStatus: p.medical_status,
                        holidayStart: p.holiday_start,
                        holidayEnd: p.holiday_end,
                        availability: p.availability,
                        contractExpiry: p.contract_expiry,
                        imageUrl: p.image_url,
                        appearances: p.appearances,
                        goals: p.goals,
                        assists: p.assists,
                        dateOfBirth: p.date_of_birth,
                        notes: p.notes,
                        isInTrainingSquad: p.is_in_training_squad
                    }));

                    const mappedTrialists: Player[] = (recruitsRes.data || []).map((r: any) => {
                        const nameParts = (r.name || "").trim().split(/\s+/);
                        const firstName = nameParts[0] || "Trialist";
                        const lastName = nameParts.slice(1).join(" ") || "";
                        return {
                            id: r.id,
                            firstName,
                            lastName,
                            position: (r.primary_position || "ST") as Position,
                            squadNumber: 0,
                            age: r.age || 0,
                            nationality: "British",
                            squad: "Trialist",
                            medicalStatus: "Available",
                            holidayStart: undefined,
                            holidayEnd: undefined,
                            availability: true,
                            contractExpiry: "2026-06-30",
                            imageUrl: undefined,
                            appearances: 0,
                            goals: 0,
                            assists: 0,
                            dateOfBirth: undefined,
                            notes: r.notes || "Active Trialist",
                            isInTrainingSquad: true
                        };
                    });

                    const allCombined = [...mappedPlayers, ...mappedTrialists];
                    setPlayers(allCombined);

                    if (sessionRes.data) {
                        const existingAttendance: any[] = sessionRes.data.attendance || [];

                        // Pre-populate ALL eligible players as Absent if no record exists
                        const isFirstTeamSession = sessionRes.data.squad === "All" || sessionRes.data.squad === "firstTeam" || sessionRes.data.squad === "First Team";
                        const checkSquadMatch = (playerSquadsStr: string | undefined | null, targetSquad: string) => {
                            if (!playerSquadsStr) return false;
                            const squads = playerSquadsStr.split(',').map(s => s.trim().toLowerCase());
                            const cleanTarget = targetSquad.toLowerCase();
                            if (cleanTarget === 'firstteam' || cleanTarget === 'first team') {
                                return squads.includes('first team') || squads.includes('firstteam');
                            }
                            if (cleanTarget === 'midweek') {
                                return squads.includes('midweek');
                            }
                            if (cleanTarget === 'youth') {
                                return squads.includes('youth');
                            }
                            return squads.includes(cleanTarget);
                        };
                        const isFirstTeam = (squad: string | undefined | null) => {
                            if (!squad) return false;
                            const squads = squad.split(',').map(s => s.trim().toLowerCase());
                            return squads.includes('first team') || squads.includes('firstteam');
                        };
                        
                        const eligible = allCombined.filter(p => {
                            if (isFirstTeamSession) {
                                return isFirstTeam(p.squad) || p.isInTrainingSquad;
                            } else {
                                return checkSquadMatch(p.squad, sessionRes.data.squad);
                            }
                        });
                        const prePopulated = eligible.map(p => {
                            const existing = existingAttendance.find(a => a.playerId === p.id);
                            return existing || { playerId: p.id, status: 'Absent', notes: '' };
                        });

                        // Preserve any existing attendance records for players not in the main eligible squad list (guests, trialists)
                        const nonEligibleExisting = existingAttendance.filter(a => !eligible.some(p => p.id === a.playerId));
                        const finalAttendance = [...prePopulated, ...nonEligibleExisting];

                        setSession({ ...sessionRes.data, attendance: finalAttendance });
                    }

                    if (allSessionsRes.data) {
                        const stats: Record<string, { present: number; total: number }> = {};
                        allSessionsRes.data.forEach((s: any) => {
                            const attList = s.attendance || [];
                            attList.forEach((record: any) => {
                                if (!stats[record.playerId]) {
                                    stats[record.playerId] = { present: 0, total: 0 };
                                }
                                stats[record.playerId].total += 1;
                                if (record.status === 'Present' || record.status === 'Late') {
                                    stats[record.playerId].present += 1;
                                }
                            });
                        });
                        setAttendanceStats(stats);
                    }
                }
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchSessionData();
    }, [routeParams]);

    // Single tap: toggle Present ↔ Absent
    const handleTogglePresent = (playerId: string) => {
        if (!session) return;
        const idx = session.attendance.findIndex(a => a.playerId === playerId);
        let updated = [...session.attendance];

        if (idx >= 0) {
            const current = updated[idx].status;
            updated[idx] = { ...updated[idx], status: current === 'Present' ? 'Absent' : 'Present' };
        } else {
            updated.push({ playerId, status: 'Present', notes: '' });
        }

        setSession({ ...session, attendance: updated });
        setUnsavedChanges(true);
    };

    // Small 🚑 button: toggle Injured ↔ Absent
    const handleMarkInjured = (playerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!session) return;
        const idx = session.attendance.findIndex(a => a.playerId === playerId);
        let updated = [...session.attendance];

        if (idx >= 0) {
            const current = updated[idx].status;
            updated[idx] = { ...updated[idx], status: current === 'Injured' ? 'Absent' : 'Injured' };
        } else {
            updated.push({ playerId, status: 'Injured', notes: '' });
        }

        setSession({ ...session, attendance: updated });
        setUnsavedChanges(true);
    };

    const handleAddGuest = () => {
        if (!guestName.trim() || !session) return;
        const guestId = `guest:${guestName.trim()}_${Date.now()}`;
        const newRecord: AttendanceRecord = { playerId: guestId, status: 'Present', notes: 'Guest Player' };
        
        setSession({
            ...session,
            attendance: [...session.attendance, newRecord]
        });
        setGuestName("");
        setUnsavedChanges(true);
    };

    const handleResetPlayerPin = async (playerId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        
        const player = players.find(p => p.id === playerId);
        if (!player) return;

        if (window.confirm(`Are you sure you want to reset the Check-in PIN for ${player.firstName} ${player.lastName}? They will be prompted to set a new PIN next time they check in.`)) {
            try {
                const currentNotes = player.notes || "";
                
                // Helper to clean PIN from notes
                const cleanedNotes = currentNotes.replace(/\[PIN:\d{4}\]/, "").trim();

                const { error } = await supabase
                    .from("players")
                    .update({ notes: cleanedNotes })
                    .eq("id", playerId);

                if (error) throw error;

                // Update local state
                setPlayers(players.map(p => p.id === playerId ? { ...p, notes: cleanedNotes } : p));
                alert(`PIN for ${player.firstName} has been reset successfully!`);
            } catch (err: any) {
                alert("Failed to reset PIN: " + err.message);
            }
        }
    };

    const handleSave = async () => {
        if (!session) return;
        const { error } = await supabase
            .from('training_sessions')
            .update({ attendance: session.attendance })
            .eq('id', session.id);

        if (error) {
            alert("Error saving attendance: " + error.message);
        } else {
            setUnsavedChanges(false);
        }
    };

    const downloadSessionCSV = () => {
        if (!session) return;
        
        const title = `Camden United Training Register - ${session.date}`;
        const squadName = formatSquad(session.squad as string);
        
        // Output formatted HTML Table that Excel automatically opens as a styled spreadsheet
        const html = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <!--[if gte mso 9]>
            <xml>
              <x:ExcelWorkbook>
                <x:ExcelWorksheets>
                  <x:ExcelWorksheet>
                    <x:Name>Training Session</x:Name>
                    <x:WorksheetOptions>
                      <x:DisplayGridlines/>
                    </x:WorksheetOptions>
                  </x:ExcelWorksheet>
                </x:ExcelWorksheets>
              </x:ExcelWorkbook>
            </xml>
            <![endif]-->
            <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
              table { border-collapse: collapse; margin-top: 10px; }
              td, th { border: 1px solid #cbd5e1; padding: 10px 14px; font-size: 11pt; text-align: left; }
              th { background-color: #0f172a; color: #ffffff; font-weight: bold; font-size: 11pt; border-bottom: 2px solid #0f172a; }
              .header-row { font-size: 16pt; font-weight: bold; color: #0f172a; border: none; padding-bottom: 4px; }
              .subheader-row { font-size: 10pt; color: #64748b; border: none; padding-bottom: 15px; }
              .status-present { background-color: #d1fae5; color: #065f46; font-weight: bold; }
              .status-absent { background-color: #fee2e2; color: #991b1b; }
              .status-injured { background-color: #fef3c7; color: #92400e; }
              .bold { font-weight: bold; }
            </style>
          </head>
          <body>
            <table>
              <tr>
                <td colspan="4" class="header-row">${title}</td>
              </tr>
              <tr>
                <td colspan="4" class="subheader-row">Squad: ${squadName} &bull; Time: ${session.time} &bull; Location: ${session.location}</td>
              </tr>
              <tr><td colspan="4" style="border: none;"></td></tr>
              <thead>
                <tr>
                  <th>Player Name</th>
                  <th>Squad</th>
                  <th>Position</th>
                  <th>Attendance Status</th>
                </tr>
              </thead>
              <tbody>
                ${eligiblePlayers.map(p => {
                  const record = session.attendance.find(a => a.playerId === p.id);
                  const status = record?.status ?? 'Absent';
                  let statusClass = 'status-absent';
                  if (status === 'Present' || status === 'Late') statusClass = 'status-present';
                  else if (status === 'Injured') statusClass = 'status-injured';
                  
                  return `
                    <tr>
                      <td class="bold">${p.firstName} ${p.lastName}</td>
                      <td>${p.squad}</td>
                      <td>${p.position}</td>
                      <td class="${statusClass}">${status}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </body>
          </html>
        `;

        const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `session_${session.date}_${session.squad}.xls`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleRemindOutstanding = async () => {
        if (!session) return;
        setIsReminding(true);
        try {
            // Find how many players haven't responded
            const respondedIds = (session.attendance || []).map((a: any) => a.playerId);
            const outstandingCount = eligiblePlayers.filter(p => !respondedIds.includes(p.id)).length;

            if (outstandingCount === 0) {
                alert("All eligible squad players have already RSVP'd to this session!");
                setIsReminding(false);
                return;
            }

            if (!confirm(`Send email RSVP reminders to all ${outstandingCount} outstanding players?`)) {
                setIsReminding(false);
                return;
            }

            const res = await fetch("/api/communications/email", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clubId: (session as any).club_id,
                    recipientGroup: "Outstanding Players",
                    subject: "Outstanding RSVP Reminder: {{TrainingDate}}",
                    message: "Hi {{FirstName}},\n\nYou haven't updated your availability for our next session yet!\n\n📅 Date: {{TrainingDate}}\n📍 Location: {{Location}}\n\nClick the link below to confirm your slot:\n🔗 {{RsvpLink}}\n\nThank you,\nClub Management",
                    eventId: session.id,
                    eventType: "training"
                })
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                throw new Error(data.error || "Failed to trigger email reminders.");
            }

            alert("Reminders sent successfully!");
        } catch (err: any) {
            alert("Failed to send reminders: " + err.message);
        } finally {
            setIsReminding(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Loading session details...</div>;
    if (!session) return <div className="p-8 text-center">Session not found.</div>;

    const positionOrder: Record<string, number> = {
        "GK": 1, "RB": 2, "LB": 2, "CB": 2, "RWB": 2, "LWB": 2, "DEF": 2,
        "CDM": 3, "CM": 3, "CAM": 3, "RM": 3, "LM": 3, "MID": 3,
        "RW": 4, "LW": 4, "CF": 4, "ST": 4, "FWD": 4
    };

    const isPlayerOnHolidayOnDate = (p: Player, dateStr: string) => {
        if (p.medicalStatus !== "Holiday") return false;
        if (!p.holidayStart || !p.holidayEnd) return true;
        return dateStr >= p.holidayStart && dateStr <= p.holidayEnd;
    };

    const isFirstTeamSession = session.squad === "All" || session.squad === "firstTeam" || session.squad === "First Team";
    const checkSquadMatch = (playerSquadsStr: string | undefined | null, targetSquad: string) => {
        if (!playerSquadsStr) return false;
        const squads = playerSquadsStr.split(',').map(s => s.trim().toLowerCase());
        const cleanTarget = targetSquad.toLowerCase();
        if (cleanTarget === 'firstteam' || cleanTarget === 'first team') {
            return squads.includes('first team') || squads.includes('firstteam');
        }
        if (cleanTarget === 'midweek') {
            return squads.includes('midweek');
        }
        if (cleanTarget === 'youth') {
            return squads.includes('youth');
        }
        return squads.includes(cleanTarget);
    };
    const isFirstTeam = (squad: string | undefined | null) => {
        if (!squad) return false;
        const squads = squad.split(',').map(s => s.trim().toLowerCase());
        return squads.includes('first team') || squads.includes('firstteam');
    };

    const eligiblePlayers = players
        .filter(p => {
            // Show player if they have a recorded attendance status for this session (prevents trialists/other squads from being hidden)
            const hasRecord = session.attendance.some(a => a.playerId === p.id);
            if (hasRecord) return true;

            const matchesSquad = isFirstTeamSession 
                ? (isFirstTeam(p.squad) || p.isInTrainingSquad)
                : checkSquadMatch(p.squad, session.squad);
            return matchesSquad && !isPlayerOnHolidayOnDate(p, session.date);
        })
        .sort((a, b) => (positionOrder[a.position] || 99) - (positionOrder[b.position] || 99));

    const presentCount = session.attendance.filter(a => a.status === 'Present').length;
    const absentCount = session.attendance.filter(a => a.status === 'Absent').length;
    const injuredCount = session.attendance.filter(a => a.status === 'Injured').length;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/training"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-slate-900">Manage Session</h1>
                </div>
                {unsavedChanges && (
                    <Badge variant="destructive" className="animate-pulse">Unsaved Changes</Badge>
                )}
            </div>

            {/* Session Details */}
            <Card className="w-full border-l-4 border-l-red-600 shadow-sm">
                <CardHeader className="pb-2">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                        <div>
                            <Badge className="w-fit mb-2" variant="outline">
                                {formatSquad(session.squad as string)} Squad
                            </Badge>
                            <CardTitle className="text-xl">{session.topic || "General Session"}</CardTitle>
                            <CardDescription>Session Details</CardDescription>
                        </div>
                        <div className="flex gap-3">
                            <div className="text-center px-4 py-2 bg-green-50 rounded-lg border border-green-100 min-w-[80px]">
                                <p className="text-2xl font-bold text-green-700 leading-none">{presentCount}</p>
                                <p className="text-xs text-green-600 font-bold uppercase tracking-wider mt-1">Present</p>
                            </div>
                            <div className="text-center px-4 py-2 bg-slate-100 rounded-lg border border-slate-200 min-w-[80px]">
                                <p className="text-2xl font-bold text-slate-600 leading-none">{absentCount}</p>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mt-1">Absent</p>
                            </div>
                            {injuredCount > 0 && (
                                <div className="text-center px-4 py-2 bg-red-50 rounded-lg border border-red-100 min-w-[80px]">
                                    <p className="text-2xl font-bold text-red-700 leading-none">{injuredCount}</p>
                                    <p className="text-xs text-red-600 font-bold uppercase tracking-wider mt-1">Injured</p>
                                </div>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-x-8 gap-y-2 mt-2">
                        <div className="flex items-center gap-3 text-slate-700">
                            <CalendarDays className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.date}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <Clock className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.time}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-700">
                            <MapPin className="h-5 w-5 text-red-600" />
                            <span className="font-medium">{session.location}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Secure Check-in Link Card */}
            <Card className="w-full border-slate-200 bg-slate-50 shadow-sm border-l-4 border-l-emerald-500">
                <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                            <Share2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-900 text-sm">Secure Availability Link</h3>
                            <p className="text-slate-500 text-xs">
                                Share this link in WhatsApp. Session Code: <strong className="text-slate-950 font-bold bg-slate-200 px-1.5 py-0.5 rounded font-mono text-xs">{("CU" + (session.event_token || session.id).replace(/-/g, "").substring(0, 4)).toUpperCase()}</strong>
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button 
                            variant="outline" 
                            size="sm"
                            className="bg-white border-slate-200 flex-1 md:flex-initial"
                            onClick={() => {
                                const link = `${window.location.origin}/respond/${session.event_token || session.id}`;
                                navigator.clipboard.writeText(link);
                                alert("Secure availability link copied to clipboard!");
                            }}
                        >
                            <Link2 className="h-4 w-4 mr-2" /> Copy Link
                        </Button>
                        <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 md:flex-initial"
                            onClick={() => {
                                const link = `${window.location.origin}/respond/${session.event_token || session.id}`;
                                const dateStr = formatFriendlyDate(session.date);
                                const code = ("CU" + (session.event_token || session.id).replace(/-/g, "").substring(0, 4)).toUpperCase();
                                const text = `\u26BD *Camden United Training Invite*\n\ud83d\udcc5 *Date:* ${dateStr}\n\u23F0 *Time:* ${session.time}\n\ud83d\udccd *Location:* ${session.location}\n🔑 *Session Code:* ${code}\n\nPlayers, please log your training availability here:\n\ud83d\udd17 ${link}`;
                                window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, "_blank");
                            }}
                        >
                            <MessageCircle className="h-4 w-4 mr-2" /> Share to WhatsApp
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Attendance Register */}
            <Card className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between border-b bg-slate-50/50 flex-wrap gap-3">
                    <div>
                        <CardTitle>Attendance Register</CardTitle>
                        <CardDescription>
                            Tap a player to mark <strong>Present</strong> (green). Tap again to mark Absent. Use 🚑 for injuries.
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={downloadSessionCSV}>
                            <Download className="h-4 w-4 mr-2" /> Export
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={!unsavedChanges}
                            className={unsavedChanges ? "bg-red-600 hover:bg-red-700" : ""}
                        >
                            {unsavedChanges ? "Save Changes" : "Saved ✓"}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <div className="flex gap-2 mb-4 max-w-sm">
                        <Input 
                            placeholder="Guest Name (e.g. Liam Smith)" 
                            value={guestName} 
                            onChange={e => setGuestName(e.target.value)}
                            className="h-9 text-xs"
                        />
                        <Button onClick={handleAddGuest} size="sm" variant="outline" className="h-9 font-bold">
                            + Add Guest
                        </Button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                        {eligiblePlayers.map((player) => {
                            const record = session.attendance.find(a => a.playerId === player.id);
                            const status = record?.status ?? 'Absent';
                            const isPresent = status === 'Present';
                            const isInjured = status === 'Injured';
                            const hasPin = player.notes?.includes("[PIN:");

                            // Compute percentage
                            const statRecord = attendanceStats[player.id];
                            const attendancePercent = statRecord && statRecord.total > 0 
                                ? Math.round((statRecord.present / statRecord.total) * 100)
                                : null;

                            return (
                                <div
                                    key={player.id}
                                    onClick={() => handleTogglePresent(player.id)}
                                    className={`
                                        relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer
                                        transition-all duration-150 select-none text-center gap-1 min-h-[100px]
                                        ${isPresent
                                            ? 'bg-green-500 border-green-400 shadow-md scale-[1.02]'
                                            : isInjured
                                                ? 'bg-red-50 border-red-300'
                                                : 'bg-white border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                                        }
                                    `}
                                >
                                    {/* Locked PIN Indicator & Reset button */}
                                    {hasPin && (
                                        <button
                                            onClick={(e) => handleResetPlayerPin(player.id, e)}
                                            title="Click to Reset Player Check-in PIN"
                                            className="absolute top-1.5 left-1.5 rounded-full w-5 h-5 bg-slate-100 hover:bg-red-100 text-[10px] flex items-center justify-center transition-colors z-10 text-slate-500 hover:text-red-650"
                                        >
                                            🔒
                                        </button>
                                    )}
                                    {/* Injured toggle */}
                                    <button
                                        onClick={(e) => handleMarkInjured(player.id, e)}
                                        title="Toggle Injured"
                                        className={`absolute top-1.5 right-1.5 rounded-full w-5 h-5 text-[10px] flex items-center justify-center transition-colors z-10
                                            ${isInjured ? 'bg-red-500' : 'bg-slate-100 hover:bg-red-100'}`}
                                    >
                                        🚑
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isPresent ? 'text-green-100' : 'text-slate-400'}`}>
                                            {player.position}
                                        </span>
                                        {attendancePercent !== null && (
                                            <span className={`text-[9px] font-semibold ${isPresent ? 'text-green-200' : 'text-indigo-650'}`}>
                                                ({attendancePercent}%)
                                            </span>
                                        )}
                                    </div>
                                    <span className={`text-sm font-bold leading-tight ${isPresent ? 'text-white' : isInjured ? 'text-red-700' : 'text-slate-800'}`}>
                                        {player.firstName}
                                    </span>
                                    <span className={`text-[11px] leading-tight ${isPresent ? 'text-green-100' : 'text-slate-500'}`}>
                                        {player.lastName}
                                    </span>
                                    <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                        ${isPresent ? 'bg-green-400 text-white' : isInjured ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                        {isPresent ? '✓ Here' : isInjured ? 'Injured' : 'Absent'}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Guest Players */}
                        {session.attendance.filter(a => a.playerId.startsWith('guest:')).map((record) => {
                            const guestNameClean = record.playerId.split(':')[1].split('_')[0];
                            const isPresent = record.status === 'Present';
                            return (
                                <div
                                    key={record.playerId}
                                    onClick={() => handleTogglePresent(record.playerId)}
                                    className={`
                                        relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer
                                        transition-all duration-150 select-none text-center gap-1 min-h-[100px]
                                        ${isPresent
                                            ? 'bg-gradient-to-br from-amber-500 to-yellow-600 border-amber-400 text-white shadow-md scale-[1.02]'
                                            : 'bg-amber-50/30 border-amber-200/50 hover:bg-amber-50/60 hover:border-amber-300 text-slate-800'
                                        }
                                    `}
                                >
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm("Remove guest player?")) {
                                                const updated = session.attendance.filter(a => a.playerId !== record.playerId);
                                                setSession({ ...session, attendance: updated });
                                                setUnsavedChanges(true);
                                            }
                                        }}
                                        title="Remove Guest"
                                        className="absolute top-1.5 right-1.5 rounded-full w-5 h-5 bg-slate-100 hover:bg-red-100 text-[10px] flex items-center justify-center transition-colors z-10 text-slate-500 hover:text-red-650"
                                    >
                                        ✕
                                    </button>
                                    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border
                                        ${isPresent 
                                            ? 'bg-amber-400/30 text-white border-amber-300/40' 
                                            : 'bg-amber-100 text-amber-800 border-amber-200'
                                        }`}
                                    >
                                        Trialist
                                    </span>
                                    <span className={`text-sm font-bold leading-tight mt-1 ${isPresent ? 'text-white' : 'text-slate-800'}`}>
                                        {guestNameClean}
                                    </span>
                                    <div className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full
                                        ${isPresent ? 'bg-amber-400/40 text-white border border-amber-300/30' : 'bg-slate-100 text-slate-400'}`}>
                                        {isPresent ? '✓ Here' : 'Absent'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    {eligiblePlayers.length === 0 && (
                        <div className="text-center py-10 text-slate-500">No players found for this squad.</div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
