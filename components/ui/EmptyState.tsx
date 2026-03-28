import React from "react";
import { cn } from "../../lib/utils/cn";
import { Icon, IconName, IconTone } from "../common/Icon";

export interface EmptyStateProps {
    title: string;
    description?: string;
    icon?: IconName;
    iconTone?: IconTone;
    action?: React.ReactNode;
    className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
    title,
    description,
    icon = "info",
    iconTone = "muted",
    action,
    className,
}) => {
    return (
        <div
            className={cn(
                "flex flex-col items-center justify-center p-8 text-center",
                "bg-pin-gray-50/50 dark:bg-pin-dark-200/50",
                "border border-dashed border-pin-gray-300 dark:border-pin-dark-400",
                "rounded-xl min-h-[200px]",
                className
            )}
        >
            <div className="w-16 h-16 rounded-full bg-pin-gray-100 dark:bg-pin-dark-300 flex items-center justify-center mb-4 text-pin-gray-400 dark:text-pin-dark-500">
                <Icon name={icon} size="xl" tone={iconTone} />
            </div>
            <h3 className="text-lg font-semibold text-pin-gray-900 dark:text-pin-dark-900 mb-2">
                {title}
            </h3>
            {description && (
                <p className="text-sm text-pin-gray-500 dark:text-pin-dark-500 max-w-sm mx-auto mb-6">
                    {description}
                </p>
            )}
            {action && <div>{action}</div>}
        </div>
    );
};
