import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: React.ReactNode;
    className?: string;
}

export function EmptyState({
    icon: Icon,
    title,
    description,
    action,
    className,
}: EmptyStateProps) {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center",
                className
            )}
        >
            {Icon && (
                <div className="mb-4 rounded-full bg-card border border-border p-4">
                    <Icon className="h-6 w-6 text-muted-foreground stroke-1" />
                </div>
            )}
            <h3 className="cf-card-title text-foreground">{title}</h3>
            {description && (
                <p className="mt-2 cf-metadata text-muted-foreground max-w-md">
                    {description}
                </p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}
