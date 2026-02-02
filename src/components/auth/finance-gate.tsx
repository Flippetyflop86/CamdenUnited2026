"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, UserCheck, Eye, EyeOff, LogIn, Key, RefreshCw, AlertCircle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";

export function FinanceGate({
    children,
    title = "Finance Hub Login",
    description = "Secure access for authorized personnel only"
}: {
    children: React.ReactNode,
    title?: string,
    description?: string
}) {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [currentUser, setCurrentUser] = useState<{ username: string, name: string, role: string } | null>(null);
    const [usersList, setUsersList] = useState<any[]>([]); // For admin panel

    // Login Form State
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    // Password Change State
    const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changeError, setChangeError] = useState("");
    const [changeSuccess, setChangeSuccess] = useState("");

    // Admin Reset State
    const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

    useEffect(() => {
        // Check session storage
        const authValues = sessionStorage.getItem("finance-auth-session");
        if (authValues) {
            const session = JSON.parse(authValues);
            setIsAuthorized(true);
            setCurrentUser(session);
        }
    }, []);

    // Fetch users for Admin Panel
    useEffect(() => {
        if (isAdminPanelOpen && currentUser?.role === 'Super Admin') {
            fetchUsersList();
        }
    }, [isAdminPanelOpen, currentUser]);

    const fetchUsersList = async () => {
        const { data } = await supabase.from('app_users').select('*');
        if (data) setUsersList(data);
    };

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setIsLoading(true);

        const { data, error } = await supabase
            .from('app_users')
            .select('*')
            .eq('username', username.toLowerCase())
            .eq('password', password)
            .single();

        if (data) {
            const sessionData = { username: data.username, name: data.name, role: data.role };
            setIsAuthorized(true);
            setCurrentUser(sessionData);
            sessionStorage.setItem("finance-auth-session", JSON.stringify(sessionData));
        } else {
            setError("Invalid username or password");
        }
        setIsLoading(false);
    };

    const handleLogout = () => {
        setIsAuthorized(false);
        setCurrentUser(null);
        setUsername("");
        setPassword("");
        sessionStorage.removeItem("finance-auth-session");
        setIsChangePasswordOpen(false);
        setIsAdminPanelOpen(false);
    };

    const handleChangePassword = async () => {
        if (!newPassword || newPassword.length < 4) {
            setChangeError("Password must be at least 4 characters");
            return;
        }
        if (newPassword !== confirmPassword) {
            setChangeError("Passwords do not match");
            return;
        }
        if (!currentUser) return;

        // Update user
        const { error } = await supabase
            .from('app_users')
            .update({ password: newPassword })
            .eq('username', currentUser.username);

        if (!error) {
            setChangeSuccess("Password updated successfully!");
            setChangeError("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => {
                setIsChangePasswordOpen(false);
                setChangeSuccess("");
            }, 1500);
        } else {
            setChangeError("Failed to update password");
        }
    };

    const handleAdminReset = async (targetUsername: string) => {
        // Reset to default or simple password
        const newPass = "password123";
        const { error } = await supabase.from('app_users').update({ password: newPass }).eq('username', targetUsername);

        if (!error) {
            alert(`Password for ${targetUsername} has been reset to: ${newPass}`);
            fetchUsersList();
        } else {
            alert("Failed to reset password.");
        }
    };

    if (isAuthorized && currentUser) {
        return (
            <div className="space-y-4">
                <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-lg flex items-center justify-between px-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xs">
                            {currentUser.name.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                {currentUser.name}
                                {currentUser.username === 'admin' && (
                                    <span
                                        onClick={() => setIsAdminPanelOpen(true)}
                                        className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded cursor-pointer hover:bg-red-200"
                                    >
                                        ADMIN PANEL
                                    </span>
                                )}
                            </span>
                            <span className="text-[10px] text-slate-500 uppercase tracking-wide">
                                {currentUser.role}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setIsChangePasswordOpen(true)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors px-3 py-1.5 rounded hover:bg-blue-50"
                        >
                            <Key className="h-3 w-3" />
                            Change Password
                        </button>
                        <div className="h-4 w-px bg-slate-300"></div>
                        <button
                            onClick={handleLogout}
                            className="text-xs font-medium text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors px-3 py-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                            <Lock className="h-3 w-3" />
                            Log Out
                        </button>
                    </div>
                </div>
                {children}

                {/* Change Password Dialog */}
                <Dialog open={isChangePasswordOpen} onOpenChange={setIsChangePasswordOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Change Password</DialogTitle>
                            <DialogDescription>
                                Set a new password for your account.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">New Password</label>
                                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Confirm Password</label>
                                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                            </div>
                            {changeError && (
                                <div className="text-xs text-red-500 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" /> {changeError}
                                </div>
                            )}
                            {changeSuccess && (
                                <div className="text-xs text-green-600 flex items-center gap-1">
                                    <UserCheck className="h-3 w-3" /> {changeSuccess}
                                </div>
                            )}
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsChangePasswordOpen(false)}>Cancel</Button>
                            <Button onClick={handleChangePassword}>Update Password</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Admin Panel Dialog */}
                <Dialog open={isAdminPanelOpen} onOpenChange={setIsAdminPanelOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Admin User Management</DialogTitle>
                            <DialogDescription>Manage user access and reset passwords.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-2">
                            {usersList.map((user) => (
                                <div key={user.username} className="flex items-center justify-between p-2 border rounded">
                                    <div>
                                        <div className="font-medium text-sm">{user.name}</div>
                                        <div className="text-xs text-slate-500">{user.username}</div>
                                    </div>
                                    {user.username !== 'admin' && (
                                        <Button size="sm" variant="destructive" onClick={() => handleAdminReset(user.username)}>
                                            Reset Password
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md shadow-xl border-slate-200 dark:border-slate-800">
                <CardHeader className="text-center pb-2">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white dark:border-slate-950 shadow-sm">
                        <Lock className="h-8 w-8 text-slate-400" />
                    </div>
                    <CardTitle className="text-xl">{title}</CardTitle>
                    <CardDescription>
                        {description}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</label>
                            <Input
                                placeholder="e.g. omar.sufi"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="bg-white text-slate-900 border-slate-300 font-medium placeholder:text-slate-400"
                                autoFocus
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                            </div>
                            <div className="relative">
                                <Input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white text-slate-900 border-slate-300 font-medium padding-right-10 placeholder:text-slate-400"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded bg-red-50 text-red-600 text-xs text-center font-medium animate-in fade-in slide-in-from-top-1">
                                {error}
                            </div>
                        )}

                        <Button
                            type="submit"
                            className="w-full bg-slate-900 hover:bg-slate-800 text-white mt-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    Verifying...
                                </span>
                            ) : (
                                <span className="flex items-center gap-2">
                                    <LogIn className="h-4 w-4" />
                                    Login to Dashboard
                                </span>
                            )}
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 mt-4">
                            Forgot your password? Ask the <span className="font-semibold text-slate-600 cursor-help" title="Contact System Admin">Administrator</span> to reset it.
                        </p>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
