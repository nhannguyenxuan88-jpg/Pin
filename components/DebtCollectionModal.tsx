import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction } from "../types";
import { XMarkIcon } from "./common/Icons";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function DebtCollectionModal({ open, onClose }: Props) {
  const ctx = usePinContext();
  const currentUser = ctx.currentUser;
  const currentBranchId = (ctx as any).currentBranchId;
  const addCashTransaction = ctx.addCashTransaction;
  const workOrders = (ctx as any).workOrders || [];
  const sales = ctx.pinSales || [];

  const [customerQuery, setCustomerQuery] = useState("");
  const [selectedOrderId, setSelectedOrderId] = useState("");
  const [orderType, setOrderType] = useState<"workorder" | "sale">("workorder");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  if (!open) return null;

  const handleSubmit = async () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập");
      return;
    }
    if (!selectedOrderId || !amount || Number(amount) <= 0) {
      alert("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    const tx: CashTransaction = {
      id: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: "income",
      date: new Date().toISOString(),
      amount: Number(amount),
      contact: { id: customerQuery, name: customerQuery },
      notes:
        notes ||
        `Thu nợ cho ${
          orderType === "workorder" ? "đơn sửa chữa" : "đơn hàng"
        } #${selectedOrderId}`,
      paymentSourceId: paymentMethod,
      branchId: currentBranchId,
      category: orderType === "workorder" ? "service_income" : "sale_income",
      ...(orderType === "workorder"
        ? { workOrderId: selectedOrderId }
        : { saleId: selectedOrderId }),
    };

    await addCashTransaction(tx);
    alert("Đã ghi nhận thu nợ");
    setCustomerQuery("");
    setSelectedOrderId("");
    setAmount("");
    setNotes("");
    onClose();
  };

  const remainingDebt = amount ? Math.max(0, Number(amount) - 0) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">
            Thu nợ khách hàng
          </h3>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Tìm kiếm và chọn một khách hàng đang nợ
            </label>
            <select
              value={selectedOrderId}
              onChange={(e) => {
                setSelectedOrderId(e.target.value);
                // Parse customer info from selection if needed
              }}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="">Chọn khách hàng...</option>
              <option value="demo1">A nhi • Nợ: 250.000 ₫</option>
              <option value="demo2">Khách hàng khác • Nợ: 500.000 ₫</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-slate-300">
                Nhập số tiền thanh toán
              </label>
              <span className="text-sm text-sky-400">0 ₫</span>
            </div>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-sky-500"
              placeholder="0"
            />
            <div className="flex items-center justify-between mt-2 text-sm">
              <span className="text-slate-400">Còn nợ:</span>
              <span className="text-rose-400 font-medium">
                {new Intl.NumberFormat("vi-VN").format(remainingDebt)} ₫
              </span>
            </div>
            <button
              onClick={() => setAmount("250000")}
              className="mt-2 text-sm text-sky-400 hover:text-sky-300"
            >
              Điền số còn nợ
            </button>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Hình thức thanh toán:
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  value="cash"
                  checked={paymentMethod === "cash"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-4 h-4 text-sky-600"
                />
                <span>Tiền mặt</span>
              </label>
              <label className="flex items-center gap-2 text-slate-300">
                <input
                  type="radio"
                  value="bank"
                  checked={paymentMethod === "bank"}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-4 h-4 text-sky-600"
                />
                <span>Khác</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Thời gian tạo phiếu thu
            </label>
            <input
              type="text"
              value={new Date().toLocaleString("vi-VN")}
              readOnly
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded text-slate-400"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedOrderId || !amount || Number(amount) <= 0}
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded transition-colors"
          >
            Tạo phiếu thu
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-slate-100 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
