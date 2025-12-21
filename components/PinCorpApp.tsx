import React from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { usePinContext } from "../contexts/PinContext";
import { ResponsiveLayout } from "./layouts";
import MaterialManager from "./MaterialManager";
import ProductionManagerWrapper from "./ProductionManagerWrapper";
import PinProductManager from "./PinProductManager";
import PinSalesManager from "./PinSalesManager";
import PinReportManager from "./PinReportManager";
import PinRepairManager from "./PinRepairManager";
import PinGoodsReceipt from "./PinGoodsReceipt";
import CostReportDashboard from "./CostReportDashboard";
import PredictiveDashboard from "./PredictiveDashboard";
import PinFinancialManager from "./PinFinancialManager";
import PinProductionReset from "./PinProductionReset";
import PinSettings from "./PinSettings";
import Receivables from "./Receivables";
import AdvancedAnalyticsDashboard from "./AdvancedAnalyticsDashboard";
import BusinessSettings from "./BusinessSettings";
import { TaxReportPage } from "./TaxReportPage";
import { MobileMoreMenu } from "./mobile";
import { CashTransaction, PinSale } from "../types";

interface PinCorpAppProps {
  onSwitchApp: () => void;
}

const PinCorpApp: React.FC<PinCorpAppProps> = ({ onSwitchApp }) => {
  // FIX: Destructure all necessary props from useAppContext to pass down to components.
  const appContext = usePinContext();

  // FIX: Wrapper function to create CashTransaction before calling context's handlePinSale
  const wrappedHandlePinSale = (saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">) => {
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

  // More menu state for mobile
  const [isMoreMenuOpen, setIsMoreMenuOpen] = React.useState(false);

  return (
    <HashRouter>
      <ResponsiveLayout currentUser={appContext.currentUser!} onSwitchApp={onSwitchApp}>
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
              <PinGoodsReceipt
                suppliers={appContext.suppliers}
                setSuppliers={appContext.setSuppliers}
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
                cashTransactions={appContext.cashTransactions}
                repairOrders={appContext.pinRepairOrders}
                materials={appContext.pinMaterials}
                products={appContext.pinProducts}
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
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/settings" element={<PinSettings />} />
          <Route path="/business-settings" element={<BusinessSettings />} />
          <Route path="/tax-report" element={<TaxReportPage />} />
          <Route path="/analytics" element={<AdvancedAnalyticsDashboard />} />
          <Route path="/production-reset" element={<PinProductionReset />} />
          {/* More menu route for mobile */}
          <Route
            path="/more"
            element={
              <>
                <MobileMoreMenu isOpen={true} onClose={() => window.history.back()} />
                <div className="text-center py-8 text-slate-500">
                  <p>Chọn một chức năng từ menu</p>
                </div>
              </>
            }
          />
        </Routes>
      </ResponsiveLayout>
    </HashRouter>
  );
};

export default PinCorpApp;
