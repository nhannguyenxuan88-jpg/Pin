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
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] w-full max-w-6xl overflow-hidden flex flex-col max-h-[92vh] border border-slate-200 dark:border-slate-800">

        {/* ── HEADER: Tối giản, sang trọng ── */}
        <div className="px-8 py-6 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
              <span className="w-2 h-8 bg-blue-600 rounded-full" />
              {getHeaderTitle().toUpperCase()}
            </h2>
            {initialOrder && <p className="text-[10px] font-bold text-slate-400 mt-1 tracking-[0.2em] uppercase opacity-60">Reference: {initialOrder.id}</p>}
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all duration-300 group" type="button">
            <XMarkIcon className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">

            {/* ════════ CỘT TRÁI: Nhập liệu chính (4/12) ════════ */}
            <div className="lg:col-span-4 overflow-y-auto p-8 space-y-8 bg-slate-50/50 dark:bg-slate-900/30 border-r border-slate-100 dark:border-slate-800/50">

              {/* Section: Khách hàng */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] pl-1">01. Thông tin khách hàng</label>
                <div className="relative group">
                  <input
                    type="text"
                    value={formData.customerName || customerSearch}
                    onChange={(e) => {
                      if (formData.customerName) return;
                      setCustomerSearch(e.target.value);
                      setShowCustomerDropdown(!!e.target.value.trim());
                    }}
                    className={`w-full px-5 py-4 rounded-2xl text-sm font-bold border-2 transition-all outline-none ${
                      formData.customerName 
                      ? "bg-blue-50/50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-300"
                      : "bg-white dark:bg-slate-800 border-transparent dark:border-transparent focus:border-blue-500 shadow-sm"
                    }`}
                    placeholder="Tên khách hàng hoặc số điện thoại..."
                  />
                  {!formData.customerName && (
                    <button type="button" onClick={() => setShowAddCustomerModal(true)} 
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-slate-900 dark:bg-blue-600 text-white rounded-xl hover:scale-110 active:scale-95 transition-all">
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  )}
                  {formData.customerName && (
                    <button type="button" onClick={() => { setFormData(p => ({ ...p, customerName: "", customerPhone: "" })); setCustomerSearch(""); }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500">
                      <XMarkIcon className="w-5 h-5" />
                    </button>
                  )}
                </div>
                {formData.customerPhone && (
                  <div className="flex items-center gap-3 px-5 py-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700/50 animate-in fade-in slide-in-from-top-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">📞</div>
                    <span className="text-sm font-black text-slate-700 dark:text-slate-200">{formData.customerPhone}</span>
                  </div>
                )}
              </div>

              {/* Section: Thiết bị */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] pl-1">02. Thiết bị & Kỹ thuật</label>
                <div className="grid grid-cols-1 gap-3">
                  <div className="relative">
                    <input type="text" name="deviceName" value={formData.deviceName || ""} onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold shadow-sm outline-none transition-all dark:text-white"
                      placeholder="VD: iPhone 15 Pro Max..." />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase">Thiết bị</span>
                  </div>
                  <div className="relative">
                    <input type="text" name="technicianName" value={formData.technicianName || ""} onChange={handleInputChange}
                      className="w-full px-5 py-3.5 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold shadow-sm outline-none transition-all dark:text-white"
                      placeholder="Người đảm nhận..." />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase">Kỹ thuật</span>
                  </div>
                </div>
              </div>

              {/* Section: Tình trạng */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] pl-1">03. Triệu chứng hư hỏng</label>
                <textarea name="issueDescription" value={formData.issueDescription || ""} onChange={handleInputChange}
                  rows={3} className="w-full px-5 py-4 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl text-sm font-bold shadow-sm outline-none transition-all resize-none dark:text-white"
                  placeholder="Mô tả chi tiết lỗi của máy..." />
              </div>

              {/* Section: Trạng thái */}
              <div className="space-y-4">
                <label className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.15em] pl-1">04. Tiến độ xử lý</label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: "Tiếp nhận", icon: "💎", color: "blue" },
                    { value: "Đang sửa", icon: "⚡", color: "blue" },
                    { value: "Xong", icon: "✅", color: "emerald" },
                    { value: "Trả máy", icon: "📦", color: "slate" },
                  ] as const).map(({ value, icon, color }) => {
                    const active = formData.status === value;
                    return (
                      <button key={value} type="button"
                        onClick={() => setFormData(p => ({ ...p, status: value as any }))}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all group ${
                          active 
                          ? "bg-slate-900 border-slate-900 text-white dark:bg-blue-600 dark:border-blue-600"
                          : "bg-white dark:bg-slate-800 border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-400"
                        }`}>
                        <span className={`text-sm ${active ? "opacity-100" : "opacity-40"}`}>{icon}</span>
                        <span className="text-[11px] font-black uppercase tracking-wider">{value}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ════════ CỘT PHẢI: Vật tư & Thanh toán (8/12) ════════ */}
            <div className="lg:col-span-8 flex flex-col min-h-0 bg-white dark:bg-[#0f172a]">
              
              {/* Toolbar: Thêm vật tư dạng hiện đại */}
              <div className="p-8 pb-0">
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] p-2 flex gap-2 border border-slate-100 dark:border-slate-800">
                  <div className="flex-1 relative">
                    <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Tìm kiếm linh kiện thay thế..."
                      value={materialSearch}
                      onChange={(e) => { setMaterialSearch(e.target.value); setShowMaterialDropdown(true); }}
                      className="w-full pl-14 pr-4 py-4 bg-transparent text-sm font-bold outline-none dark:text-white" />
                  </div>
                  <div className="w-24 bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center overflow-hidden">
                    <input type="number" min="1" value={materialInput.quantity}
                      onChange={(e) => setMaterialInput(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                      className="w-full text-center text-sm font-black bg-transparent outline-none dark:text-white" />
                  </div>
                  <button type="button" onClick={handleAddMaterial}
                    className="px-8 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20 active:scale-95">
                    Thêm vào đơn
                  </button>
                </div>
              </div>

              {/* List: Items */}
              <div className="flex-1 overflow-y-auto p-8 space-y-3">
                {(formData.materialsUsed || []).length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 grayscale">
                    <div className="w-24 h-24 mb-4 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center text-4xl">🛠️</div>
                    <p className="font-black uppercase tracking-[0.3em] text-[10px]">Chưa có hạng mục sửa chữa</p>
                  </div>
                )}
                
                {(formData.materialsUsed || []).map((m, i) => (
                  <div key={i} className="group flex items-center gap-6 px-6 py-4 bg-white dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 hover:border-blue-500/30 transition-all">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 font-black">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-800 dark:text-slate-200">{m.materialName}</div>
                      <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-widest">
                        {m.quantity} ITEM × {formatCurrency(m.price)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-slate-900 dark:text-white">{formatCurrency(m.quantity * m.price)}</div>
                    </div>
                    <button type="button" onClick={() => handleRemoveMaterial(i)}
                      className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-red-50 hover:text-red-500 text-slate-300 transition-all opacity-0 group-hover:opacity-100">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Footer Panel: Tổng kết & Thanh toán */}
              <div className="p-8 bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phí công sửa</label>
                    <input type="text" value={formData.laborCost ? formatCurrencyInput(formData.laborCost) : ""}
                      onChange={(e) => setFormData(p => ({ ...p, laborCost: parseCurrencyInput(e.target.value) }))}
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-sm shadow-sm outline-none transition-all dark:text-white" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Tiền đặt cọc</label>
                    <input type="text" value={formData.depositAmount ? formatCurrencyInput(formData.depositAmount) : ""}
                      onChange={(e) => setFormData(p => ({ ...p, depositAmount: parseCurrencyInput(e.target.value) }))}
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-emerald-500 rounded-2xl font-black text-sm shadow-sm outline-none transition-all dark:text-white" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Trạng thái tiền</label>
                    <select value={formData.paymentStatus || "unpaid"} onChange={handleInputChange} name="paymentStatus"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-sm outline-none transition-all dark:text-white appearance-none">
                      <option value="unpaid">Chưa thu</option>
                      <option value="partial">Thu một phần</option>
                      <option value="paid">Đã thu đủ</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Phương thức</label>
                    <select value={formData.paymentMethod || ""} onChange={handleInputChange} name="paymentMethod"
                      className="w-full px-5 py-3 bg-white dark:bg-slate-800 border-2 border-transparent focus:border-blue-500 rounded-2xl font-black text-[11px] uppercase tracking-wider shadow-sm outline-none transition-all dark:text-white appearance-none">
                      <option value="">Chọn loại</option>
                      <option value="cash">Tiền mặt</option>
                      <option value="bank">Chuyển khoản</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-6">
                  <div className="flex-1 flex gap-8">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Tống phí dịch vụ</div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(total)}</div>
                    </div>
                    <div className="w-px h-12 bg-slate-200 dark:bg-slate-800" />
                    <div>
                      <div className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Còn lại cần thu</div>
                      <div className="text-3xl font-black text-blue-600">{formatCurrency(remaining)}</div>
                    </div>
                  </div>
                  <button type="submit" disabled={isSubmitting}
                    className="w-full md:w-auto px-12 py-5 bg-slate-900 dark:bg-blue-600 hover:scale-[1.02] active:scale-95 text-white rounded-[1.5rem] font-black text-xs uppercase tracking-[0.2em] transition-all shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3">
                    {isSubmitting ? "Processing..." : getButtonText()}
                  </button>
                </div>
              </div>
            </div>
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
