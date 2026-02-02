import React, { useState, useMemo } from "react";
import type { PinSale, ProductionOrder, CashTransaction, PinRepairOrder, PinMaterial, PinProduct } from "../types";
import { Card, CardTitle, CardBody } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { DataTable, Column } from "./ui/Table";
import { Icon } from "./common/Icon";
import { useNavigate } from "react-router-dom";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

// Format compact currency for table display
const formatCompact = (amount: number) => {
  if (amount === 0) return "0 đ";
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
};

// Format large numbers with dots
const formatNumber = (num: number) => {
  return new Intl.NumberFormat("vi-VN").format(Math.round(num));
};

// Daily report row interface
interface DailyReportRow {
  date: string;
  dateFormatted: string;
  capitalCost: number;
  salesRevenue: number;
  repairMaterialCost: number;
  repairLaborCost: number;
  totalRevenue: number;
  salesProfit: number;
  otherIncome: number;
  otherExpense: number;
  netProfit: number;
  isTotal?: boolean;
}

// Category Tab type
type ReportCategory = "revenue" | "cashflow" | "production" | "inventory";

// Period filter type
type PeriodFilter = "today" | "7days" | "month" | "quarter" | "year" | "custom";

interface PinReportManagerProps {
  sales: PinSale[];
  orders?: ProductionOrder[];
  cashTransactions?: CashTransaction[];
  repairOrders?: PinRepairOrder[];
  materials?: PinMaterial[];
  products?: PinProduct[];
}

const PinReportManager: React.FC<PinReportManagerProps> = ({
  sales,
  orders = [],
  cashTransactions = [],
  repairOrders = [],
  materials = [],
  products = []
}) => {
  const navigate = useNavigate();
  const today = new Date();

  // State
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>("revenue");
  const [selectedMonth, setSelectedMonth] = useState(today.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(today.getFullYear());
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("month");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  // Sort state for daily report table
  type SortColumn = "date" | "capitalCost" | "salesRevenue" | "repairMaterialCost" | "repairLaborCost" | "totalRevenue" | "salesProfit" | "otherIncome" | "otherExpense" | "netProfit";
  const [sortColumn, setSortColumn] = useState<SortColumn>("date");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };


  // Calculate date range based on period filter
  const dateRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (periodFilter) {
      case "today":
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case "7days":
        start = new Date(now);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        break;
      case "month":
        start = new Date(selectedYear, selectedMonth - 1, 1);
        // If selected month is current month or future, limit end to today
        const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        end = monthEnd > now ? new Date(new Date(now).setHours(23, 59, 59, 999)) : monthEnd;
        break;
      case "quarter":
        const quarter = Math.floor((selectedMonth - 1) / 3);
        start = new Date(selectedYear, quarter * 3, 1);
        const quarterEnd = new Date(selectedYear, (quarter + 1) * 3, 0, 23, 59, 59, 999);
        end = quarterEnd > now ? new Date(new Date(now).setHours(23, 59, 59, 999)) : quarterEnd;
        break;
      case "year":
        start = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59, 999);
        end = yearEnd > now ? new Date(new Date(now).setHours(23, 59, 59, 999)) : yearEnd;
        break;
      case "custom":
        start = customStartDate ? new Date(customStartDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = customEndDate ? new Date(customEndDate + "T23:59:59") : now;
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return { start, end };
  }, [periodFilter, selectedMonth, selectedYear, customStartDate, customEndDate]);

  // Calculate number of days in range
  const daysInRange = useMemo(() => {
    const diffTime = Math.abs(dateRange.end.getTime() - dateRange.start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  }, [dateRange]);

  // Filter data by date range
  const filteredData = useMemo(() => {
    const { start, end } = dateRange;

    const filteredSales = sales.filter((s) => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });

    const filteredRepairs = repairOrders.filter((r) => {
      const d = new Date(r.creationDate);
      return d >= start && d <= end;
    });

    const filteredTransactions = cashTransactions.filter((t) => {
      const d = new Date(t.date);
      return d >= start && d <= end;
    });

    const filteredOrders = orders.filter((o) => {
      const d = new Date(o.creationDate);
      return d >= start && d <= end && o.status !== "Đã hủy";
    });

    return { filteredSales, filteredRepairs, filteredTransactions, filteredOrders };
  }, [sales, repairOrders, cashTransactions, orders, dateRange]);

  // Calculate summary stats
  const summaryStats = useMemo(() => {
    const { filteredSales, filteredRepairs, filteredTransactions } = filteredData;

    // Sales revenue (tiền hàng bán được)
    const salesRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);

    // Repair revenue (tiền sửa chữa - chỉ tính đơn đã thanh toán)
    const repairRevenue = filteredRepairs
      .filter(r => r.paymentStatus === "paid" || r.paymentStatus === "partial")
      .reduce((sum, r) => sum + (r.total || 0), 0);

    // Total revenue (Tổng doanh thu)
    const totalRevenue = salesRevenue + repairRevenue;

    // Cost of goods sold - COGS (Giá vốn hàng bán - từ items đã bán)
    const salesCOGS = filteredSales.reduce((sum, s) =>
      sum + s.items.reduce((itemSum, i) => itemSum + (i.costPrice || 0) * i.quantity, 0), 0
    );

    // Gross profit (Lợi nhuận gộp = Doanh thu - Giá vốn hàng bán)
    const grossProfit = salesRevenue - salesCOGS;

    // Inventory purchases (Vốn nhập kho - không tính vào chi phí trong kỳ)
    const inventoryPurchases = filteredTransactions
      .filter(t => t.type === "expense" && t.category === "inventory_purchase")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Operating expenses (Chi phí vận hành)
    const operatingExpenses = filteredTransactions
      .filter(t => t.type === "expense" &&
        ["other_expense", "payroll", "rent", "utilities", "logistics"].includes(t.category || ""))
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Other income (Thu nhập khác)
    const otherIncome = filteredTransactions
      .filter(t => t.type === "income" && t.category === "other_income")
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // Total cost for display (COGS + Operating expenses)
    const totalCost = salesCOGS + operatingExpenses;

    // Net profit (Lợi nhuận thuần = Lợi nhuận gộp + Thu khác - Chi phí vận hành)
    const netProfit = grossProfit + otherIncome - operatingExpenses;

    // Profit margin (Tỷ suất lợi nhuận)
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    return {
      totalRevenue,
      salesRevenue,
      repairRevenue,
      totalCost,
      salesCOGS,
      grossProfit,
      operatingExpenses,
      inventoryPurchases,
      netProfit,
      profitMargin,
      otherIncome
    };
  }, [filteredData]);

  // Calculate daily report data
  const dailyReportData = useMemo(() => {
    const { start, end } = dateRange;
    const { filteredSales, filteredRepairs, filteredTransactions } = filteredData;

    const dateMap = new Map<string, DailyReportRow>();

    // First, generate ALL dates in the range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = currentDate.toISOString().split("T")[0];
      dateMap.set(dateKey, createEmptyRow(dateKey, new Date(currentDate)));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process sales
    filteredSales.forEach((sale) => {
      const saleDate = new Date(sale.date);
      const dateKey = saleDate.toISOString().split("T")[0];
      if (dateMap.has(dateKey)) {
        const row = dateMap.get(dateKey)!;
        row.salesRevenue += sale.total;
        const saleCost = sale.items.reduce((sum, item) => sum + item.costPrice * item.quantity, 0);
        row.salesProfit += sale.total - saleCost;
      }
    });

    // Process repairs
    filteredRepairs.forEach((repair) => {
      const repairDate = new Date(repair.creationDate);
      const dateKey = repairDate.toISOString().split("T")[0];
      if (dateMap.has(dateKey)) {
        const row = dateMap.get(dateKey)!;
        const materialsCost = (repair.materialsUsed || []).reduce((sum, m) => sum + m.price * m.quantity, 0);
        row.repairMaterialCost += materialsCost;
        row.repairLaborCost += repair.laborCost || 0;
      }
    });

    // Process transactions
    filteredTransactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      const dateKey = txDate.toISOString().split("T")[0];
      if (dateMap.has(dateKey)) {
        const row = dateMap.get(dateKey)!;

        if (tx.category === "inventory_purchase") {
          row.capitalCost += Math.abs(tx.amount);
        } else if (tx.type === "income" && tx.category === "other_income") {
          row.otherIncome += Math.abs(tx.amount);
        } else if (tx.type === "expense" &&
          ["other_expense", "payroll", "rent", "utilities", "logistics"].includes(tx.category || "")) {
          row.otherExpense += Math.abs(tx.amount);
        }
      }
    });

    // Calculate totals for each row
    dateMap.forEach((row) => {
      row.totalRevenue = row.salesRevenue + row.repairLaborCost;
      row.netProfit = (row.salesProfit + row.otherIncome) - row.otherExpense;
    });

    // Sort and add total row
    const rows = Array.from(dateMap.values()).sort((a, b) =>
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    if (rows.length > 0) {
      rows.push({
        date: "total",
        dateFormatted: "Tổng:",
        capitalCost: rows.reduce((sum, r) => sum + r.capitalCost, 0),
        salesRevenue: rows.reduce((sum, r) => sum + r.salesRevenue, 0),
        repairMaterialCost: rows.reduce((sum, r) => sum + r.repairMaterialCost, 0),
        repairLaborCost: rows.reduce((sum, r) => sum + r.repairLaborCost, 0),
        totalRevenue: rows.reduce((sum, r) => sum + r.totalRevenue, 0),
        salesProfit: rows.reduce((sum, r) => sum + r.salesProfit, 0),
        otherIncome: rows.reduce((sum, r) => sum + r.otherIncome, 0),
        otherExpense: rows.reduce((sum, r) => sum + r.otherExpense, 0),
        netProfit: rows.reduce((sum, r) => sum + r.netProfit, 0),
        isTotal: true,
      });
    }

    return rows;
  }, [filteredData, dateRange]);

  // Sorted daily report data
  const sortedDailyData = useMemo(() => {
    if (dailyReportData.length === 0) return [];

    // Separate total row from data rows
    const totalRow = dailyReportData.find(r => r.isTotal);
    const dataRows = dailyReportData.filter(r => !r.isTotal);

    // Sort data rows
    const sorted = [...dataRows].sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      if (sortColumn === "date") {
        aVal = new Date(a.date).getTime();
        bVal = new Date(b.date).getTime();
      } else {
        aVal = a[sortColumn] || 0;
        bVal = b[sortColumn] || 0;
      }

      if (sortDirection === "asc") {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      } else {
        return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
      }
    });

    // Add total row back at the end
    if (totalRow) sorted.push(totalRow);
    return sorted;
  }, [dailyReportData, sortColumn, sortDirection]);

  function createEmptyRow(dateKey: string, date: Date): DailyReportRow {
    return {
      date: dateKey,
      dateFormatted: date.toLocaleDateString("vi-VN"),
      capitalCost: 0,
      salesRevenue: 0,
      repairMaterialCost: 0,
      repairLaborCost: 0,
      totalRevenue: 0,
      salesProfit: 0,
      otherIncome: 0,
      otherExpense: 0,
      netProfit: 0,
    };
  }

  // Production stats
  const productionStats = useMemo(() => {
    const { filteredOrders } = filteredData;
    return {
      total: filteredOrders.length,
      completed: filteredOrders.filter((o) => o.status === "Hoàn thành" || o.status === "Đã nhập kho").length,
      inProgress: filteredOrders.filter((o) => o.status === "Đang sản xuất").length,
      pending: filteredOrders.filter((o) => o.status === "Chờ sản xuất" || o.status === "Mới" || o.status === "Đang chờ").length,
      totalCost: filteredOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0),
    };
  }, [filteredData]);

  // Inventory stats
  const inventoryStats = useMemo(() => {
    const materialsValue = materials.reduce((sum, m) => sum + (m.purchasePrice * m.stock), 0);
    const productsValue = products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
    const lowStockMaterials = materials.filter(m => m.stock < 10).length;
    const outOfStockProducts = products.filter(p => p.stock === 0).length;

    return {
      materialsValue,
      productsValue,
      totalValue: materialsValue + productsValue,
      materialsCount: materials.length,
      productsCount: products.length,
      lowStockMaterials,
      outOfStockProducts,
    };
  }, [materials, products]);

  // Category tabs configuration
  const categoryTabs = [
    { id: "revenue" as ReportCategory, label: "Doanh thu", icon: "💰", color: "emerald" },
    { id: "cashflow" as ReportCategory, label: "Thu chi", icon: "📊", color: "blue" },
    { id: "production" as ReportCategory, label: "Sản xuất", icon: "🏭", color: "amber" },
    { id: "inventory" as ReportCategory, label: "Tồn kho", icon: "📦", color: "violet" },
  ];

  // Month names
  const months = ["T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8", "T9", "T10", "T11", "T12"];

  // Period filters
  const periodFilters = [
    { id: "today" as PeriodFilter, label: "Hôm nay" },
    { id: "7days" as PeriodFilter, label: "7 ngày" },
    { id: "month" as PeriodFilter, label: "Tháng" },
    { id: "quarter" as PeriodFilter, label: "Quý" },
    { id: "year" as PeriodFilter, label: "Năm" },
    { id: "custom" as PeriodFilter, label: "Tùy chỉnh" },
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-20 md:pb-0">
      {/* Category Tabs */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-slate-700/50 bg-slate-800/50">
        {categoryTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSelectedCategory(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${selectedCategory === tab.id
              ? `bg-${tab.color}-500/20 text-${tab.color}-400 border border-${tab.color}-500/50`
              : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white border border-transparent"
              }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Period Filter + Month Selector (conditional) + Actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-700/50">
        {/* Period Filter */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          {periodFilters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => setPeriodFilter(filter.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all whitespace-nowrap ${periodFilter === filter.id
                ? "bg-slate-600 text-white"
                : "text-slate-400 hover:text-white"
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Month Selector - only show when "Tháng" is selected */}
        {periodFilter === "month" && (
          <div className="flex items-center gap-2">
            {/* Year selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-cyan-500"
            >
              {[...Array(5)].map((_, i) => {
                const year = today.getFullYear() - 2 + i;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {months.map((month, idx) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(idx + 1)}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all whitespace-nowrap ${selectedMonth === idx + 1
                    ? "bg-slate-600 text-white"
                    : "text-slate-400 hover:bg-slate-700 hover:text-white"
                    }`}
                >
                  {month}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Year selector for quarter/year views */}
        {(periodFilter === "quarter" || periodFilter === "year") && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 text-xs font-medium rounded bg-slate-700 text-white border border-slate-600 focus:outline-none focus:border-cyan-500"
          >
            {[...Array(5)].map((_, i) => {
              const year = today.getFullYear() - 2 + i;
              return (
                <option key={year} value={year}>
                  Năm {year}
                </option>
              );
            })}
          </select>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors">
            <span>📥</span>
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
          <button
            onClick={() => navigate("/analytics")}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <span>📈</span>
            <span className="hidden sm:inline">Báo cáo nâng cao</span>
          </button>
        </div>
      </div>

      {/* Custom Date Range (shown when custom is selected) */}
      {periodFilter === "custom" && (
        <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/50">
          <span className="text-sm text-slate-400">Từ:</span>
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => setCustomStartDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
          <span className="text-sm text-slate-400">Đến:</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => setCustomEndDate(e.target.value)}
            className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
          />
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {selectedCategory === "revenue" && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-emerald-500">
              <div className="text-xs text-slate-400 mb-1">$ Tổng doanh thu</div>
              <div className="text-2xl md:text-3xl font-bold text-emerald-400">
                {formatNumber(summaryStats.totalRevenue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Bán hàng: {formatNumber(summaryStats.salesRevenue)} + Phiếu thu: {formatNumber(summaryStats.repairRevenue)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-fuchsia-500">
              <div className="text-xs text-slate-400 mb-1">↓ Tổng chi phí</div>
              <div className="text-2xl md:text-3xl font-bold text-fuchsia-400">
                {formatNumber(summaryStats.totalCost)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Giá vốn: {formatNumber(summaryStats.salesCOGS)} + Chi phí: {formatNumber(summaryStats.operatingExpenses)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-cyan-500">
              <div className="text-xs text-slate-400 mb-1">→ Lợi nhuận thuần</div>
              <div className={`text-2xl md:text-3xl font-bold ${summaryStats.netProfit >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                {formatNumber(summaryStats.netProfit)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Lợi nhuận gộp: {formatNumber(summaryStats.grossProfit)} - Chi phí: {formatNumber(summaryStats.operatingExpenses)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-violet-500">
              <div className="text-xs text-slate-400 mb-1">⊙ Tỷ suất lợi nhuận thuần</div>
              <div className="text-2xl md:text-3xl font-bold text-violet-400">
                {summaryStats.profitMargin.toFixed(1)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                % (Lợi nhuận thuần / Doanh thu tổng)
              </div>
            </div>
          </>
        )}

        {selectedCategory === "cashflow" && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-emerald-500">
              <div className="text-xs text-slate-400 mb-1">↑ Tổng thu</div>
              <div className="text-2xl md:text-3xl font-bold text-emerald-400">
                {formatNumber(summaryStats.totalRevenue + summaryStats.otherIncome)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Bán hàng + Sửa chữa + Thu khác)
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-red-500">
              <div className="text-xs text-slate-400 mb-1">↓ Tổng chi</div>
              <div className="text-2xl md:text-3xl font-bold text-red-400">
                {formatNumber(summaryStats.totalCost)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Giá vốn + Chi phí khác)
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-cyan-500">
              <div className="text-xs text-slate-400 mb-1">= Chênh lệch</div>
              <div className={`text-2xl md:text-3xl font-bold ${summaryStats.netProfit >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                {formatNumber(summaryStats.netProfit + summaryStats.otherIncome)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">đ</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-amber-500">
              <div className="text-xs text-slate-400 mb-1">📋 Số giao dịch</div>
              <div className="text-2xl md:text-3xl font-bold text-amber-400">
                {filteredData.filteredTransactions.length}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">giao dịch trong kỳ</div>
            </div>
          </>
        )}

        {selectedCategory === "production" && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-blue-500">
              <div className="text-xs text-slate-400 mb-1">📋 Tổng lệnh SX</div>
              <div className="text-2xl md:text-3xl font-bold text-blue-400">
                {productionStats.total}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">lệnh trong kỳ</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-emerald-500">
              <div className="text-xs text-slate-400 mb-1">✓ Hoàn thành</div>
              <div className="text-2xl md:text-3xl font-bold text-emerald-400">
                {productionStats.completed}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">lệnh</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-amber-500">
              <div className="text-xs text-slate-400 mb-1">⏳ Đang thực hiện</div>
              <div className="text-2xl md:text-3xl font-bold text-amber-400">
                {productionStats.inProgress}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">lệnh</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-slate-500">
              <div className="text-xs text-slate-400 mb-1">💰 Tổng chi phí SX</div>
              <div className="text-2xl md:text-3xl font-bold text-slate-300">
                {formatNumber(productionStats.totalCost)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">đ</div>
            </div>
          </>
        )}

        {selectedCategory === "inventory" && (
          <>
            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-violet-500">
              <div className="text-xs text-slate-400 mb-1">📦 Tổng giá trị tồn kho</div>
              <div className="text-2xl md:text-3xl font-bold text-violet-400">
                {formatNumber(inventoryStats.totalValue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">đ</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-teal-500">
              <div className="text-xs text-slate-400 mb-1">🧱 Vật tư</div>
              <div className="text-2xl md:text-3xl font-bold text-teal-400">
                {formatNumber(inventoryStats.materialsValue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">đ ({inventoryStats.materialsCount} loại)</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-amber-500">
              <div className="text-xs text-slate-400 mb-1">🎁 Sản phẩm</div>
              <div className="text-2xl md:text-3xl font-bold text-amber-400">
                {formatNumber(inventoryStats.productsValue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">đ ({inventoryStats.productsCount} loại)</div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-red-500">
              <div className="text-xs text-slate-400 mb-1">⚠️ Cảnh báo</div>
              <div className="text-2xl md:text-3xl font-bold text-red-400">
                {inventoryStats.lowStockMaterials + inventoryStats.outOfStockProducts}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                SP sắp hết / hết hàng
              </div>
            </div>
          </>
        )}
      </div>

      {/* Daily Report Table (for revenue category) */}
      {selectedCategory === "revenue" && (
        <div className="mx-4 mb-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300">
                Chi tiết đơn hàng theo ngày ({daysInRange} ngày)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-400">#</th>
                    <th
                      onClick={() => handleSort("date")}
                      className="px-3 py-2 text-left font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      NGÀY {sortColumn === "date" && (sortDirection === "asc" ? "↑" : "↓")}
                    </th>
                    <th
                      onClick={() => handleSort("capitalCost")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      VỐN NK {sortColumn === "capitalCost" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(1)</span>
                    </th>
                    <th
                      onClick={() => handleSort("salesRevenue")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      TIỀN HÀNG {sortColumn === "salesRevenue" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(2)</span>
                    </th>
                    <th
                      onClick={() => handleSort("repairMaterialCost")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      VỐN SC {sortColumn === "repairMaterialCost" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(3)</span>
                    </th>
                    <th
                      onClick={() => handleSort("repairLaborCost")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      CÔNG SC {sortColumn === "repairLaborCost" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(4)</span>
                    </th>
                    <th
                      onClick={() => handleSort("totalRevenue")}
                      className="px-3 py-2 text-right font-medium text-blue-400 cursor-pointer hover:text-blue-300 transition-colors"
                    >
                      DOANH THU {sortColumn === "totalRevenue" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(5=2)</span>
                    </th>
                    <th
                      onClick={() => handleSort("salesProfit")}
                      className="px-3 py-2 text-right font-medium text-emerald-400 cursor-pointer hover:text-emerald-300 transition-colors"
                    >
                      LỢI NHUẬN {sortColumn === "salesProfit" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(6=2-1)</span>
                    </th>
                    <th
                      onClick={() => handleSort("otherIncome")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      THU KHÁC {sortColumn === "otherIncome" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(7)</span>
                    </th>
                    <th
                      onClick={() => handleSort("otherExpense")}
                      className="px-3 py-2 text-right font-medium text-slate-400 cursor-pointer hover:text-white transition-colors"
                    >
                      CHI KHÁC {sortColumn === "otherExpense" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(8)</span>
                    </th>
                    <th
                      onClick={() => handleSort("netProfit")}
                      className="px-3 py-2 text-right font-medium cursor-pointer hover:text-white transition-colors"
                    >
                      LN RÒNG {sortColumn === "netProfit" && (sortDirection === "asc" ? "↑" : "↓")}<br /><span className="text-[9px]">(9=(6+7)-8)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {sortedDailyData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-8 text-center text-slate-500">
                        Không có dữ liệu trong khoảng thời gian này
                      </td>
                    </tr>
                  ) : (
                    sortedDailyData.map((row, index) => (
                      <tr
                        key={row.date}
                        className={row.isTotal ? "bg-slate-700/50 font-bold" : "hover:bg-slate-700/30"}
                      >
                        <td className="px-3 py-2 text-slate-500">{row.isTotal ? "" : index + 1}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{row.dateFormatted}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatCompact(row.capitalCost)}</td>
                        <td className="px-3 py-2 text-right text-blue-400">{formatCompact(row.salesRevenue)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatCompact(row.repairMaterialCost)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatCompact(row.repairLaborCost)}</td>
                        <td className="px-3 py-2 text-right text-blue-400">{formatCompact(row.totalRevenue)}</td>
                        <td className="px-3 py-2 text-right text-emerald-400">{formatCompact(row.salesProfit)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatCompact(row.otherIncome)}</td>
                        <td className="px-3 py-2 text-right text-slate-400">{formatCompact(row.otherExpense)}</td>
                        <td className={`px-3 py-2 text-right font-medium ${row.netProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {formatCompact(row.netProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Cash Flow Details (for cashflow category) */}
      {selectedCategory === "cashflow" && (
        <div className="mx-4 mb-4 space-y-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300">Giao dịch gần đây</h3>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
              {filteredData.filteredTransactions.slice(0, 20).map((tx) => (
                <div key={tx.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-700/30">
                  <div>
                    <div className="text-sm text-white">{tx.notes || tx.category}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(tx.date).toLocaleDateString("vi-VN")} • {tx.contact?.name || "N/A"}
                    </div>
                  </div>
                  <div className={`text-sm font-medium ${tx.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                    {tx.type === "income" ? "+" : "-"}{formatCompact(tx.amount)}
                  </div>
                </div>
              ))}
              {filteredData.filteredTransactions.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">Không có giao dịch</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Production Details (for production category) */}
      {selectedCategory === "production" && (
        <div className="mx-4 mb-4 space-y-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300">Lệnh sản xuất trong kỳ</h3>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-96 overflow-y-auto">
              {filteredData.filteredOrders.slice(0, 20).map((order) => (
                <div key={order.id} className="px-4 py-3 flex items-center justify-between hover:bg-slate-700/30">
                  <div>
                    <div className="text-sm text-white">{order.productName}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(order.creationDate).toLocaleDateString("vi-VN")} • SL: {order.quantityProduced}
                    </div>
                  </div>
                  <Badge
                    variant={
                      order.status === "Hoàn thành" || order.status === "Đã nhập kho" ? "success" :
                        order.status === "Đang sản xuất" ? "warning" : "neutral"
                    }
                    size="sm"
                  >
                    {order.status}
                  </Badge>
                </div>
              ))}
              {filteredData.filteredOrders.length === 0 && (
                <div className="px-4 py-8 text-center text-slate-500">Không có lệnh sản xuất</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Inventory Details (for inventory category) */}
      {selectedCategory === "inventory" && (
        <div className="mx-4 mb-4 grid md:grid-cols-2 gap-4">
          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300">Vật tư sắp hết ({inventoryStats.lowStockMaterials})</h3>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
              {materials.filter(m => m.stock < 10).slice(0, 10).map((m) => (
                <div key={m.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="text-sm text-white truncate max-w-[200px]">{m.name}</div>
                  <div className="text-sm text-red-400">{m.stock} {m.unit}</div>
                </div>
              ))}
              {inventoryStats.lowStockMaterials === 0 && (
                <div className="px-4 py-4 text-center text-slate-500 text-sm">Tất cả đủ hàng</div>
              )}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700">
              <h3 className="text-sm font-medium text-slate-300">Sản phẩm hết hàng ({inventoryStats.outOfStockProducts})</h3>
            </div>
            <div className="divide-y divide-slate-700/50 max-h-64 overflow-y-auto">
              {products.filter(p => p.stock === 0).slice(0, 10).map((p) => (
                <div key={p.id} className="px-4 py-2 flex items-center justify-between hover:bg-slate-700/30">
                  <div className="text-sm text-white truncate max-w-[200px]">{p.name}</div>
                  <div className="text-sm text-red-400">Hết hàng</div>
                </div>
              ))}
              {inventoryStats.outOfStockProducts === 0 && (
                <div className="px-4 py-4 text-center text-slate-500 text-sm">Tất cả còn hàng</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinReportManager;
