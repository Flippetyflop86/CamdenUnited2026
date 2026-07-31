import { cn } from "@/lib/utils";

interface SectionHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
    className?: string;
}

export function SectionHeader({
    title,
    description,
    children,
    className,
}: SectionHeaderProps) {
    return (
        <div className={cn("space-y-1 mb-4", className)}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 min-w-0">
                    <h2 className="cf-section-title text-foreground">{title}</h2>
                    {description && (
                        <p className="cf-metadata text-muted-foreground">
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
