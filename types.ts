// Fix: Type definitions for the application.

export type AllowedApp = "motocare" | "pincorp" | "both";

export type UserRole = "admin" | "manager" | "employee";

export interface UserPermissions {
  canViewProfitReports: boolean;
  canViewCostDetails: boolean;
  canViewFinancialSummary: boolean;
  canEditPricing: boolean;
}

// Helper functions for permission checks
export const getUserPermissions = (user: User | null): UserPermissions => {
  if (!user) {
    return {
      canViewProfitReports: false,
      canViewCostDetails: false,
      canViewFinancialSummary: false,
      canEditPricing: false,
    };
  }

  const role = user.role || "employee";

  switch (role) {
    case "admin":
      return {
        canViewProfitReports: true,
        canViewCostDetails: true,
        canViewFinancialSummary: true,
        canEditPricing: true,
      };
    case "manager":
      return {
        canViewProfitReports: true,
        canViewCostDetails: true,
        canViewFinancialSummary: true,
        canEditPricing: false,
      };
    case "employee":
    default:
      return {
        canViewProfitReports: false,
        canViewCostDetails: false,
        canViewFinancialSummary: false,
        canEditPricing: false,
      };
  }
};

export const canViewProfitInfo = (user: User | null): boolean => {
  return getUserPermissions(user).canViewProfitReports;
};

export const canViewCostDetails = (user: User | null): boolean => {
  return getUserPermissions(user).canViewCostDetails;
};

export interface User {
  id: string; // This will be the UUID from Supabase auth
  name: string;
  email: string;
  phone?: string;
  // FIX: Add missing properties to align with usage in UserManager.tsx
  loginPhone: string;
  password?: string;
  creationDate?: string;
  status: "active" | "inactive";
  departmentIds: string[];
  // App-level permissions
  allowedApps?: AllowedApp;
  role?: UserRole;
  created_at?: string;
  address?: string;
  // Payroll config (optional)
  salaryBase?: number; // Lương cơ bản theo tháng
  allowance?: number; // Phụ cấp cố định
  overtimeRate?: number; // hệ số OT (nếu cần)
  deductions?: number; // Khấu trừ cố định
  payrollMethod?: "cash" | "bank"; // Phương thức trả lương mặc định
  defaultPaymentSourceId?: string; // Nguồn chi mặc định khi trả lương
}

export type PermissionLevel = "all" | "restricted" | "none";

export interface ModulePermission {
  level: PermissionLevel;
  details?: { [key: string]: boolean };
}

export interface Permissions {
  [moduleKey: string]: ModulePermission | boolean; // boolean for simple toggles
}

export interface Department {
  id: string;
  name: string;
  description: string;
  permissions: Permissions;
  created_at?: string;
}

export interface StoreSettings {
  name: string;
  address: string;
  phone: string;
  bankName: string;
  bankAccountNumber: string;
  bankAccountHolder: string;
  branches: {
    id: string;
    name: string;
    // Optional per-branch overrides for invoice/header
    address?: string;
    phone?: string;
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolder?: string;
    logoUrl?: string;
    taxCode?: string;
  }[];
  // Optional, admin-editable service repair templates (persisted in local settings)
  repairTemplates?: RepairTemplate[];
  // Optional defaults for reorder policy per category
  categoryReorderDefaults?: {
    [category: string]: {
      leadTimeDays?: number;
      safetyDays?: number;
    };
  };
  // Revenue and profit targets by branch
  targets?: {
    [branchId: string]: {
      day?: {
        revenue?: number;
        grossMargin?: number;
        gmPct?: number;
        aov?: number;
      };
      week?: {
        revenue?: number;
        grossMargin?: number;
        gmPct?: number;
        aov?: number;
      };
      month?: {
        revenue?: number;
        grossMargin?: number;
        gmPct?: number;
        aov?: number;
      };
      year?: {
        revenue?: number;
        grossMargin?: number;
        gmPct?: number;
        aov?: number;
      };
    };
  };
  // Inventory alert thresholds
  alertThresholds?: {
    lowStock?: number;
    expiryWarning?: number; // Days before expiry
    gmPctMin?: number;
    gmPctDropWarn?: number;
    lowStockCountWarn?: number;
    cashflowNegativeDays?: number;
  };
}

// Service repair template types
export interface RepairTemplatePart {
  name: string;
  quantity: number;
  price: number;
  unit?: string;
}

export interface RepairTemplate {
  id: string;
  name: string;
  description?: string;
  estimatedTime?: string;
  baseCost?: number;
  parts: RepairTemplatePart[];
}

export interface Part {
  id: string;
  name: string;
  sku: string;
  stock: { [branchId: string]: number };
  price: { [branchId: string]: number };
  retailPrice: { [branchId: string]: number }; // Giá bán lẻ
  wholesalePrice: { [branchId: string]: number }; // Giá bán sỉ
  category?: string;
  description?: string;
  warrantyPeriod?: string;
  expiryDate?: string;
  created_at?: string;
  // Optional per-SKU reorder configuration
  leadTimeDays?: number;
  safetyDays?: number;
}

export interface WorkOrderPart {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  price: number; // Selling price at the time of service
  // Optional VAT details per line
  vatRate?: 0 | 5 | 8 | 10;
  vatAmount?: number;
}

export interface QuotationItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface WorkOrder {
  id: string;
  creationDate: string;
  customerName: string;
  customerPhone: string;
  phoneNumber: string; // Added for compatibility
  vehicleModel: string;
  licensePlate: string;
  issueDescription: string;
  technicianName: string;
  status: "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";
  total: number;
  branchId: string;
  laborCost: number;
  partsUsed?: WorkOrderPart[];
  quotationItems?: QuotationItem[];
  notes?: string;
  processingType?: string;
  customerQuote?: number;
  discount?: number;
  mileage?: number;
  paymentStatus?: "paid" | "unpaid";
  paymentMethod?: "cash" | "bank";
  paymentDate?: string;
  cashTransactionId?: string;
  created_at?: string;
  createdAt?: string; // Added for compatibility
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  vehicle: string;
  licensePlate: string;
  loyaltyPoints: number;
  created_at?: string;
}

export interface InventoryTransaction {
  id: string;
  type: "Nhập kho" | "Xuất kho";
  partId: string;
  partName: string;
  quantity: number;
  date: string;
  notes: string;
  unitPrice?: number;
  totalPrice: number;
  branchId: string;
  saleId?: string;
  transferId?: string;
  goodsReceiptId?: string; // Add this line
  discount?: number;
  customerId?: string;
  customerName?: string;
  userId?: string;
  userName?: string;
  created_at?: string;
  // Optional VAT captured at transaction level (for purchases)
  vatRate?: 0 | 5 | 8 | 10;
  vatAmount?: number;
}

export interface CartItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  stock: number; // Available stock at time of adding to cart
  discount?: number;
  warrantyPeriod?: string;
  // Optional VAT details per sale line
  vatRate?: 0 | 5 | 8 | 10;
  vatAmount?: number;
}

export interface Sale {
  id: string;
  date: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  total: number;
  customer: {
    id?: string;
    name: string;
    phone?: string;
  };
  paymentMethod: "cash" | "bank";
  userId: string;
  userName: string;
  branchId: string;
  cashTransactionId?: string;
  created_at?: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  email?: string;
  notes?: string;
  created_at?: string;
}

export interface PaymentSource {
  id: string;
  name: string;
  balance: { [branchId: string]: number };
  isDefault?: boolean;
}

export type CashTransactionCategory =
  | "sale_income"
  | "service_income"
  | "other_income"
  | "inventory_purchase"
  | "payroll"
  | "rent"
  | "utilities"
  | "logistics"
  | "sale_refund"
  | "other_expense";

export interface CashTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  contact: {
    id: string;
    name: string;
  };
  notes: string;
  paymentSourceId: string;
  branchId: string;
  // Optional classification / forecasting helpers
  category?: CashTransactionCategory;
  saleId?: string;
  workOrderId?: string;
  created_at?: string;
}

export interface ReceiptItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  warrantyPeriod?: string;
  // Optional VAT details per purchase line
  vatRate?: 0 | 5 | 8 | 10;
  vatAmount?: number;
}

export interface GoodsReceipt {
  id: string;
  supplierId: string;
  items: ReceiptItem[];
  totalAmount: number;
  notes?: string;
  receivedDate: string;
  created_at: string;
  userId: string;
  userName: string;
  branchId: string;
}

export type ContactType =
  | "Khách hàng"
  | "Nhà cung cấp"
  | "Đối tác sửa chữa"
  | "Đối tác tài chính";

export interface Contact {
  id: string;
  name: string;
  phone?: string;
  type: ContactType[];
}

export interface FixedAsset {
  id: string;
  name: string;
  category:
    | "machinery"
    | "equipment"
    | "vehicle"
    | "building"
    | "land"
    | "software"
    | "furniture"
    | "other";
  description?: string;
  purchaseDate: string;
  purchasePrice: number;
  currentValue: number;
  depreciationMethod:
    | "straight_line"
    | "declining_balance"
    | "sum_of_years"
    | "units_of_production";
  usefulLife: number; // in years
  salvageValue: number;
  accumulatedDepreciation: number;
  location?: string;
  serialNumber?: string;
  warrantyExpiry?: string;
  maintenanceSchedule?: MaintenanceSchedule[];
  status: "active" | "disposed" | "sold" | "under_maintenance";
  branchId?: string;
  created_at: string;
}

export interface CapitalInvestment {
  id: string;
  date: string;
  amount: number;
  description: string;
  source: "Vốn chủ sở hữu" | "Vay ngân hàng";
  interestRate?: number; // in percent
  branchId: string;
  created_at?: string;
}

// --- PINCORP App Types ---

export interface PinMaterial {
  id: string;
  name: string;
  sku: string;
  // FIX: Change unit to string to allow adding new units dynamically in the UI.
  unit: string;
  purchasePrice: number;
  // Optional selling prices for materials
  retailPrice?: number; // Giá bán lẻ
  wholesalePrice?: number; // Giá bán sỉ
  stock: number; // Total stock in warehouse
  committedQuantity?: number; // Reserved for production orders
  supplier?: string;
  description?: string;
  created_at?: string;

  // Calculated fields (not stored)
  availableStock?: number; // stock - committedQuantity
}

export interface EnhancedMaterial extends PinMaterial {
  // Additional calculated fields for enhanced material display
  stockStatus: "out-of-stock" | "low-stock" | "medium-stock" | "good-stock";
  commitmentRatio: number; // Percentage of stock committed (0-100)
  minStock?: number; // Minimum stock level for reorder alerts
}

export interface PinBomMaterial {
  materialId: string;
  quantity: number;
}

export interface PinBOM {
  id: string;
  productName: string;
  productSku: string;
  materials: PinBomMaterial[];
  notes?: string;
  estimatedCost?: number; // Calculated field, not stored
  created_at?: string;
}

export interface AdditionalCost {
  description: string;
  amount: number;
}

export interface MaterialCommitment {
  materialId: string;
  quantity: number;
  estimatedCost: number;
  actualCost?: number;
  actualQuantityUsed?: number;
}

export interface PinMaterialHistory {
  id: string;
  materialId?: string; // Optional in case material is deleted
  materialName: string;
  materialSku?: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number; // quantity * purchasePrice
  supplier?: string;
  importDate: string; // ISO date string
  notes?: string;
  userId?: string;
  userName?: string;
  branchId: string;
  created_at?: string;
}

export interface ActualCost {
  materialCosts: MaterialCommitment[];
  laborCost?: number;
  electricityCost?: number;
  machineryCost?: number;
  otherCosts: AdditionalCost[];
  totalActualCost: number;
}

export interface CostAnalysis {
  estimatedCost: number;
  actualCost: number;
  variance: number;
  variancePercentage: number;
  materialVariance: number;
  additionalCostsVariance: number;
}

export interface ProductionOrder {
  id: string;
  creationDate: string;
  bomId: string;
  productName: string;
  quantityProduced: number;
  status:
    | "Đang chờ"
    | "Đang sản xuất"
    | "Hoàn thành"
    | "Đã nhập kho"
    | "Đã hủy";
  materialsCost: number; // Estimated cost
  additionalCosts: AdditionalCost[];
  totalCost: number; // Estimated total
  notes?: string;
  userName?: string;
  created_at?: string;

  // Advanced Material & Cost Management
  committedMaterials?: MaterialCommitment[];
  actualCosts?: ActualCost;
  costAnalysis?: CostAnalysis;
  completedAt?: string;
}

export interface PinProduct {
  id: string; // Corresponds to bomId or productSku
  name: string;
  sku: string;
  stock: number;
  costPrice: number; // Giá vốn
  retailPrice: number; // Giá bán lẻ
  wholesalePrice: number; // Giá bán sỉ
  sellingPrice?: number; // @deprecated - Dùng retailPrice thay thế
  created_at?: string;
}

export interface PinCartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number; // Snapshot of cost at time of sale
  stock: number; // available stock
  discount?: number;
  priceType?: "retail" | "wholesale"; // Loại giá: bán lẻ hoặc bán sỉ
  retailPrice?: number; // Giá bán lẻ gốc
  wholesalePrice?: number; // Giá bán sỉ gốc
  type?: "product" | "material"; // Phân biệt thành phẩm vs nguyên liệu
}

export interface PinCustomer {
  id: string;
  name: string;
  phone: string;
  address?: string;
  notes?: string;
  created_at?: string;
}

export interface PinSale {
  id: string;
  date: string;
  items: PinCartItem[];
  subtotal: number;
  discount: number;
  total: number;
  customer: {
    id?: string;
    name: string;
    phone?: string;
    address?: string;
  };
  paymentMethod: "cash" | "bank";
  userId: string;
  userName: string;
  created_at?: string;
  // Optional payment tracking (front-end/UI only; not necessarily stored in DB)
  paymentStatus?: "paid" | "partial" | "debt";
  paidAmount?: number; // amount received at sale time
  dueDate?: string; // optional due date when recording debt
}

export interface PinRepairMaterial {
  materialId: string;
  materialName: string;
  quantity: number;
  price: number; // price at time of repair
}

export interface PinRepairOrder {
  id: string;
  creationDate: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  issueDescription: string;
  technicianName?: string;
  status: "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";
  materialsUsed?: PinRepairMaterial[];
  laborCost: number;
  total: number;
  notes?: string;
  paymentStatus: "paid" | "unpaid" | "partial";
  partialPaymentAmount?: number; // Số tiền khách thanh toán trước nếu thanh toán 1 phần
  paymentMethod?: "cash" | "bank";
  paymentDate?: string;
  cashTransactionId?: string;
  created_at?: string;
}

// =====================================================
// Audit Logging Types
// =====================================================

export interface AuditLog {
  id: string;
  table_name: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  record_id: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
  user_id?: string;
  user_email?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditStats {
  table_name: string;
  operation: string;
  count: number;
}

export interface AuditTrailItem {
  id: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  changed_fields?: string[];
  user_email?: string;
  created_at: string;
}

// =====================================================
// Cấp 3: Predictive Analytics & Smart Management Types
// =====================================================

// Cost Prediction Engine
export interface CostPrediction {
  orderId: string;
  predictedTotalCost: number;
  confidenceLevel: number; // 0-1, where 1 is highest confidence
  basedOnHistoricalOrders: number;
  predictionFactors: PredictionFactor[];
  riskAssessment: RiskAssessment;
  lastUpdated: string;
}

export interface PredictionFactor {
  factor:
    | "material_price_trend"
    | "seasonal_variation"
    | "supplier_reliability"
    | "complexity_level"
    | "team_efficiency";
  impact: "positive" | "negative" | "neutral";
  weight: number; // 0-1
  description: string;
}

export interface RiskAssessment {
  overallRisk: "low" | "medium" | "high" | "critical";
  riskFactors: RiskFactor[];
  mitigationSuggestions: string[];
}

export interface RiskFactor {
  type:
    | "budget_overrun"
    | "material_shortage"
    | "supplier_delay"
    | "capacity_constraint"
    | "quality_risk";
  severity: "low" | "medium" | "high" | "critical";
  probability: number; // 0-1
  description: string;
  impact: number; // Potential cost impact
}

// Smart Inventory Management
export interface InventoryForecast {
  materialId: string;
  currentStock: number;
  projectedDemand: DemandProjection[];
  reorderPoint: number;
  optimalOrderQuantity: number;
  stockoutRisk: number; // 0-1 probability
  recommendedAction: ReorderRecommendation;
}

export interface DemandProjection {
  date: string;
  projectedDemand: number;
  confidence: number;
  basedOnOrders: string[]; // Order IDs contributing to demand
}

export interface ReorderRecommendation {
  action: "immediate" | "within_week" | "within_month" | "no_action_needed";
  recommendedQuantity: number;
  urgencyLevel: "critical" | "high" | "medium" | "low";
  reasonCode: string;
  estimatedCost: number;
  preferredSupplierId?: string;
}

// Supplier Performance Analytics
export interface SupplierMetrics {
  supplierId: string;
  performanceScore: number; // 0-100
  deliveryMetrics: DeliveryMetrics;
  qualityMetrics: QualityMetrics;
  pricingMetrics: PricingMetrics;
  reliabilityScore: number;
  recommendations: SupplierRecommendation[];
}

export interface DeliveryMetrics {
  averageDeliveryTime: number; // days
  onTimeDeliveryRate: number; // 0-1
  earlyDeliveryRate: number;
  lateDeliveryRate: number;
  averageDelayWhenLate: number; // days
}

export interface QualityMetrics {
  defectRate: number; // 0-1
  returnRate: number;
  complianceScore: number;
  certificationStatus: string[];
}

export interface PricingMetrics {
  averagePriceVariation: number; // percentage
  priceStability: number; // 0-1, 1 is most stable
  competitivenessRank: number; // 1 is most competitive
  lastPriceUpdate: string;
}

export interface SupplierRecommendation {
  type:
    | "maintain"
    | "negotiate"
    | "find_alternative"
    | "increase_orders"
    | "reduce_orders";
  reason: string;
  potentialBenefit: number; // cost savings or improvement
  actionPriority: "high" | "medium" | "low";
}

// Production Optimization
export interface ProductionOptimization {
  orderId: string;
  currentSchedule: ProductionSchedule;
  optimizedSchedule: ProductionSchedule;
  potentialSavings: OptimizationSavings;
  recommendations: OptimizationSuggestion[];
}

export interface ProductionSchedule {
  startTime: string;
  estimatedEndTime: string;
  resourceAllocations: ResourceAllocation[];
  dependencies: string[]; // Other order IDs that must complete first
  bottlenecks: Bottleneck[];
}

export interface ResourceAllocation {
  resourceType: "labor" | "machine" | "workspace";
  resourceId: string;
  allocationStart: string;
  allocationEnd: string;
  utilizationRate: number; // 0-1
}

export interface Bottleneck {
  resourceType: "labor" | "machine" | "material" | "workspace";
  resourceId: string;
  severity: "minor" | "moderate" | "major" | "critical";
  estimatedDelay: number; // hours
  suggestions: string[];
}

export interface OptimizationSavings {
  timeSaved: number; // hours
  costSaved: number; // money
  efficiencyGain: number; // percentage
  resourceOptimization: number; // percentage better utilization
}

export interface OptimizationSuggestion {
  type:
    | "reschedule"
    | "reallocate_resources"
    | "batch_orders"
    | "outsource"
    | "delay_non_critical";
  impact: "high" | "medium" | "low";
  effort: "high" | "medium" | "low";
  potentialSavings: number;
  description: string;
  implementationSteps: string[];
}

// Real-time Analytics
export interface ProductionAnalytics {
  timestamp: string;
  activeOrders: ProductionOrderStatus[];
  overallEfficiency: number;
  costVarianceToday: number;
  materialUtilization: number;
  alerts: ProductionAlert[];
}

export interface ProductionOrderStatus {
  orderId: string;
  status: string;
  progressPercentage: number;
  currentCostVariance: number;
  estimatedCompletion: string;
  riskLevel: "low" | "medium" | "high" | "critical";
}

export interface ProductionAlert {
  id: string;
  type:
    | "cost_overrun"
    | "material_shortage"
    | "schedule_delay"
    | "quality_issue"
    | "resource_conflict";
  severity: "info" | "warning" | "error" | "critical";
  orderId?: string;
  message: string;
  suggestedAction?: string;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// Financial Management Types

export interface MaintenanceSchedule {
  id: string;
  assetId: string;
  type: "preventive" | "corrective" | "inspection";
  description: string;
  frequency:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "annually"
    | "custom";
  nextDueDate: string;
  lastCompletedDate?: string;
  estimatedCost: number;
  actualCost?: number;
  assignedTo?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "scheduled" | "overdue" | "in_progress" | "completed" | "cancelled";
}

export interface CapitalStructure {
  id: string;
  date: string;
  equity: {
    ownersEquity: number;
    retainedEarnings: number;
    additionalPaidInCapital: number;
    treasuryStock: number;
  };
  debt: {
    shortTermDebt: number;
    longTermDebt: number;
    accountsPayable: number;
    accruedExpenses: number;
  };
  totalAssets: number;
  totalLiabilities: number;
  workingCapital: number;
  created_at: string;
}

export interface CashFlow {
  id: string;
  date: string;
  category: "operating" | "investing" | "financing";
  subcategory: string;
  amount: number;
  description: string;
  referenceId?: string; // Link to sale, purchase, etc.
  paymentMethod: "cash" | "bank_transfer" | "check" | "card" | "other";
  accountId?: string;
  isRecurring: boolean;
  recurringFrequency?:
    | "daily"
    | "weekly"
    | "monthly"
    | "quarterly"
    | "annually";
  tags: string[];
  attachments?: string[];
  created_at: string;
}

export interface FinancialAccount {
  id: string;
  name: string;
  type: "cash" | "checking" | "savings" | "investment" | "loan" | "credit_line";
  accountNumber?: string;
  bankName?: string;
  currentBalance: number;
  currency: string;
  interestRate?: number;
  creditLimit?: number;
  isActive: boolean;
  created_at: string;
}

export interface FinancialRatio {
  date: string;
  // Liquidity Ratios
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  workingCapitalRatio: number;

  // Profitability Ratios
  grossProfitMargin: number;
  netProfitMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;

  // Efficiency Ratios
  inventoryTurnover: number;
  receivablesTurnover: number;
  assetTurnover: number;

  // Leverage Ratios
  debtToAssets: number;
  debtToEquity: number;
  equityRatio: number;
  interestCoverage: number;
}

export interface BudgetPlan {
  id: string;
  name: string;
  period: "monthly" | "quarterly" | "annually";
  startDate: string;
  endDate: string;
  categories: BudgetCategory[];
  totalBudget: number;
  actualSpent: number;
  variance: number;
  status: "draft" | "approved" | "active" | "completed" | "cancelled";
  created_at: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  subcategories?: BudgetCategory[];
}

export interface CashFlowForecast {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  projectedInflows: CashFlowProjection[];
  projectedOutflows: CashFlowProjection[];
  netCashFlow: number;
  cumulativeCashFlow: number;
  confidence: "high" | "medium" | "low";
  assumptions: string;
  created_at: string;
}

export interface CashFlowProjection {
  date: string;
  category: string;
  description: string;
  amount: number;
  probability: number; // 0-1
}
