import React, { useState, useEffect } from "react";
import type { PinBOM, PinMaterial, ProductionOrder, User } from "../types";
import { usePinContext } from "../contexts/PinContext";
import ProductionDashboard from "./ProductionDashboard";
import BOMManagementModal from "./BOMManagementModal";

interface ProductionManagerProps {
  boms: PinBOM[];
  setBoms: React.Dispatch<React.SetStateAction<PinBOM[]>>;
  materials: PinMaterial[];
  currentUser: User;
  orders: ProductionOrder[];
  addOrder: (order: ProductionOrder, bom: PinBOM) => void;
  updateOrder: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  completeOrder?: (orderId: string) => Promise<void>;
}

const ProductionManagerWrapper: React.FC<ProductionManagerProps> = ({
  boms,
  setBoms,
  materials,
  currentUser,
  orders,
  addOrder,
  updateOrder,
  completeOrder,
}) => {
  const [showBOMModal, setShowBOMModal] = useState(false);
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [selectedBomIdForOrder, setSelectedBomIdForOrder] = useState<string | undefined>();
  const [editingBomId, setEditingBomId] = useState<string | undefined>();

  // Persist modal states
  useEffect(() => {
    const saved = localStorage.getItem("productionManager_modals");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.showBOMModal) setShowBOMModal(true);
        if (parsed.showCreateOrderModal) setShowCreateOrderModal(true);
      } catch {
        // Ignore JSON parse errors from corrupted localStorage
      }
    }
  }, []);

  useEffect(() => {
    const anyOpen = showBOMModal || showCreateOrderModal;
    if (anyOpen) {
      localStorage.setItem(
        "productionManager_modals",
        JSON.stringify({
          showBOMModal,
          showCreateOrderModal,
        })
      );
    } else {
      localStorage.removeItem("productionManager_modals");
    }
  }, [showBOMModal, showCreateOrderModal]);

  // Use context upsert/delete to persist BOMs to DB
  const { upsertPinBOM, deletePinBOM, addToast } = usePinContext();

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "warning" | "info") => {
    addToast?.({ id: crypto.randomUUID(), message, type });
  };

  const handleSaveBOM = async (bom: PinBOM) => {
    try {
      await upsertPinBOM(bom);

      // Update local state
      setBoms((prev) => {
        const existing = prev.find((b) => b.id === bom.id);
        if (existing) {
          return prev.map((b) => (b.id === bom.id ? bom : b));
        } else {
          return [...prev, bom];
        }
      });

      showToast(`Lưu BOM "${bom.productName}" thành công`, "success");
    } catch (error) {
      showToast("Có lỗi khi lưu BOM. Vui lòng thử lại.", "error");
    }
  };

  const handleDeleteBOM = async (bomId: string) => {
    try {
      await deletePinBOM(bomId);

      // Update local state
      setBoms((prev) => prev.filter((b) => b.id !== bomId));

      showToast("Xóa BOM thành công", "success");
    } catch (error) {
      showToast("Có lỗi khi xóa BOM. Vui lòng thử lại.", "error");
    }
  };

  const handleCreateOrder = (order: ProductionOrder, bom: PinBOM) => {
    addOrder(order, bom);
    setShowCreateOrderModal(false);
  };

  const handleManageBOMs = () => {
    setShowBOMModal(true);
    setShowCreateOrderModal(false); // Chỉ quản lý BOM, không tạo order
  };

  const handleCreateOrderFromDashboard = () => {
    setShowCreateOrderModal(true);
    setShowBOMModal(true);
  };

  const handleCreateOrderFromBOM = (bomId: string) => {
    // Khi click vào BOM từ danh sách, mở modal để tạo order từ BOM đó
    setSelectedBomIdForOrder(bomId);
    setShowCreateOrderModal(true);
    setShowBOMModal(true);
  };

  const handleEditBOM = (bomId: string) => {
    // Mở modal để chỉnh sửa BOM
    setEditingBomId(bomId);
    setSelectedBomIdForOrder(undefined);
    setShowCreateOrderModal(false);
    setShowBOMModal(true);
  };

  const handleDeleteBOMFromDashboard = (bomId: string) => {
    // Xóa BOM trực tiếp từ dashboard
    handleDeleteBOM(bomId);
  };

  return (
    <>
      <ProductionDashboard
        orders={orders}
        updateOrder={updateOrder}
        currentUser={currentUser}
        materials={materials}
        boms={boms}
        onCreateOrder={handleCreateOrderFromDashboard}
        onManageBOMs={handleManageBOMs}
        onCreateOrderFromBOM={handleCreateOrderFromBOM}
        onEditBOM={handleEditBOM}
        onDeleteBOM={handleDeleteBOMFromDashboard}
        completeOrder={completeOrder}
      />

      {showBOMModal && (
        <BOMManagementModal
          isOpen={showBOMModal}
          onClose={() => {
            setShowBOMModal(false);
            setShowCreateOrderModal(false);
            setSelectedBomIdForOrder(undefined);
            setEditingBomId(undefined);
          }}
          boms={boms}
          materials={materials}
          currentUser={currentUser}
          onSaveBOM={handleSaveBOM}
          onDeleteBOM={handleDeleteBOM}
          onCreateProductionOrder={showCreateOrderModal ? handleCreateOrder : undefined}
          mode={
            editingBomId
              ? "edit-bom"
              : selectedBomIdForOrder
                ? "create-order-from-bom"
                : showCreateOrderModal
                  ? "list-and-create"
                  : "create-only"
          }
          selectedBomId={editingBomId || selectedBomIdForOrder}
          onToast={showToast}
        />
      )}
    </>
  );
};

export default ProductionManagerWrapper;
