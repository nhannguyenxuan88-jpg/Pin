import React, { useState, useEffect, useMemo } from "react";
import { Card } from "./ui/Card";
import { Button } from "./ui/Button";
import { usePinContext } from "../contexts/PinContext";
import { BusinessSettings } from "../types/business";
import {
  TaxReportData,
  TaxReportPeriod,
  TaxSaleItem,
  TaxPurchaseItem,
  TaxSummary,
} from "../types/tax";
import { formatCurrency } from "../lib/utils/format";

export const TaxReportPage: React.FC = () => {
  const { pinSales, pinMaterials, suppliers } = usePinContext();
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [period, setPeriod] = useState<TaxReportPeriod>("month");
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedQuarter, setSelectedQuarter] = useState<number>(
    Math.floor(new Date().getMonth() / 3) + 1
  );
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [customFromDate, setCustomFromDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [customToDate, setCustomToDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [vatRate, setVatRate] = useState<number>(10);

  useEffect(() => {
    const stored = localStorage.getItem("businessSettings");
    if (stored) {
      try {
        setBusinessSettings(JSON.parse(stored));
      } catch (e) {
        // Invalid JSON in localStorage, ignore
      }
    }
  }, []);

  const getDateRange = (): { fromDate: string; toDate: string } => {
    const now = new Date();

    switch (period) {
      case "month": {
        const [year, month] = selectedMonth.split("-").map(Number);
        const fromDate = new Date(year, month - 1, 1);
        const toDate = new Date(year, month, 0, 23, 59, 59);
        return {
          fromDate: fromDate.toISOString().slice(0, 10),
          toDate: toDate.toISOString().slice(0, 10),
        };
      }
      case "quarter": {
        const startMonth = (selectedQuarter - 1) * 3;
        const fromDate = new Date(selectedYear, startMonth, 1);
        const toDate = new Date(selectedYear, startMonth + 3, 0, 23, 59, 59);
        return {
          fromDate: fromDate.toISOString().slice(0, 10),
          toDate: toDate.toISOString().slice(0, 10),
        };
      }
      case "year": {
        const fromDate = new Date(selectedYear, 0, 1);
        const toDate = new Date(selectedYear, 11, 31, 23, 59, 59);
        return {
          fromDate: fromDate.toISOString().slice(0, 10),
          toDate: toDate.toISOString().slice(0, 10),
        };
      }
      case "custom":
        return {
          fromDate: customFromDate,
          toDate: customToDate,
        };
      default:
        return {
          fromDate: now.toISOString().slice(0, 10),
          toDate: now.toISOString().slice(0, 10),
        };
    }
  };

  const reportData = useMemo((): TaxReportData => {
    const { fromDate, toDate } = getDateRange();
    const from = new Date(fromDate + "T00:00:00");
    const to = new Date(toDate + "T23:59:59");

    // Filter sales within date range
    const filteredSales = pinSales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate >= from && saleDate <= to;
    });

    // Convert sales to tax items
    const taxSales: TaxSaleItem[] = filteredSales.map((sale) => {
      const amount = sale.total;
      const vatAmount = (amount * vatRate) / (100 + vatRate);
      const baseAmount = amount - vatAmount;

      const totalQuantity = sale.items.reduce((sum, it) => sum + it.quantity, 0);

      return {
        invoiceNumber: sale.code || sale.id?.slice(0, 8) || "N/A",
        invoiceDate: new Date(sale.date).toISOString().slice(0, 10),
        customerName: sale.customer?.name || "Khách lẻ",
        customerTaxCode: undefined,
        description: sale.items.map((it) => it.name).join(", "),
        quantity: totalQuantity,
        unitPrice: totalQuantity > 0 ? baseAmount / totalQuantity : 0,
        amount: baseAmount,
        vatRate: vatRate,
        vatAmount: vatAmount,
        totalAmount: amount,
      };
    });

    // For purchases, we need to look at material history or supplier payments
    // For now, create placeholder structure (in real app, would need pin_purchases table)
    const taxPurchases: TaxPurchaseItem[] = [];

    // Calculate summary
    const summary: TaxSummary = {
      totalSalesAmount: taxSales.reduce((sum, item) => sum + item.amount, 0),
      totalSalesVAT: taxSales.reduce((sum, item) => sum + item.vatAmount, 0),
      totalSales: taxSales.reduce((sum, item) => sum + item.totalAmount, 0),
      totalPurchaseAmount: taxPurchases.reduce((sum, item) => sum + item.amount, 0),
      totalPurchaseVAT: taxPurchases.reduce((sum, item) => sum + item.vatAmount, 0),
      totalPurchase: taxPurchases.reduce((sum, item) => sum + item.totalAmount, 0),
      netVAT: 0,
    };

    summary.netVAT = summary.totalSalesVAT - summary.totalPurchaseVAT;

    return {
      reportDate: new Date().toISOString().slice(0, 10),
      fromDate,
      toDate,
      businessInfo: {
        name: businessSettings?.businessName || "N/A",
        taxCode: businessSettings?.taxCode || "N/A",
        address: businessSettings?.address || "N/A",
        phone: businessSettings?.phone || "N/A",
      },
      sales: taxSales,
      purchases: taxPurchases,
      summary,
    };
  }, [
    pinSales,
    businessSettings,
    period,
    selectedMonth,
    selectedQuarter,
    selectedYear,
    customFromDate,
    customToDate,
    vatRate,
  ]);

  const generateXML = (): string => {
    const {
      reportDate,
      fromDate,
      toDate,
      businessInfo,
      sales: taxSales,
      purchases: taxPurchases,
      summary,
    } = reportData;

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += "<TaxReport>\n";
    xml += "  <ReportInfo>\n";
    xml += `    <ReportDate>${reportDate}</ReportDate>\n`;
    xml += `    <FromDate>${fromDate}</FromDate>\n`;
    xml += `    <ToDate>${toDate}</ToDate>\n`;
    xml += "  </ReportInfo>\n";

    xml += "  <BusinessInfo>\n";
    xml += `    <Name>${escapeXml(businessInfo.name)}</Name>\n`;
    xml += `    <TaxCode>${escapeXml(businessInfo.taxCode)}</TaxCode>\n`;
    xml += `    <Address>${escapeXml(businessInfo.address)}</Address>\n`;
    xml += `    <Phone>${escapeXml(businessInfo.phone)}</Phone>\n`;
    xml += "  </BusinessInfo>\n";

    xml += "  <SalesData>\n";
    taxSales.forEach((sale) => {
      xml += "    <Sale>\n";
      xml += `      <InvoiceNumber>${escapeXml(sale.invoiceNumber)}</InvoiceNumber>\n`;
      xml += `      <InvoiceDate>${sale.invoiceDate}</InvoiceDate>\n`;
      xml += `      <CustomerName>${escapeXml(sale.customerName)}</CustomerName>\n`;
      if (sale.customerTaxCode) {
        xml += `      <CustomerTaxCode>${escapeXml(sale.customerTaxCode)}</CustomerTaxCode>\n`;
      }
      xml += `      <Description>${escapeXml(sale.description)}</Description>\n`;
      xml += `      <Quantity>${sale.quantity}</Quantity>\n`;
      xml += `      <UnitPrice>${sale.unitPrice.toFixed(2)}</UnitPrice>\n`;
      xml += `      <Amount>${sale.amount.toFixed(2)}</Amount>\n`;
      xml += `      <VATRate>${sale.vatRate}</VATRate>\n`;
      xml += `      <VATAmount>${sale.vatAmount.toFixed(2)}</VATAmount>\n`;
      xml += `      <TotalAmount>${sale.totalAmount.toFixed(2)}</TotalAmount>\n`;
      xml += "    </Sale>\n";
    });
    xml += "  </SalesData>\n";

    xml += "  <PurchaseData>\n";
    taxPurchases.forEach((purchase) => {
      xml += "    <Purchase>\n";
      xml += `      <InvoiceNumber>${escapeXml(purchase.invoiceNumber)}</InvoiceNumber>\n`;
      xml += `      <InvoiceDate>${purchase.invoiceDate}</InvoiceDate>\n`;
      xml += `      <SupplierName>${escapeXml(purchase.supplierName)}</SupplierName>\n`;
      if (purchase.supplierTaxCode) {
        xml += `      <SupplierTaxCode>${escapeXml(purchase.supplierTaxCode)}</SupplierTaxCode>\n`;
      }
      xml += `      <Description>${escapeXml(purchase.description)}</Description>\n`;
      xml += `      <Quantity>${purchase.quantity}</Quantity>\n`;
      xml += `      <UnitPrice>${purchase.unitPrice.toFixed(2)}</UnitPrice>\n`;
      xml += `      <Amount>${purchase.amount.toFixed(2)}</Amount>\n`;
      xml += `      <VATRate>${purchase.vatRate}</VATRate>\n`;
      xml += `      <VATAmount>${purchase.vatAmount.toFixed(2)}</VATAmount>\n`;
      xml += `      <TotalAmount>${purchase.totalAmount.toFixed(2)}</TotalAmount>\n`;
      xml += "    </Purchase>\n";
    });
    xml += "  </PurchaseData>\n";

    xml += "  <Summary>\n";
    xml += `    <TotalSalesAmount>${summary.totalSalesAmount.toFixed(2)}</TotalSalesAmount>\n`;
    xml += `    <TotalSalesVAT>${summary.totalSalesVAT.toFixed(2)}</TotalSalesVAT>\n`;
    xml += `    <TotalSales>${summary.totalSales.toFixed(2)}</TotalSales>\n`;
    xml += `    <TotalPurchaseAmount>${summary.totalPurchaseAmount.toFixed(2)}</TotalPurchaseAmount>\n`;
    xml += `    <TotalPurchaseVAT>${summary.totalPurchaseVAT.toFixed(2)}</TotalPurchaseVAT>\n`;
    xml += `    <TotalPurchase>${summary.totalPurchase.toFixed(2)}</TotalPurchase>\n`;
    xml += `    <NetVAT>${summary.netVAT.toFixed(2)}</NetVAT>\n`;
    xml += "  </Summary>\n";

    xml += "</TaxReport>";

    return xml;
  };

  const escapeXml = (text: string): string => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  };

  const handleExportXML = () => {
    const xml = generateXML();
    const blob = new Blob([xml], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = `BaoCaoThue_${reportData.fromDate}_${reportData.toDate}.xml`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    // Create CSV format for Excel compatibility
    let csv = "\uFEFF"; // UTF-8 BOM for Excel
    csv += "BÁO CÁO THUẾ\n";
    csv += `Từ ngày: ${reportData.fromDate}, Đến ngày: ${reportData.toDate}\n`;
    csv += `Doanh nghiệp: ${reportData.businessInfo.name}\n`;
    csv += `Mã số thuế: ${reportData.businessInfo.taxCode}\n\n`;

    csv += "DOANH THU BÁN HÀNG\n";
    csv +=
      "Số HĐ,Ngày,Khách hàng,MST KH,Diễn giải,SL,Đơn giá,Tiền hàng,Thuế suất,Tiền thuế,Tổng cộng\n";
    reportData.sales.forEach((sale) => {
      csv += `${sale.invoiceNumber},${sale.invoiceDate},"${sale.customerName}","${sale.customerTaxCode || ""}","${sale.description}",${sale.quantity},${sale.unitPrice},${sale.amount},${sale.vatRate}%,${sale.vatAmount},${sale.totalAmount}\n`;
    });

    csv += "\nMUA HÀNG\n";
    csv +=
      "Số HĐ,Ngày,Nhà cung cấp,MST NCC,Diễn giải,SL,Đơn giá,Tiền hàng,Thuế suất,Tiền thuế,Tổng cộng\n";
    reportData.purchases.forEach((purchase) => {
      csv += `${purchase.invoiceNumber},${purchase.invoiceDate},"${purchase.supplierName}","${purchase.supplierTaxCode || ""}","${purchase.description}",${purchase.quantity},${purchase.unitPrice},${purchase.amount},${purchase.vatRate}%,${purchase.vatAmount},${purchase.totalAmount}\n`;
    });

    csv += "\nTÓM TẮT\n";
    csv += `Tổng tiền hàng bán,${reportData.summary.totalSalesAmount}\n`;
    csv += `Tổng thuế VAT đầu ra,${reportData.summary.totalSalesVAT}\n`;
    csv += `Tổng doanh thu,${reportData.summary.totalSales}\n`;
    csv += `Tổng tiền hàng mua,${reportData.summary.totalPurchaseAmount}\n`;
    csv += `Tổng thuế VAT đầu vào,${reportData.summary.totalPurchaseVAT}\n`;
    csv += `Tổng chi phí,${reportData.summary.totalPurchase}\n`;
    csv += `Thuế VAT phải nộp,${reportData.summary.netVAT}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const fileName = `BaoCaoThue_${reportData.fromDate}_${reportData.toDate}.csv`;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center print:hidden">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Báo cáo thuế</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Xuất báo cáo thuế VAT theo kỳ</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="secondary">
            🖨️ In báo cáo
          </Button>
          <Button onClick={handleExportExcel} variant="secondary">
            📊 Xuất Excel
          </Button>
          <Button onClick={handleExportXML} variant="primary">
            📄 Xuất XML
          </Button>
        </div>
      </div>

      {/* Period Selection */}
      <Card className="p-6 print:hidden">
        <h2 className="text-xl font-semibold mb-4">Chọn kỳ báo cáo</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Loại kỳ</label>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as TaxReportPeriod)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
            >
              <option value="month">Theo tháng</option>
              <option value="quarter">Theo quý</option>
              <option value="year">Theo năm</option>
              <option value="custom">Tùy chỉnh</option>
            </select>
          </div>

          {period === "month" && (
            <div>
              <label className="block text-sm font-medium mb-2">Tháng</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              />
            </div>
          )}

          {period === "quarter" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Quý</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value={1}>Quý 1 (T1-T3)</option>
                  <option value={2}>Quý 2 (T4-T6)</option>
                  <option value={3}>Quý 3 (T7-T9)</option>
                  <option value={4}>Quý 4 (T10-T12)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Năm</label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                  min={2020}
                  max={2100}
                />
              </div>
            </>
          )}

          {period === "year" && (
            <div>
              <label className="block text-sm font-medium mb-2">Năm</label>
              <input
                type="number"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                min={2020}
                max={2100}
              />
            </div>
          )}

          {period === "custom" && (
            <>
              <div>
                <label className="block text-sm font-medium mb-2">Từ ngày</label>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Đến ngày</label>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Thuế suất VAT (%)</label>
            <input
              type="number"
              value={vatRate}
              onChange={(e) => setVatRate(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              min={0}
              max={100}
              step={1}
            />
          </div>
        </div>
      </Card>

      {/* Report Preview */}
      <div className="print:block">
        <Card className="p-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold uppercase">BÁO CÁO THUẾ GIÁ TRỊ GIA TĂNG</h2>
            <p className="text-lg mt-2">
              Từ ngày {new Date(reportData.fromDate).toLocaleDateString("vi-VN")} đến ngày{" "}
              {new Date(reportData.toDate).toLocaleDateString("vi-VN")}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Ngày lập: {new Date(reportData.reportDate).toLocaleDateString("vi-VN")}
            </p>
          </div>

          {/* Business Info */}
          <div className="mb-8 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p>
                <strong>Doanh nghiệp:</strong> {reportData.businessInfo.name}
              </p>
              <p>
                <strong>Mã số thuế:</strong> {reportData.businessInfo.taxCode}
              </p>
            </div>
            <div>
              <p>
                <strong>Địa chỉ:</strong> {reportData.businessInfo.address}
              </p>
              <p>
                <strong>Điện thoại:</strong> {reportData.businessInfo.phone}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">TỔNG HỢP</h3>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold text-lg mb-3">Doanh thu bán hàng</h4>
                <div className="flex justify-between">
                  <span>Tổng tiền hàng:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.summary.totalSalesAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Thuế VAT đầu ra ({vatRate}%):</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.summary.totalSalesVAT)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Tổng doanh thu:</span>
                  <span className="font-bold text-green-600">
                    {formatCurrency(reportData.summary.totalSales)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-lg mb-3">Chi phí mua hàng</h4>
                <div className="flex justify-between">
                  <span>Tổng tiền hàng:</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.summary.totalPurchaseAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Thuế VAT đầu vào ({vatRate}%):</span>
                  <span className="font-semibold">
                    {formatCurrency(reportData.summary.totalPurchaseVAT)}
                  </span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-semibold">Tổng chi phí:</span>
                  <span className="font-bold text-red-600">
                    {formatCurrency(reportData.summary.totalPurchase)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Thuế VAT phải nộp:</span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(reportData.summary.netVAT)}
                </span>
              </div>
              {reportData.summary.netVAT < 0 && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  * Số âm: Thuế VAT được khấu trừ vào kỳ sau
                </p>
              )}
            </div>
          </div>

          {/* Sales Details */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">CHI TIẾT BÁN HÀNG</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-2 text-left">Số HĐ</th>
                    <th className="px-2 py-2 text-left">Ngày</th>
                    <th className="px-2 py-2 text-left">Khách hàng</th>
                    <th className="px-2 py-2 text-left">Diễn giải</th>
                    <th className="px-2 py-2 text-right">Tiền hàng</th>
                    <th className="px-2 py-2 text-right">Thuế VAT</th>
                    <th className="px-2 py-2 text-right">Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.sales.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-gray-500">
                        Không có dữ liệu bán hàng trong kỳ
                      </td>
                    </tr>
                  ) : (
                    reportData.sales.map((sale, idx) => (
                      <tr key={idx} className="border-b dark:border-gray-700">
                        <td className="px-2 py-2">{sale.invoiceNumber}</td>
                        <td className="px-2 py-2">
                          {new Date(sale.invoiceDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-2 py-2">{sale.customerName}</td>
                        <td className="px-2 py-2 max-w-xs truncate" title={sale.description}>
                          {sale.description}
                        </td>
                        <td className="px-2 py-2 text-right">{formatCurrency(sale.amount)}</td>
                        <td className="px-2 py-2 text-right">{formatCurrency(sale.vatAmount)}</td>
                        <td className="px-2 py-2 text-right font-semibold">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold mb-4 border-b pb-2">CHI TIẾT MUA HÀNG</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 dark:bg-gray-800">
                  <tr>
                    <th className="px-2 py-2 text-left">Số HĐ</th>
                    <th className="px-2 py-2 text-left">Ngày</th>
                    <th className="px-2 py-2 text-left">Nhà cung cấp</th>
                    <th className="px-2 py-2 text-left">Diễn giải</th>
                    <th className="px-2 py-2 text-right">Tiền hàng</th>
                    <th className="px-2 py-2 text-right">Thuế VAT</th>
                    <th className="px-2 py-2 text-right">Tổng cộng</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.purchases.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-2 py-4 text-center text-gray-500">
                        Không có dữ liệu mua hàng trong kỳ
                      </td>
                    </tr>
                  ) : (
                    reportData.purchases.map((purchase, idx) => (
                      <tr key={idx} className="border-b dark:border-gray-700">
                        <td className="px-2 py-2">{purchase.invoiceNumber}</td>
                        <td className="px-2 py-2">
                          {new Date(purchase.invoiceDate).toLocaleDateString("vi-VN")}
                        </td>
                        <td className="px-2 py-2">{purchase.supplierName}</td>
                        <td className="px-2 py-2 max-w-xs truncate" title={purchase.description}>
                          {purchase.description}
                        </td>
                        <td className="px-2 py-2 text-right">{formatCurrency(purchase.amount)}</td>
                        <td className="px-2 py-2 text-right">
                          {formatCurrency(purchase.vatAmount)}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold">
                          {formatCurrency(purchase.totalAmount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signature */}
          <div className="mt-12 grid grid-cols-2 gap-8 text-center">
            <div>
              <p className="font-semibold mb-16">Người lập biểu</p>
              <p>(Ký, họ tên)</p>
            </div>
            <div>
              <p className="font-semibold mb-16">Kế toán trưởng</p>
              <p>(Ký, họ tên)</p>
            </div>
          </div>
        </Card>
      </div>

      <style>{`
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:block {
            display: block !important;
          }
          @page {
            size: A4;
            margin: 1cm;
          }
        }
      `}</style>
    </div>
  );
};
