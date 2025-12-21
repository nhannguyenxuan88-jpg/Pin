/**
 * PIN Corp Material and Production Types
 */

export interface PinMaterial {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: number;
  retailPrice?: number;
  wholesalePrice?: number;
  sellingPrice?: number; // Legacy
  stock: number;
  quantity?: number; // Alias for stock
  committedQuantity?: number;
  supplier?: string;
  description?: string;
  created_at?: string;
  availableStock?: number;
  branch_id?: string;
  updated_at?: string;
}

export interface EnhancedMaterial extends PinMaterial {
  stockStatus: "out-of-stock" | "low-stock" | "medium-stock" | "good-stock";
  commitmentRatio: number;
  minStock?: number;
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
  estimatedCost?: number;
  created_at?: string;
}

export interface PinMaterialHistory {
  id: string;
  materialId?: string;
  materialName: string;
  materialSku?: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number;
  supplier?: string;
  importDate: string;
  notes?: string;
  userId?: string;
  userName?: string;
  branchId: string;
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
  | "Đã hủy"
  | "Chờ sản xuất"
  | "Mới";
  materialsCost: number;
  additionalCosts: AdditionalCost[];
  totalCost: number;
  notes?: string;
  userName?: string;
  created_at?: string;
  committedMaterials?: MaterialCommitment[];
  actualCosts?: ActualCost;
  costAnalysis?: CostAnalysis;
  completedAt?: string;
}

export interface PinProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  costPrice: number;
  retailPrice: number;
  wholesalePrice: number;
  sellingPrice?: number;
  created_at?: string;
}

export interface PinCartItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  sellingPrice: number;
  costPrice: number;
  stock: number;
  discount?: number;
  priceType?: "retail" | "wholesale";
  retailPrice?: number;
  wholesalePrice?: number;
  type?: "product" | "material";
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
  code?: string;
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
  paymentStatus?: "paid" | "partial" | "debt";
  paidAmount?: number;
  dueDate?: string;
}

export interface PinRepairMaterial {
  materialId: string;
  materialName: string;
  quantity: number;
  price: number;
}

// Gia công ngoài / Đặt hàng
export interface OutsourcingItem {
  id: string;
  description: string;  // Mô tả công việc
  quantity: number;     // Số lượng
  costPrice: number;    // Giá nhập (chi phí bên thứ 3)
  sellingPrice: number; // Đơn giá (giá tính cho khách)
  total: number;        // Thành tiền
}

export interface PinRepairOrder {
  id: string;
  creationDate: string;
  customerName: string;
  customerPhone: string;
  deviceName: string;
  issueDescription: string;
  technicianName?: string;
  status: "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy" | "Chờ";
  materialsUsed?: PinRepairMaterial[];
  outsourcingItems?: OutsourcingItem[];  // Gia công ngoài / Đặt hàng
  laborCost: number;
  total: number;
  notes?: string;
  paymentStatus: "paid" | "unpaid" | "partial";
  partialPaymentAmount?: number;
  depositAmount?: number;
  paymentMethod?: "cash" | "transfer" | "card" | "bank";
  paymentDate?: string;
  dueDate?: string;
  cashTransactionId?: string;
  created_at?: string;
}

