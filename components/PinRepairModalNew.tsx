import React, { useState, useMemo, useEffect } from "react";
import type { PinRepairOrder, PinRepairMaterial, User, OutsourcingItem } from "../types";
import { usePinContext } from "../contexts/PinContext";
import { PlusIcon, TrashIcon, XMarkIcon } from "./common/Icons";

const generateUniqueId = (prefix = "SC") => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const counter = Math.floor(Math.random() * 1000);
  const ts = Date.now() % 10000; // Add timestamp for uniqueness
  return `${prefix}-${day}${month}${year}-${counter}${ts}`;
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

const parseCurrencyInput = (value: string): number => {
  return Number(String(value).replace(/[^0-9]/g, "")) || 0;
};

const formatCurrencyInput = (value: number | string): string => {
  const num = Number(String(value).replace(/[^0-9]/g, ""));
  if (isNaN(num) || num === 0) return "";
  return new Intl.NumberFormat("vi-VN").format(num);
};

// For outsourcing price fields: allow signed values (negative or positive).
const parseSignedCurrencyInput = (value: string): number => {
  const raw = String(value || "").trim();
  const isNegative = raw.startsWith("-");
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const num = Number(digits);
  return isNegative ? -num : num;
};

const formatSignedCurrencyInput = (value: number | string): string => {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num === 0) return "";
  const abs = Math.abs(Math.trunc(num));
  const formatted = new Intl.NumberFormat("vi-VN").format(abs);
  return num < 0 ? `-${formatted}` : formatted;
};

interface PinRepairModalNewProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: PinRepairOrder) => Promise<void>;
  initialOrder?: PinRepairOrder | null;
  currentUser: User | null;
}

export const PinRepairModalNew: React.FC<PinRepairModalNewProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  currentUser,
}) => {
  const { pinMaterials, pinCustomers, upsertPinCustomer, addToast } = usePinContext();

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "warn" | "info") => {
    addToast?.({ id: crypto.randomUUID(), message, type });
  };

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };

  const [formData, setFormData] = useState<Partial<PinRepairOrder>>({
    customerName: "",
    customerPhone: "",
    deviceName: "",
    issueDescription: "",
    technicianName: currentUser?.name || "",
    status: "Tiếp nhận",
    materialsUsed: [],
    laborCost: 0,
    notes: "",
    paymentStatus: "unpaid",
    partialPaymentAmount: 0,
    depositAmount: 0,
    paymentMethod: undefined,
    dueDate: undefined,
  });

  const [materialInput, setMaterialInput] = useState({
    materialName: "",
    quantity: 1,
    price: 0,
  });

  const [materialSearch, setMaterialSearch] = useState("");
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [showQuotePrint, setShowQuotePrint] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Check if order is completed and paid (CANNOT BE EDITED)
  const isCompleted = useMemo(() => {
    if (!initialOrder) return false;
    const isReturned = initialOrder.status === "Trả máy";
    const isPaid = initialOrder.paymentStatus === "paid";
    const hasDeducted = initialOrder.materialsDeducted === true;
    return isReturned && isPaid && hasDeducted;
  }, [initialOrder]);

  // Gia công ngoài / Đặt hàng input state
  const [outsourcingInput, setOutsourcingInput] = useState({
    description: "",
    quantity: 1,
    costPrice: 0,
    sellingPrice: 0,
  });

  // Tab state for materials/outsourcing sections
  const [activeItemTab, setActiveItemTab] = useState<"materials" | "outsourcing">("materials");

  // Filter materials based on search - hiển thị TẤT CẢ vật liệu (kể cả hết hàng)
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return [];
    const search = materialSearch.toLowerCase();
    return (pinMaterials || [])
      .filter(
        (m: any) => m.name.toLowerCase().includes(search) || m.sku?.toLowerCase().includes(search)
      )
      .slice(0, 15);
  }, [pinMaterials, materialSearch]);

  // Tính toán tình trạng thiếu hàng (bao gồm cả vật liệu mới chưa có trong kho)
  const materialShortageInfo = useMemo(() => {
    const shortages: {
      materialName: string;
      needed: number;
      inStock: number;
      shortage: number;
      isNew?: boolean;
    }[] = [];
    let hasShortage = false;
    let hasNewMaterial = false;

    (formData.materialsUsed || []).forEach((mat) => {
      const material = (pinMaterials || []).find(
        (m: any) => m.name.toLowerCase() === mat.materialName.toLowerCase()
      );

      // Vật liệu CHƯA có trong kho
      if (!material) {
        hasShortage = true;
        hasNewMaterial = true;
        shortages.push({
          materialName: mat.materialName,
          needed: mat.quantity,
          inStock: 0,
          shortage: mat.quantity,
          isNew: true, // Đánh dấu vật liệu mới
        });
        return;
      }

      const inStock = material.stock || 0;
      const alreadyUsedInOtherItems =
        (formData.materialsUsed || [])
          .filter((m) => m.materialName.toLowerCase() === mat.materialName.toLowerCase())
          .reduce((sum, m) => sum + m.quantity, 0) - mat.quantity;
      const availableStock = Math.max(0, inStock - alreadyUsedInOtherItems);

      if (mat.quantity > availableStock) {
        hasShortage = true;
        shortages.push({
          materialName: mat.materialName,
          needed: mat.quantity,
          inStock: availableStock,
          shortage: mat.quantity - availableStock,
          isNew: false,
        });
      }
    });

    return { hasShortage, shortages, hasNewMaterial };
  }, [formData.materialsUsed, pinMaterials]);

  // Load initial data
  useEffect(() => {
    if (isOpen && initialOrder) {
      // Parse outsourcingItems from notes if stored there
      let cleanNotes = initialOrder.notes || "";
      let parsedOutsourcingItems: OutsourcingItem[] = initialOrder.outsourcingItems || [];

      if (cleanNotes.includes("__OUTSOURCING__")) {
        const parts = cleanNotes.split("__OUTSOURCING__");
        cleanNotes = parts[0].trim();
        try {
          if (parts[1]) {
            parsedOutsourcingItems = JSON.parse(parts[1]);
          }
        } catch (e) {
          // Failed to parse outsourcing items from notes - ignore
        }
      }

      setFormData({
        customerName: initialOrder.customerName || "",
        customerPhone: initialOrder.customerPhone || "",
        deviceName: initialOrder.deviceName || "",
        issueDescription: initialOrder.issueDescription || "",
        technicianName: initialOrder.technicianName || currentUser?.name || "",
        status: initialOrder.status || "Tiếp nhận",
        materialsUsed: initialOrder.materialsUsed || [],
        outsourcingItems: parsedOutsourcingItems,
        laborCost: initialOrder.laborCost || 0,
        notes: cleanNotes,
        paymentStatus: initialOrder.paymentStatus || "unpaid",
        partialPaymentAmount: initialOrder.partialPaymentAmount || 0,
        depositAmount: initialOrder.depositAmount || 0,
        paymentMethod: initialOrder.paymentMethod,
        dueDate: initialOrder.dueDate,
      });
    } else if (isOpen && !initialOrder) {
      setFormData({
        customerName: "",
        customerPhone: "",
        deviceName: "",
        issueDescription: "",
        technicianName: currentUser?.name || "",
        status: "Tiếp nhận",
        materialsUsed: [],
        laborCost: 0,
        notes: "",
        paymentStatus: "unpaid",
        partialPaymentAmount: 0,
        depositAmount: 0,
        paymentMethod: undefined,
        dueDate: undefined,
      });
    }
  }, [isOpen, initialOrder, currentUser]);

  // Filter customers based on search
  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return [];
    const search = customerSearch.toLowerCase();
    return (pinCustomers || [])
      .filter((c: any) => c.name?.toLowerCase().includes(search) || c.phone?.includes(search))
      .slice(0, 8);
  }, [pinCustomers, customerSearch]);

  const handleSelectCustomer = (customer: any) => {
    setFormData((prev) => ({
      ...prev,
      customerName: customer.name,
      customerPhone: customer.phone || "",
    }));
    setCustomerSearch("");
    setShowCustomerDropdown(false);
  };

  const handleAddNewCustomer = async () => {
    if (!newCustomerData.name.trim()) {
      showToast("Vui lòng nhập tên khách hàng", "warn");
      return;
    }
    if (!newCustomerData.phone.trim()) {
      showToast("Vui lòng nhập số điện thoại", "warn");
      return;
    }

    try {
      const customer = {
        id: crypto.randomUUID(),
        name: newCustomerData.name.trim(),
        phone: newCustomerData.phone.trim(),
        email: newCustomerData.email.trim(),
        address: newCustomerData.address.trim(),
        notes: "",
      };

      if (upsertPinCustomer) {
        await upsertPinCustomer(customer);
      }

      setFormData((prev) => ({
        ...prev,
        customerName: customer.name,
        customerPhone: customer.phone,
      }));

      setNewCustomerData({ name: "", phone: "", email: "", address: "" });
      setShowAddCustomerModal(false);
      showToast("Đã thêm khách hàng mới", "success");
    } catch (error) {
      showToast("Lỗi khi thêm khách hàng: " + (error as Error).message, "error");
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "laborCost" || name === "depositAmount"
          ? parseCurrencyInput(value)
          : name === "dueDate"
            ? value
              ? new Date(value).toISOString()
              : undefined
            : value,
    }));
    if (name === "customerName") {
      setCustomerSearch(value);
      setShowCustomerDropdown(!!value.trim());
    }
  };

  // Pending material for confirm dialog
  const [pendingMaterial, setPendingMaterial] = useState<{
    materialName: string;
    quantity: number;
    price: number;
    materialId: string;
    inStock: number;
    shortage?: number;
  } | null>(null);

  const handleAddMaterial = () => {
    const materialName = materialSearch.trim() || materialInput.materialName.trim();

    if (!materialName) {
      showToast("Vui lòng nhập tên vật liệu", "warn");
      return;
    }
    if (materialInput.quantity <= 0) {
      showToast("Số lượng phải lớn hơn 0", "warn");
      return;
    }

    // Check if material exists in inventory
    const material = (pinMaterials || []).find(
      (m: any) => m.name.toLowerCase() === materialName.toLowerCase()
    );

    let inStock = 0;
    let shortage = 0;

    if (material) {
      const currentStock = material.stock || 0;
      const alreadyUsed =
        (formData.materialsUsed || [])
          .filter((m) => m.materialName.toLowerCase() === materialName.toLowerCase())
          .reduce((sum, m) => sum + m.quantity, 0) || 0;
      const availableStock = Math.max(0, currentStock - alreadyUsed);
      inStock = availableStock;

      if (materialInput.quantity > availableStock) {
        shortage = materialInput.quantity - availableStock;
        // Show confirm dialog
        setPendingMaterial({
          materialName,
          quantity: materialInput.quantity,
          price: materialInput.price || material?.retailPrice || 0,
          materialId: material?.id || generateUniqueId("MAT-NEW"),
          inStock,
          shortage,
        });
        showConfirmDialog(
          "Thiếu hàng",
          `Vật liệu: ${materialName}\nCần: ${materialInput.quantity}\nTồn kho: ${currentStock}\nĐã dùng: ${alreadyUsed}\nCòn lại: ${availableStock}\nThiếu: ${shortage}\n\nBạn vẫn muốn thêm vào báo giá?`,
          () => confirmAddMaterial()
        );
        return;
      }
    } else {
      // Vật liệu mới chưa có trong kho
      shortage = materialInput.quantity;
      setPendingMaterial({
        materialName,
        quantity: materialInput.quantity,
        price: materialInput.price || 0,
        materialId: generateUniqueId("MAT-NEW"),
        inStock: 0,
        shortage,
      });
      showConfirmDialog(
        "Vật liệu mới",
        `"${materialName}" chưa có trong kho.\nSố lượng cần: ${materialInput.quantity}\n\nBạn cần đặt hàng NCC.\nVẫn muốn thêm vào báo giá?`,
        () => confirmAddMaterial()
      );
      return;
    }

    // No confirm needed - add directly
    addMaterialToForm(materialName, materialInput.quantity, materialInput.price || material?.retailPrice || 0, material?.id || generateUniqueId("MAT-NEW"), inStock, undefined);
  };

  const confirmAddMaterial = () => {
    if (pendingMaterial) {
      addMaterialToForm(
        pendingMaterial.materialName,
        pendingMaterial.quantity,
        pendingMaterial.price,
        pendingMaterial.materialId,
        pendingMaterial.inStock,
        pendingMaterial.shortage
      );
      setPendingMaterial(null);
    }
  };

  const addMaterialToForm = (materialName: string, quantity: number, price: number, materialId: string, inStock: number, shortage?: number) => {
    const newMaterial: PinRepairMaterial = {
      materialId,
      materialName,
      quantity,
      price,
      inStock,
      shortage: shortage && shortage > 0 ? shortage : undefined,
    };

    setFormData((prev) => ({
      ...prev,
      materialsUsed: [...(prev.materialsUsed || []), newMaterial],
    }));

    setMaterialInput({ materialName: "", quantity: 1, price: 0 });
    setMaterialSearch("");
    setShowMaterialDropdown(false);
  };

  const handleRemoveMaterial = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      materialsUsed: (prev.materialsUsed || []).filter((_, i) => i !== index),
    }));
  };

  // Pending outsourcing for confirm dialog
  const [pendingOutsourcing, setPendingOutsourcing] = useState<OutsourcingItem | null>(null);

  // === Gia công ngoài / Đặt hàng handlers ===
  const handleAddOutsourcing = () => {
    if (!outsourcingInput.description.trim()) {
      showToast("Vui lòng nhập mô tả công việc gia công", "warn");
      return;
    }
    if (outsourcingInput.quantity <= 0) {
      showToast("Số lượng phải lớn hơn 0", "warn");
      return;
    }

    const newItem: OutsourcingItem = {
      id: generateUniqueId("GC"),
      description: outsourcingInput.description.trim(),
      quantity: outsourcingInput.quantity,
      costPrice: outsourcingInput.costPrice,
      sellingPrice: outsourcingInput.sellingPrice,
      total: outsourcingInput.quantity * outsourcingInput.sellingPrice,
    };

    if (outsourcingInput.costPrice <= 0) {
      setPendingOutsourcing(newItem);
      showConfirmDialog(
        "Cảnh báo lợi nhuận",
        "Giá nhập (Giá vốn) đang là 0.\n\nViệc này sẽ khiến Lợi nhuận = Doanh thu (lãi 100%).\nBạn có chắc chắn muốn tiếp tục?",
        () => confirmAddOutsourcing()
      );
      return;
    }

    addOutsourcingToForm(newItem);
  };

  const confirmAddOutsourcing = () => {
    if (pendingOutsourcing) {
      addOutsourcingToForm(pendingOutsourcing);
      setPendingOutsourcing(null);
    }
  };

  const addOutsourcingToForm = (item: OutsourcingItem) => {
    setFormData((prev) => ({
      ...prev,
      outsourcingItems: [...(prev.outsourcingItems || []), item],
    }));

    setOutsourcingInput({
      description: "",
      quantity: 1,
      costPrice: 0,
      sellingPrice: 0,
    });
  };

  const handleRemoveOutsourcing = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      outsourcingItems: (prev.outsourcingItems || []).filter((_, i) => i !== index),
    }));
  };

  const calculateTotal = () => {
    const materialsTotal = (formData.materialsUsed || []).reduce(
      (sum, m) => sum + m.quantity * m.price,
      0
    );
    const outsourcingTotal = (formData.outsourcingItems || []).reduce(
      (sum, item) => sum + item.total,
      0
    );
    return materialsTotal + outsourcingTotal + (formData.laborCost || 0);
  };

  const calculateRemaining = () => {
    const total = calculateTotal();
    const deposit = formData.depositAmount || 0;
    return Math.max(0, total - deposit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // CRITICAL: Prevent double-submit
    if (isSubmitting) {
      return;
    }

    if (!currentUser) {
      showToast("Vui lòng đăng nhập", "warn");
      return;
    }

    if (!formData.customerName?.trim()) {
      showToast("Vui lòng nhập tên khách hàng", "warn");
      return;
    }

    if (!formData.customerPhone?.trim()) {
      showToast("Vui lòng nhập số điện thoại", "warn");
      return;
    }

    if (!formData.issueDescription?.trim()) {
      showToast("Vui lòng mô tả sự cố", "warn");
      return;
    }

    setIsSubmitting(true);

    try {
      const existingCustomer = (pinCustomers || []).find(
        (c: any) =>
          c.name?.toLowerCase() === formData.customerName?.toLowerCase() ||
          c.phone === formData.customerPhone
      );

      if (!existingCustomer && upsertPinCustomer && formData.customerName) {
        const newCustomer = {
          id: crypto.randomUUID(),
          name: formData.customerName.trim(),
          phone: formData.customerPhone?.trim() || "",
          email: "",
          address: "",
          notes: "Tự động tạo từ phiếu sửa chữa",
        };
        await upsertPinCustomer(newCustomer);
      }

      const total = calculateTotal();

      if (total <= 0) {
        showToast("Vui lòng nhập ít nhất: vật liệu, gia công ngoài, hoặc phí công", "warn");
        setIsSubmitting(false);
        return;
      }

      // Validate payment method when deposit > 0 OR payment status is paid/partial
      const depositAmt = Number(formData.depositAmount || 0);
      const needsPaymentMethod =
        depositAmt > 0 || formData.paymentStatus === "paid" || formData.paymentStatus === "partial";

      if (needsPaymentMethod && !formData.paymentMethod) {
        showToast("Vui lòng chọn phương thức thanh toán", "warn");
        setIsSubmitting(false);
        return;
      }

      if (formData.paymentStatus === "partial") {
        const amt = Number(formData.partialPaymentAmount || 0);
        if (amt <= 0) {
          showToast("Vui lòng nhập số tiền thanh toán cho hình thức thanh toán một phần.", "warn");
          setIsSubmitting(false);
          return;
        }
        if (amt >= total) {
          showToast("Số tiền thanh toán một phần phải nhỏ hơn tổng số tiền.", "warn");
          setIsSubmitting(false);
          return;
        }
      }

      const orderToSave: PinRepairOrder = {
        id: initialOrder?.id || generateUniqueId(),
        creationDate: initialOrder?.creationDate || new Date().toISOString(),
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        deviceName: formData.deviceName?.trim() || "",
        issueDescription: formData.issueDescription.trim(),
        technicianName: formData.technicianName?.trim() || currentUser.name,
        status: (formData.status as any) || "Tiếp nhận",
        materialsUsed: formData.materialsUsed || [],
        outsourcingItems: formData.outsourcingItems || [],
        laborCost: formData.laborCost || 0,
        total,
        notes: formData.notes?.trim() || "",
        paymentStatus: (formData.paymentStatus as any) || "unpaid",
        partialPaymentAmount:
          formData.paymentStatus === "partial"
            ? Number(formData.partialPaymentAmount || 0)
            : undefined,
        depositAmount: formData.depositAmount || 0,
        paymentMethod: formData.paymentMethod,
        paymentDate: formData.paymentDate,
        dueDate: formData.dueDate,
        cashTransactionId: formData.cashTransactionId,
      };

      // Warn when marking as "Trả máy" (Complete) -> Inventory Deduction
      if (orderToSave.status === "Trả máy" && (!initialOrder?.materialsDeducted)) {
        setIsSubmitting(false);
        showConfirmDialog(
          "Xác nhận hoàn tất & trừ kho",
          "Khi chuyển sang 'Trả máy', hệ thống sẽ:\n1. Trừ tồn kho vật tư đã sử dụng\n2. Ghi nhận doanh thu & lợi nhuận\n3. Tạo phiếu thu (nếu thanh toán)\n\nBạn có chắc chắn?",
          async () => {
            try {
              await onSave(orderToSave);
              onClose();
            } catch (error) {
              showToast("Lỗi: " + (error as Error).message, "error");
            }
          }
        );
        return;
      }

      await onSave(orderToSave);
      onClose();
    } catch (error) {
      showToast("Lỗi: " + (error as Error).message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const total = calculateTotal();
  const remaining = calculateRemaining();
  const materialsTotal = (formData.materialsUsed || []).reduce(
    (sum, m) => sum + m.quantity * m.price,
    0
  );

  // Determine button text based on action
  const getButtonText = () => {
    if (isSubmitting) return "Đang xử lý...";

    if (!initialOrder) {
      // Creating new order
      const hasDeposit = formData.depositAmount && Number(formData.depositAmount) > 0;
      return hasDeposit ? "💰 Đặt cọc & Tạo phiếu" : "✅ Tạo phiếu";
    }

    // Updating existing order
    const isReturning = formData.status === "Trả máy";
    const needsPayment =
      formData.paymentStatus === "unpaid" || formData.paymentStatus === "partial";

    if (isReturning && needsPayment) {
      return "💳 Thanh toán & Trả máy";
    }

    return "📝 Cập nhật";
  };

  const getHeaderTitle = () => {
    if (!initialOrder) {
      const hasDeposit = formData.depositAmount && Number(formData.depositAmount) > 0;
      return hasDeposit ? "Tạo phiếu & Đặt cọc" : "Tạo phiếu sửa chữa mới";
    }

    const isReturning = formData.status === "Trả máy";
    const needsPayment =
      formData.paymentStatus === "unpaid" || formData.paymentStatus === "partial";

    if (isReturning && needsPayment) {
      return "Thanh toán & Trả máy cho khách";
    }

    return "Cập nhật phiếu sửa chữa";
  };


  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[96vh]">

        {/* ── HEADER ── */}
        <div className="px-5 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold flex-shrink-0">
              {initialOrder ? "✏" : "+"}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{getHeaderTitle()}</h2>
              {initialOrder && <p className="text-[10px] font-medium text-slate-400 mt-0.5 tracking-wider uppercase">{initialOrder.id}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg p-1.5 transition-all" type="button">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0">

          {/* ── BANNER hoàn tất ── */}
          {isCompleted && (
            <div className="mx-4 mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 rounded-r-xl flex items-center gap-3 flex-shrink-0">
              <span className="text-xl flex-shrink-0">🔒</span>
              <p className="font-semibold text-emerald-800 dark:text-emerald-300 text-sm">Đơn đã hoàn tất & thanh toán — chỉ đọc</p>
            </div>
          )}

          {/* ── BODY: 2 CỘT ── */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-5 min-h-0 divide-x divide-slate-200 dark:divide-slate-700">

            {/* ════════ CỘT TRÁI (40%) ════════ */}
            <div className="lg:col-span-2 overflow-y-auto p-4 space-y-3 bg-white dark:bg-slate-900">

              {/* ── Khách hàng ── */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khách hàng</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={formData.customerName || customerSearch}
                      onChange={(e) => {
                        if (formData.customerName) return;
                        setCustomerSearch(e.target.value);
                        setShowCustomerDropdown(!!e.target.value.trim());
                      }}
                      onFocus={() => { if (!formData.customerName) setShowCustomerDropdown(!!customerSearch.trim()); }}
                      onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                      disabled={isCompleted}
                      readOnly={!!formData.customerName || isCompleted}
                      className={`w-full px-3 py-2.5 rounded-xl text-sm border transition-all focus:outline-none disabled:opacity-50 ${
                        formData.customerName
                          ? "border-blue-200 dark:border-blue-800 bg-blue-50/30 dark:bg-blue-900/10 font-semibold pr-9 text-slate-900 dark:text-slate-100"
                          : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5"
                      }`}
                      placeholder="Tìm tên hoặc SĐT..."
                      autoComplete="off"
                    />
                    {formData.customerName && (
                      <button type="button"
                        onClick={() => { setFormData(p => ({ ...p, customerName: "", customerPhone: "" })); setCustomerSearch(""); }}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    )}
                    {showCustomerDropdown && !formData.customerName && filteredCustomers.length > 0 && (
                      <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {filteredCustomers.map((c: any) => (
                          <button key={c.id} type="button" onClick={() => handleSelectCustomer(c)}
                            className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 border-b dark:border-slate-700 last:border-0 transition-colors">
                            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100">{c.name}</div>
                            <div className="text-[10px] font-medium text-slate-500 mt-0.5">{c.phone}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <button type="button" onClick={() => setShowAddCustomerModal(true)} disabled={isCompleted}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 hover:text-blue-500 active:scale-95 text-slate-400 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
                    title="Thêm khách mới">
                    <PlusIcon className="w-5 h-5" />
                  </button>
                </div>
                {formData.customerName && formData.customerPhone && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 font-mono text-xs">
                    <span className="text-slate-400">CONTACT:</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">{formData.customerPhone}</span>
                  </div>
                )}
                <input type="hidden" name="customerName" value={formData.customerName || ""} required />
                <input type="hidden" name="customerPhone" value={formData.customerPhone || ""} required />
              </div>

              {/* ── Thiết bị & KTV ── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thiết bị & Kỹ thuật</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1">Tên thiết bị</label>
                    <input type="text" name="deviceName" value={formData.deviceName || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 disabled:opacity-50"
                      placeholder="iPhone, Laptop..." />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1">Kỹ thuật viên</label>
                    <input type="text" name="technicianName" value={formData.technicianName || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 disabled:opacity-50"
                      placeholder="P. Kỹ thuật" />
                  </div>
                </div>
              </div>

              {/* ── Mô tả sự cố ── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mô tả sự cố</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <textarea name="issueDescription" value={formData.issueDescription || ""} onChange={handleInputChange} disabled={isCompleted}
                  rows={2} required
                  className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 disabled:opacity-50"
                  placeholder="Mô tả tình trạng hư hỏng..." />
              </div>

              {/* ── Trạng thái ── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Trạng thái phiếu</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {([
                    { value: "Tiếp nhận", icon: "🆕", color: "blue" },
                    { value: "Chờ vật liệu", icon: "📦", color: "orange" },
                    { value: "Đang sửa", icon: "🔧", color: "blue" },
                    { value: "Đã sửa xong", icon: "✅", color: "emerald" },
                    { value: "Trả máy", icon: "📤", color: "slate" },
                    { value: "Đã hủy", icon: "❌", color: "red" },
                  ] as const).map(({ value, icon, color }) => {
                    const active = formData.status === value;
                    const colorStyles: Record<string, string> = {
                      blue: active ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-blue-300 hover:text-blue-500",
                      orange: active ? "bg-orange-500 text-white border-orange-500" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-orange-300 hover:text-orange-500",
                      emerald: active ? "bg-emerald-600 text-white border-emerald-600" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-300 hover:text-emerald-500",
                      slate: active ? "bg-slate-600 text-white border-slate-600" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-slate-400 hover:text-slate-600",
                      red: active ? "bg-red-500 text-white border-red-500" : "border-slate-200 dark:border-slate-700 text-slate-400 hover:border-red-300 hover:text-red-500",
                    };
                    return (
                      <button key={value} type="button" disabled={isCompleted}
                        onClick={() => setFormData(p => ({ ...p, status: value as any }))}
                        className={`py-2 rounded-xl text-[10px] font-bold transition-all border disabled:opacity-30 flex flex-col items-center justify-center gap-0.5 ${colorStyles[color]}`}>
                        <span className="text-xs">{icon}</span>
                        <span>{value.toUpperCase()}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── Hẹn trả & Ghi chú ── */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-2 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Thông tin thêm</span>
                  <div className="h-px flex-1 bg-slate-100 dark:bg-slate-800" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1">Ngày hẹn trả</label>
                    <input type="datetime-local" name="dueDate" value={formData.dueDate?.slice(0, 16) || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-50" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 ml-1">Ghi chú</label>
                    <input type="text" name="notes" placeholder="Ghi chú nội bộ..." value={formData.notes || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 disabled:opacity-50" />
                  </div>
                </div>
              </div>

            </div>{/* end cột trái */}

            {/* ════════ CỘT PHẢI (60%) ════════ */}
            <div className="lg:col-span-3 flex flex-col min-h-0 bg-slate-50 dark:bg-slate-900">

              {/* ── Thanh thêm (sticky top) ── */}
              <div className="flex-shrink-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-3 space-y-2.5">

                {/* Vật liệu row */}
                <div className={`flex gap-2 items-center transition-opacity ${activeItemTab !== "materials" ? "opacity-40" : ""}`}>
                  <button type="button" onClick={() => setActiveItemTab("materials")}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                      activeItemTab === "materials"
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200 dark:shadow-indigo-900"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-indigo-300"
                    }`}>
                    <span>📦</span>
                    <span>VL {(formData.materialsUsed || []).length > 0 && `(${(formData.materialsUsed || []).length})`}</span>
                  </button>
                  <div className="flex-1 relative">
                    <input type="text" placeholder="Tìm vật liệu..."
                      value={materialSearch}
                      onChange={(e) => { setMaterialSearch(e.target.value); setShowMaterialDropdown(true); setMaterialInput(p => ({ ...p, materialName: e.target.value })); }}
                      onFocus={() => { setActiveItemTab("materials"); setShowMaterialDropdown(true); }}
                      onBlur={() => setTimeout(() => setShowMaterialDropdown(false), 200)}
                      disabled={isCompleted}
                      className="w-full px-3 py-2 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900 disabled:opacity-50" />
                    {showMaterialDropdown && filteredMaterials.length > 0 && (
                      <div className="absolute z-30 w-full left-0 mt-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-700 rounded-xl shadow-2xl max-h-52 overflow-y-auto">
                        {filteredMaterials.map((m: any) => (
                          <button key={m.id} type="button"
                            onClick={() => { setMaterialInput({ materialName: m.name, quantity: 1, price: m.retailPrice || m.purchasePrice || 0 }); setMaterialSearch(m.name); setShowMaterialDropdown(false); }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b dark:border-slate-700 last:border-0 transition-colors">
                            <div className="flex justify-between items-center">
                              <span className="font-medium text-sm text-slate-900 dark:text-slate-100">{m.name}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${(m.stock || 0) <= 0 ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400"}`}>
                                {(m.stock || 0) <= 0 ? "Hết hàng" : `Tồn: ${m.stock}`}
                              </span>
                            </div>
                            <div className="text-xs text-indigo-600 dark:text-indigo-400 mt-0.5">{formatCurrency(m.retailPrice || 0)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <input type="number" placeholder="SL" min="1" value={materialInput.quantity}
                    onChange={(e) => setMaterialInput(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    disabled={isCompleted}
                    className="w-14 px-2 py-2 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl text-sm text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
                  <input type="text" placeholder="Đơn giá"
                    value={materialInput.price ? formatCurrencyInput(materialInput.price) : ""}
                    onChange={(e) => setMaterialInput(p => ({ ...p, price: parseCurrencyInput(e.target.value) }))}
                    disabled={isCompleted}
                    className="w-28 px-2 py-2 border-2 border-indigo-200 dark:border-indigo-700 rounded-xl text-sm text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
                  <button type="button" onClick={handleAddMaterial} disabled={isCompleted}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl shadow-md shadow-indigo-200 dark:shadow-indigo-900 transition-all disabled:opacity-40">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>

                {/* Gia công row */}
                <div className={`flex gap-2 items-center transition-opacity ${activeItemTab !== "outsourcing" ? "opacity-40" : ""}`}>
                  <button type="button" onClick={() => setActiveItemTab("outsourcing")}
                    className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all border-2 ${
                      activeItemTab === "outsourcing"
                        ? "bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-200 dark:shadow-orange-900"
                        : "border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-orange-300"
                    }`}>
                    <span>🔩</span>
                    <span>GC {(formData.outsourcingItems || []).length > 0 && `(${(formData.outsourcingItems || []).length})`}</span>
                  </button>
                  <input type="text" placeholder="Mô tả công việc gia công..." value={outsourcingInput.description}
                    onChange={(e) => setOutsourcingInput(p => ({ ...p, description: e.target.value }))}
                    onFocus={() => setActiveItemTab("outsourcing")}
                    disabled={isCompleted}
                    className="flex-1 px-3 py-2 border-2 border-orange-200 dark:border-orange-700 rounded-xl text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 dark:focus:ring-orange-900 disabled:opacity-50" />
                  <input type="number" placeholder="SL" min="1" value={outsourcingInput.quantity}
                    onChange={(e) => setOutsourcingInput(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                    disabled={isCompleted}
                    className="w-14 px-2 py-2 border-2 border-orange-200 dark:border-orange-700 rounded-xl text-sm text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-500 disabled:opacity-50" />
                  <input type="text" placeholder="Giá vốn"
                    value={outsourcingInput.costPrice ? formatSignedCurrencyInput(outsourcingInput.costPrice) : ""}
                    onChange={(e) => setOutsourcingInput(p => ({ ...p, costPrice: parseSignedCurrencyInput(e.target.value) }))}
                    disabled={isCompleted}
                    className="w-24 px-2 py-2 border-2 border-orange-200 dark:border-orange-700 rounded-xl text-sm text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-50" />
                  <input type="text" placeholder="Đơn giá"
                    value={outsourcingInput.sellingPrice ? formatSignedCurrencyInput(outsourcingInput.sellingPrice) : ""}
                    onChange={(e) => setOutsourcingInput(p => ({ ...p, sellingPrice: parseSignedCurrencyInput(e.target.value) }))}
                    disabled={isCompleted}
                    className="w-24 px-2 py-2 border-2 border-orange-200 dark:border-orange-700 rounded-xl text-sm text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none disabled:opacity-50" />
                  <button type="button" onClick={handleAddOutsourcing} disabled={isCompleted}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-xl shadow-md shadow-orange-200 dark:shadow-orange-900 transition-all disabled:opacity-40">
                    <PlusIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>{/* end thanh thêm */}

              {/* ── Danh sách (cuộn) ── */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">

                {/* Thiếu hàng cảnh báo */}
                {materialShortageInfo.hasShortage && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-r-xl">
                    <p className="font-bold text-red-700 dark:text-red-400 text-xs mb-1.5">⚠️ Thiếu vật liệu — cần đặt hàng NCC</p>
                    {materialShortageInfo.shortages.map((s, i) => (
                      <p key={i} className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                        {s.isNew
                          ? <><span className="font-bold bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400 px-1 rounded">MỚI</span> &ldquo;{s.materialName}&rdquo; — cần mua <strong>{s.shortage}</strong></>
                          : <><strong>{s.materialName}</strong>: cần {s.needed}, tồn {s.inStock}, <strong className="text-red-700 dark:text-red-300">thiếu {s.shortage}</strong></>
                        }
                      </p>
                    ))}
                  </div>
                )}

                {/* Items vật liệu */}
                {(formData.materialsUsed || []).map((m, i) => {
                  const mat = (pinMaterials || []).find((x: any) => x.name.toLowerCase() === m.materialName.toLowerCase());
                  const isNew = !mat;
                  const isShort = !isNew && m.quantity > (mat?.stock || 0);
                  return (
                    <div key={i} className={`flex items-center gap-3 px-3.5 py-3 rounded-2xl border text-sm transition-all group ${
                      isNew   ? "border-purple-200 dark:border-purple-700/60 bg-purple-50 dark:bg-purple-900/10" :
                      isShort ? "border-red-200 dark:border-red-700/60 bg-red-50 dark:bg-red-900/10" :
                                "border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800"
                    }`}>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 flex-shrink-0 tracking-wide">VL</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{m.materialName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{m.quantity} × {formatCurrency(m.price)}</span>
                          <span className="text-slate-300 dark:text-slate-600">=</span>
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">{formatCurrency(m.quantity * m.price)}</span>
                          {isNew   && <span className="ml-1 px-1 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded text-[9px] font-bold">🆕 CẦN MUA</span>}
                          {isShort && <span className="ml-1 px-1 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded text-[9px] font-bold">⚠️ THIẾU {m.quantity - (mat?.stock || 0)}</span>}
                          {!isNew && !isShort && <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">✓ ĐỦ</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => handleRemoveMaterial(i)} disabled={isCompleted}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1.5 rounded-lg transition-all disabled:opacity-20 flex-shrink-0">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {/* Items gia công */}
                {(formData.outsourcingItems || []).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 px-3.5 py-3 rounded-2xl border border-orange-200 dark:border-orange-700/60 bg-orange-50 dark:bg-orange-900/10 text-sm group">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md font-black bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300 flex-shrink-0 tracking-wide">GC</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">{item.description}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{item.quantity} × {formatCurrency(item.sellingPrice)}</span>
                        <span className="text-slate-300 dark:text-slate-600">=</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{formatCurrency(item.total)}</span>
                        {((item.sellingPrice - item.costPrice) * item.quantity) >= 0 ? (
                          <span className="ml-1 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            +{formatCurrency((item.sellingPrice - item.costPrice) * item.quantity)} lời
                          </span>
                        ) : (
                          <span className="ml-1 text-rose-600 dark:text-rose-400 text-[10px] font-semibold">
                            {formatCurrency((item.sellingPrice - item.costPrice) * item.quantity)} lỗ
                          </span>
                        )}
                      </div>
                    </div>
                    <button type="button" onClick={() => handleRemoveOutsourcing(idx)} disabled={isCompleted}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 p-1.5 rounded-lg transition-all disabled:opacity-20 flex-shrink-0">
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Empty state */}
                {(formData.materialsUsed || []).length === 0 && (formData.outsourcingItems || []).length === 0 && (
                  <div className="text-center py-12 text-slate-400 dark:text-slate-600">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">🔧</div>
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Chưa có mặt hàng nào</p>
                    <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">Dùng thanh tìm kiếm phía trên để thêm</p>
                  </div>
                )}
              </div>{/* end list */}

              {/* ── Chi phí & Thanh toán (sticky bottom) ── */}
              <div className="flex-shrink-0 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">

                {/* Cost breakdown row */}
                <div className="grid grid-cols-4 divide-x divide-slate-100 dark:divide-slate-700 border-b border-slate-100 dark:border-slate-700">
                  <div className="px-3 py-2.5 text-center">
                    <div className="text-[10px] text-indigo-500 dark:text-indigo-400 font-bold uppercase tracking-wider mb-0.5">📦 Vật liệu</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(materialsTotal)}</div>
                  </div>
                  <div className="px-3 py-2.5 text-center">
                    <div className="text-[10px] text-orange-500 dark:text-orange-400 font-bold uppercase tracking-wider mb-0.5">🔩 Gia công</div>
                    <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency((formData.outsourcingItems || []).reduce((s, i) => s + i.total, 0))}
                    </div>
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider mb-0.5">🛠 Phí công</div>
                    <input type="text" name="laborCost" placeholder="0 ₫"
                      value={formData.laborCost ? formatCurrencyInput(formData.laborCost) : ""}
                      onChange={handleInputChange} disabled={isCompleted}
                      className="w-full text-sm font-bold text-slate-800 dark:text-slate-200 bg-transparent focus:outline-none focus:bg-blue-50 dark:focus:bg-blue-900/20 rounded px-1 -mx-1 text-right disabled:opacity-50 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  </div>
                  <div className="px-3 py-2.5">
                    <div className="text-[10px] text-yellow-600 dark:text-yellow-400 font-bold uppercase tracking-wider mb-0.5">💰 Đã cọc</div>
                    <input type="text" name="depositAmount" placeholder="0 ₫"
                      value={formData.depositAmount ? formatCurrencyInput(formData.depositAmount) : ""}
                      onChange={handleInputChange} disabled={isCompleted}
                      className="w-full text-sm font-bold text-yellow-600 dark:text-yellow-400 bg-transparent focus:outline-none focus:bg-yellow-50 dark:focus:bg-yellow-900/20 rounded px-1 -mx-1 text-right disabled:opacity-50 placeholder:text-slate-300 dark:placeholder:text-slate-600" />
                  </div>
                </div>

                {/* Tổng bar */}
                <div className="grid grid-cols-2 divide-x divide-white/10">
                  <div className="bg-slate-900 dark:bg-black px-4 py-3">
                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">TỔNG CỘNG</div>
                    <div className="text-xl font-black text-white leading-tight">{formatCurrency(total)}</div>
                  </div>
                  <div className="bg-blue-600 px-4 py-3 text-right">
                    <div className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mb-1">KHÁCH CẦN TRẢ</div>
                    <div className="text-xl font-black text-white leading-tight">{formatCurrency(remaining)}</div>
                  </div>
                </div>

                {/* Thanh toán row */}
                <div className="flex gap-2 px-3 py-3 items-center bg-white dark:bg-slate-800">
                  <select name="paymentStatus" value={formData.paymentStatus || "unpaid"} onChange={handleInputChange} disabled={isCompleted}
                    className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none text-center">
                    <option value="unpaid">Chưa thanh toán</option>
                    <option value="partial">Thanh toán 1 phần</option>
                    <option value="paid">Đã thanh toán</option>
                  </select>
                  {formData.paymentStatus === "partial" ? (
                    <input type="text" placeholder="Số tiền..."
                      value={formData.partialPaymentAmount ? formatCurrencyInput(formData.partialPaymentAmount) : ""}
                      onChange={(e) => setFormData(p => ({ ...p, partialPaymentAmount: parseCurrencyInput(e.target.value) }))}
                      disabled={isCompleted}
                      className="flex-1 px-3 py-2.5 border border-teal-200 dark:border-teal-900/50 rounded-xl text-xs text-right font-bold bg-teal-50/30 dark:bg-teal-900/10 text-teal-600 dark:text-teal-400 focus:outline-none focus:border-teal-500 disabled:opacity-50" />
                  ) : (
                    <select name="paymentMethod" value={formData.paymentMethod || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="flex-1 px-3 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] font-bold uppercase tracking-wider bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500 disabled:opacity-50 appearance-none text-center">
                      <option value="">Hình thức</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="bank">Chuyển khoản</option>
                      <option value="card">Thẻ/Ví</option>
                    </select>
                  )}
                  <div className="flex items-center gap-2 group">
                    <label className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer select-none transition-all hover:border-amber-400">
                      <input type="checkbox" checked={formData.quoteApproved || false}
                        onChange={(e) => setFormData(p => ({ ...p, quoteApproved: e.target.checked, quoteApprovedAt: e.target.checked ? new Date().toISOString() : undefined }))}
                        className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Duyệt giá</span>
                    </label>
                  </div>
                  <button type="button" onClick={() => setShowQuotePrint(true)}
                    className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-slate-400 text-slate-400 dark:text-slate-500 rounded-xl transition-all active:scale-95 flex-shrink-0"
                    title="In báo giá">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                  </button>
                </div>

              </div>{/* end cost panel */}
            </div>{/* end cột phải */}

          </div>{/* end grid */}

          {/* ── FOOTER ── */}
          <div className="flex-shrink-0 px-4 py-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex gap-3 shadow-inner">
            <button type="button" onClick={onClose} disabled={isSubmitting}
              className="px-6 py-2.5 border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-xl font-bold uppercase tracking-wider hover:bg-white dark:hover:bg-slate-800 transition-all disabled:opacity-50 text-[11px] active:scale-95">
              Hủy bỏ
            </button>
            <button type="submit" disabled={isSubmitting || isCompleted}
              className="flex-1 py-2.5 bg-slate-900 dark:bg-blue-600 hover:bg-black dark:hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest shadow-lg shadow-slate-200 dark:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[11px] active:scale-[0.98]">
              {isCompleted ? (
                <><span>🔒</span><span>ĐÃ HOÀN TẤT</span></>
              ) : isSubmitting ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>MÁY ĐANG XỬ LÝ...</span>
                </>
              ) : (
                <>{getButtonText().toUpperCase()}</>
              )}
            </button>
          </div>

        </form>
      </div>


      {/* Modal thêm khách hàng mới */}
      {
        showAddCustomerModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 flex justify-between items-center rounded-t-2xl">
                <h3 className="text-xl font-bold text-white">Thêm khách hàng mới</h3>
                <button
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setNewCustomerData({
                      name: "",
                      phone: "",
                      email: "",
                      address: "",
                    });
                  }}
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  type="button"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Họ và tên <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={newCustomerData.name}
                    onChange={(e) =>
                      setNewCustomerData((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="Nguyễn Văn A"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Số điện thoại <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={newCustomerData.phone}
                    onChange={(e) =>
                      setNewCustomerData((prev) => ({
                        ...prev,
                        phone: e.target.value,
                      }))
                    }
                    className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    placeholder="0901234567"
                  />
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-3 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setNewCustomerData({
                      name: "",
                      phone: "",
                      email: "",
                      address: "",
                    });
                  }}
                  className="flex-1 px-4 py-2.5 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddNewCustomer}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <PlusIcon className="w-5 h-5" />
                  Thêm khách hàng
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Modal In báo giá */}
      {
        showQuotePrint && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-bold text-slate-800">🖨️ Xem trước Báo giá</h3>
                <button
                  onClick={() => setShowQuotePrint(false)}
                  className="p-2 hover:bg-slate-100 rounded-lg"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Nội dung báo giá để in */}
              <div id="quote-print-content" className="p-6 bg-white text-black">
                {/* Header công ty */}
                <div className="text-center mb-6 border-b-2 border-slate-300 pb-4">
                  <h1 className="text-2xl font-bold text-slate-800">PIN CORP</h1>
                  <p className="text-sm text-slate-600">Chuyên sửa chữa Pin - Laptop - Điện thoại</p>
                  <p className="text-xs text-slate-500 mt-1">Hotline: 0123.456.789</p>
                </div>

                {/* Tiêu đề báo giá */}
                <div className="text-center mb-6">
                  <h2 className="text-xl font-bold text-amber-600">BÁO GIÁ SỬA CHỮA</h2>
                  <p className="text-sm text-slate-500">
                    Ngày: {new Date().toLocaleDateString("vi-VN")}
                  </p>
                  <p className="text-sm text-slate-500">Mã phiếu: {initialOrder?.id || "Mới"}</p>
                </div>

                {/* Thông tin khách hàng */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-2">👤 KHÁCH HÀNG</h3>
                  <p className="text-sm">
                    <strong>Họ tên:</strong> {formData.customerName}
                  </p>
                  <p className="text-sm">
                    <strong>SĐT:</strong> {formData.customerPhone}
                  </p>
                </div>

                {/* Thông tin thiết bị */}
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <h3 className="font-semibold text-slate-700 mb-2">📱 THIẾT BỊ</h3>
                  <p className="text-sm">
                    <strong>Tên thiết bị:</strong> {formData.deviceName || "N/A"}
                  </p>
                  <p className="text-sm">
                    <strong>Tình trạng:</strong> {formData.issueDescription}
                  </p>
                </div>

                {/* Bảng chi tiết báo giá */}
                <div className="mb-6">
                  <h3 className="font-semibold text-slate-700 mb-2">📋 CHI TIẾT BÁO GIÁ</h3>
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="border border-slate-300 px-3 py-2 text-left">Hạng mục</th>
                        <th className="border border-slate-300 px-3 py-2 text-center">SL</th>
                        <th className="border border-slate-300 px-3 py-2 text-right">Đơn giá</th>
                        <th className="border border-slate-300 px-3 py-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(formData.materialsUsed || []).map((m, i) => (
                        <tr key={i}>
                          <td className="border border-slate-300 px-3 py-2">{m.materialName}</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">
                            {m.quantity}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatCurrency(m.price)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatCurrency(m.quantity * m.price)}
                          </td>
                        </tr>
                      ))}
                      {(formData.laborCost || 0) > 0 && (
                        <tr>
                          <td className="border border-slate-300 px-3 py-2">Công sửa chữa</td>
                          <td className="border border-slate-300 px-3 py-2 text-center">1</td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatCurrency(formData.laborCost || 0)}
                          </td>
                          <td className="border border-slate-300 px-3 py-2 text-right">
                            {formatCurrency(formData.laborCost || 0)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="bg-amber-50 font-bold">
                        <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">
                          TỔNG CỘNG:
                        </td>
                        <td className="border border-slate-300 px-3 py-2 text-right text-amber-600">
                          {formatCurrency(total)}
                        </td>
                      </tr>
                      {(formData.depositAmount || 0) > 0 && (
                        <>
                          <tr>
                            <td
                              colSpan={3}
                              className="border border-slate-300 px-3 py-2 text-right text-green-600"
                            >
                              Đặt cọc:
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-right text-green-600">
                              -{formatCurrency(formData.depositAmount || 0)}
                            </td>
                          </tr>
                          <tr className="font-bold">
                            <td colSpan={3} className="border border-slate-300 px-3 py-2 text-right">
                              Còn lại:
                            </td>
                            <td className="border border-slate-300 px-3 py-2 text-right text-rose-600">
                              {formatCurrency(remaining)}
                            </td>
                          </tr>
                        </>
                      )}
                    </tfoot>
                  </table>
                </div>

                {/* Cảnh báo thiếu hàng */}
                {materialShortageInfo.hasShortage && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h3 className="font-semibold text-red-700 mb-2">⚠️ LƯU Ý - VẬT LIỆU THIẾU</h3>
                    <ul className="text-sm text-red-600">
                      {materialShortageInfo.shortages.map((s, i) => (
                        <li key={i}>
                          • {s.materialName}: thiếu {s.shortage} (đang đặt hàng)
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-red-500 mt-2 italic">
                      Thời gian chờ hàng: 2-5 ngày làm việc
                    </p>
                  </div>
                )}

                {/* Ghi chú */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg text-sm">
                  <h3 className="font-semibold text-blue-700 mb-2">📌 GHI CHÚ</h3>
                  <ul className="text-blue-600 space-y-1">
                    <li>• Báo giá có hiệu lực 7 ngày kể từ ngày lập</li>
                    <li>• Yêu cầu đặt cọc 50% để tiến hành sửa chữa</li>
                    <li>• Bảo hành: 3-6 tháng tùy loại linh kiện</li>
                    <li>• Miễn phí kiểm tra nếu không sửa</li>
                  </ul>
                </div>

                {/* Chữ ký */}
                <div className="grid grid-cols-2 gap-8 mt-8 pt-4 border-t text-center text-sm">
                  <div>
                    <p className="font-semibold text-slate-700">Khách hàng</p>
                    <p className="text-slate-500 text-xs mt-1">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700">Nhân viên</p>
                    <p className="text-slate-500 text-xs mt-1">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-medium">{formData.technicianName || currentUser?.name}</p>
                  </div>
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex gap-3 p-4 border-t bg-slate-50">
                <button
                  onClick={() => setShowQuotePrint(false)}
                  className="flex-1 px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold transition-colors"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    const printContent = document.getElementById("quote-print-content");
                    if (printContent) {
                      const printWindow = window.open("", "_blank");
                      if (printWindow) {
                        printWindow.document.write(`
                        <html>
                          <head>
                            <title>Báo giá - ${formData.customerName}</title>
                            <style>
                              body { font-family: Arial, sans-serif; padding: 20px; }
                              table { width: 100%; border-collapse: collapse; }
                              th, td { border: 1px solid #ccc; padding: 8px; }
                              th { background: #f5f5f5; }
                              .text-right { text-align: right; }
                              .text-center { text-align: center; }
                              @media print { body { print-color-adjust: exact; } }
                            </style>
                          </head>
                          <body>${printContent.innerHTML}</body>
                        </html>
                      `);
                        printWindow.document.close();
                        printWindow.print();
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-bold shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                    />
                  </svg>
                  In báo giá
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Confirm Dialog Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {confirmDialog.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirmDialog();
                }}
                className="px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
