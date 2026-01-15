import type React from "react";
import type {
  CashTransaction,
  FixedAsset,
  CapitalInvestment,
  PinMaterial,
  PinBOM,
  ProductionOrder,
  PinProduct,
  PinSale,
  PinCustomer,
  Supplier,
  PinCartItem,
  PinRepairOrder,
  ToastItem,
  PinMaterialHistory,
} from "../types";

// Internal types - exported for component use
export interface CurrentUser {
  id: string;
  name: string;
  email?: string;
  loginPhone?: string;
  status?: "active" | "inactive";
  departmentIds?: string[];
  role?: "admin" | "manager" | "employee";
}

interface PaymentSource {
  id: string;
  name: string;
  balance: { main: number };
  isDefault: boolean;
}

interface StoreSettings {
  name: string;
  branches: { id: string; name: string; logoUrl?: string }[];
}

/**
 * PinContextType - Full context type for PIN Corp app
 */
export interface PinContextType {
  // Auth & Settings
  currentUser: CurrentUser | null;
  storeSettings: StoreSettings;
  addToast: (toast: ToastItem) => void;

  // Finance state
  fixedAssets: FixedAsset[];
  setFixedAssets: React.Dispatch<React.SetStateAction<FixedAsset[]>>;
  capitalInvestments: CapitalInvestment[];
  setCapitalInvestments: React.Dispatch<React.SetStateAction<CapitalInvestment[]>>;
  cashTransactions: CashTransaction[];
  setCashTransactions: React.Dispatch<React.SetStateAction<CashTransaction[]>>;
  addCashTransaction: (tx: CashTransaction) => Promise<void>;

  // PIN Materials
  pinMaterials: PinMaterial[];
  setPinMaterials: React.Dispatch<React.SetStateAction<PinMaterial[]>>;
  pinMaterialHistory: PinMaterialHistory[];
  setPinMaterialHistory: React.Dispatch<React.SetStateAction<PinMaterialHistory[]>>;
  reloadPinMaterialHistory: () => Promise<void>;
  upsertPinMaterial: (material: PinMaterial) => Promise<void>;
  deletePinMaterial: (materialId: string) => Promise<void>;

  // PIN BOMs
  pinBOMs: PinBOM[];
  setBoms: React.Dispatch<React.SetStateAction<PinBOM[]>>;
  upsertPinBOM: (bom: PinBOM) => Promise<void>;
  deletePinBOM: (bomId: string) => Promise<void>;

  // Production
  productionOrders: ProductionOrder[];
  setProductionOrders: React.Dispatch<React.SetStateAction<ProductionOrder[]>>;
  addProductionOrder: (order: ProductionOrder, bom: PinBOM) => Promise<void>;
  updateProductionOrderStatus: (orderId: string, status: ProductionOrder["status"]) => Promise<void>;
  completeProductionOrder: (orderId: string) => Promise<void>;
  syncProductsFromCompletedOrders: () => Promise<void>;
  resetProductionData: (options?: Record<string, boolean>) => Promise<void>;

  // PIN Products
  pinProducts: PinProduct[];
  setPinProducts: React.Dispatch<React.SetStateAction<PinProduct[]>>;
  updatePinProduct: (product: PinProduct) => Promise<void>;
  removePinProductAndReturnMaterials: (product: PinProduct, quantityToRemove: number) => Promise<void>;

  // Sales
  pinSales: PinSale[];
  setPinSales: React.Dispatch<React.SetStateAction<PinSale[]>>;
  pinCartItems: PinCartItem[];
  setPinCartItems: React.Dispatch<React.SetStateAction<PinCartItem[]>>;
  handlePinSale: (
    saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">,
    newCashTx: CashTransaction
  ) => Promise<void>;
  deletePinSale: (saleId: string) => Promise<void>;
  updatePinSale: (sale: PinSale) => Promise<void>;

  // Customers
  pinCustomers: PinCustomer[];
  setPinCustomers: React.Dispatch<React.SetStateAction<PinCustomer[]>>;
  upsertPinCustomer: (customer: PinCustomer) => Promise<void>;

  // Suppliers
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  upsertSupplier: (supplier: Supplier) => Promise<void>;

  // Payment Sources
  paymentSources: PaymentSource[];
  setPaymentSources: React.Dispatch<React.SetStateAction<PaymentSource[]>>;

  // Repair Orders
  pinRepairOrders: PinRepairOrder[];
  setRepairOrders: React.Dispatch<React.SetStateAction<PinRepairOrder[]>>;
  upsertPinRepairOrder: (order: PinRepairOrder) => Promise<void>;
  deletePinRepairOrder: (orderId: string) => Promise<void>;

  // Finance Services
  upsertPinFixedAsset: (asset: FixedAsset) => Promise<void>;
  deletePinFixedAsset: (assetId: string) => Promise<void>;
  upsertPinCapitalInvestment: (investment: CapitalInvestment) => Promise<void>;
  deletePinCapitalInvestment: (investmentId: string) => Promise<void>;
  deleteCashTransactions: (filter: {
    id?: string;
    saleId?: string;
    workOrderId?: string;
  }) => Promise<number>;
}
