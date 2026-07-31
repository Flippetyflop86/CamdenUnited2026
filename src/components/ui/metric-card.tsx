import * as React from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface MetricCardProps {
    title: string;
    value: string | number;
    icon?: React.ReactNode;
    accent?: "brand" | "success" | "warning" | "error" | "info" | "neutral";
    trend?: {
        value: number;
        direction: "up" | "down";
        label?: string;
    };
    description?: string;
    className?: string;
}

const accentColors: Record<string, string> = {
    brand:   "text-brand",
    success: "text-status-success",
    warning: "text-status-warning",
    error:   "text-status-error",
    info:    "text-status-info",
    neutral: "text-muted-foreground",
};

function MetricCard({
    title,
    value,
    icon,
    accent = "neutral",
    trend,
    description,
    className,
}: MetricCardProps) {
    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-6 space-y-3",
                className
            )}
        >
            <div className="flex items-center justify-between">
                <span className="cf-label text-muted-foreground">{title}</span>
                {icon && (
                    <div className={cn("shrink-0", accentColors[accent])}>
                        {icon}
                    </div>
                )}
            </div>

            <div className="space-y-1">
                <div className="cf-metric text-foreground">{value}</div>

                {(trend || description) && (
                    <div className="flex items-center gap-1.5">
                        {trend && (
                            <span
                                className={cn(
                                    "inline-flex items-center gap-0.5 text-xs font-medium",
                                    trend.direction === "up"
                                        ? "text-status-success"
                                        : "text-status-error"
                                )}
                            >
                                {trend.direction === "up" ? (
                                    <TrendingUp className="h-3 w-3" />
                                ) : (
                                    <TrendingDown className="h-3 w-3" />
                                )}
                                {trend.value > 0 ? "+" : ""}
                                {trend.value}
                                {trend.label && (
                                    <span className="text-muted-foreground ml-1">
                                        {trend.label}
                                    </span>
                                )}
                            </span>
                        )}
                        {description && !trend && (
                            <span className="text-xs text-muted-foreground">
                                {description}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export { MetricCard };
export type { MetricCardProps };
