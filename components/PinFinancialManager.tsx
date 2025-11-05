/**
 * PIN Corp Financial Management
 * Comprehensive financial tracking for capital, assets, and cash flow
 */

import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import { FinancialAnalyticsService } from "../lib/services/FinancialAnalyticsService";
import { supabase } from "../supabaseClient";
import {
  ArrowTrendingUpIcon as TrendingUp,
  ArrowTrendingDownIcon as TrendingDown,
  BanknotesIcon as DollarSign,
  BuildingLibraryIcon as Building,
  BanknotesIcon as Wallet,
  ExclamationTriangleIcon as AlertTriangle,
  CheckCircleIcon as CheckCircle,
  PlusIcon as Plus,
  EyeIcon as Eye,
  ChartPieIcon as PieChart,
  PencilSquareIcon,
  TrashIcon,
} from "./common/Icons";

const PinFinancialManager: React.FC = () => {
  const {
    fixedAssets,
    setFixedAssets,
    capitalInvestments,
    setCapitalInvestments,
    cashTransactions,
    addCashTransaction,
    currentUser,
    addToast,
    deletePinCapitalInvestment, // Add delete function from context
  } = usePinContext();

  const [activeTab, setActiveTab] = useState<
    "overview" | "assets" | "capital" | "cashflow"
  >(() => {
    // Load saved tab from localStorage
    const saved = localStorage.getItem("pinFinancialActiveTab");
    return (saved as any) || "overview";
  });

  // Save activeTab to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("pinFinancialActiveTab", activeTab);
  }, [activeTab]);
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddCapital, setShowAddCapital] = useState(false);
  // Toggle to view all apps vs PIN-only; default to PIN-only
  const [showAllApps, setShowAllApps] = useState<boolean>(() => {
    const saved = localStorage.getItem("pinFinanceShowAllApps");
    return saved ? saved === "1" : false;
  });
  useEffect(() => {
    localStorage.setItem("pinFinanceShowAllApps", showAllApps ? "1" : "0");
  }, [showAllApps]);
  // Default filter: only show PIN-related cash transactions in this screen
  const pinCashTransactions = useMemo(() => {
    if (showAllApps) return cashTransactions || [];
    const isPinTx = (tx: any) => {
      // Exclude obvious MotoCare work orders
      if (tx.workOrderId && String(tx.workOrderId).startsWith("LTN-SC")) {
        return false;
      }
      const notes: string = tx.notes || "";
      const hasAppTag = /#app:(pin|pincorp)/i.test(notes);
      const isPinSale = tx.saleId && String(tx.saleId).startsWith("LTN-BH");
      return hasAppTag || isPinSale;
    };
    return (cashTransactions || []).filter(isPinTx);
  }, [cashTransactions, showAllApps]);
  const [showCapitalModal, setShowCapitalModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [editingInvestment, setEditingInvestment] = useState<any>(null);
  const [newAsset, setNewAsset] = useState({
    name: "",
    category: "equipment" as const,
    purchasePrice: 0,
    purchaseDate: new Date().toISOString().split("T")[0],
    usefulLife: 5,
    salvageValue: 0,
    depreciationMethod: "straight_line" as const,
    location: "",
    description: "",
  });
  const [newCapital, setNewCapital] = useState({
    type: "equipment" as const,
    amount: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [newTransaction, setNewTransaction] = useState({
    type: "income" as "income" | "expense",
    amount: 0,
    description: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    contactName: "",
  });

  // Capital investments are now loaded by AppContext.fetchData
  // No need for separate useEffect here

  // Calculate current financial position using available data
  const financialSummary = useMemo(() => {
    const currentDate = new Date();

    // Calculate total asset value with depreciation
    const totalAssetValue = fixedAssets.reduce((total, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return total;
      const bookValue = FinancialAnalyticsService.calculateBookValue(
        asset,
        currentDate
      );
      return total + bookValue;
    }, 0);

    // Calculate total capital investments
    const totalCapitalInvested = capitalInvestments.reduce(
      (total, investment) => total + investment.amount,
      0
    );

    // Calculate current month cash flow from transactions
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const monthlyIncome = pinCashTransactions
      .filter((tx) => new Date(tx.date) >= startOfMonth && tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    const monthlyExpenses = Math.abs(
      pinCashTransactions
        .filter((tx) => new Date(tx.date) >= startOfMonth && tx.amount < 0)
        .reduce((sum, tx) => sum + tx.amount, 0)
    );

    const netCashFlow = monthlyIncome - monthlyExpenses;

    // Calculate working capital (simplified)
    const currentCash = pinCashTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    return {
      totalAssetValue,
      totalCapitalInvested,
      currentCash,
      monthlyIncome,
      monthlyExpenses,
      netCashFlow,
      workingCapital: currentCash, // Simplified - would need more data for accurate calculation
      assetDepreciation: fixedAssets.reduce((total, asset) => {
        if (asset.status === "disposed" || asset.status === "sold")
          return total;
        const depreciation = FinancialAnalyticsService.calculateDepreciation(
          asset,
          currentDate
        );
        return total + depreciation;
      }, 0),
    };
  }, [fixedAssets, capitalInvestments, pinCashTransactions]);

  // Asset breakdown by category
  const assetBreakdown = useMemo(() => {
    const breakdown = fixedAssets.reduce((acc, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return acc;

      const bookValue = FinancialAnalyticsService.calculateBookValue(asset);
      if (!acc[asset.category]) acc[asset.category] = 0;
      acc[asset.category] += bookValue;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(breakdown).map(([category, value]) => ({
      category: category.replace("_", " ").toUpperCase(),
      value,
      percentage:
        financialSummary.totalAssetValue > 0
          ? (value / financialSummary.totalAssetValue) * 100
          : 0,
      count: fixedAssets.filter(
        (a) => a.category === category && a.status === "active"
      ).length,
    }));
  }, [fixedAssets, financialSummary.totalAssetValue]);

  // Add/Edit Asset Function
  const handleAddAsset = async () => {
    if (!currentUser || !newAsset.name.trim()) {
      addToast({
        id: Date.now().toString(),
        message: "Vui lòng điền đầy đủ thông tin tài sản",
        type: "error",
      });
      return;
    }

    const isEditing = !!editingAsset;
    const asset = {
      id:
        editingAsset?.id ||
        `asset_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: newAsset.name.trim(),
      category: newAsset.category,
      purchasePrice: newAsset.purchasePrice,
      currentValue: newAsset.purchasePrice,
      purchaseDate: newAsset.purchaseDate,
      usefulLife: newAsset.usefulLife,
      salvageValue: newAsset.salvageValue,
      depreciationMethod: newAsset.depreciationMethod,
      location: newAsset.location,
      description: newAsset.description,
      status: editingAsset?.status || ("active" as const),
      createdBy: editingAsset?.createdBy || currentUser.id,
      createdAt: editingAsset?.createdAt || new Date().toISOString(),
    };

    try {
      // Delegate to FinanceService through PinContext
      await (usePinContext() as any).upsertPinFixedAsset(asset as any);

      addToast({
        id: Date.now().toString(),
        message: `Đã ${isEditing ? "cập nhật" : "thêm"} tài sản "${
          asset.name
        }" thành công`,
        type: "success",
      });

      // Reset form
      setNewAsset({
        name: "",
        category: "equipment",
        purchasePrice: 0,
        purchaseDate: new Date().toISOString().split("T")[0],
        usefulLife: 5,
        salvageValue: 0,
        depreciationMethod: "straight_line",
        location: "",
        description: "",
      });
      setEditingAsset(null);
      setShowAddAsset(false);
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi thêm tài sản",
        type: "error",
      });
    }
  };

  // Add/Edit Capital Investment Function
  const handleAddCapital = async () => {
    if (!currentUser || newCapital.amount <= 0) {
      addToast({
        id: Date.now().toString(),
        message: "Vui lòng nhập số tiền đầu tư hợp lệ",
        type: "error",
      });
      return;
    }

    const isEditing = !!editingInvestment;
    const investment = {
      id:
        editingInvestment?.id ||
        `capital_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: newCapital.type,
      amount: newCapital.amount,
      description: newCapital.description,
      date: newCapital.date,
      notes: newCapital.notes,
      createdBy: (editingInvestment as any)?.createdBy || currentUser.id,
      createdAt:
        (editingInvestment as any)?.createdAt || new Date().toISOString(),
    };

    try {
      // Delegate to FinanceService through PinContext
      await (usePinContext() as any).upsertPinCapitalInvestment(
        investment as any
      );

      addToast({
        id: Date.now().toString(),
        message: `Đã ${
          isEditing ? "cập nhật" : "ghi nhận"
        } đầu tư ${formatCurrency(investment.amount)}`,
        type: "success",
      });

      // Reset form
      setNewCapital({
        type: "equipment",
        amount: 0,
        description: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      setEditingInvestment(null);
      setShowAddCapital(false);
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi ghi nhận đầu tư",
        type: "error",
      });
    }
  };

  const handleAddTransaction = async () => {
    if (!newTransaction.description || !newTransaction.amount) {
      addToast({
        id: Date.now().toString(),
        message: "Vui lòng điền đầy đủ thông tin",
        type: "error",
      });
      return;
    }

    try {
      const appTag = "#app:pincorp";
      const taggedNotes = `${
        newTransaction.notes ? newTransaction.notes + " " : ""
      }${appTag}`;
      const transaction = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        amount:
          newTransaction.type === "expense"
            ? -Math.abs(newTransaction.amount)
            : Math.abs(newTransaction.amount),
        description: newTransaction.description,
        category:
          newTransaction.category ||
          (newTransaction.type === "income" ? "revenue" : "expense"),
        date: newTransaction.date,
        notes: taggedNotes,
        createdBy: currentUser?.id || "",
        createdAt: new Date().toISOString(),
        branchId: "main",
        paymentSourceId: "cash",
        type: newTransaction.type === "income" ? "income" : "expense",
        contact: {
          id: "",
          name: newTransaction.contactName || "",
        },
      };

      // Use context's addCashTransaction function
      await addCashTransaction(transaction as any);

      addToast({
        id: Date.now().toString(),
        message: `Đã ghi nhận ${
          newTransaction.type === "income" ? "thu" : "chi"
        } ${formatCurrency(Math.abs(newTransaction.amount))}`,
        type: "success",
      });

      // Reset form
      setNewTransaction({
        type: "income",
        amount: 0,
        description: "",
        category: "",
        date: new Date().toISOString().split("T")[0],
        notes: "",
        contactName: "",
      });
      setShowAddTransaction(false);
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi ghi nhận giao dịch",
        type: "error",
      });
    }
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa tài sản này?")) {
      return;
    }

    try {
      // Delegate to FinanceService via context
      await (usePinContext() as any).deletePinFixedAsset(assetId);

      addToast({
        id: Date.now().toString(),
        message: "Đã xóa tài sản thành công",
        type: "success",
      });
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi xóa tài sản",
        type: "error",
      });
    }
  };

  // Delete Investment
  const handleDeleteInvestment = async (investmentId: string) => {
    if (!confirm("Bạn có chắc chắn muốn xóa khoản đầu tư này?")) {
      return;
    }

    try {
      // Use centralized delete function from AppContext
      await deletePinCapitalInvestment(investmentId);

      addToast({
        id: Date.now().toString(),
        message: "Đã xóa khoản đầu tư thành công",
        type: "success",
      });
    } catch (error) {
      console.error("Error deleting investment:", error);
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi xóa khoản đầu tư",
        type: "error",
      });
    }
  };

  // Cash flow trends (last 12 months)
  const cashFlowTrends = useMemo(() => {
    const trends = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthStart = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const monthEnd = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        0
      );

      const monthlyIncome = pinCashTransactions
        .filter((tx) => {
          const txDate = new Date(tx.date);
          return txDate >= monthStart && txDate <= monthEnd && tx.amount > 0;
        })
        .reduce((sum, tx) => sum + tx.amount, 0);

      const monthlyExpenses = Math.abs(
        pinCashTransactions
          .filter((tx) => {
            const txDate = new Date(tx.date);
            return txDate >= monthStart && txDate <= monthEnd && tx.amount < 0;
          })
          .reduce((sum, tx) => sum + tx.amount, 0)
      );

      trends.push({
        month: monthStart.toLocaleDateString("vi-VN", {
          month: "short",
          year: "numeric",
        }),
        income: monthlyIncome,
        expenses: monthlyExpenses,
        net: monthlyIncome - monthlyExpenses,
      });
    }

    return trends;
  }, [pinCashTransactions]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">
            Vui lòng đăng nhập để xem quản lý tài chính
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("vi-VN").format(num);
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 dark:bg-slate-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            💰 Quản lý Tài chính PIN Corp
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Theo dõi vốn, tài sản cố định và dòng tiền
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddTransaction(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thu & Chi</span>
          </button>
          <button
            onClick={() => setShowAddCapital(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Đầu tư Vốn</span>
          </button>
          <button
            onClick={() => setShowAddAsset(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Tài sản</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <nav className="flex space-x-8">
            {[
              { key: "overview", label: "Tổng quan", icon: PieChart },
              { key: "assets", label: "Tài sản cố định", icon: Building },
              { key: "capital", label: "Đầu tư vốn", icon: DollarSign },
              { key: "cashflow", label: "Dòng tiền", icon: Wallet },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.key
                      ? "border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                      : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
          {/* App Filter Toggle */}
          <label className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showAllApps}
              onChange={(e) => setShowAllApps(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Hiển thị tất cả giao dịch (mọi app)</span>
          </label>
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Assets */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tổng Giá trị Tài sản
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(financialSummary.totalAssetValue)}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/50 rounded-full">
                  <Building className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Khấu hao tích lũy:
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(financialSummary.assetDepreciation)}
                  </span>
                </div>
              </div>
            </div>

            {/* Capital Invested */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tổng Vốn Đầu tư
                  </p>
                  <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(financialSummary.totalCapitalInvested)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 dark:bg-green-900/50 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Số dự án:
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatNumber(capitalInvestments.length)}
                  </span>
                </div>
              </div>
            </div>

            {/* Current Cash */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Tiền mặt Hiện tại
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      financialSummary.currentCash >= 0
                        ? "text-gray-900 dark:text-white"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(financialSummary.currentCash)}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    financialSummary.currentCash >= 0
                      ? "bg-green-50 dark:bg-green-900/50"
                      : "bg-red-50 dark:bg-red-900/50"
                  }`}
                >
                  <Wallet
                    className={`w-6 h-6 ${
                      financialSummary.currentCash >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center space-x-1">
                  {financialSummary.currentCash >= 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500 dark:text-green-400" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500 dark:text-red-400" />
                  )}
                  <span
                    className={`text-sm ${
                      financialSummary.currentCash >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {financialSummary.currentCash >= 0
                      ? "Thanh khoản tốt"
                      : "Cần bổ sung tiền mặt"}
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly Cash Flow */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Dòng Tiền Tháng
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      financialSummary.netCashFlow >= 0
                        ? "text-gray-900 dark:text-white"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {formatCurrency(financialSummary.netCashFlow)}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    financialSummary.netCashFlow >= 0
                      ? "bg-green-50 dark:bg-green-900/50"
                      : "bg-red-50 dark:bg-red-900/50"
                  }`}
                >
                  {financialSummary.netCashFlow >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600 dark:text-red-400" />
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Thu nhập:
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    {formatCurrency(financialSummary.monthlyIncome)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Chi phí:
                  </span>
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(financialSummary.monthlyExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Breakdown */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Cơ cấu Tài sản theo Loại
            </h3>
            {assetBreakdown.length > 0 ? (
              <div className="space-y-4">
                {assetBreakdown.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-4 h-4 rounded-full`}
                        style={{
                          backgroundColor: `hsl(${index * 60}, 70%, 50%)`,
                        }}
                      />
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.category}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        ({item.count} tài sản)
                      </span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="w-32 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${Math.min(item.percentage, 100)}%`,
                            backgroundColor: `hsl(${index * 60}, 70%, 50%)`,
                          }}
                        />
                      </div>
                      <span className="text-sm text-gray-600 dark:text-gray-400 w-16 text-right">
                        {item.percentage.toFixed(1)}%
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-white w-32 text-right">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Building className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>Chưa có tài sản cố định nào</p>
              </div>
            )}
          </div>

          {/* Cash Flow Trends */}
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Xu hướng Dòng tiền 12 tháng
            </h3>
            <div className="space-y-3">
              {cashFlowTrends.map((trend, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between py-2"
                >
                  <div className="w-20 text-sm text-gray-600 dark:text-gray-400">
                    {trend.month}
                  </div>
                  <div className="flex-1 flex items-center space-x-4 px-4">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-16">
                        Thu nhập
                      </span>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400 w-24 text-right">
                        {formatCurrency(trend.income)}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full" />
                      <span className="text-xs text-gray-600 dark:text-gray-400 w-16">
                        Chi phí
                      </span>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400 w-24 text-right">
                        {formatCurrency(trend.expenses)}
                      </span>
                    </div>
                  </div>
                  <div className="w-32 text-right">
                    <span
                      className={`text-sm font-medium ${
                        trend.net >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCurrency(trend.net)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assets Tab */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Danh sách Tài sản Cố định
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Tổng cộng: {formatNumber(fixedAssets.length)} tài sản
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Tài sản
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Ngày mua
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Giá gốc
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Giá trị hiện tại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Khấu hao (%)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Trạng thái
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {fixedAssets.map((asset) => {
                    const currentDate = new Date();
                    const bookValue =
                      FinancialAnalyticsService.calculateBookValue(
                        asset,
                        currentDate
                      );
                    const depreciation = asset.purchasePrice - bookValue;
                    const depreciationRate = (
                      (depreciation / asset.purchasePrice) *
                      100
                    ).toFixed(1);
                    const ageInYears =
                      (currentDate.getTime() -
                        new Date(asset.purchaseDate).getTime()) /
                      (365.25 * 24 * 60 * 60 * 1000);

                    return (
                      <tr
                        key={asset.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {asset.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {asset.description}
                            </div>
                            {asset.serialNumber && (
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                SN: {asset.serialNumber}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">
                          {asset.category.replace("_", " ")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <div>
                            {new Date(asset.purchaseDate).toLocaleDateString(
                              "vi-VN"
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {ageInYears.toFixed(1)} năm tuổi
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {formatCurrency(asset.purchasePrice)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                          {formatCurrency(bookValue)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center space-x-2">
                            <span>{depreciationRate}%</span>
                            <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                              <div
                                className="bg-red-500 dark:bg-red-400 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(
                                    parseFloat(depreciationRate),
                                    100
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              asset.status === "active"
                                ? "bg-green-100 text-green-800"
                                : asset.status === "under_maintenance"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {asset.status === "active"
                              ? "Hoạt động"
                              : asset.status === "under_maintenance"
                              ? "Bảo trì"
                              : asset.status === "disposed"
                              ? "Thanh lý"
                              : "Đã bán"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                // Set form data with asset values
                                setNewAsset({
                                  name: asset.name,
                                  category: asset.category as any,
                                  purchasePrice: asset.purchasePrice,
                                  purchaseDate: asset.purchaseDate,
                                  usefulLife: asset.usefulLife || 5,
                                  salvageValue: asset.salvageValue || 0,
                                  depreciationMethod:
                                    (asset.depreciationMethod ||
                                      "straight_line") as any,
                                  location: asset.location || "",
                                  description: asset.description || "",
                                });
                                setEditingAsset(asset);
                                setShowAddAsset(true);
                              }}
                              className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {fixedAssets.length === 0 && (
              <div className="text-center py-12">
                <Building className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Chưa có tài sản cố định
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Bắt đầu bằng cách thêm tài sản đầu tiên
                </p>
                <button
                  onClick={() => setShowAddAsset(true)}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Thêm Tài sản</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Capital Investments Tab */}
      {activeTab === "capital" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Danh sách Đầu tư Vốn
                </h3>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Tổng đầu tư:{" "}
                  {formatCurrency(financialSummary.totalCapitalInvested)}
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Ngày
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Mô tả
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Số tiền
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {capitalInvestments.map((investment) => (
                    <tr
                      key={investment.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(investment.date).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                          {(investment as any).type?.replace("_", " ") || "N/A"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                        {(investment as any).description ||
                          (investment as any).notes ||
                          "-"}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-right text-green-600 dark:text-green-400">
                        {formatCurrency(investment.amount)}
                      </td>
                      <td className="px-6 py-4 text-sm text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              // Set form data with investment values
                              setNewCapital({
                                type: (investment as any).type || "equipment",
                                amount: investment.amount,
                                description:
                                  (investment as any).description ||
                                  (investment as any).notes ||
                                  "",
                                date: investment.date,
                                notes: (investment as any).notes || "",
                              });
                              setEditingInvestment(investment);
                              setShowAddCapital(true);
                            }}
                            className="p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteInvestment(investment.id)
                            }
                            className="p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {capitalInvestments.length === 0 && (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Chưa có đầu tư vốn
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Chưa có khoản đầu tư vốn nào được ghi nhận
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cash Flow Tab */}
      {activeTab === "cashflow" && (
        <div className="space-y-6">
          {/* Cash Flow Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Thu nhập Tháng này
              </h4>
              <p className="text-2xl font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(financialSummary.monthlyIncome)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Chi phí Tháng này
              </h4>
              <p className="text-2xl font-semibold text-red-600 dark:text-red-400">
                {formatCurrency(financialSummary.monthlyExpenses)}
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow border border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Dòng tiền Ròng
              </h4>
              <p
                className={`text-2xl font-semibold ${
                  financialSummary.netCashFlow >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(financialSummary.netCashFlow)}
              </p>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Giao dịch Tiền mặt Gần đây
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Ngày
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Mô tả
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Khách hàng/Người nhận
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Danh mục
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                      Số tiền
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {pinCashTransactions
                    .slice(-10)
                    .reverse()
                    .map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700"
                      >
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {new Date(transaction.date).toLocaleDateString(
                            "vi-VN"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {transaction.notes || "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {typeof transaction.contact === "object" &&
                          transaction.contact?.name
                            ? transaction.contact.name
                            : "-"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white capitalize">
                          {transaction.category?.replace("_", " ") || "Khác"}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          <span
                            className={
                              transaction.amount >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatCurrency(transaction.amount)}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {pinCashTransactions.length === 0 && (
              <div className="text-center py-12">
                <Wallet className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Chưa có giao dịch
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Chưa có giao dịch tiền mặt nào được ghi nhận
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Asset Modal */}
      {showAddAsset && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingAsset
                  ? "✏️ Sửa Tài sản Cố định"
                  : "➕ Thêm Tài sản Cố định"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tên tài sản *
                  </label>
                  <input
                    type="text"
                    value={newAsset.name}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nhập tên tài sản"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Danh mục
                  </label>
                  <select
                    value={newAsset.category}
                    onChange={(e) =>
                      setNewAsset({
                        ...newAsset,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="equipment">Thiết bị</option>
                    <option value="vehicle">Phương tiện</option>
                    <option value="furniture">Nội thất</option>
                    <option value="building">Công trình</option>
                    <option value="technology">Công nghệ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Giá mua (VND) *
                  </label>
                  <input
                    type="number"
                    value={newAsset.purchasePrice}
                    onChange={(e) =>
                      setNewAsset({
                        ...newAsset,
                        purchasePrice: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ngày mua
                  </label>
                  <input
                    type="date"
                    value={newAsset.purchaseDate}
                    onChange={(e) =>
                      setNewAsset({ ...newAsset, purchaseDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tuổi thọ (năm)
                  </label>
                  <input
                    type="number"
                    value={newAsset.usefulLife}
                    onChange={(e) =>
                      setNewAsset({
                        ...newAsset,
                        usefulLife: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Phương pháp khấu hao
                  </label>
                  <select
                    value={newAsset.depreciationMethod}
                    onChange={(e) =>
                      setNewAsset({
                        ...newAsset,
                        depreciationMethod: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="straight_line">Đường thẳng</option>
                    <option value="declining_balance">Số dư giảm dần</option>
                    <option value="sum_of_years">Tổng số năm</option>
                    <option value="units_of_production">Đơn vị sản xuất</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vị trí
                </label>
                <input
                  type="text"
                  value={newAsset.location}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, location: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập vị trí tài sản"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mô tả
                </label>
                <textarea
                  value={newAsset.description}
                  onChange={(e) =>
                    setNewAsset({ ...newAsset, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Mô tả chi tiết tài sản"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddAsset(false);
                  setEditingAsset(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddAsset}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                Thêm Tài sản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Capital Modal */}
      {showAddCapital && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingInvestment
                  ? "✏️ Sửa Đầu tư Vốn"
                  : "💰 Ghi nhận Đầu tư Vốn"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loại đầu tư
                </label>
                <select
                  value={newCapital.type}
                  onChange={(e) =>
                    setNewCapital({
                      ...newCapital,
                      type: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="equipment">Thiết bị</option>
                  <option value="expansion">Mở rộng</option>
                  <option value="technology">Công nghệ</option>
                  <option value="working_capital">Vốn lưu động</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Số tiền (VND) *
                </label>
                <input
                  type="number"
                  value={newCapital.amount}
                  onChange={(e) =>
                    setNewCapital({
                      ...newCapital,
                      amount: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ngày đầu tư
                </label>
                <input
                  type="date"
                  value={newCapital.date}
                  onChange={(e) =>
                    setNewCapital({ ...newCapital, date: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mô tả
                </label>
                <input
                  type="text"
                  value={newCapital.description}
                  onChange={(e) =>
                    setNewCapital({
                      ...newCapital,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Mô tả đầu tư"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ghi chú
                </label>
                <textarea
                  value={newCapital.notes}
                  onChange={(e) =>
                    setNewCapital({ ...newCapital, notes: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ghi chú thêm"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowAddCapital(false);
                  setEditingInvestment(null);
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddCapital}
                className="px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-colors"
              >
                Ghi nhận Đầu tư
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Thêm Giao dịch Thu Chi
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loại giao dịch
                </label>
                <select
                  value={newTransaction.type}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      type: e.target.value as "income" | "expense",
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="income">Thu nhập</option>
                  <option value="expense">Chi phí</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Số tiền *
                </label>
                <input
                  type="number"
                  value={newTransaction.amount}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập số tiền..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mô tả *
                </label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      description: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Mô tả giao dịch..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Danh mục
                </label>
                <select
                  value={newTransaction.category}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      category: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Chọn danh mục</option>
                  {newTransaction.type === "income" ? (
                    <>
                      <option value="sales">Bán hàng</option>
                      <option value="services">Dịch vụ</option>
                      <option value="other_income">Thu nhập khác</option>
                    </>
                  ) : (
                    <>
                      <option value="materials">Nguyên vật liệu</option>
                      <option value="equipment">Thiết bị</option>
                      <option value="utilities">Tiện ích</option>
                      <option value="salaries">Lương nhân viên</option>
                      <option value="other_expense">Chi phí khác</option>
                    </>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ngày giao dịch
                </label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      date: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ghi chú
                </label>
                <textarea
                  value={newTransaction.notes}
                  onChange={(e) =>
                    setNewTransaction({
                      ...newTransaction,
                      notes: e.target.value,
                    })
                  }
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Ghi chú thêm..."
                  rows={3}
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex space-x-3">
              <button
                onClick={() => setShowAddTransaction(false)}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTransaction}
                className="flex-1 px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors"
              >
                Thêm giao dịch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Transaction Modal */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                Thêm giao dịch mới
              </h3>
            </div>
            <div className="p-6 space-y-4">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loại giao dịch <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() =>
                      setNewTransaction((prev) => ({ ...prev, type: "income" }))
                    }
                    className={`p-3 rounded-lg border text-center font-medium transition-colors ${
                      newTransaction.type === "income"
                        ? "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    💰 Thu nhập
                  </button>
                  <button
                    onClick={() =>
                      setNewTransaction((prev) => ({
                        ...prev,
                        type: "expense",
                      }))
                    }
                    className={`p-3 rounded-lg border text-center font-medium transition-colors ${
                      newTransaction.type === "expense"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400"
                        : "border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    💸 Chi phí
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Số tiền <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={newTransaction.amount || ""}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="0"
                  min="0"
                  step="1000"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mô tả <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newTransaction.description}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập mô tả giao dịch"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Khách hàng / Người nhận
                </label>
                <input
                  type="text"
                  value={newTransaction.contactName}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      contactName: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Tên khách hàng hoặc người nhận"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Danh mục
                </label>
                <select
                  value={newTransaction.category}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Chọn danh mục</option>
                  {newTransaction.type === "income" ? (
                    <>
                      <option value="sales">Bán hàng</option>
                      <option value="service">Dịch vụ</option>
                      <option value="other_income">Thu khác</option>
                    </>
                  ) : (
                    <>
                      <option value="materials">Nguyên liệu</option>
                      <option value="equipment">Thiết bị</option>
                      <option value="utilities">Tiện ích</option>
                      <option value="salary">Lương</option>
                      <option value="other_expense">Chi khác</option>
                    </>
                  )}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ngày giao dịch
                </label>
                <input
                  type="date"
                  value={newTransaction.date}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      date: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú
                </label>
                <textarea
                  value={newTransaction.notes}
                  onChange={(e) =>
                    setNewTransaction((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Ghi chú bổ sung (không bắt buộc)"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowAddTransaction(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={!newTransaction.description || !newTransaction.amount}
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
              >
                Thêm giao dịch
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinFinancialManager;
