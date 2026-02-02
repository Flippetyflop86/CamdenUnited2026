"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

// Simple tabs implementation if I don't want to install radix right now. 
// But Radix is great for accessibility. 
// I will create a simple version to match the "no extra install if possible" speed, 
// but actually I should probably install them. 
// Given the previous error with @radix-ui/react-slot, I'll stick to manual simple implementation for speed 
// and to avoid peer dependency issues, or I will install generic headless UI.
// Let's build a simple custom one.

interface TabsProps {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
    className?: string;
    children: React.ReactNode;
}

const TabsContext = React.createContext<{
    activeTab: string;
    setActiveTab: (value: string) => void;
} | null>(null);

export function Tabs({ defaultValue, value, onValueChange, className, children }: TabsProps) {
    const [internalTab, setInternalTab] = React.useState(defaultValue || "");

    const activeTab = value !== undefined ? value : internalTab;

    const setActiveTab = (newValue: string) => {
        if (onValueChange) {
            onValueChange(newValue);
        }
        if (value === undefined) {
            setInternalTab(newValue);
        }
    };

    return (
        <TabsContext.Provider value={{ activeTab, setActiveTab }}>
            <div className={className}>{children}</div>
        </TabsContext.Provider>
    );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
    return (
        <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}>
            {children}
        </div>
    );
}

export function TabsTrigger({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsTrigger must be used within Tabs");

    const isActive = context.activeTab === value;

    return (
        <button
            className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                isActive && "bg-background text-foreground shadow-sm",
                className
            )}
            onClick={() => context.setActiveTab(value)}
        >
            {children}
        </button>
    );
}

export function TabsContent({ value, className, children }: { value: string; className?: string; children: React.ReactNode }) {
    const context = React.useContext(TabsContext);
    if (!context) throw new Error("TabsContent must be used within Tabs");

    if (context.activeTab !== value) return null;

    return (
        <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
            {children}
        </div>
    );
}
