import React from "react";
import { NavLink } from "react-router-dom";
import {
  WrenchScrewdriverIcon,
  BanknotesIcon,
  TagIcon,
  SparklesIcon,
  CpuChipIcon,
  DocumentChartBarIcon,
  ShieldCheckIcon,
  CogIcon,
  XMarkIcon,
} from "../common/Icons";

interface MoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MenuItem {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

export const MobileMoreMenu: React.FC<MoreMenuProps> = ({ isOpen, onClose }) => {
  const menuItems: MenuItem[] = [
    {
      to: "/repairs",
      icon: <WrenchScrewdriverIcon className="w-6 h-6 text-pink-500" />,
      label: "Sửa chữa",
      description: "Quản lý phiếu sửa chữa",
      color: "text-pink-500",
      bgColor: "bg-pink-50 dark:bg-pink-900/20",
    },
    {
      to: "/warranty",
      icon: <ShieldCheckIcon className="w-6 h-6 text-blue-500" />,
      label: "Bảo hành",
      description: "Theo dõi tình trạng bảo hành",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      to: "/products",
      icon: <TagIcon className="w-6 h-6 text-amber-500" />,
      label: "Sản phẩm",
      description: "Danh sách sản phẩm",
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      to: "/financial",
      icon: <BanknotesIcon className="w-6 h-6 text-cyan-500" />,
      label: "Tài chính",
      description: "Quản lý thu chi",
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    },
    {
      to: "/receivables",
      icon: <BanknotesIcon className="w-6 h-6 text-amber-500" />,
      label: "Công nợ",
      description: "Theo dõi công nợ",
      color: "text-amber-500",
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
    },
    {
      to: "/analytics",
      icon: <SparklesIcon className="w-6 h-6 text-purple-500" />,
      label: "Phân tích",
      description: "Thống kê nâng cao",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20",
    },
    {
      to: "/predictive",
      icon: <CpuChipIcon className="w-6 h-6 text-indigo-500" />,
      label: "AI Dự đoán",
      description: "Dự báo thông minh",
      color: "text-indigo-500",
      bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
    },
    {
      to: "/cost-analysis",
      icon: <DocumentChartBarIcon className="w-6 h-6 text-slate-600" />,
      label: "Chi phí SX",
      description: "Phân tích chi phí",
      color: "text-slate-600",
      bgColor: "bg-slate-100 dark:bg-slate-700/50",
    },
    {
      to: "/settings",
      icon: <CogIcon className="w-6 h-6 text-slate-500" />,
      label: "Cài đặt",
      description: "Thiết lập hệ thống",
      color: "text-slate-500",
      bgColor: "bg-slate-100 dark:bg-slate-700/50",
    },
  ];

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Menu Sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-800 rounded-t-3xl shadow-2xl animate-slide-up safe-area-inset-bottom">
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-600 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-4">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Chức năng khác</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Menu Grid */}
        <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
          <div className="grid grid-cols-4 gap-3">
            {menuItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className="flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${item.bgColor} flex items-center justify-center mb-2`}
                >
                  {item.icon}
                </div>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 text-center leading-tight">
                  {item.label}
                </span>
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MobileMoreMenu;
