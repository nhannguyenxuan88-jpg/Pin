import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Logo from "../common/Logo";
import { ThemeToggle } from "../ThemeToggle";
import NotificationBell from "../NotificationBell";
import { Bars3Icon, XMarkIcon, MagnifyingGlassIcon, ArrowLeftIcon } from "../common/Icons";
import type { CurrentUser } from "../../contexts/types";

interface MobileHeaderProps {
  currentUser: CurrentUser;
  onMenuOpen: () => void;
  title?: string;
  showBack?: boolean;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  currentUser,
  onMenuOpen,
  title,
  showBack = false,
  showSearch = false,
  onSearch,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Get page title from route
  const getPageTitle = () => {
    if (title) return title;
    const path = location.pathname;
    const titles: Record<string, string> = {
      "/overview": "Tổng quan",
      "/sales": "Bán hàng",
      "/products": "Sản phẩm",
      "/materials": "Vật liệu",
      "/boms": "Sản xuất",
      "/repairs": "Sửa chữa",
      "/financial": "Tài chính",
      "/receivables": "Công nợ",
      "/reports": "Báo cáo",
      "/analytics": "Phân tích",
      "/settings": "Cài đặt",
      "/predictive": "AI Dự đoán",
      "/cost-analysis": "Chi phí SX",
    };
    return titles[path] || "PIN Corp";
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(searchQuery);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 safe-area-inset-top">
      {/* Main Header */}
      <div className="flex items-center justify-between h-14 px-4">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {showBack ? (
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors -ml-2"
            >
              <ArrowLeftIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            </button>
          ) : (
            <button
              onClick={onMenuOpen}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors -ml-2"
            >
              <Bars3Icon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
            </button>
          )}

          {/* Logo or Title */}
          <div className="flex items-center gap-2">
            <Logo size={28} />
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 truncate max-w-[140px]">
              {getPageTitle()}
            </h1>
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-1">
          {showSearch && (
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              {isSearchOpen ? (
                <XMarkIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              ) : (
                <MagnifyingGlassIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
              )}
            </button>
          )}
          <NotificationBell />
          <ThemeToggle />
        </div>
      </div>

      {/* Expandable Search Bar */}
      {isSearchOpen && showSearch && (
        <div className="px-4 pb-3 animate-slide-down">
          <form onSubmit={handleSearch} className="relative">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-slate-100 dark:bg-slate-700 border-0 rounded-full text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500"
              autoFocus
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          </form>
        </div>
      )}
    </header>
  );
};

export default MobileHeader;
