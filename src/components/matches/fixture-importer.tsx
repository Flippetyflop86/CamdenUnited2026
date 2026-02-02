"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, FileImage, Loader2, CheckCircle2 } from "lucide-react";
import { Match } from "@/types";

declare const Tesseract: any;

interface FixtureImporterProps {
    onImport: (matches: Match[]) => void;
}

export function FixtureImporter({ onImport }: FixtureImporterProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState("");
    const [rawText, setRawText] = useState("");
    const [parsedMatches, setParsedMatches] = useState<Match[]>([]);
    const [step, setStep] = useState<"upload" | "review">("upload");

    const processFile = async (file: File) => {
        setLoading(true);
        setProgress("Initializing OCR...");

        try {
            await Tesseract.recognize(
                file,
                'eng',
                { logger: (m: any) => setProgress(`${m.status}: ${Math.round(m.progress * 100)}%`) }
            ).then(({ data: { text } }: any) => {
                setRawText(text);
                const matches = parseMatches(text);
                setParsedMatches(matches);
                setStep("review");
            });
        } catch (err) {
            console.error(err);
            setProgress("Error processing image.");
        } finally {
            setLoading(false);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf("image") !== -1) {
                const blob = items[i].getAsFile();
                if (blob) processFile(blob);
                return;
            }
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const parseMatches = (text: string): Match[] => {
        const lines = text.split('\n').filter(line => line.trim().length > 5);
        const matches: Match[] = [];

        // Very basic heuristic parser
        // Looks for lines with time-like patterns (e.g. 15:00) or date-like patterns
        const year = new Date().getFullYear();

        lines.forEach((line) => {
            // Check for common patterns
            const hasTime = line.match(/\d{1,2}[:.]\d{2}/);
            const hasVS = line.toLowerCase().includes(' v ') || line.toLowerCase().includes(' vs ');
            const hasScore = line.match(/\d+\s*[-]\s*\d+/) || line.match(/\d+\s+[-]\s+\d+/); // 2-1 or 2 - 1

            if (hasVS || hasTime || hasScore) {
                const newMatch: Match = {
                    id: Date.now().toString() + Math.random().toString().slice(2, 6),
                    date: new Date().toISOString().split('T')[0], // Default to today, needs user edit
                    time: "15:00",
                    opponent: "Unknown Opponent",
                    isHome: true,
                    competition: "Premier Division",
                    scoreline: "",
                    result: "Pending"
                };

                // Attempt extract time
                if (hasTime) {
                    newMatch.time = hasTime[0].replace('.', ':');
                }

                // Attempt extract score
                if (hasScore) {
                    newMatch.scoreline = hasScore[0].replace(/\s/g, '');
                    newMatch.result = "Pending"; // User can verify
                }

                // Attempt extract opponent
                // Removes numeric chars and time patterns to leave potential team names
                let cleanLine = line.replace(/\d{1,2}[:.]\d{2}/, '').replace(/\d+\s*[-]\s*\d+/, '');

                if (cleanLine.toLowerCase().includes('camden united')) {
                    // Extract the other part
                    const parts = cleanLine.split(/ v | vs /i);
                    const opponent = parts.find(p => !p.toLowerCase().includes('camden'));
                    if (opponent) newMatch.opponent = opponent.trim();
                } else {
                    newMatch.opponent = cleanLine.trim();
                }

                matches.push(newMatch);
            }
        });

        return matches;
    };

    const handleConfirm = () => {
        onImport(parsedMatches);
        setIsOpen(false);
        setStep("upload");
        setParsedMatches([]);
        setRawText("");
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800">
                    <FileImage className="h-4 w-4" />
                    scan Image
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]" onPaste={handlePaste}>
                <DialogHeader>
                    <DialogTitle>Import Matches from Screenshot</DialogTitle>
                    <DialogDescription>
                        Upload an image or <span className="font-semibold text-indigo-600">Paste (Ctrl+V)</span> directly from clipboard.
                    </DialogDescription>
                </DialogHeader>

                {step === "upload" ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="flex items-center justify-center w-full">
                            <Label htmlFor="image-upload" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg cursor-pointer bg-slate-50 hover:bg-slate-100">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-3 text-slate-400" />
                                    <p className="mb-2 text-sm text-slate-500"><span className="font-semibold">Click to upload</span> or <span className="font-semibold text-indigo-600">Paste Image</span></p>
                                    <p className="text-xs text-slate-500">PNG, JPG or GIF</p>
                                </div>
                                <input id="image-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} disabled={loading} />
                            </Label>
                        </div>
                        {loading && (
                            <div className="text-center space-y-2">
                                <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" />
                                <p className="text-sm text-indigo-600">{progress}</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm text-slate-900">Found {parsedMatches.length} Matches</h3>
                            <Button variant="ghost" size="sm" onClick={() => setStep("upload")}>Reset</Button>
                        </div>

                        {parsedMatches.length === 0 ? (
                            <p className="text-sm text-slate-500 italic">No clear match data found. Try a clearer image or manual entry.</p>
                        ) : (
                            <div className="space-y-2">
                                {parsedMatches.map((match, idx) => (
                                    <div key={idx} className="p-3 bg-slate-50 rounded border border-slate-100 text-sm">
                                        <div className="flex justify-between items-center mb-1">
                                            <input
                                                className="bg-transparent font-medium text-slate-900 border-none outline-none w-full"
                                                value={match.opponent}
                                                onChange={(e) => {
                                                    const newMatches = [...parsedMatches];
                                                    newMatches[idx].opponent = e.target.value;
                                                    setParsedMatches(newMatches);
                                                }}
                                            />
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="date"
                                                className="bg-white border rounded px-1 py-0.5 text-xs text-slate-500"
                                                value={match.date}
                                                onChange={(e) => {
                                                    const newMatches = [...parsedMatches];
                                                    newMatches[idx].date = e.target.value;
                                                    setParsedMatches(newMatches);
                                                }}
                                            />
                                            <input
                                                className="bg-white border rounded px-1 py-0.5 text-xs text-slate-500 w-16"
                                                placeholder="Score"
                                                value={match.scoreline}
                                                onChange={(e) => {
                                                    const newMatches = [...parsedMatches];
                                                    newMatches[idx].scoreline = e.target.value;
                                                    setParsedMatches(newMatches);
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="mt-4 pt-4 border-t">
                            <Label className="text-xs text-slate-500 mb-1 block">Raw Text (Debug)</Label>
                            <Textarea
                                value={rawText}
                                readOnly
                                className="h-24 text-[10px] font-mono bg-slate-50"
                            />
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {step === "review" && (
                        <Button onClick={handleConfirm} className="w-full bg-green-600 hover:bg-green-700">
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            Import {parsedMatches.length} Matches
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
