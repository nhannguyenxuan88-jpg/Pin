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

  const setDepositAmount = (amount: number) => {
    const normalized = Math.max(0, Math.trunc(amount || 0));
    setFormData((prev) => {
      const next: Partial<PinRepairOrder> = { ...prev, depositAmount: normalized };
      if (normalized > 0) {
        next.paymentStatus = "partial";
      } else if ((prev.partialPaymentAmount || 0) > 0) {
        next.paymentStatus = "partial";
      } else if (prev.paymentStatus === "partial") {
        next.paymentStatus = "unpaid";
        next.partialPaymentAmount = 0;
      }
      return next;
    });
  };

  const setPartialPaymentAmount = (amount: number) => {
    const normalized = Math.max(0, Math.trunc(amount || 0));
    setFormData((prev) => {
      const next: Partial<PinRepairOrder> = { ...prev, partialPaymentAmount: normalized };
      if (normalized > 0) {
        next.paymentStatus = "partial";
      } else if ((prev.depositAmount || 0) > 0) {
        next.paymentStatus = "partial";
      } else if (prev.paymentStatus === "partial") {
        next.paymentStatus = "unpaid";
      }
      return next;
    });
  };

  const setPaymentMethod = (paymentMethod: "cash" | "bank") => {
    setFormData((prev) => {
      const hasPartialPayment =
        prev.paymentStatus === "partial" ||
        (prev.partialPaymentAmount || 0) > 0 ||
        (prev.depositAmount || 0) > 0;

      return {
        ...prev,
        paymentMethod,
        paymentStatus: hasPartialPayment ? "partial" : "paid",
      };
    });
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "depositAmount") {
      setDepositAmount(parseCurrencyInput(value));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "laborCost"
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
    if (formData.paymentStatus === "paid") return 0;
    const paidAmount =
      formData.paymentStatus === "partial"
        ? Number(formData.partialPaymentAmount || formData.depositAmount || 0)
        : 0;
    return Math.max(0, total - paidAmount);
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
      const partialAmt = Number(formData.partialPaymentAmount || 0);
      const needsPaymentMethod =
        depositAmt > 0 || partialAmt > 0 || formData.paymentStatus === "paid" || formData.paymentStatus === "partial";

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

      const isReturning = orderToSave.status === "Trả máy";
      const hasDebt = orderToSave.paymentStatus !== "paid";

      // Warn when marking as "Trả máy" (Complete) -> Inventory Deduction
      if (isReturning && (!initialOrder?.materialsDeducted)) {
        setIsSubmitting(false);
        const debtNote =
          hasDebt
            ? "\n\nLưu ý: Đơn này đang ghi nợ, khách chưa thanh toán đủ."
            : "";
        showConfirmDialog(
          "Xác nhận hoàn tất & trừ kho",
          `Khi chuyển sang 'Trả máy', hệ thống sẽ:\n1. Trừ tồn kho vật tư đã sử dụng\n2. Ghi nhận doanh thu & lợi nhuận\n3. Tạo phiếu thu (nếu thanh toán)${debtNote}\n\nBạn có chắc chắn?`,
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

      if (isReturning && hasDebt) {
        setIsSubmitting(false);
        showConfirmDialog(
          "Trả máy & ghi nợ",
          "Khách chưa thanh toán đủ, đơn sẽ được ghi nợ.\n\nBạn có chắc chắn muốn Trả máy?",
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
  const isReturnPaymentAction =
    formData.status === "Trả máy" &&
    (formData.paymentStatus === "unpaid" || formData.paymentStatus === "partial");

  // Determine button text based on action
  const getButtonText = () => {
    if (isSubmitting) return "Đang xử lý...";

    if (isReturnPaymentAction) {
      return "Thanh toán & Trả máy";
    }

    if (!initialOrder) {
      // Creating new order
      const hasDeposit = formData.depositAmount && Number(formData.depositAmount) > 0;
      return hasDeposit ? "Đặt cọc & Tạo phiếu" : "Tạo phiếu";
    }

    return "Cập nhật";
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4">
      <div className="bg-[#182335] border border-slate-700/60 rounded-lg shadow-2xl shadow-black/40 w-full max-w-[1036px] overflow-hidden flex flex-col max-h-[95vh] text-slate-200 font-sans">
        
        {/* ── HEADER ── */}
        <div className="px-5 py-3.5 flex flex-wrap justify-between items-center gap-4 bg-[#1b2638] border-b border-slate-700/60 flex-shrink-0">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {/* Status Segmented Control */}
            <div className="flex max-w-full overflow-x-auto items-center rounded-full">
              {([
                { value: "Tiếp nhận", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg> },
                { value: "Đang sửa", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg> },
                { value: "Đã sửa xong", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg> },
                { value: "Trả máy", icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg> }
              ] as const).map(({ value, icon }) => {
                const active = formData.status === value;
                return (
                  <div key={value} className="flex shrink-0 items-center">
                    <button type="button" disabled={isCompleted}
                      onClick={() => setFormData(p => ({ ...p, status: value as any }))}
                      className={`px-3.5 py-2 rounded-full text-[13px] font-bold transition-all flex items-center gap-1.5 border ${
                        active
                          ? value === "Trả máy"
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-700/60 border-slate-600 text-slate-100"
                          : "bg-transparent border-slate-700/70 text-slate-400 hover:text-slate-200 hover:border-slate-600"
                      }`}>
                      <span className="opacity-80">{icon}</span>
                      <span>{value}</span>
                    </button>
                    {value !== "Trả máy" && <span className="mx-1.5 h-px w-4 bg-slate-600/70" />}
                  </div>
                );
              })}
            </div>
            {/* Status phụ */}
            {["Chờ vật liệu", "Đã hủy"].includes(formData.status as string) && (
              <div className="px-3 py-1.5 rounded-lg text-[13px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                {formData.status}
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-blue-500/50 bg-blue-500/10 px-3 py-1 text-[12px] font-bold text-blue-200">
              {initialOrder ? initialOrder.id : "Phiếu mới"}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-full p-2 transition-all" type="button">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col min-h-0 bg-[#0b1220]">

          {isCompleted && (
            <div className="mx-6 mt-5 p-3.5 bg-emerald-900/20 border border-emerald-500/30 rounded-xl flex items-center justify-center gap-3 flex-shrink-0 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
              <p className="font-semibold text-sm tracking-wide">Đơn đã hoàn tất & thanh toán — Chỉ xem</p>
            </div>
          )}

          {/* ── BODY ── */}
          <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-10 min-h-0">

            {/* ════ CỘT TRÁI (NỘI DUNG CHÍNH) ════ */}
            <div className="lg:col-span-7 overflow-y-auto p-5 space-y-5 custom-scrollbar pr-2 lg:pr-5">
              
              {/* SECTION 1: Khách hàng & Thiết bị */}
              <div className="bg-[#1d2a3d] border border-slate-700/70 shadow-lg shadow-black/10 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">1</span>
                  <h3 className="font-bold text-slate-100 text-[15px] tracking-wide">Khách hàng & Xe</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Khách hàng */}
                  <div className="relative col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">
                      Khách hàng <span className="text-red-500">*</span>
                    </label>
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
                          className={`w-full px-4 py-2.5 rounded-xl text-sm transition-all focus:outline-none disabled:opacity-50 ${
                            formData.customerName
                              ? "border-blue-500/50 bg-blue-500/10 border font-semibold pr-9 pl-4 text-blue-100 placeholder-transparent"
                              : "border border-slate-600 bg-[#0f172a] text-slate-200 focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500"
                          }`}
                          placeholder="Tìm khách hàng..."
                          autoComplete="off"
                        />
                        {formData.customerName && (
                          <button type="button"
                            onClick={() => { setFormData(p => ({ ...p, customerName: "", customerPhone: "" })); setCustomerSearch(""); }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-400 transition-colors">
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        )}
                        {showCustomerDropdown && !formData.customerName && filteredCustomers.length > 0 && (
                          <div className="absolute z-30 w-full mt-2 bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl max-h-48 overflow-y-auto overflow-hidden">
                            {filteredCustomers.map((c: any) => (
                              <button key={c.id} type="button" onClick={() => handleSelectCustomer(c)}
                                className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-700/50 last:border-0 transition-colors">
                                <div className="font-semibold text-sm text-slate-200">{c.name}</div>
                                <div className="text-xs text-slate-400 mt-1 font-medium flex items-center gap-1">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                                  {c.phone}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button type="button" onClick={() => setShowAddCustomerModal(true)} disabled={isCompleted}
                        className="w-[42px] shrink-0 flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                        <PlusIcon className="w-5 h-5" />
                      </button>
                    </div>
                    {formData.customerPhone && (
                      <div className="mt-2 text-[12px] font-medium text-blue-400 ml-1 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                        {formData.customerPhone}
                      </div>
                    )}
                  </div>

                  {/* Thiết bị */}
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Thiết bị (Xe/Máy)</label>
                    <input type="text" name="deviceName" value={formData.deviceName || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-600 bg-[#0f172a] text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500 disabled:opacity-50 transition-colors"
                      placeholder="VD: iPhone 15 / Honda..." />
                  </div>

                  {/* KTV */}
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Kỹ thuật viên</label>
                    <input type="text" name="technicianName" value={formData.technicianName || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-600 bg-[#0f172a] text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500 disabled:opacity-50 transition-colors"
                      placeholder="VD: Nguyễn Văn A..." />
                  </div>

                  {/* Hẹn trả */}
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Hẹn trả</label>
                    <input type="datetime-local" name="dueDate" value={formData.dueDate?.slice(0, 16) || ""} onChange={handleInputChange} disabled={isCompleted}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-600 bg-[#0f172a] text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500 disabled:opacity-50 transition-colors" />
                  </div>

                  {/* Mô tả */}
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Mô tả sự cố</label>
                    <textarea name="issueDescription" value={formData.issueDescription || ""} onChange={handleInputChange} disabled={isCompleted} rows={2}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-600 bg-[#0f172a] text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500 disabled:opacity-50 transition-colors resize-none"
                      placeholder="VD: Không lên nguồn..." />
                  </div>

                  {/* Ghi chú */}
                  <div className="col-span-1 md:col-span-1">
                    <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Ghi chú nội bộ</label>
                    <textarea name="notes" value={formData.notes || ""} onChange={handleInputChange} disabled={isCompleted} rows={2}
                      className="w-full px-4 py-2.5 rounded-xl text-sm border border-slate-600 bg-[#0f172a] text-slate-200 focus:outline-none focus:border-blue-500 focus:bg-slate-800 placeholder-slate-500 disabled:opacity-50 transition-colors resize-none"
                      placeholder="VD: Nhắc khách mang theo phụ kiện..." />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Phụ tùng sử dụng */}
              <div className="bg-[#1d2a3d] border border-slate-700/70 shadow-lg shadow-black/10 rounded-xl p-5">
                <div className="flex items-center mb-5 gap-2.5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">2</span>
                  <h3 className="font-bold text-slate-100 text-[15px] tracking-wide">Phụ tùng sử dụng</h3>
                </div>

                <div className="flex flex-wrap lg:flex-nowrap gap-3 mb-4 relative bg-[#0f172a] p-2 rounded-2xl border border-slate-700/50">
                  <div className="flex-1 relative min-w-[200px]">
                    <input type="text" placeholder="Tìm vật liệu..."
                      value={materialSearch}
                      onChange={(e) => { setMaterialSearch(e.target.value); setShowMaterialDropdown(true); setMaterialInput(p => ({ ...p, materialName: e.target.value })); }}
                      onFocus={() => setShowMaterialDropdown(true)}
                      onBlur={() => setTimeout(() => setShowMaterialDropdown(false), 200)}
                      disabled={isCompleted}
                      className="w-full px-4 py-2 rounded-xl text-sm border-none bg-transparent text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 placeholder-slate-500" />
                    {showMaterialDropdown && filteredMaterials.length > 0 && (
                      <div className="absolute z-30 w-full left-0 mt-3 bg-[#1e293b] border border-slate-600 rounded-xl shadow-2xl max-h-52 overflow-y-auto no-scrollbar">
                        {filteredMaterials.map((m: any) => (
                          <button key={m.id} type="button"
                            onClick={() => { setMaterialInput({ materialName: m.name, quantity: 1, price: m.retailPrice || m.purchasePrice || 0 }); setMaterialSearch(m.name); setShowMaterialDropdown(false); }}
                            className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-700/50 last:border-0 transition-colors">
                            <div className="flex justify-between items-center text-sm text-slate-200">
                              <span className="font-semibold">{m.name}</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded text-white font-bold ${(m.stock || 0) <= 0 ? "bg-red-500/80" : "bg-emerald-600/80"}`}>
                                {(m.stock || 0) <= 0 ? "Hết" : `Tồn: ${m.stock}`}
                              </span>
                            </div>
                            <div className="text-xs text-indigo-400 mt-1 font-medium">{formatCurrency(m.retailPrice || 0)}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-px bg-slate-700"></div>
                  <input type="number" placeholder="SL" min="1" value={materialInput.quantity}
                    onChange={(e) => setMaterialInput(p => ({ ...p, quantity: parseInt(e.target.value) || 1 }))}
                    disabled={isCompleted}
                    className="w-16 px-2 py-2 rounded-xl text-sm text-center border-none bg-transparent text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 placeholder-slate-500" />
                  <div className="w-px bg-slate-700"></div>
                  <input type="text" placeholder="Đ. Giá"
                    value={materialInput.price ? formatCurrencyInput(materialInput.price) : ""}
                    onChange={(e) => setMaterialInput(p => ({ ...p, price: parseCurrencyInput(e.target.value) }))}
                    disabled={isCompleted}
                    className="w-28 px-3 py-2 rounded-xl text-sm text-right border-none bg-transparent text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 disabled:opacity-50 placeholder-slate-500" />
                  <button type="button" onClick={handleAddMaterial} disabled={isCompleted}
                    className="px-5 py-2 shrink-0 flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 text-white text-[13px] tracking-wide font-bold rounded-xl transition-all disabled:opacity-40 ml-1 shadow-sm">
                    Thêm
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-[#0f172a]/50">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="text-slate-400 border-b border-slate-700/50 text-[11px] uppercase tracking-widest font-bold bg-[#1e293b]">
                      <tr>
                        <th className="px-5 py-3.5">Tên phụ tùng</th>
                        <th className="px-4 py-3.5 text-center">SL</th>
                        <th className="px-4 py-3.5 text-right">Đ.Giá</th>
                        <th className="px-5 py-3.5 text-right text-slate-300">T.Tiền</th>
                        <th className="px-3 py-3.5 w-10"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      {(formData.materialsUsed || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-8 text-center text-slate-500 font-medium text-[13px]">Chưa có phụ tùng nào</td>
                        </tr>
                      ) : (
                        (formData.materialsUsed || []).map((m, i) => (
                          <tr key={i} className="hover:bg-slate-800/50 transition-colors text-slate-200">
                            <td className="px-5 py-3 font-medium">{m.materialName}</td>
                            <td className="px-4 py-3 text-center">{m.quantity}</td>
                            <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(m.price)}</td>
                            <td className="px-5 py-3 text-right font-bold text-slate-200">{formatCurrency(m.quantity * m.price)}</td>
                            <td className="px-3 py-3 text-center">
                              <button type="button" onClick={() => handleRemoveMaterial(i)} disabled={isCompleted}
                                className="text-slate-500 hover:text-red-400 disabled:opacity-20 transition-colors p-1 rounded-md hover:bg-red-400/10">
                                <XMarkIcon className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SECTION 3: Báo giá (Gia công) */}
              <div className="bg-[#1d2a3d] border border-slate-700/70 shadow-lg shadow-black/10 rounded-xl p-5">
                <div className="flex items-center gap-2.5 mb-5">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-black text-white">3</span>
                  <h3 className="font-bold text-slate-100 text-[15px] tracking-wide">Báo giá (Gia công, Đặt hàng)</h3>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-[#0f172a]/50">
                  <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="text-slate-400 border-b border-slate-700/50 text-[11px] uppercase tracking-widest font-bold bg-[#1e293b]">
                      <tr>
                        <th className="px-5 py-3.5">Mô tả</th>
                        <th className="px-4 py-3.5 text-center w-20">SL</th>
                        <th className="px-4 py-3.5 text-right w-28">Giá vốn</th>
                        <th className="px-4 py-3.5 text-right w-28">Đơn giá</th>
                        <th className="px-5 py-3.5 text-right w-32 text-slate-300">Total</th>
                        <th className="px-3 py-3.5 text-center w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50">
                      <tr className="bg-[#0f172a] border-b border-slate-700 focus-within:bg-slate-800/80 transition-colors">
                        <td className="p-1">
                          <input type="text" placeholder="Thêm dịch vụ..." value={outsourcingInput.description}
                            onChange={(e) => setOutsourcingInput(p => ({ ...p, description: e.target.value }))}
                            disabled={isCompleted}
                            className="w-full px-4 py-2.5 bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 rounded-lg text-sm placeholder-slate-500" />
                        </td>
                        <td className="p-1">
                          <input type="number" placeholder="1" value={outsourcingInput.quantity} min="1"
                            onChange={(e) => setOutsourcingInput(p => ({ ...p, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                            disabled={isCompleted}
                            className="w-full text-center px-2 py-2.5 bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 rounded-lg text-sm placeholder-slate-500" />
                        </td>
                        <td className="p-1">
                          <input type="text" placeholder="0"
                            value={outsourcingInput.costPrice ? formatSignedCurrencyInput(outsourcingInput.costPrice) : ""}
                            onChange={(e) => setOutsourcingInput(p => ({ ...p, costPrice: parseSignedCurrencyInput(e.target.value) }))}
                            disabled={isCompleted}
                            className="w-full text-right px-3 py-2.5 bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 rounded-lg text-sm placeholder-slate-500" />
                        </td>
                        <td className="p-1">
                          <input type="text" placeholder="0"
                            value={outsourcingInput.sellingPrice ? formatSignedCurrencyInput(outsourcingInput.sellingPrice) : ""}
                            onChange={(e) => setOutsourcingInput(p => ({ ...p, sellingPrice: parseSignedCurrencyInput(e.target.value) }))}
                            disabled={isCompleted}
                            className="w-full text-right px-3 py-2.5 bg-transparent border-none text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500/50 rounded-lg text-sm placeholder-slate-500" />
                        </td>
                        <td className="p-2 px-5 text-right font-bold text-slate-200">
                          {formatCurrency(outsourcingInput.quantity * outsourcingInput.sellingPrice)}
                        </td>
                        <td className="p-1 text-center px-2">
                          <button type="button" onClick={handleAddOutsourcing} disabled={isCompleted}
                            className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-purple-400 font-bold rounded-lg text-xs transition-colors disabled:opacity-40">
                            + 
                          </button>
                        </td>
                      </tr>
                      
                      {/* List Items */}
                      {(formData.outsourcingItems || []).map((item, idx) => (
                        <tr key={item.id} className="hover:bg-slate-800/50 transition-colors text-slate-200">
                          <td className="px-5 py-3 font-medium">{item.description}</td>
                          <td className="px-4 py-3 text-center">{item.quantity}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.costPrice)}</td>
                          <td className="px-4 py-3 text-right text-slate-400">{formatCurrency(item.sellingPrice)}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-200">{formatCurrency(item.total)}</td>
                          <td className="px-3 py-3 text-center">
                            <button type="button" onClick={() => handleRemoveOutsourcing(idx)} disabled={isCompleted}
                              className="text-slate-500 hover:text-red-400 disabled:opacity-20 transition-colors p-1 rounded-md hover:bg-red-400/10">
                              <XMarkIcon className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>{/* end Cột Trái */}

            {/* ════ CỘT PHẢI (TỔNG KẾT & THANH TOÁN) ════ */}
            <div className="lg:col-span-3 flex flex-col bg-[#151f31] border-l border-slate-700/70 p-5 overscroll-none overflow-y-auto custom-scrollbar relative shadow-[-12px_0_30px_-22px_rgba(0,0,0,0.9)] z-10">
              <div className="flex-1 space-y-5 pb-28"> {/* pb-28 space for floating actions */}

                {/* Tổng kết */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-blue-400 opacity-90">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                    </span>
                    <h3 className="text-[13px] font-bold text-slate-200">Tổng kết</h3>
                  </div>
                  
                  <div className="bg-[#1d2a3d] rounded-xl p-4 border border-slate-700/80 shadow-inner shadow-black/20">
                    <div className="space-y-3.5 font-medium text-[13px] text-slate-400">
                      <div className="flex items-center justify-between">
                        <span>Phí dịch vụ</span>
                        <input type="text" name="laborCost" placeholder="0"
                          value={formData.laborCost ? formatCurrencyInput(formData.laborCost) : ""}
                          onChange={handleInputChange} disabled={isCompleted}
                          className="w-24 text-right font-bold text-slate-200 bg-slate-700/70 border border-slate-600 rounded-md px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 placeholder-slate-500" />
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-700/50 pt-3">
                        <span>Phụ tùng</span>
                        <span className="font-bold text-slate-200">{formatCurrency(materialsTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-700/50 pt-3">
                        <span>Dịch vụ ngoài</span>
                        <span className="font-bold text-slate-200">
                          {formatCurrency((formData.outsourcingItems || []).reduce((s, i) => s + i.total, 0))}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800/50 pt-3 text-red-400">
                        <span>Giảm giá</span>
                        <div className="flex items-center gap-1.5">
                          <input type="text" className="w-20 bg-slate-700/70 border border-slate-600 rounded-md px-2 py-1 text-right text-red-200 font-bold focus:outline-none" disabled value="0" />
                          <div className="bg-slate-700/70 border border-slate-600 rounded-md px-2 py-1 text-slate-200 text-xs font-bold pointer-events-none">đ</div>
                        </div>
                      </div>

                        <div className="border-t border-slate-700/80 mt-4 pt-4 flex items-end justify-between">
                          <span className="text-[14px] font-bold text-slate-200 uppercase tracking-wide">Tổng cộng</span>
                        <span className="text-2xl font-black text-blue-400 tracking-tight">{formatCurrency(total)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Thanh toán */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-emerald-400 opacity-80">
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    </span>
                    <h3 className="text-[13px] font-bold text-slate-200">Thanh toán</h3>
                  </div>

                  <div className="bg-[#1d2a3d] rounded-xl p-4 border border-slate-700/80 space-y-4 shadow-inner shadow-black/20">
                    
                    <div className="space-y-2.5">
                      <label className={`flex items-center gap-3 cursor-pointer group rounded-xl border px-3 py-2.5 transition-all ${
                        (formData.depositAmount || 0) > 0 ? "bg-blue-500/10 border-blue-500/50" : "bg-transparent border-transparent hover:bg-slate-700/30"
                      }`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          (formData.depositAmount || 0) > 0 ? "bg-blue-600 border-blue-600" : "bg-[#0b1220] border-slate-600 group-hover:border-blue-500"
                        }`}>
                          {(formData.depositAmount || 0) > 0 && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" className="hidden" checked={(formData.depositAmount || 0) > 0} 
                          onChange={(e) => setDepositAmount(e.target.checked ? 100000 : 0)} disabled={isCompleted} />
                        <span className="text-[13px] font-bold text-slate-200">Yêu cầu Đặt cọc</span>
                      </label>
                       
                      {(formData.depositAmount || 0) > 0 && (
                         <div className="ml-8 relative">
                           <input type="text"
                            value={formData.depositAmount ? formatCurrencyInput(formData.depositAmount) : ""}
                            onChange={(e) => setDepositAmount(parseCurrencyInput(e.target.value))}
                            disabled={isCompleted}
                            className="w-full px-3 py-2.5 border border-blue-500/40 bg-blue-500/10 rounded-xl text-sm text-right font-bold text-blue-100 focus:outline-none focus:border-blue-500 transition-colors" />
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-blue-400">Số tiền gốc</span>
                         </div>
                      )}

                      <label className={`flex items-center gap-3 cursor-pointer group rounded-xl border px-3 py-2.5 transition-all ${
                        (formData.partialPaymentAmount || 0) > 0 ? "bg-blue-500/10 border-blue-500/50" : "bg-transparent border-transparent hover:bg-slate-700/30"
                      }`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          (formData.partialPaymentAmount || 0) > 0 ? "bg-amber-600 border-amber-600" : "bg-[#0b1220] border-slate-600 group-hover:border-amber-500"
                        }`}>
                          {(formData.partialPaymentAmount || 0) > 0 && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" className="hidden" checked={(formData.partialPaymentAmount || 0) > 0}
                          onChange={(e) => setPartialPaymentAmount(e.target.checked ? 100000 : 0)} disabled={isCompleted} />
                        <span className="text-[13px] font-bold text-slate-200">Thanh toán một phần</span>
                      </label>

                      {(formData.partialPaymentAmount || 0) > 0 && (
                        <div className="ml-8 relative">
                          <input type="text"
                            value={formData.partialPaymentAmount ? formatCurrencyInput(formData.partialPaymentAmount) : ""}
                            onChange={(e) => setPartialPaymentAmount(parseCurrencyInput(e.target.value))}
                            disabled={isCompleted}
                            className="w-full px-3 py-2.5 border border-amber-500/40 bg-amber-500/10 rounded-xl text-sm text-right font-bold text-amber-100 focus:outline-none focus:border-amber-500 transition-colors" />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-amber-400">Số tiền đã trả</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between rounded-lg border border-slate-600/80 bg-slate-700/50 px-3 py-2.5">
                        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">Còn lại</span>
                        <span className="text-sm font-bold text-rose-300">{formatCurrency(remaining)}</span>
                      </div>

                      <label className={`flex items-center gap-3 cursor-pointer group rounded-xl border px-3 py-2.5 transition-all ${
                        formData.quoteApproved ? "bg-emerald-500/10 border-emerald-500/50" : "bg-transparent border-transparent hover:bg-slate-700/30"
                      }`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                          formData.quoteApproved ? "bg-emerald-600 border-emerald-600" : "bg-[#0b1220] border-slate-600 group-hover:border-emerald-500"
                        }`}>
                          {formData.quoteApproved && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                        </div>
                        <input type="checkbox" className="hidden" checked={formData.quoteApproved || false}
                          onChange={(e) => setFormData(p => ({ ...p, quoteApproved: e.target.checked, quoteApprovedAt: e.target.checked ? new Date().toISOString() : undefined }))} disabled={isCompleted} />
                        <span className="text-[13px] font-bold text-slate-200">Khách đã duyệt giá</span>
                      </label>
                    </div>

                    <div className="border-t border-slate-700/70 pt-4">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Phương thức</label>
                      <div className="grid grid-cols-2 gap-2.5">
                        <button type="button" onClick={() => setPaymentMethod("cash")} disabled={isCompleted}
                          className={`flex items-center justify-center gap-2 py-3 rounded-[12px] text-[13px] font-bold transition-all border ${
                            formData.paymentMethod === "cash"
                              ? "bg-blue-600/20 border-blue-500/80 text-blue-100 shadow-sm" 
                              : "bg-transparent border-slate-600/80 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                          }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                          Tiền mặt
                        </button>
                        <button type="button" onClick={() => setPaymentMethod("bank")} disabled={isCompleted}
                          className={`flex items-center justify-center gap-2 py-3 rounded-[12px] text-[13px] font-bold transition-all border ${
                            formData.paymentMethod === "bank"
                              ? "bg-blue-600/20 border-blue-500/80 text-blue-100 shadow-sm" 
                              : "bg-transparent border-slate-600/80 text-slate-400 hover:text-slate-200 hover:border-slate-500"
                          }`}>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"/></svg>
                          C.Khoản
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500/80 mt-3 text-center">* Bắt buộc thanh toán 100% khi &quot;Trả máy&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* FLOATING ACTION BLOCKS (Lưu phiếu / Hủy) */}
              <div className="absolute bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#151f31] via-[#151f31]/95 to-transparent pt-14">
                <div className="space-y-3">
                  <button type="submit" disabled={isSubmitting || isCompleted}
                    className={`w-full py-3.5 active:transform active:scale-[0.99] text-white rounded-lg font-black shadow-lg transition-all flex items-center justify-center gap-2.5 disabled:opacity-50 text-[15px] tracking-wide ${
                      isReturnPaymentAction
                        ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-950/40"
                        : "bg-blue-600 hover:bg-blue-500 shadow-blue-950/40"
                    }`}>
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                         <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Đang lưu hệ thống...
                      </span>
                    ) : (
                      <>
                        {isReturnPaymentAction ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m5 2a8 8 0 11-16 0 8 8 0 0116 0z" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        )}
                        {getButtonText()}
                      </>
                    )}
                  </button>
                  <button type="button" onClick={onClose} disabled={isSubmitting}
                    className="w-full py-2.5 text-slate-500 hover:text-slate-300 font-bold transition-colors text-[13px] tracking-wide">
                    Hủy bỏ
                  </button>
                </div>
              </div>

            </div>{/* end Cột Phải */}
          </div>{/* end grid */}
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
