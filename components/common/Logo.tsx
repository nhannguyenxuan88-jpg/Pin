import React, { useMemo, useState } from "react";
import { usePinStandaloneContext } from "../../contexts/PinProviderStandalone";

export interface LogoProps {
  src?: string; // Optional explicit src override
  alt?: string;
  size?: number; // height in px; width auto
  className?: string;
  rounded?: boolean;
}

/**
 * Small logo component that prefers per-branch logoUrl from StoreSettings,
 * falls back to `/nhan-lam-logo.png` in /public, and finally text initials.
 */
export const Logo: React.FC<LogoProps> = ({
  src,
  alt,
  size = 36,
  className = "",
  rounded = false,
}) => {
  const { storeSettings, currentBranchId } = usePinStandaloneContext();
  const [broken, setBroken] = useState(false);

  const computedSrc = useMemo(() => {
    if (src) return src;
    const branch = storeSettings?.branches?.find?.(
      (b) => b.id === currentBranchId
    );
    // Prefer branch-specific logoUrl, else global default path in public/
    return (branch?.logoUrl || "/nhan-lam-logo.png") as string;
  }, [src, storeSettings, currentBranchId]);

  const title = alt || storeSettings?.name || "Logo";

  if (broken) {
    // Fallback: simple initials circle when image not available
    const initials = (storeSettings?.name || "SmartCare")
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return (
      <div
        className={`flex items-center justify-center bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold ${className}`}
        style={{ width: size, height: size, borderRadius: rounded ? size : 8 }}
        title={title}
        aria-label={title}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={computedSrc}
      alt={title}
      width={size}
      height={size}
      onError={() => setBroken(true)}
      className={`${
        rounded ? "rounded-full" : "rounded-md"
      } object-contain ${className}`}
      style={{ maxHeight: size }}
    />
  );
};

export default Logo;
