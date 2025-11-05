import React, { createContext, useContext, ReactNode } from "react";
import { useAppContext } from "./AppContext";
import type { PinContextType } from "./types";
import { PinStandaloneContext } from "./PinProviderStandalone";
import { createMaterialsService } from "../lib/services/MaterialsService";
import { createProductionService } from "../lib/services/ProductionService";
import { createSalesService } from "../lib/services/SalesService";
import { createCustomersService } from "../lib/services/CustomersService";
import { createSuppliersService } from "../lib/services/SuppliersService";
import { createRepairService } from "../lib/services/RepairService";
import { createProductionAdminService } from "../lib/services/ProductionAdminService";
import { createFinanceService } from "../lib/services/FinanceService";

// PinContext: for now mirrors AppContext but allows us to override or narrow later
const PinContext = createContext<PinContextType | null>(null);

export const PinProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const app = useAppContext();
  // Services (delegating to existing AppContext for now)
  const materialsSvc = createMaterialsService(app as any);
  const productionSvc = createProductionService(app as any);
  const salesSvc = createSalesService(app as any);
  const customersSvc = createCustomersService(app as any);
  const suppliersSvc = createSuppliersService(app as any);
  const repairSvc = createRepairService(app as any);
  const adminSvc = createProductionAdminService(app as any);
  const financeSvc = createFinanceService(app as any);

  // Build a narrowed Pin context surface by selecting only Pin-related fields
  const value: PinContextType = {
    currentUser: app.currentUser,
    storeSettings: app.storeSettings,
    addToast: app.addToast,
    // Finance state (PIN)
    fixedAssets: app.fixedAssets,
    setFixedAssets: app.setFixedAssets,
    capitalInvestments: app.capitalInvestments,
    pinMaterials: app.pinMaterials,
    setPinMaterials: app.setPinMaterials,
    pinCartItems: (app as any).pinCartItems,
    setPinCartItems: (app as any).setPinCartItems,
    pinMaterialHistory: app.pinMaterialHistory,
    setPinMaterialHistory: app.setPinMaterialHistory,
    reloadPinMaterialHistory: materialsSvc.reloadHistory,
    pinBOMs: app.pinBOMs,
    setBoms: app.setBoms,
    productionOrders: app.productionOrders,
    setProductionOrders: app.setProductionOrders,
    pinProducts: app.pinProducts,
    setPinProducts: app.setPinProducts,
    pinSales: app.pinSales,
    setPinSales: app.setPinSales,
    pinCustomers: app.pinCustomers,
    setPinCustomers: app.setPinCustomers,
    suppliers: app.suppliers,
    setSuppliers: app.setSuppliers,
    paymentSources: app.paymentSources,
    setPaymentSources: app.setPaymentSources,
    setCapitalInvestments: app.setCapitalInvestments,
    cashTransactions: app.cashTransactions,
    setCashTransactions: app.setCashTransactions,
    addCashTransaction: app.addCashTransaction,
    pinRepairOrders: app.pinRepairOrders,
    setRepairOrders: app.setRepairOrders,
    upsertPinMaterial: materialsSvc.upsertMaterial,
    deletePinMaterial: materialsSvc.deleteMaterial,
    upsertPinBOM: productionSvc.upsertBOM,
    deletePinBOM: productionSvc.deleteBOM,
    addProductionOrder: productionSvc.addOrder,
    updateProductionOrderStatus: productionSvc.updateOrderStatus,
    completeProductionOrder: productionSvc.completeOrder,
    syncProductsFromCompletedOrders:
      productionSvc.syncProductsFromCompletedOrders,
    updatePinProduct: productionSvc.updateProduct,
    removePinProductAndReturnMaterials:
      productionSvc.removeProductAndReturnMaterials,
    handlePinSale: salesSvc.handlePinSale,
    deletePinSale: salesSvc.deletePinSale,
    updatePinSale: salesSvc.updatePinSale,
    upsertPinCustomer: customersSvc.upsertPinCustomer,
    upsertSupplier: suppliersSvc.upsertSupplier,
    // Finance service methods
    upsertPinFixedAsset: financeSvc.upsertPinFixedAsset,
    deletePinFixedAsset: financeSvc.deletePinFixedAsset,
    deletePinCapitalInvestment: financeSvc.deletePinCapitalInvestment,
    upsertPinCapitalInvestment: financeSvc.upsertPinCapitalInvestment,
    deleteCashTransactions: financeSvc.deleteCashTransactions,
    upsertPinRepairOrder: repairSvc.upsertPinRepairOrder,
    deletePinRepairOrder: repairSvc.deletePinRepairOrder,
    resetProductionData: adminSvc.resetProductionData,
  };
  return <PinContext.Provider value={value}>{children}</PinContext.Provider>;
};

export const usePinContext = (): PinContextType => {
  // Prefer standalone provider when available, then PinProvider, then fallback to AppContext
  const standalone = useContext(PinStandaloneContext);
  if (standalone) return standalone;
  const ctx = useContext(PinContext);
  if (ctx) return ctx;
  return useAppContext() as unknown as PinContextType;
};

export type {};
