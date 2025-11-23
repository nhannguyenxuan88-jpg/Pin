import React from "react";
import { cn } from "../../lib/utils/cn";
import { Icon, IconName, IconTone, IconSize } from "../common/Icon";

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
  hover?: boolean;
  onClick?: () => void;
}

const paddingClasses = {
  none: "p-0",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export const Card: React.FC<CardProps> = ({
  children,
  className,
  padding = "md",
  hover = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-white dark:bg-pin-dark-200",
        "rounded-xl",
        "shadow-sm",
        "border border-pin-gray-200 dark:border-pin-dark-300",
        "transition-all duration-200",
        "overflow-hidden",
        paddingClasses[padding],
        hover && "hover:shadow-md cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
};

export interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "border-b border-pin-gray-200 dark:border-pin-dark-300",
        "pb-4 mb-4",
        className
      )}
    >
      {children}
    </div>
  );
};

export interface CardTitleProps {
  children: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const CardTitle: React.FC<CardTitleProps> = ({
  children,
  subtitle,
  icon,
  action,
  className,
}) => {
  return (
    <div className={cn("flex items-start justify-between", className)}>
      <div className="flex items-center gap-3 flex-1">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-pin-blue-50 dark:bg-pin-blue-900/20 flex items-center justify-center text-pin-blue-600 dark:text-pin-blue-400">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-pin-gray-900 dark:text-pin-dark-900">
            {children}
          </h3>
          {subtitle && (
            <p className="text-sm text-pin-gray-500 dark:text-pin-dark-500 mt-1">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {action && <div className="flex-shrink-0 ml-4">{action}</div>}
    </div>
  );
};

export interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};

export interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({
  children,
  className,
}) => {
  return (
    <div
      className={cn(
        "border-t border-pin-gray-200 dark:border-pin-dark-300",
        "pt-4 mt-4",
        className
      )}
    >
      {children}
    </div>
  );
};

// Stats Card Component
export interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: React.ReactNode;
  iconName?: IconName;
  iconTone?: IconTone;
  iconSize?: IconSize;
  trend?: {
    value: number;
    label: string;
  };
  variant?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
  valueClassName?: string;
  compact?: boolean; // Compact mode for cards with simple numbers
}

const variantClasses = {
  default: "from-pin-gray-500 to-pin-gray-600",
  primary: "from-pin-blue-500 to-pin-blue-600",
  success: "from-pin-green-500 to-pin-green-600",
  warning: "from-pin-orange-500 to-pin-orange-600",
  danger: "from-pin-red-500 to-pin-red-600",
};

export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  iconName,
  iconTone,
  iconSize,
  trend,
  variant = "primary",
  className,
  valueClassName,
  compact = false,
}) => {
  const resolvedIcon =
    icon ||
    (iconName ? (
      <Icon
        name={iconName}
        tone={iconTone ?? "contrast"}
        size={iconSize ?? (compact ? "md" : "lg")}
        className="drop-shadow-sm"
      />
    ) : null);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        "bg-gradient-to-br",
        variantClasses[variant],
        "text-white",
        "rounded-lg sm:rounded-xl",
        compact ? "p-2 sm:p-2.5 md:p-3" : "p-3 sm:p-4 md:p-5 lg:p-6",
        "shadow-lg",
        className
      )}
    >
      {/* Decorative background element */}
      <div
        className={cn(
          "absolute bg-white/10 rounded-full",
          compact
            ? "-right-1 -top-1 w-8 h-8 sm:w-12 sm:h-12"
            : "-right-2 -top-2 sm:-right-4 sm:-top-4 w-16 h-16 sm:w-24 sm:h-24"
        )}
      />
      <div
        className={cn(
          "absolute bg-white/5 rounded-full",
          compact
            ? "-right-2 -bottom-2 w-10 h-10 sm:w-14 sm:h-14"
            : "-right-3 -bottom-3 sm:-right-6 sm:-bottom-6 w-20 h-20 sm:w-32 sm:h-32"
        )}
      />

      <div className="relative z-10">
        <div
          className={cn(
            "flex items-start justify-between",
            compact ? "gap-1 mb-1" : "gap-2 mb-2 sm:mb-3"
          )}
        >
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                "text-white/80 font-medium leading-tight",
                compact
                  ? "text-[10px] sm:text-xs mb-0.5 truncate"
                  : "text-xs sm:text-sm mb-1 truncate"
              )}
            >
              {title}
            </p>
            <p
              className={cn(
                "font-bold leading-tight",
                compact
                  ? "text-xl sm:text-2xl"
                  : "text-sm sm:text-base md:text-lg lg:text-xl break-words",
                valueClassName
              )}
            >
              {value}
            </p>
          </div>
          {resolvedIcon && (
            <div
              className={cn(
                "flex-shrink-0 rounded-md bg-white/20 flex items-center justify-center",
                compact
                  ? "w-8 h-8 sm:w-10 sm:h-10"
                  : "w-10 h-10 sm:w-12 sm:h-12"
              )}
            >
              <div className={cn(compact ? "scale-75" : "scale-90")}>
                {resolvedIcon}
              </div>
            </div>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-1.5 text-xs">
            <span
              className={cn(
                "font-semibold",
                trend.value >= 0 ? "text-white" : "text-white/70"
              )}
            >
              {trend.value >= 0 ? "↗" : "↘"} {Math.abs(trend.value)}%
            </span>
            <span className="text-white/70 truncate">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Grid layout for cards
export interface CardGridProps {
  children: React.ReactNode;
  cols?: 1 | 2 | 3 | 4 | 6;
  className?: string;
}

const gridColsClasses = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  6: "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6",
};

export const CardGrid: React.FC<CardGridProps> = ({
  children,
  cols = 3,
  className,
}) => {
  return (
    <div
      className={cn(
        "grid gap-3 sm:gap-4 md:gap-6",
        gridColsClasses[cols],
        className
      )}
    >
      {children}
    </div>
  );
};
