"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                // This redirect URL should be updated to point to your actual update-password page
                redirectTo: `${window.location.origin}/update-password`,
            });

            if (error) {
                throw error;
            }

            setMessage("Check your email for the password reset link.");
        } catch (err: any) {
            setError(err.message || "Failed to send reset email.");
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
                        <CardTitle className="text-2xl text-center text-white">Reset password</CardTitle>
                        <CardDescription className="text-center text-slate-400">
                            Enter your email address and we will send you a password reset link.
                        </CardDescription>
                    </CardHeader>
                    <form onSubmit={handleReset}>
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
                                <Label htmlFor="email" className="text-slate-300">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="manager@club.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 focus-visible:ring-red-500"
                                    required
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="flex flex-col space-y-4">
                            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-medium h-11" disabled={loading}>
                                {loading ? "Sending..." : "Send reset link"}
                            </Button>
                            <div className="text-sm text-slate-400 text-center">
                                Remember your password?{" "}
                                <Link href="/login" className="text-red-400 hover:text-red-300 font-medium transition-colors">
                                    Back to login
                                </Link>
                            </div>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
