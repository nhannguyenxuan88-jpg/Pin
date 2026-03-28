import React from "react";
import { cn } from "../../lib/utils/cn";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    variant?: "text" | "circular" | "rectangular" | "rounded";
    animation?: "pulse" | "wave" | "none";
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className,
    variant = "text",
    animation = "pulse",
    ...props
}) => {
    const baseClass = "bg-pin-gray-200 dark:bg-pin-dark-300";

    const variants = {
        text: "h-4 w-full rounded",
        circular: "rounded-full",
        rectangular: "",
        rounded: "rounded-md",
    };

    const animations = {
        pulse: "animate-pulse",
        wave: "animate-shimmer bg-gradient-to-r from-pin-gray-200 via-pin-gray-300 to-pin-gray-200 dark:from-pin-dark-300 dark:via-pin-dark-400 dark:to-pin-dark-300 bg-[length:400%_100%]",
        none: "",
    };

    return (
        <div
            className={cn(baseClass, variants[variant], animations[animation], className)}
            {...props}
        />
    );
};
