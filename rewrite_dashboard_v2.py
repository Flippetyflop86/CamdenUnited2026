import os

filepath = r"C:\Users\leon_\OneDrive\Desktop\camdenuniteddatahub\src\app\dashboard\page.tsx"

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

start_idx = content.find("    return (\n        <div className=\"pb-16 bg-background min-h-screen\">")
if start_idx == -1:
    print("Could not find start index")
    exit(1)

new_return_content = '''    return (
        <div className="pb-16 bg-background min-h-screen">
            <PageHeader 
                title="Dashboard" 
                description="Operations Command Centre"
            >
                <a href="/matches" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + New Fixture
                </a>
                <a href="/training" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + New Session
                </a>
                <a href="/squad" className="px-3.5 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-accent transition-all border border-border">
                    + Add Player
                </a>
                <button onClick={syncLeague} className="px-4 py-2 rounded-lg bg-brand text-brand-foreground text-xs font-bold hover:bg-brand/90 transition-all shadow">
                    Sync Standings
                </button>
            </PageHeader>

            {/* LEVEL 1: The Next Event (Football First) */}
            <PageSection>
                <SectionHeader title="Next Match" className="border-l-4 border-brand pl-3 mb-4" />
                <div className="grid gap-4 md:grid-cols-3">
                    {/* Next Fixture (Primary) */}
                    <div className="md:col-span-2 bg-surface-2 border border-border/80 p-8 rounded-xl shadow-sm flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-6">
                            <Badge className="bg-background text-muted-foreground border-border uppercase tracking-widest text-[10px] font-bold px-3 py-1">
                                {nextMatch?.competition || "Friendly"}
                            </Badge>
                            {nextMatch && timeLeft && (
                                <div className="text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded border border-border flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5" />
                                    {timeLeft.days > 0 ? In  days : 'Today'}
                                </div>
                            )}
                        </div>
                        
                        <div className="mb-8">
                            <div className="text-sm font-semibold text-muted-foreground mb-1">
                                {nextMatch?.isHome ? "Home vs" : "Away vs"}
                            </div>
                            <div className="text-4xl md:text-5xl font-black text-foreground tracking-tight leading-none">
                                {nextMatch ? nextMatch.opponent : "TBC"}
                            </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border/50 pt-5 mt-auto">
                            {nextMatch ? (
                                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{formatDate(nextMatch.date)}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{nextMatch.time || "TBC"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        <span className="font-medium text-foreground">{nextMatch.location || (nextMatch.isHome ? "Home" : "Away")}</span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No upcoming fixtures scheduled.</div>
                            )}
                            
                            <a href="/matchday-xi" className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-brand text-brand-foreground text-sm font-bold hover:bg-brand/90 transition-colors shadow">
                                Matchday Hub
                            </a>
                        </div>
                    </div>

                    {/* Next Training (Secondary) */}
                    <div className="bg-card border-border p-6 rounded-xl flex flex-col justify-between shadow-sm">
                        <div>
                            <div className="cf-label text-muted-foreground uppercase tracking-wider mb-2">Next Training</div>
                            <div className="text-xl font-bold text-foreground leading-tight">
                                {nextTrainingSession ? nextTrainingSession.focus || "Team Session" : "No Session Scheduled"}
                            </div>
                            
                            {nextTrainingSession && (
                                <div className="space-y-2 mt-4 text-sm text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-4 w-4" />
                                        <span>{formatDate(nextTrainingSession.date)} - {nextTrainingSession.time || "TBC"}</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <MapPin className="h-4 w-4" />
                                        <span>{nextTrainingSession.location || "Training Ground"}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        <div className="mt-6 pt-4 border-t border-border">
                            {nextTrainingSession ? (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                        {availablePlayers.length} Available
                                    </div>
                                    <a href="/training" className="text-xs font-bold text-brand hover:underline">Manage</a>
                                </div>
                            ) : (
                                <a href="/training" className="text-xs font-bold text-muted-foreground hover:text-foreground">Schedule Session</a>
                            )}
                        </div>
                    </div>
                </div>
            </PageSection>

            {/* LEVEL 2: Action Required (Operational Strips) */}
            <PageSection>
                <SectionHeader title="Action Required" />
                
                {priorities.length > 0 || injuredPlayers.length > 0 || suspendedPlayers.length > 0 ? (
                    <div className="space-y-2">
                        {priorities.map((task, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3.5 bg-status-warning/5 border border-status-warning/20 rounded-lg text-sm transition-colors hover:bg-status-warning/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => handleDismissPriority(task.label)}
                                        className="p-1.5 rounded-full bg-background hover:bg-status-success/20 text-muted-foreground hover:text-status-success transition-colors shadow-sm"
                                        title="Mark as Resolved"
                                    >
                                        <Check className="h-4 w-4" />
                                    </button>
                                    <span className="font-medium text-foreground">{task.label}</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-status-warning px-2 py-1 bg-background rounded border border-border">Priority</span>
                            </div>
                        ))}
                        {injuredPlayers.map((player, idx) => (
                            <div key={inj-} className="flex items-center justify-between p-3.5 bg-status-error/5 border border-status-error/20 rounded-lg text-sm transition-colors hover:bg-status-error/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-full bg-background text-status-error shadow-sm">
                                        <AlertCircle className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-foreground">{player.firstName} {player.lastName} requires injury update.</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-status-error px-2 py-1 bg-background rounded border border-border">Medical</span>
                            </div>
                        ))}
                        {suspendedPlayers.length > 0 && (
                            <div className="flex items-center justify-between p-3.5 bg-status-error/5 border border-status-error/20 rounded-lg text-sm transition-colors hover:bg-status-error/10 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="p-1.5 rounded-full bg-background text-status-error shadow-sm">
                                        <ShieldAlert className="h-4 w-4" />
                                    </div>
                                    <span className="font-medium text-foreground">{suspendedPlayers.length} player(s) currently suspended.</span>
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-widest text-status-error px-2 py-1 bg-background rounded border border-border">Discipline</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg p-6 flex flex-col items-center justify-center text-center shadow-sm">
                        <CheckCircle2 className="h-8 w-8 text-status-success mb-2 opacity-50" />
                        <h4 className="text-sm font-bold text-foreground">All clear</h4>
                        <p className="text-xs text-muted-foreground mt-1">No immediate operational tasks.</p>
                    </div>
                )}
            </PageSection>

            {/* LEVEL 3: Core Readiness & Club Status */}
            <PageSection>
                <SectionHeader title="Club Status" />
                <div className="grid gap-4 md:grid-cols-4">
                    {/* Anchor Metric */}
                    <div className="md:col-span-2 bg-surface-2 border border-border/80 p-6 rounded-xl shadow-sm flex flex-col justify-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-5">
                            <Trophy className="w-24 h-24" />
                        </div>
                        <div className="cf-label text-muted-foreground mb-2 uppercase tracking-wider relative z-10">League Position</div>
                        <div className="flex items-baseline gap-3 relative z-10">
                            <span className="text-5xl font-black text-foreground tracking-tight">{displayLeaguePosition}</span>
                            <span className="text-sm font-medium text-muted-foreground">{leagueNameState || "No League Configured"}</span>
                        </div>
                    </div>
                    
                    {/* Authentic Form Guide */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
                        <div className="cf-label text-muted-foreground mb-3 uppercase tracking-wider">Recent Form</div>
                        <div className="flex gap-1.5">
                            {recentForm.map(m => (
                                <div 
                                    key={m.id}
                                    className={w-7 h-7 rounded flex items-center justify-center text-[11px] font-bold }
                                    title={s  ()}
                                >
                                    {m.result?.[0] || "-"}
                                </div>
                            ))}
                            {recentForm.length === 0 && (
                                <span className="text-sm text-muted-foreground italic">No matches played</span>
                            )}
                        </div>
                    </div>

                    {/* Operational Availability */}
                    <div className="bg-card border border-border p-6 rounded-xl shadow-sm flex flex-col justify-center">
                        <div className="cf-label text-muted-foreground mb-3 uppercase tracking-wider">Squad Status</div>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">{availablePlayers.length}</span>
                            <span className="text-xs font-medium text-muted-foreground">/ {players.length} ready</span>
                        </div>
                    </div>
                </div>
            </PageSection>

            {/* LEVEL 4: Performance Statistics */}
            <PageSection>
                <SectionHeader title="Performance Overview" />
                <div className="grid gap-4 md:grid-cols-4">
                    <MetricCard 
                        title="Points"
                        value={points.toString()}
                        description={${wins}W D L}
                    />
                    <MetricCard 
                        title="Goal Difference"
                        value={goalDifference > 0 ? + : goalDifference.toString()}
                        description={${goalsScored} For,  Against}
                    />
                    <MetricCard 
                        title="Win Rate"
                        value={${winRate}%}
                        trend={winRate > 50 ? { value: 5, direction: "up" } : undefined}
                    />
                    <MetricCard 
                        title="Goals Scored"
                        value={goalsScored.toString()}
                        description={${(goalsScored / (wins + draws + losses || 1)).toFixed(1)} per game}
                    />
                </div>
            </PageSection>

            {/* LEVEL 5: Everything Else (Department Summaries) */}
            <PageSection>
                <SectionHeader title="Department Summaries" />
                <div className="grid gap-4 md:grid-cols-2">
                    {/* Medical Department */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="pb-3 border-b border-border">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Thermometer className="h-4 w-4 text-muted-foreground" />
                                Medical Update
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-3">
                                {injuredPlayers.length > 0 ? (
                                    injuredPlayers.map((player) => (
                                        <div key={player.id} className="flex justify-between items-center text-sm">
                                            <span className="font-medium text-foreground">{player.firstName} {player.lastName}</span>
                                            <span className="text-xs font-medium text-status-warning bg-status-warning/10 px-2 py-0.5 rounded">{player.injuryStatus}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-sm text-muted-foreground text-center py-4">Squad is fully fit</div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Squad Readiness */}
                    <Card className="bg-card border-border shadow-sm">
                        <CardHeader className="pb-3 border-b border-border">
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Footprints className="h-4 w-4 text-muted-foreground" />
                                Physical Availability
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4">
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-muted-foreground font-medium">Match Fit</span>
                                        <span className="font-bold text-foreground">{availablePlayers.length}</span>
                                    </div>
                                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-status-success rounded-full" style={{ width: ${(availablePlayers.length / (players.length || 1)) * 100}% }}></div>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs mb-1.5">
                                        <span className="text-muted-foreground font-medium">Injured / Unavailable</span>
                                        <span className="font-bold text-foreground">{injuredPlayers.length}</span>
                                    </div>
                                    <div className="h-2 w-full bg-surface-2 rounded-full overflow-hidden">
                                        <div className="h-full bg-status-error rounded-full" style={{ width: ${(injuredPlayers.length / (players.length || 1)) * 100}% }}></div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </PageSection>
        </div>
    );
}
'''

content = content[:start_idx] + new_return_content
with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("File updated successfully.")
