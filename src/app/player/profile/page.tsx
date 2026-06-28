"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { User, Phone, ShieldAlert, KeyRound, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";

export default function PlayerProfileSettings() {
    const [playerId, setPlayerId] = useState("");
    const [loading, setLoading] = useState(true);

    // Profile inputs
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [mobile, setMobile] = useState("");
    
    // Emergency Contact
    const [emergencyName, setEmergencyName] = useState("");
    const [emergencyRelationship, setEmergencyRelationship] = useState("");
    const [emergencyPhone, setEmergencyPhone] = useState("");

    // Password change inputs
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    // Preferences
    const [emailNotifications, setEmailNotifications] = useState(true);
    const [smsNotifications, setSmsNotifications] = useState(true);

    // State messages
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) return;

                const { data, error } = await supabase
                    .from("players")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .single();

                if (data) {
                    setPlayerId(data.id);
                    setFirstName(data.first_name || "");
                    setLastName(data.last_name || "");
                    setMobile(data.mobile_number || "");
                    
                    const emergency = data.emergency_contact || {};
                    setEmergencyName(emergency.name || "");
                    setEmergencyRelationship(emergency.relationship || "");
                    setEmergencyPhone(emergency.phone || "");

                    const prefs = data.notification_preferences || { email: true, sms: true };
                    setEmailNotifications(prefs.email !== false);
                    setSmsNotifications(prefs.sms !== false);
                }
            } catch (err) {
                console.error("Failed to load profile:", err);
            } finally {
                setLoading(false);
            }
        }

        fetchProfile();
    }, []);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setSubmitting(true);

        try {
            const { error: updateErr } = await supabase
                .from("players")
                .update({
                    first_name: firstName,
                    last_name: lastName,
                    mobile_number: mobile,
                    emergency_contact: {
                        name: emergencyName,
                        relationship: emergencyRelationship,
                        phone: emergencyPhone
                    },
                    notification_preferences: {
                        email: emailNotifications,
                        sms: smsNotifications
                    }
                })
                .eq("id", playerId);

            if (updateErr) throw updateErr;

            setSuccessMessage("Profile updated successfully!");
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err: any) {
            setError(err.message || "Failed to update profile.");
        } finally {
            setSubmitting(false);
        }
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);

        if (newPassword.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        if (newPassword !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setSubmitting(true);

        try {
            const { error: updateErr } = await supabase.auth.updateUser({
                password: newPassword
            });

            if (updateErr) throw updateErr;

            setSuccessMessage("Password changed successfully!");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setSuccessMessage(null), 3000);

        } catch (err: any) {
            setError(err.message || "Failed to update password.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3 sm:ml-44">
                <RefreshCw className="h-8 w-8 text-red-600 animate-spin" />
                <p className="text-slate-400 text-xs">Loading profile settings...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 sm:ml-44">
            <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Your Profile</h1>
                <p className="text-xs text-slate-400">Update your preferred contact name, emergency information, and change security credentials.</p>
            </div>

            {successMessage && (
                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-center gap-2 text-emerald-400 text-xs font-semibold">
                    <CheckCircle className="h-4.5 w-4.5" />
                    <span>{successMessage}</span>
                </div>
            )}

            {error && (
                <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 flex items-center gap-2 text-red-400 text-xs">
                    <AlertCircle className="h-4.5 w-4.5" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Profile Form */}
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                    <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                        <CardHeader className="py-4 border-b border-slate-800 bg-slate-900/40">
                            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                                <User className="h-4 w-4 text-red-500" /> Personal Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">First Name</label>
                                    <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="text-xs border-slate-800 bg-slate-950 text-white" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Last Name</label>
                                    <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="text-xs border-slate-800 bg-slate-950 text-white" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Mobile Number</label>
                                <Input value={mobile} onChange={e => setMobile(e.target.value)} type="tel" className="text-xs border-slate-800 bg-slate-950 text-white" placeholder="e.g. 07123456789" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                        <CardHeader className="py-4 border-b border-slate-800 bg-slate-900/40">
                            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                                <ShieldAlert className="h-4 w-4 text-red-500" /> Emergency Contact
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Contact Name</label>
                                    <Input value={emergencyName} onChange={e => setEmergencyName(e.target.value)} className="text-xs border-slate-800 bg-slate-950 text-white" placeholder="Full name" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Relationship</label>
                                    <Input value={emergencyRelationship} onChange={e => setEmergencyRelationship(e.target.value)} className="text-xs border-slate-800 bg-slate-950 text-white" placeholder="e.g. Parent, Partner" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Emergency Phone</label>
                                <Input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)} type="tel" className="text-xs border-slate-800 bg-slate-950 text-white" placeholder="Phone number" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                        <CardHeader className="py-4 border-b border-slate-800 bg-slate-900/40">
                            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                                <Phone className="h-4 w-4 text-red-500" /> Notification Preferences
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white">Email Alerts</p>
                                    <p className="text-[10px] text-slate-400">Receive schedule and RSVP invitations via email.</p>
                                </div>
                                <Switch checked={emailNotifications} onCheckedChange={setEmailNotifications} />
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-800 pt-3">
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-white">SMS Alerts</p>
                                    <p className="text-[10px] text-slate-400">Receive match updates and reminders via SMS messages.</p>
                                </div>
                                <Switch checked={smsNotifications} onCheckedChange={setSmsNotifications} />
                            </div>
                        </CardContent>
                    </Card>

                    <Button type="submit" disabled={submitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11">
                        Save Profile Details
                    </Button>
                </form>

                {/* Change Password Form */}
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                    <Card className="border-slate-800 bg-slate-900/60 shadow-lg">
                        <CardHeader className="py-4 border-b border-slate-800 bg-slate-900/40">
                            <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                                <KeyRound className="h-4 w-4 text-red-500" /> Change Account Password
                            </CardTitle>
                            <CardDescription className="text-[10px] text-slate-400">Change your portal login authentication password.</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 space-y-3">
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">New Password</label>
                                <Input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                                <Input
                                    type="password"
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="bg-slate-950 border-slate-800 text-white text-xs h-10"
                                />
                            </div>
                        </CardContent>
                    </Card>
                    <Button type="submit" disabled={submitting} className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold h-11">
                        Change Account Password
                    </Button>
                </form>
            </div>
        </div>
    );
}
