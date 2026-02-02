import * as React from "react"
import { cn } from "@/lib/utils"

// Since I haven't installed @radix-ui/react-avatar yet, I will create a simple version 
// to avoid build errors, or I can install it. 
// Actually, earlier the user approved using shadcn or similar. 
// I'll stick to simple HTML implementations for now to avoid dependency hell if I can 
// or I should just install them. 
// Let's implement a simple version first since I want to be fast and not blocked by npm.

const Avatar = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full",
            className
        )}
        {...props}
    />
))
Avatar.displayName = "Avatar"

const AvatarImage = React.forwardRef<
    HTMLImageElement,
    React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
        ref={ref}
        className={cn("aspect-square h-full w-full", className)}
        {...props}
        alt={props.alt || "Avatar"}
    />
))
AvatarImage.displayName = "AvatarImage"

const AvatarFallback = React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
    <div
        ref={ref}
        className={cn(
            "flex h-full w-full items-center justify-center rounded-full bg-muted",
            className
        )}
        {...props}
    />
))
AvatarFallback.displayName = "AvatarFallback"

export { Avatar, AvatarImage, AvatarFallback }
