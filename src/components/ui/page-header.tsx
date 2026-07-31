import { cn } from "@/lib/utils";

interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}

export function PageHeader({
    title,
    description,
    children,
    className,
}: PageHeaderProps) {
    return (
        <div className={cn("space-y-1", className)}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 min-w-0">
                    <h1 className="cf-display text-foreground">{title}</h1>
                    {description && (
                        <p className="cf-supporting text-muted-foreground">
                            {description}
                        </p>
                    )}
                </div>
                {children && (
                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {children}
                    </div>
                )}
            </div>
        </div>
    );
}
