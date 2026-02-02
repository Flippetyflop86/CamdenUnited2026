"use client";

import { useState } from "react";
import { Match } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ScanSearch, ArrowRight, Save, X, AlertCircle, CheckCircle2 } from "lucide-react";

interface FixtureScoutProps {
    onImport: (matches: Match[]) => void;
}

export function FixtureScout({ onImport }: FixtureScoutProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [rawText, setRawText] = useState("");
    const [parsedMatches, setParsedMatches] = useState<Match[]>([]);
    const [step, setStep] = useState<"input" | "preview">("input");

    const parseText = () => {
        const lines = rawText.split('\n').filter(line => line.trim().length > 0);
        const newMatches: Match[] = [];

        lines.forEach((line, index) => {
            // 1. Attempt to find Date (DD/MM or Sat 12 Oct)
            // Regex for simplistic date finding (very basic)
            const dateRegex = /(\d{1,2})[\/\.-](\d{1,2})|(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i;
            const dateMatch = line.match(dateRegex);

            // Default to upcoming Saturday if no date found (just a placeholder logic) or skip
            let matchDate = "";
            let remainingText = line;

            if (dateMatch) {
                // roughly try to parse date, for now we might just leave it blank or try best effort
                // In a real app we'd use date-fns or moment
                matchDate = "2026-01-01"; // Placeholder if parsing fails
            }

            // 2. Look for Score (e.g. 2-1, 3 - 0)
            const scoreRegex = /(\d+)\s*[-:]\s*(\d+)/;
            const scoreMatch = line.match(scoreRegex);
            let scoreline = "";
            let homeScore = 0;
            let awayScore = 0;

            if (scoreMatch) {
                scoreline = `${scoreMatch[1]}-${scoreMatch[2]}`;
                homeScore = parseInt(scoreMatch[1]);
                awayScore = parseInt(scoreMatch[2]);
            }

            // 3. Identify Opponent
            // Remove date and score from line to guess team names
            // This is "dumb" parsing: assumes "Camden United" is in the line
            const isHome = line.toLowerCase().indexOf("camden united") < line.toLowerCase().indexOf("v") ||
                (scoreMatch && line.toLowerCase().indexOf("camden united") < scoreMatch.index!);

            // Clean up text to find opponent
            let cleanLine = line.replace(scoreRegex, "").replace(dateRegex, "").replace(/camden united/gi, "").replace(/v/gi, "").replace(/-/g, "").trim();
            const opponent = cleanLine.substring(0, 30).trim() || "Unknown Opponent";

            // Determine Result
            let result: "Win" | "Draw" | "Loss" | "Pending" = "Pending";
            if (scoreline) {
                if (homeScore === awayScore) result = "Draw";
                else if (isHome) result = homeScore > awayScore ? "Win" : "Loss";
                else result = awayScore > homeScore ? "Win" : "Loss";
            }

            newMatches.push({
                id: `scout_${Date.now()}_${index}`,
                date: matchDate || new Date().toISOString().split('T')[0],
                time: "15:00",
                opponent: opponent,
                isHome: isHome || true, // default to home if unsure
                competition: "Premier Division", // default
                scoreline: scoreline,
                result: result,
                goalscorers: "",
                notes: "Imported via Fixture Scout"
            });
        });

        setParsedMatches(newMatches);
        setStep("preview");
    };

    const handleConfirm = () => {
        onImport(parsedMatches);
        setIsOpen(false);
        setRawText("");
        setParsedMatches([]);
        setStep("input");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 hover:text-indigo-800">
                    <ScanSearch className="mr-2 h-4 w-4" />
                    Fixture Scout
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <ScanSearch className="h-5 w-5 text-indigo-600" />
                        Fixture Scout
                    </DialogTitle>
                    <DialogDescription>
                        Paste your fixture list below. I'll try to extract the match details automatically.
                    </DialogDescription>
                </DialogHeader>

                {step === "input" ? (
                    <div className="space-y-4 py-4">
                        <Textarea
                            placeholder="Paste text here... e.g. '12/10 Camden United 3-1 Wood Lane'"
                            className="min-h-[200px] font-mono text-sm"
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                        />
                        <div className="bg-slate-50 p-3 rounded text-xs text-slate-500">
                            <strong>Tip:</strong> Works best with lines like "Date - Team A v Team B - Score".
                        </div>
                    </div>
                ) : (
                    <ScrollArea className="h-[300px] rounded-md border p-4 bg-slate-50">
                        {parsedMatches.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                <AlertCircle className="mx-auto h-8 w-8 mb-2" />
                                <p>No matches found in text.</p>
                                <Button variant="link" onClick={() => setStep("input")}>Try Again</Button>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {parsedMatches.map((match, idx) => (
                                    <div key={idx} className="flex items-center justify-between bg-white p-3 rounded border shadow-sm">
                                        <div className="space-y-1">
                                            <div className="font-semibold text-sm flex items-center gap-2">
                                                {match.isHome ? "vs" : "@"} {match.opponent}
                                                {match.result !== "Pending" && (
                                                    <span className={`text-[10px] px-1.5 rounded border ${match.result === "Win" ? "bg-green-50 border-green-200 text-green-700" :
                                                            match.result === "Loss" ? "bg-red-50 border-red-200 text-red-700" :
                                                                "bg-amber-50 border-amber-200 text-amber-700"
                                                        }`}>{match.result}</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {match.scoreline ? `Result: ${match.scoreline}` : "Fixture"} • {match.competition}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-500" onClick={() => {
                                            setParsedMatches(parsedMatches.filter((_, i) => i !== idx));
                                        }}>
                                            <X className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                )}

                <DialogFooter className="gap-2 sm:gap-0">
                    {step === "input" ? (
                        <>
                            <Button variant="ghost" onClick={() => setIsOpen(false)}>Cancel</Button>
                            <Button onClick={parseText} disabled={!rawText.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                                Scout Matches <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button variant="ghost" onClick={() => setStep("input")}>Back to Edit</Button>
                            <Button onClick={handleConfirm} className="bg-green-600 hover:bg-green-700 text-white">
                                <Save className="mr-2 h-4 w-4" /> Import {parsedMatches.length} Matches
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
