import React, { useEffect, useState } from "react";
import type { PinRepairOrder, PinRepairMaterial, OutsourcingItem } from "../../types";
import type { BusinessSettings } from "../../types/business";
import { BusinessSettingsService } from "../../lib/services/BusinessSettingsService";

interface RepairInvoiceTemplateProps {
  repairOrder: PinRepairOrder;
  onClose?: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " đ";

const formatDate = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
};

const formatDateTime = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")} ${formatDate(d)}`;
};

const formatUserName = (name: string | undefined) => {
  if (!name) return "";
  if (name.includes("@")) {
    const [localPart] = name.split("@");
    return localPart.charAt(0).toUpperCase() + localPart.slice(1);
  }
  return name;
};

export default function RepairInvoiceTemplate({
  repairOrder,
  onClose,
}: RepairInvoiceTemplateProps) {
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load business settings from Supabase
    const loadSettings = async () => {
      setIsLoading(true);
      const saved = await BusinessSettingsService.getSettings();
      if (saved) {
        setBusinessSettings(saved);
      }
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  // Parse outsourcingItems from notes field if stored there
  let outsourcingItems: any[] = repairOrder.outsourcingItems || [];
  if (repairOrder.notes && repairOrder.notes.includes("__OUTSOURCING__")) {
    try {
      const parts = repairOrder.notes.split("__OUTSOURCING__");
      if (parts[1]) {
        outsourcingItems = JSON.parse(parts[1]);
      }
    } catch (e) {
      console.warn("Failed to parse outsourcing items from notes");
    }
  }

  // Calculate totals from actual data
  const materialsCost =
    repairOrder.materialsUsed?.reduce((sum, mat) => sum + mat.price * mat.quantity, 0) || 0;
  const outsourcingCost = outsourcingItems.reduce(
    (sum, item) => sum + (item.sellingPrice || item.price || 0) * (item.quantity || 1),
    0
  );
  const laborCost = repairOrder.laborCost || 0;
  const total = repairOrder.total || 0;

  // Số tiền đã thanh toán: ưu tiên depositAmount, sau đó partialPaymentAmount
  // Nếu paymentStatus = "paid" thì đã thanh toán hết
  const paidAmount =
    repairOrder.paymentStatus === "paid"
      ? total
      : (repairOrder.depositAmount || 0) + (repairOrder.partialPaymentAmount || 0);

  // Còn nợ
  const remainingAmount = total - paidAmount;

  if (isLoading) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-800">Đang tải thông tin doanh nghiệp...</p>
      </div>
    );
  }

  if (!businessSettings) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-800">Vui lòng cấu hình thông tin doanh nghiệp trong phần Cài đặt</p>
        <a href="#/business-settings" className="text-blue-600 underline mt-2 inline-block">
          Đi đến Cài đặt
        </a>
      </div>
    );
  }

  // A5 size for print: 148mm x 210mm, responsive for mobile
  return (
    <div
      className="bg-white text-gray-900 mx-auto w-full max-w-[148mm] print:w-[148mm] px-2 py-2 sm:p-4 print:p-4"
      style={{
        fontFamily: "Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      {/* Header with Logo, Business Info, Bank Info and QR */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-2 sm:gap-3 mb-3 sm:mb-4 pb-2 sm:pb-3 border-b-2 border-gray-300">
        {/* Left: Logo and Business Info */}
        <div className="flex items-start gap-2">
          {businessSettings.logoUrl && (
            <img
              src={businessSettings.logoUrl}
              alt="Logo"
              className="w-10 h-10 sm:w-12 sm:h-12 object-contain rounded"
            />
          )}
          <div>
            <h1 className="text-sm sm:text-base font-bold text-green-700">{businessSettings.businessName}</h1>
            <div className="text-[9px] sm:text-[10px] text-gray-700 space-y-0.5 mt-0.5">
              <p>📍 {businessSettings.address}</p>
              <p>📞 {businessSettings.phone}</p>
            </div>
          </div>
        </div>

        {/* Right: Bank Info and QR - Mobile: row with QR left, info right */}
        {businessSettings.bankAccount && (
          <div className="flex items-center gap-2 w-full sm:w-auto mt-1 sm:mt-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-gray-200">
            {/* QR Code - show on left for mobile */}
            {businessSettings.bankQRUrl && (
              <img
                src={businessSettings.bankQRUrl}
                alt="QR Payment"
                className="w-12 h-12 sm:w-14 sm:h-14 rounded border border-gray-300 flex-shrink-0"
              />
            )}
            {/* Bank Info */}
            <div className="text-left sm:text-right text-[9px] sm:text-[10px] flex-1">
              <p className="font-bold text-green-700">🏦 {businessSettings.bankName}</p>
              <p>
                STK: <span className="font-bold text-blue-700">{businessSettings.bankAccount}</span>
              </p>
              <p className="text-gray-700">{businessSettings.bankAccountName}</p>
            </div>
          </div>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-2 sm:mb-3">
        <h2 className="text-base sm:text-lg font-bold text-blue-700 tracking-wide">PHIẾU DỊCH VỤ SỬA CHỮA</h2>
        <div className="flex flex-col sm:flex-row justify-center items-center gap-1 sm:gap-4 mt-1 text-[10px] sm:text-[11px] text-gray-700">
          <span>
            {formatDateTime(repairOrder.creationDate || repairOrder.created_at || new Date())}
          </span>
          <span>
            Mã: <span className="font-bold text-blue-700">{repairOrder.id}</span>
          </span>
        </div>
      </div>

      {/* Customer Info Box */}
      <div className="bg-gray-100 rounded p-2 mb-2 sm:mb-3 border border-gray-300">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-x-4 sm:gap-y-1 text-[10px] sm:text-[11px]">
          <div>
            <span className="text-gray-600">Khách hàng:</span>{" "}
            <span className="font-semibold text-gray-900">{repairOrder.customerName || "N/A"}</span>
          </div>
          <div>
            <span className="text-gray-600">SĐT:</span>{" "}
            <span className="font-semibold text-gray-900">
              {repairOrder.customerPhone || "N/A"}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Thiết bị:</span>{" "}
            <span className="font-semibold text-gray-900">{repairOrder.deviceName || "N/A"}</span>
          </div>
          <div>
            <span className="text-gray-600">Trạng thái:</span>{" "}
            <span className="font-semibold text-gray-900">{repairOrder.status || "N/A"}</span>
          </div>
        </div>
      </div>

      {/* Issue Description */}
      <div className="mb-2 sm:mb-3">
        <div className="flex flex-col sm:flex-row items-start gap-1 text-[10px] sm:text-[11px]">
          <span className="font-semibold text-gray-800 whitespace-nowrap">Mô tả sự cố:</span>
          <span className="bg-gray-100 px-2 py-1 rounded w-full sm:flex-1 text-gray-900 border border-gray-300">
            {repairOrder.issueDescription || "Không có mô tả"}
          </span>
        </div>
      </div>

      {/* Materials/Parts Table - Only show if has materials */}
      {repairOrder.materialsUsed && repairOrder.materialsUsed.length > 0 && (
        <div className="mb-2 sm:mb-3">
          <p className="text-[10px] sm:text-[11px] font-bold text-gray-800 mb-1">Vật liệu sử dụng:</p>
          <table className="w-full text-[9px] sm:text-[10px] border-collapse">
            <thead>
              <tr className="bg-gray-200">
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-left font-bold text-gray-900">
                  Vật liệu
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-center font-bold text-gray-900 w-8 sm:w-10">
                  SL
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-bold text-gray-900 w-16 sm:w-20">
                  Đơn giá
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-bold text-gray-900 w-18 sm:w-24">
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {repairOrder.materialsUsed.map((mat: PinRepairMaterial) => (
                <tr key={mat.materialId || `mat-${mat.materialName}`}>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-gray-900">
                    {mat.materialName}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-center text-gray-900">
                    {mat.quantity}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-right text-gray-900">
                    {formatCurrency(mat.price)}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-semibold text-gray-900">
                    {formatCurrency(mat.price * mat.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Outsourcing/Linh kiện thay thế Table */}
      {outsourcingItems.length > 0 && (
        <div className="mb-2 sm:mb-3">
          <p className="text-[10px] sm:text-[11px] font-bold text-gray-800 mb-1">Linh kiện thay thế:</p>
          <table className="w-full text-[9px] sm:text-[10px] border-collapse">
            <thead>
              <tr className="bg-blue-100">
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-left font-bold text-gray-900">
                  Tên linh kiện
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-center font-bold text-gray-900 w-8 sm:w-10">
                  SL
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-bold text-gray-900 w-16 sm:w-20">
                  Đơn giá
                </th>
                <th className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-bold text-gray-900 w-18 sm:w-24">
                  Thành tiền
                </th>
              </tr>
            </thead>
            <tbody>
              {outsourcingItems.map((item: OutsourcingItem, index: number) => (
                <tr key={`outsource-${index}-${item.description}`}>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-gray-900">
                    {item.description}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-center text-gray-900">
                    {item.quantity || 1}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-right text-gray-900">
                    {formatCurrency(item.sellingPrice || 0)}
                  </td>
                  <td className="border border-gray-400 px-1 sm:px-2 py-1 text-right font-semibold text-gray-900">
                    {formatCurrency((item.sellingPrice || 0) * (item.quantity || 1))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Box */}
      <div className="bg-white border-2 border-gray-400 rounded p-2 sm:p-3 mb-2 sm:mb-3">
        <div className="space-y-1 text-[10px] sm:text-[11px]">
          {materialsCost > 0 && (
            <div className="flex justify-between">
              <span className="font-semibold text-gray-800">Tiền vật liệu:</span>
              <span className="text-right font-semibold text-blue-700">
                {formatCurrency(materialsCost)}
              </span>
            </div>
          )}
          {outsourcingCost > 0 && (
            <div className="flex justify-between">
              <span className="font-semibold text-gray-800">Linh kiện:</span>
              <span className="text-right font-semibold text-blue-700">
                {formatCurrency(outsourcingCost)}
              </span>
            </div>
          )}
          {laborCost > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-700">Tiền công:</span>
              <span className="text-right text-blue-700">{formatCurrency(laborCost)}</span>
            </div>
          )}
          <div className="flex justify-between pt-1 border-t-2 border-gray-400 text-xs sm:text-sm font-bold">
            <span className="text-gray-900">TỔNG CỘNG:</span>
            <span className="text-red-600 text-base">{formatCurrency(total)}</span>
          </div>
          <div className="flex justify-between pt-0.5">
            <span className="text-gray-700">Đã thanh toán:</span>
            <span className="text-right font-semibold text-green-700">
              {formatCurrency(paidAmount)}
            </span>
          </div>
          {remainingAmount > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-700">Còn nợ:</span>
              <span className="text-right font-semibold text-red-600">
                {formatCurrency(remainingAmount)}
              </span>
            </div>
          )}
          {repairOrder.paymentStatus === "paid" && (
            <div className="text-center text-green-700 font-semibold mt-1">✓ Đã thanh toán đủ</div>
          )}
          <div className="flex justify-between text-[10px] pt-1">
            <span className="text-gray-700">Hình thức:</span>
            <span className="text-right text-gray-900">
              {repairOrder.paymentMethod === "bank" || repairOrder.paymentMethod === "transfer"
                ? "Chuyển khoản"
                : repairOrder.paymentMethod === "card"
                  ? "Thẻ"
                  : "Tiền mặt"}
            </span>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 text-center text-[11px] mt-4 pt-3 border-t border-gray-300">
        <div>
          <p className="font-bold text-gray-900">Khách hàng</p>
          <p className="text-[10px] text-gray-600">(Ký và ghi rõ họ tên)</p>
          <div className="h-10"></div>
        </div>
        <div>
          <p className="font-bold text-gray-900">Nhân viên</p>
          <p className="text-[10px] text-gray-800">{formatUserName(repairOrder.technicianName)}</p>
          <div className="h-10"></div>
        </div>
      </div>

      {/* Footer Note */}
      {businessSettings.invoiceFooterNote && (
        <div className="mt-3 p-2 bg-yellow-50 border border-yellow-400 rounded text-center text-[10px] text-gray-800">
          {businessSettings.invoiceFooterNote}
        </div>
      )}
    </div>
  );
}
