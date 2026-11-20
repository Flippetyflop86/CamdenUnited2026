"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileText, Link as LinkIcon, UploadCloud } from "lucide-react";
import { ClubDocument } from "@/types";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth-context";

export default function DocumentsPage() {
    const { clubId } = useAuth();
    const [documents, setDocuments] = useState<ClubDocument[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // New Document Form State
    const [newDoc, setNewDoc] = useState<Partial<ClubDocument>>({
        name: "",
        type: "Link",
        url: "",
        category: "General",
    });
    const [fileName, setFileName] = useState<string>("");

    const fetchDocuments = useCallback(async () => {
        if (!clubId) return;
        const { data } = await supabase
            .from("documents")
            .select("*")
            .eq("club_id", clubId)
            .neq("category", "LEAGUE_TABLE_CACHE")
            .order("created_at", { ascending: false });
        if (data) {
            setDocuments(
                data.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    type: d.type,
                    url: d.url,
                    category: d.category,
                    createdAt: d.created_at,
                }))
            );
        }
    }, [clubId]);

    useEffect(() => {
        if (!clubId) return;
        fetchDocuments();
        const channel = supabase
            .channel(`public:documents:${clubId}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, fetchDocuments)
            .subscribe();
        return () => {
            supabase.removeChannel(channel);
        };
    }, [clubId, fetchDocuments]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("File exceeds the 5MB upload limit. Please compress it or paste a cloud link.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setNewDoc((prev) => ({
                ...prev,
                url: reader.result as string,
                name: prev.name || file.name,
            }));
            setFileName(file.name);
        };
        reader.readAsDataURL(file);
    };

    const addDocument = async () => {
        if (!newDoc.name || !newDoc.url) {
            alert("Please provide a name and a link or file.");
            return;
        }
        if (!clubId) {
            alert("Club session is still loading. Please try again in a moment.");
            return;
        }

        const payload = {
            club_id: clubId,
            name: newDoc.name,
            type: newDoc.type,
            url: newDoc.url,
            category: newDoc.category,
        };

        const { error } = await supabase.from("documents").insert([payload]);

        if (error) {
            alert("Error adding document: " + error.message);
        } else {
            setIsAddOpen(false);
            setNewDoc({ name: "", type: "Link", url: "", category: "General" });
            setFileName("");
            fetchDocuments();
        }
    };

    const deleteDocument = async (id: string) => {
        if (confirm("Delete this document?")) {
            const { error } = await supabase.from("documents").delete().eq("id", id);
            if (error) {
                alert("Error deleting document: " + error.message);
            } else {
                fetchDocuments();
            }
        }
    };

    const categories = ["General", "League", "Insurance", "Training", "Matchday", "Registration Form"];

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-foreground">Documents Hub</h2>
                    <p className="text-muted-foreground">
                        Central repository for club rules, insurance, and external links.
                    </p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="bg-brand hover:bg-brand/90 text-brand-foreground">
                    <Plus className="h-4 w-4 mr-2" /> Add Document
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map((category) => {
                    const categoryDocs = documents.filter((d) => d.category === category);
                    if (categoryDocs.length === 0) return null;

                    return (
                        <Card key={category} className="h-fit">
                            <CardHeader className="pb-3 border-b bg-surface-1/60">
                                <CardTitle className="text-base font-semibold text-foreground">{category}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {categoryDocs.map((doc) => (
                                    <div
                                        key={doc.id}
                                        className="group flex items-start justify-between p-2 rounded hover:bg-surface-1 transition-colors border border-transparent hover:border-border"
                                    >
                                        <div className="flex gap-3 overflow-hidden">
                                            <div
                                                className={`mt-1 shrink-0 h-8 w-8 rounded flex items-center justify-center ${
                                                    doc.type === "Link"
                                                        ? "bg-blue-500/15 text-blue-600"
                                                        : doc.type === "PDF"
                                                          ? "bg-red-500/15 text-red-600"
                                                          : doc.type === "Word"
                                                            ? "bg-indigo-500/15 text-indigo-600"
                                                            : "bg-surface-2 text-muted-foreground"
                                                }`}
                                            >
                                                {doc.type === "Link" ? (
                                                    <LinkIcon className="h-4 w-4" />
                                                ) : (
                                                    <FileText className="h-4 w-4" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <a
                                                    href={doc.url}
                                                    download={doc.type !== "Link" ? doc.name : undefined}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="block text-sm font-medium text-foreground hover:text-primary hover:underline truncate"
                                                >
                                                    {doc.name}
                                                </a>
                                                <p className="text-xs text-muted-foreground truncate">
                                                    {doc.type === "Link" ? doc.url : `${doc.type} Upload`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7 text-muted-foreground hover:text-red-500 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                                            onClick={() => deleteDocument(doc.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    );
                })}

                {documents.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-lg bg-surface-1/40">
                        <FileText className="h-10 w-10 text-muted-foreground/50 mb-2" />
                        <p className="text-muted-foreground font-medium">No documents yet</p>
                        <p className="text-sm text-muted-foreground/75">
                            Add policies, league rules, or important links.
                        </p>
                    </div>
                )}
            </div>

            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader>
                            <CardTitle>Add Document</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input
                                    placeholder="e.g. League Rules 25/26"
                                    value={newDoc.name}
                                    onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <div className="flex gap-2">
                                    {["Link", "PDF", "Word"].map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => {
                                                setNewDoc({ ...newDoc, type: t as any, url: "" });
                                                setFileName("");
                                            }}
                                            className={`flex-1 py-2 text-sm rounded-md border ${
                                                newDoc.type === t
                                                    ? "bg-foreground text-background border-foreground"
                                                    : "bg-background text-foreground border-border hover:bg-surface-1"
                                            }`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {newDoc.type === "Link" ? "URL" : "Upload File (Max 5MB)"}
                                </label>
                                {newDoc.type === "Link" ? (
                                    <Input
                                        placeholder="https://..."
                                        value={newDoc.url}
                                        onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                                    />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1 cursor-pointer">
                                            <div className="flex items-center justify-center w-full h-10 px-3 py-2 text-sm border border-border rounded-md hover:bg-surface-1 bg-background">
                                                <UploadCloud className="w-4 h-4 mr-2" />
                                                {fileName || "Choose File..."}
                                            </div>
                                            <input
                                                type="file"
                                                className="hidden"
                                                accept={newDoc.type === "PDF" ? ".pdf" : ".doc,.docx"}
                                                onChange={handleFileChange}
                                            />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Category</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newDoc.category}
                                    onChange={(e) => setNewDoc({ ...newDoc, category: e.target.value as any })}
                                >
                                    {categories.map((c) => (
                                        <option key={c} value={c}>
                                            {c}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-2">
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={addDocument}>Add Document</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
