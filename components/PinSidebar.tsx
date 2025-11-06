import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
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
import { ThemeToggle } from "./ThemeToggle";
import type { User } from "../types";
import { supabase } from "../supabaseClient";

// --- NAV ITEM FOR DESKTOP TOP NAV ---
// Consistent, purge-safe classes (no dynamic color strings)
const PinNavItem: React.FC<{
  to: string;
  icon: React.ReactElement<any>;
  label: string;
}> = ({ to, icon, label }) => {
  const baseItem =
    "flex flex-col items-center justify-center text-center p-2 rounded-lg w-24 h-20 transition-colors duration-200";
  const activeClass = "bg-slate-100 dark:bg-slate-700";
  const inactiveClass = "hover:bg-slate-100 dark:hover:bg-slate-700";

  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${baseItem} ${isActive ? activeClass : inactiveClass}`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={
              "w-10 h-10 rounded-full flex items-center justify-center ring-1 " +
              (isActive
                ? "bg-sky-50 dark:bg-sky-500/10 ring-sky-200/70 dark:ring-sky-500/40"
                : "bg-white/60 dark:bg-white/10 ring-slate-200/60 dark:ring-slate-600/40")
            }
          >
            {React.cloneElement(icon, {
              className: `w-6 h-6 ${
                isActive
                  ? "text-sky-600 dark:text-sky-400"
                  : "text-slate-600 dark:text-slate-300"
              }`,
            })}
          </div>
          <span
            className={`text-xs font-medium mt-1.5 truncate w-full ${
              isActive
                ? "text-sky-700 dark:text-sky-300"
                : "text-slate-700 dark:text-slate-300"
            }`}
          >
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
};

// --- DESKTOP TOP NAV ---
export const PinTopNav: React.FC<{
  currentUser: User;
  onSwitchApp: () => void;
}> = ({ currentUser, onSwitchApp }) => {
  const [showLogoMenu, setShowLogoMenu] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    // 1. SALES & PRODUCTS - Bán hàng & Sản phẩm
    { to: "/sales", icon: <ShoppingCartIcon />, label: "Bán hàng" },
    { to: "/products", icon: <TagIcon />, label: "Sản phẩm" },

    // 2. PRODUCTION - Sản xuất (gộp Materials + BOMs + Repairs)
    { to: "/materials", icon: <CubeIcon />, label: "Vật liệu" },
    { to: "/boms", icon: <BeakerIcon />, label: "Sản xuất" },
    { to: "/repairs", icon: <WrenchScrewdriverIcon />, label: "Sửa chữa" },

    // 3. FINANCIAL & ANALYTICS - Tài chính & Báo cáo (gộp tất cả báo cáo)
    { to: "/financial", icon: <BanknotesIcon />, label: "Tài chính" },
    { to: "/receivables", icon: <BanknotesIcon />, label: "Công Nợ" },
    { to: "/reports", icon: <ChartBarIcon />, label: "Báo cáo" },
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
                        Sửa chữa
                      </NavLink>

                      <NavLink
                        to="/predictive"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <CpuChipIcon className="w-4 h-4" />
                        AI Dự đoán
                      </NavLink>

                      <NavLink
                        to="/cost-analysis"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <DocumentChartBarIcon className="w-4 h-4" />
                        Chi phí SX
                      </NavLink>

                      <div className="border-t border-slate-200 dark:border-slate-600 my-2"></div>

                      <NavLink
                        to="/settings"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <CogIcon className="w-5 h-5" />
                        Danh bạ
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
                        Chuyển ứng dụng
                      </button>

                      <div className="border-t border-slate-200 dark:border-slate-600 my-2"></div>

                      {/* Logout */}
                      <button
                        onClick={async () => {
                          try {
                            await supabase.auth.signOut();
                          } finally {
                            setShowLogoMenu(false);
                            navigate("/login");
                          }
                        }}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-sm text-red-600 dark:text-red-400"
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
                            d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5m0 0l-5-5m5 5H3"
                          />
                        </svg>
                        Đăng xuất
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
          <div className="flex items-center gap-3">
            <nav className="flex items-center gap-1">
              {navLinks.map((link, index) => (
                <PinNavItem
                  key={link.to}
                  to={link.to}
                  icon={link.icon}
                  label={link.label}
                />
              ))}
            </nav>
            {/* Theme toggle */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
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
      label: "Bán hàng",
    },
    {
      to: "/materials",
      icon: <CubeIcon className="w-6 h-6" />,
      label: "Vật tư",
    },
    {
      to: "/boms",
      icon: <BeakerIcon className="w-6 h-6" />,
      label: "Sản xuất",
    },
    {
      to: "/repairs",
      icon: <WrenchScrewdriverIcon className="w-6 h-6" />,
      label: "Sửa chữa",
    },
    {
      to: "/reports",
      icon: <ChartBarIcon className="w-6 h-6" />,
      label: "Báo cáo",
    },
    {
      to: "/financial",
      icon: <BanknotesIcon className="w-6 h-6" />,
      label: "Tài chính",
    },
    {
      to: "/receivables",
      icon: <BanknotesIcon className="w-6 h-6" />,
      label: "Công Nợ",
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
  const navigate = useNavigate();
  return (
    <div className="md:hidden fixed top-4 right-4 z-50 flex flex-col gap-3">
      <button
        onClick={onSwitchApp}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm shadow-lg hover:bg-white/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 transition-colors"
        title="Chuyển ứng dụng"
      >
        <HomeIcon className="w-6 h-6" />
      </button>
      <button
        onClick={async () => {
          try {
            await supabase.auth.signOut();
          } finally {
            navigate("/login");
          }
        }}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-red-50/80 dark:bg-red-900/30 backdrop-blur-sm shadow-lg hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
        title="Đăng xuất"
      >
        <svg
          className="w-6 h-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5m0 0l-5-5m5 5H3"
          />
        </svg>
      </button>
    </div>
  );
};
