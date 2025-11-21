import React, { useState, useMemo, useEffect } from "react";
import type {
  PinRepairOrder,
  PinRepairMaterial,
  User,
  CashTransaction,
} from "../types";
import { usePinContext } from "../contexts/PinContext";
import { PlusIcon, TrashIcon, PrinterIcon, XMarkIcon } from "./common/Icons";
import Pagination from "./common/Pagination";

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

interface RepairOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: PinRepairOrder) => Promise<void>;
  initialOrder?: PinRepairOrder | null;
  currentUser: User | null;
}

const RepairOrderModal: React.FC<RepairOrderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialOrder,
  currentUser,
}) => {
  const { pinMaterials, pinCustomers, upsertPinCustomer } = usePinContext(); // Get materials + customers list for autocomplete
  const DRAFT_KEY = "repair_order_draft_v1";

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
    warrantyPeriod: 0, // Thêm: Thời gian bảo hành (ngày)
  });

  const [materialInput, setMaterialInput] = useState({
    materialName: "",
    quantity: 1,
    price: 0,
  });

  const [materialSearch, setMaterialSearch] = useState("");
  const [showMaterialDropdown, setShowMaterialDropdown] = useState(false);
  // Customer autocomplete
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter materials based on search
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return [];
    const search = materialSearch.toLowerCase();
    return (pinMaterials || [])
      .filter(
        (m: any) =>
          m.name.toLowerCase().includes(search) ||
          m.sku?.toLowerCase().includes(search)
      )
      .slice(0, 10);
  }, [pinMaterials, materialSearch]);

  // Load form data khi modal mở
  useEffect(() => {
    if (isOpen) {
      if (initialOrder) {
        setFormData({
          ...initialOrder,
          materialsUsed: initialOrder.materialsUsed || [],
        });
      } else {
        // Thử khôi phục bản nháp nếu có
        try {
          const saved = localStorage.getItem(DRAFT_KEY);
          if (saved) {
            const parsed = JSON.parse(saved);
            console.log("[RepairOrderModal] Khôi phục draft:", parsed);
            setFormData({
              customerName: parsed.customerName || "",
              customerPhone: parsed.customerPhone || "",
              deviceName: parsed.deviceName || "",
              issueDescription: parsed.issueDescription || "",
              technicianName: parsed.technicianName || currentUser?.name || "",
              status: parsed.status || "Tiếp nhận",
              materialsUsed: Array.isArray(parsed.materialsUsed)
                ? parsed.materialsUsed
                : [],
              laborCost: Number(parsed.laborCost) || 0,
              notes: parsed.notes || "",
              paymentStatus: parsed.paymentStatus || "unpaid",
              partialPaymentAmount: Number(parsed.partialPaymentAmount) || 0,
              depositAmount: Number(parsed.depositAmount) || 0,
              paymentMethod: parsed.paymentMethod,
              paymentDate: parsed.paymentDate,
              cashTransactionId: parsed.cashTransactionId,
            });
          } else {
            console.log("[RepairOrderModal] Không có draft, dùng mặc định");
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
            });
          }
        } catch (e) {
          console.error("[RepairOrderModal] Lỗi đọc draft:", e);
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
          });
        }
      }
      setMaterialInput({ materialName: "", quantity: 1, price: 0 });
      setCustomerSearch("");
      setShowCustomerDropdown(false);
    }
  }, [isOpen, initialOrder, currentUser]);

  // Tự động lưu bản nháp khi đang mở modal và form thay đổi
  useEffect(() => {
    if (!isOpen || initialOrder) return; // chỉ lưu khi tạo mới
    try {
      const draft = {
        customerName: formData.customerName || "",
        customerPhone: formData.customerPhone || "",
        deviceName: formData.deviceName || "",
        issueDescription: formData.issueDescription || "",
        technicianName: formData.technicianName || currentUser?.name || "",
        status: formData.status || "Tiếp nhận",
        materialsUsed: formData.materialsUsed || [],
        laborCost: Number(formData.laborCost) || 0,
        notes: formData.notes || "",
        paymentStatus: formData.paymentStatus || "unpaid",
        partialPaymentAmount: Number(formData.partialPaymentAmount) || 0,
        depositAmount: Number(formData.depositAmount) || 0,
        paymentMethod: formData.paymentMethod,
        paymentDate: formData.paymentDate,
        cashTransactionId: formData.cashTransactionId,
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      console.log("[RepairOrderModal] Lưu draft:", draft);
    } catch (e) {
      console.error("[RepairOrderModal] Lỗi lưu draft:", e);
    }
  }, [isOpen, formData, initialOrder, currentUser]);

  // Lưu draft trước khi rời/trang reload
  useEffect(() => {
    if (!isOpen || initialOrder) return;
    const handleBeforeUnload = () => {
      try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
        console.log("[RepairOrderModal] beforeunload: đã lưu draft");
      } catch {}
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, initialOrder, formData]);

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "laborCost" || name === "depositAmount"
          ? parseCurrencyInput(value)
          : value,
    }));
    if (name === "customerName") {
      setCustomerSearch(value);
      setShowCustomerDropdown(!!value.trim());
    }
  };

  const handleAddMaterial = () => {
    if (!materialInput.materialName.trim()) {
      alert("Vui lòng nhập tên vật liệu");
      return;
    }
    if (materialInput.quantity <= 0) {
      alert("Số lượng phải lớn hơn 0");
      return;
    }

    const newMaterial: PinRepairMaterial = {
      materialId: generateUniqueId("MAT"),
      materialName: materialInput.materialName.trim(),
      quantity: materialInput.quantity,
      price: materialInput.price,
    };

    setFormData((prev) => ({
      ...prev,
      materialsUsed: [...(prev.materialsUsed || []), newMaterial],
    }));

    setMaterialInput({ materialName: "", quantity: 1, price: 0 });
    setMaterialSearch(""); // Clear search
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
      // Check if customer exists, if not create new
      const existingCustomer = (pinCustomers || []).find(
        (c: any) =>
          c.name?.toLowerCase() === formData.customerName?.toLowerCase() ||
          c.phone === formData.customerPhone
      );

      if (!existingCustomer && upsertPinCustomer && formData.customerName) {
        // Auto-create new customer
        const newCustomer = {
          id: crypto.randomUUID(),
          name: formData.customerName.trim(),
          phone: formData.customerPhone?.trim() || "",
          email: "",
          address: "",
          notes: "Tự động tạo từ phiếu sửa chữa",
        };
        await upsertPinCustomer(newCustomer);
        console.log("[RepairOrderModal] Đã tạo khách hàng mới:", newCustomer);
      }

      const total = calculateTotal();

      // Validation: Phải có ít nhất vật liệu hoặc phí dịch vụ
      if (total <= 0) {
        alert("Vui lòng nhập ít nhất vật liệu sử dụng hoặc phí dịch vụ");
        setIsSubmitting(false);
        return;
      }

      // Validate partial payment if selected
      if (formData.paymentStatus === "partial") {
        const amt = Number(formData.partialPaymentAmount || 0);
        if (amt <= 0) {
          alert(
            "Vui lòng nhập số tiền thanh toán cho hình thức thanh toán một phần."
          );
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
        cashTransactionId: formData.cashTransactionId,
      };

      console.log("[PinRepairManager] Saving order:", orderToSave);
      console.log("[PinRepairManager] deviceName:", orderToSave.deviceName);
      console.log(
        "[PinRepairManager] issueDescription:",
        orderToSave.issueDescription
      );
      console.log(
        "[PinRepairManager] materialsUsed:",
        orderToSave.materialsUsed
      );
      console.log("[PinRepairManager] total:", orderToSave.total);

      await onSave(orderToSave);
      // Xoá draft sau khi lưu thành công
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {}
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 bg-gradient-to-r from-sky-600 to-blue-600 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">
            {initialOrder ? "Cập nhật phiếu" : "Tạo phiếu mới"}
          </h2>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/20 rounded-lg p-2"
            type="button"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-6 space-y-4"
        >
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
              Thông tin khách hàng
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <input
                type="text"
                name="customerName"
                value={formData.customerName || ""}
                onChange={handleInputChange}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="Tên khách hàng *"
                onFocus={() =>
                  setShowCustomerDropdown(
                    Boolean((formData.customerName || "").trim())
                  )
                }
                required
              />
              <input
                type="tel"
                name="customerPhone"
                value={formData.customerPhone || ""}
                onChange={handleInputChange}
                className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="Số điện thoại *"
                required
              />
            </div>
            {showCustomerDropdown && (
              <div className="relative mt-2">
                <div className="absolute z-20 w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                  {(() => {
                    const q = (customerSearch || formData.customerName || "")
                      .toLowerCase()
                      .trim();
                    const results = q
                      ? (pinCustomers || [])
                          .filter(
                            (c: any) =>
                              (c.name || "").toLowerCase().includes(q) ||
                              (c.phone || "").includes(q)
                          )
                          .slice(0, 8)
                      : [];

                    return (
                      <>
                        {results.map((c: any) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setFormData((prev) => ({
                                ...prev,
                                customerName: c.name,
                                customerPhone:
                                  c.phone || prev.customerPhone || "",
                              }));
                              setCustomerSearch("");
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 border-b dark:border-slate-700"
                          >
                            <div className="font-medium text-slate-900 dark:text-slate-100">
                              {c.name}
                            </div>
                            {c.phone && (
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                {c.phone}
                              </div>
                            )}
                          </button>
                        ))}
                        {results.length === 0 && q && (
                          <button
                            type="button"
                            onClick={() => {
                              // Keep the entered name and close dropdown
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 font-medium"
                          >
                            + Thêm khách hàng mới: "{formData.customerName}"
                          </button>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
            <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
              Thiết bị & Sự cố
            </h3>
            <div className="space-y-2">
              <input
                type="text"
                name="deviceName"
                value={formData.deviceName || ""}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="Tên thiết bị (VD: iPhone 13...)"
              />
              <textarea
                name="issueDescription"
                value={formData.issueDescription || ""}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 resize-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                placeholder="Mô tả sự cố *"
                required
              />
            </div>
          </div>

          {/* Phí dịch vụ (công thợ) */}
          <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Trạng thái
                </label>
                <select
                  name="status"
                  value={formData.status || "Tiếp nhận"}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="Tiếp nhận">Tiếp nhận</option>
                  <option value="Đang sửa">Đang sửa</option>
                  <option value="Đã sửa xong">Đã sửa xong</option>
                  <option value="Trả máy">Trả máy</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Kỹ thuật viên
                </label>
                <input
                  name="technicianName"
                  type="text"
                  value={formData.technicianName || ""}
                  onChange={handleInputChange}
                  placeholder="-- Chọn kỹ thuật viên --"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Thời gian bảo hành (ngày)
                </label>
                <input
                  type="number"
                  name="warrantyPeriod"
                  placeholder="VD: 30 (ngày)"
                  value={formData.warrantyPeriod || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      warrantyPeriod: parseInt(e.target.value) || 0,
                    }))
                  }
                  min="0"
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div></div>
            </div>

            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Thời gian bảo hành (ngày)
                </label>
                <input
                  type="number"
                  name="warrantyPeriod"
                  placeholder="VD: 30 (ngày)"
                  value={formData.warrantyPeriod || 0}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      warrantyPeriod: parseInt(e.target.value) || 0,
                    }))
                  }
                  min="0"
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div />
            </div>

            <div className="grid md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phí dịch vụ (công thợ)
                </label>
                <input
                  type="text"
                  name="laborCost"
                  placeholder="100.000"
                  value={
                    formData.laborCost
                      ? formatCurrencyInput(formData.laborCost)
                      : ""
                  }
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Đặt cọc
                </label>
                <input
                  type="text"
                  name="depositAmount"
                  placeholder="0"
                  value={
                    formData.depositAmount
                      ? formatCurrencyInput(formData.depositAmount)
                      : ""
                  }
                  onChange={handleInputChange}
                  className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                {formData.depositAmount > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Còn lại:{" "}
                    </span>
                    <span className="font-bold text-orange-600 dark:text-orange-400">
                      {formatCurrency(calculateRemaining())}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Ghi chú nội bộ
              </label>
              <textarea
                name="notes"
                placeholder="VD: Khách yêu cầu kiểm tra thêm hệ thống điện"
                value={formData.notes || ""}
                onChange={handleInputChange}
                rows={2}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-sky-500 resize-none bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              Vật liệu
            </h3>
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 mb-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    placeholder="Tên vật liệu (gõ để tìm)"
                    value={materialSearch}
                    onChange={(e) => {
                      setMaterialSearch(e.target.value);
                      setShowMaterialDropdown(true);
                    }}
                    onFocus={() => setShowMaterialDropdown(true)}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  {showMaterialDropdown && filteredMaterials.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {filteredMaterials.map((material: any) => (
                        <button
                          key={material.id}
                          type="button"
                          onClick={() => {
                            setMaterialInput({
                              materialName: material.name,
                              quantity: 1,
                              price:
                                material.retailPrice ||
                                material.purchasePrice ||
                                0,
                            });
                            setMaterialSearch(material.name);
                            setShowMaterialDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-sky-50 dark:hover:bg-sky-900/30 border-b dark:border-slate-700 last:border-0"
                        >
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {material.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 flex justify-between">
                            <span>SKU: {material.sku}</span>
                            <span>
                              {formatCurrency(
                                material.retailPrice ||
                                  material.purchasePrice ||
                                  0
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input
                  type="number"
                  placeholder="Số lượng"
                  value={materialInput.quantity}
                  min="1"
                  onChange={(e) =>
                    setMaterialInput((prev) => ({
                      ...prev,
                      quantity: parseInt(e.target.value) || 1,
                    }))
                  }
                  className="w-24 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <input
                  type="text"
                  placeholder="Giá (VND)"
                  value={
                    materialInput.price
                      ? formatCurrencyInput(materialInput.price)
                      : ""
                  }
                  onChange={(e) =>
                    setMaterialInput((prev) => ({
                      ...prev,
                      price: parseCurrencyInput(e.target.value),
                    }))
                  }
                  className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={handleAddMaterial}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <PlusIcon className="w-5 h-5" /> Thêm vật liệu
                </button>
              </div>
            </div>
            {(formData.materialsUsed || []).length > 0 ? (
              <div className="space-y-2">
                {(formData.materialsUsed || []).map((m, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center p-3 bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600"
                  >
                    <div>
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.materialName}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {m.quantity} × {formatCurrency(m.price)} ={" "}
                        {formatCurrency(m.quantity * m.price)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(i)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-3 text-sm">
                Chưa có vật liệu
              </div>
            )}
          </div>

          {/* Thanh toán */}
          <div className="bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 p-4 rounded-xl border-2 border-orange-200 dark:border-orange-700 shadow-sm">
            <h4 className="text-base font-bold text-orange-800 dark:text-orange-200 mb-3 flex items-center gap-2">
              <span className="text-xl">💳</span>
              <span>Thanh toán</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-orange-200 dark:border-orange-700">
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Trạng thái
                </label>
                <select
                  name="paymentStatus"
                  value={formData.paymentStatus || "unpaid"}
                  onChange={handleInputChange}
                  className="w-full p-2 border-0 bg-slate-50 dark:bg-slate-700 rounded-md text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
                >
                  <option value="unpaid">Chưa thanh toán</option>
                  <option value="paid">Đã thanh toán</option>
                  <option value="partial">Thanh toán 1 phần</option>
                </select>
              </div>

              <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-orange-200 dark:border-orange-700">
                <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                  Phương thức
                </label>
                <select
                  name="paymentMethod"
                  value={(formData.paymentMethod as any) || "cash"}
                  onChange={handleInputChange}
                  className="w-full p-2 border-0 bg-slate-50 dark:bg-slate-700 rounded-md text-sm text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400 transition-all"
                >
                  <option value="cash">Tiền mặt</option>
                  <option value="bank">Chuyển khoản</option>
                </select>
              </div>
            </div>

            {formData.paymentStatus === "partial" && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-orange-200 dark:border-orange-700">
                  <label className="block text-xs font-semibold mb-1 text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                    Số tiền thanh toán trước
                  </label>
                  <input
                    type="text"
                    name="partialPaymentAmount"
                    value={
                      formData.partialPaymentAmount
                        ? formatCurrencyInput(formData.partialPaymentAmount)
                        : ""
                    }
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        partialPaymentAmount: parseCurrencyInput(
                          e.target.value
                        ),
                      }))
                    }
                    placeholder="Nhập số tiền thanh toán..."
                    className="w-full p-2.5 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-400"
                  />
                </div>
                <div className="bg-white dark:bg-slate-800 p-3 rounded-lg border border-orange-200 dark:border-orange-700 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                    Còn lại
                  </span>
                  <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                    {formatCurrency(
                      Math.max(
                        0,
                        calculateTotal() -
                          Number(formData.partialPaymentAmount || 0)
                      )
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-900/20 dark:to-sky-900/20 rounded-lg p-4 border-2 border-blue-200 dark:border-blue-800">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Tổng tiền:
                </span>
                <span className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  {formatCurrency(calculateTotal())}
                </span>
              </div>
              {formData.depositAmount > 0 && (
                <>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-600 dark:text-slate-400">
                      Đã đặt cọc:
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      - {formatCurrency(formData.depositAmount)}
                    </span>
                  </div>
                  <div className="border-t border-blue-200 dark:border-blue-700 pt-2"></div>
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">
                  {formData.depositAmount > 0 ? "Còn phải thu:" : "Tổng cộng:"}
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {formatCurrency(
                    formData.depositAmount > 0
                      ? calculateRemaining()
                      : calculateTotal()
                  )}
                </span>
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-lg font-semibold text-slate-800 dark:text-slate-200"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={!currentUser || isSubmitting}
            className="px-6 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-lg font-semibold flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <span className="animate-spin">⏳</span>Đang lưu...
              </>
            ) : (
              <>{initialOrder ? "Cập nhật" : "Tạo"}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export const PinRepairManager: React.FC = () => {
  const {
    pinRepairOrders,
    upsertPinRepairOrder,
    deletePinRepairOrder,
    currentUser,
    storeSettings,
    addToast,
  } = usePinContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PinRepairOrder | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const DRAFT_KEY = "repair_order_draft_v1";

  const currentBranchId = storeSettings?.branches?.[0]?.id || "main";

  const handleOpenModal = (order?: PinRepairOrder) => {
    setSelectedOrder(order || null);
    setModalOpen(true);
  };

  // Tự động mở modal nếu phát hiện bản nháp sau khi reload trang
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved && !modalOpen && !selectedOrder) {
        setModalOpen(true);
        // thông báo nhẹ nhàng
        addToast?.({
          title: "Khôi phục bản nháp",
          message: "Đã khôi phục nội dung phiếu chưa lưu.",
          type: "info",
        });
      }
    } catch {}
    // chỉ chạy một lần khi mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveOrder = async (order: PinRepairOrder) => {
    // T? d?ng t?o CashTransaction n?u d� thanh to�n ho?c thanh to�n m?t ph?n
    let cashTx: CashTransaction | undefined;

    if (order.paymentStatus === "paid" && order.total > 0) {
      cashTx = {
        id: generateUniqueId("TX"),
        type: "income",
        date: new Date().toISOString(),
        amount: order.total,
        contact: {
          id: order.id,
          name: order.customerName,
        },
        notes: `Thu ti?n s?a ch?a ${order.deviceName || "thi?t b?"} - ${
          order.issueDescription || "S?a ch?a"
        }`,
        paymentSourceId: order.paymentMethod || "cash",
        branchId: currentBranchId,
        category: "service_income",
        saleId: undefined,
        workOrderId: order.id,
      };
    } else if (
      order.paymentStatus === "partial" &&
      (order.partialPaymentAmount || 0) > 0
    ) {
      // T?o CashTransaction cho thanh to�n m?t ph?n (d?t c?c)
      const depositAmount = Number(order.partialPaymentAmount || 0);
      cashTx = {
        id: generateUniqueId("TX"),
        type: "income",
        date: new Date().toISOString(),
        amount: depositAmount,
        contact: {
          id: order.id,
          name: order.customerName,
        },
        notes: `�?t c?c s?a ch?a ${order.deviceName || "thi?t b?"} - ${
          order.issueDescription || "S?a ch?a"
        } (${depositAmount.toLocaleString()}/${order.total.toLocaleString()})`,
        paymentSourceId: order.paymentMethod || "cash",
        branchId: currentBranchId,
        category: "service_income",
        saleId: undefined,
        workOrderId: order.id,
      };
    }

    await upsertPinRepairOrder(order, cashTx);
  };

  const handleDeleteOrder = async (id: string) => {
    if (window.confirm("X�a phi?u n�y?")) {
      await deletePinRepairOrder(id);
    }
  };

  const handlePrint = (order: PinRepairOrder) => {
    const w = window.open("", "_blank");
    if (!w) return alert("Cho phép pop-up");

    const mats = (order.materialsUsed || [])
      .map(
        (m) =>
          `<tr><td>${m.materialName}</td><td>${
            m.quantity
          }</td><td>${formatCurrency(m.price)}</td><td>${formatCurrency(
            m.quantity * m.price
          )}</td></tr>`
      )
      .join("");

    w.document.write(
      `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Phiếu</title><style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:8px}th{background:#f0f0f0}.total{text-align:right;margin-top:20px;font-weight:bold}</style></head><body><h1 style="text-align:center">PHIẾU SỬA CHỮA</h1><p><strong>KH:</strong> ${
        order.customerName
      } | <strong>SĐT:</strong> ${
        order.customerPhone
      }</p><p><strong>Thiết bị:</strong> ${
        order.deviceName
      } | <strong>Ngày:</strong> ${new Date(
        order.creationDate
      ).toLocaleDateString("vi-VN")}</p><p><strong>Sự cố:</strong> ${
        order.issueDescription
      }</p><table><thead><tr><th>Vật liệu</th><th>SL</th><th>Giá</th><th>Thành tiền</th></tr></thead><tbody>${mats}</tbody></table><div class="total"><p>Tiền công: ${formatCurrency(
        order.laborCost
      )}</p><p style="border-top:2px solid;padding-top:10px">Tổng: ${formatCurrency(
        order.total
      )}</p></div></body></html>`
    );
    w.document.close();
    setTimeout(() => w.print(), 250);
  };

  const paginatedOrders = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const sorted = [...(pinRepairOrders || [])].sort(
      (a, b) =>
        new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
    );

    // Debug: Log d? ki?m tra d? li?u
    console.log("?? [PinRepairManager] Total orders:", sorted.length);
    if (sorted.length > 0) {
      console.log("?? [PinRepairManager] First order:", sorted[0]);
      console.log("?? [PinRepairManager] deviceName:", sorted[0].deviceName);
      console.log(
        "?? [PinRepairManager] issueDescription:",
        sorted[0].issueDescription
      );
    }

    return sorted.slice(start, start + itemsPerPage);
  }, [pinRepairOrders, currentPage]);

  const totalPages = Math.ceil((pinRepairOrders?.length || 0) / itemsPerPage);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6">
      <div className="w-full max-w-[98%] mx-auto">
        {/* Header with title and action button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
            Quản lý Sửa chữa
          </h1>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg transition-all"
          >
            <PlusIcon className="w-5 h-5" /> Phiếu mới
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 border-b-2 border-slate-300 dark:border-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Mã phiếu
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Khách hàng
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Thiết bị & Sự cố
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Ngày
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Trạng thái
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    Tổng tiền
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    Đặt cọc
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    Thao tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-12 text-center text-slate-500"
                    >
                      Chưa có phiếu sửa chữa
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      <td className="px-4 py-3 text-sm font-mono">{o.id}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-medium">{o.customerName}</div>
                        <div className="text-xs text-slate-500">
                          {o.customerPhone}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {o.deviceName && (
                          <div className="font-medium mb-1">
                            🛠 {o.deviceName}
                          </div>
                        )}
                        <div className="text-slate-600 dark:text-slate-400 line-clamp-2 text-xs">
                          {o.issueDescription || "Chưa có mô tả"}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(o.creationDate).toLocaleDateString("vi-VN")}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            o.status === "Đã sửa xong" || o.status === "Trả máy"
                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                              : o.status === "Đang sửa"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                              : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                          }`}
                        >
                          {o.status === "Đã sửa xong" || o.status === "Trả máy"
                            ? "✅ Xong"
                            : o.status === "Đang sửa"
                            ? "🔧 Đang sửa"
                            : "⏳ Chờ"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(o.total)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">
                        {o.depositAmount && o.depositAmount > 0 ? (
                          <span className="font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(o.depositAmount)}
                          </span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => handleOpenModal(o)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                            title="Sửa"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={() => handlePrint(o)}
                            className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                            title="In"
                          >
                            <PrinterIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteOrder(o.id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                            title="Xóa"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              itemsPerPage={itemsPerPage}
              totalItems={pinRepairOrders?.length || 0}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      <RepairOrderModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveOrder}
        initialOrder={selectedOrder}
        currentUser={currentUser}
      />
    </div>
  );
};

export default PinRepairManager;
