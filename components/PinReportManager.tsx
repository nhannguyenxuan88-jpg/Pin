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
  salesCOGS: number; // Giá vốn hàng bán
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

  // Expanded day detail
  const [expandedDate, setExpandedDate] = useState<string | null>(null);

  // Sort state for daily report table
  type SortColumn = "date" | "capitalCost" | "salesCOGS" | "salesRevenue" | "repairMaterialCost" | "repairLaborCost" | "totalRevenue" | "salesProfit" | "otherIncome" | "otherExpense" | "netProfit";
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

    // Helper: get local date key (YYYY-MM-DD) avoiding UTC timezone shift
    const toLocalDateKey = (d: Date): string => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const dateMap = new Map<string, DailyReportRow>();

    // First, generate ALL dates in the range
    const currentDate = new Date(start);
    while (currentDate <= end) {
      const dateKey = toLocalDateKey(currentDate);
      dateMap.set(dateKey, createEmptyRow(dateKey, new Date(currentDate)));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Process sales
    filteredSales.forEach((sale) => {
      const saleDate = new Date(sale.date);
      const dateKey = toLocalDateKey(saleDate);
      if (dateMap.has(dateKey)) {
        const row = dateMap.get(dateKey)!;
        row.salesRevenue += sale.total;
        const saleCost = sale.items.reduce((sum, item) => sum + (item.costPrice || 0) * item.quantity, 0);
        row.salesCOGS += saleCost;
        row.salesProfit += sale.total - saleCost;
      }
    });

    // Process repairs
    filteredRepairs.forEach((repair) => {
      const repairDate = new Date(repair.creationDate);
      const dateKey = toLocalDateKey(repairDate);
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
      const dateKey = toLocalDateKey(txDate);
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
        salesCOGS: rows.reduce((sum, r) => sum + r.salesCOGS, 0),
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

  // Revenue summary derived from daily table total row (guarantees cards match table)
  const revenueSummary = useMemo(() => {
    const totalRow = dailyReportData.find(r => r.isTotal);
    if (!totalRow) return {
      totalRevenue: 0, salesRevenue: 0, repairRevenue: 0,
      totalCost: 0, salesCOGS: 0, operatingExpenses: 0,
      grossProfit: 0, netProfit: 0, profitMargin: 0,
      otherIncome: 0, capitalCost: 0,
    };
    const totalRev = totalRow.salesRevenue + totalRow.repairLaborCost;
    return {
      totalRevenue: totalRev,
      salesRevenue: totalRow.salesRevenue,
      repairRevenue: totalRow.repairLaborCost,
      salesCOGS: totalRow.salesCOGS,
      operatingExpenses: totalRow.otherExpense,
      totalCost: totalRow.salesCOGS + totalRow.otherExpense,
      grossProfit: totalRow.salesProfit,
      netProfit: totalRow.netProfit,
      profitMargin: totalRev > 0 ? (totalRow.netProfit / totalRev) * 100 : 0,
      otherIncome: totalRow.otherIncome,
      capitalCost: totalRow.capitalCost,
    };
  }, [dailyReportData]);

  function createEmptyRow(dateKey: string, date: Date): DailyReportRow {
    return {
      date: dateKey,
      dateFormatted: date.toLocaleDateString("vi-VN"),
      capitalCost: 0,
      salesRevenue: 0,
      salesCOGS: 0,
      repairMaterialCost: 0,
      repairLaborCost: 0,
      totalRevenue: 0,
      salesProfit: 0,
      otherIncome: 0,
      otherExpense: 0,
      netProfit: 0,
    };
  }

  // Get detailed transactions for a specific date
  const getDayDetails = (dateKey: string) => {
    const { filteredSales, filteredRepairs, filteredTransactions } = filteredData;

    const toLocal = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    };

    const daySales = filteredSales.filter((s) => {
      return toLocal(new Date(s.date)) === dateKey;
    });

    const dayRepairs = filteredRepairs.filter((r) => {
      return toLocal(new Date(r.creationDate)) === dateKey;
    });

    const dayTransactions = filteredTransactions.filter((t) => {
      return toLocal(new Date(t.date)) === dateKey;
    });

    return { daySales, dayRepairs, dayTransactions };
  };

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
                {formatNumber(revenueSummary.totalRevenue)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Bán hàng: {formatNumber(revenueSummary.salesRevenue)} + Sửa chữa: {formatNumber(revenueSummary.repairRevenue)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-fuchsia-500">
              <div className="text-xs text-slate-400 mb-1">↓ Tổng chi phí</div>
              <div className="text-2xl md:text-3xl font-bold text-fuchsia-400">
                {formatNumber(revenueSummary.totalCost)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Giá vốn: {formatNumber(revenueSummary.salesCOGS)} + Chi phí: {formatNumber(revenueSummary.operatingExpenses)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-cyan-500">
              <div className="text-xs text-slate-400 mb-1">→ Lợi nhuận thuần</div>
              <div className={`text-2xl md:text-3xl font-bold ${revenueSummary.netProfit >= 0 ? "text-cyan-400" : "text-red-400"}`}>
                {formatNumber(revenueSummary.netProfit)}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                đ (Lãi gộp: {formatNumber(revenueSummary.grossProfit)} - Chi phí: {formatNumber(revenueSummary.operatingExpenses)})
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl p-4 border-l-4 border-violet-500">
              <div className="text-xs text-slate-400 mb-1">⊙ Tỷ suất lợi nhuận thuần</div>
              <div className="text-2xl md:text-3xl font-bold text-violet-400">
                {revenueSummary.profitMargin.toFixed(1)}
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
          <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700/50">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Icon name="calendar" className="w-4 h-4 text-cyan-400" />
                Chi tiết theo ngày
                <span className="text-xs font-normal text-slate-500 bg-slate-700 px-2 py-0.5 rounded-full">{daysInRange} ngày</span>
              </h3>
              <span className="text-[10px] text-slate-500">Nhấn vào ngày để xem chi tiết</span>
            </div>

            {/* === MOBILE: Card-based layout === */}
            <div className="md:hidden divide-y divide-slate-700/30 max-h-[70vh] overflow-y-auto">
              {sortedDailyData.length === 0 ? (
                <div className="px-4 py-12 text-center text-slate-500">
                  <Icon name="chart-bar" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>Không có dữ liệu trong khoảng thời gian này</p>
                </div>
              ) : (
                sortedDailyData.map((row, index) => {
                  const isExpanded = expandedDate === row.date;
                  const dayDetails = isExpanded && !row.isTotal ? getDayDetails(row.date) : null;
                  return (
                    <div key={row.date}>
                      <div
                        onClick={() => !row.isTotal && setExpandedDate(isExpanded ? null : row.date)}
                        className={`px-4 py-3 ${row.isTotal ? "bg-slate-700/60" : "hover:bg-slate-700/20 cursor-pointer active:bg-slate-700/40"} ${isExpanded ? "bg-slate-700/30" : ""}`}
                      >
                        {/* Date header */}
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="flex items-center gap-2">
                            {!row.isTotal && (
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${isExpanded ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-700 text-slate-400"}`}>
                                {isExpanded ? "▼" : index + 1}
                              </span>
                            )}
                            <span className={`text-sm ${row.isTotal ? "font-bold text-white" : "font-medium text-slate-200"}`}>
                              {row.dateFormatted}
                            </span>
                          </div>
                          <span className={`text-sm font-bold px-2 py-0.5 rounded ${
                            row.netProfit > 0 ? "text-emerald-400 bg-emerald-500/10" :
                            row.netProfit < 0 ? "text-red-400 bg-red-500/10" :
                            "text-slate-400"
                          }`}>
                            {row.netProfit > 0 ? "+" : ""}{formatCompact(row.netProfit)}
                          </span>
                        </div>
                        {/* Financial summary */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Doanh thu bán hàng</span>
                            <span className="text-blue-400 font-medium">{formatCompact(row.salesRevenue)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Giá vốn hàng bán</span>
                            <span className="text-orange-400">{formatCompact(row.salesCOGS)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Lãi gộp bán hàng</span>
                            <span className={`font-medium ${row.salesProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {formatCompact(row.salesProfit)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-500">Tiền công SC</span>
                            <span className="text-blue-400/80">{formatCompact(row.repairLaborCost)}</span>
                          </div>
                          {(row.repairMaterialCost > 0 || row.isTotal) && (
                            <div className="flex justify-between">
                              <span className="text-slate-500">Vật tư SC</span>
                              <span className="text-orange-400/80">{formatCompact(row.repairMaterialCost)}</span>
                            </div>
                          )}
                          {row.capitalCost > 0 && (
                            <div className="flex justify-between col-span-2 pt-1 border-t border-slate-700/20">
                              <span className="text-slate-600 italic text-[10px]">📦 Nhập kho (không tính vào lãi)</span>
                              <span className="text-slate-500 text-[10px]">{formatCompact(row.capitalCost)}</span>
                            </div>
                          )}
                          {(row.otherIncome > 0 || row.otherExpense > 0 || row.isTotal) && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Thu khác</span>
                                <span className="text-teal-400">{formatCompact(row.otherIncome)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-500">Chi khác</span>
                                <span className="text-orange-400">{formatCompact(row.otherExpense)}</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Expanded detail panel - MOBILE */}
                      {isExpanded && dayDetails && (
                        <div className="bg-slate-900/60 border-t border-slate-700/30 px-4 py-3 space-y-3">
                          {/* Profit breakdown */}
                          <div className="bg-slate-800/80 rounded-lg p-3 border border-slate-700/50">
                            <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-2 font-semibold">Cách tính lợi nhuận</h4>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between text-slate-300">
                                <span>Doanh thu bán hàng</span>
                                <span className="text-blue-400">{formatCompact(row.salesRevenue)}</span>
                              </div>
                              <div className="flex justify-between text-slate-300">
                                <span>(-) Giá vốn hàng bán</span>
                                <span className="text-orange-400">- {formatCompact(row.salesCOGS)}</span>
                              </div>
                              <div className="flex justify-between font-semibold border-t border-slate-700/50 pt-1">
                                <span className="text-slate-200">= Lãi gộp bán hàng</span>
                                <span className={row.salesProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                                  {formatCompact(row.salesProfit)}
                                </span>
                              </div>
                              {row.otherIncome > 0 && (
                                <div className="flex justify-between text-slate-300">
                                  <span>(+) Thu nhập khác</span>
                                  <span className="text-teal-400">+ {formatCompact(row.otherIncome)}</span>
                                </div>
                              )}
                              {row.otherExpense > 0 && (
                                <div className="flex justify-between text-slate-300">
                                  <span>(-) Chi phí khác</span>
                                  <span className="text-orange-400">- {formatCompact(row.otherExpense)}</span>
                                </div>
                              )}
                              <div className="flex justify-between font-bold border-t border-slate-600/50 pt-1 text-sm">
                                <span className="text-white">= LÃI RÒNG</span>
                                <span className={`px-2 py-0.5 rounded ${row.netProfit >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-red-400 bg-red-500/10"}`}>
                                  {row.netProfit >= 0 ? "+" : ""}{formatCompact(row.netProfit)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Sales list */}
                          {dayDetails.daySales.length > 0 && (
                            <div>
                              <h4 className="text-[10px] uppercase tracking-wider text-blue-400 mb-1.5 font-semibold flex items-center gap-1">
                                <Icon name="storefront" className="w-3 h-3" />
                                Đơn bán hàng ({dayDetails.daySales.length})
                              </h4>
                              <div className="space-y-1.5">
                                {dayDetails.daySales.map((sale) => {
                                  const saleCOGS = sale.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
                                  return (
                                    <div key={sale.id} className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/30">
                                      <div className="flex justify-between items-start mb-1">
                                        <div>
                                          <span className="text-xs text-slate-300 font-medium">{sale.customer?.name || "Khách lẻ"}</span>
                                          {sale.code && <span className="text-[10px] text-slate-500 ml-1.5">#{sale.code}</span>}
                                        </div>
                                        <span className="text-xs font-semibold text-blue-400">{formatCompact(sale.total)}</span>
                                      </div>
                                      <div className="text-[10px] text-slate-500 space-y-0.5">
                                        {sale.items.slice(0, 3).map((item, i) => (
                                          <div key={i} className="flex justify-between">
                                            <span className="truncate max-w-[60%]">{item.name} x{item.quantity}</span>
                                            <span>{formatCompact(item.sellingPrice * item.quantity)}</span>
                                          </div>
                                        ))}
                                        {sale.items.length > 3 && (
                                          <div className="text-slate-600">... +{sale.items.length - 3} sản phẩm khác</div>
                                        )}
                                      </div>
                                      <div className="flex justify-between text-[10px] mt-1 pt-1 border-t border-slate-700/30">
                                        <span className="text-slate-500">Giá vốn: {formatCompact(saleCOGS)}</span>
                                        <span className={`font-medium ${sale.total - saleCOGS >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                          Lãi: {formatCompact(sale.total - saleCOGS)}
                                        </span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Repairs list */}
                          {dayDetails.dayRepairs.length > 0 && (
                            <div>
                              <h4 className="text-[10px] uppercase tracking-wider text-amber-400 mb-1.5 font-semibold flex items-center gap-1">
                                <Icon name="gear" className="w-3 h-3" />
                                Đơn sửa chữa ({dayDetails.dayRepairs.length})
                              </h4>
                              <div className="space-y-1.5">
                                {dayDetails.dayRepairs.map((repair) => {
                                  const matCost = (repair.materialsUsed || []).reduce((s, m) => s + m.price * m.quantity, 0);
                                  return (
                                    <div key={repair.id} className="bg-slate-800/60 rounded-lg p-2.5 border border-slate-700/30">
                                      <div className="flex justify-between items-start mb-1">
                                        <div>
                                          <span className="text-xs text-slate-300 font-medium">{repair.customerName}</span>
                                          <span className="text-[10px] text-slate-500 ml-1.5">{repair.deviceName}</span>
                                        </div>
                                        <Badge variant={repair.paymentStatus === "paid" ? "success" : repair.paymentStatus === "partial" ? "warning" : "neutral"} size="sm">
                                          {repair.paymentStatus === "paid" ? "Đã TT" : repair.paymentStatus === "partial" ? "TT 1 phần" : "Chưa TT"}
                                        </Badge>
                                      </div>
                                      <div className="flex justify-between text-[10px] text-slate-400">
                                        <span>Vật tư: {formatCompact(matCost)} · Công: {formatCompact(repair.laborCost || 0)}</span>
                                        <span className="font-medium text-amber-400">Tổng: {formatCompact(repair.total || 0)}</span>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Transactions list */}
                          {dayDetails.dayTransactions.length > 0 && (
                            <div>
                              <h4 className="text-[10px] uppercase tracking-wider text-violet-400 mb-1.5 font-semibold flex items-center gap-1">
                                <Icon name="money" className="w-3 h-3" />
                                Giao dịch khác ({dayDetails.dayTransactions.length})
                              </h4>
                              <div className="space-y-1">
                                {dayDetails.dayTransactions.map((tx) => (
                                  <div key={tx.id} className="flex items-center justify-between py-1.5 px-2.5 bg-slate-800/40 rounded-lg">
                                    <div>
                                      <span className="text-xs text-slate-300">{tx.notes || tx.category || "Giao dịch"}</span>
                                      {tx.contact?.name && <span className="text-[10px] text-slate-500 ml-1.5">• {tx.contact.name}</span>}
                                    </div>
                                    <span className={`text-xs font-medium ${tx.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                                      {tx.type === "income" ? "+" : "-"}{formatCompact(tx.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {dayDetails.daySales.length === 0 && dayDetails.dayRepairs.length === 0 && dayDetails.dayTransactions.length === 0 && (
                            <div className="text-center text-slate-500 text-xs py-3">Không có giao dịch nào trong ngày này</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* === DESKTOP: Clean table layout === */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                {/* Grouped column headers */}
                <thead>
                  <tr className="bg-slate-700/70">
                    <th colSpan={2} className="px-3 py-1.5 text-left text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-600/50"></th>
                    <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-blue-400/70 border-b border-slate-600/50 border-l border-l-slate-600/30">
                      Doanh thu
                    </th>
                    <th colSpan={2} className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-orange-400/70 border-b border-slate-600/50 border-l border-l-slate-600/30">
                      Giá vốn hàng bán
                    </th>
                    <th colSpan={3} className="px-3 py-1.5 text-center text-[10px] uppercase tracking-wider text-emerald-400/70 border-b border-slate-600/50 border-l border-l-slate-600/30">
                      Lợi nhuận
                    </th>
                  </tr>
                  <tr className="bg-slate-700/40">
                    <th className="w-10 px-3 py-2.5 text-center font-semibold text-slate-500 text-xs">#</th>
                    <th
                      onClick={() => handleSort("date")}
                      className="px-3 py-2.5 text-left font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center gap-1">
                        Ngày
                        {sortColumn === "date" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("salesRevenue")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors border-l border-l-slate-600/30 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Bán hàng
                        {sortColumn === "salesRevenue" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("repairLaborCost")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Sửa chữa
                        {sortColumn === "repairLaborCost" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("salesCOGS")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors border-l border-l-slate-600/30 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        COGS
                        {sortColumn === "salesCOGS" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("repairMaterialCost")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Vật tư SC
                        {sortColumn === "repairMaterialCost" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("salesProfit")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors border-l border-l-slate-600/30 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Lãi gộp
                        {sortColumn === "salesProfit" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("otherIncome")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span className="hidden lg:inline">Thu/Chi</span><span className="lg:hidden">T/C</span> khác
                        {sortColumn === "otherIncome" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort("netProfit")}
                      className="px-3 py-2.5 text-right font-semibold text-slate-300 text-xs cursor-pointer hover:text-white transition-colors select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-emerald-400">Lãi ròng</span>
                        {sortColumn === "netProfit" && <span className="text-cyan-400">{sortDirection === "asc" ? "↑" : "↓"}</span>}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedDailyData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <Icon name="chart-bar" className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p>Không có dữ liệu trong khoảng thời gian này</p>
                      </td>
                    </tr>
                  ) : (
                    sortedDailyData.map((row, index) => {
                      const hasData = row.totalRevenue > 0 || row.salesCOGS > 0 || row.capitalCost > 0 || row.otherIncome > 0 || row.otherExpense > 0;
                      const otherNet = row.otherIncome - row.otherExpense;
                      const isExpanded = expandedDate === row.date;
                      const dayDetails = isExpanded && !row.isTotal ? getDayDetails(row.date) : null;
                      return (
                        <React.Fragment key={row.date}>
                          <tr
                            onClick={() => !row.isTotal && setExpandedDate(isExpanded ? null : row.date)}
                            className={
                              row.isTotal
                                ? "bg-gradient-to-r from-slate-700/80 to-slate-700/40 border-t-2 border-t-slate-500"
                                : `${isExpanded ? "bg-cyan-900/15" : index % 2 === 0 ? "bg-slate-800/30" : "bg-slate-750/20"} hover:bg-slate-700/40 transition-colors cursor-pointer`
                            }
                          >
                            <td className="px-3 py-2.5 text-center text-slate-600 text-xs">
                              {row.isTotal ? "" : isExpanded ? "▼" : index + 1}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className={`${row.isTotal ? "font-bold text-white text-sm" : isExpanded ? "text-cyan-300 font-medium" : "text-slate-300"}`}>
                                {row.dateFormatted}
                              </span>
                            </td>
                            {/* Revenue group */}
                            <td className={`px-3 py-2.5 text-right border-l border-l-slate-700/30 ${
                              row.isTotal ? "font-bold text-blue-300" :
                              row.salesRevenue > 0 ? "text-blue-400" : "text-slate-600"
                            }`}>
                              {row.salesRevenue > 0 || row.isTotal ? formatCompact(row.salesRevenue) : "-"}
                            </td>
                            <td className={`px-3 py-2.5 text-right ${
                              row.isTotal ? "font-bold text-blue-300" :
                              row.repairLaborCost > 0 ? "text-blue-400/80" : "text-slate-600"
                            }`}>
                              {row.repairLaborCost > 0 || row.isTotal ? formatCompact(row.repairLaborCost) : "-"}
                            </td>
                            {/* COGS group */}
                            <td className={`px-3 py-2.5 text-right border-l border-l-slate-700/30 ${
                              row.isTotal ? "font-bold text-orange-300" :
                              row.salesCOGS > 0 ? "text-orange-400" : "text-slate-600"
                            }`}>
                              {row.salesCOGS > 0 || row.isTotal ? formatCompact(row.salesCOGS) : "-"}
                            </td>
                            <td className={`px-3 py-2.5 text-right ${
                              row.isTotal ? "font-bold text-orange-300" :
                              row.repairMaterialCost > 0 ? "text-orange-400/80" : "text-slate-600"
                            }`}>
                              {row.repairMaterialCost > 0 || row.isTotal ? formatCompact(row.repairMaterialCost) : "-"}
                            </td>
                            {/* Profit group */}
                            <td className={`px-3 py-2.5 text-right border-l border-l-slate-700/30 ${
                              row.isTotal ? "font-bold" : ""
                            } ${row.salesProfit > 0 ? "text-emerald-400" : row.salesProfit < 0 ? "text-red-400" : "text-slate-600"}`}>
                              {hasData || row.isTotal ? formatCompact(row.salesProfit) : "-"}
                            </td>
                            <td className={`px-3 py-2.5 text-right ${
                              row.isTotal ? "font-bold" : ""
                            } ${otherNet > 0 ? "text-teal-400" : otherNet < 0 ? "text-orange-400" : "text-slate-600"}`}>
                              {(row.otherIncome > 0 || row.otherExpense > 0 || row.isTotal)
                                ? (otherNet >= 0 ? "+" : "") + formatCompact(otherNet)
                                : "-"}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold ${
                              row.isTotal ? "text-base" : ""
                            } ${row.netProfit > 0 ? "text-emerald-400" : row.netProfit < 0 ? "text-red-400" : "text-slate-600"}`}>
                              {hasData || row.isTotal ? (
                                <span className={`${row.isTotal ? "px-2 py-1 rounded-md" : ""} ${
                                  row.isTotal && row.netProfit > 0 ? "bg-emerald-500/15" :
                                  row.isTotal && row.netProfit < 0 ? "bg-red-500/15" : ""
                                }`}>
                                  {row.netProfit > 0 ? "+" : ""}{formatCompact(row.netProfit)}
                                </span>
                              ) : "-"}
                            </td>
                          </tr>

                          {/* === EXPANDED DETAIL ROW === */}
                          {isExpanded && dayDetails && (
                            <tr>
                              <td colSpan={9} className="p-0">
                                <div className="bg-slate-900/70 border-y border-cyan-500/20">
                                  <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
                                    {/* LEFT: Profit calculation breakdown */}
                                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                                      <h4 className="text-xs uppercase tracking-wider text-cyan-400 mb-3 font-semibold flex items-center gap-1.5">
                                        <Icon name="chart-bar" className="w-3.5 h-3.5" />
                                        Cách tính lợi nhuận ngày {row.dateFormatted}
                                      </h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between text-slate-300 py-1">
                                          <span>Doanh thu bán hàng</span>
                                          <span className="font-medium text-blue-400">{formatCompact(row.salesRevenue)}</span>
                                        </div>
                                        <div className="flex justify-between text-slate-400 py-1">
                                          <span>(-) Giá vốn hàng bán (COGS)</span>
                                          <span className="text-orange-400">- {formatCompact(row.salesCOGS)}</span>
                                        </div>
                                        <div className="flex justify-between font-semibold py-1.5 border-t border-dashed border-slate-700">
                                          <span className="text-slate-200">= Lãi gộp bán hàng</span>
                                          <span className={row.salesProfit >= 0 ? "text-emerald-400" : "text-red-400"}>
                                            {formatCompact(row.salesProfit)}
                                          </span>
                                        </div>
                                        {row.repairLaborCost > 0 && (
                                          <div className="flex justify-between text-slate-300 py-1">
                                            <span>(+) Doanh thu sửa chữa</span>
                                            <span className="text-blue-400">+ {formatCompact(row.repairLaborCost)}</span>
                                          </div>
                                        )}
                                        {row.repairMaterialCost > 0 && (
                                          <div className="flex justify-between text-slate-400 py-1">
                                            <span>(-) Chi phí vật tư SC</span>
                                            <span className="text-orange-400">- {formatCompact(row.repairMaterialCost)}</span>
                                          </div>
                                        )}
                                        {row.otherIncome > 0 && (
                                          <div className="flex justify-between text-slate-300 py-1">
                                            <span>(+) Thu nhập khác</span>
                                            <span className="text-teal-400">+ {formatCompact(row.otherIncome)}</span>
                                          </div>
                                        )}
                                        {row.otherExpense > 0 && (
                                          <div className="flex justify-between text-slate-400 py-1">
                                            <span>(-) Chi phí khác</span>
                                            <span className="text-orange-400">- {formatCompact(row.otherExpense)}</span>
                                          </div>
                                        )}
                                        <div className="flex justify-between font-bold py-2 border-t-2 border-slate-600 text-base">
                                          <span className="text-white">= LÃI RÒNG</span>
                                          <span className={`px-3 py-1 rounded-lg ${row.netProfit >= 0 ? "text-emerald-400 bg-emerald-500/15" : "text-red-400 bg-red-500/15"}`}>
                                            {row.netProfit >= 0 ? "+" : ""}{formatCompact(row.netProfit)}
                                          </span>
                                        </div>
                                        {row.capitalCost > 0 && (
                                          <div className="flex justify-between text-slate-500 text-xs pt-1 border-t border-slate-700/30">
                                            <span className="italic">Ghi chú: Vốn nhập kho</span>
                                            <span>{formatCompact(row.capitalCost)}</span>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* CENTER: Sales detail */}
                                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                                      <h4 className="text-xs uppercase tracking-wider text-blue-400 mb-3 font-semibold flex items-center gap-1.5">
                                        <Icon name="storefront" className="w-3.5 h-3.5" />
                                        Đơn bán hàng ({dayDetails.daySales.length})
                                      </h4>
                                      {dayDetails.daySales.length === 0 ? (
                                        <div className="text-center text-slate-500 text-xs py-6">Không có đơn bán hàng</div>
                                      ) : (
                                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                          {dayDetails.daySales.map((sale) => {
                                            const saleCOGS = sale.items.reduce((s, i) => s + (i.costPrice || 0) * i.quantity, 0);
                                            const saleProfit = sale.total - saleCOGS;
                                            return (
                                              <div key={sale.id} className="bg-slate-900/50 rounded-lg p-3 border border-slate-700/30 hover:border-slate-600/50 transition-colors">
                                                <div className="flex justify-between items-start mb-1.5">
                                                  <div className="flex-1 min-w-0">
                                                    <div className="text-sm text-slate-200 font-medium truncate">{sale.customer?.name || "Khách lẻ"}</div>
                                                    <div className="text-[10px] text-slate-500">{sale.code || sale.id.slice(0, 8)} • {sale.paymentMethod === "cash" ? "Tiền mặt" : "CK"}</div>
                                                  </div>
                                                  <div className="text-right ml-3">
                                                    <div className="text-sm font-semibold text-blue-400">{formatCompact(sale.total)}</div>
                                                    <div className={`text-[10px] font-medium ${saleProfit >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                      Lãi: {formatCompact(saleProfit)}
                                                    </div>
                                                  </div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 space-y-0.5">
                                                  {sale.items.map((item, i) => (
                                                    <div key={i} className="flex justify-between">
                                                      <span className="truncate max-w-[55%]">{item.name}</span>
                                                      <span>x{item.quantity} = {formatCompact(item.sellingPrice * item.quantity)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>

                                    {/* RIGHT: Repairs + Transactions */}
                                    <div className="space-y-4">
                                      {/* Repairs */}
                                      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                                        <h4 className="text-xs uppercase tracking-wider text-amber-400 mb-3 font-semibold flex items-center gap-1.5">
                                          <Icon name="gear" className="w-3.5 h-3.5" />
                                          Sửa chữa ({dayDetails.dayRepairs.length})
                                        </h4>
                                        {dayDetails.dayRepairs.length === 0 ? (
                                          <div className="text-center text-slate-500 text-xs py-3">Không có đơn SC</div>
                                        ) : (
                                          <div className="space-y-2 max-h-28 overflow-y-auto pr-1">
                                            {dayDetails.dayRepairs.map((repair) => {
                                              const matCost = (repair.materialsUsed || []).reduce((s, m) => s + m.price * m.quantity, 0);
                                              return (
                                                <div key={repair.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-900/40 rounded-lg text-xs">
                                                  <div>
                                                    <span className="text-slate-300">{repair.customerName}</span>
                                                    <span className="text-slate-500 text-[10px] ml-1">• {repair.deviceName}</span>
                                                  </div>
                                                  <div className="text-right text-[10px]">
                                                    <span className="text-amber-400 font-medium">{formatCompact(repair.total || 0)}</span>
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>

                                      {/* Transactions */}
                                      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50">
                                        <h4 className="text-xs uppercase tracking-wider text-violet-400 mb-3 font-semibold flex items-center gap-1.5">
                                          <Icon name="money" className="w-3.5 h-3.5" />
                                          Giao dịch khác ({dayDetails.dayTransactions.length})
                                        </h4>
                                        {dayDetails.dayTransactions.length === 0 ? (
                                          <div className="text-center text-slate-500 text-xs py-3">Không có GD khác</div>
                                        ) : (
                                          <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                                            {dayDetails.dayTransactions.map((tx) => (
                                              <div key={tx.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-900/40 rounded-lg text-xs">
                                                <span className="text-slate-300 truncate max-w-[60%]">{tx.notes || tx.category || "Giao dịch"}</span>
                                                <span className={`font-medium ${tx.type === "income" ? "text-emerald-400" : "text-red-400"}`}>
                                                  {tx.type === "income" ? "+" : "-"}{formatCompact(tx.amount)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            {sortedDailyData.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-700/50 bg-slate-800/50">
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>Lãi gộp = Doanh thu - Giá vốn hàng bán (COGS) · Lãi ròng = Lãi gộp + Thu khác - Chi khác</span>
                  <span>{daysInRange} ngày</span>
                </div>
              </div>
            )}
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
