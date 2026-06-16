"use client";

import { useEffect, useState } from "react";
import { useParams, notFound } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Recruit } from "@/types";
import { ArrowLeft, MapPin, Building2, Calendar, UserCheck, Star, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function RecruitProfilePage() {
    const params = useParams();
    const id = params?.id as string;
    const [recruit, setRecruit] = useState<Recruit | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchRecruit = async () => {
            if (!id) return;
            const { data } = await supabase.from('recruits').select('*').eq('id', id).single();
            if (data) {
                setRecruit({
                    id: data.id,
                    name: data.name,
                    primaryPosition: data.primary_position,
                    secondaryPosition: data.secondary_position,
                    age: data.age,
                    location: data.location,
                    status: data.status,
                    currentClub: data.current_club,
                    onTrial: data.on_trial,
                    scoutedRole: data.scouted_role,
                    notes: data.notes,
                    clubConnection: data.club_connection,
                    createdAt: data.created_at,
                    updatedAt: data.updated_at
                } as Recruit);
            }
            setLoading(false);
        };
        fetchRecruit();
    }, [id]);

    if (loading) return <div className="p-8 text-center text-slate-500">Loading profile...</div>;
    if (!recruit) return notFound();

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/recruitment">
                        <ArrowLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <h1 className="text-lg font-medium text-slate-500">Back to Recruitment Hub</h1>
            </div>

            {/* Header Section */}
            <div className="flex flex-col md:flex-row gap-6 items-start bg-white p-6 rounded-lg border shadow-sm">
                <div className="h-32 w-32 shrink-0 rounded-full bg-slate-100 border-4 border-white shadow-lg flex items-center justify-center text-4xl font-bold text-slate-400">
                    {recruit.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 space-y-4 w-full">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <div className="flex items-center gap-3">
                                <h1 className="text-3xl font-bold text-slate-900">{recruit.name}</h1>
                                {recruit.scoutedRole === "Star Player" && <Star className="h-6 w-6 fill-amber-400 text-amber-400" />}
                                {recruit.onTrial && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-700 hover:bg-amber-100 flex gap-1 items-center">
                                        <UserCheck className="h-3 w-3" />
                                        Trialist
                                    </Badge>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-slate-500">
                                <span className="flex items-center gap-1.5 font-bold text-red-600">
                                    {recruit.primaryPosition}
                                    {recruit.secondaryPosition && <span className="text-slate-400 font-normal text-sm"> / {recruit.secondaryPosition}</span>}
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Trophy className="h-4 w-4" /> {recruit.scoutedRole}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Player Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><Calendar className="h-4 w-4" /> Age</p>
                                <p className="mt-1 font-semibold text-slate-900">{recruit.age || "Unknown"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><MapPin className="h-4 w-4" /> Location</p>
                                <p className="mt-1 font-semibold text-slate-900">{recruit.location || "Unknown"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500 flex items-center gap-2"><Building2 className="h-4 w-4" /> Current Club</p>
                                <p className="mt-1 font-semibold text-slate-900">{recruit.currentClub || "None"}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-slate-500">Status</p>
                                <Badge variant={recruit.status === "Unattached" ? "default" : "secondary"} className={recruit.status === "Unattached" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}>
                                    {recruit.status}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Scouting Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500 mb-1">General Notes</p>
                            <div className="bg-slate-50 p-3 rounded-md text-sm text-slate-700 whitespace-pre-wrap min-h-[80px]">
                                {recruit.notes || "No scouting notes recorded yet."}
                            </div>
                        </div>
                        {recruit.clubConnection && (
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">Club Connection</p>
                                <p className="text-sm text-slate-700">{recruit.clubConnection}</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
