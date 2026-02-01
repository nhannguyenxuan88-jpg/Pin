import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction, PinSale, PinRepairOrder } from "../types";
import { XMarkIcon } from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

type Props = {
  open: boolean;
  onClose: () => void;
  preSelectedDebtId?: string; // ID của công nợ đã được chọn từ danh sách
};

export default function DebtCollectionModal({ open, onClose, preSelectedDebtId }: Props) {
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

  const [selectedDebtId, setSelectedDebtId] = useState("");
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
  } | null>(null);

  // Tự động chọn công nợ khi mở modal với preSelectedDebtId
  useEffect(() => {
    if (open && preSelectedDebtId) {
      setSelectedDebtId(preSelectedDebtId);
      setAmount(""); // Reset amount để user nhập lại
    } else if (!open) {
      // Reset khi đóng modal
      setSelectedDebtId("");
      setAmount("");
      setNotes("");
    }
  }, [open, preSelectedDebtId]);

  // Lấy danh sách các đơn hàng/sửa chữa còn nợ
  const pendingDebts = useMemo(() => {
    const debts: Array<{
      id: string;
      type: "sale" | "repair";
      customerName: string;
      total: number;
      paidAmount: number;
      remaining: number;
      date: string;
      code?: string;
    }> = [];

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
        const paidAmt = order.partialPaymentAmount || order.depositAmount || 0;
        const remaining = order.total - paidAmt;
        if (remaining > 0) {
          debts.push({
            id: order.id,
            type: "repair",
            customerName: order.customerName || "Khách lẻ",
            total: order.total,
            paidAmount: paidAmt,
            remaining,
            date: order.creationDate,
          });
        }
      }
    });

    return debts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [pinSales, pinRepairOrders]);

  const selectedDebt = pendingDebts.find((d) => d.id === selectedDebtId);

  if (!open) return null;

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
    if (selectedDebt) {
      setAmount(String(selectedDebt.remaining));
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
        <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md mx-4 shadow-xl">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-black">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-black">
              Phiếu thu tiền
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
                Phiếu thu tiền nợ
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
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">Loại:</span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {receiptData.debtInfo.type === "sale" ? "Đơn hàng" : "Sửa chữa"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Tổng nợ:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {formatCurrency(receiptData.debtInfo.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400 print:text-black">
                  Đã trả trước:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                  {formatCurrency(receiptData.debtInfo.paidAmount)}
                </span>
              </div>
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
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg mx-4 shadow-xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
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
          {/* Danh sách đơn nợ */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Chọn đơn nợ cần thu
            </label>
            <select
              value={selectedDebtId}
              onChange={(e) => {
                setSelectedDebtId(e.target.value);
                setAmount(""); // Reset amount khi chọn đơn mới
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

          {/* Thông tin đơn đã chọn */}
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

          {/* Số tiền thanh toán */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Số tiền thanh toán
              </label>
              {selectedDebt && (
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
              placeholder="Nhập số tiền..."
              min={0}
              max={selectedDebt?.remaining || undefined}
            />
            {amount && selectedDebt && Number(amount) < selectedDebt.remaining && (
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
                <span className="text-slate-700 dark:text-slate-300">Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value as "cash" | "bank")}
                  className="w-4 h-4 text-slate-700"
                />
                <span className="text-slate-700 dark:text-slate-300">Chuyển khoản</span>
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
            onClick={handleSubmit}
            disabled={!selectedDebtId || !amount || Number(amount) <= 0}
            className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {!selectedDebtId
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
