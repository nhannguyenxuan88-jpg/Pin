import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  ShoppingCartIcon,
  CubeIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  BanknotesIcon,
  Squares2X2Icon,
} from "../common/Icons";

interface NavItem {
  to: string;
  IconComponent: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  activeColor: string;
  activeIndicatorBg: string;
}

export const MobileBottomNav: React.FC = () => {
  const location = useLocation();

  // Main navigation items - limited to 5 for mobile
  const navItems: NavItem[] = [
    {
      to: "/sales",
      IconComponent: ShoppingCartIcon,
      label: "Bán hàng",
      activeColor: "text-emerald-500",
      activeIndicatorBg: "bg-emerald-500",
    },
    {
      to: "/materials",
      IconComponent: CubeIcon,
      label: "Vật liệu",
      activeColor: "text-teal-500",
      activeIndicatorBg: "bg-teal-500",
    },
    {
      to: "/boms",
      IconComponent: BeakerIcon,
      label: "Sản xuất",
      activeColor: "text-rose-500",
      activeIndicatorBg: "bg-rose-500",
    },
    {
      to: "/repairs",
      IconComponent: WrenchScrewdriverIcon,
      label: "Sửa chữa",
      activeColor: "text-pink-500",
      activeIndicatorBg: "bg-pink-500",
    },
    {
      to: "/financial",
      IconComponent: BanknotesIcon,
      label: "Tài chính",
      activeColor: "text-cyan-500",
      activeIndicatorBg: "bg-cyan-500",
    },
    {
      to: "/more",
      IconComponent: Squares2X2Icon,
      label: "Khác",
      activeColor: "text-slate-600 dark:text-slate-200",
      activeIndicatorBg: "bg-slate-600 dark:bg-slate-200",
    },
  ];

  // Check if current path matches a nav item
  const isActive = (to: string) => {
    return location.pathname.startsWith(to);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 safe-area-inset-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const active = isActive(item.to);
          const IconComponent = item.IconComponent;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center w-full h-full touch-manipulation"
            >
              <div
                className={`relative flex flex-col items-center justify-center transition-all duration-200 ${
                  active ? "scale-110" : "scale-100"
                }`}
              >
                {/* Icon Container */}
                <div
                  className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 ${
                    active ? "bg-slate-100 dark:bg-slate-700" : "bg-transparent"
                  }`}
                >
                  <IconComponent
                    className={`w-6 h-6 transition-colors duration-200 ${
                      active ? item.activeColor : "text-slate-400 dark:text-slate-500"
                    }`}
                  />
                </div>

                {/* Label */}
                <span
                  className={`text-[10px] font-medium mt-0.5 transition-colors duration-200 ${
                    active ? item.activeColor : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {item.label}
                </span>

                {/* Active Indicator */}
                {active && (
                  <div
                    className={`absolute bottom-1 w-1 h-1 rounded-full ${item.activeIndicatorBg}`}
                  />
                )}
              </div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
