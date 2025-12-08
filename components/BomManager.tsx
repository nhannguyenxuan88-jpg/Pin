import React, { useState, useMemo, useEffect, useRef } from "react";
import type {
  PinBOM,
  PinMaterial,
  PinBomMaterial,
  ProductionOrder,
  User,
  AdditionalCost,
} from "../types";
import { usePinContext } from "../contexts/PinContext";
import { generateProductSKU } from "../lib/sku";
import {
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  XMarkIcon,
  ClipboardDocumentCheckIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
} from "./common/Icons";
import Pagination from "./common/Pagination";
import ProductionManager from "./ProductionManager";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

// --- Production Order Modal (Moved from ProductionManager) ---
const ProductionOrderModal: React.FC<{
  order: ProductionOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: ProductionOrder, bom: PinBOM) => void;
  boms: PinBOM[];
  materials: PinMaterial[];
  currentUser: User;
}> = ({ order, isOpen, onClose, onSave, boms, materials, currentUser }) => {
  const [selectedBomId, setSelectedBomId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [newCost, setNewCost] = useState({ description: "", amount: 0 });
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (isOpen) {
      setSelectedBomId(order?.bomId || null);
      setQuantity(order?.quantityProduced || 1);
      setAdditionalCosts(order?.additionalCosts || []);
      setNotes(order?.notes || "");
    }
  }, [order, isOpen]);

  const selectedBom = useMemo(
    () => boms.find((b) => b.id === selectedBomId),
    [selectedBomId, boms]
  );

  const requiredMaterials = useMemo(() => {
    if (!selectedBom) return [];
    return selectedBom.materials.map((bomMat) => {
      const materialInfo = materials.find((m) => m.id === bomMat.materialId);
      const required = bomMat.quantity * quantity;
      return {
        materialId: bomMat.materialId,
        name: materialInfo?.name || "Không tìm thấy",
        required,
        stock: materialInfo?.stock || 0,
        isSufficient: materialInfo ? materialInfo.stock >= required : false,
        purchasePrice: materialInfo?.purchasePrice || 0,
      };
    });
  }, [selectedBom, quantity, materials]);

  const isStockSufficient = useMemo(
    () => requiredMaterials.every((m) => m.isSufficient),
    [requiredMaterials]
  );
  const materialsCost = useMemo(
    () => requiredMaterials.reduce((sum, mat) => sum + mat.purchasePrice * mat.required, 0),
    [requiredMaterials]
  );
  const additionalCostsTotal = useMemo(
    () => additionalCosts.reduce((sum, cost) => sum + cost.amount, 0),
    [additionalCosts]
  );
  const totalCost = materialsCost + additionalCostsTotal;

  const handleAddCost = () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để thực hiện thao tác.");
      return;
    }
    if (newCost.description.trim() && newCost.amount > 0) {
      setAdditionalCosts((prev) => [...prev, newCost]);
      setNewCost({ description: "", amount: 0 });
    }
  };

  const handleRemoveCost = (index: number) => {
    setAdditionalCosts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để thực hiện thao tác.");
      return;
    }
    if (!selectedBom) {
      alert("Vui lòng chọn một công thức sản phẩm.");
      return;
    }
    const newOrder: ProductionOrder = {
      id: order?.id || crypto.randomUUID(),
      creationDate: order?.creationDate || new Date().toISOString().split("T")[0],
      bomId: selectedBomId!,
      productName: selectedBom.productName,
      quantityProduced: quantity,
      status: "Đang chờ",
      materialsCost,
      additionalCosts,
      totalCost,
      notes,
      userName: currentUser.name,
    };
    onSave(newOrder, selectedBom);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {order ? "Chỉnh sửa Lệnh sản xuất" : "Tạo Lệnh sản xuất"}
          </h3>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Công thức (BOM) (*)
              </label>
              <select
                value={selectedBomId || ""}
                onChange={(e) => setSelectedBomId(e.target.value)}
                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="">-- Chọn công thức --</option>
                {boms.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.productName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Số lượng sản xuất (*)
              </label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                min="1"
                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          {selectedBom && (
            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                  Kiểm tra Nguyên vật liệu:
                </h4>
                {!isStockSufficient && (
                  <p className="text-sm text-red-500 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5" /> Một hoặc nhiều nguyên vật liệu
                    không đủ trong kho.
                  </p>
                )}
                <div className="max-h-48 overflow-y-auto mt-2 space-y-1 pr-2">
                  {requiredMaterials.map((m) => (
                    <div
                      key={m.materialId}
                      className={`text-sm flex justify-between items-center p-2 rounded ${
                        !m.isSufficient
                          ? "bg-red-100 dark:bg-red-900/50"
                          : "bg-slate-50 dark:bg-slate-800"
                      }`}
                    >
                      <span className="font-medium text-slate-700 dark:text-slate-200">
                        {m.name}
                      </span>
                      <span
                        className={`${
                          !m.isSufficient
                            ? "text-red-600 dark:text-red-300 font-bold"
                            : "text-slate-600 dark:text-slate-400"
                        }`}
                      >
                        Cần: {m.required} / Tồn: {m.stock}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-slate-800 dark:text-slate-100">
                  Chi phí phát sinh:
                </h4>
                <div className="space-y-2 mt-2">
                  {additionalCosts.map((cost, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 text-slate-700 dark:text-slate-200">
                        {cost.description}
                      </span>
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        {formatCurrency(cost.amount)}
                      </span>
                      <button onClick={() => handleRemoveCost(index)} className="text-red-500">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 pt-2 border-t dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Diễn giải"
                      value={newCost.description}
                      onChange={(e) =>
                        setNewCost((c) => ({
                          ...c,
                          description: e.target.value,
                        }))
                      }
                      className="flex-1 p-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      placeholder="Số tiền"
                      value={newCost.amount || ""}
                      onChange={(e) =>
                        setNewCost((c) => ({
                          ...c,
                          amount: Number(e.target.value),
                        }))
                      }
                      className="w-28 p-1 border border-slate-300 dark:border-slate-600 rounded-md text-sm bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                    <button
                      onClick={handleAddCost}
                      className="bg-sky-600 text-white text-sm px-3 py-1 rounded"
                    >
                      Thêm
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-700 mt-auto">
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tiền NVL</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {formatCurrency(materialsCost)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Chi phí khác</p>
              <p className="font-semibold text-slate-800 dark:text-slate-100">
                {formatCurrency(additionalCostsTotal)}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tổng giá vốn</p>
              <p className="font-bold text-xl text-sky-600 dark:text-sky-400">
                {formatCurrency(totalCost)}
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg"
            >
              Hủy
            </button>
            <button
              onClick={handleSave}
              disabled={!isStockSufficient || !selectedBom}
              className="bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg disabled:bg-sky-300 disabled:cursor-not-allowed"
            >
              Lưu Lệnh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- BOM Modal ---
const BomModal: React.FC<{
  bom: PinBOM | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (bom: PinBOM) => void;
  onSaveAndContinue: (bom: PinBOM) => void;
  materials: PinMaterial[];
  existingBoms: PinBOM[];
}> = ({ bom, isOpen, onClose, onSave, onSaveAndContinue, materials, existingBoms }) => {
  const { currentUser } = usePinContext();
  const [formData, setFormData] = useState<Partial<PinBOM>>({});
  const [materialSearch, setMaterialSearch] = useState("");
  const [isMaterialListOpen, setIsMaterialListOpen] = useState(false);
  const materialInputRef = useRef<HTMLDivElement>(null);
  // Track if user manually edited SKU to avoid overriding auto generation
  const [skuEdited, setSkuEdited] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData(bom ? { ...bom } : { materials: [] });
      setSkuEdited(!!bom?.productSku);
    }
  }, [bom, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (materialInputRef.current && !materialInputRef.current.contains(event.target as Node)) {
        setIsMaterialListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-generate SKU from product name if user hasn't edited SKU manually
  // Format: SP-ddmmyyyy-001, SP-ddmmyyyy-002, etc.
  useEffect(() => {
    if (!skuEdited && formData.productName) {
      // Get existing products from BOMs to calculate sequence number
      const existingProducts = existingBoms.map((b: PinBOM) => ({
        sku: b.productSku,
      }));
      setFormData((prev) => ({
        ...prev,
        productSku: generateProductSKU(existingProducts),
      }));
    }
  }, [formData.productName, skuEdited, existingBoms]);

  const filteredMaterials = useMemo(() => {
    if (!materialSearch) return [];
    const lowercasedTerm = materialSearch.toLowerCase();
    // Exclude materials already in the BOM
    const currentMaterialIds = formData.materials?.map((m) => m.materialId) || [];
    return materials
      .filter(
        (m) =>
          !currentMaterialIds.includes(m.id) &&
          (m.name.toLowerCase().includes(lowercasedTerm) ||
            m.sku.toLowerCase().includes(lowercasedTerm))
      )
      .slice(0, 10);
  }, [materials, materialSearch, formData.materials]);

  const handleAddMaterial = (material: PinMaterial) => {
    const newBomMaterial: PinBomMaterial = {
      materialId: material.id,
      quantity: 1,
    };
    setFormData((prev) => ({
      ...prev,
      materials: [...(prev.materials || []), newBomMaterial],
    }));
    setMaterialSearch("");
    setIsMaterialListOpen(false);
  };

  const handleUpdateMaterialQty = (materialId: string, quantity: number) => {
    setFormData((prev) => ({
      ...prev,
      materials: (prev.materials || []).map((m) =>
        m.materialId === materialId ? { ...m, quantity } : m
      ),
    }));
  };

  const handleRemoveMaterial = (materialId: string) => {
    setFormData((prev) => ({
      ...prev,
      materials: (prev.materials || []).filter((m) => m.materialId !== materialId),
    }));
  };

  const estimatedCost = useMemo(() => {
    return (formData.materials || []).reduce((sum, bomMaterial) => {
      const materialInfo = materials.find((m) => m.id === bomMaterial.materialId);
      return sum + (materialInfo ? materialInfo.purchasePrice * bomMaterial.quantity : 0);
    }, 0);
  }, [formData.materials, materials]);

  const buildFinalBom = (): PinBOM | null => {
    if (!formData.productName || !formData.materials || formData.materials.length === 0) {
      alert("Vui lòng nhập Tên sản phẩm và thêm ít nhất một nguyên vật liệu.");
      return null;
    }
    return {
      id: formData.id || crypto.randomUUID(),
      productName: formData.productName,
      productSku: formData.productSku || "",
      materials: formData.materials,
      notes: formData.notes,
    };
  };

  const handleSaveAndClose = () => {
    const finalBom = buildFinalBom();
    if (finalBom) {
      onSave(finalBom);
    }
  };

  const handleSaveAndContinueClick = () => {
    const finalBom = buildFinalBom();
    if (finalBom) {
      onSaveAndContinue(finalBom);
      // Reset form HOÀN TOÀN để tạo BOM mới (bao gồm cả id)
      setFormData({ materials: [] });
      setSkuEdited(false); // Reset SKU edited flag
      setMaterialSearch(""); // Clear search
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
            {bom ? "Chỉnh sửa Công thức" : "Tạo Công thức mới"}
          </h3>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tên thành phẩm (*)
              </label>
              <input
                type="text"
                value={formData.productName || ""}
                onChange={(e) => setFormData((d) => ({ ...d, productName: e.target.value }))}
                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                Mã SKU thành phẩm
              </label>
              <input
                type="text"
                value={formData.productSku || ""}
                maxLength={6}
                onChange={(e) => {
                  const sanitized = e.target.value
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 6);
                  setSkuEdited(true);
                  setFormData((d) => ({ ...d, productSku: sanitized }));
                }}
                className="mt-1 w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Tự sinh theo tên; chỉ cho phép A–Z và số; tối đa 6 ký tự.
              </p>
            </div>
          </div>
          <div ref={materialInputRef}>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Thêm Nguyên vật liệu
            </label>
            <div className="relative mt-1">
              <input
                type="text"
                placeholder="Tìm kiếm nguyên vật liệu..."
                value={materialSearch}
                onChange={(e) => {
                  setMaterialSearch(e.target.value);
                  setIsMaterialListOpen(true);
                }}
                onFocus={() => setIsMaterialListOpen(true)}
                className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              {isMaterialListOpen && filteredMaterials.length > 0 && (
                <div className="absolute z-10 w-full bg-white dark:bg-slate-700 border dark:border-slate-600 rounded-md mt-1 shadow-lg max-h-48 overflow-y-auto">
                  {filteredMaterials.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleAddMaterial(m)}
                      className="p-2 hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-800 dark:text-slate-200"
                    >
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {m.sku} - Tồn: {m.stock}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2 -mr-2">
            {formData.materials?.map((bomMaterial) => {
              const materialInfo = materials.find((m) => m.id === bomMaterial.materialId);
              if (!materialInfo) return null;
              return (
                <div
                  key={bomMaterial.materialId}
                  className="flex items-center gap-4 p-2 bg-slate-50 dark:bg-slate-800 rounded-md"
                >
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {materialInfo.name}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {formatCurrency(materialInfo.purchasePrice)} / {materialInfo.unit}
                    </p>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={bomMaterial.quantity}
                    onChange={(e) =>
                      handleUpdateMaterialQty(bomMaterial.materialId, parseFloat(e.target.value))
                    }
                    className="w-20 p-1 border border-slate-300 dark:border-slate-600 rounded-md text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                  <p className="w-24 text-right font-semibold text-slate-800 dark:text-slate-200">
                    {formatCurrency(materialInfo.purchasePrice * bomMaterial.quantity)}
                  </p>
                  <button
                    onClick={() => handleRemoveMaterial(bomMaterial.materialId)}
                    className="text-red-500"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t dark:border-slate-700 mt-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Giá vốn ước tính:
            </span>
            <span className="text-xl font-bold text-sky-600 dark:text-sky-400">
              {formatCurrency(estimatedCost)}
            </span>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg"
            >
              Hủy
            </button>
            {!bom && (
              <button
                type="button"
                onClick={handleSaveAndContinueClick}
                disabled={!currentUser}
                title={!currentUser ? "Bạn phải đăng nhập để lưu" : undefined}
                className={`bg-sky-600/80 text-white font-semibold py-2 px-4 rounded-lg ${
                  !currentUser ? "opacity-50 cursor-not-allowed" : "hover:bg-sky-700/80"
                }`}
              >
                Lưu & Tiếp tục
              </button>
            )}
            <button
              onClick={handleSaveAndClose}
              disabled={!currentUser}
              title={!currentUser ? "Bạn phải đăng nhập để lưu" : undefined}
              className={`bg-sky-600 text-white font-semibold py-2 px-4 rounded-lg ${
                !currentUser ? "opacity-50 cursor-not-allowed" : "hover:bg-sky-700"
              }`}
            >
              {bom ? "Lưu thay đổi" : "Lưu Công thức"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
interface BomManagerProps {
  boms: PinBOM[];
  setBoms: React.Dispatch<React.SetStateAction<PinBOM[]>>;
  materials: PinMaterial[];
  currentUser: User;
  orders: ProductionOrder[];
  addOrder: (order: ProductionOrder, bom: PinBOM) => void;
  updateOrder: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  completeOrder?: (orderId: string) => Promise<void>;
}

const ITEMS_PER_PAGE = 10;

const BomManager: React.FC<BomManagerProps> = (props) => {
  const { boms, materials } = props;
  // Use context upsert/delete to persist BOMs to DB
  const { upsertPinBOM, deletePinBOM } = usePinContext();

  // States for BOM management
  const [activeTab, setActiveTab] = useState<"boms" | "history">("boms");
  const [isBomModalOpen, setIsBomModalOpen] = useState(false);
  const [editingBom, setEditingBom] = useState<PinBOM | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);

  const calculateBomCost = (bom: PinBOM): number => {
    return bom.materials.reduce((sum, bomMat) => {
      const matInfo = materials.find((m) => m.id === bomMat.materialId);
      return sum + (matInfo ? matInfo.purchasePrice * bomMat.quantity : 0);
    }, 0);
  };

  const saveData = (bomData: PinBOM) => {
    // Persist to DB; context will optimistically update global state
    upsertPinBOM(bomData);
  };

  const handleSaveAndCloseBom = (bomData: PinBOM) => {
    saveData(bomData);
    setIsBomModalOpen(false);
  };

  const handleSaveAndContinueBom = (bomData: PinBOM) => {
    saveData(bomData);
    // Do not close modal, modal will reset its own form
  };

  const handleDeleteBom = (bomId: string) => {
    if (window.confirm("Bạn có chắc chắn muốn xóa công thức này?")) {
      deletePinBOM(bomId);
    }
  };

  const filteredBoms = useMemo(
    () =>
      boms.filter(
        (b) =>
          b.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          b.productSku.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [boms, searchTerm]
  );

  const paginatedBoms = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBoms.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBoms, currentPage]);

  const totalPages = Math.ceil(filteredBoms.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      <BomModal
        isOpen={isBomModalOpen}
        onClose={() => {
          setIsBomModalOpen(false);
          setEditingBom(null);
        }}
        onSave={handleSaveAndCloseBom}
        onSaveAndContinue={handleSaveAndContinueBom}
        bom={editingBom}
        materials={materials}
        existingBoms={boms}
      />
      <ProductionOrderModal
        isOpen={isProductionModalOpen}
        onClose={() => setIsProductionModalOpen(false)}
        onSave={props.addOrder}
        order={null}
        boms={props.boms}
        materials={props.materials}
        currentUser={props.currentUser}
      />

      <div className="flex items-center justify-between gap-2 md:gap-4 flex-shrink-0 sticky top-0 z-20 pb-3 md:pb-4 bg-gradient-to-b from-slate-100 via-slate-100 to-transparent dark:from-slate-900 dark:via-slate-900 backdrop-blur-md animate-fadeIn">
        <div className="flex gap-1 md:gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab("boms")}
            className={`px-3 md:px-6 py-2 md:py-3 font-semibold rounded-lg md:rounded-xl transition-all duration-200 transform text-xs md:text-base whitespace-nowrap ${
              activeTab === "boms"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/50"
            }`}
          >
            <BeakerIcon className="w-4 h-4 md:w-5 md:h-5 inline-block mr-1 md:mr-2" />{" "}
            <span className="hidden md:inline">Công thức (BOM)</span>
            <span className="md:hidden">BOM</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-3 md:px-6 py-2 md:py-3 font-semibold rounded-lg md:rounded-xl transition-all duration-200 transform text-xs md:text-base whitespace-nowrap ${
              activeTab === "history"
                ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-700/50"
            }`}
          >
            <ClipboardDocumentCheckIcon className="w-4 h-4 md:w-5 md:h-5 inline-block mr-1 md:mr-2" />{" "}
            <span className="hidden md:inline">Lịch sử Sản xuất</span>
            <span className="md:hidden">Lịch sử</span>
          </button>
        </div>
      </div>

      {activeTab === "boms" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-800 p-3 md:p-6 rounded-xl md:rounded-2xl shadow-xl border-2 border-slate-200 dark:border-slate-700 animate-fadeIn">
            <div className="flex flex-col gap-3 md:gap-4">
              <input
                type="text"
                placeholder="🔍 Tìm theo tên hoặc SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 md:px-5 py-3 md:py-4 border-2 border-slate-300 dark:border-slate-600 rounded-lg md:rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm md:text-base font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all duration-200 shadow-sm"
              />
              <div className="flex items-center gap-2 md:gap-3">
                <button
                  onClick={() => setIsProductionModalOpen(true)}
                  disabled={!props.currentUser}
                  title={!props.currentUser ? "Bạn phải đăng nhập để tạo lệnh" : undefined}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-3 font-semibold rounded-lg md:rounded-xl shadow-lg transition-all duration-200 transform text-xs md:text-base ${
                    props.currentUser
                      ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-green-500/30 hover:shadow-xl hover:-translate-y-0.5"
                      : "bg-green-300 text-white/80 cursor-not-allowed opacity-50"
                  }`}
                >
                  <BeakerIcon className="w-4 h-4 md:w-5 md:h-5" />{" "}
                  <span className="hidden md:inline">Tạo Lệnh</span>
                  <span className="md:hidden">Lệnh</span>
                </button>
                <button
                  onClick={() => {
                    setEditingBom(null);
                    setIsBomModalOpen(true);
                  }}
                  disabled={!props.currentUser}
                  title={!props.currentUser ? "Bạn phải đăng nhập để thêm công thức" : undefined}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-1 md:gap-2 px-3 md:px-6 py-2 md:py-3 font-semibold rounded-lg md:rounded-xl shadow-lg transition-all duration-200 transform text-xs md:text-base ${
                    props.currentUser
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-blue-500/30 hover:shadow-xl hover:-translate-y-0.5"
                      : "bg-blue-300 text-white/80 cursor-not-allowed opacity-50"
                  }`}
                >
                  <PlusIcon /> <span className="hidden md:inline">Thêm Công thức</span>
                  <span className="md:hidden">+BOM</span>
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl md:rounded-2xl shadow-xl border-2 border-slate-200 dark:border-slate-700 overflow-hidden animate-fadeIn">
            {/* Mobile Card View */}
            <div className="md:hidden space-y-2 p-2">
              {paginatedBoms.map((bom) => (
                <div
                  key={bom.id}
                  className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                        {bom.productName}
                      </h3>
                      <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                        {bom.productSku}
                      </span>
                    </div>
                    <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-medium">
                      {bom.materials.length} NVL
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-sky-600 dark:text-sky-400">
                      {formatCurrency(calculateBomCost(bom))}
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setEditingBom(bom);
                          setIsBomModalOpen(true);
                        }}
                        disabled={!props.currentUser}
                        className={`p-1.5 rounded ${props.currentUser ? "text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-900/30" : "text-slate-400 cursor-not-allowed"}`}
                      >
                        <PencilSquareIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBom(bom.id)}
                        disabled={!props.currentUser}
                        className={`p-1.5 rounded ${props.currentUser ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" : "text-red-300 cursor-not-allowed"}`}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {filteredBoms.length === 0 && (
                <div className="text-center p-6 text-slate-500 dark:text-slate-400 text-sm">
                  Chưa có công thức nào.
                </div>
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-max">
                <thead className="border-b-2 dark:border-slate-600 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 dark:from-slate-700 dark:via-slate-800 dark:to-slate-700">
                  <tr>
                    <th className="p-5 font-bold text-slate-800 dark:text-slate-200">
                      Tên Thành phẩm
                    </th>
                    <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">SKU</th>
                    <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Số NVL</th>
                    <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-right">
                      Giá vốn ước tính
                    </th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBoms.map((bom) => (
                    <tr
                      key={bom.id}
                      className="border-t dark:border-slate-700 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 dark:hover:from-slate-700/50 dark:hover:to-slate-600/50 transition-all duration-200"
                    >
                      <td className="p-3 font-medium text-slate-800 dark:text-slate-200">
                        {bom.productName}
                      </td>
                      <td className="p-3 text-slate-600 dark:text-slate-300">{bom.productSku}</td>
                      <td className="p-3 text-slate-700 dark:text-slate-300">
                        {bom.materials.length}
                      </td>
                      <td className="p-3 text-right font-semibold text-sky-600 dark:text-sky-400">
                        {formatCurrency(calculateBomCost(bom))}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingBom(bom);
                              setIsBomModalOpen(true);
                            }}
                            disabled={!props.currentUser}
                            title={
                              !props.currentUser ? "Bạn phải đăng nhập để chỉnh sửa" : undefined
                            }
                            className={`${
                              props.currentUser
                                ? "p-1 text-sky-600 dark:text-sky-400"
                                : "p-1 text-slate-400 cursor-not-allowed"
                            }`}
                          >
                            <PencilSquareIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteBom(bom.id)}
                            disabled={!props.currentUser}
                            title={!props.currentUser ? "Bạn phải đăng nhập để xóa" : undefined}
                            className={`${
                              props.currentUser
                                ? "p-1 text-red-500"
                                : "p-1 text-red-300 cursor-not-allowed"
                            }`}
                          >
                            <TrashIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBoms.length === 0 && (
                <div className="text-center p-8 text-slate-500 dark:text-slate-400">
                  Chưa có công thức nào được tạo.
                </div>
              )}
            </div>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              itemsPerPage={ITEMS_PER_PAGE}
              totalItems={filteredBoms.length}
            />
          )}
        </div>
      )}

      {activeTab === "history" && (
        <ProductionManager
          orders={props.orders}
          updateOrder={props.updateOrder}
          completeOrder={props.completeOrder}
          currentUser={props.currentUser}
          materials={props.materials}
          boms={props.boms}
        />
      )}
    </div>
  );
};

export default BomManager;
