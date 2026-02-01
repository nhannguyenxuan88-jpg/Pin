// Utility functions for MaterialManager

import type { MaterialItem } from "./types";
// Re-export generateMaterialSKU from centralized location
export { generateMaterialSKU } from "../../lib/sku";

/**
 * Format currency in Vietnamese format
 */
export const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

/**
 * Format number with Vietnamese locale
 */
export const formatNumber = (num: number): string =>
  new Intl.NumberFormat("vi-VN").format(num);

/**
 * Generate unique ID for materials
 */
export const generateId = (): string =>
  `M${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

/**
 * Create empty material item for form
 */
export const createEmptyMaterialItem = (id: number): MaterialItem => ({
  id,
  name: "",
  sku: "",
  unit: "cái",
  purchasePrice: 0,
  retailPrice: 0,
  wholesalePrice: 0,
  quantity: 1,
  totalCost: 0,
});

/**
 * Normalize material item with default values
 */
export const normalizeMaterialItem = (
  item: Partial<MaterialItem>
): MaterialItem => {
  const purchasePrice = item.purchasePrice ?? 0;
  const quantity = item.quantity ?? 1;
  return {
    id: item.id ?? Date.now(),
    name: item.name ?? "",
    sku: item.sku ?? "",
    unit: item.unit ?? "cái",
    purchasePrice,
    retailPrice: item.retailPrice ?? 0,
    wholesalePrice: item.wholesalePrice ?? 0,
    quantity,
    totalCost: item.totalCost ?? purchasePrice * quantity,
  };
};

/**
 * Ensure material items array is valid
 */
export const ensureMaterialItems = (
  items?: Partial<MaterialItem>[]
): MaterialItem[] => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return [createEmptyMaterialItem(1)];
  }

  return items.map((item, index) =>
    normalizeMaterialItem({
      ...item,
      id: item?.id ?? index + 1,
    })
  );
};

/**
 * Base units for materials
 */
export const BASE_UNITS = [
  "cái",
  "kg",
  "mét",
  "lít",
  "cuộn",
  "bộ",
  "hộp",
  "thùng",
  "Cell",
  "Viên",
];

/**
 * Get all available units from existing materials and custom units
 */
export const getAllAvailableUnits = (
  existingMaterials: PinMaterial[],
  customUnits: string[] = []
): string[] => {
  const existingUnits = Array.from(
    new Set(existingMaterials.map((m) => m.unit).filter(Boolean))
  );
  return Array.from(new Set([...BASE_UNITS, ...existingUnits, ...customUnits]));
};

/**
 * Get stock status info based on quantity
 */
export const getStockStatus = (stock: number, minStock: number = 5) => {
  if (stock <= 0) {
    return {
      label: "Hết hàng",
      color: "text-red-500",
      bgColor: "bg-red-100 dark:bg-red-900/30",
      dotColor: "bg-red-500",
    };
  }
  if (stock <= minStock) {
    return {
      label: "Sắp hết",
      color: "text-orange-500",
      bgColor: "bg-orange-100 dark:bg-orange-900/30",
      dotColor: "bg-orange-500",
    };
  }
  return {
    label: "Còn hàng",
    color: "text-green-500",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    dotColor: "bg-green-500",
  };
};

/**
 * Filter materials based on search query
 */
export const filterMaterials = (
  materials: PinMaterial[],
  searchQuery: string
): PinMaterial[] => {
  if (!searchQuery.trim()) return materials;

  const query = searchQuery.toLowerCase().trim();
  return materials.filter(
    (m) =>
      m.name?.toLowerCase().includes(query) ||
      m.sku?.toLowerCase().includes(query) ||
      m.supplier?.toLowerCase().includes(query)
  );
};

/**
 * Sort materials by field
 */
export const sortMaterials = (
  materials: PinMaterial[],
  sortField: keyof PinMaterial,
  sortDirection: "asc" | "desc"
): PinMaterial[] => {
  return [...materials].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;

    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal, "vi")
        : bVal.localeCompare(aVal, "vi");
    }

    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }

    return 0;
  });
};
