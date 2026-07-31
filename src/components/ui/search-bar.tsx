import * as React from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

export interface SearchBarProps extends React.InputHTMLAttributes<HTMLInputElement> {
    onClear?: () => void;
}

const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
    ({ className, onClear, value, ...props }, ref) => {
        const hasValue = value && value.toString().length > 0;
        
        return (
            <div className={cn("relative w-full", className)}>
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <Search className="h-4 w-4 text-muted-foreground" />
                </div>
                <Input
                    type="text"
                    className="pl-9 pr-9"
                    value={value}
                    ref={ref}
                    {...props}
                />
                {hasValue && onClear && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Clear search</span>
                    </button>
                )}
            </div>
        )
    }
)
SearchBar.displayName = "SearchBar"

export { SearchBar }
