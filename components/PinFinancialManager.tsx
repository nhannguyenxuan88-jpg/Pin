/**
 * PIN Corp Financial Management
 * Quản lý sổ quỹ, khoản vay và các giao dịch tài chính
 */

import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import { FinancialAnalyticsService } from "../lib/services/FinancialAnalyticsService";
import { supabase } from "../supabaseClient";
import type { FixedAsset, CapitalInvestment, CashTransaction } from "../types";
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
  CreditCardIcon,
  CurrencyDollarIcon,
  BookOpenIcon,
  BriefcaseIcon,
} from "./common/Icons";

// Type definitions
type TabKey = "cashbook" | "loans" | "assets" | "capital";
type TransactionFilterType = "all" | "income" | "expense";
type PaymentSource = "all" | "cash" | "bank";
type TimeFilter = "today" | "7days" | "30days" | "all";

const PinFinancialManager: React.FC = () => {
  const pinContext = usePinContext();
  const {
    fixedAssets = [] as FixedAsset[],
    setFixedAssets,
    capitalInvestments = [] as CapitalInvestment[],
    setCapitalInvestments,
    cashTransactions = [] as CashTransaction[],
    addCashTransaction,
    currentUser,
    addToast,
    deletePinCapitalInvestment,
    deleteCashTransactions,
    upsertPinFixedAsset,
    deletePinFixedAsset,
    upsertPinCapitalInvestment,
  } = pinContext;

  // Main tab state
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    const saved = localStorage.getItem("pinFinancialActiveTab");
    return (saved as TabKey) || "cashbook";
  });

  // Save activeTab to localStorage
  useEffect(() => {
    localStorage.setItem("pinFinancialActiveTab", activeTab);
  }, [activeTab]);

  // Filter states for Cashbook
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilterType>("all");
  const [paymentSourceFilter, setPaymentSourceFilter] = useState<PaymentSource>("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("30days");

  // Modal states
  const [showAddAsset, setShowAddAsset] = useState(false);
  const [showAddCapital, setShowAddCapital] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(false);
  const [showAddLoan, setShowAddLoan] = useState(false);

  // Edit states
  const [editingAsset, setEditingAsset] = useState<FixedAsset | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<CapitalInvestment | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm dialog state (replaces browser confirm())
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} });

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ isOpen: false, title: "", message: "", onConfirm: () => {} });
  };

  // Show all apps toggle
  const [showAllApps, setShowAllApps] = useState<boolean>(() => {
    const saved = localStorage.getItem("pinFinanceShowAllApps");
    return saved ? saved === "1" : true;
  });

  useEffect(() => {
    localStorage.setItem("pinFinanceShowAllApps", showAllApps ? "1" : "0");
  }, [showAllApps]);

  // Filter cash transactions
  const filteredCashTransactions = useMemo((): CashTransaction[] => {
    let transactions = cashTransactions || [];

    // Filter by app if not showing all
    if (!showAllApps) {
      transactions = transactions.filter((tx) => {
        if (tx.workOrderId && String(tx.workOrderId).startsWith("LTN-SC")) {
          return false;
        }
        const notes: string = tx.notes || "";
        const hasAppTag = /#app:(pin|pincorp)/i.test(notes);
        const isPinSale = tx.saleId && String(tx.saleId).startsWith("LTN-BH");
        return hasAppTag || isPinSale;
      });
    }

    // Filter by transaction type
    if (transactionFilter === "income") {
      transactions = transactions.filter((tx) => tx.amount > 0);
    } else if (transactionFilter === "expense") {
      transactions = transactions.filter((tx) => tx.amount < 0);
    }

    // Filter by payment source
    if (paymentSourceFilter !== "all") {
      transactions = transactions.filter((tx) => {
        const source = tx.paymentSourceId?.toLowerCase() || "cash";
        if (paymentSourceFilter === "cash") {
          return source === "cash" || source === "tien_mat" || source === "tiền mặt";
        } else {
          return source === "bank" || source === "ngan_hang" || source === "ngân hàng";
        }
      });
    }

    // Filter by time
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (timeFilter === "today") {
      transactions = transactions.filter((tx) => new Date(tx.date) >= startOfToday);
    } else if (timeFilter === "7days") {
      const sevenDaysAgo = new Date(startOfToday);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      transactions = transactions.filter((tx) => new Date(tx.date) >= sevenDaysAgo);
    } else if (timeFilter === "30days") {
      const thirtyDaysAgo = new Date(startOfToday);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      transactions = transactions.filter((tx) => new Date(tx.date) >= thirtyDaysAgo);
    }

    // Sort by date descending
    return [...transactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [cashTransactions, showAllApps, transactionFilter, paymentSourceFilter, timeFilter]);
  // Helper: Kiểm tra giao dịch có phải là Chi không (dựa trên category)
  const expenseCategories = [
    "inventory_purchase",
    "purchase",
    "materials",
    "equipment",
    "utilities",
    "salary",
    "salaries",
    "expense",
    "other_expense",
    "rent",
    "marketing",
    "transport",
  ];

  const checkIsExpense = (tx: CashTransaction) => {
    if (expenseCategories.includes(tx.category || "")) return true;
    if (tx.type === "expense") return true;
    if (tx.amount < 0) return true;
    return false;
  };

  // Calculate cashbook summary
  const cashbookSummary = useMemo(() => {
    // Lọc giao dịch cho hiển thị (có áp dụng bộ lọc thời gian)
    const displayTransactions = filteredCashTransactions;

    // Lọc giao dịch cho tính số dư (KHÔNG áp dụng bộ lọc thời gian - tính toàn bộ)
    let allTransactions = cashTransactions || [];

    // Chỉ lọc theo app nếu cần
    if (!showAllApps) {
      allTransactions = allTransactions.filter((tx) => {
        if (tx.workOrderId && String(tx.workOrderId).startsWith("LTN-SC")) {
          return false;
        }
        const notes: string = tx.notes || "";
        const hasAppTag = /#app:(pin|pincorp)/i.test(notes);
        const isPinSale = tx.saleId && String(tx.saleId).startsWith("LTN-BH");
        return hasAppTag || isPinSale;
      });
    }

    // Tính thu/chi từ giao dịch hiển thị (có bộ lọc thời gian)
    const totalIncome = displayTransactions
      .filter((tx) => !checkIsExpense(tx))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const totalExpense = displayTransactions
      .filter((tx) => checkIsExpense(tx))
      .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

    const difference = totalIncome - totalExpense;

    // Tính số dư thực tế từ TOÀN BỘ giao dịch (không phụ thuộc bộ lọc thời gian)
    const cashBalance = allTransactions
      .filter((tx) => {
        const source = tx.paymentSourceId?.toLowerCase() || "cash";
        return source === "cash" || source === "tien_mat" || source === "tiền mặt";
      })
      .reduce((sum, tx) => {
        const isExpense = checkIsExpense(tx);
        return sum + (isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount));
      }, 0);

    const bankBalance = allTransactions
      .filter((tx) => {
        const source = tx.paymentSourceId?.toLowerCase() || "";
        return source === "bank" || source === "ngan_hang" || source === "ngân hàng";
      })
      .reduce((sum, tx) => {
        const isExpense = checkIsExpense(tx);
        return sum + (isExpense ? -Math.abs(tx.amount) : Math.abs(tx.amount));
      }, 0);

    return {
      totalIncome,
      totalExpense,
      difference,
      cashBalance,
      bankBalance,
    };
  }, [filteredCashTransactions, cashTransactions, showAllApps]);

  // Form states for adding transactions
  const [newTransaction, setNewTransaction] = useState({
    type: "income" as "income" | "expense",
    amount: 0,
    description: "",
    category: "",
    date: new Date().toISOString().split("T")[0],
    notes: "",
    contactName: "",
    paymentSource: "cash" as "cash" | "bank",
  });

  // Form states for adding assets
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

  // Form states for adding capital
  const [newCapital, setNewCapital] = useState({
    source: "Vốn chủ sở hữu" as "Vốn chủ sở hữu" | "Vay ngân hàng",
    amount: 0,
    description: "",
    date: new Date().toISOString().split("T")[0],
    interestRate: undefined as number | undefined,
  });

  // Calculate financial summary for assets and capital
  const financialSummary = useMemo(() => {
    const currentDate = new Date();

    // Calculate total asset value with depreciation
    const totalAssetValue = fixedAssets.reduce((total, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return total;
      const bookValue = FinancialAnalyticsService.calculateBookValue(asset, currentDate);
      return total + bookValue;
    }, 0);

    // Calculate total capital investments
    const totalCapitalInvested = capitalInvestments.reduce(
      (total, investment) => total + investment.amount,
      0
    );

    // Calculate asset depreciation
    const assetDepreciation = fixedAssets.reduce((total, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return total;
      const depreciation = FinancialAnalyticsService.calculateDepreciation(asset, currentDate);
      return total + depreciation;
    }, 0);

    return {
      totalAssetValue,
      totalCapitalInvested,
      assetDepreciation,
      assetCount: fixedAssets.filter((a) => a.status === "active").length,
    };
  }, [fixedAssets, capitalInvestments]);

  // Handler: Add/Edit Transaction
  const handleAddTransaction = async () => {
    if (isSubmitting) return;

    if (!newTransaction.description || !newTransaction.amount) {
      addToast({
        id: Date.now().toString(),
        message: "Vui lòng điền đầy đủ thông tin",
        type: "error",
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const appTag = "#app:pincorp";
      const taggedNotes = `${newTransaction.notes ? newTransaction.notes + " " : ""}${appTag}`;
      const transaction = {
        id:
          editingTransaction?.id ||
          `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        amount:
          newTransaction.type === "expense"
            ? -Math.abs(newTransaction.amount)
            : Math.abs(newTransaction.amount),
        description: newTransaction.description,
        category:
          newTransaction.category || (newTransaction.type === "income" ? "revenue" : "expense"),
        date: newTransaction.date,
        notes: taggedNotes,
        createdBy: currentUser?.id || "",
        created_at: editingTransaction?.created_at || new Date().toISOString(),
        branchId: "main",
        paymentSourceId: newTransaction.paymentSource === "bank" ? "bank" : "cash",
        type: newTransaction.type === "income" ? "income" : "expense",
        contact: {
          id: "",
          name: newTransaction.contactName || "",
        },
      };

      await addCashTransaction(transaction as any);

      addToast({
        id: Date.now().toString(),
        message: `Đã ${editingTransaction ? "cập nhật" : "ghi nhận"} ${newTransaction.type === "income" ? "thu" : "chi"
          } ${formatCurrency(Math.abs(newTransaction.amount))}`,
        type: "success",
      });

      resetTransactionForm();
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi ghi nhận giao dịch",
        type: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handler: Delete Transaction
  const handleDeleteTransaction = async (transactionId: string) => {
    showConfirmDialog(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa giao dịch này?",
      async () => {
        closeConfirmDialog();
        try {
          if (deleteCashTransactions) {
            await deleteCashTransactions({ id: transactionId });
          } else {
            const { error } = await supabase.from("cashtransactions").delete().eq("id", transactionId);
            if (error) throw error;
          }

          addToast({
            id: Date.now().toString(),
            message: "Đã xóa giao dịch thành công",
            type: "success",
          });
        } catch (error) {
          addToast({
            id: Date.now().toString(),
            message: "Lỗi khi xóa giao dịch",
            type: "error",
          });
        }
      }
    );
  };

  // Reset transaction form
  const resetTransactionForm = () => {
    setNewTransaction({
      type: "income",
      amount: 0,
      description: "",
      category: "",
      date: new Date().toISOString().split("T")[0],
      notes: "",
      contactName: "",
      paymentSource: "cash",
    });
    setEditingTransaction(null);
    setShowAddTransaction(false);
  };

  // Handler: Add/Edit Asset
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
      id: editingAsset?.id || crypto.randomUUID(),
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
      if (upsertPinFixedAsset) {
        await upsertPinFixedAsset(asset as any);
      } else {
        const { error } = await supabase.from("pin_fixed_assets").upsert(asset);
        if (error) throw error;
        setFixedAssets((prev: any[]) => {
          const idx = prev.findIndex((a: any) => a.id === asset.id);
          if (idx >= 0) return prev.map((a: any) => (a.id === asset.id ? asset : a));
          return [asset, ...prev];
        });
      }

      addToast({
        id: Date.now().toString(),
        message: `Đã ${isEditing ? "cập nhật" : "thêm"} tài sản "${asset.name}" thành công`,
        type: "success",
      });

      resetAssetForm();
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi thêm tài sản",
        type: "error",
      });
    }
  };

  // Handler: Delete Asset
  const handleDeleteAsset = async (assetId: string) => {
    showConfirmDialog(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa tài sản này?",
      async () => {
        closeConfirmDialog();
        try {
          if (deletePinFixedAsset) {
            await deletePinFixedAsset(assetId);
          } else {
            const { error } = await supabase.from("pin_fixed_assets").delete().eq("id", assetId);
            if (error) throw error;
            setFixedAssets((prev: any[]) => prev.filter((a: any) => a.id !== assetId));
          }

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
      }
    );
  };

  // Reset asset form
  const resetAssetForm = () => {
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
  };

  // Handler: Add/Edit Capital Investment
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
      id: editingInvestment?.id || crypto.randomUUID(),
      source: newCapital.source,
      amount: newCapital.amount,
      description: newCapital.description,
      date: newCapital.date,
      interestRate: newCapital.interestRate,
      branchId: "main",
      createdBy: (editingInvestment as any)?.createdBy || currentUser.id,
      createdAt: (editingInvestment as any)?.createdAt || new Date().toISOString(),
    };

    try {
      if (upsertPinCapitalInvestment) {
        await upsertPinCapitalInvestment(investment as any);
      } else {
        const { error } = await supabase.from("pin_capital_investments").upsert(investment);
        if (error) throw error;
        setCapitalInvestments((prev: any[]) => {
          const idx = prev.findIndex((i: any) => i.id === investment.id);
          if (idx >= 0) return prev.map((i: any) => (i.id === investment.id ? investment : i));
          return [investment, ...prev];
        });
      }

      addToast({
        id: Date.now().toString(),
        message: `Đã ${isEditing ? "cập nhật" : "ghi nhận"} đầu tư ${formatCurrency(investment.amount)}`,
        type: "success",
      });

      resetCapitalForm();
    } catch (error) {
      addToast({
        id: Date.now().toString(),
        message: "Lỗi khi ghi nhận đầu tư",
        type: "error",
      });
    }
  };

  // Handler: Delete Investment
  const handleDeleteInvestment = async (investmentId: string) => {
    showConfirmDialog(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa khoản đầu tư này?",
      async () => {
        closeConfirmDialog();
        try {
          await deletePinCapitalInvestment(investmentId);

          addToast({
            id: Date.now().toString(),
            message: "Đã xóa khoản đầu tư thành công",
            type: "success",
          });
        } catch (error) {
          addToast({
            id: Date.now().toString(),
            message: "Lỗi khi xóa khoản đầu tư",
            type: "error",
          });
        }
      }
    );
  };

  // Reset capital form
  const resetCapitalForm = () => {
    setNewCapital({
      source: "Vốn chủ sở hữu",
      amount: 0,
      description: "",
      date: new Date().toISOString().split("T")[0],
      interestRate: undefined,
    });
    setEditingInvestment(null);
    setShowAddCapital(false);
  };

  // Format helpers
  const formatCurrency = (amount: number) => {
    return (
      new Intl.NumberFormat("vi-VN", {
        style: "decimal",
        maximumFractionDigits: 0,
      }).format(amount) + " đ"
    );
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("vi-VN").format(num);
  };

  // Get category label in Vietnamese
  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      // Thu nhập
      sale_income: "💰 Thu bán hàng",
      sales: "💰 Bán hàng",
      service: "🔧 Dịch vụ sửa chữa",
      services: "🔧 Dịch vụ",
      service_income: "🔧 Thu sửa chữa",
      revenue: "📈 Doanh thu",
      income: "💵 Thu nhập",
      other_income: "💵 Thu khác",
      deposit: "💳 Tiền đặt cọc",
      refund_received: "↩️ Hoàn tiền nhận",
      debt_collection: "📥 Thu nợ",

      // Chi phí
      inventory_purchase: "📦 Nhập kho/vật tư",
      purchase: "🛒 Mua hàng",
      materials: "🧱 Nguyên vật liệu",
      equipment: "🖥️ Thiết bị",
      utilities: "💡 Tiện ích (điện, nước)",
      salary: "👤 Lương nhân viên",
      salaries: "👥 Lương nhân viên",
      expense: "💸 Chi phí",
      other_expense: "💸 Chi khác",
      rent: "🏠 Thuê mặt bằng",
      marketing: "📣 Marketing/Quảng cáo",
      transport: "🚚 Vận chuyển",
      supplier_payment: "🏭 Thanh toán NCC",
      repair_cost: "🔩 Chi phí sửa chữa",
      refund: "↩️ Hoàn tiền khách",

      // Khác
      "": "Khác",
    };
    return labels[category] || category || "Khác";
  };

  // Get transaction source description (nguồn giao dịch)
  const getTransactionSource = (tx: CashTransaction): string => {
    // Check for repair order
    if (tx.workOrderId) {
      if (String(tx.workOrderId).startsWith("SC-")) {
        return "Phiếu sửa chữa";
      }
      if (String(tx.workOrderId).startsWith("LTN-SC")) {
        return "Đơn sửa chữa LTN";
      }
    }

    // Check for sale
    if (tx.saleId) {
      if (String(tx.saleId).startsWith("LTN-BH")) {
        return "Đơn bán hàng";
      }
      return "Bán hàng";
    }

    // Check for supplier payment
    if (tx.category === "supplier_payment" || tx.category === "inventory_purchase") {
      return "Nhập kho/NCC";
    }

    // Check for debt collection
    if (tx.category === "debt_collection") {
      return "Thu nợ";
    }

    // Check notes for source hint
    const notes = tx.notes?.toLowerCase() || "";
    if (notes.includes("sửa chữa") || notes.includes("repair")) return "Sửa chữa";
    if (notes.includes("bán hàng") || notes.includes("sale")) return "Bán hàng";
    if (notes.includes("nhập kho") || notes.includes("import")) return "Nhập kho";
    if (notes.includes("đặt cọc") || notes.includes("deposit")) return "Đặt cọc";
    if (notes.includes("thanh toán ncc") || notes.includes("supplier")) return "Thanh toán NCC";

    return "Thủ công";
  };

  // Kiểm tra giao dịch có phải là Chi không
  const isExpenseTransaction = (tx: CashTransaction) => {
    // Các category luôn là Chi
    const expenseCategories = [
      "inventory_purchase",
      "purchase",
      "materials",
      "equipment",
      "utilities",
      "salary",
      "salaries",
      "expense",
      "other_expense",
      "rent",
      "marketing",
      "transport",
    ];
    if (expenseCategories.includes(tx.category || "")) return true;
    // Dựa vào type
    if (tx.type === "expense") return true;
    // Dựa vào amount
    if (tx.amount < 0) return true;
    return false;
  };

  // Get payment source label
  const getPaymentSourceLabel = (source: string) => {
    const s = source?.toLowerCase() || "cash";
    if (s === "bank" || s === "ngan_hang" || s === "ngân hàng") return "Ngân hàng";
    return "Tiền mặt";
  };

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">Vui lòng đăng nhập để xem quản lý tài chính</p>
        </div>
      </div>
    );
  }

  // Tab config
  const tabs = [
    { key: "cashbook" as TabKey, label: "Sổ quỹ", icon: BookOpenIcon },
    { key: "loans" as TabKey, label: "Khoản vay", icon: CreditCardIcon },
    { key: "assets" as TabKey, label: "TSCĐ", icon: Building },
    { key: "capital" as TabKey, label: "Vốn", icon: CurrencyDollarIcon },
  ];

  return (
    <div className="p-2 md:p-4 space-y-3 bg-slate-900 min-h-screen pb-20 md:pb-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span className="text-lg">💰</span> Quản lý Tài chính
          </h1>
          <p className="text-gray-400 text-xs">
            Quản lý sổ quỹ, khoản vay và các giao dịch tài chính
          </p>
        </div>

        {/* Tab Navigation as Pills - Scrollable on mobile */}
        <div className="flex items-center gap-1 bg-slate-800/50 rounded-full p-1 overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${activeTab === tab.key
                ? "bg-blue-600 text-white shadow-lg"
                : "text-gray-400 hover:text-white hover:bg-slate-700/50"
                }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${activeTab === tab.key ? "bg-green-400" : "bg-gray-500"
                  }`}
              />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ====== CASHBOOK TAB ====== */}
      {activeTab === "cashbook" && (
        <div className="space-y-3">
          {/* Section Title */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-white">Sổ quỹ</h2>
              <p className="text-gray-400 text-xs">Theo dõi thu chi tiền mặt và chuyển khoản</p>
            </div>
            <button
              onClick={() => setShowAddTransaction(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium text-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Thêm giao dịch</span>
            </button>
          </div>

          {/* Summary Cards - Compact, 2 cols on mobile, 5 on desktop */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-1.5 md:gap-2">
            {/* Thu (Income) */}
            <div className="bg-gradient-to-br from-teal-600/20 to-teal-700/10 border border-teal-500/30 rounded-lg p-2">
              <div className="flex items-center gap-1 text-teal-400 text-[10px] md:text-xs mb-0.5">
                <TrendingUp className="w-3 h-3" />
                Thu
              </div>
              <p className="text-xs md:text-sm font-bold text-teal-400 truncate">
                {formatCurrency(cashbookSummary.totalIncome)}
              </p>
            </div>

            {/* Chi (Expense) */}
            <div className="bg-gradient-to-br from-red-600/20 to-red-700/10 border border-red-500/30 rounded-lg p-2">
              <div className="flex items-center gap-1 text-red-400 text-[10px] md:text-xs mb-0.5">
                <TrendingDown className="w-3 h-3" />
                Chi
              </div>
              <p className="text-xs md:text-sm font-bold text-red-400 truncate">
                -{formatCurrency(cashbookSummary.totalExpense)}
              </p>
            </div>

            {/* Chênh lệch (Difference) */}
            <div className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/30 rounded-lg p-2">
              <div className="flex items-center gap-1 text-purple-400 text-[10px] md:text-xs mb-0.5">
                <DollarSign className="w-3 h-3" />
                Chênh lệch
              </div>
              <p
                className={`text-xs md:text-sm font-bold truncate ${cashbookSummary.difference >= 0 ? "text-purple-400" : "text-red-400"}`}
              >
                {formatCurrency(cashbookSummary.difference)}
              </p>
            </div>

            {/* Tiền mặt (Cash) */}
            <div className="bg-gradient-to-br from-yellow-600/20 to-yellow-700/10 border border-yellow-500/30 rounded-lg p-2">
              <div className="flex items-center gap-1 text-yellow-400 text-[10px] md:text-xs mb-0.5">
                <Wallet className="w-3 h-3" />
                Tiền mặt
              </div>
              <p
                className={`text-xs md:text-sm font-bold truncate ${cashbookSummary.cashBalance >= 0 ? "text-yellow-400" : "text-red-400"}`}
              >
                {formatCurrency(cashbookSummary.cashBalance)}
              </p>
            </div>

            {/* Ngân hàng (Bank) */}
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-lg p-2 col-span-2 md:col-span-1">
              <div className="flex items-center gap-1 text-blue-400 text-[10px] md:text-xs mb-0.5">
                <Building className="w-3 h-3" />
                Ngân hàng
              </div>
              <p
                className={`text-xs md:text-sm font-bold truncate ${cashbookSummary.bankBalance >= 0 ? "text-blue-400" : "text-red-400"}`}
              >
                {formatCurrency(cashbookSummary.bankBalance)}
              </p>
            </div>
          </div>

          {/* Filters - Mobile optimized */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-gray-400 text-xs md:text-sm">
              <span>Loại:</span>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                {[
                  { key: "all", label: "Tất cả" },
                  { key: "income", label: "Thu" },
                  { key: "expense", label: "Chi" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTransactionFilter(opt.key as TransactionFilterType)}
                    className={`px-2 md:px-3 py-1 md:py-1.5 rounded-md text-xs md:text-sm transition-colors ${transactionFilter === opt.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-slate-700"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-xs md:text-sm">
              <span>Nguồn tiền:</span>
              <select
                value={paymentSourceFilter}
                onChange={(e) => setPaymentSourceFilter(e.target.value as PaymentSource)}
                className="px-2 md:px-3 py-1 md:py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs md:text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Tất cả</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Ngân hàng</option>
              </select>
            </div>

            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <span>Thời gian:</span>
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                {[
                  { key: "today", label: "Hôm nay" },
                  { key: "7days", label: "7 ngày" },
                  { key: "30days", label: "30 ngày" },
                  { key: "all", label: "Tất cả" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTimeFilter(opt.key as TimeFilter)}
                    className={`px-3 py-1.5 rounded-md text-sm transition-colors ${timeFilter === opt.key
                      ? "bg-blue-600 text-white"
                      : "text-gray-400 hover:text-white hover:bg-slate-700"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Transactions Table - Mobile: Transparent/No padding, Desktop: Card style */}
          <div className="md:bg-slate-800/50 md:rounded-xl md:border md:border-slate-700 md:overflow-hidden">

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Ngày
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Mô tả
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Nguồn/Danh mục
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">
                      Ví
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">
                      Số tiền
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredCashTransactions.length > 0 ? (
                    filteredCashTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                          {new Date(tx.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">
                          <div className="font-medium">{tx.description}</div>
                          {tx.contact && typeof tx.contact === "object" && tx.contact.name && (
                            <div className="text-xs text-gray-400">👤 {tx.contact.name}</div>
                          )}
                          {tx.notes && (
                            <div className="text-xs text-gray-500 italic truncate max-w-[200px]">
                              {tx.notes.replace(/#app:pincorp/gi, "")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-blue-400">
                              {getTransactionSource(tx)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {getCategoryLabel(tx.category || "")}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-300">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${(tx.paymentSourceId?.toLowerCase() || "cash") === "bank" ||
                              tx.paymentSourceId?.toLowerCase() === "ngan_hang"
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-yellow-500/10 text-yellow-500"
                              }`}
                          >
                            {(tx.paymentSourceId?.toLowerCase() || "cash") === "bank" ||
                              tx.paymentSourceId?.toLowerCase() === "ngan_hang"
                              ? "🏦"
                              : "💵"}{" "}
                            {getPaymentSourceLabel(tx.paymentSourceId || "cash")}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-sm font-semibold ${isExpenseTransaction(tx) ? "text-red-400" : "text-teal-400"
                              }`}
                          >
                            {isExpenseTransaction(tx) ? "-" : "+"}
                            {formatCurrency(Math.abs(tx.amount))}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => {
                                setNewTransaction({
                                  type: isExpenseTransaction(tx) ? "expense" : "income",
                                  amount: Math.abs(tx.amount),
                                  description: tx.description || "",
                                  category: tx.category || "",
                                  date: tx.date,
                                  notes: tx.notes || "",
                                  contactName:
                                    typeof tx.contact === "object" && tx.contact?.name
                                      ? tx.contact.name
                                      : "",
                                  paymentSource: tx.paymentSourceId === "bank" ? "bank" : "cash",
                                });
                                setEditingTransaction(tx);
                                setShowAddTransaction(true);
                              }}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteTransaction(tx.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                              title="Xóa"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center">
                        <Wallet className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400">Chưa có giao dịch nào</p>
                        <button
                          onClick={() => setShowAddTransaction(true)}
                          className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          + Thêm giao dịch đầu tiên
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile List View - Flattened */}
            <div className="md:hidden space-y-3">
              {filteredCashTransactions.length > 0 ? (
                filteredCashTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    onClick={() => {
                      setNewTransaction({
                        type: tx.type,
                        amount: Math.abs(tx.amount),
                        description: tx.description || "",
                        category: tx.category || "",
                        date: tx.date ? new Date(tx.date).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
                        notes: tx.notes || "",
                        contactName: tx.contact?.name || "",
                        paymentSource: (tx.paymentSourceId as any) || "cash",
                      });
                      setEditingTransaction(tx);
                      setShowAddTransaction(true);
                    }}
                    className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 active:bg-slate-700/50 transition-colors"
                  >
                    {/* Header: Date + Amount */}
                    <div className="flex justify-between items-start">
                      <div className="text-xs text-gray-400">
                        {new Date(tx.date).toLocaleDateString("vi-VN")}
                      </div>
                      <span
                        className={`text-base font-bold ${isExpenseTransaction(tx) ? "text-red-400" : "text-teal-400"
                          }`}
                      >
                        {isExpenseTransaction(tx) ? "-" : "+"}
                        {formatCurrency(Math.abs(tx.amount))}
                      </span>
                    </div>

                    {/* Content: Description + Contact */}
                    <div>
                      <div className="text-sm font-medium text-white">{tx.description}</div>
                      {tx.contact && typeof tx.contact === "object" && tx.contact.name && (
                        <div className="text-xs text-gray-400 mt-0.5">👤 {tx.contact.name}</div>
                      )}
                    </div>

                    {/* Footer: Category + Source + Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            {getTransactionSource(tx)}
                          </span>
                          <span className="text-gray-600">•</span>
                          <span className="text-[10px] text-gray-400">
                            {getCategoryLabel(tx.category || "")}
                          </span>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 text-xs ${(tx.paymentSourceId?.toLowerCase() || "cash") === "bank" ||
                            tx.paymentSourceId?.toLowerCase() === "ngan_hang"
                            ? "text-blue-400"
                            : "text-yellow-500"
                            }`}
                        >
                          {(tx.paymentSourceId?.toLowerCase() || "cash") === "bank" ||
                            tx.paymentSourceId?.toLowerCase() === "ngan_hang"
                            ? "🏦 Ngân hàng"
                            : "💵 Tiền mặt"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            setNewTransaction({
                              type: isExpenseTransaction(tx) ? "expense" : "income",
                              amount: Math.abs(tx.amount),
                              description: tx.description || "",
                              category: tx.category || "",
                              date: tx.date,
                              notes: tx.notes || "",
                              contactName:
                                typeof tx.contact === "object" && tx.contact?.name
                                  ? tx.contact.name
                                  : "",
                              paymentSource: tx.paymentSourceId === "bank" ? "bank" : "cash",
                            });
                            setEditingTransaction(tx);
                            setShowAddTransaction(true);
                          }}
                          className="p-2 text-blue-400 bg-blue-500/10 rounded-lg active:scale-95 transition-transform"
                        >
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTransaction(tx.id)}
                          className="p-2 text-red-400 bg-red-500/10 rounded-lg active:scale-95 transition-transform"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có giao dịch nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ====== LOANS TAB ====== */}
      {activeTab === "loans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Khoản vay</h2>
              <p className="text-gray-400 text-sm">Quản lý các khoản vay ngân hàng</p>
            </div>
            <button
              onClick={() => {
                setNewCapital({
                  ...newCapital,
                  source: "Vay ngân hàng",
                });
                setShowAddCapital(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Thêm khoản vay
            </button>
          </div>

          {/* Loan Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-orange-600/20 to-orange-700/10 border border-orange-500/30 rounded-xl p-4">
              <div className="text-orange-400 text-sm mb-2">Tổng dư nợ</div>
              <p className="text-2xl font-bold text-orange-400">
                {formatCurrency(
                  capitalInvestments
                    .filter(
                      (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
                    )
                    .reduce((sum, i) => sum + i.amount, 0)
                )}
              </p>
            </div>
            <div className="bg-gradient-to-br from-cyan-600/20 to-cyan-700/10 border border-cyan-500/30 rounded-xl p-4">
              <div className="text-cyan-400 text-sm mb-2">Số khoản vay</div>
              <p className="text-2xl font-bold text-cyan-400">
                {
                  capitalInvestments.filter(
                    (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
                  ).length
                }
              </p>
            </div>
            <div className="bg-gradient-to-br from-pink-600/20 to-pink-700/10 border border-pink-500/30 rounded-xl p-4">
              <div className="text-pink-400 text-sm mb-2">Lãi suất TB</div>
              <p className="text-2xl font-bold text-pink-400">
                {(() => {
                  const loans = capitalInvestments.filter(
                    (i) =>
                      ((i as any).type === "loan" || (i as any).source === "Vay ngân hàng") &&
                      (i as any).interestRate
                  );
                  if (loans.length === 0) return "0%";
                  const avg =
                    loans.reduce((sum, l) => sum + ((l as any).interestRate || 0), 0) /
                    loans.length;
                  return `${avg.toFixed(1)}%`;
                })()}
              </p>
            </div>
          </div>

          {/* Loans Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Desktop Loans Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Ngày
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Mô tả
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">
                      Số tiền
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">
                      Lãi suất
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {capitalInvestments
                    .filter(
                      (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
                    )
                    .map((loan) => (
                      <tr key={loan.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-white">
                          {new Date(loan.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {(loan as any).description || (loan as any).notes || "Khoản vay"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-orange-400">
                          {formatCurrency(loan.amount)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-300">
                          {(loan as any).interestRate ? `${(loan as any).interestRate}%/năm` : "--"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setNewCapital({
                                  source: "Vay ngân hàng",
                                  amount: loan.amount,
                                  description:
                                    (loan as any).description || (loan as any).notes || "",
                                  date: loan.date,
                                  interestRate: (loan as any).interestRate,
                                });
                                setEditingInvestment(loan);
                                setShowAddCapital(true);
                              }}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvestment(loan.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {capitalInvestments.filter(
                    (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
                  ).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <CreditCardIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                          <p className="text-gray-400">Chưa có khoản vay nào</p>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            {/* Mobile List View - Flattened */}
            <div className="md:hidden space-y-3 mt-4">
              {capitalInvestments.filter(
                (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
              ).length > 0 ? (
                capitalInvestments
                  .filter(
                    (i) => (i as any).type === "loan" || (i as any).source === "Vay ngân hàng"
                  )
                  .map((loan) => (
                    <div
                      key={loan.id}
                      className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium text-white mb-0.5">
                            {(loan as any).description || (loan as any).notes || "Khoản vay"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(loan.date).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-orange-400">
                            {formatCurrency(loan.amount)}
                          </div>
                          <div className="text-xs text-gray-400">
                            LS: {(loan as any).interestRate ? `${(loan as any).interestRate}%/năm` : "--"}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                        <button
                          onClick={() => {
                            setNewCapital({
                              source: "Vay ngân hàng",
                              amount: loan.amount,
                              description:
                                (loan as any).description || (loan as any).notes || "",
                              date: loan.date,
                              interestRate: (loan as any).interestRate,
                            });
                            setEditingInvestment(loan);
                            setShowAddCapital(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteInvestment(loan.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium"
                        >
                          <TrashIcon className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <CreditCardIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có khoản vay nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ====== ASSETS TAB (TSCĐ) ====== */}
      {activeTab === "assets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Tài sản cố định</h2>
              <p className="text-gray-400 text-sm">Quản lý tài sản, thiết bị và khấu hao</p>
            </div>
            <button
              onClick={() => setShowAddAsset(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Thêm tài sản
            </button>
          </div>

          {/* Asset Summary */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/30 rounded-xl p-4">
              <div className="text-blue-400 text-sm mb-2">Tổng giá trị tài sản</div>
              <p className="text-2xl font-bold text-blue-400">
                {formatCurrency(financialSummary.totalAssetValue)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-green-600/20 to-green-700/10 border border-green-500/30 rounded-xl p-4">
              <div className="text-green-400 text-sm mb-2">Số tài sản</div>
              <p className="text-2xl font-bold text-green-400">{financialSummary.assetCount}</p>
            </div>
            <div className="bg-gradient-to-br from-red-600/20 to-red-700/10 border border-red-500/30 rounded-xl p-4">
              <div className="text-red-400 text-sm mb-2">Khấu hao tích lũy</div>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(financialSummary.assetDepreciation)}
              </p>
            </div>
          </div>

          {/* Assets Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Desktop Assets Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Tài sản
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Loại
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Ngày mua
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">
                      Giá gốc
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">
                      Giá trị hiện tại
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">
                      Khấu hao
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">
                      Trạng thái
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {fixedAssets.map((asset) => {
                    const currentDate = new Date();
                    const bookValue = FinancialAnalyticsService.calculateBookValue(
                      asset,
                      currentDate
                    );
                    const depreciation = asset.purchasePrice - bookValue;
                    const depreciationRate = ((depreciation / asset.purchasePrice) * 100).toFixed(
                      1
                    );

                    return (
                      <tr key={asset.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">{asset.name}</div>
                          {asset.description && (
                            <div className="text-xs text-gray-400">{asset.description}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300 capitalize">
                          {asset.category.replace("_", " ")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {new Date(asset.purchaseDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-white">
                          {formatCurrency(asset.purchasePrice)}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-blue-400">
                          {formatCurrency(bookValue)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-16 bg-slate-600 rounded-full h-2">
                              <div
                                className="bg-red-500 h-2 rounded-full"
                                style={{ width: `${Math.min(parseFloat(depreciationRate), 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-400">{depreciationRate}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${asset.status === "active"
                              ? "bg-green-500/20 text-green-400"
                              : asset.status === "under_maintenance"
                                ? "bg-yellow-500/20 text-yellow-400"
                                : "bg-red-500/20 text-red-400"
                              }`}
                          >
                            {asset.status === "active"
                              ? "Hoạt động"
                              : asset.status === "under_maintenance"
                                ? "Bảo trì"
                                : "Thanh lý"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setNewAsset({
                                  name: asset.name,
                                  category: asset.category as any,
                                  purchasePrice: asset.purchasePrice,
                                  purchaseDate: asset.purchaseDate,
                                  usefulLife: asset.usefulLife || 5,
                                  salvageValue: asset.salvageValue || 0,
                                  depreciationMethod: (asset.depreciationMethod ||
                                    "straight_line") as any,
                                  location: asset.location || "",
                                  description: asset.description || "",
                                });
                                setEditingAsset(asset);
                                setShowAddAsset(true);
                              }}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteAsset(asset.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {fixedAssets.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-6 py-12 text-center">
                        <Building className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                        <p className="text-gray-400">Chưa có tài sản cố định nào</p>
                        <button
                          onClick={() => setShowAddAsset(true)}
                          className="mt-3 text-blue-400 hover:text-blue-300 text-sm"
                        >
                          + Thêm tài sản đầu tiên
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Assets List */}
            <div className="md:hidden space-y-3 p-3">
              {fixedAssets.length > 0 ? (
                fixedAssets.map((asset) => {
                  const currentDate = new Date();
                  const bookValue = FinancialAnalyticsService.calculateBookValue(
                    asset,
                    currentDate
                  );
                  return (
                    <div
                      key={asset.id}
                      className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium text-white mb-0.5">{asset.name}</div>
                          <div className="text-xs text-gray-400 capitalize">
                            {asset.category.replace("_", " ")}
                          </div>
                        </div>
                        <span
                          className={`inline-flex px-2 py-0.5 text-[10px] font-medium rounded-full h-fit ${asset.status === "active"
                            ? "bg-green-500/20 text-green-400"
                            : asset.status === "under_maintenance"
                              ? "bg-yellow-500/20 text-yellow-400"
                              : "bg-red-500/20 text-red-400"
                            }`}
                        >
                          {asset.status === "active"
                            ? "Hoạt động"
                            : asset.status === "under_maintenance"
                              ? "Bảo trì"
                              : "Thanh lý"}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-t border-b border-slate-700/50">
                        <div>
                          <div className="text-[10px] text-gray-500 mb-0.5">NGUYÊN GIÁ</div>
                          <div className="text-sm font-medium text-white">
                            {formatCurrency(asset.purchasePrice)}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-gray-500 mb-0.5">GIÁ TRỊ HIỆN TẠI</div>
                          <div className="text-sm font-bold text-blue-400">
                            {formatCurrency(bookValue)}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs text-gray-400">
                        <span>Mua: {new Date(asset.purchaseDate).toLocaleDateString("vi-VN")}</span>
                      </div>

                      <div className="flex justify-end gap-2 pt-1 border-t border-slate-700/50">
                        <button
                          onClick={() => {
                            setNewAsset({
                              name: asset.name,
                              category: asset.category as any,
                              purchasePrice: asset.purchasePrice,
                              purchaseDate: asset.purchaseDate,
                              usefulLife: asset.usefulLife || 5,
                              salvageValue: asset.salvageValue || 0,
                              depreciationMethod: (asset.depreciationMethod ||
                                "straight_line") as any,
                              location: asset.location || "",
                              description: asset.description || "",
                            });
                            setEditingAsset(asset);
                            setShowAddAsset(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteAsset(asset.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium"
                        >
                          <TrashIcon className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <Building className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có tài sản cố định nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ====== CAPITAL TAB (VỐN) ====== */}
      {activeTab === "capital" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">Vốn đầu tư</h2>
              <p className="text-gray-400 text-sm">Quản lý vốn chủ sở hữu và đầu tư</p>
            </div>
            <button
              onClick={() => {
                setNewCapital({
                  ...newCapital,
                  source: "Vốn chủ sở hữu",
                });
                setShowAddCapital(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <Plus className="w-4 h-4" />
              Thêm vốn
            </button>
          </div>

          {/* Capital Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/30 rounded-xl p-4">
              <div className="text-emerald-400 text-sm mb-2">Tổng vốn đầu tư</div>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(financialSummary.totalCapitalInvested)}
              </p>
            </div>
            <div className="bg-gradient-to-br from-violet-600/20 to-violet-700/10 border border-violet-500/30 rounded-xl p-4">
              <div className="text-violet-400 text-sm mb-2">Vốn chủ sở hữu</div>
              <p className="text-2xl font-bold text-violet-400">
                {formatCurrency(
                  capitalInvestments
                    .filter(
                      (i) => (i as any).type !== "loan" && (i as any).source !== "Vay ngân hàng"
                    )
                    .reduce((sum, i) => sum + i.amount, 0)
                )}
              </p>
            </div>
          </div>

          {/* Capital Table */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden">
            {/* Desktop Capital Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Ngày
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Loại
                    </th>
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase">
                      Mô tả
                    </th>
                    <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase">
                      Số tiền
                    </th>
                    <th className="px-6 py-4 text-center text-xs font-medium text-gray-400 uppercase">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {capitalInvestments
                    .filter(
                      (i) => (i as any).type !== "loan" && (i as any).source !== "Vay ngân hàng"
                    )
                    .map((investment) => (
                      <tr key={investment.id} className="hover:bg-slate-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-white">
                          {new Date(investment.date).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                            Vốn chủ sở hữu
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-300">
                          {(investment as any).description ||
                            (investment as any).notes ||
                            "Vốn đầu tư"}
                        </td>
                        <td className="px-6 py-4 text-sm text-right font-semibold text-emerald-400">
                          {formatCurrency(investment.amount)}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => {
                                setNewCapital({
                                  source: "Vốn chủ sở hữu",
                                  amount: investment.amount,
                                  description:
                                    (investment as any).description ||
                                    (investment as any).notes ||
                                    "",
                                  date: investment.date,
                                  interestRate: undefined,
                                });
                                setEditingInvestment(investment);
                                setShowAddCapital(true);
                              }}
                              className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteInvestment(investment.id)}
                              className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  {capitalInvestments.filter(
                    (i) => (i as any).type !== "loan" && (i as any).source !== "Vay ngân hàng"
                  ).length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center">
                          <DollarSign className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                          <p className="text-gray-400">Chưa có khoản vốn nào</p>
                        </td>
                      </tr>
                    )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View - Flattened */}
            <div className="md:hidden grid grid-cols-1 gap-3 mt-4">
              {capitalInvestments.filter(
                (i) => (i as any).type !== "loan" && (i as any).source !== "Vay ngân hàng"
              ).length > 0 ? (
                capitalInvestments
                  .filter(
                    (i) => (i as any).type !== "loan" && (i as any).source !== "Vay ngân hàng"
                  )
                  .map((investment) => (
                    <div
                      key={investment.id}
                      className="bg-slate-800 rounded-xl p-4 border border-slate-700 shadow-sm space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="text-sm font-medium text-white mb-0.5">
                            {(investment as any).description ||
                              (investment as any).notes ||
                              "Vốn đầu tư"}
                          </div>
                          <div className="text-xs text-gray-400">
                            {new Date(investment.date).toLocaleDateString("vi-VN")}
                          </div>
                        </div>
                        <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/20 text-emerald-400 h-fit">
                          Vốn chủ sở hữu
                        </span>
                      </div>

                      <div className="flex justify-between items-end pt-1">
                        <div className="text-lg font-bold text-emerald-400">
                          {formatCurrency(investment.amount)}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2 border-t border-slate-700/50">
                        <button
                          onClick={() => {
                            setNewCapital({
                              source: "Vốn chủ sở hữu",
                              amount: investment.amount,
                              description:
                                (investment as any).description ||
                                (investment as any).notes ||
                                "",
                              date: investment.date,
                              interestRate: undefined,
                            });
                            setEditingInvestment(investment);
                            setShowAddCapital(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-xs font-medium"
                        >
                          <PencilSquareIcon className="w-3.5 h-3.5" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteInvestment(investment.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs font-medium"
                        >
                          <TrashIcon className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                  ))
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có khoản vốn nào</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* ====== ADD TRANSACTION MODAL ====== */}
      {showAddTransaction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md max-h-[95vh] sm:max-h-[90vh] overflow-hidden shadow-2xl border border-slate-700 flex flex-col">
            <div className="p-4 sm:p-6 border-b border-slate-700 flex-shrink-0">
              <h3 className="text-base sm:text-lg font-semibold text-white">
                {editingTransaction ? "✏️ Sửa giao dịch" : "➕ Thêm giao dịch mới"}
              </h3>
            </div>
            <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 overflow-y-auto flex-1">
              {/* Transaction Type */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Loại giao dịch
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewTransaction((prev) => ({ ...prev, type: "income" }))}
                    className={`p-2.5 sm:p-3 rounded-lg border text-center font-medium transition-colors text-sm sm:text-base ${newTransaction.type === "income"
                      ? "bg-teal-500/20 border-teal-500 text-teal-400"
                      : "border-slate-600 text-gray-400 hover:bg-slate-700"
                      }`}
                  >
                    ↑ Thu nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewTransaction((prev) => ({ ...prev, type: "expense" }))}
                    className={`p-2.5 sm:p-3 rounded-lg border text-center font-medium transition-colors text-sm sm:text-base ${newTransaction.type === "expense"
                      ? "bg-red-500/20 border-red-500 text-red-400"
                      : "border-slate-600 text-gray-400 hover:bg-slate-700"
                      }`}
                  >
                    ↓ Chi phí
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                  Số tiền <span className="text-red-400">*</span>
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="0"
                  min="0"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                  Nội dung <span className="text-red-400">*</span>
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Nhập nội dung giao dịch"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
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

              {/* Payment Source */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                  Nguồn tiền
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setNewTransaction((prev) => ({ ...prev, paymentSource: "cash" }))
                    }
                    className={`p-2.5 sm:p-3 rounded-lg border text-center font-medium transition-colors text-sm sm:text-base ${newTransaction.paymentSource === "cash"
                      ? "bg-yellow-500/20 border-yellow-500 text-yellow-400"
                      : "border-slate-600 text-gray-400 hover:bg-slate-700"
                      }`}
                  >
                    💵 Tiền mặt
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setNewTransaction((prev) => ({ ...prev, paymentSource: "bank" }))
                    }
                    className={`p-2.5 sm:p-3 rounded-lg border text-center font-medium transition-colors text-sm sm:text-base ${newTransaction.paymentSource === "bank"
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : "border-slate-600 text-gray-400 hover:bg-slate-700"
                      }`}
                  >
                    🏦 Ngân hàng
                  </button>
                </div>
              </div>

              {/* Contact Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
                  Đối tượng (khách hàng/nhà cung cấp)
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  placeholder="Tên khách hàng hoặc nhà cung cấp"
                />
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5 sm:mb-2">
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
                  className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                  rows={2}
                  placeholder="Ghi chú thêm (không bắt buộc)"
                />
              </div>
            </div>
            <div className="p-4 sm:p-6 border-t border-slate-700 flex gap-2 sm:gap-3 flex-shrink-0">
              <button
                onClick={resetTransactionForm}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium text-sm sm:text-base"
              >
                Hủy
              </button>
              <button
                onClick={handleAddTransaction}
                disabled={!newTransaction.description || !newTransaction.amount || isSubmitting}
                className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-600 disabled:text-gray-400 rounded-lg transition-colors font-medium text-sm sm:text-base flex justify-center items-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {editingTransaction ? "Cập nhật" : "Thêm giao dịch"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ====== ADD ASSET MODAL ====== */}
      {showAddAsset && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                {editingAsset ? "✏️ Sửa Tài sản Cố định" : "➕ Thêm Tài sản Cố định"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Tên tài sản <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newAsset.name}
                    onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Nhập tên tài sản"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Danh mục</label>
                  <select
                    value={newAsset.category}
                    onChange={(e) =>
                      setNewAsset({
                        ...newAsset,
                        category: e.target.value as any,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="equipment">Thiết bị</option>
                    <option value="vehicle">Phương tiện</option>
                    <option value="furniture">Nội thất</option>
                    <option value="building">Công trình</option>
                    <option value="technology">Công nghệ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Giá mua (VND) <span className="text-red-400">*</span>
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
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Ngày mua</label>
                  <input
                    type="date"
                    value={newAsset.purchaseDate}
                    onChange={(e) => setNewAsset({ ...newAsset, purchaseDate: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
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
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="straight_line">Đường thẳng</option>
                    <option value="declining_balance">Số dư giảm dần</option>
                    <option value="sum_of_years">Tổng số năm</option>
                    <option value="units_of_production">Đơn vị sản xuất</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Vị trí</label>
                <input
                  type="text"
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập vị trí tài sản"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả</label>
                <textarea
                  value={newAsset.description}
                  onChange={(e) => setNewAsset({ ...newAsset, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Mô tả chi tiết tài sản"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={resetAssetForm}
                className="px-4 py-2.5 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleAddAsset}
                className="px-4 py-2.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium"
              >
                {editingAsset ? "Cập nhật" : "Thêm Tài sản"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====== ADD CAPITAL/LOAN MODAL ====== */}
      {showAddCapital && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl w-full max-w-md shadow-2xl border border-slate-700">
            <div className="p-6 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">
                {editingInvestment
                  ? "✏️ Sửa khoản " + (newCapital.source === "Vay ngân hàng" ? "vay" : "vốn")
                  : newCapital.source === "Vay ngân hàng"
                    ? "💳 Thêm Khoản vay"
                    : "💰 Ghi nhận Đầu tư Vốn"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Nguồn vốn <span className="text-red-400">*</span>
                </label>
                <select
                  value={newCapital.source}
                  onChange={(e) =>
                    setNewCapital({
                      ...newCapital,
                      source: e.target.value as any,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="Vốn chủ sở hữu">Vốn chủ sở hữu</option>
                  <option value="Vay ngân hàng">Vay ngân hàng</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Số tiền (VND) <span className="text-red-400">*</span>
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
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Ngày</label>
                <input
                  type="date"
                  value={newCapital.date}
                  onChange={(e) => setNewCapital({ ...newCapital, date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              {newCapital.source === "Vay ngân hàng" && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Lãi suất (% năm)
                  </label>
                  <input
                    type="number"
                    value={newCapital.interestRate || ""}
                    onChange={(e) =>
                      setNewCapital({
                        ...newCapital,
                        interestRate: e.target.value ? Number(e.target.value) : undefined,
                      })
                    }
                    className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                    step="0.1"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả</label>
                <textarea
                  value={newCapital.description}
                  onChange={(e) =>
                    setNewCapital({
                      ...newCapital,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Mô tả chi tiết"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={resetCapitalForm}
                className="px-4 py-2.5 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleAddCapital}
                className="px-4 py-2.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg transition-colors font-medium"
              >
                {editingInvestment ? "Cập nhật" : "Ghi nhận"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl shadow-2xl border border-slate-700 w-full max-w-md">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="text-lg font-semibold text-white">{confirmDialog.title}</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-gray-300">{confirmDialog.message}</p>
            </div>
            <div className="px-6 py-4 border-t border-slate-700 flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2.5 text-gray-300 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors font-medium"
              >
                Hủy
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors font-medium"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinFinancialManager;
