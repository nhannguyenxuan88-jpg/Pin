import React from "react";
import { cn } from "../../lib/utils/cn";
import type { IconProps as PhosphorIconProps } from "phosphor-react";
import {
  ArrowsClockwise,
  Bank,
  Buildings,
  CalendarBlank,
  ChartBar,
  ChartPie,
  CheckCircle,
  ClipboardText,
  Clock,
  Coins,
  Cube,
  CurrencyDollarSimple,
  DeviceMobile,
  Gear,
  IdentificationCard,
  Info,
  MagnifyingGlass,
  Money,
  Package,
  PencilSimple,
  PhoneCall,
  Plus,
  Prohibit,
  Sparkle,
  Storefront,
  Tag,
  Trash,
  TrendDown,
  TrendUp,
  UsersThree,
  Warning,
  WarningCircle,
  Wrench,
  X,
  XCircle,
} from "phosphor-react";

type PhosphorIconComponent = React.ComponentType<PhosphorIconProps>;

export const ICON_REGISTRY = {
  overview: ChartPie,
  assets: Buildings,
  cashflow: CurrencyDollarSimple,
  ratios: ChartBar,
  sales: ChartPie,
  capital: Money,
  equity: Bank,
  workingCapital: Money,
  repairs: Wrench,
  orders: ClipboardText,
  pending: Clock,
  success: CheckCircle,
  warning: Warning,
  danger: Prohibit,
  info: Info,
  phone: PhoneCall,
  device: DeviceMobile,
  technician: IdentificationCard,
  close: X,
  search: MagnifyingGlass,
  add: Plus,
  edit: PencilSimple,
  delete: Trash,
  customers: UsersThree,
  stock: Cube,
  progressUp: TrendUp,
  progressDown: TrendDown,
  calendar: CalendarBlank,
  highlight: Sparkle,
  money: CurrencyDollarSimple,
  cube: Cube,
  package: Package,
  tag: Tag,
  "chart-bar": ChartBar,
  coins: Coins,
  gear: Gear,
  trash: Trash,
  pencil: PencilSimple,
  "arrows-clockwise": ArrowsClockwise,
  storefront: Storefront,
  "warning-circle": WarningCircle,
  "check-circle": CheckCircle,
  "x-circle": XCircle,
} as const satisfies Record<string, PhosphorIconComponent>;

export type IconName = keyof typeof ICON_REGISTRY;
export type IconTone =
  | "default"
  | "muted"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "contrast"
  | "mutedContrast";
export type IconSize = "sm" | "md" | "lg" | "xl";

const sizeValues: Record<IconSize, number> = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
};

const toneClasses: Record<IconTone, string> = {
  default: "text-pin-gray-600 dark:text-pin-dark-300",
  muted: "text-pin-gray-400 dark:text-pin-dark-500",
  primary: "text-pin-blue-600 dark:text-pin-blue-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-yellow-600 dark:text-yellow-400",
  danger: "text-red-600 dark:text-red-400",
  info: "text-blue-600 dark:text-blue-400",
  contrast: "text-white",
  mutedContrast: "text-white/80",
};

type BaseIconProps = Omit<PhosphorIconProps, "size" | "weight">;

export interface StandardIconProps extends BaseIconProps {
  name: IconName;
  tone?: IconTone;
  size?: IconSize;
  weight?: PhosphorIconProps["weight"];
}

export const Icon: React.FC<StandardIconProps> = ({
  name,
  tone,
  size = "md",
  weight = "duotone",
  className,
  ...props
}) => {
  const IconComponent = ICON_REGISTRY[name];

  return (
    <IconComponent
      {...props}
      weight={weight}
      size={sizeValues[size]}
      className={cn(
        "shrink-0",
        tone ? toneClasses[tone] : undefined,
        className
      )}
    />
  );
};
