"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Search, Pencil, User, AlertTriangle, PackageX, ShieldAlert, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { InventoryItem } from "@/types";
import { supabase } from "@/lib/supabase";

// ── Category config ──────────────────────────────────────────────────────────
const CATEGORIES = ["All", "Kit", "Equipment", "Medical", "Technology", "Other"] as const;

const CATEGORY_STYLES: Record<string, string> = {
    Kit:        "bg-blue-100 text-blue-700 border-blue-200",
    Equipment:  "bg-orange-100 text-orange-700 border-orange-200",
    Medical:    "bg-green-100 text-green-700 border-green-200",
    Technology: "bg-purple-100 text-purple-700 border-purple-200",
    Other:      "bg-slate-100 text-slate-700 border-slate-200",
};

const CATEGORY_DOT: Record<string, string> = {
    Kit:        "bg-blue-500",
    Equipment:  "bg-orange-500",
    Medical:    "bg-green-500",
    Technology: "bg-purple-500",
    Other:      "bg-slate-400",
};

const STATUS_STYLES: Record<string, string> = {
    Good:    "bg-green-100 text-green-700",
    Damaged: "bg-red-100 text-red-700",
    Lost:    "bg-gray-100 text-gray-600",
    "In Use":"bg-yellow-100 text-yellow-700",
};

// ── Sort helpers ─────────────────────────────────────────────────────────────
type SortKey = "name" | "category" | "status" | "quantity";
type SortDir = "asc" | "desc";

function sortItems(items: InventoryItem[], key: SortKey, dir: SortDir) {
    return [...items].sort((a, b) => {
        let av: any = a[key];
        let bv: any = b[key];
        if (key === "quantity") { av = Number(av); bv = Number(bv); }
        else { av = String(av ?? "").toLowerCase(); bv = String(bv ?? "").toLowerCase(); }
        if (av < bv) return dir === "asc" ? -1 : 1;
        if (av > bv) return dir === "asc" ? 1 : -1;
        return 0;
    });
}

export default function InventoryPage() {
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [categoryFilter, setCategoryFilter] = useState<string>("All");
    const [sortKey, setSortKey] = useState<SortKey>("name");
    const [sortDir, setSortDir] = useState<SortDir>("asc");

    // Modal state
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
        name: "", quantity: 1, category: "Kit", status: "Good", assignedTo: "", notes: ""
    });

    const fetchInventory = useCallback(async () => {
        const { data } = await supabase.from("inventory_items").select("*");
        if (data) {
            setItems(data.map((i: any) => ({
                id: i.id,
                name: i.name,
                quantity: i.quantity,
                category: i.category,
                status: i.status,
                assignedTo: i.assigned_to,
                notes: i.notes,
                lastUpdated: i.last_updated,
            })));
        }
    }, []);

    useEffect(() => {
        fetchInventory();
        const channel = supabase.channel("public:inventory_items")
            .on("postgres_changes", { event: "*", schema: "public", table: "inventory_items" }, fetchInventory)
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [fetchInventory]);

    const handleSaveItem = async () => {
        if (!newItem.name || (newItem.quantity ?? 0) < 0) return;
        const payload = {
            name: newItem.name,
            quantity: newItem.quantity,
            category: newItem.category,
            status: newItem.status,
            assigned_to: newItem.assignedTo,
            notes: newItem.notes,
            last_updated: new Date().toISOString(),
        };
        if (editingId) {
            await supabase.from("inventory_items").update(payload).eq("id", editingId);
        } else {
            await supabase.from("inventory_items").insert([payload]);
        }
        await fetchInventory();
        closeModal();
    };

    const deleteItem = async (id: string) => {
        if (confirm("Delete this item?")) {
            await supabase.from("inventory_items").delete().eq("id", id);
            await fetchInventory();
        }
    };

    const closeModal = () => {
        setIsAddOpen(false);
        setEditingId(null);
        setNewItem({ name: "", quantity: 1, category: "Kit", status: "Good", assignedTo: "", notes: "" });
    };

    const startEdit = (item: InventoryItem) => {
        setEditingId(item.id);
        setNewItem({ name: item.name, quantity: item.quantity, category: item.category, status: item.status, assignedTo: item.assignedTo, notes: item.notes });
        setIsAddOpen(true);
    };

    const adjustQuantity = async (id: string, delta: number) => {
        const item = items.find(i => i.id === id);
        if (!item) return;
        const newQty = Math.max(0, item.quantity + delta);
        setItems(items.map(i => i.id === id ? { ...i, quantity: newQty } : i));
        await supabase.from("inventory_items").update({ quantity: newQty }).eq("id", id);
    };

    const handleSort = (key: SortKey) => {
        if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
        else { setSortKey(key); setSortDir("asc"); }
    };

    // ── Derived state ────────────────────────────────────────────────────────
    const totalItems   = items.reduce((s, i) => s + i.quantity, 0);
    const damagedCount = items.filter(i => i.status === "Damaged").length;
    const lostCount    = items.filter(i => i.status === "Lost").length;
    const assignedCount = items.filter(i => i.assignedTo?.trim()).length;

    const filtered = sortItems(
        items.filter(i => {
            const matchSearch = i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.category.toLowerCase().includes(searchTerm.toLowerCase());
            const matchCat = categoryFilter === "All" || i.category === categoryFilter;
            return matchSearch && matchCat;
        }),
        sortKey, sortDir
    );

    // ── Sort icon helper ─────────────────────────────────────────────────────
    const SortIcon = ({ col }: { col: SortKey }) => {
        if (sortKey !== col) return <ArrowUpDown className="h-3 w-3 ml-1 text-slate-400" />;
        return sortDir === "asc"
            ? <ArrowUp className="h-3 w-3 ml-1 text-slate-700" />
            : <ArrowDown className="h-3 w-3 ml-1 text-slate-700" />;
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900">Inventory</h2>
                    <p className="text-slate-500">Track kit, equipment, and supplies.</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search inventory..."
                            className="pl-9 w-[200px] md:w-[260px]"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <Button onClick={() => setIsAddOpen(true)} className="bg-slate-900 text-white hover:bg-slate-800">
                        <Plus className="h-4 w-4 mr-2" /> Add Item
                    </Button>
                </div>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Items</CardTitle>
                        <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center">
                            <span className="text-slate-600 text-xs font-bold">#</span>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-900">{totalItems}</div>
                        <p className="text-xs text-slate-500 mt-0.5">{items.length} unique {items.length === 1 ? "item" : "items"}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assigned Out</CardTitle>
                        <div className="h-7 w-7 rounded-lg bg-blue-50 flex items-center justify-center">
                            <User className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{assignedCount}</div>
                        <p className="text-xs text-slate-500 mt-0.5">Items with a named holder</p>
                    </CardContent>
                </Card>

                <Card className={damagedCount > 0 ? "border-red-200" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Damaged</CardTitle>
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${damagedCount > 0 ? "bg-red-50" : "bg-slate-50"}`}>
                            <ShieldAlert className={`h-3.5 w-3.5 ${damagedCount > 0 ? "text-red-500" : "text-slate-400"}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${damagedCount > 0 ? "text-red-600" : "text-slate-400"}`}>{damagedCount}</div>
                        <p className="text-xs text-slate-500 mt-0.5">Items marked as damaged</p>
                    </CardContent>
                </Card>

                <Card className={lostCount > 0 ? "border-gray-300" : ""}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wide">Lost</CardTitle>
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${lostCount > 0 ? "bg-gray-100" : "bg-slate-50"}`}>
                            <PackageX className={`h-3.5 w-3.5 ${lostCount > 0 ? "text-gray-600" : "text-slate-400"}`} />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${lostCount > 0 ? "text-gray-700" : "text-slate-400"}`}>{lostCount}</div>
                        <p className="text-xs text-slate-500 mt-0.5">Items reported lost</p>
                    </CardContent>
                </Card>
            </div>

            {/* Category filter tabs */}
            <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setCategoryFilter(cat)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                            categoryFilter === cat
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                        {cat !== "All" && (
                            <span className={`h-2 w-2 rounded-full ${CATEGORY_DOT[cat] ?? "bg-slate-400"}`} />
                        )}
                        {cat}
                        {cat !== "All" && (
                            <span className={`text-xs ml-0.5 ${categoryFilter === cat ? "text-slate-300" : "text-slate-400"}`}>
                                {items.filter(i => i.category === cat).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Inventory table */}
            <Card>
                <CardContent className="p-0">
                    {/* Desktop */}
                    <div className="hidden md:block rounded-md overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b">
                                <tr className="text-left text-xs font-medium text-slate-500 uppercase">
                                    {([
                                        ["name",     "Item Name"],
                                        ["category", "Category"],
                                        ["status",   "Status"],
                                        ["quantity", "Quantity"],
                                    ] as [SortKey, string][]).map(([key, label]) => (
                                        <th
                                            key={key}
                                            className="px-4 py-3 cursor-pointer hover:text-slate-800 select-none"
                                            onClick={() => handleSort(key)}
                                        >
                                            <span className="flex items-center">
                                                {label}<SortIcon col={key} />
                                            </span>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3">Assigned To</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">No items found.</td>
                                    </tr>
                                )}
                                {filtered.map(item => (
                                    <tr key={item.id} className={`hover:bg-slate-50 transition-colors ${item.quantity === 0 ? "bg-red-50/40" : ""}`}>
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-slate-900 flex items-center gap-2">
                                                {item.name}
                                                {item.quantity === 0 && (
                                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase tracking-wide">Out of Stock</span>
                                                )}
                                            </div>
                                            {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[item.category] ?? "bg-slate-100 text-slate-700"}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[item.category] ?? "bg-slate-400"}`} />
                                                {item.category}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-600"}`}>
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    onClick={() => adjustQuantity(item.id, -1)}
                                                    className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold disabled:opacity-30"
                                                    disabled={item.quantity === 0}
                                                >−</button>
                                                <span className={`w-8 text-center font-bold ${item.quantity === 0 ? "text-red-500" : "text-slate-900"}`}>
                                                    {item.quantity}
                                                </span>
                                                <button
                                                    onClick={() => adjustQuantity(item.id, 1)}
                                                    className="h-6 w-6 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold"
                                                >+</button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            {item.assignedTo ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                                    <User className="h-3 w-3" /> {item.assignedTo}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 text-xs">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => startEdit(item)}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteItem(item.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile */}
                    <div className="md:hidden divide-y divide-slate-100">
                        {filtered.length === 0 && (
                            <div className="text-center py-10 text-slate-400 italic">No items found.</div>
                        )}
                        {filtered.map(item => (
                            <div key={item.id} className={`p-4 flex flex-col gap-3 ${item.quantity === 0 ? "bg-red-50/40" : ""}`}>
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                                            {item.name}
                                            {item.quantity === 0 && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-600 uppercase">Out of Stock</span>
                                            )}
                                        </h3>
                                        {item.notes && <p className="text-xs text-slate-400 mt-0.5">{item.notes}</p>}
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-500" onClick={() => startEdit(item)}>
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteItem(item.id)}>
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2 items-center">
                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${CATEGORY_STYLES[item.category] ?? "bg-slate-100 text-slate-700"}`}>
                                        <span className={`h-1.5 w-1.5 rounded-full ${CATEGORY_DOT[item.category] ?? "bg-slate-400"}`} />
                                        {item.category}
                                    </span>
                                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-600"}`}>
                                        {item.status}
                                    </span>
                                    {item.assignedTo && (
                                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                                            <User className="h-3 w-3" /> {item.assignedTo}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between border-t pt-3">
                                    <span className="text-xs font-semibold text-slate-500">Quantity</span>
                                    <div className="flex items-center gap-2">
                                        <button onClick={() => adjustQuantity(item.id, -1)} disabled={item.quantity === 0}
                                            className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold disabled:opacity-30">−</button>
                                        <span className={`w-8 text-center font-bold ${item.quantity === 0 ? "text-red-500" : "text-slate-900"}`}>{item.quantity}</span>
                                        <button onClick={() => adjustQuantity(item.id, 1)}
                                            className="h-7 w-7 rounded bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 font-bold">+</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Add / Edit modal */}
            {isAddOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <Card className="w-full max-w-md">
                        <CardHeader className="border-b bg-slate-50 p-4 flex flex-row items-center justify-between">
                            <h3 className="font-semibold text-lg">{editingId ? "Edit Item" : "Add Inventory Item"}</h3>
                            <button onClick={closeModal} className="text-slate-400 hover:text-slate-700">✕</button>
                        </CardHeader>
                        <CardContent className="space-y-4 p-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Item Name</label>
                                <Input placeholder="e.g. Nike Match Ball" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Quantity</label>
                                    <Input type="number" min={0} value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 0 })} />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-medium">Category</label>
                                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value as InventoryItem["category"] })}>
                                        {["Kit", "Equipment", "Medical", "Technology", "Other"].map(c => <option key={c}>{c}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Status</label>
                                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={newItem.status} onChange={e => setNewItem({ ...newItem, status: e.target.value as InventoryItem["status"] })}>
                                    {["Good", "In Use", "Damaged", "Lost"].map(s => <option key={s}>{s}</option>)}
                                </select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Assigned To <span className="text-slate-400 font-normal">(optional)</span></label>
                                <Input placeholder="e.g. Omar" value={newItem.assignedTo || ""} onChange={e => setNewItem({ ...newItem, assignedTo: e.target.value })} />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-medium">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                                <Input placeholder="Any extra details..." value={newItem.notes || ""} onChange={e => setNewItem({ ...newItem, notes: e.target.value })} />
                            </div>

                            <div className="flex justify-end gap-2 pt-2 border-t">
                                <Button variant="outline" onClick={closeModal}>Cancel</Button>
                                <Button onClick={handleSaveItem} disabled={!newItem.name}>
                                    {editingId ? "Save Changes" : "Add Item"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
