import * as React from "react"
import { cn } from "@/lib/utils"

export interface ActionBarProps extends React.HTMLAttributes<HTMLDivElement> {}

const ActionBar = React.forwardRef<HTMLDivElement, ActionBarProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex flex-col gap-4 sm:flex-row sm:items-center justify-between rounded border bg-card p-4 cf-elevated mb-6",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
ActionBar.displayName = "ActionBar"

export { ActionBar }
