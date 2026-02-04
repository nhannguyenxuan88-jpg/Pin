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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-7xl my-2 overflow-hidden flex flex-col max-h-[96vh]">
        {/* Header compact */}
        <div className="px-4 py-2.5 bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-base sm:text-lg font-bold text-white">{getHeaderTitle()}</h2>
            <span className="text-xs text-blue-200 bg-white/20 px-2 py-0.5 rounded">
              {initialOrder?.id || "Mới"}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-1.5 transition-colors flex-shrink-0"
            type="button"
            aria-label="Đóng"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* Cảnh báo order đã hoàn tất */}
          {isCompleted && (
            <div className="m-3 sm:m-4 mb-0 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-500 dark:border-green-600 rounded-xl shadow-lg">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-green-800 dark:text-green-300 text-base mb-1">
                    ✅ Đơn hàng đã hoàn tất & thanh toán
                  </h3>
                  <p className="text-sm text-green-700 dark:text-green-400 leading-relaxed">
                    Phiếu sửa chữa này đã <strong>trả máy</strong>, <strong>thanh toán đầy đủ</strong> và <strong>trừ kho vật tư</strong>. 
                    <span className="block mt-1 font-semibold">🔒 Không thể chỉnh sửa để đảm bảo tính toàn vẹn dữ liệu kế toán.</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Layout 2 cột - 40% / 60% */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 p-3 sm:p-4">
            {/* CỘT TRÁI (40%) - Thông tin cơ bản */}
            <div className="lg:col-span-2 space-y-3">
              {/* Card: Thông tin khách hàng */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  <svg
                    className="w-4 h-4 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  Khách hàng <span className="text-red-500">*</span>
                </h3>

                {/* Input tìm kiếm + nút thêm mới */}
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={formData.customerName ? formData.customerName : customerSearch}
                        onChange={(e) => {
                          if (formData.customerName) {
                            return;
                          }
                          setCustomerSearch(e.target.value);
                          setShowCustomerDropdown(!!e.target.value.trim());
                        }}
                        onFocus={() => {
                          if (!formData.customerName) {
                            setShowCustomerDropdown(!!customerSearch.trim());
                          }
                        }}
                        onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                        disabled={isCompleted}
                        className={`w-full px-4 py-2.5 ${formData.customerName ? "pr-10" : ""
                          } border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all ${formData.customerName ? "font-semibold" : ""
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        placeholder="Tìm khách hàng..."
                        autoComplete="off"
                        readOnly={!!formData.customerName || isCompleted}
                      />

                      {/* Nút X để xóa khi đã chọn */}
                      {formData.customerName && (
                        <button
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              customerName: "",
                              customerPhone: "",
                            }));
                            setCustomerSearch("");
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors"
                          title="Xóa khách hàng"
                        >
                          <XMarkIcon className="w-5 h-5 text-slate-500" />
                        </button>
                      )}

                      {/* Dropdown kết quả tìm kiếm */}
                      {showCustomerDropdown &&
                        !formData.customerName &&
                        filteredCustomers.length > 0 && (
                          <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {filteredCustomers.map((c: any) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => handleSelectCustomer(c)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700 border-b dark:border-slate-700 last:border-0 transition-colors"
                              >
                                <div className="font-semibold text-slate-900 dark:text-slate-100">
                                  {c.name}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  📞 {c.phone}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                    </div>

                    {/* Nút + thêm mới */}
                    <button
                      type="button"
                      onClick={() => setShowAddCustomerModal(true)}
                      disabled={isCompleted}
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Thêm khách hàng mới"
                    >
                      <PlusIcon className="w-6 h-6" />
                    </button>
                  </div>

                  {/* Hiển thị số điện thoại bên dưới khi đã chọn */}
                  {formData.customerName && formData.customerPhone && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-3 py-2 rounded-lg">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                      <span className="font-medium">{formData.customerPhone}</span>
                    </div>
                  )}
                </div>

                {/* Hidden inputs for validation */}
                <input
                  type="hidden"
                  name="customerName"
                  value={formData.customerName || ""}
                  required
                />
                <input
                  type="hidden"
                  name="customerPhone"
                  value={formData.customerPhone || ""}
                  required
                />
              </div>

              {/* Card Merged: Thông tin tiếp nhận & Trạng thái */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-blue-200 dark:border-blue-700 shadow-sm">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Thông tin tiếp nhận & Trạng thái
                </h3>

                <div className="space-y-3">
                  {/* Row 1: Thiết bị & KTV */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-7">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Tên thiết bị
                      </label>
                      <input
                        type="text"
                        name="deviceName"
                        value={formData.deviceName || ""}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        placeholder="VD: iPhone 13 Pro Max"
                      />
                    </div>
                    <div className="col-span-5">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Kỹ thuật viên
                      </label>
                      <input
                        name="technicianName"
                        type="text"
                        value={formData.technicianName || ""}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        placeholder="Tên KTV"
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>

                  {/* Row 2: Mô tả sự cố */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Mô tả sự cố <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="issueDescription"
                      value={formData.issueDescription || ""}
                      onChange={handleInputChange}
                      disabled={isCompleted}
                      rows={2}
                      className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      placeholder="Mô tả tìn trạng hư hỏng..."
                      required
                    />
                  </div>

                  {/* Row 3: Trạng thái */}
                  <div className="bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 min-w-[70px]">Trạng thái:</span>
                      <select
                        name="status"
                        value={formData.status || "Tiếp nhận"}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        className={`flex-1 px-3 py-1.5 border-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${formData.status === "Tiếp nhận" ? "border-blue-300 text-blue-700 bg-blue-50" :
                          formData.status === "Sẵn sàng sửa" ? "border-purple-300 text-purple-700 bg-purple-50" :
                            formData.status === "Đã sửa xong" ? "border-green-300 text-green-700 bg-green-50" :
                              formData.status === "Trả máy" ? "border-slate-400 text-slate-700 bg-slate-100" :
                                "border-amber-300 text-amber-700 bg-amber-50"
                          } dark:bg-slate-800`}
                      >
                        <option value="Tiếp nhận">🆕 Tiếp nhận</option>
                        <option value="Chờ báo giá">📋 Chờ báo giá</option>
                        <option value="Chờ vật liệu">📦 Chờ vật liệu</option>
                        <option value="Sẵn sàng sửa">✅ Sẵn sàng sửa</option>
                        <option value="Đang sửa">🔧 Đang sửa</option>
                        <option value="Đã sửa xong">✨ Đã sửa xong</option>
                        <option value="Trả máy">📤 Trả máy</option>
                        <option value="Đã hủy">❌ Đã hủy</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Merged: Hẹn trả & Ghi chú */}
              <div className="bg-white dark:bg-slate-800 rounded-lg p-3 sm:p-4 border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Hẹn trả & Ghi chú
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Thời gian hẹn trả
                      </label>
                      <input
                        type="datetime-local"
                        name="dueDate"
                        value={formData.dueDate?.slice(0, 16) || ""}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Ghi chú nội bộ
                      </label>
                      <input
                        type="text"
                        name="notes"
                        placeholder="Ghi chú..."
                        value={formData.notes || ""}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-1 focus:ring-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (60%) - Vật liệu, Gia công & Thanh toán */}
            <div className="lg:col-span-3 space-y-4">
              {/* Tabs: Vật liệu / Gia công */}
              <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="flex border-b border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setActiveItemTab("materials")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeItemTab === "materials"
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-b-2 border-indigo-600"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    Vật liệu
                    {(formData.materialsUsed || []).length > 0 && (
                      <span className="bg-indigo-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {(formData.materialsUsed || []).length}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveItemTab("outsourcing")}
                    className={`flex-1 px-4 py-3 text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${activeItemTab === "outsourcing"
                      ? "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-b-2 border-orange-600"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                      }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                    </svg>
                    Gia công ngoài
                    {(formData.outsourcingItems || []).length > 0 && (
                      <span className="bg-orange-600 text-white text-xs px-2 py-0.5 rounded-full">
                        {(formData.outsourcingItems || []).length}
                      </span>
                    )}
                  </button>
                </div>

                {/* Tab Content: Vật liệu */}
                {activeItemTab === "materials" && (
                  <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-semibold mb-2 flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                      Vật liệu sử dụng
                    </h3>

                    {/* Input thêm vật liệu - Compact Design */}
                    <div className="grid grid-cols-12 gap-2 mb-3 items-start relative">
                      {/* 1. Material Search Input */}
                      <div className="col-span-6 relative">
                        <input
                          type="text"
                          placeholder="🔍 Tìm vật liệu..."
                          value={materialSearch}
                          onChange={(e) => {
                            setMaterialSearch(e.target.value);
                            setShowMaterialDropdown(true);
                            setMaterialInput((prev) => ({
                              ...prev,
                              materialName: e.target.value,
                            }));
                          }}
                          onFocus={() => setShowMaterialDropdown(true)}
                          onBlur={() => setTimeout(() => setShowMaterialDropdown(false), 200)}
                          disabled={isCompleted}
                          className="w-full px-3 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        />

                        {/* Dropdown Results */}
                        {showMaterialDropdown && filteredMaterials.length > 0 && (
                          <div className="absolute z-30 w-[150%] left-0 mt-1 bg-white dark:bg-slate-800 border border-indigo-200 dark:border-indigo-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                            {filteredMaterials.map((material: any) => {
                              const stock = material.stock || 0;
                              const isOutOfStock = stock <= 0;
                              return (
                                <button
                                  key={material.id}
                                  type="button"
                                  onClick={() => {
                                    setMaterialInput({
                                      materialName: material.name,
                                      quantity: 1,
                                      price: material.retailPrice || material.purchasePrice || 0,
                                    });
                                    setMaterialSearch(material.name);
                                    setShowMaterialDropdown(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 border-b dark:border-slate-700 last:border-0 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors ${isOutOfStock ? "opacity-75" : ""
                                    }`}
                                >
                                  <div className="flex justify-between items-center text-sm">
                                    <span className="font-medium text-slate-900 dark:text-slate-100">{material.name}</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isOutOfStock
                                      ? "bg-red-100 text-red-700"
                                      : "bg-green-100 text-green-700"
                                      }`}>
                                      {isOutOfStock ? "Hết" : `Tồn:${stock}`}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-xs text-slate-500 mt-0.5">
                                    <span>{material.sku}</span>
                                    <span className="text-indigo-600 font-medium">
                                      {formatCurrency(material.retailPrice || 0)}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* 2. Quantity Input */}
                      <input
                        type="number"
                        placeholder="SL"
                        value={materialInput.quantity}
                        min="1"
                        onChange={(e) =>
                          setMaterialInput((prev) => ({
                            ...prev,
                            quantity: parseInt(e.target.value) || 1,
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-2 px-2 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
                      />

                      {/* 3. Price Input */}
                      <input
                        type="text"
                        placeholder="Giá"
                        value={materialInput.price ? formatCurrencyInput(materialInput.price) : ""}
                        onChange={(e) =>
                          setMaterialInput((prev) => ({
                            ...prev,
                            price: parseCurrencyInput(e.target.value),
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-3 px-2 py-2 border border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all text-sm text-right disabled:opacity-50 disabled:cursor-not-allowed"
                      />

                      {/* 4. Add Button */}
                      <button
                        type="button"
                        onClick={handleAddMaterial}
                        disabled={isCompleted}
                        className="col-span-1 h-[38px] flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Thêm vật liệu"
                      >
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Cảnh báo thiếu hàng */}
                    {materialShortageInfo.hasShortage && (
                      <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border-2 border-red-300 dark:border-red-700 rounded-lg">
                        <div className="flex items-start gap-2">
                          <svg
                            className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          <div className="flex-1">
                            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">
                              ⚠️ Thiếu vật liệu - Cần đặt hàng NCC
                            </p>
                            <ul className="text-xs text-red-700 dark:text-red-400 mt-1 space-y-0.5">
                              {materialShortageInfo.shortages.map((s, idx) => (
                                <li key={idx} className="flex items-center gap-1">
                                  {s.isNew ? (
                                    <>
                                      <span className="inline-block px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded text-[10px] font-bold">
                                        MỚI
                                      </span>
                                      <span>
                                        "{s.materialName}" - <strong>chưa có trong kho</strong>, cần mua{" "}
                                        {s.shortage}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="inline-block px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded text-[10px] font-bold">
                                        THIẾU
                                      </span>
                                      <span>
                                        {s.materialName}: cần {s.needed}, kho còn {s.inStock},{" "}
                                        <strong>thiếu {s.shortage}</strong>
                                      </span>
                                    </>
                                  )}
                                </li>
                              ))}
                            </ul>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-2 italic">
                              💡 Gợi ý: Chuyển trạng thái sang "Chờ báo giá" hoặc "Chờ vật liệu"
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Danh sách vật liệu đã thêm */}
                    {(formData.materialsUsed || []).length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(formData.materialsUsed || []).map((m, i) => {
                          // Kiểm tra tồn kho cho từng vật liệu
                          const material = (pinMaterials || []).find(
                            (mat: any) => mat.name.toLowerCase() === m.materialName.toLowerCase()
                          );
                          const isNewMaterial = !material; // Vật liệu chưa có trong kho
                          const inStock = material?.stock || 0;
                          const isShortage = m.quantity > inStock;

                          return (
                            <div
                              key={i}
                              className={`flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border-2 transition-all ${isNewMaterial
                                ? "border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/20"
                                : isShortage
                                  ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20"
                                  : "border-indigo-200 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-500"
                                }`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                    {m.materialName}
                                  </span>
                                  {isNewMaterial ? (
                                    <span className="text-xs px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-400 rounded font-bold">
                                      🆕 MỚI - Chưa có trong kho
                                    </span>
                                  ) : isShortage ? (
                                    <span className="text-xs px-1.5 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded">
                                      ⚠️ Thiếu {m.quantity - inStock}
                                    </span>
                                  ) : (
                                    <span className="text-xs px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                                      ✓ Đủ hàng
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                  <span>
                                    {m.quantity} × {formatCurrency(m.price)} ={" "}
                                  </span>
                                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                                    {formatCurrency(m.quantity * m.price)}
                                  </span>
                                  {!isNewMaterial && (
                                    <>
                                      <span className="text-slate-400">|</span>
                                      <span
                                        className={
                                          isShortage
                                            ? "text-red-600 dark:text-red-400"
                                            : "text-slate-500"
                                        }
                                      >
                                        Kho: {inStock}
                                      </span>
                                    </>
                                  )}
                                  {isNewMaterial && (
                                    <span className="text-purple-600 dark:text-purple-400 italic">
                                      (cần mua {m.quantity})
                                    </span>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveMaterial(i)}
                                disabled={isCompleted}
                                className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Xóa"
                              >
                                <TrashIcon className="w-5 h-5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                        <svg
                          className="w-12 h-12 mx-auto mb-2 opacity-50"
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
                        <p className="text-sm">Chưa có vật liệu nào</p>
                      </div>
                    )}

                    {/* Subtotal vật liệu */}
                    {(formData.materialsUsed || []).length > 0 && (
                      <div className="mt-3 pt-3 border-t-2 border-indigo-200 dark:border-indigo-800">
                        <div className="flex justify-between items-center text-sm">
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            Tổng vật liệu:
                          </span>
                          <span className="font-bold text-lg text-indigo-600 dark:text-indigo-400">
                            {formatCurrency(materialsTotal)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Content: Gia công ngoài */}
                {activeItemTab === "outsourcing" && (
                  <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      Báo giá (Gia công, Đặt hàng)
                    </h3>

                    {/* Input form cho gia công ngoài */}
                    <div className="grid grid-cols-12 gap-2 mb-3">
                      <input
                        type="text"
                        placeholder="Mô tả..."
                        value={outsourcingInput.description}
                        onChange={(e) =>
                          setOutsourcingInput((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-4 px-3 py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <input
                        type="number"
                        placeholder="SL"
                        min="1"
                        value={outsourcingInput.quantity}
                        onChange={(e) =>
                          setOutsourcingInput((prev) => ({
                            ...prev,
                            quantity: parseInt(e.target.value) || 1,
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-1 px-2 py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 transition-all text-sm text-center disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        placeholder="Giá nhập"
                        value={outsourcingInput.costPrice ? formatCurrencyInput(outsourcingInput.costPrice) : ""}
                        onChange={(e) =>
                          setOutsourcingInput((prev) => ({
                            ...prev,
                            costPrice: parseCurrencyInput(e.target.value),
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-2 px-2 py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <input
                        type="text"
                        placeholder="Đơn giá"
                        value={outsourcingInput.sellingPrice ? formatCurrencyInput(outsourcingInput.sellingPrice) : ""}
                        onChange={(e) =>
                          setOutsourcingInput((prev) => ({
                            ...prev,
                            sellingPrice: parseCurrencyInput(e.target.value),
                          }))
                        }
                        disabled={isCompleted}
                        className="col-span-2 px-2 py-2.5 border-2 border-orange-300 dark:border-orange-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <div className="col-span-2 flex items-center justify-between">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {formatCurrency(outsourcingInput.quantity * outsourcingInput.sellingPrice)}
                        </span>
                        <button
                          type="button"
                          onClick={handleAddOutsourcing}
                          disabled={isCompleted}
                          className="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium flex items-center gap-1 text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <PlusIcon className="w-4 h-4" /> Thêm
                        </button>
                      </div>
                    </div>

                    {/* Danh sách gia công đã thêm */}
                    {(formData.outsourcingItems || []).length > 0 ? (
                      <div className="space-y-2">
                        {(formData.outsourcingItems || []).map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border-2 border-orange-200 dark:border-orange-700"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                                {item.description}
                              </div>
                              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>
                                  {item.quantity} × {formatCurrency(item.sellingPrice)} ={" "}
                                </span>
                                <span className="font-bold text-orange-600 dark:text-orange-400">
                                  {formatCurrency(item.total)}
                                </span>
                                <span className="text-slate-400">|</span>
                                <span className="text-slate-500">
                                  Giá nhập: {formatCurrency(item.costPrice)}
                                </span>
                                <span className="text-green-600 dark:text-green-400">
                                  (Lời: {formatCurrency((item.sellingPrice - item.costPrice) * item.quantity)})
                                </span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveOutsourcing(idx)}
                              disabled={isCompleted}
                              className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              aria-label="Xóa"
                            >
                              <TrashIcon className="w-5 h-5" />
                            </button>
                          </div>
                        ))}

                        {/* Subtotal gia công */}
                        <div className="mt-3 pt-3 border-t-2 border-orange-200 dark:border-orange-800">
                          <div className="flex justify-between items-center text-sm">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              Tổng gia công:
                            </span>
                            <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                              {formatCurrency((formData.outsourcingItems || []).reduce((sum, item) => sum + item.total, 0))}
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4 text-slate-400 dark:text-slate-500 text-sm">
                        Chưa có dịch vụ gia công ngoài
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card: Báo giá (chỉ hiện khi có vật liệu) */}
              {/* Card Merged: Chi phí & Thanh toán - Consolidated Design */}
              <div className="lg:col-span-3 bg-white dark:bg-slate-800 rounded-lg border border-emerald-200 dark:border-emerald-700 shadow-sm overflow-hidden">
                <div className="bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 border-b border-emerald-100 dark:border-emerald-800 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Chi phí & Thanh toán
                    {materialShortageInfo.hasShortage && (
                      <span className="ml-2 text-[10px] px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400 rounded-full font-extrabold uppercase tracking-wide">
                        Thiếu Hàng
                      </span>
                    )}
                  </h3>
                </div>

                <div className="p-4 space-y-4">
                  {/* 1. Cost Breakdown Grid */}
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    {/* Left: Materials & Outsourcing (Read Only) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-1">
                        <span className="text-slate-600 dark:text-slate-400">Vật liệu ({formData.materialsUsed?.length || 0}):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(materialsTotal)}</span>
                      </div>
                      <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-1">
                        <span className="text-slate-600 dark:text-slate-400">Gia công ({formData.outsourcingItems?.length || 0}):</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatCurrency((formData.outsourcingItems || []).reduce((sum, item) => sum + item.total, 0))}
                        </span>
                      </div>
                    </div>

                    {/* Right: Labor & Deposit (Inputs) */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-slate-600 dark:text-slate-400">Phí công:</label>
                        <input
                          type="text"
                          name="laborCost"
                          placeholder="0"
                          value={formData.laborCost ? formatCurrencyInput(formData.laborCost) : ""}
                          onChange={handleInputChange}
                          disabled={isCompleted}
                          className="w-28 px-2 py-1 text-right text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <label className="text-slate-600 dark:text-slate-400">Đã cọc:</label>
                        <input
                          type="text"
                          name="depositAmount"
                          placeholder="0"
                          value={formData.depositAmount ? formatCurrencyInput(formData.depositAmount) : ""}
                          onChange={handleInputChange}
                          disabled={isCompleted}
                          className="w-28 px-2 py-1 text-right text-sm border border-slate-300 dark:border-slate-600 rounded focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium text-yellow-600 dark:text-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>

                  {/* 2. Grand Total Highlight */}
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-3 rounded-lg border border-emerald-100 dark:border-emerald-800/50 flex justify-between items-center">
                    <div>
                      <div className="text-xs text-emerald-800 dark:text-emerald-400 font-bold uppercase tracking-wider">Tổng cộng</div>
                      <div className="text-xl sm:text-2xl font-black text-emerald-700 dark:text-emerald-400 leading-none mt-1">
                        {formatCurrency(total)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-rose-800 dark:text-rose-400 font-bold uppercase tracking-wider">Khách cần trả</div>
                      <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 leading-none mt-1">
                        {formatCurrency(remaining)}
                      </div>
                    </div>
                  </div>

                  {/* 3. Payment Controls - Compact */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-700/30 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Trạng thái thanh toán</label>
                      <select
                        name="paymentStatus"
                        value={formData.paymentStatus || "unpaid"}
                        onChange={handleInputChange}
                        disabled={isCompleted}
                        className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="unpaid">Chưa thanh toán</option>
                        <option value="partial">Thanh toán một phần</option>
                        <option value="paid">Đã thanh toán hết</option>
                      </select>
                    </div>

                    {formData.paymentStatus === "partial" ? (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Số tiền đã trả</label>
                        <input
                          type="text"
                          name="partialPaymentAmount"
                          placeholder="0"
                          value={formData.partialPaymentAmount ? formatCurrencyInput(formData.partialPaymentAmount) : ""}
                          onChange={(e) => setFormData(prev => ({ ...prev, partialPaymentAmount: parseCurrencyInput(e.target.value) }))}
                          disabled={isCompleted}
                          className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-right font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phương thức</label>
                        <select
                          name="paymentMethod"
                          value={formData.paymentMethod || ""}
                          onChange={handleInputChange}
                          disabled={isCompleted}
                          className="w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">-- Chọn --</option>
                          <option value="cash">💵 Tiền mặt</option>
                          <option value="bank">🏦 Chuyển khoản</option>
                          <option value="card">💳 Thẻ</option>
                        </select>
                      </div>
                    )}
                  </div>

                  {/* 4. Footer: Approve & Print */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={formData.quoteApproved || false}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              quoteApproved: e.target.checked,
                              quoteApprovedAt: e.target.checked ? new Date().toISOString() : undefined,
                            }))
                          }
                          className="w-4 h-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                        />
                      </div>
                      <div className="text-sm">
                        <span className="font-medium text-slate-700 dark:text-slate-300 group-hover:text-amber-600 transition-colors">Khách duyệt giá</span>
                        {formData.quoteApproved && formData.quoteApprovedAt && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 block -mt-0.5">
                            {new Date(formData.quoteApprovedAt).toLocaleTimeString("vi-VN", { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowQuotePrint(true)}
                      className="px-3 py-1.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 hover:bg-amber-100 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2-2v4h10z" />
                      </svg>
                      In Báo Giá
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>


          {/* Footer Sticky - Action Buttons */}
          <div className="sticky bottom-0 bg-white dark:bg-slate-900 pt-4 pb-4 px-4 sm:px-6 border-t-2 border-slate-200 dark:border-slate-700 flex-shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
            <div className="flex gap-3 max-w-7xl mx-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl font-semibold hover:bg-slate-300 dark:hover:bg-slate-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompleted}
                className="flex-[2] px-6 py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 text-white rounded-xl font-bold text-base shadow-xl shadow-blue-500/40 hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCompleted ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    🔒 Đã hoàn tất - Không thể sửa
                  </>
                ) : isSubmitting ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Đang lưu...
                  </>
                ) : (
                  getButtonText()
                )}
              </button>
            </div>
          </div>
        </form>
      </div >

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
