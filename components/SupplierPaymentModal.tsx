import React, { useState, useRef } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction } from "../types";
import { XMarkIcon } from "./common/Icons";
import html2canvas from "html2canvas";

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
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<{
    supplierInfo: { name: string; debt: number };
    paidAmount: number;
    paymentDate: string;
    paymentMethod: string;
    remaining: number;
  } | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

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
        branchId: currentBranchId || "main",
        category: "supplier_payment",
      };

      await addCashTransaction(tx);
      showToast("Thành công", `Đã ghi nhận chi trả nợ ${new Intl.NumberFormat("vi-VN").format(Number(amount))} đồng cho ${supplier?.name || supplierQuery}`, "success");
      
      // Hiển thị phiếu thu thay vì đóng modal
      setReceiptData({
        supplierInfo: {
          name: supplier?.name || supplierQuery,
          debt: supplierDebt,
        },
        paidAmount: Number(amount),
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethod,
        remaining: Math.max(0, supplierDebt - Number(amount)),
      });
      setShowReceipt(true);
    } catch (error) {
      showToast("Lỗi", `Có lỗi xảy ra: ${(error as Error).message}`, "error");
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;

    try {
      setIsExporting(true);
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });

      canvas.toBlob(async (blob) => {
        if (blob) {
          const fileName = `Phieu_chi_${receiptData?.supplierInfo?.name?.replace(/\s+/g, "_") || "nha_cung_cap"}_${new Date().getTime()}.png`;
          const file = new File([blob], fileName, { type: "image/png" });

          // Check if Web Share API is supported with files
          if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            try {
              await navigator.share({
                files: [file],
                title: "Phiếu chi trả nợ NCC",
                text: `Phiếu chi: ${receiptData?.supplierInfo?.name}`,
              });
            } catch (err) {
              if ((err as Error).name !== "AbortError") {
                console.error("Error sharing:", err);
                // Fallback to download
                downloadBlob(blob, fileName);
              }
            }
          } else {
            // Fallback: download the image with instructions
            downloadBlob(blob, fileName);
            showToast(
              "Đã tải xuống",
              "Hình ảnh đã được tải xuống. Bạn có thể gửi file qua Zalo, Messenger hoặc Email.",
              "success"
            );
          }
        }
        setIsExporting(false);
      }, "image/png");
    } catch (error) {
      console.error("Error sharing:", error);
      showToast("Lỗi", "Lỗi khi chia sẻ. Vui lòng thử lại.", "error");
      setIsExporting(false);
    }
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCloseReceipt = () => {
    setShowReceipt(false);
    setReceiptData(null);
    setSupplierQuery("");
    setSelectedSupplierId("");
    setAmount("");
    setNotes("");
    onClose();
  };

  // Calculate remaining debt after payment
  const paidAmount = Number(amount) || 0;
  const remainingDebt = Math.max(0, supplierDebt - paidAmount);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

  // If showing receipt, render receipt modal instead
  if (showReceipt && receiptData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
          <div ref={receiptRef}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-black sticky top-0 bg-white dark:bg-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-black">
                Phiếu chi trả nợ
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
                  Phiếu chi trả nợ nhà cung cấp
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 print:text-black">
                  {new Date(receiptData.paymentDate).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 space-y-2 print:border-black">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Nhà cung cấp:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {receiptData.supplierInfo.name}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Tổng nợ trước:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {formatCurrency(receiptData.supplierInfo.debt)}
                  </span>
                </div>

                <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-700 pt-2 print:border-black">
                  <span className="text-red-600 dark:text-red-400 print:text-black">
                    Số tiền trả:
                  </span>
                  <span className="text-red-600 dark:text-red-400 print:text-black">
                    {formatCurrency(receiptData.paidAmount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Còn nợ:
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
                Cảm ơn!
              </div>
            </div>
          </div>

          {/* Footer with print and share buttons */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end print:hidden">
            <button
              onClick={handleCloseReceipt}
              className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
            >
              Đóng
            </button>
            <button
              onClick={handleShareReceipt}
              disabled={isExporting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              {isExporting ? "⏳ Đang xử lý..." : "📤 Chia sẻ"}
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
