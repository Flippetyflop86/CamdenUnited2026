import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageContainerProps extends React.HTMLAttributes<HTMLDivElement> {}

const PageContainer = React.forwardRef<HTMLDivElement, PageContainerProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <div
                ref={ref}
                className={cn(
                    "w-full max-w-[1920px] mx-auto space-y-8",
                    className
                )}
                {...props}
            >
                {children}
            </div>
        )
    }
)
PageContainer.displayName = "PageContainer"

export { PageContainer }
