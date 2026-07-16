"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function UpdatePasswordPage() {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        // Optional: Check if we have a session to ensure the user actually came via the reset link
        const checkSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // They might still be loading the session from URL hash, but Supabase usually does it fast
                // We won't strictly enforce here to avoid race conditions, but good for debugging
            }
        };
        checkSession();
    }, []);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("Password must be at least 6 characters.");
            setLoading(false);
            return;
        }

        try {
            const { error } = await supabase.auth.updateUser({
                password: password,
            });

            if (error) {
                throw error;
            }

            setMessage("Your password has been updated successfully. Redirecting to login...");
            
            setTimeout(() => {
                router.push("/login");
            }, 3000);
        } catch (err: any) {
            console.error("Password update error:", err);
            setError(err.message || "Failed to update password. Please request a new recovery link.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                <Card className="border-slate-800 bg-slate-900 shadow-xl">
                    <CardHeader className="space-y-1">
                        <div className="flex justify-center mb-4">
                            <div className="h-12 w-12 bg-red-600 rounded-2xl flex items-center justify-center shadow-lg shadow-red-600/20">
                                <KeyRound className="h-6 w-6 text-white" />
                            </div>
                        </div>
                        <CardTitle className="text-2xl text-center text-white">Update password</CardTitle>
                        <CardDescription className="text-center text-slate-400">
                            Enter your new password below to update your account credentials.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleUpdate}>
                        <CardContent className="space-y-4">
                            {error && (
                                <Alert variant="destructive" className="bg-red-950/50 border-red-900 text-red-400">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}
                            {message && (
                                <Alert className="bg-green-950/50 border-green-900 text-green-400">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertDescription>{message}</AlertDescription>
                                </Alert>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="password" className="text-slate-300">New Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-slate-300">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                    required
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-11" disabled={loading || !!message}>
                                {loading ? "Updating..." : "Update Password"}
                            </Button>
                            <div className="text-sm text-slate-400 text-center">
                                Back to{" "}
                                <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                                    login
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
