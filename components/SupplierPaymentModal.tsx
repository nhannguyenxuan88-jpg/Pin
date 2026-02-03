import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction } from "../types";
import { XMarkIcon } from "./common/Icons";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function SupplierPaymentModal({ open, onClose }: Props) {
  const ctx = usePinContext();
  const currentUser = ctx.currentUser;
  const currentBranchId = ctx.currentBranchId;
  const addCashTransaction = ctx.addCashTransaction;
  const suppliers = ctx.suppliers || [];
  const addToast = ctx.addToast;

  // Toast helper
  const showToast = (title: string, message: string, type: "success" | "error" | "warn" = "success") => {
    addToast?.({ id: crypto.randomUUID(), message: `${title}: ${message}`, type });
  };

  const [supplierQuery, setSupplierQuery] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");

  // Get selected supplier with proper debt info
  const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);
  const supplierDebt = selectedSupplier?.debt || 0;

  if (!open) return null;

  const handleSubmit = async () => {
    if (!currentUser) {
      showToast("Lỗi", "Vui lòng đăng nhập", "error");
      return;
    }
    if (!selectedSupplierId || !amount || Number(amount) <= 0) {
      showToast("Thiếu thông tin", "Vui lòng nhập đầy đủ thông tin", "warn");
      return;
    }

    try {
      const supplier = suppliers.find((s) => s.id === selectedSupplierId);
      const tx: CashTransaction = {
        id: crypto.randomUUID(),
        type: "expense",
        date: new Date().toISOString(),
        amount: -Math.abs(Number(amount)), // Đảm bảo số âm cho chi
        contact: {
          id: selectedSupplierId,
          name: supplier?.name || supplierQuery,
        },
        notes: notes || `Thanh toán NCC: ${supplier?.name || supplierQuery} #app:pincorp`,
        paymentSourceId: paymentMethod,
        branchId: currentBranchId,
        category: "supplier_payment",
      };

      await addCashTransaction(tx);
      showToast("Thành công", `Đã ghi nhận chi trả nợ ${new Intl.NumberFormat("vi-VN").format(Number(amount))} đồng cho ${supplier?.name || supplierQuery}`, "success");
      setSupplierQuery("");
      setSelectedSupplierId("");
      setAmount("");
      setNotes("");
      onClose();
    } catch (error) {
      showToast("Lỗi", `Có lỗi xảy ra: ${(error as Error).message}`, "error");
    }
  };

  // Calculate remaining debt after payment
  const paidAmount = Number(amount) || 0;
  const remainingDebt = Math.max(0, supplierDebt - paidAmount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-800 rounded-lg w-full max-w-lg mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100">Chi trả nợ nhà cung cấp</h3>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-300 mb-2">
              Tìm kiếm và chọn một nhà cung cấp đang nợ
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => {
                setSelectedSupplierId(e.target.value);
                const supplier = suppliers.find((s) => s.id === e.target.value);
                if (supplier) setSupplierQuery(supplier.name);
              }}
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded text-slate-100 focus:outline-none focus:border-sky-500"
            >
              <option value="">Chọn nhà cung cấp...</option>
              {suppliers.map((sup) => (
                <option key={sup.id} value={sup.id}>
                  {sup.name} • Nợ: {new Intl.NumberFormat("vi-VN").format(sup.debt || 0)} ₫
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm text-slate-300">Nhập số tiền thanh toán</label>
              <span className="text-sm text-sky-400">
                Nợ hiện tại: {new Intl.NumberFormat("vi-VN").format(supplierDebt)} đồng
              </span>
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
              onClick={() => {
                // Set to full debt amount from selected supplier
                if (supplierDebt > 0) {
                  setAmount(String(supplierDebt));
                }
              }}
              disabled={!selectedSupplierId || supplierDebt <= 0}
              className="mt-2 text-sm text-sky-400 hover:text-sky-300 disabled:text-slate-500 disabled:cursor-not-allowed"
            >
              Điền số còn nợ
            </button>
          </div>

          <div>
            <label className="block text-sm text-slate-300 mb-2">Hình thức thanh toán:</label>
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
            <label className="block text-sm text-slate-300 mb-2">Thời gian tạo phiếu chi</label>
            <input
              type="text"
              value={new Date().toLocaleString("vi-VN")}
              readOnly
              className="w-full px-3 py-2.5 bg-slate-900 border border-slate-700 rounded text-slate-400"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedSupplierId || !amount || Number(amount) <= 0}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-700 disabled:text-slate-500 text-white font-medium rounded transition-colors"
          >
            Tạo phiếu chi
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
