"use client"
import * as React from "react"
import { ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"

// Simplified Select Context
interface SelectContextType {
    value: string;
    onChange: (value: string) => void;
    open: boolean;
    setOpen: (open: boolean) => void;
}
const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

const Select = ({ value, onValueChange, children }: { value: string, onValueChange: (val: string) => void, children: React.ReactNode }) => {
    const [open, setOpen] = React.useState(false);

    return (
        <SelectContext.Provider value={{ value, onChange: (v) => { onValueChange(v); setOpen(false); }, open, setOpen }}>
            <div className="relative">{children}</div>
        </SelectContext.Provider>
    );
};

const SelectTrigger = ({ className, children, ...props }: any) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectTrigger must be used within Select");

    return (
        <button
            type="button"
            onClick={() => context.setOpen(!context.open)}
            className={cn(
                "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                className
            )}
            {...props}
        >
            {children}
            <ChevronDown className="h-4 w-4 opacity-50" />
        </button>
    );
};

const SelectValue = ({ placeholder }: { placeholder?: string }) => {
    const context = React.useContext(SelectContext);
    // This is simplified; determining label from value without children inspection is hard if children are complex.
    // But usually SelectValue displays context.value directly if no placeholder logic.
    // We'll rely on the parent (user) to display meaningful text if value is simple, OR we assume values map to labels 1:1.
    // Actually, SelectItem children usually contain the label.
    // For now, let's just display the value or placeholder.
    return <span className="pointer-events-none">{context?.value || placeholder}</span>;
}

const SelectContent = ({ className, children, position = "popper", ...props }: any) => {
    const context = React.useContext(SelectContext);
    if (!context || !context.open) return null;

    return (
        <div className={cn(
            "absolute z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-80",
            position === "popper" && "translate-y-1",
            className
        )} {...props}>
            <div className="p-1">{children}</div>
        </div>
    );
};

const SelectItem = React.forwardRef<HTMLDivElement, any>(({ className, children, value, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used within Select");
    const isSelected = context.value === value;

    return (
        <div
            ref={ref}
            className={cn(
                "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 hover:bg-slate-100",
                className
            )}
            onClick={() => context.onChange(value)}
            {...props}
        >
            <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                {isSelected && <Check className="h-4 w-4" />}
            </span>
            <span className="truncate">{children}</span>
        </div>
    );
});
SelectItem.displayName = "SelectItem"

export { Select, SelectTrigger, SelectValue, SelectContent, SelectItem }
