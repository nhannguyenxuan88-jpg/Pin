import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
// FIX: Correctly import types for PinCorp, including PinMaterial, and remove MotoCare-specific types.
import type {
  PinMaterial,
  Supplier,
  PaymentSource,
  CashTransaction,
  User,
} from "../types";
import {
  PlusIcon,
  ArchiveBoxIcon,
  TrashIcon,
  XMarkIcon,
  CameraIcon,
  ExclamationTriangleIcon,
  ArrowUturnLeftIcon,
  MinusIcon,
  ShoppingCartIcon,
} from "./common/Icons";
import { usePinContext } from "../contexts/PinContext";

const formatCurrency = (amount: number) => {
  if (isNaN(amount)) return "0";
  return new Intl.NumberFormat("vi-VN").format(amount);
};

// --- Camera Capture Modal ---
const CameraCaptureModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch((err) => {
          console.error("Error accessing camera: ", err);
          alert(
            "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập trong trình duyệt."
          );
          onClose();
        });
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, onClose]);

  const handleCaptureClick = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const context = canvas.getContext("2d");
      context?.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            onCapture(blob);
          }
        },
        "image/jpeg",
        0.95
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 z-[60] flex flex-col justify-center items-center p-4">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full max-w-lg rounded-lg mb-4 border-2 border-slate-600"
      ></video>
      <div className="flex space-x-4">
        <button
          onClick={onClose}
          className="bg-slate-200 text-slate-800 font-semibold py-2 px-6 rounded-lg hover:bg-slate-300"
        >
          Hủy
        </button>
        <button
          onClick={handleCaptureClick}
          className="bg-sky-600 text-white font-semibold py-2 px-6 rounded-lg hover:bg-sky-700"
        >
          Chụp ảnh
        </button>
      </div>
    </div>
  );
};

// FIX: Renamed PartModal to MaterialModal and adapted it to use PinMaterial type.
const MaterialModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSaveAndAddToCart: (
    material: PinMaterial,
    quantity: number,
    purchasePrice: number
  ) => void;
  materials: PinMaterial[];
}> = ({ isOpen, onClose, onSaveAndAddToCart, materials }) => {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    sku: "",
    unit: "cái",
    quantity: 1,
    purchasePrice: 0,
  });

  const allUnits = useMemo(
    () =>
      Array.from(new Set(materials.map((m) => m.unit).filter(Boolean))).sort(),
    [materials]
  );
  const [localUnits, setLocalUnits] = useState<string[]>(allUnits);
  const [isAddingNewUnit, setIsAddingNewUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState("");

  const [image, setImage] = useState<{
    file: File | Blob;
    previewUrl: string;
  } | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: "",
        description: "",
        sku: "",
        unit: "cái",
        quantity: 1,
        purchasePrice: 0,
      });
      setLocalUnits(allUnits);
      setIsAddingNewUnit(false);
      setNewUnitName("");
      setImage(null);
      setIsCameraOpen(false);
    }
  }, [isOpen, allUnits]);

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;

    if (name === "purchasePrice" || name === "quantity") {
      setFormData((prev) => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleAddNewUnit = () => {
    const trimmedUnit = newUnitName.trim();
    if (trimmedUnit && !localUnits.includes(trimmedUnit)) {
      const newUnitList = [...localUnits, trimmedUnit].sort();
      setLocalUnits(newUnitList);
      setFormData((prev) => ({ ...prev, unit: trimmedUnit }));
    }
    setNewUnitName("");
    setIsAddingNewUnit(false);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setImage({
        file: file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleCapture = (blob: Blob) => {
    const file = new File([blob], `capture-${Date.now()}.jpg`, {
      type: "image/jpeg",
    });
    setImage({
      file: file,
      previewUrl: URL.createObjectURL(file),
    });
    setIsCameraOpen(false);
  };

  const handleSave = () => {
    const existingMaterial = materials.find(
      (m) =>
        m.name.toLowerCase() === formData.name.toLowerCase() ||
        (formData.sku && m.sku.toLowerCase() === formData.sku.toLowerCase())
    );
    const newMaterialData: PinMaterial = {
      id: existingMaterial?.id || `M${Date.now()}`,
      name: formData.name,
      sku: formData.sku || `SKU${Date.now()}`,
      description: formData.description,
      unit: formData.unit,
      purchasePrice: formData.purchasePrice,
      stock: existingMaterial?.stock || 0,
    };
    onSaveAndAddToCart(
      newMaterialData,
      formData.quantity,
      formData.purchasePrice
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCapture}
      />
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[95vh] flex flex-col">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
            Thêm vật tư mới
          </h2>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="p-4 bg-sky-50 dark:bg-sky-900/50 border border-sky-200 dark:border-sky-800 rounded-lg flex items-start space-x-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            {image ? (
              <div className="relative w-24 h-24 flex-shrink-0">
                <img
                  src={image.previewUrl}
                  alt="Preview"
                  className="w-full h-full object-cover rounded-lg shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md hover:bg-red-600 transition-transform hover:scale-110"
                >
                  <XMarkIcon className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="w-24 h-24 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                <ArchiveBoxIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
              </div>
            )}
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300 mb-2">
                Tải lên ảnh vật tư để dễ nhận biết và quản lý hơn.
              </p>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  <PlusIcon className="w-4 h-4" /> Tải lên
                </button>
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="flex items-center gap-2 text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-1.5 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  <CameraIcon className="w-4 h-4" /> Chụp ảnh
                </button>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Tên vật tư <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleFormChange}
              className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Mô tả
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleFormChange}
              rows={2}
              className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
            ></textarea>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Đơn vị
            </label>
            <div className="flex items-center space-x-2 mt-1">
              <select
                name="unit"
                value={formData.unit}
                onChange={handleFormChange}
                className="w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
              >
                <option value="">-- Chọn hoặc tạo mới --</option>
                {localUnits.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setIsAddingNewUnit((prev) => !prev)}
                className="p-2.5 bg-slate-100 dark:bg-slate-700 rounded-md hover:bg-slate-200 dark:hover:bg-slate-600 flex-shrink-0"
                title="Thêm đơn vị mới"
              >
                <PlusIcon className="w-5 h-5 text-slate-700 dark:text-slate-200" />
              </button>
            </div>
            {isAddingNewUnit && (
              <div className="mt-2 flex items-center space-x-2">
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="Tên đơn vị mới..."
                  className="block w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddNewUnit();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddNewUnit}
                  className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700"
                >
                  Lưu
                </button>
              </div>
            )}
          </div>
          <div className="border-t pt-4 dark:border-slate-700">
            <p className="font-semibold text-slate-700 dark:text-slate-200">
              Thông tin nhập kho:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Số lượng:
                </label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Giá nhập:
                </label>
                <input
                  type="number"
                  name="purchasePrice"
                  value={formData.purchasePrice}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 flex justify-end">
          <button
            onClick={handleSave}
            className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600"
          >
            Lưu và Thêm vào phiếu
          </button>
        </div>
      </div>
    </div>
  );
};

const SupplierModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplier: Supplier) => void;
  initialName?: string;
}> = ({ isOpen, onClose, onSave, initialName = "" }) => {
  const [formData, setFormData] = useState({
    name: initialName,
    phone: "",
    address: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: initialName || "",
        phone: "",
        address: "",
        email: "",
        notes: "",
      });
    }
  }, [isOpen, initialName]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    const newSupplier: Supplier = {
      id: `SUP${Date.now()}`,
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      address: formData.address.trim(),
      email: formData.email.trim(),
      notes: formData.notes?.trim() || "",
    };
    onSave(newSupplier);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h2 className="text-lg sm:text-xl font-bold text-slate-800 dark:text-slate-100">
            Thêm nhà cung cấp
          </h2>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-300" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              📦 Tên nhà cung cấp (*)
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Nhập tên nhà cung cấp..."
              className="w-full p-3 border rounded-lg mt-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              📞 Số điện thoại
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="0xxx xxx xxx"
              className="w-full p-3 border rounded-lg mt-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              📍 Địa chỉ
            </label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              placeholder="Nhập địa chỉ nhà cung cấp..."
              rows={2}
              className="w-full p-3 border rounded-lg mt-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              ✉️ Email
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@example.com"
              className="w-full p-3 border rounded-lg mt-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              📝 Ghi chú
            </label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              placeholder="Thêm ghi chú về nhà cung cấp..."
              rows={3}
              className="w-full p-3 border rounded-lg mt-1 bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 resize-none"
            />
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800 border-t dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!formData.name.trim()}
            className="bg-orange-500 text-white font-bold py-2 px-6 rounded-lg hover:bg-orange-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            💾 Lưu nhà cung cấp
          </button>
        </div>
      </div>
    </div>
  );
};

// Mobile Floating Cart Button
const FloatingCartButton: React.FC<{
  count: number;
  total: number;
  onClick: () => void;
}> = ({ count, total, onClick }) => (
  <div className="lg:hidden fixed bottom-4 right-4 z-30">
    <button
      onClick={onClick}
      className="bg-orange-500 text-white font-bold rounded-lg shadow-lg flex items-center py-3 px-5 hover:bg-orange-600 transition-transform hover:scale-105"
    >
      <ShoppingCartIcon className="w-6 h-6" />
      <span className="bg-white text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold ml-3">
        {count}
      </span>
      <span className="ml-3 text-lg">{formatCurrency(total)}</span>
    </button>
  </div>
);

type ReceiptRowItem = {
  internalId: string;
  materialId: string | null;
  materialName: string;
  sku: string;
  unit: string;
  customUnit?: string;
  quantity: number;
  purchasePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  isNew: boolean;
};

// --- Main Component ---
// FIX: Corrected the props interface to match what's passed from PinCorpApp.tsx
interface PinGoodsReceiptProps {
  materials: PinMaterial[];
  setMaterials: React.Dispatch<React.SetStateAction<PinMaterial[]>>;
  suppliers: Supplier[];
  setSuppliers: React.Dispatch<React.SetStateAction<Supplier[]>>;
  paymentSources: PaymentSource[];
  setPaymentSources: React.Dispatch<React.SetStateAction<PaymentSource[]>>;
  currentUser: User;
}

const generateUniqueId = (prefix: string = "") =>
  `${prefix}${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const PinGoodsReceipt: React.FC<PinGoodsReceiptProps> = ({
  materials,
  setMaterials,
  suppliers,
  setSuppliers,
  paymentSources,
  setPaymentSources,
  currentUser,
}) => {
  const { addCashTransaction } = usePinContext();
  const [receiptItems, setReceiptItems] = useState<ReceiptRowItem[]>([]);
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);

  // Persist modal states
  useEffect(() => {
    const saved = localStorage.getItem("pinGoodsReceipt_modals");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.isMaterialModalOpen) setIsMaterialModalOpen(true);
        if (parsed.isSupplierModalOpen) setIsSupplierModalOpen(true);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    const anyOpen = isMaterialModalOpen || isSupplierModalOpen;
    if (anyOpen) {
      localStorage.setItem(
        "pinGoodsReceipt_modals",
        JSON.stringify({
          isMaterialModalOpen,
          isSupplierModalOpen,
        })
      );
    } else {
      localStorage.removeItem("pinGoodsReceipt_modals");
    }
  }, [isMaterialModalOpen, isSupplierModalOpen]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(
    null
  );
  const [paymentStatus, setPaymentStatus] = useState<"full" | "partial" | null>(
    null
  );
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [partialPaymentAmount, setPartialPaymentAmount] = useState<number>(0);
  const [isSupplierListOpen, setIsSupplierListOpen] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const supplierInputRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        supplierInputRef.current &&
        !supplierInputRef.current.contains(event.target as Node)
      ) {
        setIsSupplierListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Prevent auto-reload when there are unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "Bạn có thay đổi chưa được lưu. Bạn có chắc muốn rời khỏi trang?";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Track unsaved changes
  useEffect(() => {
    if (
      receiptItems.length > 0 ||
      supplierSearch ||
      paymentStatus ||
      paymentMethod
    ) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  }, [receiptItems, supplierSearch, paymentStatus, paymentMethod]);

  useEffect(() => {
    if (receiptItems.length === 0) {
      addRow();
    }
  }, [receiptItems]);

  const cartTotal = useMemo(
    () =>
      receiptItems.reduce(
        (sum, item) => sum + item.purchasePrice * item.quantity,
        0
      ),
    [receiptItems]
  );

  const addRow = () => {
    setReceiptItems((prev) => [
      ...prev,
      {
        internalId: generateUniqueId("row-"),
        materialId: null,
        materialName: "",
        sku: "",
        unit: "cái",
        customUnit: "",
        quantity: 1,
        purchasePrice: 0,
        retailPrice: 0,
        wholesalePrice: 0,
        isNew: true,
      },
    ]);
  };

  const updateRow = (
    internalId: string,
    field: keyof ReceiptRowItem,
    value: any
  ) => {
    setReceiptItems((prev) =>
      prev.map((item) =>
        item.internalId === internalId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeRow = (internalId: string) => {
    setReceiptItems((prev) =>
      prev.filter((item) => item.internalId !== internalId)
    );
  };

  const handleSelectMaterial = (internalId: string, material: PinMaterial) => {
    setReceiptItems((prev) =>
      prev.map((item) =>
        item.internalId === internalId
          ? {
              ...item,
              materialId: material.id,
              materialName: material.name,
              sku: material.sku,
              unit: material.unit,
              purchasePrice: material.purchasePrice,
              retailPrice: material.purchasePrice * 1.2, // Default 20% markup
              wholesalePrice: material.purchasePrice * 1.1, // Default 10% markup
              isNew: false,
            }
          : item
      )
    );
  };

  const handleSaveAndAddToCart = (
    materialData: PinMaterial,
    quantity: number,
    purchasePrice: number
  ) => {
    const isNewMaterial = !materials.some((p) => p.id === materialData.id);
    const finalMaterialData = { ...materialData, purchasePrice: purchasePrice };

    if (isNewMaterial) {
      setMaterials((prev) => [finalMaterialData, ...prev]);
    } else {
      setMaterials((prev) =>
        prev.map((p) => (p.id === finalMaterialData.id ? finalMaterialData : p))
      );
    }

    setReceiptItems((prev) => [
      ...prev,
      {
        internalId: generateUniqueId("row-"),
        materialId: finalMaterialData.id,
        materialName: finalMaterialData.name,
        sku: finalMaterialData.sku,
        unit: finalMaterialData.unit,
        customUnit: "",
        quantity: quantity,
        purchasePrice: purchasePrice,
        retailPrice: purchasePrice * 1.2, // Default 20% markup
        wholesalePrice: purchasePrice * 1.1, // Default 10% markup
        isNew: false,
      },
    ]);
  };

  const handleFinalizeReceipt = () => {
    if (
      receiptItems.length === 0 ||
      !paymentStatus ||
      !paymentMethod ||
      !selectedSupplierId
    ) {
      alert(
        "Vui lòng chọn nhà cung cấp, thêm sản phẩm và chọn hình thức thanh toán."
      );
      return;
    }

    if (paymentStatus === "partial" && partialPaymentAmount <= 0) {
      alert("Vui lòng nhập số tiền thanh toán cho thanh toán một phần.");
      return;
    }

    if (paymentStatus === "partial" && partialPaymentAmount >= cartTotal) {
      alert("Số tiền thanh toán một phần phải nhỏ hơn tổng số tiền.");
      return;
    }

    const newMaterials: PinMaterial[] = [];
    const updatedMaterials: { [id: string]: PinMaterial } = {};

    receiptItems.forEach((item) => {
      if (!item.materialName || item.quantity <= 0) return;

      if (item.materialId && !item.isNew) {
        const originalMaterial = materials.find(
          (m) => m.id === item.materialId
        )!;
        updatedMaterials[item.materialId] = {
          ...originalMaterial,
          stock: originalMaterial.stock + item.quantity,
          purchasePrice: item.purchasePrice,
          retailPrice: item.retailPrice,
          wholesalePrice: item.wholesalePrice,
        };
      } else {
        newMaterials.push({
          id: generateUniqueId("M-"),
          name: item.materialName,
          sku: item.sku || generateUniqueId("SKU"),
          unit: item.customUnit || item.unit,
          purchasePrice: item.purchasePrice,
          retailPrice: item.retailPrice,
          wholesalePrice: item.wholesalePrice,
          stock: item.quantity,
          supplier: suppliers.find((s) => s.id === selectedSupplierId)?.name,
        });
      }
    });

    setMaterials((prev) => {
      const base = prev.filter((m) => !updatedMaterials[m.id]);
      return [...base, ...Object.values(updatedMaterials), ...newMaterials];
    });

    const selectedSupplier = suppliers.find((s) => s.id === selectedSupplierId);

    if (paymentStatus === "full") {
      const newCashTransaction: CashTransaction = {
        id: generateUniqueId("CT-"),
        type: "expense",
        date: new Date().toISOString(),
        amount: cartTotal,
        contact: {
          id: selectedSupplier?.id || "",
          name: selectedSupplier?.name || supplierSearch,
        },
        notes: `Thanh toán đầy đủ phiếu nhập kho vật tư #app:pincorp`,
        paymentSourceId: paymentMethod!,
        branchId: "main",
      };
      addCashTransaction(newCashTransaction);

      setPaymentSources((prevSources) =>
        prevSources.map((ps) => {
          if (ps.id === paymentMethod) {
            const newBalance = { ...ps.balance };
            newBalance["main"] = (newBalance["main"] || 0) - cartTotal;
            return { ...ps, balance: newBalance };
          }
          return ps;
        })
      );
    } else if (paymentStatus === "partial" && partialPaymentAmount > 0) {
      const newCashTransaction: CashTransaction = {
        id: generateUniqueId("CT-"),
        type: "expense",
        date: new Date().toISOString(),
        amount: partialPaymentAmount,
        contact: {
          id: selectedSupplier?.id || "",
          name: selectedSupplier?.name || supplierSearch,
        },
        notes: `Thanh toán một phần phiếu nhập kho vật tư (${partialPaymentAmount.toLocaleString()}/${cartTotal.toLocaleString()}) #app:pincorp`,
        paymentSourceId: paymentMethod!,
        branchId: "main",
      };
      addCashTransaction(newCashTransaction);

      setPaymentSources((prevSources) =>
        prevSources.map((ps) => {
          if (ps.id === paymentMethod) {
            const newBalance = { ...ps.balance };
            newBalance["main"] =
              (newBalance["main"] || 0) - partialPaymentAmount;
            return { ...ps, balance: newBalance };
          }
          return ps;
        })
      );
    }

    // Clear unsaved changes flag
    setHasUnsavedChanges(false);

    alert("Nhập kho thành công!");
    navigate("/materials");
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-700 h-full flex flex-col">
      <MaterialModal
        isOpen={isMaterialModalOpen}
        onClose={() => setIsMaterialModalOpen(false)}
        onSaveAndAddToCart={handleSaveAndAddToCart}
        materials={materials}
      />
      <SupplierModal
        isOpen={isSupplierModalOpen}
        onClose={() => setIsSupplierModalOpen(false)}
        onSave={(s) => {
          setSuppliers((prev) => [s, ...prev]);
          setSelectedSupplierId(s.id);
          setSupplierSearch(s.name);
        }}
        initialName={supplierSearch}
      />

      <div className="flex justify-between items-center mb-4 flex-shrink-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">
          Tạo Phiếu Nhập Kho
        </h1>
        <button
          onClick={() => navigate("/materials")}
          className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg"
        >
          <ArrowUturnLeftIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-4 flex-shrink-0">
        <div ref={supplierInputRef} className="max-w-md">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Nhà cung cấp (*)
          </label>
          <div className="relative flex">
            <input
              type="text"
              placeholder="Tìm hoặc thêm nhà cung cấp..."
              value={supplierSearch}
              onChange={(e) => {
                setSupplierSearch(e.target.value);
                setSelectedSupplierId(null);
                setIsSupplierListOpen(true);
              }}
              onFocus={() => setIsSupplierListOpen(true)}
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-l-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setIsSupplierModalOpen(true)}
              className="px-3 py-2 border-t border-b border-r border-slate-300 dark:border-slate-600 rounded-r-md bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 transition-colors"
              title="Thêm nhà cung cấp mới"
            >
              <PlusIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
            {isSupplierListOpen && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                {suppliers.length > 0 ? (
                  suppliers
                    .filter(
                      (s) =>
                        !supplierSearch ||
                        s.name
                          .toLowerCase()
                          .includes(supplierSearch.toLowerCase())
                    )
                    .map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setSelectedSupplierId(s.id);
                          setSupplierSearch(s.name);
                          setIsSupplierListOpen(false);
                        }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0"
                      >
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          {s.name}
                        </div>
                        {s.phone && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {s.phone}
                          </div>
                        )}
                      </div>
                    ))
                ) : (
                  <div className="p-2 text-slate-500 dark:text-slate-400 text-sm">
                    Chưa có nhà cung cấp nào
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2 flex-shrink-0 text-slate-800 dark:text-slate-200">
        Chi tiết vật tư
      </h2>

      <div className="flex-1 overflow-y-auto -mx-4 sm:-mx-6 px-4 sm:px-6 py-2 space-y-3">
        {receiptItems.map((item, index) => (
          <ReceiptItemRow
            key={item.internalId}
            item={item}
            onUpdate={updateRow}
            onRemove={removeRow}
            onSelectMaterial={handleSelectMaterial}
            materials={materials}
            isLastRow={index === receiptItems.length - 1}
            onAddNewRow={addRow}
          />
        ))}
      </div>

      <button
        onClick={addRow}
        className="mt-4 text-sm text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1 hover:text-sky-800 dark:hover:text-sky-300 flex-shrink-0"
      >
        <PlusIcon className="w-4 h-4" /> Thêm dòng
      </button>

      <div className="mt-auto pt-4 border-t dark:border-slate-700 flex-shrink-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between font-bold text-xl mb-4">
              <span>Tổng cộng</span>
              <span className="text-sky-600 dark:text-sky-400">
                {formatCurrency(cartTotal)}
              </span>
            </div>
          </div>
          <div>
            <p className="font-semibold mb-2">Thanh toán (*):</p>
            <div className="flex gap-4 text-sm">
              <label>
                <input
                  type="radio"
                  name="paymentStatus"
                  checked={paymentStatus === "full"}
                  onChange={() => setPaymentStatus("full")}
                  className="mr-1"
                />{" "}
                Thanh toán đủ
              </label>
              <label>
                <input
                  type="radio"
                  name="paymentStatus"
                  checked={paymentStatus === "partial"}
                  onChange={() => setPaymentStatus("partial")}
                  className="mr-1"
                />{" "}
                Nợ NCC
              </label>
            </div>
            <div className="flex gap-4 text-sm mt-2">
              <label>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "cash"}
                  onChange={() => setPaymentMethod("cash")}
                  className="mr-1"
                />{" "}
                Tiền mặt
              </label>
              <label>
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === "bank"}
                  onChange={() => setPaymentMethod("bank")}
                  className="mr-1"
                />{" "}
                Chuyển khoản
              </label>
            </div>
            {paymentStatus === "partial" && (
              <div className="mt-3">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số tiền thanh toán:
                </label>
                <input
                  type="number"
                  value={partialPaymentAmount || ""}
                  onChange={(e) =>
                    setPartialPaymentAmount(Number(e.target.value))
                  }
                  placeholder="Nhập số tiền thanh toán..."
                  className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Còn nợ:{" "}
                  {formatCurrency(cartTotal - (partialPaymentAmount || 0))}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={handleFinalizeReceipt}
            disabled={
              receiptItems.length === 0 ||
              !paymentStatus ||
              !paymentMethod ||
              !selectedSupplierId
            }
            className="w-full md:w-auto bg-green-600 text-white font-bold py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-green-300"
          >
            Hoàn tất Nhập kho
          </button>
        </div>
      </div>
    </div>
  );
};

const ReceiptItemRow: React.FC<{
  item: ReceiptRowItem;
  onUpdate: (
    internalId: string,
    field: keyof ReceiptRowItem,
    value: any
  ) => void;
  onRemove: (internalId: string) => void;
  onSelectMaterial: (internalId: string, material: PinMaterial) => void;
  materials: PinMaterial[];
  isLastRow: boolean;
  onAddNewRow: () => void;
}> = ({
  item,
  onUpdate,
  onRemove,
  onSelectMaterial,
  materials,
  isLastRow,
  onAddNewRow,
}) => {
  const [isListOpen, setIsListOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  const filteredMaterials = useMemo(() => {
    if (!item.materialName) return [];
    return materials.filter((m) =>
      m.name.toLowerCase().includes(item.materialName.toLowerCase())
    );
  }, [item.materialName, materials]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rowRef.current && !rowRef.current.contains(event.target as Node)) {
        setIsListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isLastRow) {
      onAddNewRow();
    }
  };

  return (
    <div
      ref={rowRef}
      className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-slate-200 dark:border-slate-600"
    >
      <div className="grid grid-cols-12 gap-x-2 gap-y-2 items-start">
        {/* Material Name / Search */}
        <div className="col-span-12 md:col-span-3 relative">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Tên sản phẩm (*)
          </label>
          <div className="relative mt-1 flex">
            <input
              type="text"
              placeholder="Tìm hoặc thêm sản phẩm..."
              value={item.materialName}
              onChange={(e) => {
                onUpdate(item.internalId, "materialName", e.target.value);
                onUpdate(item.internalId, "isNew", true);
                onUpdate(item.internalId, "materialId", null);
                setIsListOpen(true);
              }}
              onFocus={() => {
                console.log(
                  "Focus on material input, materials count:",
                  materials.length
                );
                setIsListOpen(true);
              }}
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-l-md bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
            />
            <button
              type="button"
              onClick={() => {
                // Trigger add new material modal here
                onUpdate(item.internalId, "isNew", true);
                setIsListOpen(false);
                // This would open the material creation modal
              }}
              className="p-2 border-t border-b border-r border-slate-300 dark:border-slate-600 rounded-r-md bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500"
              title="Thêm sản phẩm mới"
            >
              <PlusIcon className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>
          </div>
          {isListOpen && (
            <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md shadow-lg max-h-48 overflow-y-auto">
              {materials.length > 0 ? (
                materials
                  .filter(
                    (m) =>
                      !item.materialName ||
                      item.materialName.trim() === "" ||
                      m.name
                        .toLowerCase()
                        .includes(item.materialName.toLowerCase()) ||
                      m.sku
                        .toLowerCase()
                        .includes(item.materialName.toLowerCase())
                  )
                  .map((m) => (
                    <div
                      key={m.id}
                      onClick={() => {
                        onSelectMaterial(item.internalId, m);
                        setIsListOpen(false);
                      }}
                      className="p-3 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-b-0 transition-colors"
                    >
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {m.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {m.sku}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="p-3 text-slate-500 dark:text-slate-400 text-sm">
                  Chưa có sản phẩm nào
                </div>
              )}
            </div>
          )}
        </div>
        {/* Unit - Thu nhỏ lại */}
        <div className="col-span-6 md:col-span-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Đơn vị
          </label>
          <input
            type="text"
            value={item.customUnit || item.unit}
            onChange={(e) =>
              onUpdate(item.internalId, "customUnit", e.target.value)
            }
            onKeyDown={handleKeyDown}
            placeholder="cái"
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
          />
        </div>
        {/* Quantity */}
        <div className="col-span-6 md:col-span-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            SL
          </label>
          <input
            type="number"
            value={item.quantity}
            onChange={(e) =>
              onUpdate(item.internalId, "quantity", Number(e.target.value))
            }
            onKeyDown={handleKeyDown}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        {/* Purchase Price */}
        <div className="col-span-6 md:col-span-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Giá nhập (*)
          </label>
          <input
            type="number"
            value={item.purchasePrice || ""}
            onChange={(e) =>
              onUpdate(item.internalId, "purchasePrice", Number(e.target.value))
            }
            onKeyDown={handleKeyDown}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        {/* Retail Price - Giá bán lẻ */}
        <div className="col-span-6 md:col-span-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Giá bán lẻ
          </label>
          <input
            type="number"
            value={item.retailPrice || ""}
            onChange={(e) =>
              onUpdate(item.internalId, "retailPrice", Number(e.target.value))
            }
            onKeyDown={handleKeyDown}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        {/* Wholesale Price - Giá bán sỉ */}
        <div className="col-span-6 md:col-span-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Giá bán sỉ
          </label>
          <input
            type="number"
            value={item.wholesalePrice || ""}
            onChange={(e) =>
              onUpdate(
                item.internalId,
                "wholesalePrice",
                Number(e.target.value)
              )
            }
            onKeyDown={handleKeyDown}
            className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mt-1 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
          />
        </div>
        {/* Total & Remove button */}
        <div className="col-span-12 md:col-span-1 flex items-end justify-between">
          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Thành tiền
            </label>
            <p className="font-semibold text-slate-800 dark:text-slate-100 mt-1">
              {formatCurrency(item.quantity * item.retailPrice)}
            </p>
          </div>
          <button
            onClick={() => onRemove(item.internalId)}
            className="text-red-500 hover:text-red-700 p-2"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinGoodsReceipt;
