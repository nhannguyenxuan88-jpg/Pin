import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import Logo from "./common/Logo";
import { Icon, type IconName } from "./common/Icon";
import { ThemeToggle } from "./ThemeToggle";
import type { CurrentUser } from "../contexts/types";
import { supabase } from "../supabaseClient";
import NotificationBell from "./NotificationBell";

// --- NAV ITEM FOR DESKTOP TOP NAV ---
// Consistent, purge-safe classes (no dynamic color strings)
const PinNavItem: React.FC<{
  to: string;
  iconName: IconName;
  label: string;
  color?: string;
}> = ({ to, iconName, label, color = "text-pin-blue-600 dark:text-pin-blue-400" }) => {
  const baseItem =
    "relative flex flex-col items-center justify-center text-center px-1.5 py-1 rounded-lg min-w-[4rem] w-auto transition-all duration-200";
  const activeClass =
    "bg-transparent";
  const inactiveClass =
    "bg-transparent hover:bg-pin-gray-50 dark:hover:bg-pin-gray-700/30";

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `${baseItem} ${isActive ? activeClass : inactiveClass}`}
    >
      {({ isActive }) => (
        <>
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center ring-1 ring-inset transition-all duration-300 ${isActive
              ? "bg-white shadow-md ring-white/10 dark:bg-pin-gray-700/60"
              : "bg-pin-gray-100 ring-transparent dark:bg-pin-gray-800/40"
              }`}
          >
            <Icon
              name={iconName}
              weight={isActive ? "duotone" : "regular"}
              className={`w-4.5 h-4.5 transition-all duration-300 ${isActive ? color + " scale-110" : "text-pin-gray-500 dark:text-pin-gray-400 opacity-60"}`}
            />
          </div>
          <span
             className={`text-[9px] font-bold mt-1.5 w-full whitespace-nowrap tracking-tight transition-opacity ${isActive ? "text-pin-gray-900 dark:text-pin-gray-100" : "text-pin-gray-500/70 dark:text-pin-gray-400/60"
              }`}
          >
            {label}
          </span>
          {isActive && <span className="absolute bottom-0 h-0.5 w-6 rounded-full bg-emerald-400" />}
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
      iconName: "shopping-cart" as IconName,
      label: "Bán hàng",
      color: "text-emerald-400",
    },
    {
      to: "/products",
      iconName: "tag" as IconName,
      label: "Sản phẩm",
      color: "text-amber-400",
    },

    // 2. PRODUCTION - Sản xuất (gộp Materials + BOMs + Repairs)
    {
      to: "/materials",
      iconName: "package" as IconName,
      label: "Quản lý Kho",
      color: "text-teal-400",
    },
    {
      to: "/boms",
      iconName: "factory" as IconName,
      label: "Sản xuất",
      color: "text-rose-400",
    },
    {
      to: "/repairs",
      iconName: "repairs" as IconName,
      label: "Sửa chữa",
      color: "text-pink-400",
    },
    {
      to: "/warranty",
      iconName: "shield-check" as IconName,
      label: "Bảo hành",
      color: "text-blue-400",
    },

    // 3. FINANCIAL & ANALYTICS - Tài chính & Báo cáo (gộp tất cả báo cáo)
    {
      to: "/financial",
      iconName: "money" as IconName,
      label: "Tài chính",
      color: "text-cyan-400",
    },
    {
      to: "/receivables",
      iconName: "hand-coins" as IconName,
      label: "Công Nợ",
      color: "text-amber-400",
    },
    {
      to: "/reports",
      iconName: "chart-bar" as IconName,
      label: "Báo cáo",
      color: "text-violet-400",
    },
    {
      to: "/analytics",
      iconName: "sparkle" as IconName,
      label: "Phân tích",
      color: "text-purple-400",
    },
  ];

  return (
    <header className="bg-white dark:bg-pin-gray-800 shadow-sm print:hidden border-b border-pin-gray-200 dark:border-pin-gray-700/50 sticky top-0 z-30">
      <div className="mx-auto px-3">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-2">
            {/* Clickable Logo with Dropdown Menu */}
            <div className="relative">
              <button
                onClick={() => setShowLogoMenu(!showLogoMenu)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 transition-colors"
              >
                <Logo size={28} className="hidden sm:block" />
                <Icon name="cpu-chip" className="w-6 h-6 text-pin-blue-500 sm:hidden" />
              </button>

              {showLogoMenu && (
                <>
                  {/* Backdrop */}
                  <div className="fixed inset-0 z-40" onClick={() => setShowLogoMenu(false)} />
                  {/* Dropdown Menu */}
                  <div className="absolute left-0 top-full mt-2 w-72 bg-white dark:bg-pin-gray-800 rounded-lg shadow-xl border border-pin-gray-200 dark:border-pin-gray-700 z-50 max-h-[80vh] overflow-y-auto">
                    <div className="p-4 border-b border-pin-gray-200 dark:border-pin-gray-700">
                      <h3 className="font-semibold text-pin-gray-800 dark:text-pin-gray-100 mb-1">
                        PIN Corp
                      </h3>
                      <p className="text-sm text-pin-gray-500 dark:text-pin-gray-400">
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
                          <Icon name="trash" className="w-5 h-5" />
                          Production Reset
                        </NavLink>
                      )}

                      {/* Menu Items */}
                      <NavLink
                        to="/receivables"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="money" className="w-4 h-4" />
                        Công nợ
                      </NavLink>

                      <NavLink
                        to="/reports"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="chart-bar" className="w-4 h-4" />
                        Báo cáo
                      </NavLink>

                      <NavLink
                        to="/analytics"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="sparkle" className="w-4 h-4" />
                        Phân tích
                      </NavLink>

                      <NavLink
                        to="/warranty"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="shield-check" className="w-4 h-4" />
                        Bảo hành
                      </NavLink>

                      <NavLink
                        to="/products"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="tag" className="w-4 h-4" />
                        Sản phẩm
                      </NavLink>

                      <NavLink
                        to="/predictive"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="cpu-chip" className="w-4 h-4" />
                        AI Dự đoán
                      </NavLink>

                      <NavLink
                        to="/cost-analysis"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="chart-bar" className="w-4 h-4" />
                        Chi phí SX
                      </NavLink>

                      <div className="border-t border-pin-gray-200 dark:border-pin-gray-600 my-2"></div>

                      <NavLink
                        to="/settings"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="gear" className="w-5 h-5" />
                        Danh bạ
                      </NavLink>

                      <NavLink
                        to="/business-settings"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="gear" className="w-4 h-4" />
                        Cài đặt doanh nghiệp
                      </NavLink>

                      <NavLink
                        to="/tax-report"
                        onClick={() => setShowLogoMenu(false)}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="file-text" className="w-4 h-4" />
                        Báo cáo thuế
                      </NavLink>

                      <button
                        onClick={() => {
                          onSwitchApp();
                          setShowLogoMenu(false);
                        }}
                        className="w-full text-left flex items-center gap-3 p-2 rounded-md hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 text-sm"
                      >
                        <Icon name="arrows-left-right" className="w-4 h-4" />
                        Chuyển ứng dụng
                      </button>

                      <div className="border-t border-pin-gray-200 dark:border-pin-gray-600 my-2"></div>

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
                        <Icon name="sign-out" className="w-4 h-4" />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            <h1 className="text-base font-bold text-pin-gray-800 dark:text-pin-gray-100">PIN Corp</h1>
          </div>
          <div className="flex items-center gap-2">
            <nav className="flex items-center gap-0.5">
              {navLinks.map((link, index) => (
                <PinNavItem
                  key={link.to}
                  to={link.to}
                  iconName={link.iconName}
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
  iconName: IconName;
  label: string;
  color?: string;
}> = ({ to, iconName, label, color = "text-pin-blue-400" }) => (
  <NavLink
    to={to}
    className="flex flex-col items-center justify-center text-center w-full pt-2 pb-1 transition-colors duration-200"
  >
    {({ isActive }) => (
      <>
        <Icon
          name={iconName}
          weight={isActive ? "duotone" : "regular"}
          className={`w-6 h-6 ${isActive ? color : "text-pin-gray-500 dark:text-pin-gray-400"}`}
        />
        <span
          className={`text-xs font-medium mt-1 ${isActive ? color : "text-pin-gray-500 dark:text-pin-gray-400"
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
      iconName: "shopping-cart" as IconName,
      label: "Bán hàng",
      color: "text-emerald-400",
    },
    {
      to: "/materials",
      iconName: "package" as IconName,
      label: "Vật tư",
      color: "text-teal-400",
    },
    {
      to: "/boms",
      iconName: "factory" as IconName,
      label: "Sản xuất",
      color: "text-rose-400",
    },
    {
      to: "/repairs",
      iconName: "repairs" as IconName,
      label: "Sửa chữa",
      color: "text-pink-400",
    },
    {
      to: "/financial",
      iconName: "money" as IconName,
      label: "Tài chính",
      color: "text-cyan-400",
    },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white dark:bg-pin-gray-800 border-t border-pin-gray-200 dark:border-pin-gray-700 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40">
      <nav className="flex items-center justify-around h-16">
        {navLinks.map((link) => (
          <MobileNavItem key={link.to} to={link.to} iconName={link.iconName} label={link.label} color={link.color} />
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
        className="w-12 h-12 flex items-center justify-center rounded-full bg-white/50 dark:bg-pin-gray-800/50 backdrop-blur-sm shadow-lg hover:bg-white/80 dark:hover:bg-pin-gray-700/80 text-pin-gray-700 dark:text-pin-gray-200 transition-colors"
        title="Chuyển ứng dụng"
      >
        <Icon name="home" className="w-6 h-6" />
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
        <Icon name="sign-out" className="w-6 h-6" />
      </button>
    </div>
  );
};
