"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, FileText, Link as LinkIcon, ExternalLink, Download, UploadCloud } from "lucide-react";
import { ClubDocument } from "@/types";
import { supabase } from "@/lib/supabase";

export default function DocumentsPage() {
    const [documents, setDocuments] = useState<ClubDocument[]>([]);
    const [isAddOpen, setIsAddOpen] = useState(false);

    // New Document Form State
    const [newDoc, setNewDoc] = useState<Partial<ClubDocument>>({
        name: '',
        type: 'Link',
        url: '', // Will hold the URL or the Base64 data string
        category: 'General'
    });
    const [fileName, setFileName] = useState<string>(''); // For displaying selected filename

    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchDocuments();
        const channel = supabase.channel('public:documents')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, fetchDocuments)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchDocuments = async () => {
        const { data, error } = await supabase.from('documents').select('*');
        if (data) {
            setDocuments(data.map((d: any) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                url: d.url,
                category: d.category,
                createdAt: d.created_at
            })));
        }
    };

    // Note: Removed saveDocuments helper.

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Note: For large files, Supabase Storage is recommended.
        // For now, keeping Base64 approach but reducing limit to avoid payload errors if possible, 
        // though Supabase row limit is likely strict (e.g. 1MB).
        // Let's warn user about large files or ideally use storage, but here we just pass the string.
        if (file.size > 1 * 1024 * 1024) { // 1MB limit for DB text field usually smart
            alert("File is too large for database storage. Please use a link for large files.");
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setNewDoc({ ...newDoc, url: reader.result as string });
            setFileName(file.name);
            if (!newDoc.name) {
                setNewDoc(prev => ({ ...prev, name: file.name }));
            }
        };
        reader.readAsDataURL(file);
    };

    const addDocument = async () => {
        if (!newDoc.name || !newDoc.url) {
            alert("Please provide a name and a link/file.");
            return;
        }

        const payload = {
            name: newDoc.name,
            type: newDoc.type,
            url: newDoc.url,
            category: newDoc.category
        };

        const { error } = await supabase.from('documents').insert([payload]);

        if (error) {
            alert("Error adding document: " + error.message);
        } else {
            setIsAddOpen(false);
            setNewDoc({ name: '', type: 'Link', url: '', category: 'General' });
            setFileName('');
        }
    };

    const deleteDocument = async (id: string) => {
        if (confirm("Delete this document?")) {
            await supabase.from('documents').delete().eq('id', id);
        }
    };

    // Group by Category
    const categories = ['General', 'League', 'Insurance', 'Training', 'Matchday', 'Registration Form'];

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Documents Hub</h2>
                    <p className="text-slate-500">Central repository for club rules, insurance, and external links.</p>
                </div>
                <Button onClick={() => setIsAddOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="h-4 w-4 mr-2" /> Add Document
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {categories.map(category => {
                    const categoryDocs = documents.filter(d => d.category === category);
                    if (categoryDocs.length === 0) return null;

                    return (
                        <Card key={category} className="h-fit">
                            <CardHeader className="pb-3 border-b bg-slate-50/50">
                                <CardTitle className="text-base font-semibold text-slate-800">{category}</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-3">
                                {categoryDocs.map(doc => (
                                    <div key={doc.id} className="group flex items-start justify-between p-2 rounded hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                                        <div className="flex gap-3 overflow-hidden">
                                            <div className={`mt-1 flex-shrink-0 h-8 w-8 rounded flex items-center justify-center ${doc.type === 'Link' ? 'bg-blue-100 text-blue-600' :
                                                doc.type === 'PDF' ? 'bg-red-100 text-red-600' :
                                                    doc.type === 'Word' ? 'bg-indigo-100 text-indigo-600' :
                                                        'bg-slate-100 text-slate-600'
                                                }`}>
                                                {doc.type === 'Link' ? <LinkIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                                            </div>
                                            <div className="min-w-0">
                                                <a href={doc.url} download={doc.type !== 'Link'} target="_blank" rel="noopener noreferrer" className="block text-sm font-medium text-slate-900 hover:text-blue-600 hover:underline truncate">
                                                    {doc.name}
                                                </a>
                                                <p className="text-xs text-slate-500 truncate">
                                                    {doc.type === 'Link' ? doc.url : `${doc.type} Upload`}
                                                </p>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteDocument(doc.id)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    );
                })}

                {documents.length === 0 && (
                    <div className="col-span-full flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-200 rounded-lg bg-slate-50">
                        <FileText className="h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-slate-500 font-medium">No documents yet</p>
                        <p className="text-sm text-slate-400">Add policies, league rules, or important links.</p>
                    </div>
                )}
            </div>

            {/* ADD MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader><CardTitle>Add Document</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Name</label>
                                <Input placeholder="e.g. League Rules 24/25" value={newDoc.name} onChange={e => setNewDoc({ ...newDoc, name: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Type</label>
                                <div className="flex gap-2">
                                    {['Link', 'PDF', 'Word'].map(t => (
                                        <button
                                            key={t}
                                            onClick={() => {
                                                setNewDoc({ ...newDoc, type: t as any, url: '' });
                                                setFileName('');
                                            }}
                                            className={`flex-1 py-2 text-sm rounded-md border ${newDoc.type === t ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {t}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {newDoc.type === 'Link' ? 'URL' : 'Upload File (Max 5MB)'}
                                </label>
                                {newDoc.type === 'Link' ? (
                                    <Input placeholder="https://..." value={newDoc.url} onChange={e => setNewDoc({ ...newDoc, url: e.target.value })} />
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <label className="flex-1 cursor-pointer">
                                            <div className="flex items-center justify-center w-full h-10 px-3 py-2 text-sm border rounded-md hover:bg-slate-50 bg-white">
                                                <UploadCloud className="w-4 h-4 mr-2" />
                                                {fileName || "Choose File..."}
                                            </div>
                                            <input type="file" className="hidden" accept={newDoc.type === 'PDF' ? '.pdf' : '.doc,.docx'} onChange={handleFileChange} />
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Category</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newDoc.category}
                                    onChange={e => setNewDoc({ ...newDoc, category: e.target.value as any })}
                                >
                                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-2">
                                <Button variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                                <Button onClick={addDocument}>Add Document</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
