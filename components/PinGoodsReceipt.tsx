import React, { useState, useMemo, useEffect, useRef } from "react";
import type {
  PinMaterial,
  Supplier,
  CashTransaction,
  User,
  PinMaterialHistory,
} from "../types";
import {
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  MinusIcon,
  MagnifyingGlassIcon,
  CheckCircleIcon,
  ArrowUturnLeftIcon,
} from "./common/Icons";
import { usePinContext } from "../contexts/PinContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { UnitsService } from "../lib/services/UnitsService";

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return "0";
  return new Intl.NumberFormat("vi-VN").format(amount);
};

const generateUniqueId = (prefix = "") => {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateMaterialSKU = (existingMaterials: PinMaterial[] = [], additionalSkus: string[] = []) => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;
  const todayPrefix = `NL-${dateStr}`;
  // Count existing materials with today's prefix
  const countExisting = existingMaterials.filter((m) =>
    m.sku?.startsWith(todayPrefix)
  ).length;
  // Count additional SKUs in current session (e.g., from receiptItems)
  const countAdditional = additionalSkus.filter((sku) =>
    sku?.startsWith(todayPrefix)
  ).length;
  const sequence = String(countExisting + countAdditional + 1).padStart(3, "0");
  return `NL-${dateStr}-${sequence}`;
};

interface ReceiptItem {
  internalId: string;
  materialId: string | null;
  materialName: string;
  sku: string;
  unit: string;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  isNew: boolean;
}

interface PinGoodsReceiptNewProps {
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  currentUser: User | null;
}

// ===== MODAL COMPONENTS =====
const SupplierModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    email: "",
    notes: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    const newSupplier: Supplier = {
      id: crypto.randomUUID(), // Generate proper UUID
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      email: formData.email.trim(),
      notes: formData.notes.trim(),
    };

    onSave(newSupplier);
    setFormData({ name: "", phone: "", address: "", email: "", notes: "" });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            ➕ Thêm nhà cung cấp mới
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên nhà cung cấp..."
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0xxx xxx xxx"
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Địa chỉ
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Nhập địa chỉ..."
              rows={2}
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Ghi chú
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Thêm ghi chú..."
              rows={3}
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-lg transition-colors"
          >
            💾 Lưu nhà cung cấp
          </button>
        </div>
      </div>
    </div>
  );
};

const ProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: PinMaterial) => void;
  existingMaterials?: PinMaterial[];
}> = ({ isOpen, onClose, onSave, existingMaterials = [] }) => {
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    unit: "cái",
    purchasePrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
  });
  const [customUnit, setCustomUnit] = useState("");
  const [savedCustomUnits, setSavedCustomUnits] = useState<string[]>([]);

  // Load units from database
  useEffect(() => {
    const loadUnits = async () => {
      try {
        const units = await UnitsService.getAllUnits();
        setSavedCustomUnits(units.map((u) => u.name));
      } catch (error) {
        console.error("Error loading units:", error);
      }
    };
    loadUnits();
  }, []);

  // Auto-calculate prices when purchase price changes
  useEffect(() => {
    if (formData.purchasePrice > 0) {
      setFormData((prev) => ({
        ...prev,
        retailPrice: Math.round(formData.purchasePrice * 1.4),
        wholesalePrice: Math.round(formData.purchasePrice * 1.2),
      }));
    } else if (formData.purchasePrice === 0) {
      setFormData((prev) => ({
        ...prev,
        retailPrice: 0,
        wholesalePrice: 0,
      }));
    }
  }, [formData.purchasePrice]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value =
      e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên sản phẩm");
      return;
    }

    const finalUnit =
      formData.unit === "custom" ? customUnit.trim() || "cái" : formData.unit;

    // Save custom unit to database
    if (
      formData.unit === "custom" &&
      customUnit.trim() &&
      !savedCustomUnits.includes(customUnit.trim())
    ) {
      try {
        await UnitsService.addUnit(customUnit.trim());
        setSavedCustomUnits((prev) => [...prev, customUnit.trim()]);
      } catch (error) {
        console.error("Error saving custom unit:", error);
      }
    }

    const newProduct: PinMaterial = {
      id: generateUniqueId("M-"),
      name: formData.name.trim(),
      sku: formData.sku.trim() || generateMaterialSKU(existingMaterials),
      unit: finalUnit,
      purchasePrice: formData.purchasePrice,
      retailPrice:
        formData.retailPrice || Math.round(formData.purchasePrice * 1.4),
      wholesalePrice:
        formData.wholesalePrice || Math.round(formData.purchasePrice * 1.2),
      stock: 0,
    };

    onSave(newProduct);
    setFormData({
      name: "",
      sku: "",
      unit: "cái",
      purchasePrice: 0,
      retailPrice: 0,
      wholesalePrice: 0,
    });
    setCustomUnit("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg">
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
            ➕ Thêm sản phẩm mới
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Tên sản phẩm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên sản phẩm..."
              className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Mã SKU
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Tự động tạo"
                className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Đơn vị
              </label>
              {formData.unit === "custom" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Nhập đơn vị..."
                    className="flex-1 px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, unit: "cái" }))
                    }
                    className="px-3 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                >
                  <option value="cái">cái</option>
                  <option value="chiếc">chiếc</option>
                  <option value="bộ">bộ</option>
                  <option value="hộp">hộp</option>
                  <option value="kg">kg</option>
                  <option value="lít">lít</option>
                  {savedCustomUnits.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  <option value="custom">➕ Đơn vị khác...</option>
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Giá nhập <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice || ""}
              onChange={handleChange}
              placeholder="0"
              className="w-full px-4 py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Giá bán lẻ
              </label>
              <input
                type="number"
                name="retailPrice"
                value={formData.retailPrice || ""}
                onChange={handleChange}
                placeholder="Tự động +40%"
                className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                Giá bán sỉ
              </label>
              <input
                type="number"
                name="wholesalePrice"
                value={formData.wholesalePrice || ""}
                onChange={handleChange}
                placeholder="Tự động +20%"
                className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-4 flex gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg transition-colors"
          >
            💾 Lưu sản phẩm
          </button>
        </div>
      </div>
    </div>
  );
};

const PinGoodsReceiptNew: React.FC<PinGoodsReceiptNewProps> = ({
  suppliers,
  setSuppliers,
  currentUser,
}) => {
  const navigate = useNavigate();
  const {
    pinMaterials: materials,
    setPinMaterials: setMaterials,
    setPinMaterialHistory,
    upsertPinMaterial,
    addCashTransaction,
    upsertSupplier,
  } = usePinContext();

  // ===== STATE MANAGEMENT =====
  // Modals
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showProductModal, setShowProductModal] = useState(false);

  // Header - Supplier Info
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null
  );
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [warehouseLocation, setWarehouseLocation] = useState("Kho chính");

  // Center - Product List
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  // Footer - Payment & Summary
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | "">("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [tax, setTax] = useState(0);

  // ===== COMPUTED VALUES =====
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === selectedSupplierId),
    [selectedSupplierId, suppliers]
  );

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearch.trim()) return suppliers;
    const search = supplierSearch.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(search) ||
        s.phone?.toLowerCase().includes(search)
    );
  }, [supplierSearch, suppliers]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return materials || [];
    const search = productSearch.toLowerCase();
    return (materials || [])
      .filter(
        (m: PinMaterial) =>
          m.name.toLowerCase().includes(search) ||
          m.sku?.toLowerCase().includes(search)
      )
      .slice(0, 10);
  }, [productSearch, materials]);

  // Tính toán tổng tiền
  const subtotal = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) => sum + item.quantity * item.purchasePrice,
        0
      ),
    [receiptItems]
  );

  const totalAfterDiscount = subtotal - discount;
  const totalWithTax = totalAfterDiscount + tax;
  const remaining = totalWithTax - amountPaid;

  // Tự động xác định trạng thái
  const paymentStatus = useMemo(() => {
    if (amountPaid === 0) return "unpaid";
    if (amountPaid >= totalWithTax) return "paid";
    return "partial";
  }, [amountPaid, totalWithTax]);

  // ===== HANDLERS =====
  const handleSelectSupplier = (supplier: Supplier) => {
    setSelectedSupplierId(supplier.id);
    setSupplierSearch(supplier.name);
    setShowSupplierDropdown(false);
  };

  const handleAddProductFromSearch = () => {
    if (!productSearch.trim()) return;

    // Tìm sản phẩm đã có
    const existingProduct = (materials || []).find(
      (m: PinMaterial) =>
        m.name.toLowerCase() === productSearch.toLowerCase() ||
        m.sku?.toLowerCase() === productSearch.toLowerCase()
    );

    if (existingProduct) {
      // Thêm vào danh sách
      const newItem: ReceiptItem = {
        internalId: generateUniqueId("item-"),
        materialId: existingProduct.id,
        materialName: existingProduct.name,
        sku: existingProduct.sku,
        unit: existingProduct.unit,
        quantity: 1,
        purchasePrice: existingProduct.purchasePrice || 0,
        retailPrice: existingProduct.retailPrice || 0,
        wholesalePrice: existingProduct.wholesalePrice || 0,
        isNew: false,
      };
      setReceiptItems((prev) => [...prev, newItem]);
      setProductSearch("");
      setShowProductDropdown(false);
    } else {
      // Sản phẩm mới - tạo item mới với SKU unique
      // Collect existing SKUs from current receiptItems to avoid duplicates
      const currentSkus = receiptItems.map((item) => item.sku);
      const newItem: ReceiptItem = {
        internalId: generateUniqueId("item-"),
        materialId: null,
        materialName: productSearch,
        sku: generateMaterialSKU(materials || [], currentSkus),
        unit: "cái",
        quantity: 1,
        purchasePrice: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        isNew: true,
      };
      setReceiptItems((prev) => [...prev, newItem]);
      setProductSearch("");
      setShowProductDropdown(false);
    }
  };

  const handleSelectProduct = (product: PinMaterial) => {
    const newItem: ReceiptItem = {
      internalId: generateUniqueId("item-"),
      materialId: product.id,
      materialName: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: 1,
      purchasePrice: product.purchasePrice || 0,
      retailPrice: product.retailPrice || product.purchasePrice * 1.2,
      wholesalePrice: product.wholesalePrice || product.purchasePrice * 1.1,
      isNew: false,
    };
    setReceiptItems((prev) => [...prev, newItem]);
    setProductSearch("");
    setShowProductDropdown(false);
  };

  const handleSaveNewSupplier = async (supplier: Supplier) => {
    // Save to database first
    if (upsertSupplier) {
      try {
        await upsertSupplier(supplier);
      } catch (error) {
        console.error("Error saving supplier:", error);
        alert("Lỗi lưu nhà cung cấp: " + (error as Error).message);
        return;
      }
    }

    // Then update local state
    setSuppliers((prev) => [supplier, ...prev]);
    setSelectedSupplierId(supplier.id);
    setSupplierSearch(supplier.name);
    setShowSupplierModal(false);
  };

  const handleSaveNewProduct = (product: PinMaterial) => {
    setMaterials((prev: PinMaterial[]) => [product, ...(prev || [])]);
    // Tự động thêm vào receipt
    const newItem: ReceiptItem = {
      internalId: generateUniqueId("item-"),
      materialId: product.id,
      materialName: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: 1,
      purchasePrice: product.purchasePrice,
      retailPrice: product.retailPrice || product.purchasePrice * 1.2,
      wholesalePrice: product.wholesalePrice || product.purchasePrice * 1.1,
      isNew: false,
    };
    setReceiptItems((prev) => [...prev, newItem]);
  };

  const handleUpdateItem = (
    internalId: string,
    field: keyof ReceiptItem,
    value: any
  ) => {
    setReceiptItems((prev) =>
      prev.map((item) =>
        item.internalId === internalId ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveItem = (internalId: string) => {
    setReceiptItems((prev) =>
      prev.filter((item) => item.internalId !== internalId)
    );
  };

  const handleQuantityChange = (internalId: string, delta: number) => {
    setReceiptItems((prev) =>
      prev.map((item) =>
        item.internalId === internalId
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item
      )
    );
  };

  const handleFinalizeReceipt = async () => {
    // Validation
    if (!selectedSupplierId) {
      alert("Vui lòng chọn nhà cung cấp");
      return;
    }

    if (receiptItems.length === 0) {
      alert("Vui lòng thêm ít nhất một sản phẩm");
      return;
    }

    if (!paymentMethod) {
      alert("Vui lòng chọn phương thức thanh toán");
      return;
    }

    if (receiptItems.some((item) => item.purchasePrice <= 0)) {
      alert("Vui lòng nhập giá nhập cho tất cả sản phẩm");
      return;
    }

    try {
      // Cập nhật hoặc tạo mới materials
      const updatedMaterials = [...(materials || [])];
      const newHistoryRecords: PinMaterialHistory[] = [];
      const materialIdMap = new Map<string, string>(); // Track local ID -> DB UUID
      const materialsToSave: PinMaterial[] = [];

      receiptItems.forEach((item) => {
        let finalMaterialId = item.materialId;

        if (item.isNew) {
          // Tạo sản phẩm mới
          finalMaterialId = generateUniqueId("M-");
          materialIdMap.set(item.internalId, finalMaterialId);
          const newMaterial: PinMaterial = {
            id: finalMaterialId,
            name: item.materialName,
            sku: item.sku,
            unit: item.unit,
            purchasePrice: item.purchasePrice,
            retailPrice: item.retailPrice,
            wholesalePrice: item.wholesalePrice,
            stock: item.quantity,
            supplier: selectedSupplier?.name,
          };
          updatedMaterials.push(newMaterial);
        } else if (item.materialId) {
          // Cập nhật sản phẩm có sẵn
          const index = updatedMaterials.findIndex(
            (m) => m.id === item.materialId
          );
          if (index !== -1) {
            updatedMaterials[index] = {
              ...updatedMaterials[index],
              stock: updatedMaterials[index].stock + item.quantity,
              purchasePrice: item.purchasePrice,
              retailPrice: item.retailPrice,
              wholesalePrice: item.wholesalePrice,
            };
            finalMaterialId = item.materialId;
          }
        }

        // Create History Record
        if (finalMaterialId) {
          const historyRecord: PinMaterialHistory = {
            id: generateUniqueId("H-"),
            materialId: finalMaterialId,
            materialName: item.materialName,
            materialSku: item.sku,
            quantity: item.quantity,
            purchasePrice: item.purchasePrice,
            totalCost: item.quantity * item.purchasePrice,
            supplier: selectedSupplier?.name,
            importDate: receiptDate,
            notes: notes,
            userId: currentUser?.id || "unknown",
            userName: currentUser?.name || "Unknown User",
            branchId: "main",
            created_at: new Date().toISOString(),
          };
          newHistoryRecords.push(historyRecord);
          console.log("Created history record:", historyRecord);
        }
      });

      setMaterials(updatedMaterials);

      // Save NEW Materials to Supabase FIRST to get real UUIDs
      if (upsertPinMaterial) {
        const savedMaterialIds: string[] = [];
        
        for (const item of receiptItems) {
          if (item.isNew) {
            const localId = materialIdMap.get(item.internalId);
            const materialToSave = updatedMaterials.find(
              (m) => m.id === localId
            );
            if (materialToSave) {
              try {
                // Insert directly to get the real UUID back
                const { data: insertedData, error: insertError } = await supabase
                  .from("pin_materials")
                  .insert({
                    name: materialToSave.name,
                    sku: materialToSave.sku,
                    unit: materialToSave.unit,
                    purchase_price: materialToSave.purchasePrice ?? 0,
                    retail_price: materialToSave.retailPrice ?? 0,
                    wholesale_price: materialToSave.wholesalePrice ?? 0,
                    stock: materialToSave.stock ?? 0,
                    committed_quantity: 0,
                    supplier: materialToSave.supplier || null,
                    description: materialToSave.description || null,
                    updated_at: new Date().toISOString(),
                  })
                  .select("id")
                  .single();

                if (insertError) {
                  console.error("Error inserting material:", insertError);
                  // If duplicate SKU, try to fetch existing
                  if (insertError.code === "23505") {
                    const { data: existingData } = await supabase
                      .from("pin_materials")
                      .select("id")
                      .eq("sku", materialToSave.sku)
                      .single();
                    if (existingData?.id) {
                      savedMaterialIds.push(existingData.id);
                      materialIdMap.set(item.internalId, existingData.id);
                      const historyIdx = newHistoryRecords.findIndex(
                        (h) => h.materialId === localId
                      );
                      if (historyIdx >= 0) {
                        newHistoryRecords[historyIdx].materialId = existingData.id;
                      }
                    }
                  }
                } else if (insertedData?.id) {
                  savedMaterialIds.push(insertedData.id);
                  // Update mapping with real UUID from database
                  materialIdMap.set(item.internalId, insertedData.id);
                  // Update history records with real UUID
                  const historyIdx = newHistoryRecords.findIndex(
                    (h) => h.materialId === localId
                  );
                  if (historyIdx >= 0) {
                    newHistoryRecords[historyIdx].materialId = insertedData.id;
                  }
                }
              } catch (err) {
                console.error("Error saving material:", err);
              }
            }
          }
        }

        // Save UPDATED materials
        const updatedMaterialsToSave = updatedMaterials.filter((mat) => {
          return receiptItems.some(
            (item) => !item.isNew && item.materialId === mat.id
          );
        });

        for (const mat of updatedMaterialsToSave) {
          try {
            await upsertPinMaterial(mat);
          } catch (err) {
            console.error("Error updating material:", err);
          }
        }
      }

      // Save History (now with real UUIDs)
      if (setPinMaterialHistory) {
        setPinMaterialHistory((prev: PinMaterialHistory[]) => [
          ...newHistoryRecords,
          ...(prev || []),
        ]);
      }

      // Save to Supabase (Async)
      const dbRecords = newHistoryRecords.map((record) => ({
        material_id: record.materialId,
        material_name: record.materialName,
        material_sku: record.materialSku,
        quantity: record.quantity,
        purchase_price: record.purchasePrice,
        total_cost: record.totalCost,
        supplier: record.supplier,
        import_date: record.importDate,
        notes: record.notes,
        user_name: record.userName,
      }));

      console.log("Saving history records:", dbRecords);

      try {
        const { data: historyData, error: historyError } = await supabase
          .from("pin_material_history")
          .insert(dbRecords)
          .select();

        if (historyError) {
          console.error("Error saving history to Supabase:", historyError);
          alert(`Lỗi lưu lịch sử: ${historyError.message}`);
        } else {
          console.log("History saved successfully:", historyData);
        }
      } catch (err) {
        console.error("Exception saving history:", err);
      }

      // Tạo giao dịch tiền mặt nếu đã thanh toán
      if (amountPaid > 0 && addCashTransaction) {
        const cashTransaction: CashTransaction = {
          id: generateUniqueId("CT-"),
          date: receiptDate,
          type: "expense",
          category: "inventory_purchase",
          amount: amountPaid,
          contact: {
            id: selectedSupplierId!,
            name: selectedSupplier?.name || "Unknown",
          },
          notes: notes || `Nhập hàng từ ${selectedSupplier?.name}`,
          paymentSourceId: "default",
          branchId: "main",
        };

        try {
          await addCashTransaction(cashTransaction);
        } catch (err) {
          console.error("Error saving cash transaction:", err);
        }
      }

      // Lưu công nợ nếu còn nợ
      if (remaining > 0) {
        try {
          const debtRecord = {
            supplier_id: selectedSupplierId,
            supplier_name: selectedSupplier?.name || "Unknown",
            amount: remaining,
            description: `Công nợ phiếu nhập ${receiptDate}`,
            due_date: null,
            status: "pending",
          };

          await supabase.from("pin_supplier_debts").insert(debtRecord);
        } catch (err) {
          console.error("Error saving supplier debt:", err);
        }
      }

      alert("Nhập hàng thành công!");

      // Reload materials from database to ensure local state is in sync
      try {
        const { data: refreshedMaterials, error: refreshError } = await supabase
          .from("pin_materials")
          .select("*");
        
        if (!refreshError && refreshedMaterials) {
          const mappedMaterials = refreshedMaterials.map((row: any) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            purchasePrice: Number(row.purchase_price ?? row.purchaseprice ?? 0),
            retailPrice: Number(row.retail_price ?? row.retailprice ?? 0),
            wholesalePrice: Number(row.wholesale_price ?? row.wholesaleprice ?? 0),
            stock: Number(row.stock ?? 0),
            committedQuantity: Number(row.committed_quantity ?? row.committedquantity ?? 0),
            supplier: row.supplier || undefined,
            description: row.description || undefined,
            created_at: row.created_at || row.createdat || undefined,
          }));
          setMaterials(mappedMaterials);
        }
      } catch (refreshErr) {
        console.error("Error refreshing materials:", refreshErr);
      }

      // Reset form
      setReceiptItems([]);
      setSelectedSupplierId(null);
      setSupplierSearch("");
      setAmountPaid(0);
      setDiscount(0);
      setTax(0);
      setNotes("");
      setPaymentMethod("");
    } catch (error) {
      alert("Lỗi khi nhập hàng: " + (error as Error).message);
    }
  };

  // ===== RENDER =====
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* ===== HEADER - Title & Back Button ===== */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3 flex items-center justify-between shrink-0 z-30 shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/materials")}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition-colors"
            title="Quay lại"
          >
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            📦 Tạo phiếu nhập kho
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1 rounded-full">
            {receiptItems.length} sản phẩm
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT GRID ===== */}
      <div className="flex-1 overflow-auto lg:overflow-hidden p-4">
        <div className="grid grid-cols-12 gap-4 h-auto lg:h-full">
          {/* LEFT COLUMN - PRODUCTS (Span 8) */}
          <div className="col-span-12 lg:col-span-8 flex flex-col bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden min-h-[500px] lg:min-h-0">
            {/* Search Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex gap-4 items-center z-20">
              <div className="flex-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MagnifyingGlassIcon className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleAddProductFromSearch();
                    }
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  onBlur={() =>
                    setTimeout(() => setShowProductDropdown(false), 200)
                  }
                  placeholder="Tìm kiếm sản phẩm (Tên hoặc SKU)..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg leading-5 bg-white dark:bg-slate-700 placeholder-slate-500 focus:outline-none focus:placeholder-slate-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
                />

                {/* Dropdown sản phẩm */}
                {showProductDropdown && (
                  <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {filteredProducts.length > 0 ? (
                      <>
                        {filteredProducts.map((product: PinMaterial) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => handleSelectProduct(product)}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b dark:border-slate-700 transition-colors"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {product.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  SKU: {product.sku} | Tồn: {product.stock}{" "}
                                  {product.unit}
                                </div>
                              </div>
                              <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {formatCurrency(product.purchasePrice || 0)}
                              </div>
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setShowProductModal(true);
                            setShowProductDropdown(false);
                          }}
                          className="w-full px-4 py-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center gap-2 border-t border-blue-100 dark:border-blue-800 transition-colors"
                        >
                          <PlusIcon className="w-5 h-5" />
                          Tạo sản phẩm mới
                        </button>
                      </>
                    ) : productSearch.trim() ? (
                      <button
                        type="button"
                        onClick={() => {
                          setShowProductModal(true);
                          setShowProductDropdown(false);
                        }}
                        className="w-full px-4 py-4 text-center hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <div className="text-slate-500 dark:text-slate-400 mb-2">
                          Không tìm thấy sản phẩm "{productSearch}"
                        </div>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-sm">
                          <PlusIcon className="w-4 h-4" />
                          Tạo sản phẩm mới
                        </div>
                      </button>
                    ) : null}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowProductModal(true)}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 font-medium text-sm transition-colors shadow-sm"
              >
                <PlusIcon className="w-5 h-5" />
                Sản phẩm mới
              </button>
            </div>

            {/* Product Table */}
            <div className="flex-1 overflow-auto bg-white dark:bg-slate-800 relative">
              {receiptItems.length > 0 ? (
                <div className="min-w-full inline-block align-middle">
                  <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
                    <thead className="bg-slate-50 dark:bg-slate-700 sticky top-0 z-10">
                      <tr>
                        <th
                          scope="col"
                          className="px-4 py-3 text-left text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider"
                        >
                          Tên sản phẩm / SKU
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider w-24"
                        >
                          Đơn vị
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider bg-orange-50 dark:bg-orange-900/20 w-32"
                        >
                          Giá nhập
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider w-32"
                        >
                          Số lượng
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-right text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider w-32"
                        >
                          Thành tiền
                        </th>
                        <th
                          scope="col"
                          className="px-4 py-3 text-center text-xs font-bold text-slate-500 dark:text-slate-300 uppercase tracking-wider w-12"
                        ></th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
                      {receiptItems.map((item) => (
                        <tr
                          key={item.internalId}
                          className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                        >
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {item.materialName}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.sku}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <input
                              type="text"
                              value={item.unit}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.internalId,
                                  "unit",
                                  e.target.value
                                )
                              }
                              className="w-full px-2 py-1 text-center text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center bg-orange-50/50 dark:bg-orange-900/10">
                            <input
                              type="number"
                              value={item.purchasePrice || ""}
                              onChange={(e) =>
                                handleUpdateItem(
                                  item.internalId,
                                  "purchasePrice",
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-2 py-1 text-right font-medium text-sm border border-orange-300 dark:border-orange-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-orange-500"
                              placeholder="0"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() =>
                                  handleQuantityChange(item.internalId, -1)
                                }
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <MinusIcon className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                value={item.quantity}
                                onChange={(e) =>
                                  handleUpdateItem(
                                    item.internalId,
                                    "quantity",
                                    Math.max(1, Number(e.target.value))
                                  )
                                }
                                className="w-14 px-1 py-1 text-center font-medium text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                                min="1"
                              />
                              <button
                                onClick={() =>
                                  handleQuantityChange(item.internalId, 1)
                                }
                                className="w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300 transition-colors"
                              >
                                <PlusIcon className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right">
                            <div className="font-bold text-slate-900 dark:text-slate-100">
                              {formatCurrency(
                                item.quantity * item.purchasePrice
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-center">
                            <button
                              onClick={() => handleRemoveItem(item.internalId)}
                              className="text-slate-400 hover:text-red-500 transition-colors"
                              title="Xóa"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Toggle hiển thị giá bán (ẩn mặc định) */}
                  <details className="border-t border-slate-200 dark:border-slate-700 mt-4">
                    <summary className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 text-sm font-semibold text-slate-700 dark:text-slate-300 select-none">
                      📊 Cập nhật giá bán (tùy chọn)
                    </summary>
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100 dark:bg-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-slate-600 dark:text-slate-400">
                                Sản phẩm
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                                Giá bán lẻ
                              </th>
                              <th className="px-3 py-2 text-right font-semibold text-slate-600 dark:text-slate-400">
                                Giá bán sỉ
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                            {receiptItems.map((item) => (
                              <tr key={item.internalId}>
                                <td className="px-3 py-2 text-slate-900 dark:text-slate-100">
                                  {item.materialName}
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.retailPrice || ""}
                                    onChange={(e) =>
                                      handleUpdateItem(
                                        item.internalId,
                                        "retailPrice",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-32 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="number"
                                    value={item.wholesalePrice || ""}
                                    onChange={(e) =>
                                      handleUpdateItem(
                                        item.internalId,
                                        "wholesalePrice",
                                        Number(e.target.value)
                                      )
                                    }
                                    className="w-32 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500"
                                  />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </details>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-700/50 rounded-full flex items-center justify-center mb-4">
                    <svg
                      className="w-12 h-12 text-slate-300 dark:text-slate-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-1">
                    Chưa có sản phẩm nào
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-6">
                    Sử dụng thanh tìm kiếm ở trên để thêm sản phẩm vào phiếu
                    nhập kho này.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        document
                          .querySelector<HTMLInputElement>(
                            'input[placeholder*="Tìm kiếm"]'
                          )
                          ?.focus()
                      }
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                      Tìm sản phẩm
                    </button>
                    <button
                      onClick={() => setShowProductModal(true)}
                      className="px-4 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 rounded-lg font-medium transition-colors shadow-sm"
                    >
                      Tạo mới
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - INFO & PAYMENT (Span 4) */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-4 lg:overflow-y-auto pr-1">
            {/* Card 1: General Info */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                🏢 Thông tin chung
              </h3>

              {/* Nhà cung cấp */}
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Nhà cung cấp <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierDropdown(true);
                        setSelectedSupplierId(null);
                      }}
                      onFocus={() => setShowSupplierDropdown(true)}
                      onBlur={() =>
                        setTimeout(() => setShowSupplierDropdown(false), 200)
                      }
                      placeholder="Tìm nhà cung cấp..."
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-sm"
                    />

                    {/* Dropdown NCC */}
                    {showSupplierDropdown && filteredSuppliers.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        {filteredSuppliers.map((supplier) => (
                          <button
                            key={supplier.id}
                            type="button"
                            onClick={() => handleSelectSupplier(supplier)}
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 border-b dark:border-slate-700 last:border-0 transition-colors"
                          >
                            <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                              {supplier.name}
                            </div>
                            {supplier.phone && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {supplier.phone}
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowSupplierModal(true)}
                    className="px-3 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                  >
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
                {selectedSupplier && (
                  <div className="mt-2 text-xs text-slate-500 dark:text-slate-400 flex flex-col gap-1 bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700">
                    {selectedSupplier.phone && (
                      <span>📞 {selectedSupplier.phone}</span>
                    )}
                    {selectedSupplier.address && (
                      <span>📍 {selectedSupplier.address}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Ngày nhập */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Ngày nhập
                  </label>
                  <input
                    type="date"
                    value={receiptDate}
                    onChange={(e) => setReceiptDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-sm"
                  />
                </div>

                {/* Kho nhập */}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Kho nhập
                  </label>
                  <select
                    value={warehouseLocation}
                    onChange={(e) => setWarehouseLocation(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-sm"
                  >
                    <option value="Kho chính">Kho chính</option>
                    <option value="Kho phụ">Kho phụ</option>
                    <option value="Kho chi nhánh">Kho chi nhánh</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Payment & Notes */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4 space-y-4 flex-1">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
                💰 Thanh toán
              </h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 dark:text-slate-400">
                    Tổng tiền hàng:
                  </span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">
                    Chiết khấu (%):
                  </span>
                  <input
                    type="number"
                    value={discount || ""}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                    placeholder="0"
                  />
                </div>

                <div className="flex justify-between items-center gap-2">
                  <span className="text-slate-600 dark:text-slate-400">
                    Thuế (VAT):
                  </span>
                  <input
                    type="number"
                    value={tax || ""}
                    onChange={(e) => setTax(Number(e.target.value))}
                    className="w-20 px-2 py-1 text-right border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800"
                    placeholder="0"
                  />
                </div>

                <div className="border-t border-dashed border-slate-300 dark:border-slate-600 my-2"></div>

                <div className="flex justify-between items-center text-base">
                  <span className="font-bold text-slate-800 dark:text-slate-100">
                    TỔNG CỘNG:
                  </span>
                  <span className="font-bold text-orange-600 dark:text-orange-400 text-xl">
                    {formatCurrency(totalWithTax)}
                  </span>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Thanh toán ngay:
                  </label>
                  <input
                    type="number"
                    value={amountPaid || ""}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full px-3 py-2 text-right font-bold border-2 border-green-500/50 rounded-lg bg-white dark:bg-slate-800 focus:ring-2 focus:ring-green-500"
                    placeholder="0"
                  />
                </div>

                {remaining > 0 && (
                  <div className="flex justify-between items-center text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    <span>Còn nợ:</span>
                    <span>{formatCurrency(remaining)}</span>
                  </div>
                )}

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Hình thức:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`px-2 py-2 rounded border text-center text-xs font-medium transition-all ${
                        paymentMethod === "cash"
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      💵 Tiền mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank")}
                      className={`px-2 py-2 rounded border text-center text-xs font-medium transition-all ${
                        paymentMethod === "bank"
                          ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      🏦 Chuyển khoản
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Ghi chú:
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                  />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={handleFinalizeReceipt}
              disabled={
                !selectedSupplierId ||
                receiptItems.length === 0 ||
                !paymentMethod
              }
              className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Hoàn tất nhập kho
            </button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        onSave={handleSaveNewSupplier}
      />
      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        onSave={handleSaveNewProduct}
        existingMaterials={materials || []}
      />
    </div>
  );
};

export default PinGoodsReceiptNew;
