/**
 * PIN Corp Data Reset Utility
 * Hỗ trợ xóa hết dữ liệu để triển khai thực tế
 */

export interface ResetDataOptions {
  materials?: boolean;
  boms?: boolean;
  productionOrders?: boolean;
  products?: boolean;
  customers?: boolean;
  sales?: boolean;
  repairOrders?: boolean;
  cartItems?: boolean;
  fixedAssets?: boolean;
  capitalInvestments?: boolean;
  cashTransactions?: boolean;
  confirmReset?: boolean;
}

export const DEFAULT_RESET_OPTIONS: ResetDataOptions = {
  materials: true,
  boms: true,
  productionOrders: true,
  products: true,
  customers: true,
  sales: true,
  repairOrders: true,
  cartItems: true,
  fixedAssets: true,
  capitalInvestments: true,
  cashTransactions: true,
  confirmReset: false,
};

export const PRODUCTION_READY_DATA = {
  // Chỉ giữ lại dữ liệu cần thiết cho production
  keepSystemUsers: true,
  keepStoreSettings: true,
  keepDepartments: true,
  keepPaymentSources: true,
  keepSuppliers: false, // Có thể xóa suppliers demo

  // Reset các collections chính
  resetCollections: [
    "pinMaterials",
    "pinBOMs",
    "productionOrders",
    "pinProducts",
    "pinCustomers",
    "pinSales",
    "pinRepairOrders",
    "pinCartItems",
    "fixedAssets",
    "capitalInvestments",
    "cashTransactions",
  ],
};

/**
 * Validate reset options trước khi thực hiện
 */
export const validateResetOptions = (options: ResetDataOptions): string[] => {
  const warnings: string[] = [];

  if (options.customers && options.sales) {
    warnings.push("⚠️ Xóa customers sẽ ảnh hưởng đến dữ liệu sales");
  }

  if (options.materials && options.boms) {
    warnings.push("⚠️ Xóa materials sẽ ảnh hưởng đến BOM structures");
  }

  if (options.products && options.sales) {
    warnings.push("⚠️ Xóa products sẽ ảnh hưởng đến sales records");
  }

  // Confirm được handle riêng trong UI dialog

  return warnings;
};

/**
 * Tạo backup trước khi reset
 */
export const createBackupBeforeReset = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `pin_corp_backup_${timestamp}`;
};

/**
 * Thống kê dữ liệu sẽ bị xóa
 */
export const getDataStats = (context: any) => {
  return {
    materials: context.pinMaterials?.length || 0,
    boms: context.pinBOMs?.length || 0,
    productionOrders: context.productionOrders?.length || 0,
    products: context.pinProducts?.length || 0,
    customers: context.pinCustomers?.length || 0,
    sales: context.pinSales?.length || 0,
    repairOrders: context.pinRepairOrders?.length || 0,
    cartItems: context.pinCartItems?.length || 0,
    fixedAssets: context.fixedAssets?.length || 0,
    capitalInvestments: context.capitalInvestments?.length || 0,
    cashTransactions: context.cashTransactions?.length || 0,
  };
};
