import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Coins } from "phosphor-react";
import {
  ShoppingCartIcon,
  CubeIcon,
  WrenchScrewdriverIcon,
  Squares2X2Icon,
  Cog6ToothIcon,
} from "../common/Icons";

interface NavItem {
  to: string;
  IconComponent: React.ComponentType<any>;
  label: string;
  activeColor: string;
  activeIndicatorBg: string;
}

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  // Main navigation items with Phosphor Coins icon synchronized with desktop
  const navItems: NavItem[] = [
    {
      to: "/overview",
      IconComponent: Squares2X2Icon,
      label: "Tổng",
      activeColor: "text-blue-600 dark:text-blue-400",
      activeIndicatorBg: "bg-blue-600 dark:bg-blue-400",
    },
    {
      to: "/repairs",
      IconComponent: WrenchScrewdriverIcon,
      label: "Phiếu SC",
      activeColor: "text-pink-600 dark:text-pink-400",
      activeIndicatorBg: "bg-pink-600 dark:bg-pink-400",
    },
    {
      to: "/sales",
      IconComponent: ShoppingCartIcon,
      label: "Bán",
      activeColor: "text-emerald-600 dark:text-emerald-400",
      activeIndicatorBg: "bg-emerald-600 dark:bg-emerald-400",
    },
    {
      to: "/receivables",
      // Render Phosphor Coins icon to match desktop "hand-coins" icon exactly
      IconComponent: (props) => <Coins size={22} weight="duotone" {...props} />,
      label: "Công nợ",
      activeColor: "text-amber-500 dark:text-amber-400",
      activeIndicatorBg: "bg-amber-500 dark:bg-amber-400",
    },
    {
      to: "/materials",
      IconComponent: CubeIcon,
      label: "Kho",
      activeColor: "text-teal-600 dark:text-teal-400",
      activeIndicatorBg: "bg-teal-600 dark:bg-teal-400",
    },
    {
      to: "/more",
      IconComponent: Cog6ToothIcon,
      label: "Thêm",
      activeColor: "text-slate-800 dark:text-slate-200",
      activeIndicatorBg: "bg-slate-800 dark:bg-slate-200",
    },
  ];

  const isActive = (to: string) => {
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#131929]/95 backdrop-blur-md border-t border-slate-200/60 dark:border-slate-800/80 shadow-lg shadow-black/5 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-[56px] px-1">
        {navItems.map((item) => {
          const active = isActive(item.to);
          const IconComponent = item.IconComponent;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="relative flex flex-col items-center justify-center w-full h-full touch-manipulation"
            >
              {/* Premium Top Line Active Indicator */}
              {active && (
                <div
                  className={`absolute top-0 w-8 h-[2.5px] rounded-full ${item.activeIndicatorBg} animate-pulse`}
                />
              )}

              <div
                className={`flex flex-col items-center justify-center transition-all duration-300 ${
                  active ? "-translate-y-[2px]" : "translate-y-0"
                }`}
              >
                {/* Icon (No bulky background shapes for a clean app-like look) */}
                <div className="w-8 h-8 flex items-center justify-center rounded-lg transition-transform duration-300">
                  <IconComponent
                    className={`w-[22px] h-[22px] transition-colors duration-300 ${
                      active ? item.activeColor : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-[9.5px] font-bold tracking-tight mt-0.5 transition-colors duration-300 ${
                    active ? item.activeColor : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
