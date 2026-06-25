"use client";

import { useState, useEffect } from "react";
import { useClub } from "@/context/club-context";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Save, Shield, Plus, Trash2, Copy, Check, UserCheck, Users2, KeyRound, Link2 } from "lucide-react";
import { ALL_PAGE_PERMISSIONS, PERMISSION_GROUPS, DEFAULT_GRANTED_PERMISSIONS } from "@/lib/permissions";
import { DataExport } from "@/components/admin/data-export";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { Textarea } from "@/components/ui/textarea";

export default function AdminPage() {
    const { settings, updateSettings } = useClub();
    
    // Identity
    const [name, setName] = useState(settings.name);
    const [logo, setLogo] = useState<string | null>(settings.logo);
    const [squads, setSquads] = useState<string[]>(settings.squads || []);
    const [homeGround, setHomeGround] = useState(settings.homeGround || "");
    const [foundingYear, setFoundingYear] = useState(settings.foundingYear?.toString() || "");
    const [twitterUrl, setTwitterUrl] = useState(settings.twitterUrl || "");
    const [instagramUrl, setInstagramUrl] = useState(settings.instagramUrl || "");

    // Colors & Kits
    const [primaryColor, setPrimaryColor] = useState(settings.primaryColor);
    const [homeKitShirt, setHomeKitShirt] = useState(settings.homeKitShirt);
    const [homeKitShorts, setHomeKitShorts] = useState(settings.homeKitShorts);
    const [homeKitSocks, setHomeKitSocks] = useState(settings.homeKitSocks);
    const [awayKitShirt, setAwayKitShirt] = useState(settings.awayKitShirt);
    const [awayKitShorts, setAwayKitShorts] = useState(settings.awayKitShorts);
    const [awayKitSocks, setAwayKitSocks] = useState(settings.awayKitSocks);

    // League
    const [leagueUrl, setLeagueUrl] = useState(settings.leagueUrl || "");
    const [leaguePosition, setLeaguePosition] = useState(settings.leaguePosition?.toString() || "");

    // Finance & Sponsors
    const [monthlySubs, setMonthlySubs] = useState(settings.monthlySubs?.toString() || "0");
    const [subsEnabled, setSubsEnabled] = useState(settings.subsEnabled !== undefined ? settings.subsEnabled : true);
    const [contractsEnabled, setContractsEnabled] = useState(settings.contractsEnabled !== undefined ? settings.contractsEnabled : false);
    const [finesEnabled, setFinesEnabled] = useState(settings.finesEnabled);
    const [fineCategories, setFineCategories] = useState<{name: string, amount: number}[]>(settings.fineCategories || []);
    const [sponsorLogo, setSponsorLogo] = useState<string | null>(settings.sponsorLogo);

    // Notifications
    const [notificationsEnabled, setNotificationsEnabled] = useState(settings.notificationsEnabled || false);
    const [notificationEmail, setNotificationEmail] = useState(settings.notificationEmail || "");

    const [isMigrating, setIsMigrating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Poll Generator States
    const [upcomingSessions, setUpcomingSessions] = useState<any[]>([]);
    const [upcomingMatches, setUpcomingMatches] = useState<any[]>([]);
    const [pollType, setPollType] = useState<"training" | "match">("training");
    const [selectedEventId, setSelectedEventId] = useState<string>("");
    const [trainingDeadline, setTrainingDeadline] = useState("10:00 PM the evening before training");
    const [meetupOffset, setMeetupOffset] = useState("1 hour");
    const [copiedPoll, setCopiedPoll] = useState(false);

    const { user, role: userRole, isManager, pagePermissions, refreshPermissions, clubId } = useAuth();
    const [managerName, setManagerName] = useState("");
    const [teamMembers, setTeamMembers] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    // Invite form state
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteDisplayName, setInviteDisplayName] = useState("");
    const [inviteRole, setInviteRole] = useState("staff");
    const [invitePermissions, setInvitePermissions] = useState<string[]>(DEFAULT_GRANTED_PERMISSIONS);
    const [isInviting, setIsInviting] = useState(false);
    const [generatedLink, setGeneratedLink] = useState("");
    const [copiedLink, setCopiedLink] = useState(false);
    // Member permissions editing
    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editingPermissions, setEditingPermissions] = useState<string[]>([]);
    const [isSavingPerms, setIsSavingPerms] = useState(false);

    const fetchEvents = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const { data: sessions } = await supabase
                .from('training_sessions')
                .select('*')
                .gte('date', today)
                .order('date', { ascending: true })
                .limit(10);
            if (sessions) setUpcomingSessions(sessions);

            const { data: matchesData } = await supabase
                .from('matches')
                .select('*')
                .gte('date', today)
                .order('date', { ascending: true })
                .limit(10);
            if (matchesData) setUpcomingMatches(matchesData);
        } catch (err) {
            console.error("Error fetching upcoming events for poll generator:", err);
        }
    };

    useEffect(() => {
        if (pollType === "training" && upcomingSessions.length > 0) {
            setSelectedEventId(upcomingSessions[0].id);
        } else if (pollType === "match" && upcomingMatches.length > 0) {
            setSelectedEventId(upcomingMatches[0].id);
        }
    }, [pollType, upcomingSessions, upcomingMatches]);

    useEffect(() => {
        if (user?.user_metadata?.full_name) {
            setManagerName(user.user_metadata.full_name);
        }
    }, [user]);

    useEffect(() => {
        if (settings.isOnboarded) {
            fetchTeamAccess();
            fetchEvents();
        }
    }, [settings]);

    useEffect(() => {
        if (settings) {
            setName(settings.name);
            setLogo(settings.logo);
            setSquads(settings.squads || []);
            setHomeGround(settings.homeGround || "");
            setFoundingYear(settings.foundingYear?.toString() || "");
            setTwitterUrl(settings.twitterUrl || "");
            setInstagramUrl(settings.instagramUrl || "");
            setPrimaryColor(settings.primaryColor);
            setHomeKitShirt(settings.homeKitShirt);
            setHomeKitShorts(settings.homeKitShorts);
            setHomeKitSocks(settings.homeKitSocks);
            setAwayKitShirt(settings.awayKitShirt);
            setAwayKitShorts(settings.awayKitShorts);
            setAwayKitSocks(settings.awayKitSocks);
            setLeagueUrl(settings.leagueUrl || "");
            setLeaguePosition(settings.leaguePosition?.toString() || "");
            setMonthlySubs(settings.monthlySubs?.toString() || "0");
            setSubsEnabled(settings.subsEnabled !== undefined ? settings.subsEnabled : true);
            setContractsEnabled(settings.contractsEnabled !== undefined ? settings.contractsEnabled : false);
            setFinesEnabled(settings.finesEnabled);
            setFineCategories(settings.fineCategories || []);
            setSponsorLogo(settings.sponsorLogo);
            setNotificationsEnabled(settings.notificationsEnabled || false);
            setNotificationEmail(settings.notificationEmail || "");
        }
    }, [settings]);

    const fetchTeamAccess = async () => {
        try {
            const { data: members } = await supabase.from('club_members').select('*');
            if (members) setTeamMembers(members);
            const { data: invites } = await supabase.from('club_invitations').select('*').is('accepted_at', null);
            if (invites) setInvitations(invites);
        } catch (err) {
            console.error("Error fetching team access:", err);
        }
    };

    const toggleInvitePermission = (key: string) => {
        setInvitePermissions(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSendInvite = async () => {
        if (!inviteEmail.trim()) return;
        setIsInviting(true);
        setGeneratedLink("");
        try {
            const { data: currentMember } = await supabase
                .from('club_members').select('club_id').eq('user_id', user?.id).single();
            if (!currentMember) { alert("Could not find your club."); setIsInviting(false); return; }

            // Generate a unique token
            const token = crypto.randomUUID();

            const { error } = await supabase.from('club_invitations').insert([{
                club_id: currentMember.club_id,
                email: inviteEmail.trim().toLowerCase(),
                display_name: inviteDisplayName.trim() || null,
                role: inviteRole,
                page_permissions: inviteRole === 'manager' ? [] : invitePermissions,
                token,
            }]);
            if (error) throw error;

            // Build the invite link
            const link = `${window.location.origin}/join?token=${token}`;
            setGeneratedLink(link);
            setInviteEmail("");
            setInviteDisplayName("");
            setInvitePermissions(DEFAULT_GRANTED_PERMISSIONS);
            await fetchTeamAccess();
        } catch (err: any) {
            alert("Failed to create invite: " + (err.message || JSON.stringify(err)));
        } finally {
            setIsInviting(false);
        }
    };

    const handleCopyLink = async () => {
        if (!generatedLink) return;
        await navigator.clipboard.writeText(generatedLink);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
    };

    const handleDeleteInvite = async (id: string) => {
        if (!confirm("Cancel this invitation?")) return;
        try {
            const { error } = await supabase.from('club_invitations').delete().eq('id', id);
            if (error) throw error;
            await fetchTeamAccess();
        } catch (err: any) {
            alert("Failed to delete invitation: " + err.message);
        }
    };

    const startEditingMember = (member: any) => {
        setEditingMemberId(member.user_id);
        setEditingPermissions(member.page_permissions || []);
    };

    const toggleEditPermission = (key: string) => {
        setEditingPermissions(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSavePermissions = async (userId: string) => {
        setIsSavingPerms(true);
        try {
            const { error } = await supabase
                .from('club_members')
                .update({ page_permissions: editingPermissions })
                .eq('user_id', userId);
            if (error) throw error;
            await fetchTeamAccess();
            // If we just edited our own perms, refresh context
            if (userId === user?.id) await refreshPermissions();
            setEditingMemberId(null);
        } catch (err: any) {
            alert("Failed to save: " + err.message);
        } finally {
            setIsSavingPerms(false);
        }
    };
    
    const handleDeleteMember = async (memberUserId: string, memberName: string) => {
        if (!confirm(`Are you sure you want to remove ${memberName || "this member"} from the club? This will revoke all their access.`)) return;
        try {
            const { error } = await supabase
                .from('club_members')
                .delete()
                .eq('user_id', memberUserId);
            if (error) throw error;
            await fetchTeamAccess();
        } catch (err: any) {
            alert("Failed to delete member: " + err.message);
        }
    };
    const generatePollMessage = () => {
        if (pollType === "training") {
            const session = upcomingSessions.find(s => s.id === selectedEventId);
            if (!session) return "No upcoming training sessions scheduled. Go to Training tab to create one.";
            
            const formatDate = (dateStr: string) => {
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
                return new Date(dateStr).toLocaleDateString('en-US', options);
            };
            
            return `🏋️‍♂️ ${settings.name || "Club"} Training Availability Poll\n📅 Date: ${formatDate(session.date)}\n⏰ Time: ${session.time}\n📍 Venue: ${session.location}${session.topic ? `\n⚽ Focus: ${session.topic}` : ''}\n\nPlease vote on your availability:\n1️⃣ Available (Ready to train)\n2️⃣ Not Available\n3️⃣ 50/50 (Will let me know by ${trainingDeadline})`;
        } else {
            const match = upcomingMatches.find(m => m.id === selectedEventId);
            if (!match) return "No upcoming matches scheduled. Go to Matches tab to create one.";
            
            const formatDate = (dateStr: string) => {
                const options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'short', day: 'numeric' };
                return new Date(dateStr).toLocaleDateString('en-US', options);
            };
            
            return `⚽ ${settings.name || "Club"} Matchday Squad Availability Poll\n🆚 Opponent: ${match.opponent} (${match.is_home ? 'Home' : 'Away'})\n📅 Date: ${formatDate(match.date)}\n⏰ Kick-Off: ${match.time || 'TBC'} (Meeting ${meetupOffset} before kickoff)\n${match.competition ? `🏆 Competition: ${match.competition}\n` : ''}\nPlease vote on your availability:\n1️⃣ Available (Selected & ready to play)\n2️⃣ Not Available\n3️⃣ Injured / Doubtful (Will update manager)`;
        }
    };

    const handleCopyPoll = async () => {
        const text = generatePollMessage();
        if (!text || text.startsWith("No upcoming") || text.startsWith("Select")) return;
        await navigator.clipboard.writeText(text);
        setCopiedPoll(true);
        setTimeout(() => setCopiedPoll(false), 2000);
    };

    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [sponsorFile, setSponsorFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setPreview: (v: string) => void, setFile: (f: File) => void) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                alert("File is too large. Maximum size allowed is 2MB.");
                return;
            }
            const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
            if (!allowedTypes.includes(file.type)) {
                alert("Invalid file type. Only JPEG, PNG, WEBP, GIF, and SVG images are allowed.");
                return;
            }
            setFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadFileIfAny = async (file: File | null, existingUrl: string | null, bucket: string) => {
        if (!file) return existingUrl;
        
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${Math.random()}.${fileExt}`;
            const filePath = clubId ? `${clubId}/${fileName}` : fileName;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, file, { upsert: true });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);
                
            return publicUrl;
        } catch (error) {
            console.error(`Error uploading to ${bucket}:`, error);
            return existingUrl;
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const finalLogo = await uploadFileIfAny(logoFile, logo, 'club_logos');
            const finalSponsor = await uploadFileIfAny(sponsorFile, sponsorLogo, 'club_logos');

            if (managerName.trim()) {
                const { error: userUpdateErr } = await supabase.auth.updateUser({
                    data: { full_name: managerName }
                });
                if (userUpdateErr) console.warn("Failed to update manager name:", userUpdateErr);
            }

            await updateSettings({ 
                name, 
                logo: finalLogo,
                primaryColor,
                squads,
                homeGround,
                foundingYear: foundingYear ? parseInt(foundingYear) : null,
                twitterUrl,
                instagramUrl,
                homeKitShirt,
                homeKitShorts,
                homeKitSocks,
                awayKitShirt,
                awayKitShorts,
                awayKitSocks,
                leagueUrl,
                leaguePosition: leaguePosition ? parseInt(leaguePosition) : null,
                monthlySubs: parseFloat(monthlySubs) || 0,
                subsEnabled,
                contractsEnabled,
                finesEnabled,
                fineCategories,
                notificationsEnabled,
                notificationEmail,
                sponsorLogo: finalSponsor
            });
            alert("Settings saved successfully!");
        } catch (error) {
            console.error(error);
            alert("Failed to save settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleMigrate = async () => {
        if (!confirm("This will overwrite Supabase data with your Seed Data. Continue?")) return;

        setIsMigrating(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token || "";

            const res = await fetch("/api/seed", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (res.ok) {
                alert(`Migration Success!\nPlayers: ${data.results.players}\nMatches: ${data.results.matches}`);
            } else {
                alert(`Migration Failed: ${data.error}`);
            }
        } catch (err: any) {
            alert("Error migrating: " + err.message);
        } finally {
            setIsMigrating(false);
        }
    };

    const handleImportCsv = async () => {
        if (!csvFile) return alert("Please select a CSV file first.");
        setIsImporting(true);
        try {
            const Papa = (await import('papaparse')).default;
            Papa.parse(csvFile, {
                header: true,
                skipEmptyLines: true,
                complete: async (results) => {
                    if (results.errors.length > 0) {
                        alert("Error parsing CSV: " + results.errors[0].message);
                        setIsImporting(false);
                        return;
                    }
                    
                    const players = results.data.map((row: any) => ({
                        first_name: row.first_name || row.firstName || row.Name?.split(' ')[0] || 'Unknown',
                        last_name: row.last_name || row.lastName || row.Name?.split(' ').slice(1).join(' ') || 'Player',
                        position: row.position || row.Position || 'GK',
                        squad: row.squad || row.Squad || (squads.length > 0 ? squads[0] : 'First Team'),
                        age: parseInt(row.age || row.Age) || null
                    }));

                    const { error } = await supabase.from('players').insert(players);
                    if (error) throw error;
                    
                    alert(`Successfully imported ${players.length} players!`);
                    setCsvFile(null);
                }
            });
        } catch (err: any) {
            alert("Error importing: " + err.message);
        } finally {
            setIsImporting(false);
        }
    };

    const handleArchiveSeason = async () => {
        if (!confirm(
            "Archive Season & Start Fresh?\n\n" +
            "✅ KEPT: All players, their profiles and match history\n" +
            "🔄 RESET: Contract statuses and training squad assignments\n\n" +
            "Your full squad remains intact — you can re-contract returning players for the new season. Proceed?"
        )) return;
        setIsArchiving(true);
        try {
            // Reset contract/training status only — players themselves are NOT deleted
            const { error } = await supabase.from('players').update({
                is_contracted: false,
                is_in_training_squad: false,
                contract_amount: null
            }).neq('id', '00000000-0000-0000-0000-000000000000'); // update all
            
            if (error) throw error;
            alert("✅ Season archived!\n\nAll players have been kept. Contract statuses and training squads have been cleared so you can set up the new season. Re-contract returning players from the Squad page.");
        } catch (err: any) {
            alert("Error archiving: " + err.message);
        } finally {
            setIsArchiving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Admin Settings</h2>
                    <p className="text-slate-500">Manage club details, kits, and financial configurations.</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving} className="bg-slate-900 hover:bg-slate-800 h-10 px-6">
                    <Save className="mr-2 h-4 w-4" />
                    {isSaving ? "Saving..." : "Save Changes"}
                </Button>
            </div>

            <Tabs key={isManager ? "manager" : "admin"} defaultValue={isManager ? "identity" : "access"} className="w-full">
                <TabsList className="flex w-full max-w-5xl overflow-x-auto whitespace-nowrap gap-1 md:grid md:grid-cols-8 md:gap-0 bg-slate-100 p-1 rounded-lg scrollbar-none">
                    {isManager && (
                        <>
                            <TabsTrigger value="identity" className="flex-shrink-0 px-4 py-2">Identity</TabsTrigger>
                            <TabsTrigger value="squads" className="flex-shrink-0 px-4 py-2">Squads</TabsTrigger>
                            <TabsTrigger value="kits" className="flex-shrink-0 px-4 py-2">Kits</TabsTrigger>
                            <TabsTrigger value="polls" className="flex-shrink-0 px-4 py-2">Poll Generator</TabsTrigger>
                            <TabsTrigger value="finance" className="flex-shrink-0 px-4 py-2">Finance</TabsTrigger>
                            <TabsTrigger value="staff" className="flex-shrink-0 px-4 py-2">Staff</TabsTrigger>
                        </>
                    )}
                    <TabsTrigger value="access" className="flex-shrink-0 px-4 py-2">Access</TabsTrigger>
                    {isManager && <TabsTrigger value="advanced" className="flex-shrink-0 px-4 py-2">Advanced</TabsTrigger>}
                </TabsList>

                {/* IDENTITY TAB */}
                {isManager && (
                    <>
                        <TabsContent value="identity" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Club Identity</CardTitle>
                            <CardDescription>
                                Customize how your club appears across the platform.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="clubName">Club Name</Label>
                                <Input
                                    id="clubName"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. Camden United FC"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="managerName">Manager Name</Label>
                                <Input
                                    id="managerName"
                                    value={managerName}
                                    onChange={(e) => setManagerName(e.target.value)}
                                    placeholder="e.g. Ted Lasso"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Club Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="h-24 w-24 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                        {logo ? (
                                            <img src={logo} alt="Preview" className="h-full w-full object-contain" />
                                        ) : (
                                            <span className="text-slate-400 text-xs text-center p-2">No Logo</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor="logo-upload" className="cursor-pointer">
                                            <div className="flex w-fit items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium text-slate-700">
                                                <Upload className="h-4 w-4" />
                                                Upload Logo
                                            </div>
                                            <input
                                                id="logo-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, setLogo, setLogoFile)}
                                            />
                                        </Label>
                                        <p className="text-xs text-slate-500 mt-2">Recommended format: PNG. Max 2MB.</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label>League Full-Time Link</Label>
                                <Input
                                    value={leagueUrl}
                                    onChange={(e) => setLeagueUrl(e.target.value)}
                                    placeholder="https://fulltime.thefa.com/..."
                                />
                                <p className="text-xs text-slate-500 mt-1">If available, paste the FA Full-Time link for live table syncing.</p>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700">Details & History</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Home Ground</Label>
                                        <Input value={homeGround} onChange={e => setHomeGround(e.target.value)} placeholder="e.g. Highbury" className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Founding Year</Label>
                                        <Input type="number" value={foundingYear} onChange={e => setFoundingYear(e.target.value)} placeholder="e.g. 1886" className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Twitter (X)</Label>
                                        <Input value={twitterUrl} onChange={e => setTwitterUrl(e.target.value)} placeholder="https://twitter.com/..." className="text-sm" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Instagram</Label>
                                        <Input value={instagramUrl} onChange={e => setInstagramUrl(e.target.value)} placeholder="https://instagram.com/..." className="text-sm" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* SQUADS TAB */}
                <TabsContent value="squads" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Squads Setup</CardTitle>
                            <CardDescription>
                                Define the squads for your club. These will be available when assigning players.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {squads.map((squad, index) => (
                                <div key={index} className="flex gap-2">
                                    <Input
                                        value={squad}
                                        onChange={(e) => {
                                            const newSquads = [...squads];
                                            newSquads[index] = e.target.value;
                                            setSquads(newSquads);
                                        }}
                                        placeholder="Squad Name"
                                    />
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        onClick={() => {
                                            setSquads(squads.filter((_, i) => i !== index));
                                        }}
                                    >
                                        <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={() => setSquads([...squads, "New Squad"])}
                            >
                                <Plus className="w-4 h-4 mr-2" /> Add Squad
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* KITS TAB */}
                <TabsContent value="kits" className="space-y-6 mt-6">
                    <Card className="max-w-4xl">
                        <CardHeader>
                            <CardTitle>Kit Colors</CardTitle>
                            <CardDescription>
                                Set the exact colors for your home and away kits for line-up graphics.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                                {/* Pickers Column */}
                                <div className="md:col-span-8 space-y-6">
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-slate-400" />
                                            Home Kit
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Shirt</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={homeKitShirt} onChange={e => setHomeKitShirt(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={homeKitShirt} onChange={e => setHomeKitShirt(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Shorts</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={homeKitShorts} onChange={e => setHomeKitShorts(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={homeKitShorts} onChange={e => setHomeKitShorts(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Socks</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={homeKitSocks} onChange={e => setHomeKitSocks(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={homeKitSocks} onChange={e => setHomeKitSocks(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <h4 className="font-semibold text-slate-700 flex items-center gap-2">
                                            <Shield className="h-4 w-4 text-slate-400" />
                                            Away Kit
                                        </h4>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Shirt</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={awayKitShirt} onChange={e => setAwayKitShirt(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={awayKitShirt} onChange={e => setAwayKitShirt(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Shorts</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={awayKitShorts} onChange={e => setAwayKitShorts(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={awayKitShorts} onChange={e => setAwayKitShorts(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Socks</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={awayKitSocks} onChange={e => setAwayKitSocks(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={awayKitSocks} onChange={e => setAwayKitSocks(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-slate-100">
                                        <h4 className="font-semibold text-slate-700">Club Color</h4>
                                        <div className="grid grid-cols-1 gap-4">
                                            <div className="space-y-2">
                                                <Label className="text-xs">Primary Club Colour</Label>
                                                <div className="flex gap-2">
                                                    <input type="color" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded border border-slate-200" />
                                                    <Input value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} className="font-mono text-xs" />
                                                </div>
                                                <p className="text-xs text-slate-500">Automatically becomes the app accent color across ClubFlow. Secondary shades are generated internally.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Preview Column */}
                                <div className="md:col-span-4 flex flex-col justify-center gap-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-100 shrink-0">
                                    <h4 className="font-bold text-[10px] uppercase tracking-wider text-slate-500 text-center">Live Preview</h4>
                                    <div className="space-y-4">
                                        <KitPreview shirt={homeKitShirt} shorts={homeKitShorts} socks={homeKitSocks} label="Home Kit" />
                                        <KitPreview shirt={awayKitShirt} shorts={awayKitShorts} socks={awayKitSocks} label="Away Kit" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* POLL GENERATOR TAB */}
                {isManager && (
                    <TabsContent value="polls" className="space-y-6 mt-6">
                        <Card className="max-w-2xl">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Link2 className="h-5 w-5 text-indigo-500" /> WhatsApp Poll Generator
                                </CardTitle>
                                <CardDescription>
                                    Generate copy-pasteable messages for training and matchday availability.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-sm font-semibold">Select Poll Type</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={pollType === "training" ? "default" : "outline"}
                                                onClick={() => setPollType("training")}
                                                className={`flex-1 ${pollType === "training" ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                                            >
                                                Training Poll
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={pollType === "match" ? "default" : "outline"}
                                                onClick={() => setPollType("match")}
                                                className={`flex-1 ${pollType === "match" ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                                            >
                                                Matchday Poll
                                            </Button>
                                        </div>
                                    </div>

                                    {pollType === "training" ? (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="sessionSelect">Select Scheduled Session</Label>
                                                <select
                                                    id="sessionSelect"
                                                    value={selectedEventId}
                                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    {upcomingSessions.length === 0 ? (
                                                        <option value="" disabled>No upcoming sessions found</option>
                                                    ) : (
                                                        upcomingSessions.map(s => (
                                                            <option key={s.id} value={s.id}>{s.date} - {s.time} ({s.location})</option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="deadlineInput">Availability Confirmation Deadline</Label>
                                                <Input
                                                    id="deadlineInput"
                                                    value={trainingDeadline}
                                                    onChange={(e) => setTrainingDeadline(e.target.value)}
                                                    placeholder="e.g. 10:00 PM the evening before training"
                                                    className="h-10 text-sm"
                                                />
                                                <p className="text-[11px] text-slate-500">This will be printed inside the generated 50/50 option.</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="matchSelect">Select Scheduled Match</Label>
                                                <select
                                                    id="matchSelect"
                                                    value={selectedEventId}
                                                    onChange={(e) => setSelectedEventId(e.target.value)}
                                                    className="w-full bg-white border border-slate-200 rounded-lg h-10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                >
                                                    {upcomingMatches.length === 0 ? (
                                                        <option value="" disabled>No upcoming matches found</option>
                                                    ) : (
                                                        upcomingMatches.map(m => (
                                                            <option key={m.id} value={m.id}>{m.date} vs {m.opponent}</option>
                                                        ))
                                                    )}
                                                </select>
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="meetupInput">Meetup Time Before Kick-Off</Label>
                                                <Input
                                                    id="meetupInput"
                                                    value={meetupOffset}
                                                    onChange={(e) => setMeetupOffset(e.target.value)}
                                                    placeholder="e.g. 1 hour, 45 minutes"
                                                    className="h-10 text-sm"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="space-y-2 pt-4 border-t border-slate-100">
                                        <Label className="text-sm font-semibold flex justify-between items-center">
                                            <span>Message Preview</span>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={handleCopyPoll}
                                                disabled={
                                                    (pollType === "training" && upcomingSessions.length === 0) ||
                                                    (pollType === "match" && upcomingMatches.length === 0)
                                                }
                                                className={`h-8 font-semibold text-xs px-3 gap-1.5 transition-all ${
                                                    copiedPoll 
                                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                                                }`}
                                            >
                                                {copiedPoll ? (
                                                    <>
                                                        <Check className="h-3.5 w-3.5" /> Copied!
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3.5 w-3.5" /> Copy Poll
                                                    </>
                                                )}
                                            </Button>
                                        </Label>
                                        <Textarea
                                            value={generatePollMessage()}
                                            readOnly
                                            className="h-44 font-sans text-xs bg-slate-50/50 text-slate-700 p-3 rounded-lg border border-slate-200 resize-none select-all"
                                        />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}

                {/* FINANCE TAB */}
                <TabsContent value="finance" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Financial Settings</CardTitle>
                            <CardDescription>
                                Set baselines for player subscriptions and sponsorship integrations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label>Player Subscriptions</Label>
                                            <p className="text-xs text-slate-500">Do players pay monthly or session fees?</p>
                                        </div>
                                        <Switch
                                            checked={subsEnabled}
                                            onCheckedChange={setSubsEnabled}
                                        />
                                    </div>

                                    {subsEnabled && (
                                        <div className="space-y-2 p-3 border border-indigo-100/50 rounded-xl bg-indigo-50/10">
                                            <Label>Monthly Subs Baseline (£)</Label>
                                            <Input
                                                type="number"
                                                value={monthlySubs}
                                                onChange={(e) => setMonthlySubs(e.target.value)}
                                                placeholder="35"
                                            />
                                            <p className="text-xs text-slate-500">Default tracking amount.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label>Player Contracts</Label>
                                            <p className="text-xs text-slate-500">Does the club pay player wages?</p>
                                        </div>
                                        <Switch
                                            checked={contractsEnabled}
                                            onCheckedChange={setContractsEnabled}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/50">
                                        <div className="space-y-0.5">
                                            <Label>Fine System</Label>
                                            <p className="text-xs text-slate-500">Track and manage squad fines.</p>
                                        </div>
                                        <Switch
                                            checked={finesEnabled}
                                            onCheckedChange={setFinesEnabled}
                                        />
                                    </div>
                                </div>
                            </div>

                            {finesEnabled && (
                                <div className="space-y-4 pt-4 border-t border-slate-100">
                                    <h4 className="font-semibold text-slate-700 text-sm">Fine Categories</h4>
                                    <div className="space-y-2">
                                        {fineCategories.map((cat, idx) => (
                                            <div key={idx} className="flex gap-2">
                                                <Input value={cat.name} onChange={e => {
                                                    const newCats = [...fineCategories];
                                                    newCats[idx].name = e.target.value;
                                                    setFineCategories(newCats);
                                                }} placeholder="e.g. Yellow Card" className="text-sm flex-1" />
                                                <Input type="number" value={cat.amount} onChange={e => {
                                                    const newCats = [...fineCategories];
                                                    newCats[idx].amount = parseFloat(e.target.value);
                                                    setFineCategories(newCats);
                                                }} placeholder="£" className="text-sm w-24" />
                                                <Button variant="outline" size="icon" onClick={() => {
                                                    setFineCategories(fineCategories.filter((_, i) => i !== idx));
                                                }}>
                                                    <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button variant="outline" className="w-full border-dashed text-xs" onClick={() => setFineCategories([...fineCategories, { name: "New Fine", amount: 0 }])}>
                                            <Plus className="w-4 h-4 mr-2" /> Add Category
                                        </Button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4 pt-4 border-t border-slate-100">
                                <h4 className="font-semibold text-slate-700 text-sm">Automated Notifications</h4>
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded border">
                                    <div>
                                        <p className="text-sm font-medium">Enable Email Reminders</p>
                                        <p className="text-xs text-slate-500">Send notifications for matches, subs, and fines.</p>
                                    </div>
                                    <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
                                </div>
                                {notificationsEnabled && (
                                    <div className="space-y-2">
                                        <Label className="text-xs">Notification Email</Label>
                                        <Input value={notificationEmail} onChange={e => setNotificationEmail(e.target.value)} placeholder="hello@club.com" className="text-sm" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 pt-4 border-t border-slate-100">
                                <Label>Main Sponsor Logo</Label>
                                <div className="flex items-center gap-4">
                                    <div className="h-20 w-32 rounded border-2 border-dashed border-slate-300 flex items-center justify-center bg-slate-50 overflow-hidden relative">
                                        {sponsorLogo ? (
                                            <img src={sponsorLogo} alt="Sponsor Preview" className="h-full w-full object-contain p-2" />
                                        ) : (
                                            <span className="text-slate-400 text-xs text-center p-2">No Sponsor</span>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <Label htmlFor="sponsor-upload" className="cursor-pointer">
                                            <div className="flex w-fit items-center gap-2 px-4 py-2 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors shadow-sm text-sm font-medium text-slate-700">
                                                <Upload className="h-4 w-4" />
                                                Upload Sponsor
                                            </div>
                                            <input
                                                id="sponsor-upload"
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleFileUpload(e, setSponsorLogo, setSponsorFile)}
                                            />
                                        </Label>
                                        <p className="text-xs text-slate-500 mt-2">Appears on matchday graphics.</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* STAFF TAB */}
                <TabsContent value="staff" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Staff & Committee Management</CardTitle>
                            <CardDescription>
                                Add or remove coaching staff and committee members.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-slate-500 mb-4">
                                Head over to the dedicated Staff page to view and edit your committee members, coaches, and physios.
                            </p>
                            <Button variant="outline" onClick={() => window.location.href = '/staff'}>
                                Go to Staff Page
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
                    </>
                )}

                {/* ACCESS TAB */}
                <TabsContent value="access" className="space-y-6 mt-6">

                    {/* --- INFO BANNER --- */}
                    <div className="max-w-3xl rounded-xl bg-slate-800 border border-slate-600 p-4 flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                            <KeyRound className="h-4 w-4 text-slate-300" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-white mb-1">How access works</p>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                Invite staff below and choose which pages they can see. <strong className="text-white">Sponsorships, Finance, and Player Budgets</strong> are ticked by default on new invites but can be removed. All other pages are off by default. Granting someone the <strong className="text-white">Manager</strong> role gives them full access and the ability to send invite links.
                            </p>
                        </div>
                    </div>

                    {/* --- INVITE NEW STAFF — managers only --- */}
                    {(isManager || pagePermissions.includes("admin")) && (
                    <Card className="max-w-3xl bg-slate-900 border-slate-800 text-white shadow-xl">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-red-600/20 flex items-center justify-center">
                                    <UserCheck className="h-5 w-5 text-red-400" />
                                </div>
                                <div>
                                    <CardTitle className="text-white">Invite Staff Member</CardTitle>
                                    <CardDescription className="text-slate-400">Create an invite link and choose exactly what they can see.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-5">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="inviteEmail" className="text-slate-300 text-sm">Email Address</Label>
                                    <Input id="inviteEmail" type="email" placeholder="coach@example.com" value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus-visible:ring-red-500" />
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="inviteDisplayName" className="text-slate-300 text-sm">Their Name</Label>
                                    <Input id="inviteDisplayName" placeholder="e.g. James Smith" value={inviteDisplayName}
                                        onChange={(e) => setInviteDisplayName(e.target.value)}
                                        className="bg-slate-950 border-slate-700 text-white placeholder-slate-500 focus-visible:ring-red-500" />
                                </div>
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label htmlFor="inviteRole" className="text-slate-300 text-sm">Role</Label>
                                    <select id="inviteRole" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
                                        className="flex h-10 w-full sm:w-64 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-red-500">
                                        <option value="staff">Staff (Custom permissions)</option>
                                        <option value="assistant coach">Assistant Coach</option>
                                        <option value="physio">Physio</option>
                                        <option value="coach">Coach</option>
                                        <option value="manager">Manager (Full Access)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Page permissions grid — only shown for non-manager roles */}
                            {inviteRole !== 'manager' && (
                                <div className="pt-4 border-t border-slate-800">
                                    <p className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                                        <KeyRound className="h-4 w-4 text-slate-400" /> Page Access
                                    </p>
                                    <div className="space-y-4">
                                        {PERMISSION_GROUPS.map(group => (
                                            <div key={group}>
                                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group}</p>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                    {ALL_PAGE_PERMISSIONS.filter(p => p.group === group).map(perm => (
                                                        <div
                                                            key={perm.key}
                                                            role="checkbox"
                                                            aria-checked={invitePermissions.includes(perm.key)}
                                                            tabIndex={0}
                                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleInvitePermission(perm.key); }}
                                                            onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleInvitePermission(perm.key); } }}
                                                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                                                                invitePermissions.includes(perm.key)
                                                                    ? 'border-red-500 bg-red-500/10 text-white'
                                                                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                                            }`}>
                                                            <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                                                invitePermissions.includes(perm.key) ? 'bg-red-600 border-red-600' : 'border-slate-600'
                                                            }`}>
                                                                {invitePermissions.includes(perm.key) && <Check className="h-3 w-3 text-white" />}
                                                            </div>
                                                            <span className="text-xs font-medium">{perm.label}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => setInvitePermissions(inviteRole === 'manager' ? [] : ALL_PAGE_PERMISSIONS.map(p => p.key))}
                                        className="mt-3 text-xs text-red-400 hover:text-red-300 underline">
                                        Select all pages
                                    </button>
                                    {invitePermissions.length > 0 && (
                                        <button type="button" onClick={() => setInvitePermissions([])}
                                            className="mt-3 ml-4 text-xs text-slate-500 hover:text-slate-400 underline">
                                            Clear all
                                        </button>
                                    )}
                                </div>
                            )}

                            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                                <Button onClick={handleSendInvite} disabled={isInviting || !inviteEmail.trim()}
                                    className="bg-red-600 hover:bg-red-500 text-white h-10 px-6">
                                    <Link2 className="h-4 w-4 mr-2" />
                                    {isInviting ? "Generating..." : "Generate Invite Link"}
                                </Button>
                            </div>

                            {/* Generated link box */}
                            {generatedLink && (
                                <div className="rounded-lg bg-green-950/40 border border-green-700/50 p-4">
                                    <p className="text-xs font-semibold text-green-400 mb-2">✅ Invite link created! Share this with the staff member:</p>
                                    <div className="flex gap-2">
                                        <code className="flex-1 text-xs text-green-300 bg-slate-950 rounded px-3 py-2 break-all border border-slate-800">{generatedLink}</code>
                                        <Button size="sm" onClick={handleCopyLink}
                                            className="shrink-0 bg-green-700 hover:bg-green-600 text-white h-auto px-3">
                                            {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">The link expires once used. They'll be asked to set a password when they sign up.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    )}



                    {/* --- ACTIVE MEMBERS --- */}
                    <Card className="max-w-3xl bg-slate-900 border-slate-800 text-white shadow-xl">
                        <CardHeader>
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-slate-700/50 flex items-center justify-center">
                                    <Users2 className="h-5 w-5 text-slate-300" />
                                </div>
                                <div>
                                    <CardTitle className="text-white">Active Members</CardTitle>
                                    <CardDescription className="text-slate-400">Edit page permissions for each staff member.</CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {teamMembers.length === 0 ? (
                                <p className="text-sm text-slate-500 text-center py-4">No members yet. Send an invite above.</p>
                            ) : teamMembers.map((member) => {
                                const isMe = member.user_id === user?.id;
                                const isManagerRole = member.role === 'manager';
                                const isEditing = editingMemberId === member.user_id;
                                return (
                                    <div key={member.user_id} className="rounded-lg border border-slate-800 bg-slate-950 overflow-hidden">
                                        {/* Member header */}
                                        <div className="flex items-center justify-between px-4 py-3 bg-slate-900">
                                            <div className="flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                                    {(member.display_name || member.email || member.role || "?").charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate flex items-center gap-2">
                                                        {member.display_name || member.email || (isMe ? "You" : `Member #${member.user_id.substring(0,6)}`)}
                                                        {isMe && <span className="text-xs text-red-400 font-normal shrink-0">(You)</span>}
                                                    </p>
                                                    {member.display_name && member.email && (
                                                        <p className="text-xs text-slate-400 truncate">{member.email}</p>
                                                    )}
                                                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium capitalize mt-1 ${
                                                        isManagerRole ? 'bg-red-900/40 text-red-400 border border-red-500/20' : 'bg-slate-800 text-slate-300'
                                                    }`}>{member.role}</span>
                                                </div>
                                            </div>
                                            {!isManagerRole && (
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="sm" onClick={() => isEditing ? setEditingMemberId(null) : startEditingMember(member)}
                                                        className="text-slate-400 hover:text-white text-xs">
                                                        {isEditing ? "Cancel" : "Edit Access"}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDeleteMember(member.user_id, member.display_name || member.email)}
                                                        className="text-red-400 hover:text-red-300 hover:bg-red-950/30 text-xs flex items-center gap-1">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                        Remove
                                                    </Button>
                                                </div>
                                            )}
                                            {isManagerRole && (
                                                <span className="text-xs text-slate-500">Full access</span>
                                            )}
                                        </div>

                                        {/* Permission chips (view mode) */}
                                        {!isEditing && !isManagerRole && (
                                            <div className="px-4 py-3">
                                                {(member.page_permissions || []).length === 0 ? (
                                                    <p className="text-xs text-slate-600 italic">No pages assigned — click Edit Access</p>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {(member.page_permissions as string[]).map((key: string) => (
                                                            <span key={key} className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full capitalize">
                                                                {key.replace(/-/g, ' ')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Permissions editor (edit mode) */}
                                        {isEditing && (
                                            <div className="px-4 py-4 border-t border-slate-800 space-y-4">
                                                {PERMISSION_GROUPS.map(group => (
                                                    <div key={group}>
                                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{group}</p>
                                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                                            {ALL_PAGE_PERMISSIONS.filter(p => p.group === group).map(perm => (
                                                                <div
                                                                    key={perm.key}
                                                                    role="checkbox"
                                                                    aria-checked={editingPermissions.includes(perm.key)}
                                                                    tabIndex={0}
                                                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleEditPermission(perm.key); }}
                                                                    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); toggleEditPermission(perm.key); } }}
                                                                    className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all select-none ${
                                                                        editingPermissions.includes(perm.key)
                                                                            ? 'border-red-500 bg-red-500/10 text-white'
                                                                            : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:border-slate-600'
                                                                    }`}>
                                                                    <div className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                                                                        editingPermissions.includes(perm.key) ? 'bg-red-600 border-red-600' : 'border-slate-600'
                                                                    }`}>
                                                                        {editingPermissions.includes(perm.key) && <Check className="h-3 w-3 text-white" />}
                                                                    </div>
                                                                    <span className="text-xs font-medium">{perm.label}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                                <div className="flex gap-3 pt-2">
                                                    <Button size="sm" onClick={() => handleSavePermissions(member.user_id)} disabled={isSavingPerms}
                                                        className="bg-red-600 hover:bg-red-500 text-white">
                                                        {isSavingPerms ? "Saving..." : "Save Permissions"}
                                                    </Button>
                                                    <Button size="sm" variant="ghost" onClick={() => setEditingMemberId(null)}
                                                        className="text-slate-400">
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* --- PENDING INVITATIONS --- */}
                    {invitations.length > 0 && (
                        <Card className="max-w-3xl bg-slate-900 border-slate-800 text-white shadow-xl">
                            <CardHeader>
                                <CardTitle className="text-white">Pending Invitations</CardTitle>
                                <CardDescription className="text-slate-400">These links have been generated but not yet used.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="divide-y divide-slate-800">
                                    {invitations.map((invite) => (
                                        <div key={invite.id} className="flex items-center justify-between py-3">
                                            <div>
                                                <p className="text-sm font-medium text-slate-200">{invite.email}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full capitalize">{invite.role}</span>
                                                    {(invite.page_permissions || []).length > 0 && (
                                                        <span className="text-xs text-slate-500">{invite.page_permissions.length} pages</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {invite.token && (
                                                    <Button variant="ghost" size="sm" onClick={() => {
                                                        const link = `${window.location.origin}/join?token=${invite.token}`;
                                                        navigator.clipboard.writeText(link);
                                                        setCopiedLink(true);
                                                        setTimeout(() => setCopiedLink(false), 2000);
                                                    }} className="text-slate-400 hover:text-white h-8 w-8 p-0">
                                                        <Copy className="h-4 w-4" />
                                                    </Button>
                                                )}
                                                <Button variant="ghost" size="sm" onClick={() => handleDeleteInvite(invite.id)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-950/20 h-8 w-8 p-0">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* ADVANCED TAB */}
                {isManager && (
                    <TabsContent value="advanced" className="space-y-6 mt-6">
                    <Card className="max-w-2xl">
                        <CardHeader>
                            <CardTitle>Data Import & Archiving</CardTitle>
                            <CardDescription>
                                Bulk import players from a CSV file or archive the current season.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-2">
                                <Label>Import Players (CSV)</Label>
                                <div className="flex gap-2">
                                    <Input type="file" accept=".csv" onChange={(e) => setCsvFile(e.target.files?.[0] || null)} className="flex-1" />
                                    <Button onClick={handleImportCsv} disabled={isImporting || !csvFile}>
                                        {isImporting ? "Importing..." : "Import CSV"}
                                    </Button>
                                </div>
                                <p className="text-xs text-slate-500">CSV should have headers like: first_name, last_name, position, squad, age.</p>
                            </div>

                            <div className="pt-4 border-t border-slate-100">
                                <Label className="text-red-600 font-semibold mb-2 block">End of Season Archive</Label>
                                <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1">
                                    <p className="text-xs font-semibold text-amber-800">What gets reset vs kept:</p>
                                    <div className="flex items-center gap-2 text-xs text-green-700">
                                        <span className="text-base">✅</span>
                                        <span><strong>Kept:</strong> All players and their profiles, full match history and stats</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-amber-700">
                                        <span className="text-base">🔄</span>
                                        <span><strong>Reset:</strong> Contract statuses and training squad assignments only</span>
                                    </div>
                                </div>
                                <Button onClick={handleArchiveSeason} disabled={isArchiving} variant="destructive">
                                    {isArchiving ? "Archiving..." : "Archive Season & Start Fresh"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="max-w-2xl border-blue-200 bg-blue-50">
                        <CardHeader>
                            <CardTitle className="text-blue-900">Cloud Migration</CardTitle>
                            <CardDescription className="text-blue-700">
                                Push your seeded local data to Supabase to enable live sync for all users.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button
                                onClick={handleMigrate}
                                disabled={isMigrating}
                                className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                {isMigrating ? "Migrating..." : "Push Data to Cloud"}
                                <Upload className="ml-2 h-4 w-4" />
                            </Button>
                        </CardContent>
                    </Card>

                    <DataExport />
                </TabsContent>
                )}
            </Tabs>
        </div>
    );
}

function KitPreview({ shirt, shorts, socks, label }: { shirt: string; shorts: string; socks: string; label: string }) {
    return (
        <div className="flex flex-col items-center p-4 bg-slate-50 rounded-xl border border-slate-200 w-full relative">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">{label}</span>
            <div className="flex items-end justify-center gap-3 h-24 w-full relative">
                {/* Shirt */}
                <svg className="w-14 h-14 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 30,20 L 70,20 L 85,35 L 75,45 L 68,38 L 68,85 L 32,85 L 32,38 L 25,45 L 15,35 Z" fill={shirt} stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 40,20 Q 50,28 60,20" stroke="#000" strokeWidth="2.5" fill="none" />
                </svg>
                {/* Shorts */}
                <svg className="w-11 h-11 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 20,10 L 80,10 L 85,75 L 53,75 L 50,45 L 47,75 L 15,75 Z" fill={shorts} stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {/* Socks */}
                <svg className="w-6 h-12 drop-shadow-[0_4px_6px_rgba(0,0,0,0.15)]" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 20,10 L 40,10 L 40,75 C 40,82 55,82 55,95 L 15,95 C 15,82 20,82 20,75 Z" fill={socks} stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M 60,10 L 80,10 L 80,75 C 80,82 95,82 95,95 L 55,95 C 55,82 60,82 60,75 Z" fill={socks} stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </div>
            <div className="flex gap-1.5 mt-3">
                <div className="w-3.5 h-3.5 rounded-full border border-slate-400 shadow-inner" style={{ backgroundColor: shirt }} title="Shirt" />
                <div className="w-3.5 h-3.5 rounded-full border border-slate-400 shadow-inner" style={{ backgroundColor: shorts }} title="Shorts" />
                <div className="w-3.5 h-3.5 rounded-full border border-slate-400 shadow-inner" style={{ backgroundColor: socks }} title="Socks" />
            </div>
        </div>
    );
}
