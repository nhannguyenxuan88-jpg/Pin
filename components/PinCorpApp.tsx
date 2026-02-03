import React, { Suspense, lazy } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { usePinContext } from "../contexts/PinContext";
import { ResponsiveLayout } from "./layouts";
import { CashTransaction, PinSale, User } from "../types";

// Lazy load heavy components for better code splitting
const MaterialManager = lazy(() => import("./MaterialManager"));
const ProductionManagerWrapper = lazy(() => import("./ProductionManagerWrapper"));
const PinProductManager = lazy(() => import("./PinProductManager"));
const PinSalesManager = lazy(() => import("./PinSalesManager"));
const PinReportManager = lazy(() => import("./PinReportManager"));
const PinRepairManager = lazy(() => import("./PinRepairManager"));
const PinGoodsReceipt = lazy(() => import("./PinGoodsReceipt"));
const CostReportDashboard = lazy(() => import("./CostReportDashboard"));
const PredictiveDashboard = lazy(() => import("./PredictiveDashboard"));
const PinFinancialManager = lazy(() => import("./PinFinancialManager"));
const PinProductionReset = lazy(() => import("./PinProductionReset"));
const PinSettings = lazy(() => import("./PinSettings"));
const Receivables = lazy(() => import("./Receivables"));
const AdvancedAnalyticsDashboard = lazy(() => import("./AdvancedAnalyticsDashboard"));
const BusinessSettings = lazy(() => import("./BusinessSettings"));
const TaxReportPage = lazy(() => import("./TaxReportPage").then(m => ({ default: m.TaxReportPage })));
const DeliveryOrdersView = lazy(() => import("./DeliveryOrdersView"));

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500"></div>
  </div>
);

interface PinCorpAppProps {
  onSwitchApp: () => void;
}

const PinCorpApp: React.FC<PinCorpAppProps> = ({ onSwitchApp }) => {
  // FIX: Destructure all necessary props from useAppContext to pass down to components.
  const appContext = usePinContext();

  // Some legacy components expect the full `User` type (email/loginPhone/status/departmentIds).
  // Adapt `CurrentUser` to that shape with safe defaults.
  const legacyUser: User | null = React.useMemo(() => {
    if (!appContext.currentUser) return null;
    const u = appContext.currentUser;
    return {
      id: u.id,
      name: u.name,
      email: u.email ?? "",
      loginPhone: u.loginPhone ?? u.email ?? "",
      status: u.status ?? "active",
      departmentIds: u.departmentIds ?? [],
    };
  }, [appContext.currentUser]);

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

  return (
    <HashRouter>
      <ResponsiveLayout currentUser={appContext.currentUser!} onSwitchApp={onSwitchApp}>
        <Suspense fallback={<PageLoader />}>
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
                  currentUser={legacyUser}
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
                currentUser={legacyUser as User}
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
          <Route path="/delivery" element={<DeliveryOrdersView />} />
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
                  <div className="text-center py-8 text-slate-500">
                    <p>Chọn một chức năng từ menu</p>
                  </div>
                </>
              }
            />
          </Routes>
        </Suspense>
      </ResponsiveLayout>
    </HashRouter>
  );
};

export default PinCorpApp;
