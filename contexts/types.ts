import type { AppContextType } from "../AppContext";
import type { FixedAsset, CapitalInvestment } from "../../types";
import type React from "react";

// Narrowed surface that Pin components rely on today.
// We keep it broad enough to avoid breakage, but scoped to Pin features to reduce coupling over time.
export type PinContextType = Pick<
  AppContextType,
  | "currentUser"
  | "storeSettings"
  | "addToast"
  | "addCashTransaction"
  | "pinCartItems"
  | "setPinCartItems"
  | "pinMaterials"
  | "setPinMaterials"
  | "pinMaterialHistory"
  | "setPinMaterialHistory"
  | "reloadPinMaterialHistory"
  | "pinBOMs"
  | "setBoms"
  | "productionOrders"
  | "setProductionOrders"
  | "pinProducts"
  | "setPinProducts"
  | "pinSales"
  | "setPinSales"
  | "pinCustomers"
  | "setPinCustomers"
  | "suppliers"
  | "setSuppliers"
  | "paymentSources"
  | "setPaymentSources"
  | "setCapitalInvestments"
  | "cashTransactions"
  | "setCashTransactions"
  | "pinRepairOrders"
  | "setRepairOrders"
  | "upsertPinMaterial"
  | "deletePinMaterial"
  | "upsertPinBOM"
  | "deletePinBOM"
  | "addProductionOrder"
  | "updateProductionOrderStatus"
  | "completeProductionOrder"
  | "syncProductsFromCompletedOrders"
  | "updatePinProduct"
  | "removePinProductAndReturnMaterials"
  | "handlePinSale"
  | "deletePinSale"
  | "updatePinSale"
  | "upsertPinCustomer"
  | "upsertSupplier"
  | "deletePinCapitalInvestment"
  | "upsertPinRepairOrder"
  | "deletePinRepairOrder"
  | "resetProductionData"
> & {
  // Finance (PIN)
  fixedAssets: FixedAsset[];
  setFixedAssets: React.Dispatch<React.SetStateAction<FixedAsset[]>>;
  capitalInvestments: CapitalInvestment[];
  upsertPinFixedAsset: (asset: FixedAsset) => Promise<void>;
  deletePinFixedAsset: (assetId: string) => Promise<void>;
  upsertPinCapitalInvestment: (investment: CapitalInvestment) => Promise<void>;
  deleteCashTransactions: (filter: {
    id?: string;
    saleId?: string;
    workOrderId?: string;
  }) => Promise<number>;
};
