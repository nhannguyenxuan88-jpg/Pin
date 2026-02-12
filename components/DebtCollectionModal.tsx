import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction, PinSale, PinRepairOrder } from "../types";
import { XMarkIcon } from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const fmt = (val: number) => val.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

type Props = {
  open: boolean;
  onClose: () => void;
  preSelectedDebtId?: string; // ID của công nợ đã được chọn từ danh sách
  preSelectedCustomerKey?: string; // Key khách hàng đã chọn (chế độ gom nợ)
  initialMode?: "per-order" | "consolidated"; // Chế độ mặc định
};

interface DebtItem {
  id: string;
  type: "sale" | "repair";
  customerName: string;
  customerPhone?: string;
  total: number;
  paidAmount: number;
  remaining: number;
  date: string;
  code?: string;
}

interface CustomerGroup {
  key: string;
  customerName: string;
  customerPhone?: string;
  totalDebt: number;
  orderCount: number;
  debts: DebtItem[];
}

export default function DebtCollectionModal({ open, onClose, preSelectedDebtId, preSelectedCustomerKey, initialMode }: Props) {
  const ctx = usePinContext();
  const currentUser = ctx.currentUser;
  const currentBranchId = (ctx as any).currentBranchId || "main";
  const addCashTransaction = ctx.addCashTransaction;
  const pinSales = ctx.pinSales || [];
  const pinRepairOrders = ctx.pinRepairOrders || [];
  const updatePinSale = ctx.updatePinSale;
  const upsertPinRepairOrder = ctx.upsertPinRepairOrder;
  const addToast = ctx.addToast;

  // Toast helper
  const showToast = (title: string, message: string, type: "success" | "error" | "warn" = "success") => {
    addToast?.({ id: crypto.randomUUID(), message: `${title}: ${message}`, type });
  };

  const [mode, setMode] = useState<"per-order" | "consolidated">(initialMode || "per-order");
  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    debtInfo: any;
    paidAmount: number;
    paymentDate: string;
    paymentMethod: string;
    remaining: number;
    allocations?: Array<{ id: string; type: string; code: string; amount: number }>;
    isConsolidated?: boolean;
  } | null>(null);

  // Tự động chọn công nợ/khách hàng khi mở modal
  useEffect(() => {
    if (open) {
      if (preSelectedCustomerKey) {
        setMode("consolidated");
        setSelectedCustomerKey(preSelectedCustomerKey);
        setSelectedDebtId("");
      } else if (preSelectedDebtId) {
        setMode("per-order");
        setSelectedDebtId(preSelectedDebtId);
        setSelectedCustomerKey("");
      } else if (initialMode) {
        setMode(initialMode);
      }
      setAmount("");
    } else {
      // Reset khi đóng modal
      setSelectedDebtId("");
      setSelectedCustomerKey("");
      setAmount("");
      setNotes("");
    }
  }, [open, preSelectedDebtId, preSelectedCustomerKey, initialMode]);

  // Lấy danh sách các đơn hàng/sửa chữa còn nợ
  const pendingDebts = useMemo(() => {
    const debts: DebtItem[] = [];

    // Đơn hàng còn nợ
    (pinSales || []).forEach((sale: PinSale) => {
      const status = sale.paymentStatus || "paid";
      if (status === "debt" || status === "partial") {
        const paidAmt = sale.paidAmount || 0;
        const remaining = sale.total - paidAmt;
        if (remaining > 0) {
          debts.push({
            id: sale.id,
            type: "sale",
            customerName: sale.customer?.name || "Khách lẻ",
            customerPhone: sale.customer?.phone,
            total: sale.total,
            paidAmount: paidAmt,
            remaining,
            date: sale.date,
            code: (sale as any).code,
          });
        }
      }
    });

    // Phiếu sửa chữa còn nợ
    (pinRepairOrders || []).forEach((order: PinRepairOrder) => {
      const status = order.paymentStatus || "unpaid";
      if (status === "unpaid" || status === "partial") {
        // Fix: Cộng cả deposit và partial payment
        const depositAmt = order.depositAmount || 0;
        const partialAmt = order.partialPaymentAmount || 0;
        const paidAmt = depositAmt + partialAmt;
        const remaining = order.total - paidAmt;
        if (remaining > 0) {
          debts.push({
            id: order.id,
            type: "repair",
            customerName: order.customerName || "Khách lẻ",
            customerPhone: order.customerPhone,
            total: order.total,
            paidAmount: paidAmt,
            remaining,
            date: order.creationDate,
          });
        }
      }
    });

    return debts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest first for FIFO
  }, [pinSales, pinRepairOrders]);

  // Gom nợ theo khách hàng
  const customerGroups = useMemo(() => {
    const groupMap = new Map<string, CustomerGroup>();

    for (const debt of pendingDebts) {
      const key = `${debt.customerPhone || ""}-${debt.customerName || ""}`.toLowerCase();
      const existing = groupMap.get(key);
      if (existing) {
        existing.totalDebt += debt.remaining;
        existing.orderCount += 1;
        existing.debts.push(debt);
      } else {
        groupMap.set(key, {
          key,
          customerName: debt.customerName,
          customerPhone: debt.customerPhone,
          totalDebt: debt.remaining,
          orderCount: 1,
          debts: [debt],
        });
      }
    }

    return Array.from(groupMap.values()).sort((a, b) => b.totalDebt - a.totalDebt);
  }, [pendingDebts]);

  const selectedDebt = pendingDebts.find((d) => d.id === selectedDebtId);
  const selectedCustomerGroup = customerGroups.find((g) => g.key === selectedCustomerKey);

  if (!open) return null;

  // === XỬ LÝ THANH TOÁN THEO ĐƠN ===
  const handleSubmit = async () => {
    if (!currentUser) {
      showToast("Lỗi", "Vui lòng đăng nhập", "error");
      return;
    }
    if (!selectedDebtId || !amount || Number(amount) <= 0) {
      showToast("Thiếu thông tin", "Vui lòng chọn đơn nợ và nhập số tiền thanh toán", "warn");
      return;
    }

    const payAmount = Number(amount);
    if (!selectedDebt) {
      showToast("Lỗi", "Không tìm thấy thông tin nợ", "error");
      return;
    }

    // Kiểm tra số tiền không vượt quá số nợ còn lại
    if (payAmount > selectedDebt.remaining) {
      showToast(
        "Số tiền không hợp lệ",
        `Số tiền thanh toán không được vượt quá số nợ còn lại (${formatCurrency(selectedDebt.remaining)})`,
        "warn"
      );
      return;
    }

    // Tạo giao dịch thu tiền
    const tx: CashTransaction = {
      id: crypto.randomUUID(),
      type: "income",
      date: new Date().toISOString(),
      amount: payAmount,
      contact: { id: selectedDebt.id, name: selectedDebt.customerName },
      notes:
        notes ||
        `Thu nợ ${selectedDebt.type === "sale" ? "đơn hàng" : "sửa chữa"} #${
          selectedDebt.code || selectedDebt.id
        } - ${formatCurrency(payAmount)}/${formatCurrency(selectedDebt.total)}`,
      paymentSourceId: paymentMethod,
      branchId: currentBranchId,
      category: selectedDebt.type === "repair" ? "service_income" : "sale_income",
      ...(selectedDebt.type === "repair"
        ? { workOrderId: selectedDebtId }
        : { saleId: selectedDebtId }),
    };

    try {
      await addCashTransaction(tx);

      // Cập nhật trạng thái thanh toán của đơn
      const newPaidAmount = selectedDebt.paidAmount + payAmount;
      const isFullyPaid = newPaidAmount >= selectedDebt.total;

      if (selectedDebt.type === "sale" && updatePinSale) {
        const sale = pinSales.find((s: PinSale) => s.id === selectedDebtId);
        if (sale) {
          await updatePinSale({
            ...sale,
            paidAmount: newPaidAmount,
            paymentStatus: isFullyPaid ? "paid" : "partial",
          });
        }
      } else if (selectedDebt.type === "repair" && upsertPinRepairOrder) {
        const repair = pinRepairOrders.find((r: PinRepairOrder) => r.id === selectedDebtId);
        if (repair) {
          // Đảm bảo có đầy đủ các field required trước khi update
          if (!repair.deviceName) {
            showToast("Lỗi dữ liệu", "Phiếu sửa chữa thiếu thông tin thiết bị. Vui lòng kiểm tra lại.", "error");
            return;
          }
          await upsertPinRepairOrder({
            ...repair,
            // Đảm bảo các field required không bị undefined
            customerName: repair.customerName || selectedDebt.customerName || "Khách lẻ",
            customerPhone: repair.customerPhone || "",
            deviceName: repair.deviceName,
            issueDescription: repair.issueDescription || "",
            status: repair.status || "Tiếp nhận",
            laborCost: repair.laborCost || 0,
            total: repair.total || selectedDebt.total,
            paymentStatus: isFullyPaid ? "paid" : "partial",
            partialPaymentAmount: newPaidAmount,
            paymentMethod: paymentMethod,
            paymentDate: new Date().toISOString(),
          });
        }
      }

      showToast(
        "Thành công",
        isFullyPaid
          ? `Đã thanh toán đủ ${formatCurrency(payAmount)}. Đơn đã hoàn tất!`
          : `Đã thu ${formatCurrency(payAmount)}. Còn nợ ${formatCurrency(selectedDebt.total - newPaidAmount)}`,
        "success"
      );

      // Save receipt data for printing
      setReceiptData({
        debtInfo: selectedDebt,
        paidAmount: payAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethod,
        remaining: selectedDebt.total - newPaidAmount,
      });
      setShowReceipt(true);

      // Reset form
      setSelectedDebtId("");
      setAmount("");
      setNotes("");
    } catch (error) {
      showToast("Lỗi", "Lỗi khi ghi nhận thu nợ: " + (error as Error).message, "error");
    }
  };

  const handleFillRemaining = () => {
    if (mode === "consolidated" && selectedCustomerGroup) {
      setAmount(String(selectedCustomerGroup.totalDebt));
    } else if (selectedDebt) {
      setAmount(String(selectedDebt.remaining));
    }
  };

  // === XỬ LÝ THANH TOÁN GOM NỢ - TỰ ĐỘNG PHÂN BỔ FIFO ===
  const handleConsolidatedSubmit = async () => {
    if (!currentUser) {
      showToast("Lỗi", "Vui lòng đăng nhập", "error");
      return;
    }
    if (!selectedCustomerGroup || !amount || Number(amount) <= 0) {
      showToast("Thiếu thông tin", "Vui lòng chọn khách hàng và nhập số tiền thanh toán", "warn");
      return;
    }

    const payAmount = Number(amount);

    if (payAmount > selectedCustomerGroup.totalDebt) {
      showToast(
        "Số tiền không hợp lệ",
        `Số tiền thanh toán không được vượt quá tổng nợ (${formatCurrency(selectedCustomerGroup.totalDebt)})`,
        "warn"
      );
      return;
    }

    try {
      // Phân bổ tiền theo FIFO (đơn cũ nhất trước)
      let remaining = payAmount;
      const allocations: Array<{ id: string; type: string; code: string; amount: number }> = [];
      const sortedDebts = [...selectedCustomerGroup.debts].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      for (const debt of sortedDebts) {
        if (remaining <= 0) break;

        const allocateAmount = Math.min(remaining, debt.remaining);
        remaining -= allocateAmount;

        allocations.push({
          id: debt.id,
          type: debt.type,
          code: debt.code || debt.id.slice(0, 8),
          amount: allocateAmount,
        });

        // Tạo giao dịch thu tiền cho từng đơn
        const tx: CashTransaction = {
          id: crypto.randomUUID(),
          type: "income",
          date: new Date().toISOString(),
          amount: allocateAmount,
          contact: {
            id: debt.customerPhone || debt.customerName,
            name: debt.customerName,
          },
          notes:
            notes ||
            `Thu nợ gom - ${debt.type === "sale" ? "Đơn hàng" : "Sửa chữa"} #${debt.code || debt.id.slice(0, 8)} - ${formatCurrency(allocateAmount)}`,
          paymentSourceId: paymentMethod,
          branchId: currentBranchId,
          category: debt.type === "repair" ? "service_income" : "sale_income",
          ...(debt.type === "repair"
            ? { workOrderId: debt.id }
            : { saleId: debt.id }),
        };
        await addCashTransaction(tx);

        // Cập nhật trạng thái thanh toán của đơn
        const newPaidAmount = debt.paidAmount + allocateAmount;
        const isFullyPaid = newPaidAmount >= debt.total;

        if (debt.type === "sale" && updatePinSale) {
          const sale = pinSales.find((s: PinSale) => s.id === debt.id);
          if (sale) {
            await updatePinSale({
              ...sale,
              paidAmount: newPaidAmount,
              paymentStatus: isFullyPaid ? "paid" : "partial",
            });
          }
        } else if (debt.type === "repair" && upsertPinRepairOrder) {
          const repair = pinRepairOrders.find((r: PinRepairOrder) => r.id === debt.id);
          if (repair && repair.deviceName) {
            await upsertPinRepairOrder({
              ...repair,
              customerName: repair.customerName || debt.customerName || "Khách lẻ",
              customerPhone: repair.customerPhone || "",
              deviceName: repair.deviceName,
              issueDescription: repair.issueDescription || "",
              status: repair.status || "Tiếp nhận",
              laborCost: repair.laborCost || 0,
              total: repair.total || debt.total,
              paymentStatus: isFullyPaid ? "paid" : "partial",
              partialPaymentAmount: newPaidAmount,
              paymentMethod: paymentMethod,
              paymentDate: new Date().toISOString(),
            });
          }
        }
      }

      const totalRemaining = selectedCustomerGroup.totalDebt - payAmount;
      const fullyPaidCount = allocations.filter((a) => {
        const debt = sortedDebts.find((d) => d.id === a.id);
        return debt && debt.paidAmount + a.amount >= debt.total;
      }).length;

      showToast(
        "Thành công",
        `Đã thu ${formatCurrency(payAmount)} từ ${selectedCustomerGroup.customerName}. ` +
          `Phân bổ cho ${allocations.length} đơn (${fullyPaidCount} đơn đã tất toán). ` +
          (totalRemaining > 0 ? `Còn nợ: ${formatCurrency(totalRemaining)}` : "Đã hết nợ!"),
        "success"
      );

      // Save receipt data for printing
      setReceiptData({
        debtInfo: {
          customerName: selectedCustomerGroup.customerName,
          customerPhone: selectedCustomerGroup.customerPhone,
          total: selectedCustomerGroup.totalDebt,
          type: "consolidated",
        },
        paidAmount: payAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethod,
        remaining: totalRemaining,
        allocations,
        isConsolidated: true,
      });
      setShowReceipt(true);

      // Reset form
      setSelectedCustomerKey("");
      setAmount("");
      setNotes("");
    } catch (error) {
      showToast("Lỗi", "Lỗi khi ghi nhận thu nợ: " + (error as Error).message, "error");
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setReceiptData(null);
    onClose();
  };

  // If showing receipt, render print modal instead
  if (showReceipt && receiptData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-black sticky top-0 bg-white dark:bg-slate-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-black">
              {receiptData.isConsolidated ? "Phiếu thu gom nợ" : "Phiếu thu tiền"}
            </h3>
            <button
              onClick={handleCloseReceipt}
              className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors print:hidden"
            >
              <XMarkIcon className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Receipt Content */}
          <div className="p-6 space-y-4 print:text-black">
            <div className="text-center print:text-black">
              <h4 className="text-xl font-bold">PIN Corp</h4>
              <p className="text-sm text-slate-600 dark:text-slate-400 print:text-black">
                {receiptData.isConsolidated ? "Phiếu thu gom nợ khách hàng" : "Phiếu thu tiền nợ"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 print:text-black">
                {new Date(receiptData.paymentDate).toLocaleString("vi-VN")}
              </p>
            </div>

            <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 space-y-2 print:border-black">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Khách hàng:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {receiptData.debtInfo.customerName}
                </span>
              </div>

              {!receiptData.isConsolidated && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">Loại:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {receiptData.debtInfo.type === "sale" ? "Đơn hàng" : "Sửa chữa"}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Tổng nợ:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {formatCurrency(receiptData.debtInfo.total)}
                </span>
              </div>

              {!receiptData.isConsolidated && receiptData.debtInfo.paidAmount !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Đã trả trước:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {formatCurrency(receiptData.debtInfo.paidAmount)}
                  </span>
                </div>
              )}

              {/* Chi tiết phân bổ cho phiếu gom nợ */}
              {receiptData.isConsolidated && receiptData.allocations && (
                <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2 print:border-black">
                  <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 print:text-black">
                    Chi tiết phân bổ:
                  </div>
                  {receiptData.allocations.map((alloc, i) => (
                    <div key={i} className="flex justify-between text-xs py-0.5">
                      <span className="text-slate-500 dark:text-slate-400 print:text-black">
                        {alloc.type === "sale" ? "ĐH" : "SC"} #{alloc.code}
                      </span>
                      <span className="font-medium text-slate-700 dark:text-slate-300 print:text-black">
                        {formatCurrency(alloc.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-700 pt-2 print:border-black">
                <span className="text-green-600 dark:text-green-400 print:text-black">
                  Số tiền thu:
                </span>
                <span className="text-green-600 dark:text-green-400 print:text-black">
                  {formatCurrency(receiptData.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Còn lại:
                </span>
                <span
                  className={`font-medium ${
                    receiptData.remaining > 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-green-600 dark:text-green-400"
                  } print:text-black`}
                >
                  {formatCurrency(receiptData.remaining)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Phương thức:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {receiptData.paymentMethod === "cash" ? "💵 Tiền mặt" : "🏦 Chuyển khoản"}
                </span>
              </div>
            </div>

            <div className="text-center text-xs text-slate-500 dark:text-slate-400 print:text-black">
              Cảm ơn quý khách!
            </div>
          </div>

          {/* Footer with print button */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end print:hidden">
            <button
              onClick={handleCloseReceipt}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handlePrintReceipt}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              🖨️ In phiếu
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 z-10">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            Thu nợ khách hàng
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>
        
        {/* Body */}
        <div className="px-6 py-4 space-y-5">
          {/* Chế độ thu nợ */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
            <button
              onClick={() => {
                setMode("per-order");
                setSelectedCustomerKey("");
                setAmount("");
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "per-order"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              📋 Theo đơn
            </button>
            <button
              onClick={() => {
                setMode("consolidated");
                setSelectedDebtId("");
                setAmount("");
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-all ${
                mode === "consolidated"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-slate-100 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
            >
              👥 Gom nợ theo KH
            </button>
          </div>

          {mode === "consolidated" && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Gom nợ:</strong> Tổng hợp tất cả đơn nợ của 1 khách hàng. Khi thanh toán, tiền tự động phân bổ từ đơn cũ nhất trước (FIFO).
              </p>
            </div>
          )}

          {/* === CHẾ ĐỘ THEO ĐƠN === */}
          {mode === "per-order" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chọn đơn nợ cần thu
                </label>
                <select
                  value={selectedDebtId}
                  onChange={(e) => {
                    setSelectedDebtId(e.target.value);
                    setAmount("");
                  }}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Chọn đơn nợ --</option>
                  {pendingDebts.map((debt) => (
                    <option key={debt.id} value={debt.id}>
                      {debt.customerName} • {debt.type === "sale" ? "Đơn hàng" : "Sửa chữa"} • Nợ:{" "}
                      {formatCurrency(debt.remaining)}
                    </option>
                  ))}
                </select>
                {pendingDebts.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Không có đơn nợ nào cần thu.
                  </p>
                )}
              </div>

              {selectedDebt && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Khách hàng:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {selectedDebt.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Tổng tiền:</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {formatCurrency(selectedDebt.total)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">Đã thanh toán:</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(selectedDebt.paidAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-600 pt-2">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Còn nợ:</span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(selectedDebt.remaining)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* === CHẾ ĐỘ GOM NỢ THEO KHÁCH HÀNG === */}
          {mode === "consolidated" && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Chọn khách hàng
                </label>
                <select
                  value={selectedCustomerKey}
                  onChange={(e) => {
                    setSelectedCustomerKey(e.target.value);
                    setAmount("");
                  }}
                  className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option value="">-- Chọn khách hàng --</option>
                  {customerGroups.map((group) => (
                    <option key={group.key} value={group.key}>
                      {group.customerName}{group.customerPhone ? ` (${group.customerPhone})` : ""} • {group.orderCount} đơn • Tổng nợ: {formatCurrency(group.totalDebt)}
                    </option>
                  ))}
                </select>
                {customerGroups.length === 0 && (
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    Không có khách hàng nào đang nợ.
                  </p>
                )}
              </div>

              {/* Thông tin khách hàng đã chọn */}
              {selectedCustomerGroup && (
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {selectedCustomerGroup.customerName}
                      </div>
                      {selectedCustomerGroup.customerPhone && (
                        <div className="text-sm text-slate-500">
                          📞 {selectedCustomerGroup.customerPhone}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500">Tổng nợ</div>
                      <div className="text-xl font-bold text-red-600 dark:text-red-400">
                        {fmt(selectedCustomerGroup.totalDebt)} đ
                      </div>
                    </div>
                  </div>

                  {/* Danh sách các đơn nợ */}
                  <div className="border-t border-slate-200 dark:border-slate-600 pt-2">
                    <div className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-2">
                      Chi tiết {selectedCustomerGroup.orderCount} đơn nợ (tự động trừ từ đơn cũ nhất):
                    </div>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {selectedCustomerGroup.debts.map((debt, idx) => (
                        <div
                          key={debt.id}
                          className="flex items-center justify-between text-xs bg-white dark:bg-slate-800 px-3 py-2 rounded-md border border-slate-200 dark:border-slate-600"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-mono">{idx + 1}.</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              debt.type === "sale"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                            }`}>
                              {debt.type === "sale" ? "ĐH" : "SC"}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                              #{debt.code || debt.id.slice(0, 8)}
                            </span>
                            <span className="text-slate-400">
                              {new Date(debt.date).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {fmt(debt.remaining)} đ
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Số tiền thanh toán */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Số tiền thanh toán
              </label>
              {(selectedDebt || selectedCustomerGroup) && (
                <button
                  type="button"
                  onClick={handleFillRemaining}
                  className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                >
                  Điền số còn nợ
                </button>
              )}
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder="Nhập số tiền tuỳ ý..."
              min={0}
              max={mode === "consolidated" ? selectedCustomerGroup?.totalDebt : selectedDebt?.remaining || undefined}
            />

            {/* Preview phân bổ cho chế độ gom nợ */}
            {mode === "consolidated" && amount && selectedCustomerGroup && Number(amount) > 0 && (
              <div className="mt-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-1">
                  📊 Dự kiến phân bổ:
                </div>
                {(() => {
                  let rem = Number(amount);
                  const sorted = [...selectedCustomerGroup.debts].sort(
                    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                  );
                  return sorted.map((debt) => {
                    if (rem <= 0) return null;
                    const alloc = Math.min(rem, debt.remaining);
                    rem -= alloc;
                    const isFullyPaid = alloc >= debt.remaining;
                    return (
                      <div key={debt.id} className="flex justify-between text-xs py-0.5">
                        <span className="text-slate-600 dark:text-slate-400">
                          {debt.type === "sale" ? "ĐH" : "SC"} #{debt.code || debt.id.slice(0, 8)}
                          {isFullyPaid && <span className="ml-1 text-green-600">✓ tất toán</span>}
                        </span>
                        <span className={`font-medium ${isFullyPaid ? "text-green-600" : "text-slate-700 dark:text-slate-300"}`}>
                          {formatCurrency(alloc)}
                        </span>
                      </div>
                    );
                  });
                })()}
                {Number(amount) < selectedCustomerGroup.totalDebt && (
                  <div className="flex justify-between text-xs pt-1 mt-1 border-t border-green-200 dark:border-green-700">
                    <span className="text-amber-600 dark:text-amber-400">Còn nợ sau khi trả:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      {formatCurrency(selectedCustomerGroup.totalDebt - Number(amount))}
                    </span>
                  </div>
                )}
              </div>
            )}

            {mode === "per-order" && amount && selectedDebt && Number(amount) < selectedDebt.remaining && (
              <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                ⚠️ Thanh toán một phần. Còn lại:{" "}
                {formatCurrency(selectedDebt.remaining - Number(amount))}
              </p>
            )}
          </div>

          {/* Phương thức thanh toán */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Phương thức thanh toán
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank")}
                  className="w-4 h-4 text-slate-700"
                />
                <span className="text-slate-700 dark:text-slate-300">💵 Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank")}
                  className="w-4 h-4 text-slate-700"
                />
                <span className="text-slate-700 dark:text-slate-300">🏦 Chuyển khoản</span>
              </label>
            </div>
          </div>

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ghi chú (không bắt buộc)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              placeholder="Ghi chú thêm..."
            />
          </div>

          {/* Nút submit */}
          <button
            onClick={mode === "consolidated" ? handleConsolidatedSubmit : handleSubmit}
            disabled={
              mode === "consolidated"
                ? !selectedCustomerKey || !amount || Number(amount) <= 0
                : !selectedDebtId || !amount || Number(amount) <= 0
            }
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {mode === "consolidated"
              ? !selectedCustomerKey
                ? "Chọn khách hàng để thu"
                : !amount || Number(amount) <= 0
                  ? "Nhập số tiền cần thu"
                  : `💰 Thu gom nợ ${formatCurrency(Number(amount))}`
              : !selectedDebtId
                ? "Chọn đơn nợ để thu"
                : !amount || Number(amount) <= 0
                  ? "Nhập số tiền cần thu"
                  : `💰 Thu ${formatCurrency(Number(amount))}`}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
