import React, { useState, useEffect } from "react";
import type { PinSale, InstallmentPlan } from "../types";
import { InstallmentService } from "../lib/services/InstallmentService";

interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Omit<PinSale, "id" | "date" | "userId" | "userName">;
  total: number;
  onConfirm: (plan: InstallmentPlan, downPayment: number) => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

export default function InstallmentModal({
  isOpen,
  onClose,
  sale,
  total,
  onConfirm,
}: InstallmentModalProps) {
  const [downPayment, setDownPayment] = useState(0);
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [interestRate, setInterestRate] = useState(0);

  // Calculated values
  const remainingAmount = total - downPayment;
  const totalWithInterest = remainingAmount * (1 + (interestRate * numberOfInstallments) / 100);
  const monthlyPayment =
    numberOfInstallments > 0 ? Math.ceil(totalWithInterest / numberOfInstallments) : 0;
  const totalInterest = totalWithInterest - remainingAmount;

  useEffect(() => {
    if (isOpen) {
      // Default down payment = 30% of total
      setDownPayment(Math.round(total * 0.3));
      setNumberOfInstallments(3);
      setInterestRate(0);
    }
  }, [isOpen, total]);

  const handleConfirm = () => {
    if (downPayment < 0 || downPayment >= total) {
      alert("Số tiền đặt cọc phải từ 0 đến dưới tổng tiền!");
      return;
    }
    if (numberOfInstallments < 1 || numberOfInstallments > 24) {
      alert("Số kỳ trả góp phải từ 1 đến 24 tháng!");
      return;
    }

    // Create temporary sale object for InstallmentService
    const tempSale: PinSale = {
      ...sale,
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString(),
      userId: "",
      userName: "",
      total,
    };

    const plan = InstallmentService.createInstallmentPlan(
      tempSale,
      downPayment,
      numberOfInstallments,
      interestRate
    );

    onConfirm(plan, downPayment);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-4 rounded-t-xl">
          <h2 className="text-lg font-bold flex items-center gap-2">📅 Thiết lập Trả góp</h2>
          <p className="text-sm text-purple-100 mt-1">Tổng đơn hàng: {formatCurrency(total)}</p>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Down Payment */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              💵 Tiền đặt cọc / Trả trước
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={total - 1}
                value={downPayment}
                onChange={(e) => setDownPayment(Number(e.target.value) || 0)}
                className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right font-medium"
              />
              <span className="text-sm text-slate-500">VND</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[10, 20, 30, 50].map((percent) => (
                <button
                  key={percent}
                  onClick={() => setDownPayment(Math.round((total * percent) / 100))}
                  className="px-3 py-1 text-xs bg-slate-100 dark:bg-slate-700 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900/30"
                >
                  {percent}%
                </button>
              ))}
            </div>
          </div>

          {/* Number of Installments */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              📆 Số kỳ trả góp (tháng)
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[3, 6, 9, 12].map((months) => (
                <button
                  key={months}
                  onClick={() => setNumberOfInstallments(months)}
                  className={`p-3 rounded-lg font-medium transition-all ${
                    numberOfInstallments === months
                      ? "bg-purple-600 text-white"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-purple-100"
                  }`}
                >
                  {months} tháng
                </button>
              ))}
            </div>
            <input
              type="number"
              min={1}
              max={24}
              value={numberOfInstallments}
              onChange={(e) => setNumberOfInstallments(Number(e.target.value) || 1)}
              className="w-full mt-2 p-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center"
              placeholder="Hoặc nhập số tháng khác"
            />
          </div>

          {/* Interest Rate */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              📊 Lãi suất (% / tháng)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
                className="flex-1 p-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center font-medium"
              />
              <span className="text-sm text-slate-500">% / tháng</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Để 0 nếu không tính lãi (trả góp 0%)</p>
          </div>

          {/* Summary */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-700">
            <h3 className="font-semibold text-purple-800 dark:text-purple-300 mb-3">
              📋 Tóm tắt kế hoạch trả góp
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Tổng đơn hàng:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Đặt cọc:</span>
                <span className="font-medium text-green-600">{formatCurrency(downPayment)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Còn lại:</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">
                  {formatCurrency(remainingAmount)}
                </span>
              </div>
              {interestRate > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>
                    Lãi ({interestRate}% x {numberOfInstallments} tháng):
                  </span>
                  <span className="font-medium">+{formatCurrency(totalInterest)}</span>
                </div>
              )}
              <div className="border-t border-purple-200 dark:border-purple-700 pt-2 mt-2">
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">Tổng phải trả:</span>
                  <span className="font-bold text-purple-700 dark:text-purple-300">
                    {formatCurrency(totalWithInterest)}
                  </span>
                </div>
                <div className="flex justify-between text-lg mt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Mỗi tháng:
                  </span>
                  <span className="font-bold text-red-600">{formatCurrency(monthlyPayment)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Schedule Preview */}
          <div className="max-h-40 overflow-y-auto">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              📅 Lịch thanh toán
            </h4>
            <div className="space-y-1">
              {Array.from({ length: numberOfInstallments }, (_, i) => {
                const dueDate = new Date();
                dueDate.setMonth(dueDate.getMonth() + i + 1);
                const isLast = i === numberOfInstallments - 1;
                const amount = isLast
                  ? totalWithInterest - monthlyPayment * (numberOfInstallments - 1)
                  : monthlyPayment;
                return (
                  <div
                    key={i}
                    className="flex justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-700"
                  >
                    <span className="text-slate-600 dark:text-slate-400">
                      Kỳ {i + 1}: {dueDate.toLocaleDateString("vi-VN")}
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatCurrency(amount)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleConfirm}
            disabled={downPayment >= total || numberOfInstallments < 1}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg font-medium hover:from-purple-700 hover:to-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ✓ Xác nhận trả góp
          </button>
        </div>
      </div>
    </div>
  );
}
