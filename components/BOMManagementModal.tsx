import React, { useState, useMemo, useEffect } from "react";
import type { PinBOM, PinMaterial, ProductionOrder, User, AdditionalCost } from "../types";
import {
  PlusIcon,
  TrashIcon,
  PencilSquareIcon,
  XMarkIcon,
  BeakerIcon,
  ExclamationTriangleIcon,
} from "./common/Icons";
import Pagination from "./common/Pagination";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const generateUuid = (): string => {
  // Prefer native UUID
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }

  // RFC4122 v4 using getRandomValues
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    // Set version (4) and variant (10xx)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Last resort (still UUID-shaped)
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const a = rnd() + rnd();
  const b = rnd();
  const c = ("4" + rnd().slice(1)).slice(0, 4) + rnd().slice(4, 8);
  const d = ((8 + Math.floor(Math.random() * 4)).toString(16) + rnd().slice(1)).slice(0, 4) + rnd().slice(4, 8);
  const e = rnd() + rnd() + rnd();
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-${b.slice(0, 4)}-${d.slice(0, 4)}-${e.slice(0, 12)}`;
};

interface BOMManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  boms: PinBOM[];
  materials: PinMaterial[];
  currentUser?: User | null;
  onSaveBOM: (bom: PinBOM) => void;
  onDeleteBOM: (bomId: string) => void;
  onCreateProductionOrder?: (order: ProductionOrder, bom: PinBOM) => void;
  mode?: "list-and-create" | "create-only" | "create-order-from-bom" | "edit-bom"; // list-and-create: hiển thị danh sách để chọn và tạo order, create-only: chỉ tạo BOM, create-order-from-bom: tạo order từ BOM được chọn, edit-bom: chỉnh sửa BOM
  selectedBomId?: string; // ID của BOM được chọn để tạo order hoặc chỉnh sửa
  onToast?: (message: string, type: "success" | "error" | "warning" | "info") => void;
}

const ITEMS_PER_PAGE = 10;

const BOMManagementModal: React.FC<BOMManagementModalProps> = ({
  isOpen,
  onClose,
  boms,
  materials,
  currentUser,
  onSaveBOM,
  onDeleteBOM,
  onCreateProductionOrder,
  mode = "list-and-create",
  selectedBomId,
  onToast,
}) => {
  const showToast = (message: string, type: "success" | "error" | "warning" | "info") => {
    onToast?.(message, type);
  };
  const [selectedBOM, setSelectedBOM] = useState<PinBOM | null>(null);
  const [isCreating, setIsCreating] = useState(mode === "create-only" || mode === "edit-bom");
  const [isCreatingOrder, setIsCreatingOrder] = useState(mode === "create-order-from-bom");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [materialSearchTerms, setMaterialSearchTerms] = useState<{ [key: number]: string }>({});
  const [openMaterialDropdown, setOpenMaterialDropdown] = useState<number | null>(null);

  // Production Order creation state
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [additionalCosts, setAdditionalCosts] = useState<AdditionalCost[]>([]);
  const [newCost, setNewCost] = useState({ description: "", amount: 0 });
  const [orderNotes, setOrderNotes] = useState("");

  // BOM editing state
  const [bomForm, setBomForm] = useState({
    id: "",
    productName: "",
    productSku: "",
    notes: "",
    materials: [] as { materialId: string; quantity: number }[],
  });

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ open: false, title: "", message: "", onConfirm: () => {} });

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ open: true, title, message, onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, title: "", message: "", onConfirm: () => {} });
  };

  const filteredBOMs = useMemo(() => {
    if (!searchTerm.trim()) return boms;
    const term = searchTerm.toLowerCase();
    return boms.filter(
      (bom) =>
        bom.productName.toLowerCase().includes(term) || bom.notes?.toLowerCase().includes(term)
    );
  }, [boms, searchTerm]);

  const paginatedBOMs = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredBOMs.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredBOMs, currentPage]);

  const totalPages = Math.ceil(filteredBOMs.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Tự động mở form tạo BOM mới khi mode là create-only
  useEffect(() => {
    if (isOpen && mode === "create-only" && !isCreating) {
      handleCreateBOM();
    }
  }, [isOpen, mode]);

  // Tự động chọn BOM và mở form tạo order khi có selectedBomId
  useEffect(() => {
    if (isOpen && selectedBomId && mode === "create-order-from-bom") {
      const bom = boms.find((b) => b.id === selectedBomId);
      if (bom) {
        setSelectedBOM(bom);
        setIsCreatingOrder(true);
      }
    }
  }, [isOpen, selectedBomId, mode, boms]);

  // Tự động chọn BOM để edit khi có selectedBomId và mode là edit-bom
  useEffect(() => {
    if (isOpen && selectedBomId && mode === "edit-bom") {
      const bom = boms.find((b) => b.id === selectedBomId);
      if (bom) {
        handleEditBOM(bom);
      }
    }
  }, [isOpen, selectedBomId, mode, boms]);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Chỉ đóng nếu click hoàn toàn bên ngoài container
      if (openMaterialDropdown !== null && !target.closest(".material-search-container")) {
        setOpenMaterialDropdown(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMaterialDropdown]);

  const handleCreateBOM = () => {
    setIsCreating(true);
    setBomForm({
      id: "", // Để trống, DB sẽ tự tạo ID mới khi insert
      productName: "",
      productSku: "",
      notes: "",
      materials: [],
    });
  };

  const handleEditBOM = (bom: PinBOM) => {
    setIsCreating(true);
    setBomForm({
      id: bom.id,
      productName: bom.productName,
      productSku: bom.productSku,
      notes: bom.notes || "",
      materials: bom.materials.map((m) => ({
        materialId: m.materialId,
        quantity: m.quantity,
      })),
    });
  };

  const handleSaveBOM = () => {
    if (!currentUser) {
      showToast("Vui lòng đăng nhập để thực hiện thao tác.", "warning");
      return;
    }

    if (!bomForm.productName.trim()) {
      showToast("Vui lòng nhập tên sản phẩm.", "warning");
      return;
    }

    if (bomForm.materials.length === 0) {
      showToast("Vui lòng thêm ít nhất một nguyên vật liệu.", "warning");
      return;
    }

    // Tự động tạo SKU nếu người dùng không nhập
    let productSku = bomForm.productSku.trim();
    if (!productSku) {
      // Tạo SKU từ tên sản phẩm: BOM-TENSANPHAM-TIMESTAMP
      const nameSlug = bomForm.productName
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Bỏ dấu tiếng Việt
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") // Chỉ giữ chữ và số
        .substring(0, 10); // Giới hạn 10 ký tự
      const timestamp = Date.now().toString(36).toUpperCase(); // Timestamp ngắn gọn
      productSku = `BOM-${nameSlug}-${timestamp}`;
    }

    // Nếu đang edit (có id hợp lệ), giữ nguyên id
    // Nếu tạo mới (id rỗng), tạo một ID tạm để Backend nhận biết và tạo ID mới từ DB
    const bomToSave: PinBOM = {
      id: bomForm.id || "new-bom-temp-id", // ID tạm, Backend sẽ phát hiện và tạo ID mới
      productName: bomForm.productName.trim(),
      productSku: productSku,
      notes: bomForm.notes.trim(),
      materials: bomForm.materials.filter((m) => m.materialId && m.quantity > 0),
      created_at: new Date().toISOString(),
    };

    onSaveBOM(bomToSave);

    // Reset form sau khi lưu thành công
    setBomForm({
      id: "",
      productName: "",
      productSku: "",
      notes: "",
      materials: [],
    });

    // Đóng form tạo/chỉnh sửa sau khi lưu
    setIsCreating(false);
  };

  const handleAddMaterial = () => {
    setBomForm((prev) => ({
      ...prev,
      materials: [...prev.materials, { materialId: "", quantity: 1 }],
    }));
  };

  const handleUpdateMaterial = (
    index: number,
    field: "materialId" | "quantity",
    value: string | number
  ) => {
    setBomForm((prev) => ({
      ...prev,
      materials: prev.materials.map((mat, i) => (i === index ? { ...mat, [field]: value } : mat)),
    }));
  };

  const handleRemoveMaterial = (index: number) => {
    setBomForm((prev) => ({
      ...prev,
      materials: prev.materials.filter((_, i) => i !== index),
    }));
  };

  const calculateBOMCost = (bom: PinBOM, quantity: number = 1) => {
    return bom.materials.reduce((sum, bomMat) => {
      const material = materials.find((m) => m.id === bomMat.materialId);
      return sum + (material?.purchasePrice || 0) * bomMat.quantity * quantity;
    }, 0);
  };

  const handleCreateOrder = () => {
    if (!selectedBOM || !currentUser || !onCreateProductionOrder) {
      showToast("Vui lòng chọn BOM và đăng nhập để tạo lệnh sản xuất.", "warning");
      return;
    }

    const materialsCost = calculateBOMCost(selectedBOM, orderQuantity);
    const additionalCostsTotal = additionalCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const totalCost = materialsCost + additionalCostsTotal;

    const order: ProductionOrder = {
      id: generateUuid(),
      creationDate: new Date().toISOString(),
      bomId: selectedBOM.id,
      productName: selectedBOM.productName,
      quantityProduced: orderQuantity,
      status: "Đang sản xuất",
      materialsCost,
      additionalCosts,
      totalCost,
      notes: orderNotes.trim() || undefined,
      userName: currentUser.name,
      created_at: new Date().toISOString(),
    };

    onCreateProductionOrder(order, selectedBOM);

    // Reset form
    setIsCreatingOrder(false);
    setSelectedBOM(null);
    setOrderQuantity(1);
    setAdditionalCosts([]);
    setNewCost({ description: "", amount: 0 });
    setOrderNotes("");

    // Đóng modal sau khi tạo lệnh thành công
    onClose();
  };

  const handleAddCost = () => {
    if (!currentUser) {
      showToast("Vui lòng đăng nhập để thực hiện thao tác.", "warning");
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

  const requiredMaterials = useMemo(() => {
    if (!selectedBOM) return [];
    return selectedBOM.materials.map((bomMat) => {
      const material = materials.find((m) => m.id === bomMat.materialId);
      const required = bomMat.quantity * orderQuantity;
      return {
        materialId: bomMat.materialId,
        name: material?.name || "Không tìm thấy",
        required,
        stock: material?.stock || 0,
        isSufficient: material ? material.stock >= required : false,
        purchasePrice: material?.purchasePrice || 0,
      };
    });
  }, [selectedBOM, orderQuantity, materials]);

  const isStockSufficient = useMemo(
    () => requiredMaterials.every((m) => m.isSufficient),
    [requiredMaterials]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center space-x-2">
            <BeakerIcon className="w-5 h-5 text-slate-700 dark:text-slate-300" />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Quản lý Công thức Sản xuất (BOM)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* BOM List - Chỉ hiển thị khi mode là list-and-create */}
          {mode === "list-and-create" && !isCreatingOrder && (
            <div className="w-1/2 border-r dark:border-slate-700 flex flex-col">
              <div className="p-4 border-b dark:border-slate-700">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                    Danh sách BOM ({filteredBOMs.length})
                  </h3>
                  <button
                    onClick={handleCreateBOM}
                    disabled={!currentUser}
                    className="flex items-center space-x-2 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                    title={!currentUser ? "Vui lòng đăng nhập để tạo BOM" : "Tạo BOM mới"}
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Tạo BOM</span>
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Tìm kiếm BOM..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-3">
                  {paginatedBOMs.map((bom) => (
                    <div
                      key={bom.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedBOM?.id === bom.id
                          ? "border-slate-300 bg-slate-50 dark:bg-slate-800"
                          : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                      }`}
                      onClick={() => setSelectedBOM(bom)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <h4 className="font-medium text-slate-800 dark:text-slate-100">
                            {bom.productName}
                          </h4>
                          {bom.notes && (
                            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                              {bom.notes}
                            </p>
                          )}
                        </div>
                        <div className="flex space-x-1 ml-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditBOM(bom);
                            }}
                            className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded"
                            title="Chỉnh sửa BOM"
                          >
                            <PencilSquareIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              showConfirmDialog(
                                "Xác nhận xóa",
                                `Bạn có chắc chắn muốn xóa BOM "${bom.productName}"?`,
                                () => {
                                  closeConfirmDialog();
                                  onDeleteBOM(bom.id);
                                }
                              );
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                            title="Xóa BOM"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm">
                        <span className="text-slate-600 dark:text-slate-400">
                          {bom.materials.length} nguyên liệu
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-100">
                          {formatCurrency(calculateBOMCost(bom))}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                      itemsPerPage={ITEMS_PER_PAGE}
                      totalItems={filteredBOMs.length}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Right Panel */}
          <div
            className={`${mode === "create-only" || mode === "create-order-from-bom" || mode === "edit-bom" ? "w-full" : "w-1/2"} flex flex-col`}
          >
            {isCreating ? (
              /* BOM Creation/Edit Form */
              <div className="flex-1 overflow-y-auto p-6">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  {bomForm.id ? "Chỉnh sửa BOM" : "Tạo BOM mới"}
                </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Tên sản phẩm (*)
                    </label>
                    <input
                      type="text"
                      value={bomForm.productName}
                      onChange={(e) =>
                        setBomForm((prev) => ({
                          ...prev,
                          productName: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="Nhập tên sản phẩm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Mô tả
                    </label>
                    <textarea
                      value={bomForm.notes}
                      onChange={(e) =>
                        setBomForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="Mô tả sản phẩm (tùy chọn)"
                      rows={3}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        Nguyên vật liệu (*)
                      </label>
                      <button
                        onClick={handleAddMaterial}
                        className="flex items-center space-x-1 bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-sm"
                      >
                        <PlusIcon className="w-3 h-3" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-60 overflow-visible">
                      {bomForm.materials.map((mat, index) => {
                        const selectedMaterial = materials.find((m) => m.id === mat.materialId);
                        const searchValue = materialSearchTerms[index] || "";
                        // Filter materials - nếu có searchValue thì filter, nếu không thì show tất cả
                        const filteredMaterials = searchValue.trim()
                          ? materials.filter(
                              (m) =>
                                m.name.toLowerCase().includes(searchValue.toLowerCase()) ||
                                m.sku?.toLowerCase().includes(searchValue.toLowerCase())
                            )
                          : materials;

                        return (
                          <div key={index} className="flex space-x-2 items-center">
                            <div className="flex-1 relative material-search-container">
                              <input
                                type="text"
                                placeholder="Tìm nguyên liệu..."
                                value={selectedMaterial ? selectedMaterial.name : searchValue}
                                onChange={(e) => {
                                  setMaterialSearchTerms((prev) => ({
                                    ...prev,
                                    [index]: e.target.value,
                                  }));
                                  setOpenMaterialDropdown(index);
                                  // Clear selection if typing
                                  if (mat.materialId) {
                                    handleUpdateMaterial(index, "materialId", "");
                                  }
                                }}
                                onFocus={() => setOpenMaterialDropdown(index)}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                              />
                              {selectedMaterial && (
                                <button
                                  onClick={() => {
                                    handleUpdateMaterial(index, "materialId", "");
                                    setMaterialSearchTerms((prev) => ({ ...prev, [index]: "" }));
                                  }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                  <XMarkIcon className="w-4 h-4" />
                                </button>
                              )}
                              {openMaterialDropdown === index && (
                                <div
                                  className="absolute left-0 top-full z-[9999] w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto"
                                  style={{ minWidth: "100%" }}
                                >
                                  {filteredMaterials.length > 0 ? (
                                    filteredMaterials.slice(0, 10).map((material) => (
                                      <div
                                        key={material.id}
                                        onClick={() => {
                                          handleUpdateMaterial(index, "materialId", material.id);
                                          setMaterialSearchTerms((prev) => ({
                                            ...prev,
                                            [index]: "",
                                          }));
                                          setOpenMaterialDropdown(null);
                                        }}
                                        className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer border-b border-slate-100 dark:border-slate-700 last:border-0"
                                      >
                                        <div className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                                          {material.name}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          SKU: {material.sku || "N/A"} • Tồn: {material.stock}{" "}
                                          {material.unit}
                                        </div>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-3 py-4 text-center text-slate-500 text-sm">
                                      Không tìm thấy nguyên liệu
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>

                            <input
                              type="number"
                              value={mat.quantity}
                              onChange={(e) =>
                                handleUpdateMaterial(
                                  index,
                                  "quantity",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-20 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                              placeholder="SL"
                              min="0"
                              step="0.1"
                            />

                            <button
                              onClick={() => handleRemoveMaterial(index)}
                              className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6 pt-4 border-t dark:border-slate-700">
                  <button
                    onClick={() => {
                      setIsCreating(false);
                      setBomForm({
                        id: "",
                        productName: "",
                        productSku: "",
                        notes: "",
                        materials: [],
                      });
                    }}
                    className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleSaveBOM}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg"
                  >
                    Lưu BOM
                  </button>
                </div>
              </div>
            ) : isCreatingOrder && selectedBOM ? (
              /* Production Order Creation Form */
              <div className="flex-1 overflow-y-auto p-5">
                <div className="mb-4">
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                    Tạo lệnh sản xuất - {selectedBOM.productName}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Nhập số lượng và kiểm tra nguyên liệu
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Số lượng sản xuất (*)
                    </label>
                    <input
                      type="number"
                      value={orderQuantity}
                      onChange={(e) => setOrderQuantity(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
                      min="1"
                    />
                  </div>

                  {/* Material Requirements */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">
                      Yêu cầu nguyên vật liệu
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                      {requiredMaterials.map((req) => (
                        <div
                          key={req.materialId}
                          className="flex justify-between items-center text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-slate-700 dark:text-slate-300 truncate block">
                              {req.name}
                            </span>
                            <span
                              className={`text-xs ${
                                req.isSufficient
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              Tồn: {req.stock} / Cần: {req.required}
                            </span>
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 text-xs ml-2">
                            {formatCurrency(req.purchasePrice * req.required)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {!isStockSufficient && (
                      <div className="flex items-center space-x-1.5 mt-2 text-red-600 dark:text-red-400 text-xs">
                        <ExclamationTriangleIcon className="w-4 h-4 flex-shrink-0" />
                        <span>Không đủ nguyên vật liệu để sản xuất</span>
                      </div>
                    )}
                  </div>

                  {/* Additional Costs */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Chi phí phát sinh
                      </h4>
                      <button
                        onClick={handleAddCost}
                        disabled={!newCost.description.trim() || newCost.amount <= 0}
                        className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-2 py-1 rounded text-xs transition-colors"
                      >
                        <PlusIcon className="w-3 h-3" />
                        <span>Thêm</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <input
                        type="text"
                        value={newCost.description}
                        onChange={(e) =>
                          setNewCost((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        className="col-span-2 px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs"
                        placeholder="Mô tả chi phí"
                      />
                      <input
                        type="number"
                        value={newCost.amount}
                        onChange={(e) =>
                          setNewCost((prev) => ({
                            ...prev,
                            amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs"
                        placeholder="Số tiền"
                        min="0"
                      />
                    </div>

                    {additionalCosts.length > 0 && (
                      <div className="space-y-1.5">
                        {additionalCosts.map((cost, idx) => (
                          <div
                            key={idx}
                            className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 rounded px-2 py-1.5 text-xs"
                          >
                            <span className="text-slate-700 dark:text-slate-300 truncate flex-1">
                              {cost.description}
                            </span>
                            <div className="flex items-center space-x-2 ml-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-300">
                                {formatCurrency(cost.amount)}
                              </span>
                              <button
                                onClick={() => handleRemoveCost(idx)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400"
                              >
                                <TrashIcon className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Ghi chú
                    </label>
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="Ghi chú cho lệnh sản xuất (tùy chọn)"
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm resize-none"
                    />
                  </div>

                  {/* Total Cost */}
                  <div className="border-t dark:border-slate-700 pt-3">
                    <div className="flex justify-between items-center mb-1.5 text-xs text-slate-600 dark:text-slate-400">
                      <span>Chi phí nguyên vật liệu:</span>
                      <span className="font-semibold">
                        {formatCurrency(calculateBOMCost(selectedBOM, orderQuantity))}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold text-slate-800 dark:text-slate-100">
                      <span>Tổng chi phí:</span>
                      <span className="text-blue-600 dark:text-blue-400 text-base">
                        {formatCurrency(
                          calculateBOMCost(selectedBOM, orderQuantity) +
                            additionalCosts.reduce((sum, c) => sum + c.amount, 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end space-x-2 mt-4 pt-4 border-t dark:border-slate-700">
                  <button
                    onClick={() => {
                      setIsCreatingOrder(false);
                      setSelectedBOM(null);
                      setOrderQuantity(1);
                      setAdditionalCosts([]);
                      setOrderNotes("");
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleCreateOrder}
                    disabled={!isStockSufficient}
                    className="px-4 py-2 text-sm font-medium bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white rounded-lg transition-all disabled:cursor-not-allowed"
                  >
                    Tạo lệnh sản xuất
                  </button>
                </div>
              </div>
            ) : selectedBOM ? (
              /* BOM Details */
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {selectedBOM.productName}
                    </h3>
                    {selectedBOM.notes && (
                      <p className="text-slate-600 dark:text-slate-400 mt-1">{selectedBOM.notes}</p>
                    )}
                  </div>
                  <button
                    onClick={() => setIsCreatingOrder(true)}
                    disabled={!currentUser}
                    className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-2 rounded-lg text-sm"
                    title={
                      !currentUser
                        ? "Vui lòng đăng nhập để tạo lệnh sản xuất"
                        : "Tạo lệnh sản xuất từ BOM này"
                    }
                  >
                    <PlusIcon className="w-4 h-4" />
                    <span>Tạo lệnh SX</span>
                  </button>
                </div>

                <div>
                  <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-3">
                    Nguyên vật liệu ({selectedBOM.materials.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedBOM.materials.map((bomMat) => {
                      const material = materials.find((m) => m.id === bomMat.materialId);
                      return (
                        <div
                          key={bomMat.materialId}
                          className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {material?.name || "N/A"}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Tồn kho: {material?.stock || 0} {material?.unit || "đơn vị"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {bomMat.quantity} {material?.unit || "đơn vị"}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              {formatCurrency((material?.purchasePrice || 0) * bomMat.quantity)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-slate-800 dark:text-slate-100">
                        Tổng chi phí BOM:
                      </span>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(calculateBOMCost(selectedBOM))}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty State */
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center text-slate-500 dark:text-slate-400">
                  <BeakerIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Chọn một BOM để xem chi tiết</p>
                  <p className="text-sm mt-1">hoặc tạo BOM mới</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Dialog Modal */}
      {confirmDialog.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md mx-4 shadow-xl">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {confirmDialog.title}
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">
                {confirmDialog.message}
              </p>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
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

export default BOMManagementModal;
