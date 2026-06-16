"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Trash2, Plus, ShieldAlert } from "lucide-react";

interface LeagueTeam {
    id: string;
    name: string;
    badge_url: string | null;
}

export default function LeagueSetupPage() {
    const [teams, setTeams] = useState<LeagueTeam[]>([]);
    const [name, setName] = useState("");
    const [badgeUrl, setBadgeUrl] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchTeams();
    }, []);

    const fetchTeams = async () => {
        setIsLoading(true);
        const { data, error } = await supabase
            .from("league_teams")
            .select("*")
            .order("name");
            
        if (!error && data) {
            setTeams(data);
        }
        setIsLoading(false);
    };

    const handleAddTeam = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        const payload = {
            name: name.trim(),
            badge_url: badgeUrl.trim() || null
        };

        const { data, error } = await supabase
            .from("league_teams")
            .insert([payload])
            .select()
            .single();

        if (error) {
            alert("Error adding team: " + error.message);
        } else if (data) {
            setTeams([...teams, data].sort((a, b) => a.name.localeCompare(b.name)));
            setName("");
            setBadgeUrl("");
        }
    };

    const handleDeleteTeam = async (id: string) => {
        if (!confirm("Remove this team from the league?")) return;

        const { error } = await supabase
            .from("league_teams")
            .delete()
            .eq("id", id);

        if (error) {
            alert("Error deleting team.");
        } else {
            setTeams(teams.filter(t => t.id !== id));
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-slate-900">League Constitution</h2>
                <p className="text-slate-500">Manage the teams in your league to enable fixture dropdowns and badges.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle className="text-lg">Add New Team</CardTitle>
                        <CardDescription>Add an opponent to your league</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddTeam} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Team Name *</label>
                                <Input 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="e.g. AFC Richmond"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Badge URL (Optional)</label>
                                <Input 
                                    value={badgeUrl}
                                    onChange={(e) => setBadgeUrl(e.target.value)}
                                    placeholder="https://example.com/badge.png"
                                />
                                <p className="text-xs text-slate-500">Paste an image link for the opponent's badge</p>
                            </div>
                            <Button type="submit" className="w-full bg-slate-900 hover:bg-slate-800">
                                <Plus className="h-4 w-4 mr-2" /> Add Team
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-lg">Current League Teams ({teams.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoading ? (
                            <p className="text-slate-500 text-sm py-4 text-center">Loading teams...</p>
                        ) : teams.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-lg">
                                <ShieldAlert className="h-10 w-10 mb-2 opacity-50" />
                                <p>No teams added yet.</p>
                                <p className="text-sm opacity-70">Add teams to see them in your fixtures dropdown.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {teams.map((team) => (
                                    <div key={team.id} className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm hover:border-slate-300 transition-colors">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            {team.badge_url ? (
                                                <img src={team.badge_url} alt={team.name} className="h-8 w-8 object-contain" />
                                            ) : (
                                                <div className="h-8 w-8 bg-slate-100 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <ShieldAlert className="h-4 w-4 text-slate-400" />
                                                </div>
                                            )}
                                            <span className="font-medium text-slate-700 truncate">{team.name}</span>
                                        </div>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            onClick={() => handleDeleteTeam(team.id)}
                                            className="text-slate-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
