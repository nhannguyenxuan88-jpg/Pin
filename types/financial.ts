/**
 * Financial Types
 */

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  address?: string;
  email?: string;
  notes?: string;
  created_at?: string;
  debt?: number; // Outstanding debt to this supplier
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
  category?: CashTransactionCategory;
  saleId?: string;
  workOrderId?: string;
  created_at?: string;
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
  usefulLife: number;
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

export interface MaintenanceSchedule {
  id: string;
  assetId: string;
  type: "preventive" | "corrective" | "inspection";
  description: string;
  frequency: "daily" | "weekly" | "monthly" | "quarterly" | "annually" | "custom";
  nextDueDate: string;
  lastCompletedDate?: string;
  estimatedCost: number;
  actualCost?: number;
  assignedTo?: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "scheduled" | "overdue" | "in_progress" | "completed" | "cancelled";
}

export interface CapitalInvestment {
  id: string;
  date: string;
  amount: number;
  description: string;
  source: "Vốn chủ sở hữu" | "Vay ngân hàng";
  interestRate?: number;
  branchId: string;
  created_at?: string;
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
  referenceId?: string;
  paymentMethod: "cash" | "bank_transfer" | "check" | "card" | "other";
  accountId?: string;
  isRecurring: boolean;
  recurringFrequency?: "daily" | "weekly" | "monthly" | "quarterly" | "annually";
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
  currentRatio: number;
  quickRatio: number;
  cashRatio: number;
  workingCapitalRatio: number;
  grossProfitMargin: number;
  netProfitMargin: number;
  returnOnAssets: number;
  returnOnEquity: number;
  inventoryTurnover: number;
  receivablesTurnover: number;
  assetTurnover: number;
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
  probability: number;
}
