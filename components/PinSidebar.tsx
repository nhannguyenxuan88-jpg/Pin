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
  ArrowsLeftRightIcon,
  ArrowRightOnRectangleIcon,
  SparklesIcon,
} from "./common/Icons";
import { ThemeToggle } from "./ThemeToggle";
import type { CurrentUser } from "../contexts/types";
import { supabase } from "../supabaseClient";
import NotificationBell from "./NotificationBell";

// --- NAV ITEM FOR DESKTOP TOP NAV ---
// Consistent, purge-safe classes (no dynamic color strings)
const PinNavItem: React.FC<{
  to: string;
  icon: React.ReactElement<any>;
  label: string;
  color?: string;
}> = ({ to, icon, label, color = "text-sky-600 dark:text-sky-400" }) => {
  const baseItem =
    "flex flex-col items-center justify-center text-center px-2 py-1.5 rounded-lg min-w-[4.5rem] w-auto transition-all duration-200 border";
  const activeClass =
    "bg-white border-slate-200 shadow-md shadow-slate-200/60 dark:bg-slate-800 dark:border-slate-600 dark:shadow-none";
  const inactiveClass =
    "bg-transparent border-transparent hover:bg-slate-50 hover:border-slate-200 dark:hover:bg-slate-700/40 dark:hover:border-slate-600";

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${baseItem} ${isActive ? activeClass : inactiveClass}`}
    >
      {({ isActive }) => (
        <>
          <div
            className={`w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-inset transition-colors duration-200 ${isActive
                ? "bg-slate-50 ring-slate-200 dark:bg-slate-700 dark:ring-slate-500"
                : "bg-slate-100 ring-transparent dark:bg-slate-800/40"
              }`}
          >
            {React.cloneElement(icon, {
              className: `w-4 h-4 transition-opacity duration-200 ${color} ${isActive ? "opacity-100" : "opacity-75"
                }`,
            })}
          </div>
          <span
            className={`text-[10px] font-medium mt-1 w-full whitespace-nowrap ${isActive ? "text-slate-900 dark:text-slate-100" : "text-slate-500 dark:text-slate-400"
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
  currentUser: CurrentUser;
  onSwitchApp: () => void;
}> = ({ currentUser, onSwitchApp }) => {
  const [showLogoMenu, setShowLogoMenu] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    // 1. SALES & PRODUCTS - Bán hàng & Sản phẩm
    {
      to: "/sales",
      icon: <ShoppingCartIcon />,
      label: "Bán hàng",
      color: "text-emerald-400",
    },
    {
      to: "/products",
      icon: <TagIcon />,
      label: "Sản phẩm",
      color: "text-amber-400",
    },

    // 2. PRODUCTION - Sản xuất (gộp Materials + BOMs + Repairs)
    {
      to: "/materials",
      icon: <CubeIcon />,
      label: "Quản lý Kho",
      color: "text-teal-400",
    },
    {
      to: "/boms",
      icon: <BeakerIcon />,
      label: "Sản xuất",
      color: "text-rose-400",
    },
    {
      to: "/repairs",
      icon: <WrenchScrewdriverIcon />,
      label: "Sửa chữa",
      color: "text-pink-400",
    },

    // 3. FINANCIAL & ANALYTICS - Tài chính & Báo cáo (gộp tất cả báo cáo)
    {
      to: "/financial",
      icon: <BanknotesIcon />,
      label: "Tài chính",
      color: "text-cyan-400",
    },
    {
      to: "/receivables",
      icon: <BanknotesIcon />,
      label: "Công Nợ",
      color: "text-amber-400",
    },
    {
      to: "/reports",
      icon: <ChartBarIcon />,
      label: "Báo cáo",
      color: "text-violet-400",
    },
    {
      to: "/analytics",
      icon: <SparklesIcon />,
      label: "Phân tích",
      color: "text-purple-400",
    },
  ];

  return (
    <header className="bg-white dark:bg-slate-800 shadow-sm print:hidden border-b border-slate-200 dark:border-slate-700/50 sticky top-0 z-30">
      <div className="mx-auto px-3">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            {/* Clickable Logo with Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowLogoMenu(!showLogoMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Logo size={28} className="hidden sm:block" />
                <CpuChipIcon className="w-6 h-6 text-sky-500 sm:hidden" />
              </button>

              {showLogoMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowLogoMenu(false)} />
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
                        to="/receivables"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <BanknotesIcon className="w-4 h-4" />
                        Công nợ
                      </NavLink>

                      <NavLink
                        to="/reports"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <ChartBarIcon className="w-4 h-4" />
                        Báo cáo
                      </NavLink>

                      <NavLink
                        to="/analytics"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <SparklesIcon className="w-4 h-4" />
                        Phân tích
                      </NavLink>

                      <NavLink
                        to="/products"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <TagIcon className="w-4 h-4" />
                        Sản phẩm
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

                      <NavLink
                        to="/business-settings"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <CogIcon className="w-4 h-4" />
                        Cài đặt doanh nghiệp
                      </NavLink>

                      <NavLink
                        to="/tax-report"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <DocumentChartBarIcon className="w-4 h-4" />
                        Báo cáo thuế
                      </NavLink>

                      <button
                        onClick={() => {
                          onSwitchApp();
                          setShowLogoMenu(false);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 text-sm"
                      >
                        <ArrowsLeftRightIcon className="w-4 h-4" />
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
                        <ArrowRightOnRectangleIcon className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <h1 className="text-base font-bold text-slate-800 dark:text-slate-100">PIN Corp</h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-0.5">
              {navLinks.map((link, index) => (
                <PinNavItem
                  key={link.to}
                  to={link.to}
                  icon={link.icon}
                  label={link.label}
                  color={link.color}
                />
              ))}
            </nav>
            {/* Notification Bell */}
            <NotificationBell />
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
  icon: React.ReactElement<any>;
  label: string;
  color?: string;
}> = ({ to, icon, label, color = "text-sky-400" }) => (
  <NavLink
    to={to}
    className="flex flex-col items-center justify-center text-center w-full pt-2 pb-1 transition-colors duration-200"
  >
    {({ isActive }) => (
      <>
        {React.cloneElement(icon, {
          className: `w-6 h-6 ${isActive ? color : "text-slate-500 dark:text-slate-400"}`,
        })}
        <span
          className={`text-xs font-medium mt-1 ${isActive ? color : "text-slate-500 dark:text-slate-400"
            }`}
        >
          {label}
        </span>
      </>
    )}
  </NavLink>
);

export const PinMobileNav: React.FC = () => {
  const navLinks = [
    {
      to: "/sales",
      icon: <ShoppingCartIcon className="w-6 h-6" />,
      label: "Bán hàng",
      color: "text-emerald-400",
    },
    {
      to: "/materials",
      icon: <CubeIcon className="w-6 h-6" />,
      label: "Vật tư",
      color: "text-teal-400",
    },
    {
      to: "/boms",
      icon: <BeakerIcon className="w-6 h-6" />,
      label: "Sản xuất",
      color: "text-rose-400",
    },
    {
      to: "/repairs",
      icon: <WrenchScrewdriverIcon className="w-6 h-6" />,
      label: "Sửa chữa",
      color: "text-pink-400",
    },
    {
      to: "/financial",
      icon: <BanknotesIcon className="w-6 h-6" />,
      label: "Tài chính",
      color: "text-cyan-400",
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
export const FloatingNavButtons: React.FC<{ onSwitchApp: () => void }> = ({ onSwitchApp }) => {
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
        <ArrowRightOnRectangleIcon className="w-6 h-6" />
      </button>
    </div>
  );
};
