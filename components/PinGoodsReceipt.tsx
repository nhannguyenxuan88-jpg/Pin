import React, { useState, useMemo, useEffect, useRef } from "react";
import type { PinMaterial, Supplier, CashTransaction, User, PinMaterialHistory } from "../types";
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
import { useIsMobile } from "../lib/hooks/useMediaQuery";

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return "0";
  return new Intl.NumberFormat("vi-VN").format(amount);
};

const generateUniqueId = (prefix = "") => {
  return `${prefix}${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const generateMaterialSKU = (
  existingMaterials: PinMaterial[] = [],
  additionalSkus: string[] = []
) => {
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, "0");
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const yyyy = today.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;
  const todayPrefix = `NL-${dateStr}`;
  // Count existing materials with today's prefix
  const countExisting = existingMaterials.filter((m) => m.sku?.startsWith(todayPrefix)).length;
  // Count additional SKUs in current session (e.g., from receiptItems)
  const countAdditional = additionalSkus.filter((sku) => sku?.startsWith(todayPrefix)).length;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 md:p-4 flex justify-between items-center">
          <h2 className="text-base md:text-xl font-bold text-slate-800 dark:text-slate-100">
            ➕ Thêm nhà cung cấp mới
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên nhà cung cấp..."
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Số điện thoại
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0xxx xxx xxx"
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Địa chỉ
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Nhập địa chỉ..."
              rows={2}
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>

          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Ghi chú
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Thêm ghi chú..."
              rows={3}
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4 flex gap-2 md:gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm md:text-base"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-semibold shadow-lg transition-colors text-sm md:text-base"
          >
            💾 Lưu NCC
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setFormData((prev) => ({ ...prev, [e.target.name]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên sản phẩm");
      return;
    }

    const finalUnit = formData.unit === "custom" ? customUnit.trim() || "cái" : formData.unit;

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
      retailPrice: formData.retailPrice || Math.round(formData.purchasePrice * 1.4),
      wholesalePrice: formData.wholesalePrice || Math.round(formData.purchasePrice * 1.2),
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
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 md:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 md:p-4 flex justify-between items-center rounded-t-xl">
          <h2 className="text-base md:text-xl font-bold text-slate-800 dark:text-slate-100">
            ➕ Thêm sản phẩm mới
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-5 h-5 md:w-6 md:h-6" />
          </button>
        </div>

        <div className="p-4 md:p-6 space-y-3 md:space-y-4">
          <div>
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Tên sản phẩm <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên sản phẩm..."
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Mã SKU
              </label>
              <input
                type="text"
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                placeholder="Tự động tạo"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Đơn vị
              </label>
              {formData.unit === "custom" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customUnit}
                    onChange={(e) => setCustomUnit(e.target.value)}
                    placeholder="Nhập đơn vị..."
                    className="flex-1 px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
                  />
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, unit: "cái" }))}
                    className="px-2 md:px-3 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  name="unit"
                  value={formData.unit}
                  onChange={handleChange}
                  className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
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
            <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
              Giá nhập <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice || ""}
              onChange={handleChange}
              placeholder="0"
              className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg focus:ring-2 focus:ring-orange-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-semibold text-sm md:text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Giá bán lẻ
              </label>
              <input
                type="number"
                name="retailPrice"
                value={formData.retailPrice || ""}
                onChange={handleChange}
                placeholder="Tự động +40%"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
              />
            </div>

            <div>
              <label className="block text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Giá bán sỉ
              </label>
              <input
                type="number"
                name="wholesalePrice"
                value={formData.wholesalePrice || ""}
                onChange={handleChange}
                placeholder="Tự động +20%"
                className="w-full px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm md:text-base"
              />
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700 p-3 md:p-4 flex gap-2 md:gap-3 rounded-b-xl">
          <button
            onClick={onClose}
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-sm md:text-base"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold shadow-lg transition-colors text-sm md:text-base"
          >
            💾 Lưu SP
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
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split("T")[0]);
  const [warehouseLocation, setWarehouseLocation] = useState("Kho chính");

  // Center - Product List
  const [receiptItems, setReceiptItems] = useState<ReceiptItem[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const selectedItemsRef = useRef<HTMLDivElement>(null);

  // Footer - Payment & Summary
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash"); // Mặc định tiền mặt
  const [isDebt, setIsDebt] = useState(false); // Mặc định thanh toán đủ
  const [debtAmount, setDebtAmount] = useState(0); // Số tiền nợ khi ghi nợ
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
      (s) => s.name.toLowerCase().includes(search) || s.phone?.toLowerCase().includes(search)
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
          m.name.toLowerCase().includes(search) || m.sku?.toLowerCase().includes(search)
      )
      .slice(0, 10);
  }, [productSearch, materials]);

  // Tính toán tổng tiền
  const subtotal = useMemo(
    () => receiptItems.reduce((sum, item) => sum + item.quantity * item.purchasePrice, 0),
    [receiptItems]
  );

  const totalAfterDiscount = subtotal - discount;
  const totalWithTax = totalAfterDiscount + tax;

  // Tính số tiền thanh toán thực tế
  const amountPaid = isDebt ? totalWithTax - debtAmount : totalWithTax;
  const remaining = totalWithTax - amountPaid;

  // Tự động xác định trạng thái
  const paymentStatus = useMemo(() => {
    if (isDebt && debtAmount > 0) return "partial";
    if (!isDebt) return "paid";
    return "unpaid";
  }, [isDebt, debtAmount]);

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
      selectedItemsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
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

  const handleUpdateItem = (internalId: string, field: keyof ReceiptItem, value: any) => {
    setReceiptItems((prev) =>
      prev.map((item) => (item.internalId === internalId ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveItem = (internalId: string) => {
    setReceiptItems((prev) => prev.filter((item) => item.internalId !== internalId));
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
            supplierPhone: selectedSupplier?.phone,
          };
          updatedMaterials.push(newMaterial);
        } else if (item.materialId) {
          // Cập nhật sản phẩm có sẵn
          const index = updatedMaterials.findIndex((m) => m.id === item.materialId);
          if (index !== -1) {
            updatedMaterials[index] = {
              ...updatedMaterials[index],
              stock: updatedMaterials[index].stock + item.quantity,
              purchasePrice: item.purchasePrice,
              retailPrice: item.retailPrice,
              wholesalePrice: item.wholesalePrice,
              supplier: selectedSupplier?.name || updatedMaterials[index].supplier,
              supplierPhone: selectedSupplier?.phone || updatedMaterials[index].supplierPhone,
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
      const newMaterialsToInsert: Array<{
        item: ReceiptItem;
        localId: string;
        material: PinMaterial;
      }> = [];

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
              supplier_phone: material.supplierPhone || null,
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
                // Update stock of existing material + supplier info
                const newStock = (existingData.stock || 0) + (material.stock || 0);
                await supabase
                  .from("pin_materials")
                  .update({
                    stock: newStock,
                    supplier: material.supplier || undefined,
                    supplier_phone: material.supplierPhone || undefined,
                  })
                  .eq("id", existingData.id);

                // Update history record with existing ID
                const historyIdx = newHistoryRecords.findIndex((h) => h.materialId === localId);
                if (historyIdx >= 0) {
                  newHistoryRecords[historyIdx].materialId = existingData.id;
                }
                console.log(
                  `Updated existing material ${material.name} with new stock: ${newStock}`
                );
              }
            }
          } else if (insertedData?.id) {
            console.log(
              `Successfully inserted material ${material.name} with ID: ${insertedData.id}`
            );
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
          amount: -Math.abs(amountPaid), // ✅ Chi tiền = số âm
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
      setIsDebt(false);
      setDebtAmount(0);
      setDiscount(0);
      setTax(0);
      setNotes("");
      setPaymentMethod("cash");
    } catch (error) {
      alert("Lỗi khi nhập hàng: " + (error as Error).message);
    }
  };

  // Mobile tab state
  const isMobile = useIsMobile();
  const [mobileActiveTab, setMobileActiveTab] = useState<"products" | "cart" | "payment">(
    "products"
  );

  // ===== RENDER =====
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-64px)] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
      {/* ===== HEADER ===== */}
      <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 px-3 md:px-6 py-3 md:py-4 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-2 md:gap-4">
          <button
            onClick={() => navigate("/materials")}
            className="p-2 md:p-2.5 hover:bg-slate-700/50 rounded-xl text-slate-400 hover:text-white transition-all"
            title="Quay lại"
          >
            <ArrowUturnLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base md:text-xl font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 md:w-8 md:h-8 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center text-xs md:text-sm">
                📦
              </span>
              <span className="hidden sm:inline">Nhập kho mới</span>
              <span className="sm:hidden">Nhập kho</span>
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400 mt-0.5 hidden sm:block">
              Tạo phiếu nhập hàng từ nhà cung cấp
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {receiptItems.length > 0 && (
            <div className="flex items-center gap-1.5 md:gap-2 px-2.5 md:px-4 py-1.5 md:py-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg md:rounded-xl">
              <span className="w-5 h-5 md:w-6 md:h-6 bg-cyan-500 rounded-full flex items-center justify-center text-white text-[10px] md:text-xs font-bold">
                {receiptItems.length}
              </span>
              <span className="text-cyan-400 text-xs md:text-sm font-medium">SP</span>
            </div>
          )}
        </div>
      </div>

      {/* ===== MOBILE TAB NAVIGATION ===== */}
      <div className="md:hidden flex border-b border-slate-700/50 bg-slate-800/50 shrink-0">
        <button
          onClick={() => setMobileActiveTab("products")}
          className={`flex-1 py-3 text-xs font-medium transition-all relative ${
            mobileActiveTab === "products" ? "text-cyan-400" : "text-slate-400"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
            Sản phẩm
          </div>
          {mobileActiveTab === "products" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400"></div>
          )}
        </button>
        <button
          onClick={() => setMobileActiveTab("cart")}
          className={`flex-1 py-3 text-xs font-medium transition-all relative ${
            mobileActiveTab === "cart" ? "text-orange-400" : "text-slate-400"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Giỏ hàng
            {receiptItems.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                {receiptItems.length}
              </span>
            )}
          </div>
          {mobileActiveTab === "cart" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-400"></div>
          )}
        </button>
        <button
          onClick={() => setMobileActiveTab("payment")}
          className={`flex-1 py-3 text-xs font-medium transition-all relative ${
            mobileActiveTab === "payment" ? "text-green-400" : "text-slate-400"
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Thanh toán
          </div>
          {mobileActiveTab === "payment" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"></div>
          )}
        </button>
      </div>

      {/* ===== MAIN CONTENT - 3 COLUMNS LAYOUT (Desktop) / Tabs (Mobile) ===== */}
      <div className="flex-1 flex overflow-hidden p-2 md:p-4 gap-2 md:gap-4">
        {/* LEFT COLUMN - PRODUCT CATALOG (40% on desktop, full width on mobile when active) */}
        <div
          className={`${isMobile ? (mobileActiveTab === "products" ? "flex" : "hidden") : ""} w-full md:w-[40%] flex flex-col bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden`}
        >
          {/* Header */}
          <div className="p-3 md:p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
            <div>
              <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
                <svg
                  className="w-4 h-4 md:w-5 md:h-5 text-cyan-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
                Danh mục sản phẩm
              </h2>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5">
                Click để thêm vào giỏ nhập
              </p>
            </div>
            <button
              onClick={() => setShowProductModal(true)}
              className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 rounded-lg hover:bg-cyan-500/30 text-[10px] md:text-xs font-medium transition-all"
            >
              <PlusIcon className="w-3 h-3 md:w-3.5 md:h-3.5" />
              <span className="hidden sm:inline">Thêm SP</span>
              <span className="sm:hidden">+</span>
            </button>
          </div>

          {/* Search */}
          <div className="p-2 md:p-3 border-b border-slate-700/50">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm sản phẩm theo tên hoặc SKU..."
                className="w-full pl-9 pr-4 py-2 md:py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-transparent transition-all"
              />
            </div>
          </div>

          {/* Product List */}
          <div className="flex-1 overflow-auto">
            {filteredProducts.length > 0 ? (
              <div className="p-2 space-y-1">
                {filteredProducts.map((product: PinMaterial) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      handleSelectProduct(product);
                      if (isMobile) setMobileActiveTab("cart");
                    }}
                    className="w-full flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-xl hover:bg-slate-700/50 transition-all group text-left active:scale-[0.98]"
                  >
                    <div className="w-8 h-8 md:w-10 md:h-10 bg-gradient-to-br from-slate-700 to-slate-800 rounded-lg md:rounded-xl flex items-center justify-center shrink-0 group-hover:from-cyan-600 group-hover:to-blue-600 transition-all">
                      <svg
                        className="w-4 h-4 md:w-5 md:h-5 text-slate-400 group-hover:text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-xs md:text-sm truncate group-hover:text-cyan-400 transition-colors">
                        {product.name}
                      </div>
                      <div className="flex items-center gap-1.5 md:gap-2 mt-0.5">
                        <span className="text-[10px] md:text-xs text-slate-500 font-mono truncate max-w-[80px] md:max-w-none">
                          {product.sku}
                        </span>
                        <span className="text-[10px] md:text-xs text-slate-400">•</span>
                        <span className="text-[10px] md:text-xs text-green-400">
                          Tồn: {product.stock || 0}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs md:text-sm font-semibold text-cyan-400">
                        {formatCurrency(product.purchasePrice || 0)}
                      </div>
                      <div className="text-[9px] md:text-[10px] text-slate-500 uppercase">
                        Giá nhập
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-4 md:p-6">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-3">
                  <MagnifyingGlassIcon className="w-6 h-6 md:w-7 md:h-7 text-slate-500" />
                </div>
                <p className="text-slate-400 text-xs md:text-sm text-center mb-3">
                  {productSearch.trim() ? `Không tìm thấy "${productSearch}"` : "Chưa có sản phẩm"}
                </p>
                <button
                  onClick={() => setShowProductModal(true)}
                  className="px-3 md:px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs md:text-sm font-medium transition-colors"
                >
                  + Tạo sản phẩm mới
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MIDDLE COLUMN - CART (35% desktop, full width mobile) */}
        <div
          className={`${isMobile ? (mobileActiveTab === "cart" ? "flex" : "hidden") : ""} w-full md:w-[35%] flex flex-col bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden`}
        >
          {/* Header */}
          <div className="p-3 md:p-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
            <h2 className="text-sm md:text-base font-bold text-white flex items-center gap-2">
              <svg
                className="w-4 h-4 md:w-5 md:h-5 text-orange-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Giỏ hàng nhập
            </h2>
            {receiptItems.length > 0 && (
              <span className="px-2 py-1 md:px-2.5 bg-orange-500/20 border border-orange-500/30 text-orange-400 text-[10px] md:text-xs font-bold rounded-lg">
                {receiptItems.length} SP
              </span>
            )}
          </div>

          {/* Cart Items */}
          <div ref={selectedItemsRef} className="flex-1 overflow-auto p-2 md:p-3 space-y-2">
            {receiptItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-8 md:py-0">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center mb-3">
                  <svg
                    className="w-6 h-6 md:w-7 md:h-7 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                </div>
                <p className="text-slate-400 text-xs md:text-sm">Chưa có sản phẩm</p>
                <p className="text-slate-500 text-[10px] md:text-xs mt-1">
                  Chọn từ danh mục {isMobile ? "" : "bên trái"}
                </p>
                {isMobile && (
                  <button
                    onClick={() => setMobileActiveTab("products")}
                    className="mt-4 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    ← Xem sản phẩm
                  </button>
                )}
              </div>
            ) : (
              receiptItems.map((item, index) => (
                <div
                  key={item.internalId}
                  className="bg-slate-900/50 rounded-lg p-2 border border-slate-700/50 hover:border-slate-600 transition-all"
                >
                  {/* Mobile Layout - Compact */}
                  <div className="md:hidden">
                    {/* Header row: Number + Name + Delete */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-5 h-5 bg-orange-500 text-white text-[9px] font-bold rounded flex items-center justify-center shrink-0">
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-white text-xs truncate">
                          {item.materialName}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.internalId)}
                        className="p-1 text-slate-500 hover:text-red-400 rounded transition-all"
                      >
                        <XMarkIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Compact row: Qty + Prices + Total */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {/* Quantity */}
                      <div>
                        <label className="text-[8px] text-slate-500 mb-0.5 block">SL</label>
                        <div className="flex items-center bg-slate-800 rounded overflow-hidden h-7">
                          <button
                            onClick={() => handleQuantityChange(item.internalId, -1)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <MinusIcon className="w-2.5 h-2.5" />
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
                            className="w-6 h-7 text-center text-white bg-transparent border-0 text-xs font-bold focus:outline-none"
                            min="1"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.internalId, 1)}
                            className="w-5 h-7 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700"
                          >
                            <PlusIcon className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>

                      {/* Purchase Price */}
                      <div>
                        <label className="text-[8px] text-slate-500 mb-0.5 block">Giá nhập</label>
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
                          className="w-full h-7 px-1 text-right text-white bg-slate-800 border border-orange-500/30 rounded text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-orange-500"
                          placeholder="0"
                        />
                      </div>

                      {/* Retail Price */}
                      <div>
                        <label className="text-[8px] text-slate-500 mb-0.5 block">Giá bán</label>
                        <input
                          type="number"
                          value={item.retailPrice || ""}
                          onChange={(e) =>
                            handleUpdateItem(item.internalId, "retailPrice", Number(e.target.value))
                          }
                          className="w-full h-7 px-1 text-right text-slate-300 bg-slate-800/50 border border-slate-600/30 rounded text-[11px] focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="0"
                        />
                      </div>

                      {/* Total */}
                      <div>
                        <label className="text-[8px] text-slate-500 mb-0.5 block">T.Tiền</label>
                        <div className="h-7 flex items-center justify-end px-1 bg-cyan-500/10 border border-cyan-500/20 rounded">
                          <span className="text-[11px] font-bold text-cyan-400">
                            {formatCurrency(item.quantity * item.purchasePrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden md:block">
                    {/* Item Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium text-white text-sm truncate">
                            {item.materialName}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {item.sku}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveItem(item.internalId)}
                        className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-all shrink-0"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quantity & Prices */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500 uppercase mb-1 block">
                          SL
                        </label>
                        <div className="flex items-center bg-slate-800 rounded-lg overflow-hidden">
                          <button
                            onClick={() => handleQuantityChange(item.internalId, -1)}
                            className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
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
                            className="w-10 h-8 text-center text-white bg-transparent border-0 text-sm font-medium focus:outline-none"
                            min="1"
                          />
                          <button
                            onClick={() => handleQuantityChange(item.internalId, 1)}
                            className="w-7 h-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                          >
                            <PlusIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500 uppercase mb-1 block">
                          Giá nhập
                        </label>
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
                          className="w-full h-8 px-2 text-right text-white bg-slate-800 border border-slate-600/50 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500 uppercase mb-1 block">
                          Giá bán
                        </label>
                        <input
                          type="number"
                          value={item.retailPrice || ""}
                          onChange={(e) =>
                            handleUpdateItem(item.internalId, "retailPrice", Number(e.target.value))
                          }
                          className="w-full h-8 px-2 text-right text-slate-300 bg-slate-800/50 border border-slate-600/30 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-1">
                        <label className="text-[10px] text-slate-500 uppercase mb-1 block">
                          Thành tiền
                        </label>
                        <div className="h-8 flex items-center justify-end px-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          <span className="text-sm font-bold text-cyan-400">
                            {formatCurrency(item.quantity * item.purchasePrice)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Total */}
          {receiptItems.length > 0 && (
            <div className="p-3 md:p-4 border-t border-slate-700/50 bg-gradient-to-r from-cyan-900/30 to-blue-900/30">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-xs md:text-sm">Tổng tiền hàng:</span>
                <span className="text-lg md:text-xl font-bold text-cyan-400">
                  {formatCurrency(subtotal)} đ
                </span>
              </div>
              {/* Mobile: Button to go to payment */}
              {isMobile && (
                <button
                  onClick={() => setMobileActiveTab("payment")}
                  className="w-full mt-3 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                >
                  Tiếp tục thanh toán →
                </button>
              )}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN - PAYMENT (25% desktop, full width mobile) */}
        <div
          className={`${isMobile ? (mobileActiveTab === "payment" ? "flex" : "hidden") : ""} w-full md:w-[25%] flex flex-col bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden`}
        >
          {/* Supplier */}
          <div className="p-3 md:p-4 border-b border-slate-700/50 bg-slate-800/50">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] md:text-xs font-semibold text-slate-400 uppercase tracking-wide">
                Nhà cung cấp
              </span>
              <button
                onClick={() => setShowSupplierModal(true)}
                className="text-cyan-400 hover:text-cyan-300 text-[10px] md:text-xs font-medium"
              >
                + Thêm NCC
              </button>
            </div>
            <select
              value={selectedSupplierId || ""}
              onChange={(e) => {
                const supplier = suppliers.find((s) => s.id === e.target.value);
                if (supplier) handleSelectSupplier(supplier);
              }}
              className="w-full px-3 py-2 md:py-2.5 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none cursor-pointer"
            >
              <option value="">Chọn nhà cung cấp...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Payment Details */}
          <div className="flex-1 overflow-auto p-3 md:p-4 space-y-2.5 md:space-y-3">
            {/* Discount */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] md:text-xs text-slate-400">Chiết khấu (%):</span>
              <input
                type="number"
                value={discount || ""}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-16 md:w-20 px-2 py-1.5 text-right bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="0"
              />
            </div>

            {/* Tax */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] md:text-xs text-slate-400">Thuế VAT:</span>
              <input
                type="number"
                value={tax || ""}
                onChange={(e) => setTax(Number(e.target.value))}
                className="w-16 md:w-20 px-2 py-1.5 text-right bg-slate-900/50 border border-slate-600/50 rounded-lg text-white text-xs md:text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500"
                placeholder="0"
              />
            </div>

            <div className="border-t border-dashed border-slate-600/50 my-2 md:my-3"></div>

            {/* Total */}
            <div className="p-2.5 md:p-3 bg-gradient-to-r from-cyan-900/40 to-blue-900/40 rounded-xl border border-cyan-500/20">
              <div className="flex items-center justify-between">
                <span className="text-xs md:text-sm font-semibold text-white">TỔNG CỘNG:</span>
                <span className="text-base md:text-lg font-bold text-cyan-400">
                  {formatCurrency(totalWithTax)} đ
                </span>
              </div>
            </div>

            {/* Payment Type Toggle */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block">
                Hình thức thanh toán:
              </label>
              <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsDebt(false);
                    setDebtAmount(0);
                  }}
                  className={`py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    !isDebt
                      ? "bg-green-500/20 border-2 border-green-500 text-green-400"
                      : "bg-slate-900/50 border border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  ✅ Thanh toán đủ
                </button>
                <button
                  type="button"
                  onClick={() => setIsDebt(true)}
                  className={`py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-medium transition-all flex items-center justify-center gap-1 ${
                    isDebt
                      ? "bg-orange-500/20 border-2 border-orange-500 text-orange-400"
                      : "bg-slate-900/50 border border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  📝 Ghi nợ
                </button>
              </div>
            </div>

            {/* Debt Amount - Only show when isDebt */}
            {isDebt && (
              <div className="p-2.5 md:p-3 bg-orange-900/20 border border-orange-500/30 rounded-xl space-y-2">
                <label className="text-[10px] md:text-xs text-orange-400 font-medium block">
                  Số tiền ghi nợ:
                </label>
                <input
                  type="number"
                  value={debtAmount || ""}
                  onChange={(e) => setDebtAmount(Math.min(Number(e.target.value), totalWithTax))}
                  className="w-full px-3 py-2 text-right text-sm md:text-base font-bold bg-slate-900/50 border border-orange-500/50 rounded-lg text-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                  placeholder="0"
                  max={totalWithTax}
                />
                <div className="flex justify-between text-[10px] md:text-xs">
                  <span className="text-slate-400">Thanh toán ngay:</span>
                  <span className="text-green-400 font-medium">{formatCurrency(amountPaid)} đ</span>
                </div>
              </div>
            )}

            {/* Payment Summary */}
            {!isDebt && (
              <div className="flex items-center justify-between p-2 md:p-2.5 bg-green-900/30 border border-green-500/30 rounded-xl">
                <span className="text-[10px] md:text-xs text-green-400">💰 Thanh toán:</span>
                <span className="text-xs md:text-sm font-bold text-green-400">
                  {formatCurrency(totalWithTax)} đ
                </span>
              </div>
            )}

            {/* Payment Method */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block">
                Phương thức <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-medium transition-all ${
                    paymentMethod === "cash"
                      ? "bg-green-500/20 border border-green-500/50 text-green-400"
                      : "bg-slate-900/50 border border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  💵 Tiền mặt
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`py-2 md:py-2.5 rounded-xl text-[10px] md:text-xs font-medium transition-all ${
                    paymentMethod === "bank"
                      ? "bg-blue-500/20 border border-blue-500/50 text-blue-400"
                      : "bg-slate-900/50 border border-slate-600/50 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  🏦 Chuyển khoản
                </button>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] md:text-xs text-slate-400 mb-1.5 block">Ghi chú:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhập ghi chú..."
                rows={2}
                className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600/50 rounded-xl text-white text-[11px] md:text-xs focus:outline-none focus:ring-1 focus:ring-cyan-500 resize-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="p-3 md:p-4 border-t border-slate-700/50 space-y-2">
            {/* Mobile: Back to cart button */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setMobileActiveTab("cart")}
                className="w-full py-2 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs transition-all flex items-center justify-center gap-1"
              >
                ← Quay lại giỏ hàng
              </button>
            )}
            <button
              type="button"
              onClick={handleFinalizeReceipt}
              disabled={receiptItems.length === 0 || !selectedSupplierId || !paymentMethod}
              className="w-full py-2.5 md:py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
            >
              <svg
                className="w-4 h-4 md:w-5 md:h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              HOÀN TẤT NHẬP KHO
            </button>
            <button
              type="button"
              onClick={() => navigate("/materials")}
              className="w-full py-2 md:py-2.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-xl font-medium text-xs md:text-sm transition-all"
            >
              Hủy bỏ
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
