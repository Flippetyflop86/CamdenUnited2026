import * as React from "react"
import { cn } from "@/lib/utils"

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {}

const FilterBar = React.forwardRef<HTMLDivElement, FilterBarProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "flex flex-wrap items-center gap-2 py-2",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
FilterBar.displayName = "FilterBar"

export { FilterBar }
