import React from 'react';
import { useLocation } from 'react-router-dom';
import { Bars3Icon } from './Icons';

interface HeaderProps {
  onMenuClick: () => void;
}

// Function to derive title from pathname
const getTitleFromPath = (pathname: string): string => {
    if (pathname.includes('/dashboard')) return 'Bảng điều khiển';
    if (pathname.includes('/services')) return 'Quản lý Dịch vụ';
    if (pathname.includes('/sales')) return 'Bán hàng';
    if (pathname.includes('/inventory')) return 'Quản lý Kho';
    if (pathname.includes('/customers')) return 'Khách hàng';
    if (pathname.includes('/cashflow')) return 'Thu – Chi & Tồn quỹ';
    if (pathname.includes('/reports/summary')) return 'Báo cáo Tổng hợp';
    if (pathname.includes('/reports/revenue')) return 'Báo cáo Doanh thu';
    if (pathname.includes('/reports/inventory')) return 'Báo cáo Tồn kho';
    if (pathname.includes('/users')) return 'Nhân viên';
    if (pathname.includes('/ai-assistant')) return 'Trợ lý AI';
    return 'MotoCare Pro';
};


const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
    const location = useLocation();
    const title = getTitleFromPath(location.pathname);

    return (
        <header className="lg:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-20">
            <div className="flex items-center justify-between p-4 h-16">
                <button onClick={onMenuClick} className="text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-2 -ml-2">
                    <Bars3Icon className="h-6 w-6" />
                </button>
                <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
                <div className="w-6"></div> {/* Spacer to balance the title */}
            </div>
        </header>
    );
};

export default Header;