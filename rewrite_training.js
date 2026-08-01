const fs = require('fs');
const file = 'src/app/training/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const importsToAdd = `
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { SectionHeader } from "@/components/ui/section-header";
`;

content = content.replace('import { useSearchParams } from "next/navigation";', 'import { useSearchParams } from "next/navigation";\n' + importsToAdd);

const returnRegex = /return \([\s\S]*?\);\n}/;

const newReturn = `return (
        <div className="space-y-8 pb-12">
            <PageHeader 
                title="Training Schedule" 
                description="Plan the week and prepare your squad for the next football activity." 
            />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex bg-surface-1 p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setActiveTab('sessions')}
                            className={\`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all \${activeTab === 'sessions' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}\`}
                        >
                            <CalendarDays className="h-4 w-4 mr-2" /> Schedule
                        </button>
                        <button
                            onClick={() => setActiveTab('stats')}
                            className={\`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-all \${activeTab === 'stats' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}\`}
                        >
                            <BarChart3 className="h-4 w-4 mr-2" /> Attendance
                        </button>
                    </div>

                    <select
                        value={squadFilter}
                        onChange={(e) => setSquadFilter(e.target.value)}
                        className="flex h-9 rounded-md border border-border bg-surface-1 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand cursor-pointer text-foreground font-medium"
                    >
                        <option value="All">All Squads</option>
                        {currentSquads.map((squad) => (
                            <option key={squad} value={squad}>
                                {squad}
                            </option>
                        ))}
                    </select>
                </div>

                {activeTab === 'sessions' && (
                    <Button className="bg-brand hover:bg-brand/90 text-white" onClick={handleOpenNew}>
                        <Plus className="h-4 w-4 mr-2" /> Schedule Session
                    </Button>
                )}
            </div>

            {activeTab === 'sessions' ? (
                <div className="space-y-8">
                    {/* The Next Session (Command Center) */}
                    {trueUpcomingSessions.length > 0 && (
                        <PageSection>
                            <div className="flex flex-col space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-baseline gap-2">
                                    <h3 className="text-xl font-bold tracking-tight text-foreground">Next Session</h3>
                                    <span className="text-sm text-muted-foreground font-medium">Preparing for Sporting Hackney (Friendly)</span>
                                </div>

                                <Card className="overflow-hidden border-border bg-background shadow-md">
                                    <div className="p-6 md:p-8 flex flex-col md:flex-row gap-8">
                                        {/* Left Col: Coaching Objective & Session Info */}
                                        <div className="flex-1 space-y-6">
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <Badge variant="secondary" className="bg-brand/10 text-brand hover:bg-brand/20">{formatSquad(trueUpcomingSessions[0].squad)}</Badge>
                                                    <span className="text-sm font-semibold text-brand">MD-3</span>
                                                </div>
                                                <h4 className="text-3xl font-bold tracking-tight text-foreground">
                                                    {trueUpcomingSessions[0].topic || "General Preparation"}
                                                </h4>
                                            </div>

                                            <div className="flex flex-col gap-3 text-slate-600 font-medium">
                                                <div className="flex items-center gap-3">
                                                    <CalendarDays className="h-5 w-5 text-muted-foreground" />
                                                    <span>{formatTrainingDate(trueUpcomingSessions[0].date)}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Clock className="h-5 w-5 text-muted-foreground" />
                                                    <span>{formatTime12h(trueUpcomingSessions[0].time).time}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <MapPin className="h-5 w-5 text-muted-foreground" />
                                                    <span>{trueUpcomingSessions[0].location}</span>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-3 pt-2">
                                                <Button className="bg-brand hover:bg-brand/90" asChild>
                                                    <Link href={\`/training/\${trueUpcomingSessions[0].id}\`}>Manage Session</Link>
                                                </Button>
                                                <Button variant="outline" className="border-border text-foreground" onClick={() => handleOpenShare(trueUpcomingSessions[0])}>
                                                    <MessageCircle className="h-4 w-4 mr-2" /> Share Poll
                                                </Button>
                                            </div>
                                        </div>

                                        {/* Right Col: Attendance Readiness */}
                                        <div className="md:w-72 bg-surface-1 rounded-xl p-6 flex flex-col justify-center border border-border/50">
                                            <h5 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-4">Squad Availability</h5>
                                            
                                            {(() => {
                                                const { regAttendedCount, totalEligible } = getSessionAttendanceStats(trueUpcomingSessions[0]);
                                                const responded = trueUpcomingSessions[0].attendance.filter(a => !a.playerId.startsWith('guest:')).length;
                                                const unavailable = responded - regAttendedCount;
                                                const awaiting = totalEligible - responded;
                                                
                                                return (
                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <CheckCircle2 className="h-5 w-5 text-status-success" />
                                                                <span className="font-medium text-foreground">Confirmed</span>
                                                            </div>
                                                            <span className="text-xl font-bold text-foreground">{regAttendedCount}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <XCircle className="h-5 w-5 text-status-error opacity-80" />
                                                                <span className="font-medium text-muted-foreground">Unavailable</span>
                                                            </div>
                                                            <span className="text-lg font-semibold text-muted-foreground">{unavailable}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2">
                                                                <HelpCircle className="h-5 w-5 text-status-warning opacity-80" />
                                                                <span className="font-medium text-muted-foreground">Awaiting</span>
                                                            </div>
                                                            <span className="text-lg font-semibold text-muted-foreground">{awaiting > 0 ? awaiting : 0}</span>
                                                        </div>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                </Card>
                            </div>
                        </PageSection>
                    )}

                    {/* Upcoming Journey */}
                    {trueUpcomingSessions.length > 1 && (
                        <PageSection>
                            <SectionHeader title="Upcoming Journey" description="Future sessions leading to the match." />
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {trueUpcomingSessions.slice(1).map((session) => (
                                    <Card 
                                        key={session.id} 
                                        onClick={() => window.location.href = \`/training/\${session.id}\`}
                                        className="hover:shadow-md transition-shadow cursor-pointer border-border group relative bg-card"
                                    >
                                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-brand" onClick={(e) => handleRepeatNextWeek(session, e)} title="Repeat Next Week">
                                                <Repeat className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-600" onClick={(e) => { e.stopPropagation(); handleEdit(session); }}>
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-status-error" onClick={(e) => { e.stopPropagation(); handleDelete(session.id); }}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start pr-16">
                                                <Badge variant="secondary" className="bg-surface-1 text-muted-foreground border-border">{formatSquad(session.squad)}</Badge>
                                            </div>
                                            <CardTitle className="text-lg mt-2 text-foreground">{session.topic || "General Preparation"}</CardTitle>
                                            <CardDescription className="flex items-center gap-1 font-medium">
                                                <CalendarDays className="h-3 w-3" /> {formatDate(session.date)} • {formatTime12h(session.time).time}
                                            </CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </PageSection>
                    )}

                    {/* Historical Record */}
                    {displaySessions.filter(s => new Date(s.date).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]).length > 0 && (
                        <PageSection>
                            <SectionHeader title="Historical Record" description="Past sessions and attendance records." />
                            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 opacity-75">
                                {displaySessions.filter(s => new Date(s.date).toISOString().split("T")[0] < new Date().toISOString().split("T")[0]).map((session) => (
                                    <Card 
                                        key={session.id} 
                                        onClick={() => window.location.href = \`/training/\${session.id}\`}
                                        className="hover:shadow-sm cursor-pointer border-border bg-surface-1"
                                    >
                                        <CardHeader className="pb-2">
                                            <div className="flex justify-between items-start">
                                                <CardTitle className="text-base text-foreground">{session.topic || "General Preparation"}</CardTitle>
                                                <span className="text-xs font-semibold text-muted-foreground">{formatSquad(session.squad)}</span>
                                            </div>
                                            <CardDescription className="flex items-center gap-1">
                                                {formatDate(session.date)}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-status-success" />
                                                {getSessionAttendanceStats(session).regAttendedCount} Attended
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </PageSection>
                    )}

                    {displaySessions.length === 0 && (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-border rounded-xl bg-surface-1">
                            <Activity className="h-8 w-8 text-muted-foreground/50 mx-auto mb-3" />
                            <h3 className="text-lg font-semibold text-foreground">No sessions planned</h3>
                            <p className="text-muted-foreground mt-1">Schedule your first training session to begin preparation.</p>
                            <Button className="bg-brand hover:bg-brand/90 mt-4 text-white" onClick={handleOpenNew}>
                                Schedule Session
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <Card className="border-border shadow-sm overflow-hidden">
                    <CardHeader className="bg-surface-1 border-b border-border">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Training Attendance</CardTitle>
                                <CardDescription>Tracking {displaySeasonLabel}</CardDescription>
                            </div>
                            <div className="flex items-center gap-4">
                                <Button variant="outline" size="sm" onClick={downloadStatsExcel} className="border-border">
                                    <Download className="h-4 w-4 mr-2" /> Export Excel
                                </Button>
                                <div className="text-right">
                                    <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                                    <p className="text-2xl font-bold text-foreground">{leaderboardSessions.length}</p>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-surface-1 text-muted-foreground uppercase font-semibold text-xs border-b border-border">
                                    <tr>
                                        <th className="px-6 py-4">Player</th>
                                        <th className="px-6 py-4">Squad</th>
                                        <th className="px-6 py-4 text-center">Attended</th>
                                        <th className="px-6 py-4 text-center">Attendance %</th>
                                        <th className="px-6 py-4">Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {playerStats.map((player) => (
                                        <tr key={player.id} className="hover:bg-surface-1/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-8 w-8 ring-1 ring-border">
                                                        <AvatarImage src={settings?.logo || player.imageUrl} />
                                                        <AvatarFallback className="bg-surface-1 text-muted-foreground">{player.firstName[0]}{player.lastName[0]}</AvatarFallback>
                                                    </Avatar>
                                                    <span className="font-bold text-foreground">{player.firstName} {player.lastName}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground font-medium">{formatSquad(player.squad)}</td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="font-bold text-foreground">{player.stats.attended}<span className="text-muted-foreground font-normal">/{player.stats.total}</span></div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge variant="secondary" className={\`\${player.stats.percentage >= 80 ? 'bg-status-success/10 text-status-success' : player.stats.percentage >= 50 ? 'bg-status-warning/10 text-status-warning' : 'bg-status-error/10 text-status-error'}\`}>
                                                    {player.stats.percentage}%
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="w-full bg-surface-1 border border-border rounded-full h-2 overflow-hidden">
                                                    <div
                                                        className={\`h-full \${player.stats.percentage >= 80 ? 'bg-status-success' : player.stats.percentage >= 50 ? 'bg-status-warning' : 'bg-status-error'}\`}
                                                        style={{ width: \`\${player.stats.percentage}%\` }}
                                                    ></div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {playerStats.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                                No training stats available for this season yet.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {isDialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
                    <div className="bg-background rounded-xl shadow-2xl border border-border w-full max-w-md overflow-hidden">
                        <div className="p-5 border-b border-border bg-surface-1 flex justify-between items-center">
                            <h3 className="font-bold text-lg text-foreground">{editingSessionId ? "Edit Session" : "Schedule Preparation"}</h3>
                            <button onClick={() => setIsDialogOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors"><XCircle className="h-5 w-5"/></button>
                        </div>
                        <div className="p-5 space-y-5">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Date</label>
                                <Input
                                    type="date"
                                    value={newSession.date}
                                    onChange={(e) => setNewSession({ ...newSession, date: e.target.value })}
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Time</label>
                                <Input
                                    type="time"
                                    value={newSession.time}
                                    onChange={(e) => setNewSession({ ...newSession, time: e.target.value })}
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Location</label>
                                <Input
                                    value={newSession.location}
                                    onChange={(e) => setNewSession({ ...newSession, location: e.target.value })}
                                    placeholder="Enter location"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Squad</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand"
                                    value={newSession.squad}
                                    onChange={(e) => setNewSession({ ...newSession, squad: e.target.value as any })}
                                >
                                    <option value="All">All Squads</option>
                                    {currentSquads.map(squad => (
                                        <option key={squad} value={squad}>{squad}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-foreground">Coaching Objective</label>
                                <Input
                                    value={newSession.topic}
                                    onChange={(e) => setNewSession({ ...newSession, topic: e.target.value })}
                                    placeholder="e.g. Possession, Pressing, Match Prep"
                                    className="border-border bg-background text-foreground"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3 pb-2 border-b border-dashed border-border">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-foreground">Availability Lock</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand text-foreground"
                                        value={newSession.lockType || "Never"}
                                        onChange={(e) => setNewSession({ ...newSession, lockType: e.target.value })}
                                    >
                                        <option value="Never">Never Lock</option>
                                        <option value="Start">At Training Start</option>
                                        <option value="30m">30 Mins Before</option>
                                        <option value="1h">1 Hour Before</option>
                                        <option value="Custom">Custom Time</option>
                                    </select>
                                </div>
                                {newSession.lockType === "Custom" && (
                                    <div className="space-y-2">
                                        <label className="text-sm font-semibold text-foreground">Custom Lock Time</label>
                                        <Input
                                            type="datetime-local"
                                            value={newSession.lockTime || ""}
                                            onChange={(e) => setNewSession({ ...newSession, lockTime: e.target.value })}
                                            className="h-10 text-sm border-border bg-background text-foreground"
                                        />
                                    </div>
                                )}
                            </div>

                            {!editingSessionId && (
                                <div className="space-y-3 pt-2">
                                    <div className="flex items-center gap-2">
                                        <input 
                                            type="checkbox" 
                                            id="repeatWeekly" 
                                            checked={newSession.repeatWeekly || false}
                                            onChange={(e) => setNewSession({ ...newSession, repeatWeekly: e.target.checked, repeatWeeks: e.target.checked ? 4 : 1 })}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <label htmlFor="repeatWeekly" className="text-sm font-semibold text-foreground cursor-pointer">Repeat Weekly</label>
                                    </div>
                                    {newSession.repeatWeekly && (
                                        <div className="space-y-1 pl-6">
                                            <label className="text-xs font-semibold text-muted-foreground">Number of weeks (1 to 12)</label>
                                            <Input
                                                type="number"
                                                min={1}
                                                max={12}
                                                value={newSession.repeatWeeks || 4}
                                                onChange={(e) => setNewSession({ ...newSession, repeatWeeks: Math.max(1, Math.min(12, parseInt(e.target.value) || 1)) })}
                                                className="w-24 h-9 text-xs border-border bg-background text-foreground"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-5 border-t border-border bg-surface-1 flex justify-end gap-3">
                            <Button variant="outline" className="border-border text-foreground" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                            <Button className="bg-brand hover:bg-brand/90 text-white" onClick={handleSchedule} disabled={!newSession.date}>
                                {editingSessionId ? "Save Changes" : "Schedule Preparation"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Share WhatsApp Poll Modal */}
            <Dialog open={activeShareSession !== null} onOpenChange={(open) => { if (!open) setActiveShareSession(null); }}>
                <DialogContent className="sm:max-w-[620px] max-h-[85vh] overflow-y-auto bg-background border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-brand">
                            <MessageCircle className="h-5 w-5" /> Share Availability Poll
                        </DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Send a check-in message to your squad via WhatsApp.
                        </DialogDescription>
                    </DialogHeader>

                    {activeShareSession && (
                        <div className="grid gap-4 py-2 text-foreground">
                            {/* Toggle switches/checkboxes */}
                            <div className="space-y-2 border-b border-border pb-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Include Details:</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeVenue}
                                            onChange={(e) => setIncludeVenue(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Venue</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeTopic}
                                            onChange={(e) => setIncludeTopic(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Coaching Objective</span>
                                    </label>
                                    <label className="flex items-center gap-2 text-sm font-medium text-foreground cursor-pointer p-1.5 hover:bg-surface-1 rounded transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={includeNotes}
                                            onChange={(e) => setIncludeNotes(e.target.checked)}
                                            className="h-4 w-4 rounded border-border text-brand focus:ring-brand cursor-pointer"
                                        />
                                        <span>Notes</span>
                                    </label>
                                </div>
                            </div>

                            {/* Additional Notes Textarea */}
                            {includeNotes && (
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-semibold text-foreground">Additional Notes (Optional)</Label>
                                    <Textarea
                                        value={additionalNotes}
                                        onChange={(e) => setAdditionalNotes(e.target.value)}
                                        placeholder="e.g. ⚠ Bring running trainers."
                                        className="text-xs min-h-[60px] border-border bg-surface-1 text-foreground"
                                    />
                                </div>
                            )}

                            {/* Live Preview block */}
                            <div className="space-y-1.5 border-t border-border pt-3">
                                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Message Preview</Label>
                                <div className="relative">
                                    <Textarea
                                        value={getTrainingGeneratedPollText()}
                                        readOnly
                                        className="text-xs min-h-[200px] font-mono bg-surface-1 border-border text-foreground focus-visible:ring-0 cursor-default"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 border-t border-border pt-4">
                        <Button variant="outline" className="border-border text-foreground" onClick={() => setActiveShareSession(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant={copyStatus === "copied" ? "default" : "secondary"}
                            onClick={handleCopyTrainingShareText}
                            className={\`font-semibold min-w-[160px] transition-all \${
                                copyStatus === "copied" 
                                    ? "bg-status-success hover:bg-status-success/90 text-white" 
                                    : "bg-surface-1 hover:bg-surface-1/80 border border-border text-foreground"
                            }\`}
                        >
                            {copyStatus === "copied" ? "✓ Copied" : "Copy to Clipboard"}
                        </Button>
                        <Button
                            onClick={handleSendTrainingWhatsApp}
                            className="bg-brand hover:bg-brand/90 text-white font-medium"
                        >
                            <ExternalLink className="h-4 w-4 mr-2" /> Send via WhatsApp
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
`;

content = content.replace(returnRegex, newReturn);
fs.writeFileSync(file, content, 'utf8');
console.log('Successfully replaced Training page render method.');
