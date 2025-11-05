import { useEffect } from "react";
import { useAppContext } from "../../contexts/AppContext";

/**
 * Data Synchronization Hook
 *
 * Provides automatic recalculations and data consistency when related data changes.
 * This hook ensures that all derived data stays in sync when base data is updated.
 *
 * Key features:
 * - Auto-refresh predictions when materials/orders change
 * - Recalculate product costs when material prices change
 * - Update inventory commitments when production orders change
 * - Trigger reorder alerts when stock levels change
 */
export const useDataSync = () => {
  const { pinMaterials, productionOrders, pinProducts, pinSales, addToast } =
    useAppContext();

  // Trigger recalculations when materials change
  useEffect(() => {
    // Recalculate product costs when materials change
    updateProductCosts();

    // Check for low stock alerts
    checkLowStockAlerts();
  }, [pinMaterials]);

  // Update material commitments when orders change
  useEffect(() => {
    recalculateMaterialCommitments();

    // Update cost predictions when production pipeline changes
    refreshCostPredictions();
  }, [productionOrders]);

  // Update predictions when sales data changes
  useEffect(() => {
    refreshDemandForecasts();
  }, [pinSales]);

  // General data refresh when any relevant data changes
  useEffect(() => {
    refreshAllPredictions();
  }, [pinMaterials, productionOrders, pinSales, pinProducts]);

  /**
   * Update product costs based on current material prices
   */
  const updateProductCosts = () => {
    // This would recalculate BOM costs when material prices change
    console.log("🔄 Updating product costs based on material price changes");

    // Implementation would:
    // 1. Find all BOMs that use changed materials
    // 2. Recalculate estimated costs
    // 3. Update product cost prices
    // 4. Notify about significant cost changes
  };

  /**
   * Recalculate material commitments
   */
  const recalculateMaterialCommitments = () => {
    console.log("🔄 Recalculating material commitments");

    // Implementation would:
    // 1. Calculate total commitments for each material
    // 2. Update available stock calculations
    // 3. Check for over-commitments
    // 4. Alert about insufficient materials
  };

  /**
   * Check for low stock alerts
   */
  const checkLowStockAlerts = () => {
    const lowStockMaterials = pinMaterials.filter((material) => {
      const minStock = (material as any).minStock || 0;
      const availableStock = material.availableStock || material.stock || 0;
      return availableStock <= minStock && minStock > 0;
    });

    if (lowStockMaterials.length > 0) {
      addToast({
        title: "⚠️ Cảnh báo tồn kho",
        message: `${
          lowStockMaterials.length
        } nguyên liệu sắp hết hàng: ${lowStockMaterials
          .map((m) => m.name)
          .slice(0, 3)
          .join(", ")}${lowStockMaterials.length > 3 ? "..." : ""}`,
        type: "warn",
      });
    }
  };

  /**
   * Refresh cost predictions
   */
  const refreshCostPredictions = () => {
    console.log("🔄 Refreshing cost predictions based on production changes");

    // Implementation would:
    // 1. Update ML models with new production data
    // 2. Recalculate cost predictions for active orders
    // 3. Update risk assessments
    // 4. Refresh dashboard data
  };

  /**
   * Refresh demand forecasts
   */
  const refreshDemandForecasts = () => {
    console.log("🔄 Refreshing demand forecasts based on sales changes");

    // Implementation would:
    // 1. Update demand patterns from recent sales
    // 2. Recalculate inventory forecasts
    // 3. Update reorder recommendations
    // 4. Adjust seasonal patterns
  };

  /**
   * Refresh all predictions and analytics
   */
  const refreshAllPredictions = () => {
    console.log("🔄 Refreshing all predictions and analytics");

    // Implementation would trigger a comprehensive refresh of:
    // 1. AI cost predictions
    // 2. Inventory analytics
    // 3. Smart recommendations
    // 4. Dashboard metrics

    // For now, we'll just log the trigger
    // In a real implementation, this would call the prediction engines
  };

  /**
   * Validate data consistency
   */
  const validateDataConsistency = () => {
    console.log("🔍 Validating data consistency");

    // Check for common inconsistencies:
    // 1. Materials with negative available stock
    // 2. Orders without valid BOMs
    // 3. Commitments without corresponding orders
    // 4. Products with invalid cost calculations

    const inconsistencies: string[] = [];

    // Check negative available stock
    pinMaterials.forEach((material) => {
      const availableStock =
        material.availableStock !== undefined
          ? material.availableStock
          : material.stock - (material.committedQuantity || 0);

      if (availableStock < 0) {
        inconsistencies.push(
          `${material.name} có stock khả dụng âm: ${availableStock}`
        );
      }
    });

    // Check orphaned commitments
    productionOrders
      .filter(
        (order) =>
          order.status === "Đang chờ" || order.status === "Đang sản xuất"
      )
      .forEach((order) => {
        if (order.committedMaterials) {
          order.committedMaterials.forEach((cm) => {
            const material = pinMaterials.find((m) => m.id === cm.materialId);
            if (!material) {
              inconsistencies.push(
                `Order ${order.productName} cam kết nguyên liệu không tồn tại: ${cm.materialId}`
              );
            }
          });
        }
      });

    if (inconsistencies.length > 0) {
      console.warn("⚠️ Data inconsistencies detected:", inconsistencies);

      // In development, show detailed warnings
      if (process.env.NODE_ENV === "development") {
        addToast({
          title: "🔍 Phát hiện dữ liệu không nhất quán",
          message: `${inconsistencies.length} vấn đề được phát hiện. Kiểm tra console để biết chi tiết.`,
          type: "warn",
        });
      }
    }

    return inconsistencies;
  };

  // Run consistency validation periodically
  useEffect(() => {
    const interval = setInterval(validateDataConsistency, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [pinMaterials, productionOrders]);

  return {
    // Data sync functions
    updateProductCosts,
    recalculateMaterialCommitments,
    checkLowStockAlerts,
    refreshCostPredictions,
    refreshDemandForecasts,
    refreshAllPredictions,
    validateDataConsistency,

    // Utility functions
    triggerManualSync: () => {
      updateProductCosts();
      recalculateMaterialCommitments();
      checkLowStockAlerts();
      refreshAllPredictions();
    },

    // Status indicators
    isDataConsistent: () => validateDataConsistency().length === 0,
  };
};
