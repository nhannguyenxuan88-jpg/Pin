import React, { forwardRef } from "react";
import { cn } from "../../lib/utils/cn";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ className, label, error, leftIcon, rightIcon, hint, id, ...props }, ref) => {
        const inputId = id || React.useId();

        return (
            <div className="w-full">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-sm font-medium text-pin-gray-700 dark:text-pin-dark-700 mb-1"
                    >
                        {label}
                        {props.required && <span className="text-pin-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className="relative">
                    {leftIcon && (
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-pin-gray-500 dark:text-pin-dark-500">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        id={inputId}
                        ref={ref}
                        className={cn(
                            "w-full px-4 py-2.5",
                            "bg-white dark:bg-pin-dark-200",
                            "border rounded-lg",
                            "text-pin-gray-900 dark:text-pin-dark-900",
                            "placeholder:text-pin-gray-400 dark:placeholder:text-pin-dark-500",
                            "focus:outline-none focus:ring-2 focus:ring-pin-blue-500 focus:border-transparent",
                            "transition-all duration-200",
                            "disabled:bg-pin-gray-100 dark:disabled:bg-pin-dark-100 disabled:text-pin-gray-500 disabled:cursor-not-allowed",
                            error
                                ? "border-pin-red-500 focus:ring-pin-red-500"
                                : "border-pin-gray-300 dark:border-pin-dark-400",
                            leftIcon ? "pl-10" : "",
                            rightIcon ? "pr-10" : "",
                            className
                        )}
                        {...props}
                    />
                    {rightIcon && (
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center text-pin-gray-500 dark:text-pin-dark-500">
                            {rightIcon}
                        </div>
                    )}
                </div>
                {(hint || error) && (
                    <p
                        className={cn(
                            "text-xs mt-1",
                            error ? "text-pin-red-600 dark:text-pin-red-400" : "text-pin-gray-500 dark:text-pin-dark-500"
                        )}
                    >
                        {error || hint}
                    </p>
                )}
            </div>
        );
    }
);

Input.displayName = "Input";
