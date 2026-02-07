/**
 * Database Payload Types
 *
 * These types represent the snake_case format used by Supabase/PostgreSQL.
 * Convert from camelCase app types to these for database operations.
 */

// PIN Products
export interface DBPinProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  cost_price: number;
  retail_price: number | null;
  wholesale_price: number | null;
  category_id?: string | null;
  created_at?: string;
}

// PIN Materials
export interface DBPinMaterial {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchase_price: number;
  retail_price?: number | null;
  wholesale_price?: number | null;
  stock: number;
  committed_quantity?: number;
  supplier?: string | null;
  description?: string | null;
  branch_id?: string | null;
  created_at?: string;
  updated_at?: string;
}

// PIN BOMs
export interface DBPinBOM {
  id?: string;
  product_name: string;
  product_sku: string;
  materials: Array<{ materialId: string; quantity: number }>;
  notes?: string | null;
  estimated_cost?: number | null;
  created_at?: string;
}

// PIN Production Orders
export interface DBProductionOrder {
  id: string;
  bom_id: string;
  product_name: string;
  quantity_produced: number;
  status: string;
  materials_cost: number;
  additional_costs?: Array<{ description: string; amount: number }>;
  total_cost: number;
  notes?: string | null;
  user_name?: string | null;
  created_at?: string;
  completed_at?: string | null;
}

// Fixed Assets
export interface DBFixedAsset {
  id?: string;
  name: string;
  category: string;
  description?: string | null;
  purchase_date: string;
  purchase_price: number;
  current_value: number;
  depreciation_method: string;
  useful_life: number;
  salvage_value: number;
  accumulated_depreciation?: number;
  location?: string | null;
  serial_number?: string | null;
  warranty_expiry?: string | null;
  status: string;
  branch_id?: string | null;
  created_at?: string;
}

// Capital Investments
export interface DBCapitalInvestment {
  id?: string;
  date: string;
  amount: number;
  description: string;
  source: string;
  interest_rate?: number | null;
  branch_id?: string | null;
  created_at?: string;
}

// Cash Transactions
export interface DBCashTransaction {
  id: string;
  type: "income" | "expense";
  date: string;
  amount: number;
  contact_id?: string | null;
  contact_name: string;
  notes: string;
  payment_source_id: string;
  branch_id: string;
  category?: string | null;
  sale_id?: string | null;
  work_order_id?: string | null;
  created_at?: string;
}

// PIN Sales
export interface DBPinSale {
  id: string;
  date: string;
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    sellingPrice: number;
    costPrice: number;
    stock: number;
    discount?: number;
  }>;
  subtotal: number;
  discount: number;
  total: number;
  code?: string | null;
  customer_name: string;
  customer_phone?: string | null;
  customer_id?: string | null;
  customer_address?: string | null;
  payment_method: "cash" | "bank";
  payment_status?: string | null;
  paid_amount?: number | null;
  due_date?: string | null;
  user_id: string;
  user_name: string;
  created_at?: string;
}

// PIN Repair Orders
export interface DBPinRepairOrder {
  id: string;
  creation_date: string;
  customer_name: string;
  customer_phone: string;
  device_name: string;
  issue_description: string;
  technician_name?: string | null;
  status: string;
  materials_used?: Array<{
    materialId: string;
    materialName: string;
    quantity: number;
    price: number;
  }>;
  labor_cost: number;
  total: number;
  notes?: string | null;
  payment_status: string;
  partial_payment_amount?: number | null;
  deposit_amount?: number | null;
  payment_method?: string | null;
  payment_date?: string | null;
  due_date?: string | null;
  cash_transaction_id?: string | null;
  created_at?: string;
}

// PIN Customers
export interface DBPinCustomer {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
}

// Suppliers
export interface DBSupplier {
  id: string;
  name: string;
  phone: string;
  address?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at?: string;
}

// Material History
export interface DBPinMaterialHistory {
  id: string;
  material_id?: string | null;
  material_name: string;
  material_sku?: string | null;
  quantity: number;
  purchase_price: number;
  total_cost: number;
  supplier?: string | null;
  import_date: string;
  notes?: string | null;
  user_id?: string | null;
  user_name?: string | null;
  branch_id: string;
  created_at?: string;
}
