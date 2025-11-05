import { useMemo, useCallback } from "react";
import { usePinContext } from "../../contexts/PinContext";
import type {
  PinMaterial,
  ProductionOrder,
  EnhancedMaterial,
} from "../../types";

/**
 * Centralized Material Stock Management Hook
 *
 * This hook provides a single source of truth for material stock calculations,
 * eliminating inconsistencies between components that calculate committed quantities
 * independently.
 *
 * Features:
 * - Calculates committed quantities from active production orders
 * - Provides enhanced materials with availability information
 * - Ensures consistency across all components
 * - Auto-updates when dependencies change
 */
export const useMaterialStock = () => {
  // Use PIN context (prefers standalone when available; falls back gracefully)
  const { pinMaterials, productionOrders } = usePinContext();

  /**
   * Calculate committed quantities for a specific material
   * Only considers orders in "Đang chờ" or "Đang sản xuất" status
   */
  const calculateCommittedQuantities = useCallback(
    (materialId: string): number => {
      if (!productionOrders || productionOrders.length === 0) return 0;

      return productionOrders
        .filter(
          (order: ProductionOrder) =>
            order.status === "Đang chờ" || order.status === "Đang sản xuất"
        )
        .reduce((total: number, order: ProductionOrder) => {
          if (order.committedMaterials) {
            const commitment = order.committedMaterials.find(
              (cm) => cm.materialId === materialId
            );
            return total + (commitment?.quantity || 0);
          }
          return total;
        }, 0);
    },
    [productionOrders]
  );

  /**
   * Get all committed quantities as a map for efficient lookup
   */
  const committedQuantitiesMap = useMemo(() => {
    const map = new Map<string, number>();

    if (!productionOrders || productionOrders.length === 0) return map;

    productionOrders
      .filter(
        (order: ProductionOrder) =>
          order.status === "Đang chờ" || order.status === "Đang sản xuất"
      )
      .forEach((order: ProductionOrder) => {
        if (order.committedMaterials) {
          order.committedMaterials.forEach((cm) => {
            const current = map.get(cm.materialId) || 0;
            map.set(cm.materialId, current + cm.quantity);
          });
        }
      });

    return map;
  }, [productionOrders]);

  /**
   * Get stock status for a material
   */
  const getStockStatus = (availableStock: number, totalStock: number) => {
    if (availableStock <= 0) return "out-of-stock";
    if (availableStock < totalStock * 0.2) return "low-stock";
    if (availableStock < totalStock * 0.5) return "medium-stock";
    return "good-stock";
  };

  /**
   * Enhanced materials with calculated commitment and availability info
   */
  const enhancedMaterials: EnhancedMaterial[] = useMemo(() => {
    return pinMaterials.map((material: PinMaterial) => {
      const committedQuantity = committedQuantitiesMap.get(material.id) || 0;
      const availableStock = Math.max(
        0,
        (material.stock || 0) - committedQuantity
      );

      return {
        ...material,
        committedQuantity,
        availableStock,
        // Additional calculated fields
        stockStatus: getStockStatus(availableStock, material.stock || 0),
        commitmentRatio: material.stock
          ? (committedQuantity / material.stock) * 100
          : 0,
      };
    });
  }, [pinMaterials, committedQuantitiesMap]);

  /**
   * Check if sufficient materials are available for production
   */
  const checkMaterialAvailability = useCallback(
    (
      materialRequirements: { materialId: string; quantity: number }[]
    ): {
      isAvailable: boolean;
      shortages: { materialId: string; required: number; available: number }[];
    } => {
      const shortages: {
        materialId: string;
        required: number;
        available: number;
      }[] = [];

      materialRequirements.forEach(({ materialId, quantity }) => {
        const material = enhancedMaterials.find((m) => m.id === materialId);
        if (!material) {
          shortages.push({ materialId, required: quantity, available: 0 });
          return;
        }

        if ((material.availableStock || 0) < quantity) {
          shortages.push({
            materialId,
            required: quantity,
            available: material.availableStock || 0,
          });
        }
      });

      return {
        isAvailable: shortages.length === 0,
        shortages,
      };
    },
    [enhancedMaterials]
  );

  /**
   * Get materials that need reordering based on committed quantities and minimum stock levels
   */
  const getMaterialsNeedingReorder = useCallback(() => {
    return enhancedMaterials.filter((material) => {
      const minStock = material.minStock || 0;
      return (material.availableStock || 0) <= minStock;
    });
  }, [enhancedMaterials]);

  /**
   * Get production orders affecting a specific material
   */
  const getOrdersAffectingMaterial = useCallback(
    (materialId: string) => {
      return productionOrders.filter((order: ProductionOrder) =>
        order.committedMaterials?.some((cm) => cm.materialId === materialId)
      );
    },
    [productionOrders]
  );

  return {
    // Core data
    enhancedMaterials,
    committedQuantitiesMap,

    // Calculation functions
    calculateCommittedQuantities,
    checkMaterialAvailability,
    getMaterialsNeedingReorder,
    getOrdersAffectingMaterial,

    // Utility functions
    getStockStatus,
  };
};
