import * as React from "react"
import { cn } from "@/lib/utils"

export interface PageSectionProps extends React.HTMLAttributes<HTMLSelectElement> {}

const PageSection = React.forwardRef<HTMLElement, PageSectionProps>(
    ({ className, children, ...props }, ref) => {
        return (
            <section
                ref={ref}
                className={cn(
                    "flex flex-col space-y-4",
                    className
                )}
                {...props}
            >
                {children}
            </section>
        )
    }
)
PageSection.displayName = "PageSection"

export { PageSection }
