import React, { useEffect, useState } from "react";
import type { PinSale, InstallmentPlan } from "../../types";
import type { BusinessSettings } from "../../types/business";

interface SalesInvoiceTemplateProps {
  sale: PinSale;
  onClose?: () => void;
}

const formatCurrency = (amount: number) => new Intl.NumberFormat("vi-VN").format(amount) + " đ";

const formatDateTime = (date: string | Date) => {
  const d = new Date(date);
  return `${d.getHours().toString().padStart(2, "0")}:${d
    .getMinutes()
    .toString()
    .padStart(2, "0")} ${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
};

export default function SalesInvoiceTemplate({ sale, onClose }: SalesInvoiceTemplateProps) {
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlan | null>(
    sale.installmentPlan || null
  );

  useEffect(() => {
    // Load business settings
    const saved = localStorage.getItem("businessSettings");
    if (saved) {
      setBusinessSettings(JSON.parse(saved));
    }

    // Load installment plan if sale is installment but plan not in props
    if ((sale.isInstallment || sale.paymentStatus === "installment") && !sale.installmentPlan) {
      const savedPlans = localStorage.getItem("installment_plans");
      if (savedPlans) {
        const plans: InstallmentPlan[] = JSON.parse(savedPlans);
        const plan = plans.find((p) => p.saleId === sale.id);
        if (plan) {
          setInstallmentPlan(plan);
        }
      }
    }
  }, [sale]);

  // Check if this is an installment sale
  const isInstallmentSale = sale.isInstallment || sale.paymentStatus === "installment";

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

  // A5 size: 148mm x 210mm
  return (
    <div
      className="bg-white text-gray-900 mx-auto"
      style={{
        fontFamily: "Arial, sans-serif",
        width: "148mm",
        minHeight: "210mm",
        padding: "8mm",
        boxSizing: "border-box",
      }}
    >
      {/* Header with logo and business info */}
      <div className="flex items-start justify-between gap-3 mb-4 pb-3 border-b-2 border-gray-300">
        {/* Left: Logo and Business Info */}
        <div className="flex items-start gap-2">
          {businessSettings.logoUrl && (
            <img
              src={businessSettings.logoUrl}
              alt="Logo"
              className="w-12 h-12 object-contain rounded"
            />
          )}
          <div>
            <h1 className="text-base font-bold text-green-700">{businessSettings.businessName}</h1>
            <div className="text-[10px] text-gray-700 space-y-0.5 mt-0.5">
              <p>📍 {businessSettings.address}</p>
              <p>📞 {businessSettings.phone}</p>
            </div>
          </div>
        </div>

        {/* Right: Bank Info and QR */}
        {businessSettings.bankAccount && (
          <div className="flex items-start gap-2">
            <div className="text-right text-[10px]">
              <p className="font-bold text-green-700">🏦 {businessSettings.bankName}</p>
              <p>
                STK: <span className="font-bold text-blue-700">{businessSettings.bankAccount}</span>
              </p>
              <p className="text-gray-700">{businessSettings.bankAccountName}</p>
            </div>
            {businessSettings.bankQRUrl && (
              <img
                src={businessSettings.bankQRUrl}
                alt="QR Payment"
                className="w-14 h-14 rounded border border-gray-300"
              />
            )}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="text-center mb-3">
        <h2 className="text-lg font-bold text-gray-900 tracking-wide">HÓA ĐƠN BÁN HÀNG</h2>
        <div className="flex justify-center items-center gap-4 mt-1 text-[11px] text-gray-700">
          <span>{formatDateTime(sale.date)}</span>
          <span>
            Mã: <span className="font-bold text-blue-700">{sale.code || sale.id}</span>
          </span>
        </div>
      </div>

      {/* Customer info */}
      <div className="bg-gray-100 rounded p-2 mb-3 border border-gray-300">
        <div className="grid grid-cols-2 gap-1 text-[11px]">
          <div>
            <span className="text-gray-600">KH:</span>{" "}
            <span className="font-semibold text-gray-900">{sale.customer?.name || "Khách lẻ"}</span>
          </div>
          <div>
            <span className="text-gray-600">SĐT:</span>{" "}
            <span className="font-semibold text-gray-900">{sale.customer?.phone || "N/A"}</span>
          </div>
          {sale.customer?.address && (
            <div className="col-span-2">
              <span className="text-gray-600">Địa chỉ:</span>{" "}
              <span className="text-gray-900">{sale.customer.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="mb-3">
        <table className="w-full text-[11px] border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-gray-400 py-1.5 px-1 text-left font-bold text-gray-900">
                Sản phẩm
              </th>
              <th className="border border-gray-400 py-1.5 px-1 text-center font-bold text-gray-900 w-10">
                SL
              </th>
              <th className="border border-gray-400 py-1.5 px-1 text-right font-bold text-gray-900 w-20">
                Đơn giá
              </th>
              <th className="border border-gray-400 py-1.5 px-1 text-right font-bold text-gray-900 w-24">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, index) => (
              <tr key={index}>
                <td className="border border-gray-400 py-1.5 px-1 text-gray-900">{item.name}</td>
                <td className="border border-gray-400 py-1.5 px-1 text-center text-gray-900">
                  {item.quantity}
                </td>
                <td className="border border-gray-400 py-1.5 px-1 text-right text-gray-900">
                  {formatCurrency(item.sellingPrice)}
                </td>
                <td className="border border-gray-400 py-1.5 px-1 text-right font-semibold text-gray-900">
                  {formatCurrency(item.sellingPrice * item.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="border-2 border-gray-400 rounded p-3 mb-3">
        {sale.discount > 0 && (
          <>
            <div className="flex justify-between items-center text-[11px] mb-1">
              <span className="text-gray-700">Tạm tính:</span>
              <span className="text-gray-900">{formatCurrency(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between items-center text-[11px] mb-1 text-green-700">
              <span>Giảm giá:</span>
              <span>-{formatCurrency(sale.discount)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center pt-1 border-t border-gray-300">
          <span className="text-sm font-bold text-gray-900">TỔNG CỘNG:</span>
          <span className="text-lg font-bold text-red-600">{formatCurrency(sale.total)}</span>
        </div>
      </div>

      {/* Installment Info */}
      {isInstallmentSale && installmentPlan && (
        <div className="border-2 border-purple-400 rounded p-3 mb-3 bg-purple-50">
          <div className="text-center font-bold text-purple-700 mb-2 text-sm">
            📅 THÔNG TIN TRẢ GÓP
          </div>
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between">
              <span className="text-gray-700">Trả trước:</span>
              <span className="font-semibold text-green-700">
                {formatCurrency(installmentPlan.downPayment)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Số kỳ:</span>
              <span className="font-semibold text-gray-900">
                {installmentPlan.numberOfInstallments} tháng
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Còn phải trả:</span>
              <span className="font-semibold text-red-600">
                {formatCurrency(installmentPlan.remainingAmount)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-700">Mỗi tháng:</span>
              <span className="font-semibold text-blue-700">
                {formatCurrency(installmentPlan.monthlyPayment)}
              </span>
            </div>
            {(installmentPlan.interestRate ?? 0) > 0 && (
              <div className="col-span-2 flex justify-between border-t border-purple-300 pt-1 mt-1">
                <span className="text-gray-700">Lãi suất:</span>
                <span className="font-semibold text-orange-600">
                  {installmentPlan.interestRate}% / tháng
                </span>
              </div>
            )}
          </div>
          {installmentPlan.startDate && installmentPlan.endDate && (
            <div className="mt-2 pt-2 border-t border-purple-300 text-center text-[10px] text-purple-700">
              Ngày bắt đầu: {new Date(installmentPlan.startDate).toLocaleDateString("vi-VN")} • Dự
              kiến hoàn tất: {new Date(installmentPlan.endDate).toLocaleDateString("vi-VN")}
            </div>
          )}
        </div>
      )}

      {/* Footer note */}
      {businessSettings.invoiceFooterNote && (
        <div className="text-center text-[11px] text-gray-800 mb-3 p-2 bg-yellow-50 border border-yellow-400 rounded">
          {businessSettings.invoiceFooterNote}
        </div>
      )}

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-6 text-center text-[11px] mt-4 pt-3 border-t border-gray-300">
        <div>
          <p className="font-bold text-gray-900">Khách hàng</p>
          <p className="text-[10px] text-gray-600">(Ký và ghi rõ họ tên)</p>
          <div className="h-12"></div>
        </div>
        <div>
          <p className="font-bold text-gray-900">Người bán hàng</p>
          <p className="text-[10px] text-gray-600">(Ký và ghi rõ họ tên)</p>
          <div className="h-12"></div>
        </div>
      </div>

      {/* Thank you */}
      <div className="text-center text-[11px] text-gray-700 mt-3">
        Cảm ơn quý khách! Hẹn gặp lại!
      </div>
    </div>
  );
}
