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

  // Persist modal states
  useEffect(() => {
    const saved = localStorage.getItem("productionManager_modals");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.showBOMModal) setShowBOMModal(true);
        if (parsed.showCreateOrderModal) setShowCreateOrderModal(true);
      } catch (e) {}
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
  const { upsertPinBOM, deletePinBOM } = usePinContext();

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

      console.log("BOM saved successfully:", bom.productName);
    } catch (error) {
      console.error("Error saving BOM:", error);
      alert("Có lỗi khi lưu BOM. Vui lòng thử lại.");
    }
  };

  const handleDeleteBOM = async (bomId: string) => {
    try {
      await deletePinBOM(bomId);

      // Update local state
      setBoms((prev) => prev.filter((b) => b.id !== bomId));

      console.log("BOM deleted successfully:", bomId);
    } catch (error) {
      console.error("Error deleting BOM:", error);
      alert("Có lỗi khi xóa BOM. Vui lòng thử lại.");
    }
  };

  const handleCreateOrder = (order: ProductionOrder, bom: PinBOM) => {
    addOrder(order, bom);
    setShowCreateOrderModal(false);
  };

  const handleManageBOMs = () => {
    setShowBOMModal(true);
  };

  const handleCreateOrderFromDashboard = () => {
    setShowCreateOrderModal(true);
    setShowBOMModal(true);
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
      />

      {showBOMModal && (
        <BOMManagementModal
          isOpen={showBOMModal}
          onClose={() => {
            setShowBOMModal(false);
            setShowCreateOrderModal(false);
          }}
          boms={boms}
          materials={materials}
          currentUser={currentUser}
          onSaveBOM={handleSaveBOM}
          onDeleteBOM={handleDeleteBOM}
          onCreateProductionOrder={
            showCreateOrderModal ? handleCreateOrder : undefined
          }
        />
      )}
    </>
  );
};

export default ProductionManagerWrapper;
