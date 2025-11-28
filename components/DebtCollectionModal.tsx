import React, { useState, useMemo } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction, PinSale, PinRepairOrder } from "../types";
import { XMarkIcon } from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DebtCollectionModal({ open, onClose }: Props) {
  const ctx = usePinContext();
  const currentUser = ctx.currentUser;
  const currentBranchId = (ctx as any).currentBranchId || "main";
  const addCashTransaction = ctx.addCashTransaction;
  const pinSales = ctx.pinSales || [];
  const pinRepairOrders = ctx.pinRepairOrders || [];
  const updatePinSale = ctx.updatePinSale;
  const upsertPinRepairOrder = ctx.upsertPinRepairOrder;

  const [selectedDebtId, setSelectedDebtId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");

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

    return debts.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [pinSales, pinRepairOrders]);

  const selectedDebt = pendingDebts.find((d) => d.id === selectedDebtId);

  if (!open) return null;

  const handleSubmit = async () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập");
      return;
    }
    if (!selectedDebtId || !amount || Number(amount) <= 0) {
      alert("Vui lòng chọn đơn nợ và nhập số tiền thanh toán");
      return;
    }

    const payAmount = Number(amount);
    if (!selectedDebt) {
      alert("Không tìm thấy thông tin nợ");
      return;
    }

    // Kiểm tra số tiền không vượt quá số nợ còn lại
    if (payAmount > selectedDebt.remaining) {
      alert(
        `Số tiền thanh toán không được vượt quá số nợ còn lại (${formatCurrency(
          selectedDebt.remaining
        )})`
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
      category:
        selectedDebt.type === "repair" ? "service_income" : "sale_income",
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
        const repair = pinRepairOrders.find(
          (r: PinRepairOrder) => r.id === selectedDebtId
        );
        if (repair) {
          await upsertPinRepairOrder({
            ...repair,
            partialPaymentAmount: newPaidAmount,
            paymentStatus: isFullyPaid ? "paid" : "partial",
            paymentMethod: paymentMethod,
            paymentDate: new Date().toISOString(),
          });
        }
      }

      alert(
        isFullyPaid
          ? `Đã thanh toán đủ ${formatCurrency(payAmount)}. Đơn đã hoàn tất!`
          : `Đã thu ${formatCurrency(payAmount)}. Còn nợ ${formatCurrency(
              selectedDebt.total - newPaidAmount
            )}`
      );

      // Reset form
      setSelectedDebtId("");
      setAmount("");
      setNotes("");
      onClose();
    } catch (error) {
      alert("Lỗi khi ghi nhận thu nợ: " + (error as Error).message);
    }
  };

  const handleFillRemaining = () => {
    if (selectedDebt) {
      setAmount(String(selectedDebt.remaining));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            💰 Thu nợ khách hàng
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
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
                  {debt.customerName} •{" "}
                  {debt.type === "sale" ? "Đơn hàng" : "Sửa chữa"} • Nợ:{" "}
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
                <span className="text-slate-600 dark:text-slate-400">
                  Khách hàng:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {selectedDebt.customerName}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Tổng tiền:
                </span>
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {formatCurrency(selectedDebt.total)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  Đã thanh toán:
                </span>
                <span className="font-medium text-green-600 dark:text-green-400">
                  {formatCurrency(selectedDebt.paidAmount)}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t border-slate-200 dark:border-slate-600 pt-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  Còn nợ:
                </span>
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
            {amount &&
              selectedDebt &&
              Number(amount) < selectedDebt.remaining && (
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
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-sky-600"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  💵 Tiền mặt
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as "cash" | "bank")
                  }
                  className="w-4 h-4 text-sky-600"
                />
                <span className="text-slate-700 dark:text-slate-300">
                  🏦 Chuyển khoản
                </span>
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
            className="w-full py-3 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-500 text-white font-semibold rounded-lg transition-all shadow-lg disabled:shadow-none disabled:cursor-not-allowed"
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
