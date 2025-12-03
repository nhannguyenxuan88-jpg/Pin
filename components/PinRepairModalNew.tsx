import React, { useState, useMemo, useEffect } from "react";
import type { PinRepairOrder, PinRepairMaterial, User } from "../types";
import { usePinContext } from "../contexts/PinContext";
import { PlusIcon, TrashIcon, XMarkIcon } from "./common/Icons";

const generateUniqueId = (prefix = "") => {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, "0");
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const year = now.getFullYear();
  const counter = Math.floor(Math.random() * 1000);
  return `SC-${day}${month}${year}-${counter}`;
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
  const { pinMaterials, pinCustomers, upsertPinCustomer } = usePinContext();

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
  const [newCustomerData, setNewCustomerData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Filter materials based on search - chỉ hiển thị vật liệu còn tồn kho
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return [];
    const search = materialSearch.toLowerCase();
    return (pinMaterials || [])
      .filter(
        (m: any) =>
          // Chỉ hiển thị vật liệu còn tồn kho (stock > 0)
          (m.stock || 0) > 0 &&
          (m.name.toLowerCase().includes(search) || m.sku?.toLowerCase().includes(search))
      )
      .slice(0, 10);
  }, [pinMaterials, materialSearch]);

  // Load initial data
  useEffect(() => {
    if (isOpen && initialOrder) {
      setFormData({
        customerName: initialOrder.customerName || "",
        customerPhone: initialOrder.customerPhone || "",
        deviceName: initialOrder.deviceName || "",
        issueDescription: initialOrder.issueDescription || "",
        technicianName: initialOrder.technicianName || currentUser?.name || "",
        status: initialOrder.status || "Tiếp nhận",
        materialsUsed: initialOrder.materialsUsed || [],
        laborCost: initialOrder.laborCost || 0,
        notes: initialOrder.notes || "",
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
      alert("Vui lòng nhập tên khách hàng");
      return;
    }
    if (!newCustomerData.phone.trim()) {
      alert("Vui lòng nhập số điện thoại");
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
    } catch (error) {
      alert("Lỗi khi thêm khách hàng: " + (error as Error).message);
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

  const handleAddMaterial = () => {
    const materialName = materialSearch.trim() || materialInput.materialName.trim();

    if (!materialName) {
      alert("Vui lòng nhập tên vật liệu");
      return;
    }
    if (materialInput.quantity <= 0) {
      alert("Số lượng phải lớn hơn 0");
      return;
    }

    // Check stock availability
    const material = (pinMaterials || []).find(
      (m: any) => m.name.toLowerCase() === materialName.toLowerCase()
    );
    if (material) {
      // FIX: Dùng m.stock thay vì m.quantity để kiểm tra tồn kho
      const currentStock = material.stock || material.quantity || 0;
      const alreadyUsed =
        (formData.materialsUsed || [])
          .filter((m) => m.materialName.toLowerCase() === materialName.toLowerCase())
          .reduce((sum, m) => sum + m.quantity, 0) || 0;
      const availableStock = currentStock - alreadyUsed;

      if (materialInput.quantity > availableStock) {
        alert(
          `Không đủ tồn kho!\nTồn kho hiện tại: ${currentStock}\nĐã dùng: ${alreadyUsed}\nCòn lại: ${availableStock}\nBạn đang thêm: ${materialInput.quantity}`
        );
        return;
      }
    }

    const newMaterial: PinRepairMaterial = {
      materialId: generateUniqueId("MAT"),
      materialName,
      quantity: materialInput.quantity,
      price: materialInput.price,
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

  const calculateTotal = () => {
    const materialsTotal = (formData.materialsUsed || []).reduce(
      (sum, m) => sum + m.quantity * m.price,
      0
    );
    return materialsTotal + (formData.laborCost || 0);
  };

  const calculateRemaining = () => {
    const total = calculateTotal();
    const deposit = formData.depositAmount || 0;
    return Math.max(0, total - deposit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) {
      alert("Vui lòng đăng nhập");
      return;
    }

    if (!formData.customerName?.trim()) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }

    if (!formData.customerPhone?.trim()) {
      alert("Vui lòng nhập số điện thoại");
      return;
    }

    if (!formData.issueDescription?.trim()) {
      alert("Vui lòng mô tả sự cố");
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
        alert("Vui lòng nhập ít nhất vật liệu sử dụng hoặc phí dịch vụ");
        setIsSubmitting(false);
        return;
      }

      // Validate payment method when deposit > 0 OR payment status is paid/partial
      const depositAmt = Number(formData.depositAmount || 0);
      const needsPaymentMethod =
        depositAmt > 0 || formData.paymentStatus === "paid" || formData.paymentStatus === "partial";

      if (needsPaymentMethod && !formData.paymentMethod) {
        alert("Vui lòng chọn phương thức thanh toán");
        setIsSubmitting(false);
        return;
      }

      if (formData.paymentStatus === "partial") {
        const amt = Number(formData.partialPaymentAmount || 0);
        if (amt <= 0) {
          alert("Vui lòng nhập số tiền thanh toán cho hình thức thanh toán một phần.");
          setIsSubmitting(false);
          return;
        }
        if (amt >= total) {
          alert("Số tiền thanh toán một phần phải nhỏ hơn tổng số tiền.");
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

      await onSave(orderToSave);
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error as Error).message);
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
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-7xl my-4 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header với gradient xanh dương */}
        <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">{getHeaderTitle()}</h2>
            <p className="text-xs sm:text-sm text-blue-100 mt-1">
              Mã: {initialOrder?.id || "Tự động sinh"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors flex-shrink-0"
            type="button"
            aria-label="Đóng"
          >
            <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          {/* Layout 2 cột: Desktop 60/40, Mobile 1 cột */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 p-4 sm:p-6">
            {/* CỘT TRÁI (60%) - Form chính */}
            <div className="lg:col-span-3 space-y-4">
              {/* Card: Thông tin khách hàng */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 border-2 border-slate-200 dark:border-slate-700 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 hover:shadow-xl transition-shadow">
                <h3 className="text-base sm:text-lg font-bold mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <svg
                    className="w-5 h-5 text-blue-600"
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
                  Khách hàng <span className="text-red-500 ml-1">*</span>
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
                        className={`w-full px-4 py-2.5 ${
                          formData.customerName ? "pr-10" : ""
                        } border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all ${
                          formData.customerName ? "font-semibold" : ""
                        }`}
                        placeholder="Tìm khách hàng..."
                        autoComplete="off"
                        readOnly={!!formData.customerName}
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
                      className="flex-shrink-0 w-11 h-11 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md hover:shadow-lg transition-all"
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

              {/* Card: Thiết bị & Sự cố */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 border-2 border-purple-200 dark:border-purple-800 shadow-lg shadow-purple-100/50 dark:shadow-purple-900/30 hover:shadow-xl transition-shadow">
                <h3 className="text-base sm:text-lg font-bold mb-3 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <svg
                    className="w-5 h-5 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Thiết bị & Sự cố
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Tên thiết bị
                    </label>
                    <input
                      type="text"
                      name="deviceName"
                      value={formData.deviceName || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                      placeholder="VD: iPhone 13 Pro Max"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Mô tả sự cố <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      name="issueDescription"
                      value={formData.issueDescription || ""}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                      placeholder="VD: Màn hình bị vỡ, cảm ứng không hoạt động..."
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Card ngang: Trạng thái & Kỹ thuật viên */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border-2 border-amber-200 dark:border-amber-700 shadow-md hover:shadow-lg transition-shadow">
                  <label className="block text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                    Trạng thái phiếu
                  </label>
                  <select
                    name="status"
                    value={formData.status || "Tiếp nhận"}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 border-2 border-amber-300 dark:border-amber-700 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-all"
                  >
                    <option value="Tiếp nhận">🆕 Tiếp nhận</option>
                    <option value="Đang sửa">🔧 Đang sửa</option>
                    <option value="Đã sửa xong">✅ Đã sửa xong</option>
                    <option value="Trả máy">📦 Trả máy</option>
                  </select>
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-5 border-2 border-cyan-200 dark:border-cyan-700 shadow-md hover:shadow-lg transition-shadow">
                  <label className="block text-xs sm:text-sm font-semibold text-cyan-800 dark:text-cyan-300 mb-2 flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    Kỹ thuật viên
                  </label>
                  <input
                    name="technicianName"
                    type="text"
                    value={formData.technicianName || ""}
                    onChange={handleInputChange}
                    placeholder="Nhập tên KTV"
                    className="w-full px-4 py-2.5 border-2 border-cyan-300 dark:border-cyan-700 rounded-lg focus:ring-2 focus:ring-cyan-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-all"
                  />
                </div>
              </div>

              {/* Card: Phí dịch vụ */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 border-2 border-green-200 dark:border-green-800 shadow-lg shadow-green-100/50 dark:shadow-green-900/30 hover:shadow-xl transition-shadow">
                <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <svg
                    className="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Chi phí dịch vụ
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Phí công (VNĐ)
                    </label>
                    <input
                      type="text"
                      name="laborCost"
                      placeholder="100.000"
                      value={formData.laborCost ? formatCurrencyInput(formData.laborCost) : ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Tiền đặt cọc (VNĐ)
                    </label>
                    <input
                      type="text"
                      name="depositAmount"
                      placeholder="0"
                      value={
                        formData.depositAmount ? formatCurrencyInput(formData.depositAmount) : ""
                      }
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                    />
                  </div>
                </div>
                <div className="mt-4 grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Thời gian hẹn trả
                    </label>
                    <input
                      type="datetime-local"
                      name="dueDate"
                      value={formData.dueDate?.slice(0, 16) || ""}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Ghi chú nội bộ
                    </label>
                    <textarea
                      name="notes"
                      placeholder="VD: Khách yêu cầu kiểm tra thêm..."
                      value={formData.notes || ""}
                      onChange={handleInputChange}
                      rows={2}
                      className="w-full px-4 py-2.5 border-2 border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CỘT PHẢI (40%) - Vật liệu & Thanh toán */}
            <div className="lg:col-span-2 space-y-4">
              {/* Card: Vật liệu */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 border-2 border-indigo-200 dark:border-indigo-700 shadow-lg shadow-indigo-100/50 dark:shadow-indigo-900/30 hover:shadow-xl transition-shadow">
                <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2 text-indigo-900 dark:text-indigo-100">
                  <svg
                    className="w-5 h-5 text-indigo-600"
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
                  Vật liệu sử dụng
                </h3>

                {/* Input thêm vật liệu */}
                <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-3 border-2 border-indigo-200 dark:border-indigo-700">
                  <div className="space-y-2">
                    <div className="relative">
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
                        className="w-full px-4 py-2.5 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      {showMaterialDropdown && filteredMaterials.length > 0 && (
                        <div className="absolute z-30 w-full mt-1 bg-white dark:bg-slate-800 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg shadow-2xl max-h-60 overflow-y-auto">
                          {filteredMaterials.map((material: any) => (
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
                              className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border-b dark:border-slate-700 last:border-0 transition-colors"
                            >
                              <div className="font-semibold text-slate-900 dark:text-slate-100 flex justify-between">
                                <span>{material.name}</span>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
                                  Tồn: {material.stock || 0}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between mt-0.5">
                                <span>SKU: {material.sku}</span>
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  {formatCurrency(
                                    material.retailPrice || material.purchasePrice || 0
                                  )}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
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
                        className="px-3 py-2.5 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                      <input
                        type="text"
                        placeholder="Giá (VNĐ)"
                        value={materialInput.price ? formatCurrencyInput(materialInput.price) : ""}
                        onChange={(e) =>
                          setMaterialInput((prev) => ({
                            ...prev,
                            price: parseCurrencyInput(e.target.value),
                          }))
                        }
                        className="col-span-2 px-3 py-2.5 border-2 border-indigo-300 dark:border-indigo-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 transition-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddMaterial}
                      className="w-full px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 shadow-md shadow-indigo-500/30 transition-all"
                    >
                      <PlusIcon className="w-5 h-5" /> Thêm vật liệu
                    </button>
                  </div>
                </div>

                {/* Danh sách vật liệu đã thêm */}
                {(formData.materialsUsed || []).length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {(formData.materialsUsed || []).map((m, i) => (
                      <div
                        key={i}
                        className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 rounded-lg border-2 border-indigo-200 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {m.materialName}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                            {m.quantity} × {formatCurrency(m.price)} ={" "}
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {formatCurrency(m.quantity * m.price)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMaterial(i)}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          aria-label="Xóa"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
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

              {/* Card: Thanh toán */}
              <div className="bg-white dark:bg-slate-800 rounded-xl p-5 sm:p-6 border-2 border-emerald-200 dark:border-emerald-700 shadow-lg shadow-emerald-100/50 dark:shadow-emerald-900/30 hover:shadow-xl transition-shadow">
                <h3 className="text-base sm:text-lg font-bold mb-4 flex items-center gap-2 text-emerald-900 dark:text-emerald-100">
                  <svg
                    className="w-5 h-5 text-emerald-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  </svg>
                  Thanh toán
                </h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                        Trạng thái thanh toán
                      </label>
                      <select
                        name="paymentStatus"
                        value={formData.paymentStatus || "unpaid"}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2.5 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-all"
                      >
                        <option value="unpaid">Chưa thanh toán</option>
                        <option value="partial">Thanh toán một phần</option>
                        <option value="paid">Đã thanh toán đầy đủ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                        Phương thức thanh toán{" "}
                        {(formData.depositAmount && Number(formData.depositAmount) > 0) ||
                        formData.paymentStatus === "paid" ||
                        formData.paymentStatus === "partial" ? (
                          <span className="text-red-500">*</span>
                        ) : null}
                      </label>
                      <select
                        name="paymentMethod"
                        value={formData.paymentMethod || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2.5 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 font-medium transition-all"
                      >
                        <option value="">-- Chọn --</option>
                        <option value="cash">💵 Tiền mặt</option>
                        <option value="transfer">🏦 Chuyển khoản</option>
                        <option value="card">💳 Thẻ</option>
                      </select>
                    </div>
                  </div>

                  {formData.paymentStatus === "partial" && (
                    <div>
                      <label className="block text-xs sm:text-sm font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
                        Số tiền thanh toán một phần (VNĐ)
                      </label>
                      <input
                        type="text"
                        name="partialPaymentAmount"
                        placeholder="0"
                        value={
                          formData.partialPaymentAmount
                            ? formatCurrencyInput(formData.partialPaymentAmount)
                            : ""
                        }
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            partialPaymentAmount: parseCurrencyInput(e.target.value),
                          }))
                        }
                        className="w-full px-4 py-2.5 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 transition-all"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Tổng kết thanh toán */}
              <div className="bg-gradient-to-br from-blue-600 via-cyan-600 to-teal-600 rounded-xl p-5 sm:p-6 shadow-2xl shadow-blue-500/30">
                <h3 className="text-base font-bold mb-4 text-white flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  Tổng kết
                </h3>
                <div className="space-y-2 text-white">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-100">Tổng vật liệu:</span>
                    <span className="font-semibold">{formatCurrency(materialsTotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-100">Phí công:</span>
                    <span className="font-semibold">{formatCurrency(formData.laborCost || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-100">Đặt cọc:</span>
                    <span className="font-semibold text-yellow-300">
                      {formatCurrency(formData.depositAmount || 0)}
                    </span>
                  </div>
                  <div className="h-px bg-white/30 my-3"></div>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">TỔNG CỘNG:</span>
                    <span className="text-2xl sm:text-3xl font-bold">{formatCurrency(total)}</span>
                  </div>
                  {(formData.depositAmount || 0) > 0 && (
                    <div className="flex justify-between items-center pt-2 border-t border-white/30">
                      <span className="text-sm text-blue-100">Còn lại:</span>
                      <span className="text-xl font-bold text-yellow-300">
                        {formatCurrency(remaining)}
                      </span>
                    </div>
                  )}
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
                disabled={isSubmitting}
                className="flex-[2] px-6 py-3 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-600 hover:from-blue-700 hover:via-cyan-700 hover:to-teal-700 text-white rounded-xl font-bold text-base shadow-xl shadow-blue-500/40 hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
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
      </div>

      {/* Modal thêm khách hàng mới */}
      {showAddCustomerModal && (
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
      )}
    </div>
  );
};
