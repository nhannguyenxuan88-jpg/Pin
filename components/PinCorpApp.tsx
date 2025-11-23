import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { usePinContext } from "../contexts/PinContext";
import { PinTopNav, PinMobileNav, FloatingNavButtons } from "./PinSidebar";
import MaterialManager from "./MaterialManager";
import ProductionManagerWrapper from "./ProductionManagerWrapper";
import PinProductManager from "./PinProductManager";
import PinSalesManager from "./PinSalesManager";
import PinReportManager from "./PinReportManagerNew";
import PinRepairManager from "./PinRepairManagerNew";
import PinGoodsReceipt from "./PinGoodsReceipt";
import PinGoodsReceiptNew from "./PinGoodsReceiptNew";
import CostReportDashboard from "./CostReportDashboard";
import PredictiveDashboard from "./PredictiveDashboard";
import PinFinancialManager from "./PinFinancialManager";
import PinProductionReset from "./PinProductionReset";
import PinSettings from "./PinSettings";
import ReceivablesNew from "./ReceivablesNew";
import AdvancedAnalyticsDashboard from "./AdvancedAnalyticsDashboard";
import AuditLogViewer from "./AuditLogViewer";
import BarcodeScanner from "./BarcodeScanner";
import { CashTransaction, PinSale } from "../types";

interface PinCorpAppProps {
  onSwitchApp: () => void;
}

const PinCorpApp: React.FC<PinCorpAppProps> = ({ onSwitchApp }) => {
  // FIX: Destructure all necessary props from useAppContext to pass down to components.
  const appContext = usePinContext();

  // FIX: Wrapper function to create CashTransaction before calling context's handlePinSale
  const wrappedHandlePinSale = (
    saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">
  ) => {
    const cashTxId = `CT-PINSALE-${Date.now()}`;
    const newCashTx: Omit<CashTransaction, "id"> & { id: string } = {
      id: cashTxId,
      type: "income",
      date: new Date().toISOString(),
      // For partial/debt: only record the amount actually received now
      amount:
        typeof (saleData as any).paidAmount === "number"
          ? Math.max(0, (saleData as any).paidAmount)
          : saleData.total,
      contact: {
        id: saleData.customer.id || "",
        name: saleData.customer.name,
      },
      notes: `Thanh toán cho đơn hàng PIN Corp`,
      paymentSourceId: saleData.paymentMethod,
      branchId: "main", // Pincorp is single-branch for now
    };
    appContext.handlePinSale(saleData, newCashTx);
  };

  return (
    <HashRouter>
      <div className="flex flex-col h-screen bg-slate-100 dark:bg-slate-900 font-sans">
        {/* Desktop Top Nav */}
        <div className="hidden md:block print:hidden">
          <PinTopNav
            currentUser={appContext.currentUser!}
            onSwitchApp={onSwitchApp}
          />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
            <Routes>
              {/* FIX: Pass all required props to components */}
              <Route path="/" element={<Navigate to="/reports" replace />} />
              <Route
                path="/materials"
                element={
                  <MaterialManager
                    materials={appContext.pinMaterials}
                    setMaterials={appContext.setPinMaterials}
                    productionOrders={appContext.productionOrders}
                    suppliers={appContext.suppliers}
                    setSuppliers={appContext.setSuppliers}
                  />
                }
              />
              <Route
                path="/materials/goods-receipt/new"
                element={
                  <PinGoodsReceiptNew
                    suppliers={appContext.suppliers}
                    setSuppliers={appContext.setSuppliers}
                    currentUser={appContext.currentUser!}
                  />
                }
              />
              <Route
                path="/materials/goods-receipt/old"
                element={
                  <PinGoodsReceipt
                    materials={appContext.pinMaterials}
                    setMaterials={appContext.setPinMaterials}
                    suppliers={appContext.suppliers}
                    setSuppliers={appContext.setSuppliers}
                    paymentSources={appContext.paymentSources}
                    setPaymentSources={appContext.setPaymentSources}
                    currentUser={appContext.currentUser!}
                  />
                }
              />
              <Route
                path="/boms"
                element={
                  <ProductionManagerWrapper
                    boms={appContext.pinBOMs}
                    setBoms={appContext.setBoms}
                    materials={appContext.pinMaterials}
                    currentUser={appContext.currentUser!}
                    orders={appContext.productionOrders}
                    addOrder={appContext.addProductionOrder}
                    updateOrder={appContext.updateProductionOrderStatus}
                    completeOrder={appContext.completeProductionOrder}
                  />
                }
              />
              <Route path="/repairs" element={<PinRepairManager />} />
              <Route
                path="/products"
                element={
                  <PinProductManager
                    products={appContext.pinProducts}
                    updateProduct={appContext.updatePinProduct}
                  />
                }
              />
              <Route
                path="/sales"
                element={
                  <PinSalesManager
                    products={appContext.pinProducts}
                    cartItems={appContext.pinCartItems}
                    setCartItems={appContext.setPinCartItems}
                    handleSale={wrappedHandlePinSale}
                    customers={appContext.pinCustomers}
                    setCustomers={appContext.setPinCustomers}
                  />
                }
              />
              <Route
                path="/reports"
                element={
                  <PinReportManager
                    sales={appContext.pinSales}
                    orders={appContext.productionOrders}
                  />
                }
              />
              <Route
                path="/cost-analysis"
                element={
                  <CostReportDashboard
                    orders={appContext.productionOrders}
                    materials={appContext.pinMaterials}
                  />
                }
              />
              <Route
                path="/predictive"
                element={
                  <PredictiveDashboard
                    orders={appContext.productionOrders}
                    materials={appContext.pinMaterials}
                    boms={appContext.pinBOMs}
                  />
                }
              />
              <Route path="/financial" element={<PinFinancialManager />} />
              <Route path="/receivables" element={<ReceivablesNew />} />
              <Route path="/settings" element={<PinSettings />} />
              <Route
                path="/analytics"
                element={<AdvancedAnalyticsDashboard />}
              />
              <Route path="/audit-logs" element={<AuditLogViewer />} />
              <Route path="/barcode" element={<BarcodeScanner />} />
              <Route
                path="/production-reset"
                element={<PinProductionReset />}
              />
            </Routes>
          </main>
        </div>

        {/* Mobile Navigations */}
        <div className="md:hidden print:hidden">
          <PinMobileNav />
          <FloatingNavButtons onSwitchApp={onSwitchApp} />
        </div>
      </div>
    </HashRouter>
  );
};

export default PinCorpApp;
