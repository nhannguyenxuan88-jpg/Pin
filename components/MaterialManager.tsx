import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { PinMaterial, EnhancedMaterial, Supplier, PinMaterialHistory } from "../types";
import { supabase, isSupabaseConfigured } from "../supabaseClient";
import { useMaterialStock } from "../lib/hooks/useMaterialStock";
import { usePinContext } from "../contexts/PinContext";
import { PlusIcon, PencilSquareIcon, TrashIcon, XMarkIcon, EyeIcon } from "./common/Icons";
import { Icon, type IconName } from "./common/Icon";
import PinImportHistory from "./PinImportHistory";
import MaterialImportModal, { ImportRow } from "./MaterialImportModal";
import PurchaseOrderManager from "./PurchaseOrderManager";
import { generateMaterialSKU } from "../lib/sku";
import { getErrorMessage } from "../lib/utils/errorUtils";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const generateId = () => `M${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;

// Interface cho item trong bảng nhập liệu
interface MaterialItem {
  id: number;
  name: string;
  sku: string;
  unit: string;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  quantity: number;
  totalCost: number;
}

const createEmptyMaterialItem = (id: number): MaterialItem => ({
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

const normalizeMaterialItem = (item: Partial<MaterialItem>): MaterialItem => {
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

// Interface cho lịch sử kho
interface StockHistory {
  id: string;
  material_id: string;
  transaction_type: "import" | "export" | "adjustment";
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  created_at: string;
  created_by: string;
  invoice_number?: string;
  supplier?: string;
}

// Interface cho điều chỉnh tồn kho
interface StockAdjustment {
  material_id: string;
  current_stock: number;
  actual_stock: number;
  reason: string;
  note?: string;
}

// Interface cho dự báo tồn kho thông minh
interface StockForecast {
  material_id: string;
  material_name: string;
  current_stock: number;
  average_monthly_consumption: number;
  forecasted_stock_30_days: number;
  forecasted_stock_60_days: number;
  forecasted_stock_90_days: number;
  recommended_reorder_date: string;
  recommended_reorder_quantity: number;
  risk_level: "low" | "medium" | "high" | "critical";
  trend: "increasing" | "stable" | "decreasing";
  seasonal_factor?: number;
}

// Interface cho phân tích giá nhà cung cấp
interface SupplierPriceAnalysis {
  material_id: string;
  material_name: string;
  suppliers: SupplierPrice[];
  price_trend: "rising" | "falling" | "stable";
  average_price: number;
  best_price: number;
  best_supplier: string;
  price_variance: number;
  recommendations: string[];
}

interface SupplierPrice {
  supplier_name: string;
  current_price: number;
  last_updated: string;
  price_history: PricePoint[];
  quality_rating?: number;
  delivery_time_days?: number;
  reliability_score?: number;
}

interface PricePoint {
  date: string;
  price: number;
  quantity?: number;
  invoice_number?: string;
}

// Toast notification type for sub-components
type ToastFn = (title: string, message: string, type?: "success" | "error" | "warn") => void;

// Simple Material Form Component
const MaterialForm: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
  onSubmit: (data: Omit<PinMaterial, "id">) => Promise<void>;
  existingMaterials?: PinMaterial[];
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  onToast?: ToastFn;
}> = ({ isOpen, material, onClose, onSubmit, existingMaterials = [], suppliers, setSuppliers, onToast }) => {
  // Fallback toast handler using alert if onToast not provided
  const showToast: ToastFn = onToast || ((title, message) => alert(`${title}: ${message}`));
  
  const [formData, setFormData] = useState({
    supplier: "",
    supplierPhone: "",
    paymentMethod: "cash", // Phương thức thanh toán
    paymentStatus: "pending", // Trạng thái thanh toán
    partialPaymentAmount: 0, // Số tiền thanh toán trước (cho thanh toán một phần)
  });

  const [materials, setMaterials] = useState<MaterialItem[]>([createEmptyMaterialItem(1)]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSupplierDropdownOpen, setIsSupplierDropdownOpen] = useState(false);
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<number | null>(null);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierPhone, setNewSupplierPhone] = useState("");
  const [newSupplierAddress, setNewSupplierAddress] = useState("");
  const [newSupplierEmail, setNewSupplierEmail] = useState("");
  const [newSupplierNotes, setNewSupplierNotes] = useState("");
  const [newProductName, setNewProductName] = useState("");
  const [newProductSku, setNewProductSku] = useState("");
  const [newProductUnit, setNewProductUnit] = useState("cái");
  const [newUnit, setNewUnit] = useState("");
  const [customUnits, setCustomUnits] = useState<string[]>([]);
  const supplierInputRef = useRef<HTMLDivElement>(null);
  const productInputRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  const ensureMaterialItems = (items?: any[]): MaterialItem[] => {
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

  // Supplier list combining context suppliers and existing materials (unique suppliers)
  const materialsSuppliers = Array.from(
    new Set(existingMaterials.map((m) => m.supplier).filter(Boolean))
  ).map((name) => ({
    name: name as string,
    phone: "", // Phone can be extracted if stored in material data
  }));

  // Combine context suppliers with materials suppliers, prioritizing context suppliers
  const normalizedSuppliers = suppliers
    .filter((s) => Boolean(s.name))
    .map((s) => ({ name: s.name as string, phone: s.phone || "" }));

  const availableSuppliers = [
    ...normalizedSuppliers,
    ...materialsSuppliers.filter((ms) => !normalizedSuppliers.some((s) => s.name === ms.name)),
  ];

  // Product list from existing materials in database
  const availableProducts = existingMaterials.map((m) => ({
    name: m.name,
    sku: m.sku,
    unit: m.unit,
    purchasePrice: m.purchasePrice ?? 0,
    retailPrice: m.retailPrice ?? 0,
    wholesalePrice: m.wholesalePrice ?? 0,
  }));

  // Get all available units (from existing materials + custom units)
  const baseUnits = ["cái", "kg", "mét", "lít", "cuộn", "bộ", "hộp", "thùng"];
  const existingUnits = Array.from(new Set(existingMaterials.map((m) => m.unit).filter(Boolean)));
  const allAvailableUnits = Array.from(new Set([...baseUnits, ...existingUnits, ...customUnits]));

  useEffect(() => {
    if (isOpen) {
      if (material) {
        // Nếu edit một sản phẩm cụ thể, điền vào dòng đầu tiên
        setMaterials([
          normalizeMaterialItem({
            id: 1,
            name: material.name || "",
            sku: material.sku || "",
            unit: material.unit || "cái",
            purchasePrice: material.purchasePrice || 0,
            retailPrice: material.retailPrice ?? 0,
            wholesalePrice: material.wholesalePrice ?? 0,
            quantity: 1,
            totalCost: (material.purchasePrice || 0) * 1,
          }),
        ]);
        setFormData({
          supplier: material.supplier || "",
          supplierPhone: material.supplierPhone || "",
          paymentMethod: "cash",
          paymentStatus: "pending",
          partialPaymentAmount: 0,
        });
      } else {
        // Try to load saved data from localStorage
        const savedData = localStorage.getItem("materialFormDraft");
        if (savedData) {
          try {
            const parsed = JSON.parse(savedData);
            setMaterials(ensureMaterialItems(parsed.materials));
            setFormData(
              parsed.formData || {
                supplier: "",
                supplierPhone: "",
                paymentMethod: "cash",
                paymentStatus: "pending",
                partialPaymentAmount: 0,
              }
            );
          } catch (e) {
            // If parsing fails, use default values
            setMaterials([createEmptyMaterialItem(1)]);
            setFormData({
              supplier: "",
              supplierPhone: "",
              paymentMethod: "cash",
              paymentStatus: "pending",
              partialPaymentAmount: 0,
            });
          }
        } else {
          // Reset form cho nhập mới
          setMaterials([createEmptyMaterialItem(1)]);
          setFormData({
            supplier: "",
            supplierPhone: "",
            paymentMethod: "cash",
            paymentStatus: "pending",
            partialPaymentAmount: 0,
          });
        }
      }
    }
  }, [isOpen, material]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (supplierInputRef.current && !supplierInputRef.current.contains(event.target as Node)) {
        setIsSupplierDropdownOpen(false);
      }

      // Check product dropdowns
      if (isProductDropdownOpen !== null) {
        const ref = productInputRefs.current[isProductDropdownOpen];
        if (ref && !ref.contains(event.target as Node)) {
          setIsProductDropdownOpen(null);
        }
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProductDropdownOpen]);

  // Track whether form has unsaved data
  const hasFormData = useMemo(() => {
    return isOpen && (
      formData.supplier.trim() !== "" ||
      formData.supplierPhone.trim() !== "" ||
      materials.some((m) => m.name.trim() !== "" || m.purchasePrice > 0 || m.quantity > 1)
    );
  }, [isOpen, formData, materials]);

  // Save form data to localStorage when data changes
  useEffect(() => {
    if (!isOpen) return;

    if (hasFormData) {
      localStorage.setItem(
        "materialFormDraft",
        JSON.stringify({
          formData,
          materials,
          timestamp: Date.now(),
        })
      );
    }
  }, [isOpen, hasFormData, formData, materials]);

  // Prevent page reload when form has data - separated to avoid memory leak
  useEffect(() => {
    if (!hasFormData) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasFormData]);

  // Tính tổng tiền tất cả sản phẩm
  const grandTotal = materials.reduce((sum: number, item: MaterialItem) => sum + item.totalCost, 0);

  // Thêm dòng sản phẩm mới
  const addMaterialRow = () => {
    const newId = Math.max(...materials.map((m: MaterialItem) => m.id)) + 1;
    setMaterials((prev: MaterialItem[]) => [...prev, createEmptyMaterialItem(newId)]);
  };

  // Xóa dòng sản phẩm
  const removeMaterialRow = (id: number) => {
    if (materials.length > 1) {
      setMaterials((prev: MaterialItem[]) => prev.filter((m: MaterialItem) => m.id !== id));
    }
  };

  // Cập nhật thông tin sản phẩm
  const updateMaterial = (id: number, field: keyof MaterialItem, value: any) => {
    setMaterials((prev: MaterialItem[]) =>
      prev.map((item: MaterialItem) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Tự động tính lại tổng tiền
          if (field === "purchasePrice" || field === "quantity") {
            updated.totalCost = updated.purchasePrice * updated.quantity;
          }
          return updated;
        }
        return item;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Kiểm tra có ít nhất 1 sản phẩm hợp lệ
    const validMaterials = materials.filter(
      (m: MaterialItem) => m.name.trim() && m.purchasePrice >= 0 && m.quantity > 0
    );
    if (validMaterials.length === 0) {
      showToast("Thông báo", "Vui lòng nhập ít nhất một sản phẩm hợp lệ!", "warn");
      return;
    }

    setIsSubmitting(true);
    try {
      // Tự động tạo số phiếu nhập và ngày hiện tại
      const autoInvoiceNumber = `IMP-${Date.now()}`;
      const currentDate = new Date().toISOString().split("T")[0];

      // Tạo danh sách tạm để track SKU đã tạo trong batch này
      const tempMaterials = [...existingMaterials];

      // Lưu từng sản phẩm hợp lệ
      for (const material of validMaterials) {
        // Generate SKU dựa trên danh sách đã update
        const generatedSKU = material.sku || generateMaterialSKU(tempMaterials);

        const materialData = {
          name: material.name,
          sku: generatedSKU,
          unit: material.unit,
          purchasePrice: material.purchasePrice,
          retailPrice: material.retailPrice,
          wholesalePrice: material.wholesalePrice,
          quantity: material.quantity,
          totalCost: material.totalCost,
          supplier: formData.supplier,
          supplierPhone: formData.supplierPhone,
          invoiceNumber: autoInvoiceNumber,
          importDate: currentDate,
          paymentMethod: formData.paymentMethod,
          paymentStatus: formData.paymentStatus,
          description: `Phiếu nhập ${autoInvoiceNumber} - Tổng: ${formatCurrency(grandTotal)}`,
        };

        await onSubmit({ ...materialData, stock: materialData.quantity });

        // Thêm vào danh sách tạm để SKU tiếp theo sẽ tăng
        tempMaterials.push({
          ...materialData,
          id: generateId(),
          stock: materialData.quantity,
          branch_id: "",
          created_at: currentDate,
          updated_at: currentDate,
        } as PinMaterial);
      }
      // Clear saved draft after successful submission
      localStorage.removeItem("materialFormDraft");
      onClose();
    } catch (error) {
      console.error("Submit error:", error);
      showToast("Lỗi", "Lỗi khi lưu: " + getErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-7xl max-h-[95vh] overflow-y-auto overflow-x-visible shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-4 sm:px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center rounded-t-xl">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">
              {material ? "📦 Nhập kho bổ sung" : "📝 Tạo phiếu nhập kho"}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {material
                ? "Thêm số lượng cho nguyên vật liệu có sẵn"
                : "Tạo mới hoặc nhập thêm nguyên vật liệu"}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* --- 1. Nhà cung cấp --- */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <h4 className="text-base font-semibold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center">
                🏢 Nhà cung cấp
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="relative" ref={supplierInputRef}>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                    Tên nhà cung cấp (*)
                  </label>
                  <div className="flex">
                    <input
                      type="text"
                      value={formData.supplier}
                      onChange={(e) => {
                        setFormData((prev) => ({
                          ...prev,
                          supplier: e.target.value,
                        }));
                        setIsSupplierDropdownOpen(true);
                      }}
                      onFocus={() => setIsSupplierDropdownOpen(true)}
                      className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-l-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
                      placeholder="Tìm hoặc thêm nhà cung cấp..."
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      onClick={() => setShowSupplierModal(true)}
                      className="px-4 py-3 border-t border-r border-b border-gray-300 dark:border-gray-600 rounded-r-lg bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      disabled={isSubmitting}
                      title="Thêm nhà cung cấp mới"
                    >
                      <PlusIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                    </button>
                  </div>
                  {isSupplierDropdownOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {availableSuppliers
                        .filter(
                          (s) =>
                            !formData.supplier ||
                            s.name.toLowerCase().includes(formData.supplier.toLowerCase())
                        )
                        .map((supplier, index) => (
                          <div
                            key={index}
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                supplier: supplier.name,
                                supplierPhone: supplier.phone,
                              }));
                              setIsSupplierDropdownOpen(false);
                            }}
                            className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {supplier.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {supplier.phone}
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                    Số điện thoại NCC
                  </label>
                  <input
                    type="tel"
                    value={formData.supplierPhone}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        supplierPhone: e.target.value,
                      }))
                    }
                    className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
                    placeholder="0xxx xxx xxx"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>

            {/* --- 2. Danh sách sản phẩm --- */}
            <div
              className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700"
              style={{ overflow: "visible" }}
            >
              <div className="flex justify-between items-center mb-3">
                <h4 className="text-base font-semibold text-blue-800 dark:text-blue-200 flex items-center">
                  📦 Danh sách sản phẩm
                </h4>
                <button
                  type="button"
                  onClick={addMaterialRow}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm flex items-center gap-2"
                  disabled={isSubmitting}
                >
                  <PlusIcon className="w-4 h-4" />
                  Thêm
                </button>
              </div>

              <div
                className="w-full overflow-x-scroll"
                style={{
                  overflowX: "scroll",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "thin",
                  msOverflowStyle: "scrollbar",
                }}
              >
                <table className="w-full min-w-[1200px] border border-gray-300 dark:border-gray-600 rounded-lg overflow-visible">
                  <thead className="bg-gray-100 dark:bg-gray-700">
                    <tr>
                      <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[280px]">
                        Tên sản phẩm (*)
                      </th>
                      <th className="hidden p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[12%]">
                        SKU
                      </th>
                      <th className="p-2 text-left text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[70px]">
                        Đơn vị
                      </th>
                      <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[110px]">
                        Giá nhập (*)
                      </th>
                      <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[110px]">
                        Giá bán lẻ
                      </th>
                      <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[110px]">
                        Giá bán sỉ
                      </th>
                      <th className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[60px]">
                        SL (*)
                      </th>
                      <th className="p-2 text-right text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[120px]">
                        Tổng tiền
                      </th>
                      <th className="p-2 text-center text-sm font-semibold text-gray-700 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 w-[50px]">
                        Xóa
                      </th>
                    </tr>
                  </thead>
                  <tbody className="relative">
                    {materials.map((item) => (
                      <tr
                        key={item.id}
                        className="border-b border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      >
                        <td
                          className="p-2 w-[280px]"
                          style={{
                            position: "relative",
                            overflow: "visible",
                          }}
                        >
                          <div
                            className="relative"
                            ref={(el) => {
                              productInputRefs.current[item.id] = el;
                            }}
                          >
                            <div className="flex">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => {
                                  updateMaterial(item.id, "name", e.target.value);
                                  setIsProductDropdownOpen(item.id);
                                }}
                                onFocus={() => setIsProductDropdownOpen(item.id)}
                                className="flex-1 p-1.5 border border-gray-300 dark:border-gray-600 rounded-l bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500"
                                placeholder="Tìm hoặc thêm sản phẩm..."
                                disabled={isSubmitting}
                              />
                              <button
                                type="button"
                                onClick={() => setShowProductModal(true)}
                                className="px-2 py-1.5 border-t border-r border-b border-gray-300 dark:border-gray-600 rounded-r bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                                disabled={isSubmitting}
                                title="Thêm sản phẩm mới"
                              >
                                <PlusIcon className="w-4 h-4 text-gray-700 dark:text-gray-200" />
                              </button>
                            </div>
                            {isProductDropdownOpen === item.id && (
                              <div className="absolute z-[100] top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto min-w-[300px]">
                                {availableProducts
                                  .filter(
                                    (p) =>
                                      !item.name ||
                                      p.name.toLowerCase().includes(item.name.toLowerCase())
                                  )
                                  .map((product, index) => (
                                    <div
                                      key={index}
                                      onClick={() => {
                                        updateMaterial(item.id, "name", product.name);
                                        updateMaterial(item.id, "sku", product.sku);
                                        updateMaterial(item.id, "unit", product.unit);
                                        updateMaterial(
                                          item.id,
                                          "purchasePrice",
                                          product.purchasePrice ?? 0
                                        );
                                        updateMaterial(
                                          item.id,
                                          "retailPrice",
                                          product.retailPrice ?? 0
                                        );
                                        updateMaterial(
                                          item.id,
                                          "wholesalePrice",
                                          product.wholesalePrice ?? 0
                                        );
                                        setIsProductDropdownOpen(null);
                                      }}
                                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0"
                                    >
                                      <div className="font-medium text-gray-900 dark:text-white text-sm">
                                        {product.name}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {product.sku} • {product.unit}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="hidden p-2 w-[12%]">
                          <input
                            type="text"
                            value={item.sku}
                            onChange={(e) => updateMaterial(item.id, "sku", e.target.value)}
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500"
                            placeholder="Auto"
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="p-2 w-[70px]">
                          <div className="flex gap-0 w-full max-w-[70px]">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) => updateMaterial(item.id, "unit", e.target.value)}
                              className="flex-1 px-1 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-xs focus:ring-1 focus:ring-blue-500 min-w-0"
                              placeholder=""
                              disabled={isSubmitting}
                            />
                          </div>
                        </td>
                        <td className="p-2 w-[110px]">
                          <input
                            type="number"
                            value={item.purchasePrice}
                            onChange={(e) =>
                              updateMaterial(item.id, "purchasePrice", Number(e.target.value))
                            }
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500 text-right"
                            placeholder="0"
                            min="0"
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="p-2 w-[110px]">
                          <input
                            type="number"
                            value={item.retailPrice}
                            onChange={(e) =>
                              updateMaterial(item.id, "retailPrice", Number(e.target.value))
                            }
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500 text-right"
                            placeholder="0"
                            min="0"
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="p-2 w-[110px]">
                          <input
                            type="number"
                            value={item.wholesalePrice}
                            onChange={(e) =>
                              updateMaterial(item.id, "wholesalePrice", Number(e.target.value))
                            }
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500 text-right"
                            placeholder="0"
                            min="0"
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="p-2 w-[60px]">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateMaterial(item.id, "quantity", Number(e.target.value))
                            }
                            className="w-full p-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-1 focus:ring-blue-500 text-center"
                            placeholder="1"
                            min="1"
                            disabled={isSubmitting}
                          />
                        </td>
                        <td className="p-2 w-[120px]">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400 text-right">
                            {formatCurrency(item.totalCost)}
                          </div>
                        </td>
                        <td className="p-2 text-center w-[50px]">
                          <button
                            type="button"
                            onClick={() => removeMaterialRow(item.id)}
                            className="text-red-500 hover:text-red-700 p-1 rounded transition-colors"
                            disabled={materials.length <= 1 || isSubmitting}
                            title="Xóa dòng này"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tổng cộng */}
              <div className="mt-3 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg border">
                <div className="flex justify-between items-center">
                  <span className="text-base font-semibold text-gray-700 dark:text-gray-200">
                    🧮 Tổng giá trị:
                  </span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(grandTotal)}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Tổng {materials.filter((m: MaterialItem) => m.name.trim()).length} sản phẩm
                </div>
              </div>
            </div>

            {/* --- 3. Thanh toán --- */}
            <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-700 shadow-sm">
              <h4 className="text-base font-bold text-orange-800 dark:text-orange-200 mb-3 flex items-center gap-2">
                <span className="text-xl">💳</span>
                <span>Thanh toán</span>
              </h4>

              <div className="space-y-3">
                {/* Phương thức và trạng thái thanh toán */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                      Phương thức
                    </label>
                    <select
                      value={formData.paymentMethod}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentMethod: e.target.value,
                        }))
                      }
                      className="w-full p-2 border-0 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
                      disabled={isSubmitting}
                    >
                      <option value="cash">💵 Tiền mặt</option>
                      <option value="bank_transfer">🏦 Chuyển khoản</option>
                      <option value="credit">📝 Công nợ</option>
                      <option value="check">📊 Số sách</option>
                    </select>
                  </div>

                  <div className="bg-white dark:bg-gray-800 p-2.5 rounded-lg border border-gray-200 dark:border-gray-600">
                    <label className="block text-xs font-semibold mb-1 text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                      Trạng thái
                    </label>
                    <select
                      value={formData.paymentStatus}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          paymentStatus: e.target.value,
                        }))
                      }
                      className="w-full p-2 border-0 bg-gray-50 dark:bg-gray-700 rounded-md text-sm text-gray-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
                      disabled={isSubmitting}
                    >
                      <option value="pending">⏳ Đang chờ</option>
                      <option value="partial">⚡ Một phần</option>
                      <option value="paid">✅ Đã thanh toán</option>
                      <option value="overdue">⚠️ Quá hạn</option>
                    </select>
                  </div>
                </div>

                {/* Thanh toán một phần */}
                {formData.paymentStatus === "partial" && (
                  <div className="bg-white dark:bg-gray-800 p-3 rounded-lg border-2 border-yellow-300 dark:border-yellow-600 shadow-sm">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">💰</span>
                      <label className="text-xs font-bold text-gray-800 dark:text-gray-200">
                        Số tiền thanh toán trước
                      </label>
                    </div>
                    <input
                      type="number"
                      value={formData.partialPaymentAmount}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          partialPaymentAmount: Number(e.target.value),
                        }))
                      }
                      className="w-full p-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white text-base font-semibold focus:ring-2 focus:ring-yellow-500 dark:focus:ring-yellow-400 focus:border-yellow-500 transition-all"
                      placeholder="0"
                      min="0"
                      max={grandTotal}
                      disabled={isSubmitting}
                    />

                    {/* Bảng tính toán */}
                    <div className="mt-2 space-y-1.5 bg-gray-50 dark:bg-gray-700/50 p-2.5 rounded-lg">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Tổng giá trị</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {formatCurrency(grandTotal)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 dark:text-gray-400">Thanh toán trước</span>
                        <span className="font-bold text-green-600 dark:text-green-400">
                          - {formatCurrency(formData.partialPaymentAmount)}
                        </span>
                      </div>
                      <div className="h-px bg-gray-300 dark:bg-gray-600"></div>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200">
                          Còn lại
                        </span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(grandTotal - formData.partialPaymentAmount)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Tổng quan thanh toán */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                        Thanh toán
                      </div>
                      <div className="text-lg font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(
                          formData.paymentStatus === "partial"
                            ? formData.partialPaymentAmount
                            : formData.paymentStatus === "paid"
                              ? grandTotal
                              : 0
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide mb-0.5">
                        Tổng đơn
                      </div>
                      <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                        {formatCurrency(grandTotal)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors font-medium"
              disabled={isSubmitting}
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg disabled:opacity-50 transition-colors font-medium shadow-lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Đang lưu..." : "🚀 Tạo phiếu nhập kho"}
            </button>
          </div>
        </form>
      </div>

      {/* Modal thêm nhà cung cấp mới */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                📦 Thêm nhà cung cấp mới
              </h3>
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setNewSupplierName("");
                  setNewSupplierPhone("");
                  setNewSupplierAddress("");
                  setNewSupplierEmail("");
                  setNewSupplierNotes("");
                }}
                className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  📦 Tên nhà cung cấp (*)
                </label>
                <input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nhập tên nhà cung cấp..."
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  📞 Số điện thoại
                </label>
                <input
                  type="tel"
                  value={newSupplierPhone}
                  onChange={(e) => setNewSupplierPhone(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="0xxx xxx xxx"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  📍 Địa chỉ
                </label>
                <textarea
                  value={newSupplierAddress}
                  onChange={(e) => setNewSupplierAddress(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Nhập địa chỉ nhà cung cấp..."
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  ✉️ Email
                </label>
                <input
                  type="email"
                  value={newSupplierEmail}
                  onChange={(e) => setNewSupplierEmail(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  📝 Ghi chú
                </label>
                <textarea
                  value={newSupplierNotes}
                  onChange={(e) => setNewSupplierNotes(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                  placeholder="Thêm ghi chú về nhà cung cấp..."
                  rows={3}
                />
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-t dark:border-gray-700 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowSupplierModal(false);
                  setNewSupplierName("");
                  setNewSupplierPhone("");
                  setNewSupplierAddress("");
                  setNewSupplierEmail("");
                  setNewSupplierNotes("");
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newSupplierName.trim()) {
                    // Tạo supplier object và lưu vào context nếu cần
                    const newSupplier: Supplier = {
                      id: `SUP-${Date.now()}`,
                      name: newSupplierName.trim(),
                      phone: newSupplierPhone.trim(),
                      address: newSupplierAddress.trim(),
                      email: newSupplierEmail.trim(),
                      notes: newSupplierNotes.trim(),
                    };

                    // Lưu vào danh sách suppliers chung
                    setSuppliers((prev) => [newSupplier, ...prev]);

                    // Cập nhật form data
                    setFormData((prev) => ({
                      ...prev,
                      supplier: newSupplierName.trim(),
                      supplierPhone: newSupplierPhone.trim(),
                    }));

                    // Reset và đóng modal
                    setNewSupplierName("");
                    setNewSupplierPhone("");
                    setNewSupplierAddress("");
                    setNewSupplierEmail("");
                    setNewSupplierNotes("");
                    setShowSupplierModal(false);

                    // Thông báo thành công
                    showToast("Thành công", "Đã thêm nhà cung cấp thành công!", "success");
                  }
                }}
                disabled={!newSupplierName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                💾 Lưu nhà cung cấp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm sản phẩm mới */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              ➕ Thêm sản phẩm mới
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                  Tên sản phẩm
                </label>
                <input
                  type="text"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Nhập tên sản phẩm..."
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                  SKU
                </label>
                <input
                  type="text"
                  value={newProductSku}
                  onChange={(e) => setNewProductSku(e.target.value)}
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Mã sản phẩm (tự động nếu để trống)..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-200">
                  Đơn vị
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newProductUnit}
                    onChange={(e) => setNewProductUnit(e.target.value)}
                    className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Nhập hoặc chọn đơn vị..."
                    list="unit-options-modal"
                  />
                  <datalist id="unit-options-modal">
                    {allAvailableUnits.map((unit) => (
                      <option key={unit} value={unit} />
                    ))}
                  </datalist>
                  <button
                    type="button"
                    onClick={() => {
                      const newUnitInput = prompt("📝 Nhập đơn vị tính mới:");
                      if (newUnitInput && newUnitInput.trim()) {
                        const trimmedUnit = newUnitInput.trim();
                        if (!allAvailableUnits.includes(trimmedUnit)) {
                          setCustomUnits((prev) => [...prev, trimmedUnit]);
                        }
                        setNewProductUnit(trimmedUnit);
                      }
                    }}
                    className="px-3 py-2 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-lg border border-gray-300 dark:border-gray-600 transition-colors"
                    title="Thêm đơn vị mới"
                  >
                    <PlusIcon className="w-5 h-5 text-gray-700 dark:text-gray-200" />
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowProductModal(false);
                    setNewProductName("");
                    setNewProductSku("");
                    setNewProductUnit("cái");
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (newProductName.trim()) {
                      // Add to first empty row or current focused row
                      const emptyRow = materials.find((m) => !m.name.trim());
                      if (emptyRow) {
                        updateMaterial(emptyRow.id, "name", newProductName);
                        updateMaterial(emptyRow.id, "sku", newProductSku || `AUTO-${Date.now()}`);
                        updateMaterial(emptyRow.id, "unit", newProductUnit);
                      }
                      setNewProductName("");
                      setNewProductSku("");
                      setNewProductUnit("cái");
                      setShowProductModal(false);
                    }
                  }}
                  disabled={!newProductName.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Thêm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal thêm đơn vị tính mới */}
      {showUnitModal && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-sm">
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-3">
              ➕ Thêm đơn vị tính
            </h3>
            <input
              type="text"
              value={newUnit}
              onChange={(e) => setNewUnit(e.target.value)}
              className="w-full p-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
              placeholder="VD: chiếc, bộ, hộp, thùng..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && newUnit.trim()) {
                  // Update the datalist - unit will be available for all rows
                  const emptyRow = materials.find((m) => !m.unit || m.unit === "cái");
                  if (emptyRow) {
                    updateMaterial(emptyRow.id, "unit", newUnit);
                  }
                  setNewUnit("");
                  setShowUnitModal(false);
                }
              }}
              autoFocus
            />
            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg mt-2">
              <p className="text-xs text-gray-600 dark:text-gray-400">
                💡 cái, kg, mét, lít, cuộn, bộ, hộp, thùng
              </p>
            </div>
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowUnitModal(false);
                  setNewUnit("");
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => {
                  if (newUnit.trim()) {
                    const emptyRow = materials.find((m) => !m.unit || m.unit === "cái");
                    if (emptyRow) {
                      updateMaterial(emptyRow.id, "unit", newUnit);
                    }
                    setNewUnit("");
                    setShowUnitModal(false);
                  }
                }}
                disabled={!newUnit.trim()}
                className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Material Detail Modal Component với tabs
const MaterialDetailModal: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
  onEdit: () => void;
  enhancedMaterials?: any[]; // Enhanced materials with commitment info
}> = ({ isOpen, material, onClose, onEdit, enhancedMaterials = [] }) => {
  const [activeTab, setActiveTab] = useState<"info" | "history">("info");
  const [stockHistory, setStockHistory] = useState<StockHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load stock history
  const loadStockHistory = async () => {
    if (!material) return;

    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("pin_stock_history")
        .select(
          `
          *,
          profiles:created_by(username)
        `
        )
        .eq("material_id", material.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setStockHistory(data || []);
    } catch (err) {
      console.error("Error loading stock history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isOpen && material && activeTab === "history") {
      loadStockHistory();
    }
  }, [isOpen, material, activeTab]);

  if (!isOpen || !material) return null;

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "import":
        return "📥";
      case "export":
        return "📤";
      case "adjustment":
        return "⚖️";
      default:
        return "📋";
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "import":
        return "text-green-600 dark:text-green-400";
      case "export":
        return "text-red-600 dark:text-red-400";
      case "adjustment":
        return "text-blue-600 dark:text-blue-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">📦 Chi tiết vật tư</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {material.name} ({material.sku})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-3 border-b border-gray-200 dark:border-gray-600">
          <nav className="flex space-x-4">
            <button
              onClick={() => setActiveTab("info")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "info"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
            >
              ℹ️ Thông tin cơ bản
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === "history"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
            >
              📋 Lịch sử nhập/xuất
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(95vh-200px)]">
          {activeTab === "info" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tên vật tư
                  </label>
                  <p className="text-gray-900 dark:text-white font-semibold">{material.name}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SKU
                  </label>
                  <p className="text-gray-900 dark:text-white font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                    {material.sku}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Đơn vị
                  </label>
                  <p className="text-gray-900 dark:text-white">{material.unit}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Giá nhập
                  </label>
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {formatCurrency(material.purchasePrice)}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tồn kho hiện tại
                  </label>
                  <div className="flex flex-col gap-2">
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {(() => {
                        const enhancedMaterial = enhancedMaterials.find(
                          (m) => m.id === material.id
                        );
                        const committedQty = enhancedMaterial?.committedQuantity || 0;
                        const availableQty = enhancedMaterial?.availableStock || material.stock;

                        if (committedQty > 0) {
                          return (
                            <>
                              <span className="text-green-600 font-bold">{availableQty}</span>
                              <span className="text-gray-500">/{material.stock}</span>
                              <span className="text-sm font-normal"> {material.unit}</span>
                            </>
                          );
                        } else {
                          return `${material.stock} ${material.unit}`;
                        }
                      })()}
                    </p>
                    {(() => {
                      const enhancedMaterial = enhancedMaterials.find((m) => m.id === material.id);
                      const committedQty = enhancedMaterial?.committedQuantity || 0;

                      if (committedQty > 0) {
                        return (
                          <div className="flex items-center gap-2 text-sm">
                            <div className="bg-amber-100 dark:bg-amber-900/30 px-2 py-1 rounded-lg text-amber-700 dark:text-amber-300">
                              🔒 Đã cam kết: {committedQty} {material.unit}
                            </div>
                            <div className="bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg text-green-700 dark:text-green-300">
                              ✅ Khả dụng: {enhancedMaterial?.availableStock} {material.unit}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nhà cung cấp
                  </label>
                  <p className="text-gray-900 dark:text-white">{material.supplier || "Chưa có"}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mô tả
                  </label>
                  <p className="text-gray-700 dark:text-gray-300">
                    {material.description || "Không có mô tả"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 Lịch sử giao dịch kho
                </h4>
                <button
                  onClick={loadStockHistory}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  🔄 Làm mới
                </button>
              </div>

              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
                  <span className="text-gray-600 dark:text-gray-400">Đang tải lịch sử...</span>
                </div>
              ) : stockHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  📭 Chưa có giao dịch nào
                </div>
              ) : (
                <div className="space-y-3">
                  {stockHistory.map((record) => (
                    <div
                      key={record.id}
                      className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">
                            {getTransactionIcon(record.transaction_type)}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`font-semibold ${getTransactionColor(
                                  record.transaction_type
                                )}`}
                              >
                                {record.transaction_type === "import"
                                  ? "Nhập kho"
                                  : record.transaction_type === "export"
                                    ? "Xuất kho"
                                    : "Điều chỉnh"}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                {new Date(record.created_at).toLocaleString("vi-VN")}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                              {record.reason}
                            </p>
                            {record.invoice_number && (
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                Số phiếu: {record.invoice_number}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold ${record.quantity_change > 0
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                              }`}
                          >
                            {record.quantity_change > 0 ? "+" : ""}
                            {record.quantity_change}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {record.quantity_before} → {record.quantity_after}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={onEdit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <PencilSquareIcon className="w-4 h-4" />
            Chỉnh sửa
          </button>
        </div>
      </div>
    </div>
  );
};

// Material Edit Modal Component - Để chỉnh sửa thông tin vật liệu
const MaterialEditModal: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
  onSave: (updatedMaterial: PinMaterial) => Promise<void>;
  suppliers: Supplier[];
  onToast?: ToastFn;
}> = ({ isOpen, material, onClose, onSave, suppliers, onToast }) => {
  // Fallback toast handler
  const showToast: ToastFn = onToast || ((title, message) => alert(`${title}: ${message}`));

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "cái",
    purchasePrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    supplier: "",
    supplierPhone: "",
    description: "",
    category: "" as "" | "material" | "product" | "finished_goods",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && material) {
      setFormData({
        name: material.name || "",
        sku: material.sku || "",
        unit: material.unit || "cái",
        purchasePrice: material.purchasePrice || 0,
        retailPrice: material.retailPrice || 0,
        wholesalePrice: material.wholesalePrice || 0,
        supplier: material.supplier || "",
        supplierPhone: material.supplierPhone || "",
        description: material.description || "",
        category: material.category || "",
      });
    }
  }, [isOpen, material]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "number" ? Number(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material || isSubmitting) return;

    if (!formData.name.trim()) {
      showToast("Thông báo", "Vui lòng nhập tên vật liệu!", "warn");
      return;
    }

    setIsSubmitting(true);
    try {
      const updatedMaterial: PinMaterial = {
        ...material,
        name: formData.name.trim(),
        sku: formData.sku.trim(),
        unit: formData.unit,
        purchasePrice: formData.purchasePrice,
        retailPrice: formData.retailPrice,
        wholesalePrice: formData.wholesalePrice,
        supplier: formData.supplier.trim(),
        supplierPhone: formData.supplierPhone.trim(),
        description: formData.description.trim(),
        category: formData.category || undefined,
      };

      // Also update in Supabase to ensure category is saved
      await onSave(updatedMaterial);
      onClose();
    } catch (error) {
      console.error("Error saving material:", error);
      showToast("Lỗi", "Lỗi khi lưu vật liệu: " + getErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !material) return null;

  const baseUnits = ["cái", "Cell", "kg", "mét", "lít", "cuộn", "bộ", "hộp", "thùng"];

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              ✏️ Chỉnh sửa vật liệu
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Cập nhật thông tin vật liệu
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Tên và SKU */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên vật liệu <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập tên vật liệu"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU
                </label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300"
                  placeholder="SKU"
                  readOnly
                />
              </div>
            </div>

            {/* Đơn vị và Loại */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Đơn vị
                </label>
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {baseUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Loại
                </label>
                <select
                  name="category"
                  value={formData.category}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">-- Chọn loại --</option>
                  <option value="material">Vật tư</option>
                  <option value="product">Sản phẩm</option>
                  <option value="finished_goods">Thành phẩm</option>
                </select>
              </div>
            </div>

            {/* Giá nhập */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Giá nhập (VNĐ)
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Giá bán lẻ và Giá bán sỉ */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Giá bán lẻ (VNĐ)
                </label>
                <input
                  type="number"
                  name="retailPrice"
                  value={formData.retailPrice}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Giá bán sỉ (VNĐ)
                </label>
                <input
                  type="number"
                  name="wholesalePrice"
                  value={formData.wholesalePrice}
                  onChange={handleChange}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Nhà cung cấp */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nhà cung cấp
                </label>
                <input
                  type="text"
                  name="supplier"
                  value={formData.supplier}
                  onChange={handleChange}
                  list="suppliers-list"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Chọn hoặc nhập mới"
                />
                <datalist id="suppliers-list">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SĐT nhà cung cấp
                </label>
                <input
                  type="text"
                  name="supplierPhone"
                  value={formData.supplierPhone}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Số điện thoại"
                />
              </div>
            </div>

            {/* Ghi chú */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Ghi chú
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                placeholder="Ghi chú thêm..."
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <span className="animate-spin">⏳</span>
                  Đang lưu...
                </>
              ) : (
                <>
                  <Icon name="check-circle" weight="bold" className="w-4 h-4" />
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Stock Adjustment Modal Component
const StockAdjustmentModal: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
  onSubmit: (adjustment: StockAdjustment) => Promise<void>;
  onToast?: ToastFn;
}> = ({ isOpen, material, onClose, onSubmit, onToast }) => {
  // Fallback toast handler
  const showToast: ToastFn = onToast || ((title, message) => alert(`${title}: ${message}`));

  const [actualStock, setActualStock] = useState<number>(0);
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && material) {
      setActualStock(material.stock);
      setReason("");
      setNote("");
    }
  }, [isOpen, material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!material || isSubmitting) return;

    if (!reason.trim()) {
      showToast("Thông báo", "Vui lòng nhập lý do điều chỉnh!", "warn");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        material_id: material.id,
        current_stock: material.stock,
        actual_stock: actualStock,
        reason: reason.trim(),
        note: note.trim(),
      });
      onClose();
    } catch (error) {
      console.error("Stock adjustment error:", error);
      showToast("Lỗi", "Lỗi khi điều chỉnh tồn kho: " + getErrorMessage(error), "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !material) return null;

  const difference = actualStock - material.stock;
  const isIncrease = difference > 0;
  const isDecrease = difference < 0;

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-2xl shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              ⚖️ Điều chỉnh tồn kho
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {material.name} ({material.sku})
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            {/* Current vs Actual Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <label className="block text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                  📊 Tồn kho hệ thống
                </label>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {material.stock} {material.unit}
                </p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <label className="block text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  📦 Tồn kho thực tế (*)
                </label>
                <input
                  type="number"
                  value={actualStock}
                  onChange={(e) => setActualStock(Number(e.target.value))}
                  className="w-full text-2xl font-bold bg-transparent border-none p-0 text-green-600 dark:text-green-400 focus:ring-0"
                  min="0"
                  required
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Difference Display */}
            {difference !== 0 && (
              <div
                className={`p-4 rounded-lg border ${isIncrease
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                  }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-semibold ${isIncrease
                      ? "text-green-800 dark:text-green-200"
                      : "text-red-800 dark:text-red-200"
                      }`}
                  >
                    {isIncrease ? "📈 Tăng kho:" : "📉 Giảm kho:"}
                  </span>
                  <span
                    className={`text-xl font-bold ${isIncrease
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                      }`}
                  >
                    {isIncrease ? "+" : ""}
                    {difference} {material.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Reason */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                🏷️ Lý do điều chỉnh (*)
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                required
                disabled={isSubmitting}
              >
                <option value="">-- Chọn lý do --</option>
                <option value="Kiểm kho định kỳ">Kiểm kho định kỳ</option>
                <option value="Hàng hỏng">Hàng hỏng</option>
                <option value="Thất thoát">Thất thoát</option>
                <option value="Sai sót nhập liệu">Sai sót nhập liệu</option>
                <option value="Trả hàng nhà cung cấp">Trả hàng nhà cung cấp</option>
                <option value="Khác">Khác</option>
              </select>
            </div>

            {/* Note */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                📝 Ghi chú bổ sung
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 resize-none"
                rows={3}
                placeholder="Mô tả chi tiết lý do điều chỉnh..."
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting || difference === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Đang xử lý...
                </>
              ) : (
                <>⚖️ Điều chỉnh tồn kho</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Stock Forecast Modal Component
const StockForecastModal: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
}> = ({ isOpen, material, onClose }) => {
  const [forecast, setForecast] = useState<StockForecast | null>(null);
  const [loading, setLoading] = useState(false);

  // Tính toán dự báo tồn kho
  const calculateForecast = async () => {
    if (!material) return;

    setLoading(true);
    try {
      // Lấy lịch sử giao dịch trong 90 ngày qua
      const { data: history, error } = await supabase
        .from("pin_stock_history")
        .select("*")
        .eq("material_id", material.id)
        .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Tính toán tiêu thụ trung bình
      const exportTransactions = history?.filter((h) => h.transaction_type === "export") || [];
      const totalConsumption = exportTransactions.reduce(
        (sum, t) => sum + Math.abs(t.quantity_change),
        0
      );
      const monthlyConsumption = totalConsumption / 3; // 90 ngày = 3 tháng

      // Dự báo tồn kho
      const forecast30 = Math.max(0, material.stock - monthlyConsumption * 1);
      const forecast60 = Math.max(0, material.stock - monthlyConsumption * 2);
      const forecast90 = Math.max(0, material.stock - monthlyConsumption * 3);

      // Xu hướng tiêu thụ
      const recentTransactions = exportTransactions.slice(0, 10);
      const olderTransactions = exportTransactions.slice(10, 20);
      const recentAvg =
        recentTransactions.reduce((sum, t) => sum + Math.abs(t.quantity_change), 0) /
        Math.max(1, recentTransactions.length);
      const olderAvg =
        olderTransactions.reduce((sum, t) => sum + Math.abs(t.quantity_change), 0) /
        Math.max(1, olderTransactions.length);

      let trend: "increasing" | "stable" | "decreasing" = "stable";
      if (recentAvg > olderAvg * 1.2) trend = "increasing";
      else if (recentAvg < olderAvg * 0.8) trend = "decreasing";

      // Mức độ rủi ro
      let riskLevel: "low" | "medium" | "high" | "critical" = "low";
      if (forecast30 <= 0) riskLevel = "critical";
      else if (forecast30 <= monthlyConsumption * 0.5) riskLevel = "high";
      else if (forecast60 <= monthlyConsumption * 0.5) riskLevel = "medium";

      // Ngày nên đặt hàng lại
      const daysUntilEmpty =
        monthlyConsumption > 0 ? material.stock / (monthlyConsumption / 30) : 999;
      const reorderDate = new Date(Date.now() + (daysUntilEmpty - 14) * 24 * 60 * 60 * 1000);

      const forecastData: StockForecast = {
        material_id: material.id,
        material_name: material.name,
        current_stock: material.stock,
        average_monthly_consumption: monthlyConsumption,
        forecasted_stock_30_days: forecast30,
        forecasted_stock_60_days: forecast60,
        forecasted_stock_90_days: forecast90,
        recommended_reorder_date: reorderDate.toISOString().split("T")[0],
        recommended_reorder_quantity: Math.ceil(monthlyConsumption * 2), // 2 tháng
        risk_level: riskLevel,
        trend: trend,
      };

      setForecast(forecastData);
    } catch (err) {
      console.error("Error calculating forecast:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && material) {
      calculateForecast();
    }
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case "critical":
        return "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30";
      case "high":
        return "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-100 dark:bg-yellow-900/30";
      default:
        return "text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30";
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "increasing":
        return "📈";
      case "decreasing":
        return "📉";
      default:
        return "📊";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              🔮 Dự báo tồn kho thông minh
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {material.name} ({material.sku})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-gray-600 dark:text-gray-400">Đang phân tích...</span>
            </div>
          ) : forecast ? (
            <div className="space-y-6">
              {/* Risk Assessment */}
              <div className={`p-4 rounded-lg border ${getRiskColor(forecast.risk_level)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold mb-1">
                      ⚠️ Mức độ rủi ro: {forecast.risk_level.toUpperCase()}
                    </h4>
                    <p className="text-sm opacity-80">
                      {forecast.risk_level === "critical" && "Cần đặt hàng ngay lập tức!"}
                      {forecast.risk_level === "high" && "Nên đặt hàng trong tuần tới"}
                      {forecast.risk_level === "medium" && "Có thể đặt hàng trong tháng tới"}
                      {forecast.risk_level === "low" && "Tồn kho ổn định trong thời gian tới"}
                    </p>
                  </div>
                  <span className="text-2xl">{getTrendIcon(forecast.trend)}</span>
                </div>
              </div>

              {/* Current Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📊 Tồn kho hiện tại
                  </h5>
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {forecast.current_stock}
                  </p>
                  <p className="text-sm text-blue-600 dark:text-blue-400">{material.unit}</p>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h5 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                    📉 Tiêu thụ tháng
                  </h5>
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {Math.round(forecast.average_monthly_consumption)}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    {material.unit}/tháng
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    📅 Nên đặt hàng
                  </h5>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {new Date(forecast.recommended_reorder_date).toLocaleDateString("vi-VN")}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {forecast.recommended_reorder_quantity} {material.unit}
                  </p>
                </div>
              </div>

              {/* Forecast Timeline */}
              <div className="space-y-4">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                  📊 Dự báo tồn kho
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      30 ngày tới
                    </h5>
                    <p
                      className={`text-xl font-bold ${forecast.forecasted_stock_30_days <= 0
                        ? "text-red-600 dark:text-red-400"
                        : forecast.forecasted_stock_30_days <= 10
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-green-600 dark:text-green-400"
                        }`}
                    >
                      {Math.round(forecast.forecasted_stock_30_days)} {material.unit}
                    </p>
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      60 ngày tới
                    </h5>
                    <p
                      className={`text-xl font-bold ${forecast.forecasted_stock_60_days <= 0
                        ? "text-red-600 dark:text-red-400"
                        : forecast.forecasted_stock_60_days <= 10
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-green-600 dark:text-green-400"
                        }`}
                    >
                      {Math.round(forecast.forecasted_stock_60_days)} {material.unit}
                    </p>
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                    <h5 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                      90 ngày tới
                    </h5>
                    <p
                      className={`text-xl font-bold ${forecast.forecasted_stock_90_days <= 0
                        ? "text-red-600 dark:text-red-400"
                        : forecast.forecasted_stock_90_days <= 10
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-green-600 dark:text-green-400"
                        }`}
                    >
                      {Math.round(forecast.forecasted_stock_90_days)} {material.unit}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  💡 Gợi ý
                </h4>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  {forecast.risk_level === "critical" && (
                    <li className="flex items-start gap-2">
                      <span className="text-red-500">⚠️</span>
                      <span>
                        Kho sắp hết! Cần đặt hàng ngay lập tức để tránh gian đoạn sản xuất.
                      </span>
                    </li>
                  )}
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500">📋</span>
                    <span>
                      Nên đặt hàng {forecast.recommended_reorder_quantity} {material.unit} vào ngày{" "}
                      {new Date(forecast.recommended_reorder_date).toLocaleDateString("vi-VN")}
                    </span>
                  </li>
                  {forecast.trend === "increasing" && (
                    <li className="flex items-start gap-2">
                      <span className="text-green-500">📈</span>
                      <span>Xu hướng tiêu thụ đang tăng, cân nhắc tăng lượng đặt hàng.</span>
                    </li>
                  )}
                  {forecast.trend === "decreasing" && (
                    <li className="flex items-start gap-2">
                      <span className="text-orange-500">📉</span>
                      <span>Xu hướng tiêu thụ đang giảm, có thể giảm lượng đặt hàng.</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              📉 Chưa có đủ dữ liệu để dự báo
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Supplier Price Analysis Modal Component
const SupplierPriceAnalysisModal: React.FC<{
  isOpen: boolean;
  material: PinMaterial | null;
  onClose: () => void;
}> = ({ isOpen, material, onClose }) => {
  const [analysis, setAnalysis] = useState<SupplierPriceAnalysis | null>(null);
  const [loading, setLoading] = useState(false);

  // Phân tích giá nhà cung cấp
  const analyzeSupplierPrices = async () => {
    if (!material) return;

    setLoading(true);
    try {
      // Lấy lịch sử nhập hàng từ các nhà cung cấp
      const { data: materials, error } = await supabase
        .from("pin_materials")
        .select("*")
        .ilike("name", `%${material.name}%`)
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      // Nhóm theo nhà cung cấp
      const supplierGroups = new Map<string, any[]>();
      materials?.forEach((m) => {
        const supplier = m.supplier || "Không rõ nhà cung cấp";
        if (!supplierGroups.has(supplier)) {
          supplierGroups.set(supplier, []);
        }
        supplierGroups.get(supplier)?.push({
          date: m.created_at,
          price: m.purchasePrice,
          quantity: 1,
          invoice_number: `INV-${m.id.slice(-8)}`,
        });
      });

      // Tạo dữ liệu phân tích
      const suppliers: SupplierPrice[] = Array.from(supplierGroups.entries()).map(
        ([name, history]) => {
          const sortedHistory = history.sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
          );
          const currentPrice = sortedHistory[0]?.price || 0;

          return {
            supplier_name: name,
            current_price: currentPrice,
            last_updated: sortedHistory[0]?.date || new Date().toISOString(),
            price_history: sortedHistory.slice(0, 10),
            quality_rating: 3.5 + Math.random() * 1.5, // Mock data
            delivery_time_days: 3 + Math.floor(Math.random() * 10),
            reliability_score: 0.7 + Math.random() * 0.3,
          };
        }
      );

      // Tính toán thống kê
      const prices = suppliers.map((s) => s.current_price).filter((p) => p > 0);
      const averagePrice = prices.reduce((sum, p) => sum + p, 0) / Math.max(1, prices.length);
      const bestPrice = Math.min(...prices.filter((p) => p > 0));
      const bestSupplier =
        suppliers.find((s) => s.current_price === bestPrice)?.supplier_name || "";
      const priceVariance =
        prices.length > 1
          ? Math.sqrt(
            prices.reduce((sum, p) => sum + Math.pow(p - averagePrice, 2), 0) / prices.length
          )
          : 0;

      // Xác định xu hướng giá
      let priceTrend: "rising" | "falling" | "stable" = "stable";
      if (suppliers.length > 0) {
        const recentPrices = suppliers[0].price_history.slice(0, 3).map((h) => h.price);
        const olderPrices = suppliers[0].price_history.slice(3, 6).map((h) => h.price);
        if (recentPrices.length > 0 && olderPrices.length > 0) {
          const recentAvg = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
          const olderAvg = olderPrices.reduce((sum, p) => sum + p, 0) / olderPrices.length;
          if (recentAvg > olderAvg * 1.05) priceTrend = "rising";
          else if (recentAvg < olderAvg * 0.95) priceTrend = "falling";
        }
      }

      // Tạo gợi ý
      const recommendations: string[] = [];
      if (bestPrice < averagePrice * 0.9) {
        recommendations.push(
          `${bestSupplier} đang có giá tốt nhất, tiết kiệm ${formatCurrency(
            averagePrice - bestPrice
          )} so với giá trung bình`
        );
      }
      if (priceTrend === "rising") {
        recommendations.push(
          "Giá đang có xu hướng tăng, nên cân nhắc nhập nhiều hơn trong đợt này"
        );
      }
      if (priceTrend === "falling") {
        recommendations.push("Giá đang có xu hướng giảm, có thể chờ thêm để có giá tốt hơn");
      }
      if (priceVariance > averagePrice * 0.2) {
        recommendations.push(
          "Chênh lệch giá giữa các nhà cung cấp lớn, nên đàm phán để có giá tốt hơn"
        );
      }

      const analysisData: SupplierPriceAnalysis = {
        material_id: material.id,
        material_name: material.name,
        suppliers: suppliers,
        price_trend: priceTrend,
        average_price: averagePrice,
        best_price: bestPrice,
        best_supplier: bestSupplier,
        price_variance: priceVariance,
        recommendations: recommendations,
      };

      setAnalysis(analysisData);
    } catch (err) {
      console.error("Error analyzing supplier prices:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && material) {
      analyzeSupplierPrices();
    }
  }, [isOpen, material]);

  if (!isOpen || !material) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising":
        return "📈";
      case "falling":
        return "📉";
      default:
        return "📊";
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "rising":
        return "text-red-600 dark:text-red-400";
      case "falling":
        return "text-green-600 dark:text-green-400";
      default:
        return "text-gray-600 dark:text-gray-400";
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 dark:bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl w-full max-w-6xl max-h-[95vh] overflow-hidden shadow-2xl border border-gray-200 dark:border-gray-600">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
              💰 Phân tích giá nhà cung cấp
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {material.name} ({material.sku})
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(95vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span className="text-gray-600 dark:text-gray-400">Đang phân tích giá...</span>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* Price Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h5 className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                    📈 Giá trung bình
                  </h5>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(analysis.average_price)}
                  </p>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                  <h5 className="font-medium text-green-800 dark:text-green-200 mb-2">
                    🏆 Giá tốt nhất
                  </h5>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(analysis.best_price)}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    {analysis.best_supplier}
                  </p>
                </div>

                <div
                  className={`p-4 rounded-lg border ${analysis.price_trend === "rising"
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                    : analysis.price_trend === "falling"
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                      : "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700"
                    }`}
                >
                  <h5
                    className={`font-medium mb-2 ${analysis.price_trend === "rising"
                      ? "text-red-800 dark:text-red-200"
                      : analysis.price_trend === "falling"
                        ? "text-green-800 dark:text-green-200"
                        : "text-gray-800 dark:text-gray-200"
                      }`}
                  >
                    Xu hướng giá
                  </h5>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getTrendIcon(analysis.price_trend)}</span>
                    <span className={`font-bold ${getTrendColor(analysis.price_trend)}`}>
                      {analysis.price_trend === "rising"
                        ? "Tăng"
                        : analysis.price_trend === "falling"
                          ? "Giảm"
                          : "Ổn định"}
                    </span>
                  </div>
                </div>

                <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h5 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                    📉 Chênh lệch
                  </h5>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(analysis.price_variance)}
                  </p>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Số nhà CC: {analysis.suppliers.length}
                  </p>
                </div>
              </div>

              {/* Supplier Comparison */}
              <div>
                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  🏢 So sánh nhà cung cấp
                </h4>

                {analysis.suppliers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    📉 Chưa có dữ liệu nhà cung cấp
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full border border-gray-200 dark:border-gray-600 rounded-lg">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            Nhà cung cấp
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            Giá hiện tại
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            So với TB
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            Đánh giá
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            Giao hàng
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                            Cập nhật
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {analysis.suppliers.map((supplier, index) => {
                          const priceDiff = supplier.current_price - analysis.average_price;
                          const isLowest = supplier.current_price === analysis.best_price;

                          return (
                            <tr
                              key={index}
                              className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${isLowest ? "bg-green-50 dark:bg-green-900/20" : ""
                                }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {isLowest && <span className="text-green-500">🏆</span>}
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {supplier.supplier_name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`font-semibold ${isLowest
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-gray-900 dark:text-white"
                                    }`}
                                >
                                  {formatCurrency(supplier.current_price)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-sm font-medium ${priceDiff < 0
                                    ? "text-green-600 dark:text-green-400"
                                    : priceDiff > 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-gray-600 dark:text-gray-400"
                                    }`}
                                >
                                  {priceDiff > 0 ? "+" : ""}
                                  {formatCurrency(priceDiff)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-yellow-400">⭐</span>
                                  <span className="text-sm text-gray-600 dark:text-gray-400">
                                    {supplier.quality_rating?.toFixed(1) || "N/A"}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-600 dark:text-gray-400">
                                  {supplier.delivery_time_days} ngày
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  {new Date(supplier.last_updated).toLocaleDateString("vi-VN")}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {analysis.recommendations.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                    💡 Gợi ý tối ưu
                  </h4>
                  <ul className="space-y-2">
                    {analysis.recommendations.map((rec, index) => (
                      <li
                        key={index}
                        className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-200"
                      >
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              📉 Chưa có dữ liệu để phân tích
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700 px-6 py-4 border-t border-gray-200 dark:border-gray-600 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

// Main MaterialManager Component - Updated to use centralized hooks
const MaterialManager: React.FC<{
  materials: PinMaterial[];
  setMaterials: React.Dispatch<React.SetStateAction<PinMaterial[]>>;
  productionOrders?: any[]; // ProductionOrder[] - will be passed from context
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
}> = ({ materials, setMaterials, productionOrders = [], suppliers, setSuppliers }) => {
  // Get pinMaterialHistory from context to update it
  const { pinMaterialHistory, setPinMaterialHistory, reloadPinMaterialHistory, currentUser, addToast } =
    usePinContext();

  const navigate = useNavigate();

  // Helper function to show toast notifications
  const showToast = useCallback((title: string, message: string, type: "success" | "error" | "warn" = "success") => {
    addToast({ title, message, type });
  }, [addToast]);

  // ✅ Use centralized material stock management
  const {
    enhancedMaterials,
    calculateCommittedQuantities,
    checkMaterialAvailability,
    getMaterialsNeedingReorder,
    getOrdersAffectingMaterial,
  } = useMaterialStock();

  // Note: enhancedMaterials từ hook sẽ override materials props để có consistent data

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<PinMaterial | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [stockFilter, setStockFilter] = useState(""); // "low", "empty", "normal", ""
  const [unitFilter, setUnitFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<
    "" | "material" | "product" | "finished_goods"
  >("");
  const [sortBy, setSortBy] = useState<"name" | "purchasePrice" | "stock">("name");

  // Reload function is provided by AppContext

  // Note: the effect that depends on activeView is declared after activeView
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Bulk actions states
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkAction, setBulkAction] = useState<"delete" | "updateSupplier" | "printBarcode" | "">(
    ""
  );
  const [bulkSupplier, setBulkSupplier] = useState("");
  const [bulkSupplierPhone, setBulkSupplierPhone] = useState("");

  // Cấp 2 features states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedMaterialForDetail, setSelectedMaterialForDetail] = useState<PinMaterial | null>(
    null
  );
  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [selectedMaterialForAdjustment, setSelectedMaterialForAdjustment] =
    useState<PinMaterial | null>(null);

  // Material Edit Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState<PinMaterial | null>(null);

  // Cấp 3 features states - Dự báo tồn kho và phân tích giá
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [selectedMaterialForForecast, setSelectedMaterialForForecast] =
    useState<PinMaterial | null>(null);
  const [showPriceAnalysisModal, setShowPriceAnalysisModal] = useState(false);
  const [selectedMaterialForPriceAnalysis, setSelectedMaterialForPriceAnalysis] =
    useState<PinMaterial | null>(null);
  // CSV import modal state
  const [showImportModal, setShowImportModal] = useState(false);

  // Tab management for main views
  const [activeView, setActiveView] = useState<"materials" | "history" | "orders">("materials");
  // Note: History view now self-fetches; no need to trigger context reload here

  // Tổng giá trị nhập kho từ lịch sử (để hiển thị chính xác)
  const [totalImportValue, setTotalImportValue] = useState<number>(0);

  // Fetch tổng giá trị từ lịch sử nhập kho
  useEffect(() => {
    const fetchTotalImportValue = async () => {
      try {
        const { data, error } = await supabase.from("pin_material_history").select("total_cost");

        if (!error && data) {
          const total = data.reduce((sum, row) => sum + (Number(row.total_cost) || 0), 0);
          setTotalImportValue(total);
        }
      } catch (e) {
        console.error("Error fetching total import value:", e);
      }
    };

    fetchTotalImportValue();
  }, [materials]); // Refresh when materials change

  // Load modal states from localStorage on mount
  useEffect(() => {
    const savedModalStates = localStorage.getItem("materialManagerModalStates");
    if (savedModalStates) {
      try {
        const parsed = JSON.parse(savedModalStates);
        if (parsed.showForm) setShowForm(true);
        if (parsed.editingMaterial) setEditingMaterial(parsed.editingMaterial);
        if (parsed.showDetailModal) setShowDetailModal(true);
        if (parsed.selectedMaterialForDetail)
          setSelectedMaterialForDetail(parsed.selectedMaterialForDetail);
        if (parsed.showStockAdjustmentModal) setShowStockAdjustmentModal(true);
        if (parsed.selectedMaterialForAdjustment)
          setSelectedMaterialForAdjustment(parsed.selectedMaterialForAdjustment);
        if (parsed.showForecastModal) setShowForecastModal(true);
        if (parsed.selectedMaterialForForecast)
          setSelectedMaterialForForecast(parsed.selectedMaterialForForecast);
        if (parsed.showPriceAnalysisModal) setShowPriceAnalysisModal(true);
        if (parsed.selectedMaterialForPriceAnalysis)
          setSelectedMaterialForPriceAnalysis(parsed.selectedMaterialForPriceAnalysis);
      } catch (e) {
        console.error("Error loading modal states:", e);
      }
    }
  }, []);

  // Save modal states to localStorage whenever they change
  useEffect(() => {
    const modalStates = {
      showForm,
      editingMaterial,
      showDetailModal,
      selectedMaterialForDetail,
      showStockAdjustmentModal,
      selectedMaterialForAdjustment,
      showForecastModal,
      selectedMaterialForForecast,
      showPriceAnalysisModal,
      selectedMaterialForPriceAnalysis,
    };

    // Only save if any modal is open
    const anyModalOpen =
      showForm ||
      showDetailModal ||
      showStockAdjustmentModal ||
      showForecastModal ||
      showPriceAnalysisModal;
    if (anyModalOpen) {
      localStorage.setItem("materialManagerModalStates", JSON.stringify(modalStates));
    } else {
      // Clear saved states when all modals are closed
      localStorage.removeItem("materialManagerModalStates");
    }
  }, [
    showForm,
    editingMaterial,
    showDetailModal,
    selectedMaterialForDetail,
    showStockAdjustmentModal,
    selectedMaterialForAdjustment,
    showForecastModal,
    selectedMaterialForForecast,
    showPriceAnalysisModal,
    selectedMaterialForPriceAnalysis,
  ]);

  // Simple data loading
  const loadMaterials = async () => {
    setLoading(true);
    setError(null);

    try {
      // Use currentUser from context
      if (!currentUser) {
        // Fallback to supabase auth if context is not ready (though context should be ready)
        const {
          data: { user: sbUser },
          error: sbError,
        } = await supabase.auth.getUser();
        if (sbError || !sbUser) {
          setError("Chưa đăng nhập");
          setLoading(false);
          return;
        }
      }

      const user = currentUser || (await supabase.auth.getUser()).data.user;

      if (!user) {
        setError("Chưa đăng nhập");
        setLoading(false);
        return;
      }

      // Fetch materials with category names
      const { data, error: fetchError } = await supabase
        .from("pin_materials")
        .select(`
          *,
          categories:category_id (
            name
          )
        `)
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("❌ Fetch error:", fetchError);
        setError("Lỗi tải dữ liệu: " + fetchError.message);
        return;
      }

      const formattedMaterials = (data || []).map((item: any) => ({
        id: item.id,
        name: item.name || "",
        sku: item.sku || "",
        unit: item.unit || "cái",
        purchasePrice: Number(item.purchaseprice ?? item.purchase_price ?? 0) || 0,
        retailPrice: Number(item.retailprice ?? item.retail_price ?? 0) || 0,
        wholesalePrice: Number(item.wholesaleprice ?? item.wholesale_price ?? 0) || 0,
        stock: Number(item.stock ?? 0) || 0,
        supplier: item.supplier || "",
        supplierPhone: item.supplierphone || item.supplier_phone || "",
        description: item.description || "",
        created_at: item.created_at,
        category: item.category || "",
        category_id: item.category_id || "",
        category_name: item.categories?.name || "",
      }));

      setMaterials(formattedMaterials);
    } catch (err) {
      console.error("💥 Load error:", err);
      setError("Lỗi không xác định: " + getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Save import transaction function
  const saveMaterial = async (formData: any) => {
    try {
      // Get current user from context
      if (!currentUser) {
        throw new Error("Chưa đăng nhập");
      }
      const user = currentUser;

      // If creating new, let DB generate UUID
      let materialId: string | null = editingMaterial?.id || null;
      const sku = formData.sku || generateMaterialSKU(materials);
      const importId = `IMP${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      // 1. Kiểm tra hoặc tạo mới nguyên vật liệu
      let currentMaterial = editingMaterial;
      if (!currentMaterial) {
        // Kiểm tra xem nguyên vật liệu đã tồn tại chưa
        const { data: existingMaterials } = await supabase
          .from("pin_materials")
          .select("*")
          .eq("name", formData.name)
          .limit(1);

        if (existingMaterials && existingMaterials.length > 0) {
          currentMaterial = existingMaterials[0];
          // Also set materialId to prevent duplicate creation via upsert
          if (currentMaterial) materialId = currentMaterial.id;
        }
      }

      // 2. Cập nhật hoặc tạo mới nguyên vật liệu
      const newStock = (currentMaterial?.stock || 0) + formData.quantity;
      const base = {
        name: formData.name,
        sku,
        unit: formData.unit,
        purchaseprice: formData.purchasePrice,
        retailprice: formData.retailPrice || 0,
        wholesaleprice: formData.wholesalePrice || 0,
        stock: newStock,
        supplier: formData.supplier || "",
        supplierphone: formData.supplierPhone || "",
        description: formData.description || "",
        created_at: currentMaterial?.created_at || new Date().toISOString(),
        created_by: user.id,
        updated_at: new Date().toISOString(),
      };

      const dbPayload: any = {
        name: base.name,
        sku: base.sku,
        unit: base.unit,
        purchase_price: base.purchaseprice,
        retail_price: base.retailprice,
        wholesale_price: base.wholesaleprice,
        stock: base.stock,
        supplier: base.supplier,
        supplier_phone: base.supplierphone, // ✅ Thêm SĐT NCC
        description: base.description,
        created_at: base.created_at,
        updated_at: base.updated_at,
      };
      if (materialId) dbPayload.id = materialId;

      // Handle DEV_AUTH_BYPASS RLS issues
      let upsertData = null;
      let materialError = null;

      try {
        const { data, error } = await supabase
          .from("pin_materials")
          .upsert(dbPayload, { onConflict: "sku" })
          .select();

        upsertData = data;
        materialError = error;
      } catch (e) {
        materialError = e;
      }

      // Special handling for RLS error in dev mode
      if (materialError && (user.id === "dev-bypass-user" || user.id === "offline-user")) {
        console.warn("⚠️ RLS Error in Dev Mode - Mocking success:", materialError);
        // Mock success
        upsertData = [{ ...dbPayload, id: materialId || `mock-id-${Date.now()}` }];
        materialError = null;
      }

      if (materialError) {
        console.error("❌ Material save error:", materialError);
        throw new Error(getErrorMessage(materialError) || "Lỗi lưu vật tư");
      }

      // Resolve materialId from upsert result (if newly inserted)
      const upsertedRow = Array.isArray(upsertData) ? upsertData[0] : upsertData;
      materialId = materialId || upsertedRow?.id || null;

      // 3. Tạo bản ghi nhập kho
      const importPayload = {
        id: importId,
        material_id: materialId || undefined,
        material_name: formData.name,
        quantity: formData.quantity,
        unit_price: formData.purchasePrice,
        total_cost: formData.totalCost,
        supplier: formData.supplier || "",
        supplier_phone: formData.supplierPhone || "",
        invoice_number: formData.invoiceNumber || "",
        import_date: formData.importDate,
        payment_method: formData.paymentMethod,
        payment_status: formData.paymentStatus,
        description: formData.description || "",
        created_by: user.id,
        created_at: new Date().toISOString(),
      };

      // Ghi vào bảng nhập kho nếu có cấu hình (bỏ qua nếu bảng không tồn tại)
      try {
        await supabase.from("pin_material_imports").insert(importPayload);
      } catch (e) {
        console.log("⚠️ Import log table missing or not configured - continue");
      }

      // 4. GHI VÀO BẢNG LỊCH SỬ NHẬP KHO (cho tab Lịch sử)
      // Lưu ý: KHÔNG set id thủ công nếu cột id là UUID; để DB tự tạo.
      const historyPayload = {
        material_id: materialId || undefined,
        material_name: formData.name,
        material_sku: sku,
        quantity: formData.quantity,
        purchase_price: formData.purchasePrice,
        total_cost: formData.totalCost,
        supplier: formData.supplier || null,
        import_date: formData.importDate,
        notes: formData.description || null,
        user_id: user.id,
        user_name: user.email || "Unknown",
        branch_id: "main", // Default branch
        created_by: user.id, // Quan trọng cho RLS nếu có
        created_at: new Date().toISOString(),
      };

      // Attempt insert; if created_by column doesn't exist in this table, retry without it
      let insertedHistory: any | null = null;
      let historyError: any | null = null;
      {
        const { data, error } = await supabase
          .from("pin_material_history")
          .insert(historyPayload)
          .select()
          .single();

        // Handle RLS error for history in dev mode
        if (error && (user.id === "dev-bypass-user" || user.id === "offline-user")) {
          console.warn("⚠️ RLS Error in Dev Mode (History) - Mocking success");
          insertedHistory = {
            ...historyPayload,
            id: `mock-hist-${Date.now()}`,
          };
          historyError = null;
        } else if (
          error &&
          (String(error.message || "").includes("created_by") || error.code === "42703")
        ) {
          // Retry without created_by
          const fallbackPayload: any = { ...historyPayload };
          delete fallbackPayload.created_by;
          const { data: data2, error: error2 } = await supabase
            .from("pin_material_history")
            .insert(fallbackPayload)
            .select()
            .single();
          insertedHistory = data2;
          historyError = error2;
        } else {
          insertedHistory = data;
          historyError = error;
        }
      }

      if (historyError) {
        // Không dừng quá trình nếu bảng history chưa có - silent fail
      } else if (insertedHistory) {
        // ✅ Update context with inserted row (đảm bảo có id UUID và các cột thực tế)
        const newHistory: PinMaterialHistory = {
          id: insertedHistory.id,
          materialId: insertedHistory.material_id,
          materialName: insertedHistory.material_name,
          materialSku: insertedHistory.material_sku,
          quantity: Number(insertedHistory.quantity ?? 0),
          purchasePrice: Number(
            insertedHistory.purchase_price ?? insertedHistory.purchaseprice ?? 0
          ),
          totalCost: Number(insertedHistory.total_cost ?? insertedHistory.totalcost ?? 0),
          supplier: insertedHistory.supplier || undefined,
          importDate:
            insertedHistory.import_date || insertedHistory.importdate || new Date().toISOString(),
          notes: insertedHistory.notes || undefined,
          userId: insertedHistory.user_id || undefined,
          userName: insertedHistory.user_name || undefined,
          branchId: insertedHistory.branch_id || "main",
          created_at: insertedHistory.created_at || undefined,
        };
        setPinMaterialHistory((prev: PinMaterialHistory[]) => [newHistory, ...prev]);
      }

      // Reload data to ensure consistency
      await loadMaterials();

      // If we mocked the save, loadMaterials won't find the new item.
      // So we should manually update the materials list if in dev mode
      if (user.id === "dev-bypass-user" || user.id === "offline-user") {
        const newMaterial: PinMaterial = {
          id: materialId!,
          name: base.name,
          sku: base.sku,
          unit: base.unit,
          purchasePrice: base.purchaseprice,
          retailPrice: base.retailprice,
          wholesalePrice: base.wholesaleprice,
          stock: base.stock,
          supplier: base.supplier,
          description: base.description,
          created_at: base.created_at,
        };
        setMaterials((prev) =>
          prev.find((m) => m.id === newMaterial.id)
            ? prev.map((m) => (m.id === newMaterial.id ? newMaterial : m))
            : [newMaterial, ...prev]
        );
      }
    } catch (err) {
      console.error("💥 Import failed:", err);
      throw err;
    }
  };

  // Bulk CSV import handler
  const handleCsvImport = async (
    items: Array<{
      name: string;
      sku?: string;
      unit?: string;
      purchasePrice?: number;
      retailPrice?: number;
      wholesalePrice?: number;
      quantity?: number;
      supplier?: string;
      supplierPhone?: string;
    }>
  ) => {
    for (const it of items) {
      if (!it.name || it.purchasePrice === undefined || it.purchasePrice < 0) continue;
      const quantity = Math.max(1, Number(it.quantity ?? 1));
      const purchasePrice = Number(it.purchasePrice ?? 0);
      const payload = {
        name: it.name,
        sku: it.sku || "",
        unit: it.unit || "cái",
        purchasePrice,
        retailPrice: Number(it.retailPrice ?? 0),
        wholesalePrice: Number(it.wholesalePrice ?? 0),
        quantity,
        totalCost: purchasePrice * quantity,
        supplier: it.supplier || "",
        supplierPhone: it.supplierPhone || "",
        invoiceNumber: `IMP-${Date.now()}`,
        importDate: new Date().toISOString().split("T")[0],
        paymentMethod: "cash",
        paymentStatus: "paid",
        description: "Nhập từ CSV",
      };
      await saveMaterial(payload);
    }
    await loadMaterials();
    setShowImportModal(false);
  };

  // Delete function
  const deleteMaterial = async (id: string) => {
    // Bypass confirm in dev mode for easier testing
    const isDev = currentUser?.id === "dev-bypass-user" || currentUser?.id === "offline-user";
    if (!isDev && !window.confirm("Xóa nguyên vật liệu này?")) return;

    try {
      // Get current user to check for dev mode
      const user = currentUser;

      let deleteError = null;
      try {
        const { error } = await supabase.from("pin_materials").delete().eq("id", id);
        deleteError = error;
      } catch (e) {
        deleteError = e;
      }

      // Handle RLS error in dev mode
      if (deleteError && user && (user.id === "dev-bypass-user" || user.id === "offline-user")) {
        console.warn("⚠️ RLS Error in Dev Mode (Delete) - Mocking success");
        deleteError = null;

        // Manually update local state
        setMaterials((prev) => prev.filter((m) => m.id !== id));
      }

      if (deleteError) throw new Error(getErrorMessage(deleteError) || "Delete error");

      // Only reload if not mocked (mocked update handled above)
      if (!user || (user.id !== "dev-bypass-user" && user.id !== "offline-user")) {
        await loadMaterials();
      }
    } catch (err) {
      console.error("Delete error:", err);
      showToast("Lỗi", "Lỗi khi xóa: " + getErrorMessage(err), "error");
    }
  };

  // Handle sort
  const handleSort = (column: "name" | "purchasePrice" | "stock") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  // Bulk actions handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Filter materials locally
      const filtered = enhancedMaterials.filter((material) => {
        const matchesSearch =
          material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          material.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSupplier = !supplierFilter || material.supplier === supplierFilter;

        const matchesStock =
          !stockFilter ||
          (stockFilter === "empty"
            ? material.stock === 0
            : stockFilter === "low"
              ? material.stock > 0 && material.stock <= 10
              : stockFilter === "normal"
                ? material.stock > 10
                : true);

        const matchesUnit = !unitFilter || material.unit === unitFilter;

        return matchesSearch && matchesSupplier && matchesStock && matchesUnit;
      });

      const allIds = new Set<string>(filtered.map((m) => m.id));
      setSelectedItems(allIds);
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedItems(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Xóa ${selectedItems.size} vật tư đã chọn?`)) return;

    try {
      const deleteResults = await Promise.all(
        Array.from(selectedItems).map((id) =>
          supabase.from("pin_materials").delete().eq("id", id)
        )
      );

      const failedDeletes = deleteResults.filter((r) => r.error);
      if (failedDeletes.length > 0) {
        console.error("Some deletes failed:", failedDeletes.map((r) => r.error));
        showToast("Cảnh báo", `${failedDeletes.length}/${selectedItems.size} vật tư xóa thất bại`, "warn");
      }

      await loadMaterials();
      setSelectedItems(new Set());
      setShowBulkActions(false);
      const successCount = selectedItems.size - failedDeletes.length;
      if (successCount > 0) {
        showToast("Thành công", `Đã xóa ${successCount} vật tư thành công!`, "success");
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      showToast("Lỗi", "Lỗi khi xóa: " + getErrorMessage(err), "error");
    }
  };

  const handleBulkUpdateSupplier = async () => {
    if (!bulkSupplier.trim()) {
      showToast("Thông báo", "Vui lòng nhập tên nhà cung cấp!", "warn");
      return;
    }

    try {
      const updatePromises = Array.from(selectedItems).map((id) =>
        supabase
          .from("pin_materials")
          .update({
            supplier: bulkSupplier,
            supplier_phone: bulkSupplierPhone || null,
          })
          .eq("id", id)
      );

      await Promise.all(updatePromises);
      await loadMaterials();
      setSelectedItems(new Set());
      setShowBulkActions(false);
      setBulkSupplier("");
      setBulkSupplierPhone("");
      showToast("Thành công", `Đã cập nhật nhà cung cấp cho ${selectedItems.size} vật tư!`, "success");
    } catch (err) {
      console.error("Bulk update error:", err);
      showToast("Lỗi", "Lỗi khi cập nhật: " + getErrorMessage(err), "error");
    }
  };

  const handlePrintBarcodes = () => {
    // Compute filtered materials locally
    const filtered = enhancedMaterials.filter((material) => {
      const matchesSearch =
        material.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        material.supplier?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSupplier = !supplierFilter || material.supplier === supplierFilter;

      const matchesStock =
        !stockFilter ||
        (stockFilter === "empty"
          ? material.stock === 0
          : stockFilter === "low"
            ? material.stock > 0 && material.stock <= 10
            : stockFilter === "normal"
              ? material.stock > 10
              : true);

      const matchesUnit = !unitFilter || material.unit === unitFilter;

      return matchesSearch && matchesSupplier && matchesStock && matchesUnit;
    });

    const selectedMaterials = filtered.filter((m) => selectedItems.has(m.id));
    const barcodeData = selectedMaterials.map((m) => ({
      name: m.name,
      sku: m.sku,
      price: formatCurrency(m.purchasePrice),
    }));

    // Simple print implementation
    const printContent = `
      <html>
        <head><title>Mã vạch vật tư</title></head>
        <body style="font-family: Arial; padding: 20px;">
          <h2>Mã vạch vật tư (${selectedItems.size} sản phẩm)</h2>
          ${barcodeData
        .map(
          (item) => `
            <div style="border: 1px solid #ccc; margin: 10px 0; padding: 15px; page-break-inside: avoid;">
              <div style="font-size: 18px; font-weight: bold;">${item.name}</div>
              <div style="font-size: 14px; color: #666;">SKU: ${item.sku}</div>
              <div style="font-size: 16px; margin-top: 5px;">Giá: ${item.price}</div>
              <div style="font-family: monospace; font-size: 24px; text-align: center; margin-top: 10px; border: 2px solid #000; padding: 5px;">||||| ${item.sku} |||||</div>
            </div>
          `
        )
        .join("")}
        </body>
      </html>
    `;

    const printWindow = window.open("", "", "width=800,height=600");
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }

    setSelectedItems(new Set());
    setShowBulkActions(false);
  };

  // Update bulk actions visibility
  React.useEffect(() => {
    setShowBulkActions(selectedItems.size > 0);
  }, [selectedItems]);

  // Cấp 2 features handlers
  const handleShowMaterialDetail = (material: PinMaterial) => {
    setSelectedMaterialForDetail(material);
    setShowDetailModal(true);
  };

  const handleShowStockAdjustment = (material: PinMaterial) => {
    setSelectedMaterialForAdjustment(material);
    setShowStockAdjustmentModal(true);
  };

  // Cấp 3 features handlers - Dự báo và phân tích
  const handleShowStockForecast = (material: PinMaterial) => {
    setSelectedMaterialForForecast(material);
    setShowForecastModal(true);
  };

  const handleShowPriceAnalysis = (material: PinMaterial) => {
    setSelectedMaterialForPriceAnalysis(material);
    setShowPriceAnalysisModal(true);
  };

  const handleStockAdjustment = async (adjustment: StockAdjustment) => {
    try {
      // Get current user from context
      if (!currentUser) {
        throw new Error("Chưa đăng nhập");
      }
      const user = currentUser;

      const desiredStock = Number(adjustment.actual_stock);
      if (!Number.isFinite(desiredStock)) {
        throw new Error("Tồn kho thực tế không hợp lệ");
      }
      if (desiredStock < 0) {
        throw new Error("Tồn kho không thể âm");
      }

      // First, try to create the stock_history table if it doesn't exist
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS pin_stock_history(
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    material_id UUID NOT NULL REFERENCES pin_materials(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK(transaction_type IN('import', 'export', 'adjustment')),
    quantity_before INTEGER NOT NULL DEFAULT 0,
    quantity_change INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    invoice_number VARCHAR(100),
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc':: text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
  );
`;

      // Try to create table (will be ignored if exists)
      try {
        await supabase.rpc("sql", { query: createTableSQL });
      } catch (err) {
        console.warn("Table creation warning:", err);
      }

      // Record the stock history
      let beforeStockForHistory = Number(adjustment.current_stock);
      let afterStockForHistory = desiredStock;

      // Update material stock atomically (DB-locked) when possible.
      // Fallback to direct update if RPC is not available.
      let updateError: any = null;
      try {
        const { data, error } = await supabase.rpc("pin_set_material_stock", {
          p_material_id: adjustment.material_id,
          p_new_stock: desiredStock,
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : undefined;
        if (row) {
          const b = Number((row as any).before_stock);
          const a = Number((row as any).after_stock);
          if (Number.isFinite(b)) beforeStockForHistory = b;
          if (Number.isFinite(a)) afterStockForHistory = a;
        }
      } catch (e) {
        updateError = e;
      }

      if (updateError && (user.id === "dev-bypass-user" || user.id === "offline-user")) {
        console.warn("⚠️ RLS/RPC Error in Dev Mode (Stock Adj) - Mocking success");
        updateError = null;

        // Manually update local state
        setMaterials((prev) =>
          prev.map((m) =>
            m.id === adjustment.material_id ? { ...m, stock: desiredStock } : m
          )
        );
      }

      // If RPC failed because it doesn't exist, fallback to direct update.
      if (updateError && String(updateError?.code || "") === "42883") {
        try {
          const { error } = await supabase
            .from("pin_materials")
            .update({ stock: desiredStock })
            .eq("id", adjustment.material_id);
          if (error) throw error;
          updateError = null;
        } catch (e) {
          updateError = e;
        }
      }

      if (updateError) throw updateError;

      const historyPayload = {
        material_id: adjustment.material_id,
        transaction_type: "adjustment",
        quantity_before: Math.round(beforeStockForHistory),
        quantity_change: Math.round(afterStockForHistory - beforeStockForHistory),
        quantity_after: Math.round(afterStockForHistory),
        reason: adjustment.reason,
        invoice_number: `ADJ - ${Date.now()} `,
        created_by: user.id,
      };

      let historyError = null;
      try {
        const { error } = await supabase.from("pin_stock_history").insert(historyPayload);
        historyError = error;
      } catch (e) {
        historyError = e;
      }

      // Handle RLS error in dev mode
      if (historyError && (user.id === "dev-bypass-user" || user.id === "offline-user")) {
        console.warn("⚠️ RLS Error in Dev Mode (Stock Adj) - Mocking success");
        historyError = null;
      }

      if (historyError) throw historyError;

      // Reload materials
      await loadMaterials();
      showToast("Thành công", "Điều chỉnh tồn kho thành công!", "success");
    } catch (error) {
      console.error("Stock adjustment error:", error);
      throw error;
    }
  };

  // Get stock status for visual indicators
  const getStockStatus = (stock: number) => {
    if (stock === 0)
      return {
        status: "empty",
        color: "text-red-600 dark:text-red-400",
        icon: "🔴",
      };
    if (stock <= 5)
      return {
        status: "critical",
        color: "text-orange-600 dark:text-orange-400",
        icon: "🟠",
      };
    if (stock <= 10)
      return {
        status: "low",
        color: "text-yellow-600 dark:text-yellow-400",
        icon: "🟡",
      };
    return {
      status: "normal",
      color: "text-green-600 dark:text-green-400",
      icon: "🟢",
    };
  };

  // Đồng bộ thông tin NCC + TẠO MỚI VẬT LIỆU BỊ THIẾU từ lịch sử nhập kho
  const syncSupplierFromHistory = async () => {
    if (
      !window.confirm(
        "Đồng bộ dữ liệu từ lịch sử nhập kho?\n\n" +
        "✅ Tạo mới các vật liệu bị thiếu\n" +
        "✅ Cập nhật thông tin NCC cho vật liệu đã có"
      )
    )
      return;

    setLoading(true);
    try {
      // 1. Lấy tất cả lịch sử nhập kho (đầy đủ thông tin)
      const { data: historyData, error: historyError } = await supabase
        .from("pin_material_history")
        .select("*")
        .order("import_date", { ascending: false });

      if (historyError) throw historyError;

      // 2. Lấy danh sách vật liệu hiện có
      const { data: existingMaterials, error: matError } = await supabase
        .from("pin_materials")
        .select("id, name, sku, supplier");

      if (matError) throw matError;

      const existingSkuSet = new Set((existingMaterials || []).map((m: any) => m.sku));
      const existingNameSet = new Set(
        (existingMaterials || []).map((m: any) => m.name?.toLowerCase())
      );

      // 3. Tổng hợp dữ liệu từ lịch sử theo tên vật liệu
      const materialMap = new Map<
        string,
        {
          name: string;
          sku: string;
          quantity: number;
          purchasePrice: number;
          supplier: string;
        }
      >();

      historyData?.forEach((h: any) => {
        const name = h.material_name || "";
        const sku = h.material_sku || "";
        const key = name.toLowerCase();

        if (!materialMap.has(key)) {
          materialMap.set(key, {
            name,
            sku,
            quantity: Number(h.quantity || 0),
            purchasePrice: Number(h.purchase_price || h.purchaseprice || 0),
            supplier: h.supplier || "",
          });
        } else {
          // Cộng dồn số lượng
          const existing = materialMap.get(key)!;
          existing.quantity += Number(h.quantity || 0);
          // Lấy supplier nếu chưa có
          if (!existing.supplier && h.supplier) {
            existing.supplier = h.supplier;
          }
        }
      });

      // 4. Tạo mới các vật liệu bị thiếu
      let createdCount = 0;
      let updatedCount = 0;

      for (const [key, data] of materialMap) {
        const nameExists = existingNameSet.has(key);
        const skuExists = data.sku && existingSkuSet.has(data.sku);

        if (!nameExists && !skuExists && data.name) {
          // Tạo mới vật liệu
          const newSku = data.sku || `NL-SYNC-${Date.now()}-${createdCount}`;
          const { error: insertError } = await supabase.from("pin_materials").insert({
            name: data.name,
            sku: newSku,
            unit: "Cell",
            purchase_price: data.purchasePrice,
            retail_price: Math.round(data.purchasePrice * 1.2),
            wholesale_price: Math.round(data.purchasePrice * 1.1),
            stock: data.quantity,
            supplier: data.supplier,
            description: `Đồng bộ từ lịch sử nhập kho`,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

          if (!insertError) {
            createdCount++;
          } else {
            console.error(`❌ Lỗi tạo ${data.name}:`, insertError);
          }
        }
      }

      // 5. Cập nhật supplier cho vật liệu đã có nhưng thiếu NCC
      for (const material of existingMaterials || []) {
        if (!material.supplier || material.supplier.trim() === "" || material.supplier === "-") {
          const key = material.name?.toLowerCase();
          const historyInfo = materialMap.get(key);
          if (historyInfo?.supplier) {
            const { error: updateError } = await supabase
              .from("pin_materials")
              .update({
                supplier: historyInfo.supplier,
                updated_at: new Date().toISOString(),
              })
              .eq("id", material.id);

            if (!updateError) {
              updatedCount++;
            }
          }
        }
      }

      await loadMaterials();
      showToast("Đồng bộ hoàn tất", `📦 Tạo mới: ${createdCount} vật liệu | 🏢 Cập nhật NCC: ${updatedCount} vật liệu`, "success");
    } catch (err) {
      console.error("Sync error:", err);
      showToast("Lỗi", "Lỗi đồng bộ: " + getErrorMessage(err), "error");
    } finally {
      setLoading(false);
    }
  };


  // Get unique suppliers and units for filter options - Memoized
  const uniqueSuppliers = useMemo(() => {
    return [...new Set(materials.map((m) => m.supplier).filter(Boolean))];
  }, [materials]);

  const uniqueUnits = useMemo(() => {
    return [...new Set(materials.map((m) => m.unit).filter(Boolean))];
  }, [materials]);

  // Create a map for fast supplier phone lookup - Memoized
  const supplierPhoneMap = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s) => {
      if (s.name && s.phone) {
        map.set(s.name.toLowerCase(), s.phone);
      }
    });
    return map;
  }, [suppliers]);

  // Helper function to get supplier phone from map
  const getSupplierPhone = useCallback((supplierName: string | undefined): string | undefined => {
    if (!supplierName) return undefined;
    return supplierPhoneMap.get(supplierName.toLowerCase());
  }, [supplierPhoneMap]);

  // Debounce search term to prevent excessive re-renders
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Advanced filtering and sorting - Memoized
  const filteredMaterials = useMemo(() => {
    return enhancedMaterials
      .filter((material) => {
        // Get supplier phone for this material
        const supplierPhone =
          material.supplierPhone ||
          getSupplierPhone(material.supplier) ||
          "";

        const matchesSearch =
          material.name?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          material.sku?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          material.supplier?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          supplierPhone.toLowerCase().includes(debouncedSearchTerm.toLowerCase());

        const matchesSupplier = !supplierFilter || material.supplier === supplierFilter;

        const matchesStock =
          !stockFilter ||
          (stockFilter === "empty"
            ? material.stock === 0
            : stockFilter === "low"
              ? material.stock > 0 && material.stock <= 10
              : stockFilter === "normal"
                ? material.stock > 10
                : true);

        const matchesUnit = !unitFilter || material.unit === unitFilter;

        const matchesCategory = !categoryFilter || material.category === categoryFilter;

        return matchesSearch && matchesSupplier && matchesStock && matchesUnit && matchesCategory;
      })
      .map((material) => ({
        ...material,
        // Enrich material with supplier phone from suppliers list
        supplierPhone:
          material.supplierPhone ||
          getSupplierPhone(material.supplier),
      }))
      .sort((a, b) => {
        if (!sortBy) return 0;

        let aValue = a[sortBy];
        let bValue = b[sortBy];

        if (typeof aValue === "string" && typeof bValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (aValue < bValue) return sortOrder === "asc" ? -1 : 1;
        if (aValue > bValue) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
  }, [enhancedMaterials, debouncedSearchTerm, supplierFilter, stockFilter, unitFilter, categoryFilter, sortBy, sortOrder, getSupplierPhone]);

  return (
    <div className="flex flex-col h-full min-h-0 pb-20 md:pb-1">
      {/* Mobile Header - Clean & Simple */}
      <div className="p-3 bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-gray-800 md:hidden sticky top-0 z-30 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveView("materials")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "materials" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
            >
              Kho hàng
            </button>
            <button
              onClick={() => setActiveView("history")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "history" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
            >
              Lịch sử
            </button>
            <button
              onClick={() => setActiveView("orders")}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${activeView === "orders" ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"}`}
            >
              Đặt hàng
            </button>
          </div>

          {/* Mobile Actions */}
          <div className="flex gap-2">
            {activeView === "materials" && (
              <button
                onClick={() => navigate("/materials/goods-receipt/new")}
                className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full shadow-lg active:scale-95 transition-transform"
              >
                <PlusIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search */}
        <input
          type="text"
          placeholder="🔍 Tìm kiếm..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full input-base text-sm"
        />

        {/* Row 3: Filters - Compact */}
        <div className="flex items-center gap-2 mt-2">
          <select
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            className="flex-1 select-base text-xs"
          >
            <option value="">Tất cả NCC</option>
            {uniqueSuppliers.map((supplier) => (
              <option key={supplier} value={supplier}>
                {supplier}
              </option>
            ))}
          </select>
          <select
            value={unitFilter}
            onChange={(e) => setUnitFilter(e.target.value)}
            className="select-base text-xs"
          >
            <option value="">Đơn vị</option>
            {uniqueUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "" | "material" | "product" | "finished_goods")}
            className="select-base text-xs"
          >
            <option value="">Loại</option>
            <option value="material">Vật tư</option>
            <option value="product">Sản phẩm</option>
            <option value="finished_goods">Thành phẩm</option>
          </select>
        </div>

        {/* Row 4: Stats - Single line */}
        <div className="flex items-center justify-between mt-2 text-xs">
          <span className="text-blue-400 font-medium">
            {filteredMaterials.length}/{materials.length} SP
          </span>
          <span className="text-emerald-400">
            Tồn: {materials.reduce((sum, m) => sum + (m.stock || 0), 0).toLocaleString()}
          </span>
          <span className="text-amber-400">Giá trị: {formatCurrency(totalImportValue)}</span>
        </div>

        {/* Row 5: Stock Filter Tabs - Horizontal scroll */}
        <div className="flex gap-1 mt-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setStockFilter("")}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${stockFilter === "" ? "bg-slate-600 text-white" : "bg-slate-700 text-slate-300"
              }`}
          >
            Tất cả <span className="ml-1 opacity-70">{materials.length}</span>
          </button>
          <button
            onClick={() => setStockFilter("normal")}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${stockFilter === "normal"
              ? "bg-emerald-500 text-white"
              : "bg-emerald-900/50 text-emerald-300"
              }`}
          >
            Còn hàng{" "}
            <span className="ml-1 opacity-70">
              {materials.filter((m) => (m.stock || 0) > 10).length}
            </span>
          </button>
          <button
            onClick={() => setStockFilter("low")}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${stockFilter === "low" ? "bg-amber-500 text-white" : "bg-amber-900/50 text-amber-300"
              }`}
          >
            Sắp hết{" "}
            <span className="ml-1 opacity-70">
              {materials.filter((m) => (m.stock || 0) > 0 && (m.stock || 0) <= 10).length}
            </span>
          </button>
          <button
            onClick={() => setStockFilter("empty")}
            className={`flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium ${stockFilter === "empty" ? "bg-red-500 text-white" : "bg-red-900/50 text-red-300"
              }`}
          >
            Hết hàng{" "}
            <span className="ml-1 opacity-70">
              {materials.filter((m) => (m.stock || 0) === 0).length}
            </span>
          </button>
        </div>
      </div>

      {/* Desktop Header - Keep original */}
      <div className="hidden md:flex flex-col md:flex-row md:items-center md:justify-between gap-2 flex-shrink-0 sticky top-0 z-20 bg-slate-100 dark:bg-slate-900 py-1 px-1">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveView("materials")}
            className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${activeView === "materials"
              ? "bg-blue-500 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            📦 Danh sách Kho hàng
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${activeView === "history"
              ? "bg-blue-500 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            📊 Lịch sử
          </button>
          <button
            onClick={() => setActiveView("orders")}
            className={`flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg transition-all ${activeView === "orders"
              ? "bg-blue-500 text-white shadow-sm"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            📦 Đặt hàng NCC
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-wrap">
          {activeView === "materials" && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                📥 Import
              </button>
              <button
                onClick={() => navigate("/materials/goods-receipt/new")}
                className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium shadow-sm transition-all"
              >
                <PlusIcon className="w-4 h-4" />
                Tạo phiếu nhập
              </button>
            </>
          )}
        </div>
      </div>
      {/* Content based on active view */}
      <div className="flex-1 overflow-hidden px-1 md:px-0">
        {activeView === "history" ? (
          <PinImportHistory />
        ) : activeView === "orders" ? (
          <PurchaseOrderManager materials={materials} suppliers={suppliers} />
        ) : (
          <div className="gap-2 flex flex-col h-full">
            {/* Original content continues here */}

            {/* Bulk Actions Toolbar */}
            {showBulkActions && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-800 dark:text-slate-200 font-semibold text-sm">
                      📋 Đã chọn {selectedItems.size} vật tư
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={handleBulkDelete}
                        className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all flex items-center gap-1"
                      >
                        <TrashIcon className="w-4 h-4" />
                        Xóa
                      </button>
                      <button
                        onClick={() =>
                          setBulkAction(bulkAction === "updateSupplier" ? "" : "updateSupplier")
                        }
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-semibold transition-all"
                      >
                        🏢 Cập nhật NCC
                      </button>
                      <button
                        onClick={handlePrintBarcodes}
                        className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-all"
                      >
                        🏷️ In mã vạch
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedItems(new Set());
                      setShowBulkActions(false);
                      setBulkAction("");
                    }}
                    className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 p-1.5 rounded-lg transition-all"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Update Supplier Form */}
                {bulkAction === "updateSupplier" && (
                  <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                          Nhà cung cấp mới
                        </label>
                        <input
                          type="text"
                          value={bulkSupplier}
                          onChange={(e) => setBulkSupplier(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          placeholder="Tên nhà cung cấp..."
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                          Số điện thoại
                        </label>
                        <input
                          type="tel"
                          value={bulkSupplierPhone}
                          onChange={(e) => setBulkSupplierPhone(e.target.value)}
                          className="w-full px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                          placeholder="0xxx xxx xxx"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleBulkUpdateSupplier}
                          className="w-full px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium shadow-sm transition-all"
                        >
                          ✅ Cập nhật {selectedItems.size} vật tư
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Desktop Only: Search and Filters */}
            <div className="hidden md:block bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                {/* Search Bar */}
                <div className="flex-1 min-w-[180px]">
                  <input
                    type="text"
                    placeholder="🔍 Tìm kiếm..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full input-base text-sm"
                  />
                </div>

                {/* Supplier Filter */}
                <select
                  value={supplierFilter}
                  onChange={(e) => setSupplierFilter(e.target.value)}
                  className="select-base text-xs"
                >
                  <option value="">Tất cả NCC</option>
                  {uniqueSuppliers.map((supplier) => (
                    <option key={supplier} value={supplier}>
                      {supplier}
                    </option>
                  ))}
                </select>

                {/* Unit Filter */}
                <select
                  value={unitFilter}
                  onChange={(e) => setUnitFilter(e.target.value)}
                  className="select-base text-xs"
                >
                  <option value="">Đơn vị</option>
                  {uniqueUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                </select>

                {/* Category Filter */}
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value as "" | "material" | "product" | "finished_goods")}
                  className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs"
                >
                  <option value="">Loại</option>
                  <option value="material">Vật tư</option>
                  <option value="product">Sản phẩm</option>
                  <option value="finished_goods">Thành phẩm</option>
                </select>

                {/* Stats */}
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {filteredMaterials.length}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400">
                      {" "}
                      / {materials.length} SP
                    </span>
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                    Tồn:{" "}
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {materials.reduce((sum, m) => sum + (m.stock || 0), 0).toLocaleString()}
                    </span>
                  </span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                    Giá trị:{" "}
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      {formatCurrency(totalImportValue)}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Status - Compact */}
            {loading && (
              <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 rounded text-sm">
                Đang tải dữ liệu...
              </div>
            )}

            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded text-sm">
                {error}
              </div>
            )}

            {/* Quick Stock Filter Tabs - Desktop Only (Mobile has in header) */}
            <div className="hidden md:flex items-center gap-2 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
              <button
                onClick={() => setStockFilter("")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${stockFilter === ""
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
              >
                Tất cả
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${stockFilter === ""
                    ? "bg-slate-800 text-white"
                    : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  {materials.length}
                </span>
              </button>
              <button
                onClick={() => setStockFilter("normal")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${stockFilter === "normal"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
              >
                Còn hàng
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${stockFilter === "normal"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  {materials.filter((m) => (m.stock || 0) > 10).length}
                </span>
              </button>
              <button
                onClick={() => setStockFilter("low")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${stockFilter === "low"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
              >
                Sắp hết
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${stockFilter === "low"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  {materials.filter((m) => (m.stock || 0) > 0 && (m.stock || 0) <= 10).length}
                </span>
              </button>
              <button
                onClick={() => setStockFilter("empty")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${stockFilter === "empty"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                  }`}
              >
                Hết hàng
                <span
                  className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${stockFilter === "empty"
                    ? "bg-slate-800 text-white"
                    : "bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                >
                  {materials.filter((m) => (m.stock || 0) === 0).length}
                </span>
              </button>
            </div>

            {/* Materials Table - Desktop Only */}
            <div className="hidden md:block flex-1 overflow-auto bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={
                            selectedItems.size === filteredMaterials.length &&
                            filteredMaterials.length > 0
                          }
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 text-slate-800 bg-slate-100 border-slate-300 rounded focus:ring-slate-500 dark:focus:ring-slate-400 dark:ring-offset-slate-800 focus:ring-2 dark:bg-slate-700 dark:border-slate-600"
                        />
                      </th>
                      <th
                        className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center gap-1">
                          Tên
                          {sortBy === "name" && (
                            <span className="text-slate-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Đơn vị
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Danh mục
                      </th>
                      <th
                        className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => handleSort("purchasePrice")}
                      >
                        <div className="flex items-center gap-1">
                          Giá nhập
                          {sortBy === "purchasePrice" && (
                            <span className="text-slate-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Giá bán lẻ
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Giá bán sỉ
                      </th>
                      <th
                        className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                        onClick={() => handleSort("stock")}
                      >
                        <div className="flex items-center gap-1">
                          Tồn kho
                          {sortBy === "stock" && (
                            <span className="text-slate-600">{sortOrder === "asc" ? "↑" : "↓"}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Nhà cung cấp
                      </th>
                      <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="px-4 py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                          {loading ? (
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              <span className="text-sm">Đang tải...</span>
                            </div>
                          ) : (
                            <div className="text-sm">Không có nguyên vật liệu nào</div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map((material) => (
                        <tr
                          key={material.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all duration-150 ${selectedItems.has(material.id)
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                            : ""
                            }`}
                        >
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(material.id)}
                              onChange={(e) => handleSelectItem(material.id, e.target.checked)}
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <button
                              onClick={() => handleShowMaterialDetail(material)}
                              className="hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors cursor-pointer text-left"
                            >
                              <div className="font-medium text-sm text-gray-900 dark:text-white">
                                {material.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                                {material.sku}
                              </div>
                            </button>
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {material.unit}
                          </td>
                          <td className="px-3 py-2">
                            {(material as any).category_name ? (
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {(material as any).category_name}
                              </span>
                            ) : (material as any).category ? (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
                                  (material as any).category === "material"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                    : (material as any).category === "product"
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300"
                                }`}
                              >
                                {(material as any).category === "material" && "Vật tư"}
                                {(material as any).category === "product" && "Sản phẩm"}
                                {(material as any).category === "finished_goods" && "Thành phẩm"}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 font-medium">
                            {formatCurrency(material.purchasePrice)}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {material.retailPrice ? formatCurrency(material.retailPrice) : "-"}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                            {material.wholesalePrice
                              ? formatCurrency(material.wholesalePrice)
                              : "-"}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {(() => {
                              const stockValue = material.availableStock || material.stock;
                              const hasCommitments = (material.committedQuantity || 0) > 0;

                              // Color coding based on stock level
                              let badgeColor = "";
                              let badgeIcon = "";

                              if (stockValue === 0) {
                                badgeColor =
                                  "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 ring-1 ring-rose-300 dark:ring-rose-700";
                                badgeIcon = "🔴";
                              } else if (stockValue < 100) {
                                badgeColor =
                                  "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 ring-1 ring-amber-300 dark:ring-amber-700";
                                badgeIcon = "🟡";
                              } else if (stockValue < 500) {
                                badgeColor =
                                  "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700";
                                badgeIcon = "🔵";
                              } else {
                                badgeColor =
                                  "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700";
                                badgeIcon = "🟢";
                              }

                              return (
                                <div className="flex flex-col items-center gap-0.5">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs">{badgeIcon}</span>
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${badgeColor}`}
                                    >
                                      {hasCommitments ? (
                                        <>
                                          <span className="text-current">
                                            {material.availableStock}
                                          </span>
                                          <span className="opacity-60">/{material.stock}</span>
                                        </>
                                      ) : (
                                        stockValue
                                      )}
                                    </span>
                                  </div>
                                  {hasCommitments && (
                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                                      🔒 {material.committedQuantity}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2">
                            {material.supplier ? (
                              <div>
                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                  {material.supplier}
                                </div>
                                {material.supplierPhone && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    {material.supplierPhone}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex justify-center">
                              <div className="relative group">
                                <button
                                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                                  title="Thao tác"
                                >
                                  <Icon
                                    name="dots-three-vertical"
                                    weight="bold"
                                    className="w-5 h-5 text-slate-500 dark:text-slate-400"
                                  />
                                </button>
                                <div className="absolute right-0 top-full mt-1 w-40 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                  <button
                                    onClick={() => handleShowStockAdjustment(material)}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Icon
                                      name="gear"
                                      weight="bold"
                                      className="w-4 h-4 text-teal-500"
                                    />
                                    Điều chỉnh kho
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedMaterialForEdit(material);
                                      setShowEditModal(true);
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                                  >
                                    <Icon
                                      name="pencil"
                                      weight="bold"
                                      className="w-4 h-4 text-amber-500"
                                    />
                                    Chỉnh sửa
                                  </button>
                                  <button
                                    onClick={() => deleteMaterial(material.id)}
                                    className="w-full px-3 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 flex items-center gap-2"
                                  >
                                    <Icon name="trash" weight="bold" className="w-4 h-4" />
                                    Xóa
                                  </button>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Materials Cards - Mobile Only - Compact Flattened Design */}
            <div className="md:hidden flex-1 overflow-auto bg-white dark:bg-slate-900 pb-20">
              {filteredMaterials.length === 0 ? (
                <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                  {loading ? (
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-sm font-medium">Đang tải dữ liệu...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Icon name="package" className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                      <span className="text-sm">Không tìm thấy vật tư nào</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredMaterials.map((material) => {
                    const stockValue = material.availableStock || material.stock;
                    let stockColorClass = "text-emerald-600 dark:text-emerald-500";

                    if (stockValue === 0) {
                      stockColorClass = "text-rose-600 dark:text-rose-500";
                    } else if (stockValue < 10) {
                      stockColorClass = "text-amber-600 dark:text-amber-500";
                    }

                    return (
                      <div
                        key={material.id}
                        onClick={() => handleShowMaterialDetail(material)}
                        className={`active:bg-slate-50 dark:active:bg-slate-800/50 transition-colors cursor-pointer py-3 px-4 ${selectedItems.has(material.id) ? "bg-blue-50/50 dark:bg-blue-900/10" : ""
                          }`}
                      >
                        <div className="flex justify-between items-start gap-3">
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {material.name}
                              </h4>
                            </div>

                            <div className="flex flex-wrap gap-y-1 gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{material.sku}</span>
                              {material.supplier && (
                                <span className="truncate max-w-[120px] flex items-center gap-1">
                                  • {material.supplier}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Right: Quantity & Price */}
                          <div className="text-right flex-shrink-0">
                            <div className={`font-bold text-sm ${stockColorClass}`}>
                              {stockValue} <span className="text-[10px] font-normal text-slate-400">{material.unit}</span>
                            </div>
                            <div className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-1">
                              {formatCurrency(material.purchasePrice)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stats - Compact */}
            <div className="text-xs text-gray-600 dark:text-gray-400 py-1">
              Hiển thị {filteredMaterials.length} / {materials.length} nguyên vật liệu
            </div>

            {/* Form Modal */}
            <MaterialForm
              isOpen={showForm}
              material={editingMaterial}
              onClose={() => {
                setShowForm(false);
                setEditingMaterial(null);
              }}
              onSubmit={saveMaterial}
              existingMaterials={materials}
              suppliers={suppliers}
              setSuppliers={setSuppliers}
              onToast={showToast}
            />

            {/* Material Detail Modal */}
            <MaterialDetailModal
              isOpen={showDetailModal}
              material={selectedMaterialForDetail}
              enhancedMaterials={enhancedMaterials}
              onClose={() => {
                setShowDetailModal(false);
                setSelectedMaterialForDetail(null);
              }}
              onEdit={() => {
                if (selectedMaterialForDetail) {
                  setSelectedMaterialForEdit(selectedMaterialForDetail);
                  setShowEditModal(true);
                  setShowDetailModal(false);
                  setSelectedMaterialForDetail(null);
                }
              }}
            />

            {/* Material Edit Modal */}
            <MaterialEditModal
              isOpen={showEditModal}
              material={selectedMaterialForEdit}
              onClose={() => {
                setShowEditModal(false);
                setSelectedMaterialForEdit(null);
              }}
              onSave={async (updatedMaterial) => {
                try {
                  // Update in database
                  const { error } = await supabase
                    .from("pin_materials")
                    .update({
                      name: updatedMaterial.name,
                      unit: updatedMaterial.unit,
                      purchase_price: updatedMaterial.purchasePrice,
                      retail_price: updatedMaterial.retailPrice,
                      wholesale_price: updatedMaterial.wholesalePrice,
                      supplier: updatedMaterial.supplier || null,
                      supplier_phone: updatedMaterial.supplierPhone || null,
                      description: updatedMaterial.description || null,
                      category: (updatedMaterial as any).category || null,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", updatedMaterial.id);

                  if (error) throw error;

                  // Update local state
                  setMaterials((prev) =>
                    prev.map((m) => (m.id === updatedMaterial.id ? updatedMaterial : m))
                  );

                  showToast("Thành công", "Đã cập nhật vật liệu thành công!", "success");
                } catch (err) {
                  console.error("Error updating material:", err);
                  throw err;
                }
              }}
              suppliers={suppliers}
              onToast={showToast}
            />

            {/* Stock Adjustment Modal */}
            <StockAdjustmentModal
              isOpen={showStockAdjustmentModal}
              material={selectedMaterialForAdjustment}
              onClose={() => {
                setShowStockAdjustmentModal(false);
                setSelectedMaterialForAdjustment(null);
              }}
              onSubmit={handleStockAdjustment}
              onToast={showToast}
            />

            {/* Stock Forecast Modal */}
            <StockForecastModal
              isOpen={showForecastModal}
              material={selectedMaterialForForecast}
              onClose={() => {
                setShowForecastModal(false);
                setSelectedMaterialForForecast(null);
              }}
            />

            {/* Supplier Price Analysis Modal */}
            <SupplierPriceAnalysisModal
              isOpen={showPriceAnalysisModal}
              material={selectedMaterialForPriceAnalysis}
              onClose={() => {
                setShowPriceAnalysisModal(false);
                setSelectedMaterialForPriceAnalysis(null);
              }}
            />
            {/* CSV Import Modal */}
            <MaterialImportModal
              isOpen={showImportModal}
              onClose={() => setShowImportModal(false)}
              onImport={handleCsvImport}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default MaterialManager;
