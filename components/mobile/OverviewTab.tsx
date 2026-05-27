import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePinContext } from "../../contexts/PinContext";
import { supabase } from "../../supabaseClient";
import {
  ShoppingCartIcon,
  WrenchScrewdriverIcon,
  ExclamationTriangleIcon,
  CreditCardIcon,
  PlusIcon,
  CloudArrowUpIcon,
  UserCircleIcon,
  ChartBarIcon,
} from "../common/Icons";
import { BatteryEstimatorModal } from "./BatteryEstimatorModal";


// Helper to format currency in VND
const formatVND = (amount: number) => {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + " đ";
};

// Date helpers using local time
const isToday = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

const isThisMonth = (dateString?: string) => {
  if (!dateString) return false;
  const d = new Date(dateString);
  const now = new Date();
  return (
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
};

export const OverviewTab: React.FC = () => {
  const navigate = useNavigate();
  const [isEstimatorOpen, setIsEstimatorOpen] = useState(false);
  const {
    pinSales = [],
    pinRepairOrders = [],
    pinMaterials = [],
    pinProducts = [],
    cashTransactions = [],
    storeSettings,
  } = usePinContext();

  const shopName = storeSettings?.name || "Nhạn Lâm SmartCare";

  // Handle Logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // --- CALCULATIONS FOR MONTH ---
  const monthStats = useMemo(() => {
    // 1. Sales revenue
    const salesSales = pinSales.filter((s) => isThisMonth(s.date));
    const salesRevenue = salesSales.reduce((sum, s) => sum + s.total, 0);
    const salesCOGS = salesSales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce(
          (itemSum, i) => itemSum + (i.costPrice || 0) * i.quantity,
          0
        ),
      0
    );
    const salesProfit = salesRevenue - salesCOGS;

    // 2. Repair revenue (only counting paid / partial orders)
    const repairRepairs = pinRepairOrders.filter((r) =>
      isThisMonth(r.creationDate)
    );
    const repairRevenue = repairRepairs
      .filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partial")
      .reduce((sum, r) => sum + (r.total || 0), 0);

    const repairCost = repairRepairs
      .filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partial")
      .reduce(
        (sum, r) => {
          const matCost = (r.materialsUsed || []).reduce((mSum, m) => {
            const mat = pinMaterials.find((x) => x.id === m.materialId);
            const c = mat ? (mat.purchasePrice || 0) : (m.price * 0.7);
            return mSum + c * m.quantity;
          }, 0);
          const outsourcingCost = (r.outsourcingItems || []).reduce(
            (oSum, item) => oSum + (item.costPrice || 0) * item.quantity,
            0
          );
          return sum + matCost + outsourcingCost;
        },
        0
      );
    const repairProfit = repairRevenue - repairCost;

    // 3. Cashflow operating expense & other income
    const monthTransactions = cashTransactions.filter((t) =>
      isThisMonth(t.date)
    );
    const otherIncome = monthTransactions
      .filter((t) => t.type === "income" && t.category === "other_income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const operatingExpenses = monthTransactions
      .filter(
        (t) =>
          t.type === "expense" &&
          ["other_expense", "payroll", "rent", "utilities", "logistics"].includes(
            t.category || ""
          )
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalRevenue = salesRevenue + repairRevenue;
    const netProfit = salesProfit + repairProfit + otherIncome - operatingExpenses;

    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      netProfit,
      salesRevenue,
      salesProfit,
      repairRevenue,
      repairProfit,
      profitMargin,
    };
  }, [pinSales, pinRepairOrders, cashTransactions]);

  // --- CALCULATIONS FOR TODAY ---
  const todayStats = useMemo(() => {
    // 1. Sales revenue
    const todaySales = pinSales.filter((s) => isToday(s.date));
    const salesRevenue = todaySales.reduce((sum, s) => sum + s.total, 0);
    const salesCOGS = todaySales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce(
          (itemSum, i) => itemSum + (i.costPrice || 0) * i.quantity,
          0
        ),
      0
    );
    const salesProfit = salesRevenue - salesCOGS;

    // 2. Repair revenue (only counting paid / partial orders)
    const todayRepairs = pinRepairOrders.filter((r) => isToday(r.creationDate));
    const repairRevenue = todayRepairs
      .filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partial")
      .reduce((sum, r) => sum + (r.total || 0), 0);

    const repairCost = todayRepairs
      .filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partial")
      .reduce(
        (sum, r) => {
          const matCost = (r.materialsUsed || []).reduce((mSum, m) => {
            const mat = pinMaterials.find((x) => x.id === m.materialId);
            const c = mat ? (mat.purchasePrice || 0) : (m.price * 0.7);
            return mSum + c * m.quantity;
          }, 0);
          const outsourcingCost = (r.outsourcingItems || []).reduce(
            (oSum, item) => oSum + (item.costPrice || 0) * item.quantity,
            0
          );
          return sum + matCost + outsourcingCost;
        },
        0
      );
    const repairProfit = repairRevenue - repairCost;

    // 3. Cashflow operating expense & other income
    const todayTransactions = cashTransactions.filter((t) => isToday(t.date));
    const otherIncome = todayTransactions
      .filter((t) => t.type === "income" && t.category === "other_income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const operatingExpenses = todayTransactions
      .filter(
        (t) =>
          t.type === "expense" &&
          ["other_expense", "payroll", "rent", "utilities", "logistics"].includes(
            t.category || ""
          )
      )
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const totalRevenue = salesRevenue + repairRevenue;
    const netProfit = salesProfit + repairProfit + otherIncome - operatingExpenses;

    const billsCount = todaySales.length + todayRepairs.length;

    return {
      totalRevenue,
      netProfit,
      billsCount,
    };
  }, [pinSales, pinRepairOrders, cashTransactions]);

  // --- SYSTEM TASKS / ALERTS ---
  const pendingTasks = useMemo(() => {
    const lowStockCount = pinMaterials.filter(
      (m) => (m.stock ?? 0) < 10
    ).length;
    const unpaidRepairCount = pinRepairOrders.filter(
      (r) => r.paymentStatus === "unpaid" || r.paymentStatus === "partial"
    ).length;

    return {
      lowStockCount,
      unpaidRepairCount,
    };
  }, [pinMaterials, pinRepairOrders]);

  return (
    <div className="bg-slate-50 dark:bg-[#0B0F19] text-slate-800 dark:text-slate-100 min-h-screen px-3 pb-28 pt-4 select-none font-sans md:px-6 lg:p-8 border border-slate-200 dark:border-slate-800/40 shadow-sm dark:shadow-2xl rounded-3xl transition-all duration-300">
      <div className="max-w-[1360px] mx-auto">
        {/* Page Title for Desktop */}
        <div className="hidden lg:flex items-center justify-between mb-8 pb-5 border-b border-slate-200 dark:border-slate-800/60">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-white dark:bg-slate-900/60 rounded-xl border border-emerald-500/20 dark:border-emerald-500/30 flex items-center justify-center shadow-md shadow-emerald-500/5">
              {/* Custom Shield-Lightning Logo */}
              <svg
                className="w-6 h-6 text-emerald-500 dark:text-emerald-400"
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zm-1.5-6.5l4-5.5h-3.5V7.5L9.5 13h3.5l-4 5.5v-3z" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-wide text-slate-800 dark:text-slate-100">
                {shopName}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Bảng điều khiển tổng hợp hệ thống thời gian thực
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 dark:text-slate-400 bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 px-4 py-2.5 rounded-xl shadow-sm">
            <span>Hôm nay: {new Date().toLocaleDateString("vi-VN")}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
          </div>
        </div>

        {/* Dashboard Content Container */}
        <div className="space-y-6">
          {/* Row 1: Reports Grid (Month Reports & Today Summaries side-by-side on desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* BÁO CÁO THÁNG NÀY */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Báo cáo</h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tháng này</span>
              </div>
              <div className="grid grid-cols-2 gap-3.5">
                {/* Doanh thu tháng */}
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Doanh thu
                  </span>
                  <div className="text-lg md:text-xl font-black text-blue-600 dark:text-[#4b93ff] truncate">
                    {formatVND(monthStats.totalRevenue)}
                  </div>
                </div>
                {/* Lợi nhuận tháng */}
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Lợi nhuận
                  </span>
                  <div className="text-lg md:text-xl font-black text-emerald-600 dark:text-[#4ade80] truncate">
                    {formatVND(monthStats.netProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* HÔM NAY TỔNG NHANH */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Hôm nay</h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tổng nhanh</span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {/* Doanh thu hôm nay */}
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-3.5 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Doanh thu
                  </span>
                  <div className="text-xs md:text-sm font-extrabold text-blue-600 dark:text-[#4b93ff] truncate">
                    {formatVND(todayStats.totalRevenue)}
                  </div>
                </div>
                {/* Lợi nhuận hôm nay */}
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-3.5 shadow-sm dark:shadow-xl hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Lợi nhuận
                  </span>
                  <div className="text-xs md:text-sm font-extrabold text-emerald-600 dark:text-[#4ade80] truncate">
                    {formatVND(todayStats.netProfit)}
                  </div>
                </div>
                {/* Bill phiếu hôm nay */}
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-3.5 shadow-sm dark:shadow-xl flex flex-col justify-between hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 block mb-1">
                    Bill/phiếu
                  </span>
                  <div className="text-base font-black text-slate-800 dark:text-slate-100">
                    {todayStats.billsCount}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Business Efficiency & Pending Tasks Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Hiệu quả kinh doanh (Spans 2 columns on desktop) */}
            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  Hiệu quả kinh doanh
                </h2>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Theo nguồn</span>
              </div>
              <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 md:p-6 shadow-sm dark:shadow-xl flex flex-col gap-5 h-[calc(100%-2.5rem)] justify-center">
                {/* Bán hàng */}
                <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 dark:border-slate-800/50">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                      <ShoppingCartIcon className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100 block">
                        Bán hàng
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Doanh thu {formatVND(monthStats.salesRevenue)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Lợi nhuận</span>
                    <span className="text-base font-extrabold text-blue-600 dark:text-blue-400">
                      {formatVND(monthStats.salesProfit)}
                    </span>
                  </div>
                </div>

                {/* Sửa chữa */}
                <div className="flex items-center justify-between pb-1">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center">
                      <WrenchScrewdriverIcon className="w-6 h-6 text-emerald-500 dark:text-emerald-400" />
                    </div>
                    <div>
                      <span className="text-base font-bold text-slate-800 dark:text-slate-100 block">
                        Sửa chữa
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Doanh thu {formatVND(monthStats.repairRevenue)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 dark:text-slate-400 block">Lợi nhuận</span>
                    <span className="text-base font-extrabold text-emerald-600 dark:text-[#4ade80]">
                      {formatVND(monthStats.repairProfit)}
                    </span>
                  </div>
                </div>

                {/* Desktop-only Profit Margin Progress Meter */}
                <div className="hidden md:block border-t border-slate-100 dark:border-slate-800/50 pt-4 mt-1">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    <span>Biên lợi nhuận thuần hệ thống</span>
                    <span className="text-emerald-600 dark:text-[#4ade80] font-bold">{monthStats.profitMargin.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, monthStats.profitMargin))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Cần xử lý & Thông tin chung (1 column on desktop) */}
            <div className="space-y-6">
              {/* CẦN XỬ LÝ */}
              <div>
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cần xử lý</h2>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Ưu tiên</span>
                </div>
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm dark:shadow-xl flex flex-col gap-4">
                  {/* Tồn kho thấp */}
                  <div
                    onClick={() => navigate("/materials")}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 p-2.5 rounded-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                        <ExclamationTriangleIcon className="w-5.5 h-5.5 text-amber-500 dark:text-amber-400" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">
                          Tồn kho thấp
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {pendingTasks.lowStockCount > 0
                            ? `${pendingTasks.lowStockCount} sản phẩm sắp hết hàng`
                            : "Mọi sản phẩm đều sẵn kho"}
                        </span>
                      </div>
                    </div>
                    {/* Chevron Right SVG */}
                    <svg
                      className="w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>

                  {/* Phiếu chưa thanh toán */}
                  <div
                    onClick={() => navigate("/receivables")}
                    className="flex items-center justify-between cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/30 p-2.5 rounded-xl transition-all duration-200"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center">
                        <CreditCardIcon className="w-5.5 h-5.5 text-rose-500 dark:text-rose-400" />
                      </div>
                      <div>
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-100 block">
                          Phiếu chưa thanh toán
                        </span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {pendingTasks.unpaidRepairCount > 0
                            ? `${pendingTasks.unpaidRepairCount} phiếu sửa chữa còn chờ thu tiền`
                            : "Không có phiếu nợ cần thu"}
                        </span>
                      </div>
                    </div>
                    {/* Chevron Right SVG */}
                    <svg
                      className="w-5 h-5 text-slate-400 hover:text-slate-600 transition-colors"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Desktop-Only System Summary Card */}
              <div className="hidden lg:block">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    Thông tin chung
                  </h2>
                </div>
                <div className="bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-5 shadow-sm dark:shadow-xl space-y-4">
                  <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 dark:border-slate-800/40">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Danh mục hàng hóa</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{pinProducts.length} sản phẩm</span>
                  </div>
                  <div className="flex justify-between items-center text-xs pb-3 border-b border-slate-100 dark:border-slate-800/40">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Danh mục vật liệu</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{pinMaterials.length} loại</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400 font-medium">Giao dịch trong tháng</span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">{cashTransactions.filter(t => isThisMonth(t.date)).length} lượt</span>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Quick Actions & Logout (Only visible on mobile/tablet, COMPLETELY HIDDEN on lg desktop) */}
          <div className="lg:hidden space-y-6 pt-2">
            {/* TÁC VỤ NHANH */}
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-3 px-1">
                Tác vụ nhanh
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {/* Tạo phiếu sửa */}
                <button
                  onClick={() => navigate("/repairs")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-2">
                    <WrenchScrewdriverIcon className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Tạo phiếu sửa
                  </span>
                </button>

                {/* Bán nhanh */}
                <button
                  onClick={() => navigate("/sales")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center mb-2">
                    <ShoppingCartIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Bán nhanh
                  </span>
                </button>

                {/* Nhập kho */}
                <button
                  onClick={() => navigate("/materials/goods-receipt/new")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center mb-2">
                    <CloudArrowUpIcon className="w-5 h-5 text-amber-500 dark:text-amber-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Nhập kho
                  </span>
                </button>

                {/* Thêm khách */}
                <button
                  onClick={() => navigate("/sales")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mb-2">
                    <UserCircleIcon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Thêm khách
                  </span>
                </button>

                {/* Thu công nợ */}
                <button
                  onClick={() => navigate("/receivables")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-center justify-center mb-2">
                    <CreditCardIcon className="w-5 h-5 text-rose-500 dark:text-rose-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Thu công nợ
                  </span>
                </button>

                {/* Báo cáo */}
                <button
                  onClick={() => navigate("/reports")}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-purple-500/10 border border-purple-500/20 rounded-xl flex items-center justify-center mb-2">
                    <ChartBarIcon className="w-5.5 h-5.5 text-purple-500 dark:text-purple-400" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Báo cáo
                  </span>
                </button>

                {/* Bộ tính Pin */}
                <button
                  onClick={() => setIsEstimatorOpen(true)}
                  className="flex flex-col items-center justify-center bg-white dark:bg-[#131929] border border-slate-200 dark:border-slate-800/60 rounded-2xl p-4 shadow-sm dark:shadow-xl hover:bg-slate-50 dark:hover:bg-slate-800/40 active:scale-95 transition-all text-center min-h-[96px]"
                >
                  <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center mb-2">
                    <span className="text-lg">🧮</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 leading-snug">
                    Bộ tính Pin
                  </span>
                </button>
              </div>
            </div>

            {/* ĐĂNG XUẤT BUTTON FOR MOBILE */}
            <div className="mt-8 px-1">
              <button
                onClick={handleLogout}
                className="w-full bg-[#8A2525] border border-red-850/20 text-white font-bold text-sm py-4 px-6 rounded-2xl shadow-xl active:scale-[0.98] transition-all hover:bg-red-800 flex items-center justify-center gap-2"
              >
                <span>Đăng xuất</span>
              </button>
            </div>
          </div>

        </div>
      </div>
      <BatteryEstimatorModal isOpen={isEstimatorOpen} onClose={() => setIsEstimatorOpen(false)} />
    </div>
  );
};

export default OverviewTab;
