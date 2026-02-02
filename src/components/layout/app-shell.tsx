import { Sidebar } from "@/components/layout/sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen w-full bg-slate-50">
            <aside className="hidden h-full w-64 flex-shrink-0 md:block">
                <Sidebar />
            </aside>
            <main className="flex-1 overflow-y-auto p-4 md:p-8">
                {children}
            </main>
        </div>
    );
}
