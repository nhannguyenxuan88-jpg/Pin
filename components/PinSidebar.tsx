import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import Logo from "./common/Logo";
import {
  CubeIcon,
  BeakerIcon,
  WrenchScrewdriverIcon,
  TagIcon,
  ShoppingCartIcon,
  ChartBarIcon,
  DocumentChartBarIcon,
  CpuChipIcon,
  RectangleGroupIcon,
  HomeIcon,
  BanknotesIcon,
  CogIcon,
  TrashIcon,
} from "./common/Icons";
import { ThemeToggle } from "./ThemeToggle";import type { User } from "../types";

// --- NAV ITEM FOR DESKTOP TOP NAV ---
type NavColor =
  | "rose"
  | "amber"
  | "sky"
  | "indigo"
  | "emerald"
  | "violet"
  | "teal";
const navItemColors: NavColor[] = [
  "rose",
  "amber",
  "sky",
  "indigo",
  "emerald",
  "violet",
  "teal",
];

// FIX: Change icon type to allow passing props like className via cloneElement.
const PinNavItem: React.FC<{
  to: string;
  icon: React.ReactElement<any>;
  label: string;
  color: NavColor;
}> = ({ to, icon, label, color }) => {
  const activeClass = "bg-slate-100 dark:bg-slate-700";
  const inactiveClass = "hover:bg-slate-100 dark:hover:bg-slate-700";

  const colorClasses = {
    iconWrapper: `bg-${color}-100 dark:bg-${color}-500/20`,
    icon: `text-${color}-600 dark:text-${color}-400`,
  };

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center text-center p-2 rounded-lg w-24 h-20 transition-colors duration-200 ${
          isActive ? activeClass : inactiveClass
        }`
      }
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses.iconWrapper}`}
      >
        {React.cloneElement(icon, {
          className: `w-6 h-6 ${colorClasses.icon}`,
        })}
      </div>
      <span className="text-xs font-medium mt-1.5 text-slate-700 dark:text-slate-300 truncate w-full">
        {label}
      </span>
    </NavLink>
  );
};

// --- DESKTOP TOP NAV ---
export const PinTopNav: React.FC<{
  currentUser: User;
  onSwitchApp: () => void;
}> = ({ currentUser, onSwitchApp }) => {
  const [showLogoMenu, setShowLogoMenu] = useState(false);

  const navLinks = [
    // 1. SALES & PRODUCTS - BÃ¡n hÃ ng & Sáº£n pháº©m
    { to: "/sales", icon: <ShoppingCartIcon />, label: "BÃ¡n hÃ ng" },
    { to: "/products", icon: <TagIcon />, label: "Sáº£n pháº©m" },

    // 2. PRODUCTION - Sáº£n xuáº¥t (gá»™p Materials + BOMs + Repairs)
    { to: "/materials", icon: <CubeIcon />, label: "Váº­t liá»‡u" },
    { to: "/boms", icon: <BeakerIcon />, label: "Sáº£n xuáº¥t" },
    { to: "/repairs", icon: <WrenchScrewdriverIcon />, label: "Sá»­a chá»¯a" },

    // 3. FINANCIAL & ANALYTICS - TÃ i chÃ­nh & BÃ¡o cÃ¡o (gá»™p táº¥t cáº£ bÃ¡o cÃ¡o)
    { to: "/financial", icon: <BanknotesIcon />, label: "TÃ i chÃ­nh" },
    { to: "/reports", icon: <ChartBarIcon />, label: "BÃ¡o cÃ¡o" },
  ];

  return (
    <header className="bg-white dark:bg-slate-800 shadow-sm print:hidden border-b border-slate-200 dark:border-slate-700/50 sticky top-0 z-30">
      <div className="mx-auto px-4">
        <div className="flex justify-between items-center h-20">
          <div className="flex items-center gap-3">
            {/* Clickable Logo with Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowLogoMenu(!showLogoMenu)}
                className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Logo size={36} className="hidden sm:block" />
                <CpuChipIcon className="w-8 h-8 text-sky-500 sm:hidden" />
              </button>

              {showLogoMenu && (
                <>
                  {/* Backdrop */}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowLogoMenu(false)}
                  />
                  {/* Dropdown Menu */}
                  <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 max-h-[80vh] overflow-y-auto">
                    <div className="p-4 border-b border-slate-200 dark:border-slate-700">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1">
                        PIN Corp
                      </h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {currentUser.name}
                      </p>
                    </div>

                    <div className="p-2">
                      {/* Admin - Production Reset */}
                      {currentUser.departmentIds?.includes("dept_admin") && (
                        <NavLink
                          to="/production-reset"
                          onClick={() => setShowLogoMenu(false)}
                          className="w-full text-left flex items-center gap-3 p-3 mb-2 rounded-md bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 font-medium transition-all duration-200"
                        >
                          <TrashIcon className="w-5 h-5" />
                          Production Reset
                        </NavLink>
                      )}

                      {/* Menu Items */}
                      <NavLink
                        to="/repairs"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <WrenchScrewdriverIcon className="w-4 h-4" />
                        Sá»­a chá»¯a
                      </NavLink>

                      <NavLink
                        to="/predictive"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <CpuChipIcon className="w-4 h-4" />
                        AI Dá»± Ä‘oÃ¡n
                      </NavLink>

                      <NavLink
                        to="/cost-analysis"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <DocumentChartBarIcon className="w-4 h-4" />
                        Chi phÃ­ SX
                      </NavLink>

                      <div className="border-t border-slate-200 dark:border-slate-600 my-2"></div>

                      <NavLink
                        to="/settings"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <CogIcon className="w-5 h-5" />
                        Danh báº¡
                      </NavLink>

                      <button
                        onClick={() => {
                          onSwitchApp();
                          setShowLogoMenu(false);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                        Chuyá»ƒn á»©ng dá»¥ng
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              PIN Corp
            </h1>
          </div>
          <div className="flex items-center">
            <nav className="flex items-center gap-1">
              {navLinks.map((link, index) => (
                <PinNavItem
                  key={link.to}
                  to={link.to}
                  icon={link.icon}
                  label={link.label}
                  color={navItemColors[index % navItemColors.length]}
                />
              ))}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};

// --- MOBILE BOTTOM NAV ---
const MobileNavItem: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
}> = ({ to, icon, label }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center text-center w-full pt-2 pb-1 transition-colors duration-200 ${
        isActive
          ? "text-sky-600 dark:text-sky-400"
          : "text-slate-500 dark:text-slate-400 hover:text-sky-600 dark:hover:text-sky-400"
      }`
    }
  >
    {icon}
    <span className="text-xs font-medium mt-1">{label}</span>
  </NavLink>
);

export const PinMobileNav: React.FC = () => {
  const navLinks = [
    {
      to: "/sales",
      icon: <ShoppingCartIcon className="w-6 h-6" />,
      label: "BÃ¡n hÃ ng",
    },
    {
      to: "/materials",
      icon: <CubeIcon className="w-6 h-6" />,
      label: "Váº­t tÆ°",
    },
    {
      to: "/boms",
      icon: <BeakerIcon className="w-6 h-6" />,
      label: "Sáº£n xuáº¥t",
    },
    {
      to: "/repairs",
      icon: <WrenchScrewdriverIcon className="w-6 h-6" />,
      label: "Sá»­a chá»¯a",
    },
    {
      to: "/reports",
      icon: <ChartBarIcon className="w-6 h-6" />,
      label: "BÃ¡o cÃ¡o",
    },
    {
      to: "/financial",
      icon: <BanknotesIcon className="w-6 h-6" />,
      label: "TÃ i chÃ­nh",
    },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
      <nav className="flex items-center justify-around h-16">
        {navLinks.map((link) => (
          <MobileNavItem key={link.to} {...link} />
        ))}
      </nav>
    </footer>
  );
};

// --- FLOATING NAV BUTTONS for Mobile ---
export const FloatingNavButtons: React.FC<{ onSwitchApp: () => void }> = ({
  onSwitchApp,
}) => {
  return (
    <div className="md:hidden fixed top-4 right-4 z-50">
      <button
        onClick={onSwitchApp}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-lg hover:bg-white/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors"
        title="Chuyá»ƒn á»©ng dá»¥ng"
      >
        <HomeIcon className="w-6 h-6" />
      </button>
    </div>
  );
};
