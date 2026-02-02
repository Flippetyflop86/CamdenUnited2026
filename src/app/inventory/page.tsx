"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Package, Activity, Search, Pencil, User } from "lucide-react";
import { InventoryItem } from "@/types";
import { supabase } from "@/lib/supabase";

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");

    // Modal State
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
        name: '',
        quantity: 1,
        category: 'Kit',
        status: 'Good',
        assignedTo: '',
        notes: ''
    });

    // ... (keep state) ...

    // Load Data
    useEffect(() => {
        fetchInventory();
        const channel = supabase.channel('public:inventory_items')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_items' }, fetchInventory)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, []);

    const fetchInventory = async () => {
        const { data, error } = await supabase.from('inventory_items').select('*');
        if (data) {
            setItems(data.map((i: any) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                category: i.category,
                status: i.status,
                assignedTo: i.assigned_to,
                notes: i.notes,
                lastUpdated: i.last_updated
            })));
        }
    };

    const handleSaveItem = async () => {
        if (!newItem.name || (newItem.quantity ?? 0) < 0) return;

        const payload = {
            name: newItem.name,
            quantity: newItem.quantity,
            category: newItem.category,
            status: newItem.status,
            assigned_to: newItem.assignedTo,
            notes: newItem.notes,
            last_updated: new Date().toISOString()
        };

        if (editingId) {
            await supabase.from('inventory_items').update(payload).eq('id', editingId);
        } else {
            await supabase.from('inventory_items').insert([payload]);
        }

        closeModal();
    };

    const deleteItem = async (id: string) => {
        if (confirm("Delete this item?")) {
            await supabase.from('inventory_items').delete().eq('id', id);
        }
    };

    // ... (startEdit, closeModal remain same) ...

    const adjustQuantity = async (id: string, delta: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;

        const newQty = Math.max(0, item.quantity + delta);

        // Optimistic update
        setItems(items.map(i => i.id === id ? { ...i, quantity: newQty } : i));

        await supabase.from('inventory_items').update({ quantity: newQty }).eq('id', id);
    };

    // Derived State
    const filteredItems = items.filter(i =>
        i.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        i.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const assignedItems = items.filter(i => i.assignedTo && i.assignedTo.trim().length > 0).length;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inventory Manager</h2>
                    <p className="text-slate-500">Track kit, medical supplies, and club equipment.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
                        <Input
                            placeholder="Search inventory..."
                            className="pl-9 w-[200px] md:w-[300px]"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                </div>
            </div>

            {/* DASHBOARD CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">Items Assigned</CardTitle>
                        <User className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{assignedItems}</div>
                        <p className="text-xs text-slate-500">Items checked out to staff/players</p>
                    </CardContent>
                </Card>
            </div>

            {/* INVENTORY LIST */}
            <Card>
                <CardHeader>
                    <CardTitle>Equipment List</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-left text-xs font-medium text-slate-500 uppercase">
                                    <th className="px-4 py-3">Item Name</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Assigned To</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-center">Quantity</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-slate-400 italic">No items found.</td>
                                    </tr>
                                )}
                                {filteredItems.map(item => (
                                    <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 font-medium">
                                            {item.name}
                                            {item.notes && <p className="text-xs text-slate-400 font-normal">{item.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700">
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.assignedTo ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                    <User className="h-3 w-3" /> {item.assignedTo}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${item.status === 'Good' ? 'bg-green-100 text-green-700' :
                                                item.status === 'Damaged' ? 'bg-red-100 text-red-700' :
                                                    'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2">
                                                <button onClick={() => adjustQuantity(item.id, -1)} className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">-</button>
                                                <span className="w-8 text-center font-bold text-slate-900">{item.quantity}</span>
                                                <button onClick={() => adjustQuantity(item.id, 1)} className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600">+</button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => startEdit(item)}>
                                                    <Pencil className="h-3 w-3" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteItem(item.id)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* ADD/EDIT MODAL */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
                        <CardHeader><CardTitle>{editingId ? 'Edit Item' : 'Add Inventory Item'}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Item Name</label>
                                <Input placeholder="e.g. Nike Match Ball" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity</label>
                                    <Input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) })} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Category</label>
                                    <select
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newItem.category}
                                        onChange={e => setNewItem({ ...newItem, category: e.target.value as any })}
                                    >
                                        {['Kit', 'Equipment', 'Medical', 'Technology', 'Other'].map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Status</label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newItem.status}
                                    onChange={e => setNewItem({ ...newItem, status: e.target.value as any })}
                                >
                                    {['Good', 'Damaged', 'Lost', 'In Use'].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Assigned To (Optional)</label>
                                <Input placeholder="Person responsible (e.g. Omar)" value={newItem.assignedTo || ''} onChange={e => setNewItem({ ...newItem, assignedTo: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Input placeholder="Optional details..." value={newItem.notes || ''} onChange={e => setNewItem({ ...newItem, notes: e.target.value })} />
                            </div>

                            <div className="flex justify-end gap-2 mt-4 pt-2">
                                <Button variant="outline" onClick={closeModal}>Cancel</Button>
                                <Button onClick={handleSaveItem}>{editingId ? 'Update Item' : 'Save Item'}</Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
