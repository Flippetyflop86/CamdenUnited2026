import { cn } from "@/lib/utils";

type StatusVariant = "success" | "warning" | "error" | "info" | "neutral" | "brand";

interface StatusBadgeProps {
    variant?: StatusVariant;
    children: React.ReactNode;
    className?: string;
    dot?: boolean;
    size?: "sm" | "md";
}

const variantStyles: Record<StatusVariant, string> = {
    success: "bg-status-success/10 text-status-success border-status-success/20",
    warning: "bg-status-warning/10 text-status-warning border-status-warning/20",
    error:   "bg-status-error/10 text-status-error border-status-error/20",
    info:    "bg-status-info/10 text-status-info border-status-info/20",
    neutral: "bg-muted text-muted-foreground border-border",
    brand:   "bg-brand/10 text-brand border-brand/20",
};

const dotColors: Record<StatusVariant, string> = {
    success: "bg-status-success",
    warning: "bg-status-warning",
    error:   "bg-status-error",
    info:    "bg-status-info",
    neutral: "bg-muted-foreground",
    brand:   "bg-brand",
};

export function StatusBadge({
    variant = "neutral",
    children,
    className,
    dot = false,
    size = "sm",
}: StatusBadgeProps) {
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border font-semibold",
                size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
                variantStyles[variant],
                className
            )}
        >
            {dot && (
                <span
                    className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        dotColors[variant]
                    )}
                />
            )}
            {children}
        </span>
    );
}
