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
  const selectedItemsRef = useRef<HTMLDivElement>(null);

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
    const allMaterials = materials || [];
    if (!productSearch.trim()) {
      // Khi không có từ khóa tìm kiếm, hiển thị 20 sản phẩm gần nhất
      return allMaterials.slice(0, 20);
    }
    const search = productSearch.toLowerCase();
    return allMaterials
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
    // Auto scroll to selected items section
    setTimeout(() => {
      selectedItemsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
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
      // Collect all new materials to insert in batch for better reliability
      const newMaterialsToInsert: Array<{item: ReceiptItem; localId: string; material: PinMaterial}> = [];
      
      for (const item of receiptItems) {
        if (item.isNew) {
          const localId = materialIdMap.get(item.internalId);
          const materialToSave = updatedMaterials.find((m) => m.id === localId);
          if (localId && materialToSave) {
            newMaterialsToInsert.push({ item, localId, material: materialToSave });
          }
        }
      }

      // Insert each new material one by one with proper error handling
      for (const { item, localId, material } of newMaterialsToInsert) {
        try {
          console.log(`Inserting material: ${material.name} (SKU: ${material.sku})`);
          
          const { data: insertedData, error: insertError } = await supabase
            .from("pin_materials")
            .insert({
              name: material.name,
              sku: material.sku,
              unit: material.unit,
              purchase_price: material.purchasePrice ?? 0,
              retail_price: material.retailPrice ?? 0,
              wholesale_price: material.wholesalePrice ?? 0,
              stock: material.stock ?? 0,
              committed_quantity: 0,
              supplier: material.supplier || null,
              description: material.description || null,
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();

          if (insertError) {
            console.error(`Error inserting material ${material.name}:`, insertError);
            // If duplicate SKU, try to fetch existing and update stock
            if (insertError.code === "23505") {
              const { data: existingData } = await supabase
                .from("pin_materials")
                .select("id, stock")
                .eq("sku", material.sku)
                .single();
              if (existingData?.id) {
                // Update stock of existing material
                const newStock = (existingData.stock || 0) + (material.stock || 0);
                await supabase
                  .from("pin_materials")
                  .update({ stock: newStock })
                  .eq("id", existingData.id);
                  
                // Update history record with existing ID
                const historyIdx = newHistoryRecords.findIndex((h) => h.materialId === localId);
                if (historyIdx >= 0) {
                  newHistoryRecords[historyIdx].materialId = existingData.id;
                }
                console.log(`Updated existing material ${material.name} with new stock: ${newStock}`);
              }
            }
          } else if (insertedData?.id) {
            console.log(`Successfully inserted material ${material.name} with ID: ${insertedData.id}`);
            // Update history records with real UUID from database
            const historyIdx = newHistoryRecords.findIndex((h) => h.materialId === localId);
            if (historyIdx >= 0) {
              newHistoryRecords[historyIdx].materialId = insertedData.id;
            }
          }
        } catch (err) {
          console.error(`Exception saving material ${material.name}:`, err);
        }
      }

      // Save UPDATED materials (existing materials with stock change)
      if (upsertPinMaterial) {
        const updatedMaterialsToSave = updatedMaterials.filter((mat) => {
          return receiptItems.some((item) => !item.isNew && item.materialId === mat.id);
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

      {/* ===== MAIN CONTENT - 2 COLUMNS LAYOUT ===== */}
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT COLUMN - PRODUCT LIST */}
        <div className="w-1/2 flex flex-col border-r border-slate-700 bg-slate-900">
          {/* Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Danh mục sản phẩm</h2>
              <p className="text-xs text-slate-400">Chọn để thêm vào giỏ</p>
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-transparent border border-cyan-500 text-cyan-400 rounded-lg hover:bg-cyan-500/10 font-medium text-sm transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Thêm mới
            </button>
          </div>

          {/* Search Bar */}
          <div className="p-4 border-b border-slate-700 flex gap-2">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleAddProductFromSearch();
                  }
                }}
                placeholder="Hoặc tìm kiếm thủ công..."
                className="block w-full pl-10 pr-3 py-3 border border-slate-600 rounded-lg bg-slate-800 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
              />
            </div>
            {/* Grid/Scan buttons */}
            <button className="p-3 bg-slate-700 border border-slate-600 rounded-lg text-slate-300 hover:bg-slate-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
            </button>
            <button className="p-3 bg-cyan-600 border border-cyan-500 rounded-lg text-white hover:bg-cyan-500 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-auto">
            {filteredProducts.length > 0 ? (
              <div className="divide-y divide-slate-700/50">
                {filteredProducts.map((product: PinMaterial) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => handleSelectProduct(product)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-800 transition-all group text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center">
                        <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                      <div>
                        <div className="font-semibold text-white group-hover:text-cyan-400 transition-colors">
                          {product.name}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="text-slate-500">{product.sku}</span>
                          <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
                            {product.category || 'Chưa phân loại'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-slate-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mb-3">
                  <MagnifyingGlassIcon className="w-8 h-8 text-slate-600" />
                </div>
                <p className="text-slate-400 mb-3">
                  {productSearch.trim() ? `Không tìm thấy "${productSearch}"` : 'Chưa có sản phẩm trong kho'}
                </p>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  <PlusIcon className="w-4 h-4 inline mr-1" />
                  Tạo sản phẩm mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - CART & PAYMENT */}
        <div className="w-1/2 flex flex-col bg-slate-900 overflow-auto">
          {/* Supplier Section */}
          <div className="p-4 border-b border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-white font-semibold">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Nhà cung cấp
              </div>
              <button
                type="button"
                onClick={() => setShowSupplierModal(true)}
                className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors"
              >
                <PlusIcon className="w-4 h-4" />
                Thêm NCC
              </button>
            </div>
            <div className="relative">
              <select
                value={selectedSupplierId || ""}
                onChange={(e) => {
                  const supplier = suppliers.find(s => s.id === e.target.value);
                  if (supplier) handleSelectSupplier(supplier);
                }}
                className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="">Chọn nhà cung cấp...</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Cart Header */}
          <div className="p-4 border-b border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-semibold">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              Giỏ hàng nhập
            </div>
            <span className="px-3 py-1 bg-cyan-600 text-white text-sm font-bold rounded-full">
              {receiptItems.length} sản phẩm
            </span>
          </div>

          {/* Cart Items */}
          <div ref={selectedItemsRef} className="flex-1 overflow-auto p-4 space-y-3">
            {receiptItems.length === 0 ? (
              <div className="text-center text-slate-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-3 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <p>Chưa có sản phẩm trong giỏ</p>
                <p className="text-xs mt-1">Chọn sản phẩm từ danh mục bên trái</p>
              </div>
            ) : (
              receiptItems.map((item, index) => (
                <div
                  key={item.internalId}
                  className="bg-slate-800 rounded-xl p-4 border border-slate-700"
                >
                  {/* Item Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 bg-cyan-600 text-white text-sm font-bold rounded-lg flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <div>
                        <div className="font-semibold text-white">{item.materialName}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>{item.sku}</span>
                          <span className="px-1.5 py-0.5 bg-slate-700 text-slate-300 rounded text-[10px]">
                            {item.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveItem(item.internalId)}
                      className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                      title="Xóa"
                    >
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Quantity & Price Row */}
                  <div className="flex items-center gap-3">
                    {/* Quantity Controls */}
                    <div className="flex items-center bg-slate-700 rounded-lg">
                      <button
                        onClick={() => handleQuantityChange(item.internalId, -1)}
                        className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded-l-lg transition-colors"
                      >
                        <MinusIcon className="w-4 h-4" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleUpdateItem(item.internalId, "quantity", Math.max(1, Number(e.target.value)))
                        }
                        className="w-14 h-9 text-center font-bold text-white bg-transparent border-0 focus:outline-none focus:ring-0"
                        min="1"
                      />
                      <button
                        onClick={() => handleQuantityChange(item.internalId, 1)}
                        className="w-9 h-9 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-600 rounded-r-lg transition-colors"
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Purchase Price */}
                    <input
                      type="number"
                      value={item.purchasePrice || ""}
                      onChange={(e) =>
                        handleUpdateItem(item.internalId, "purchasePrice", Number(e.target.value))
                      }
                      className="flex-1 px-3 py-2 text-right font-medium text-white bg-slate-700 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Giá nhập"
                    />

                    {/* Retail Price */}
                    <input
                      type="number"
                      value={item.retailPrice || ""}
                      onChange={(e) =>
                        handleUpdateItem(item.internalId, "retailPrice", Number(e.target.value))
                      }
                      className="w-28 px-3 py-2 text-right text-slate-300 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      placeholder="Giá bán"
                    />

                    {/* Line Total */}
                    <div className="w-28 text-right font-bold text-cyan-400">
                      {formatCurrency(item.quantity * item.purchasePrice)} đ
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Total Section */}
          <div className="border-t border-slate-700 bg-gradient-to-r from-cyan-900/50 to-teal-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-white">TỔNG THANH TOÁN</span>
              <div className="text-right">
                <div className="text-2xl font-bold text-cyan-400">{formatCurrency(subtotal)} đ</div>
                <div className="text-xs text-slate-400">{receiptItems.length} SP</div>
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="p-4 border-t border-slate-700">
            <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
              Phương thức thanh toán <span className="text-red-400">*</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === "cash"
                    ? "bg-green-600/20 border-green-500 text-green-400"
                    : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                }`}
              >
                💵 Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("bank")}
                className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border font-medium transition-all ${
                  paymentMethod === "bank"
                    ? "bg-blue-600/20 border-blue-500 text-blue-400"
                    : "bg-slate-800 border-slate-600 text-slate-300 hover:border-slate-500"
                }`}
              >
                🏦 Chuyển khoản
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-4 border-t border-slate-700 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSaveReceipt}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
              LƯU NHÁP
            </button>
            <button
              type="button"
              onClick={handleSubmitReceipt}
              disabled={receiptItems.length === 0 || !selectedSupplierId}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 disabled:from-slate-600 disabled:to-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              NHẬP KHO
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
