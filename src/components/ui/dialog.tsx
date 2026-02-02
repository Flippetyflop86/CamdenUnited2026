"use client"
import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// Simplified Dialog Context
interface DialogContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
}
const DialogContext = React.createContext<DialogContextType | undefined>(undefined);

const Dialog = ({ open, onOpenChange, children }: { open?: boolean, onOpenChange?: (open: boolean) => void, children: React.ReactNode }) => {
    const [isOpenState, setIsOpenState] = React.useState(false);
    const isControlled = open !== undefined;
    const isOpen = isControlled ? open : isOpenState;
    const setOpen = (newOpen: boolean) => {
        if (!isControlled) setIsOpenState(newOpen);
        if (onOpenChange) onOpenChange(newOpen);
    };

    return (
        <DialogContext.Provider value={{ open: !!isOpen, setOpen }}>
            {children}
        </DialogContext.Provider>
    );
};

const DialogTrigger = ({ asChild, children, ...props }: any) => {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogTrigger must be used within Dialog");

    const handleClick = (e: React.MouseEvent) => {
        // Call existing onClick if present (children props)
        if (children.props.onClick) children.props.onClick(e);
        context.setOpen(true);
    };

    if (asChild) {
        return React.cloneElement(children, { ...props, onClick: handleClick });
    }
    return <button onClick={handleClick} {...props}>{children}</button>;
};

const DialogContent = ({ className, children, ...props }: any) => {
    const context = React.useContext(DialogContext);
    if (!context) throw new Error("DialogContent must be used within Dialog");
    if (!context.open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center sm:items-center">
            <div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity animate-in fade-in"
                onClick={() => context.setOpen(false)}
            />
            <div className={cn(
                "z-50 grid w-full max-w-lg scale-100 gap-4 border bg-white p-6 shadow-lg duration-200 animate-in fade-in-90 sm:rounded-lg md:w-full",
                className
            )} {...props}>
                {children}
                <button
                    className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
                    onClick={() => context.setOpen(false)}
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
            </div>
        </div>
    );
};

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);

const DialogTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-semibold leading-none tracking-tight", className)} {...props} />
));
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = "DialogDescription";

export { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription };
