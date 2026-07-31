"use client"
import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

interface SheetContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
}
const SheetContext = React.createContext<SheetContextType | undefined>(undefined);

const Sheet = ({ open, onOpenChange, children }: { open?: boolean, onOpenChange?: (open: boolean) => void, children: React.ReactNode }) => {
    const [isOpenState, setIsOpenState] = React.useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : isOpenState;
    const setOpen = (newOpen: boolean) => {
        if (!isControlled) setIsOpenState(newOpen);
        if (onOpenChange) onOpenChange(newOpen);
    };

    return (
        <SheetContext.Provider value={{ open: !!isOpen, setOpen }}>
            {children}
        </SheetContext.Provider>
    );
};

const SheetTrigger = ({ asChild, children, ...props }: any) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error("SheetTrigger must be used within Sheet");

    const handleClick = (e: React.MouseEvent) => {
        if (children.props.onClick) children.props.onClick(e);
        context.setOpen(true);
    };

    if (asChild) {
        return React.cloneElement(children, { ...props, onClick: handleClick });
    }
    return <button onClick={handleClick} {...props}>{children}</button>;
};

const SheetContent = ({ className, children, side = "right", ...props }: any) => {
    const context = React.useContext(SheetContext);
    if (!context) throw new Error("SheetContent must be used within Sheet");
    if (!context.open) return null;

    const sideClasses = {
        top: "inset-x-0 top-0 border-b data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top",
        bottom: "inset-x-0 bottom-0 border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        left: "inset-y-0 left-0 h-full w-3/4 border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left sm:max-w-sm",
        right: "inset-y-0 right-0 h-full w-3/4 border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right sm:max-w-sm",
    };

    return (
        <div className="fixed inset-0 z-50 flex">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={() => context.setOpen(false)}
            />
            <div className={cn(
                "fixed z-50 gap-4 bg-popover p-6 cf-elevated transition ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out duration-300",
                sideClasses[side as keyof typeof sideClasses],
                className
            )} {...props}>
                {children}
                <button
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-secondary"
                    onClick={() => context.setOpen(false)}
                >
                    <X className="h-4 w-4 text-foreground" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>
    );
};

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-2 text-center sm:text-left", className)} {...props} />
);

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const SheetTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("cf-section-title text-foreground", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

const SheetDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
    <p ref={ref} className={cn("cf-metadata text-muted-foreground", className)} {...props} />
));
SheetDescription.displayName = "SheetDescription";

export { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
