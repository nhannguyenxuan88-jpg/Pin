import { useCallback } from "react";
import { usePinContext } from "../../contexts/PinContext";
import { useMaterialStock } from "./useMaterialStock";
import type { ProductionOrder, ActualCost, CostAnalysis } from "../../types";

/**
 * Production Order Lifecycle Management Hook
 *
 * Handles the complete lifecycle of production orders including:
 * - Material commitment/release
 * - Stock updates on completion
 * - Cost analysis calculation
 * - Automatic cleanup on cancellation
 */
export const useProductionOrderLifecycle = () => {
  const {
    updateProductionOrderStatus,
    upsertPinMaterial,
    setPinMaterials,
    productionOrders,
    setProductionOrders,
    addToast,
  } = usePinContext();
  const { enhancedMaterials } = useMaterialStock();

  const updateOrderWithMaterialImpact = useCallback(
    async (
      orderId: string,
      newStatus: ProductionOrder["status"],
      actualCosts?: ActualCost
    ) => {
      try {
        const order = productionOrders.find((o) => o.id === orderId);
        const oldStatus = order?.status;
        if (!order) {
          throw new Error(`Production order ${orderId} not found`);
        }

        // Update the order status
        await updateProductionOrderStatus(orderId, newStatus);

        addToast({
          title: "Cập nhật thành công",
          message: `Đơn hàng ${order.productName} đã được chuyển sang trạng thái "${newStatus}"`,
          type: "success",
        });
      } catch (error) {
        console.error("Error updating production order:", error);
        addToast({
          title: "Lỗi cập nhật",
          message: `Không thể cập nhật trạng thái: ${(error as any)?.message}`,
          type: "error",
        });
        throw error;
      }
    },
    [productionOrders, updateProductionOrderStatus, addToast]
  );

  /**
   * Handle production completion
   * - Deduct actual materials used from stock
   * - Release unused committed materials
   * - Calculate cost analysis
   */
  const handleProductionComplete = useCallback(
    async (order: ProductionOrder, actualCosts?: ActualCost) => {
      if (!order.committedMaterials) return;

      try {
        // Calculate cost analysis if actual costs provided
        let costAnalysis: CostAnalysis | undefined;
        if (actualCosts) {
          costAnalysis = calculateCostAnalysis(order, actualCosts);
        }

        // Update materials: deduct used quantities and release commitments
        const materialUpdates = await Promise.all(
          order.committedMaterials.map(async (cm) => {
            const material = enhancedMaterials.find(
              (m) => m.id === cm.materialId
            );
            if (!material) {
              console.warn(`Material ${cm.materialId} not found`);
              return null;
            }

            const actualQuantityUsed = cm.actualQuantityUsed || cm.quantity;
            const newStock = Math.max(0, material.stock - actualQuantityUsed);
            const newCommittedQuantity = Math.max(
              0,
              (material.committedQuantity || 0) - cm.quantity
            );

            const updatedMaterial = {
              ...material,
              stock: newStock,
              committedQuantity: newCommittedQuantity,
            };

            await upsertPinMaterial(updatedMaterial);
            return updatedMaterial;
          })
        );

        // Update the production order with completion data (local + status API)
        const completedAt = new Date().toISOString();
        await updateProductionOrderStatus(order.id, "Hoàn thành");
        setProductionOrders((prev) =>
          prev.map((o) =>
            o.id === order.id
              ? {
                  ...o,
                  status: "Hoàn thành",
                  actualCosts,
                  costAnalysis,
                  completedAt,
                }
              : o
          )
        );

        // Refresh materials in context
        setPinMaterials((prev) =>
          prev.map((material) => {
            const updated = materialUpdates.find((u) => u?.id === material.id);
            return updated || material;
          })
        );

        console.log(`✅ Production completed for order ${order.id}`);
      } catch (error) {
        console.error("Error completing production:", error);
        throw error;
      }
    },
    [
      enhancedMaterials,
      upsertPinMaterial,
      setPinMaterials,
      updateProductionOrderStatus,
      setProductionOrders,
    ]
  );

  /**
   * Release committed materials back to available stock
   */
  const releaseMaterials = useCallback(
    async (order: ProductionOrder) => {
      if (!order.committedMaterials) return;

      try {
        const materialUpdates = await Promise.all(
          order.committedMaterials.map(async (cm) => {
            const material = enhancedMaterials.find(
              (m) => m.id === cm.materialId
            );
            if (!material) return null;

            const newCommittedQuantity = Math.max(
              0,
              (material.committedQuantity || 0) - cm.quantity
            );
            const updatedMaterial = {
              ...material,
              committedQuantity: newCommittedQuantity,
            };

            await upsertPinMaterial(updatedMaterial);
            return updatedMaterial;
          })
        );

        // Refresh materials in context
        setPinMaterials((prev) =>
          prev.map((material) => {
            const updated = materialUpdates.find((u) => u?.id === material.id);
            return updated || material;
          })
        );

        console.log(`🔄 Materials released for order ${order.id}`);
      } catch (error) {
        console.error("Error releasing materials:", error);
        throw error;
      }
    },
    [enhancedMaterials, upsertPinMaterial, setPinMaterials]
  );

  /**
   * Commit materials for a production order
   */
  const commitMaterials = useCallback(
    async (order: ProductionOrder) => {
      if (!order.committedMaterials) return;

      try {
        const materialUpdates = await Promise.all(
          order.committedMaterials.map(async (cm) => {
            const material = enhancedMaterials.find(
              (m) => m.id === cm.materialId
            );
            if (!material) return null;

            const newCommittedQuantity =
              (material.committedQuantity || 0) + cm.quantity;
            const updatedMaterial = {
              ...material,
              committedQuantity: newCommittedQuantity,
            };

            await upsertPinMaterial(updatedMaterial);
            return updatedMaterial;
          })
        );

        // Refresh materials in context
        setPinMaterials((prev) =>
          prev.map((material) => {
            const updated = materialUpdates.find((u) => u?.id === material.id);
            return updated || material;
          })
        );

        console.log(`🔒 Materials committed for order ${order.id}`);
      } catch (error) {
        console.error("Error committing materials:", error);
        throw error;
      }
    },
    [enhancedMaterials, upsertPinMaterial, setPinMaterials]
  );

  /**
   * Calculate cost analysis by comparing estimated vs actual costs
   */
  const calculateCostAnalysis = (
    order: ProductionOrder,
    actualCosts: ActualCost
  ): CostAnalysis => {
    const estimatedCost = order.totalCost;
    const actualCost = actualCosts.totalActualCost;
    const variance = actualCost - estimatedCost;
    const variancePercentage =
      estimatedCost > 0 ? (variance / estimatedCost) * 100 : 0;

    // Calculate material variance
    const estimatedMaterialCost = order.materialsCost;
    const actualMaterialCost = actualCosts.materialCosts.reduce(
      (sum, mc) => sum + (mc.actualCost || 0),
      0
    );
    const materialVariance = actualMaterialCost - estimatedMaterialCost;

    // Calculate additional costs variance
    const estimatedAdditionalCosts = order.additionalCosts.reduce(
      (sum, ac) => sum + ac.amount,
      0
    );
    const actualAdditionalCosts = actualCosts.otherCosts.reduce(
      (sum, oc) => sum + oc.amount,
      0
    );
    const additionalCostsVariance =
      actualAdditionalCosts - estimatedAdditionalCosts;

    return {
      estimatedCost,
      actualCost,
      variance,
      variancePercentage,
      materialVariance,
      additionalCostsVariance,
    };
  };

  /**
   * Validate if materials are available for production order
   */
  const validateMaterialAvailability = useCallback(
    (
      order: ProductionOrder
    ): {
      isValid: boolean;
      message?: string;
      shortages?: {
        materialId: string;
        materialName: string;
        required: number;
        available: number;
      }[];
    } => {
      if (!order.committedMaterials) {
        return { isValid: true };
      }

      const shortages: {
        materialId: string;
        materialName: string;
        required: number;
        available: number;
      }[] = [];

      order.committedMaterials.forEach((cm) => {
        const material = enhancedMaterials.find((m) => m.id === cm.materialId);
        if (!material) {
          shortages.push({
            materialId: cm.materialId,
            materialName: "Unknown Material",
            required: cm.quantity,
            available: 0,
          });
          return;
        }

        if ((material.availableStock || 0) < cm.quantity) {
          shortages.push({
            materialId: cm.materialId,
            materialName: material.name,
            required: cm.quantity,
            available: material.availableStock || 0,
          });
        }
      });

      if (shortages.length > 0) {
        const shortageDetails = shortages
          .map((s) => `${s.materialName}: cần ${s.required}, có ${s.available}`)
          .join(", ");

        return {
          isValid: false,
          message: `Không đủ nguyên liệu: ${shortageDetails}`,
          shortages,
        };
      }

      return { isValid: true };
    },
    [enhancedMaterials]
  );

  return {
    updateOrderWithMaterialImpact,
    handleProductionComplete,
    releaseMaterials,
    commitMaterials,
    validateMaterialAvailability,
    calculateCostAnalysis,
  };
};
