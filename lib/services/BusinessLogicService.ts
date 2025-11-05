// Business Logic Service - No hooks needed as this is a static service class
import type {
  ProductionOrder,
  PinBOM,
  PinMaterial,
  PinSale,
  CashTransaction,
  MaterialCommitment,
  ActualCost,
} from "../../types";

/**
 * Business Logic Service Class
 *
 * Centralized service for complex business operations that involve multiple entities.
 * Provides validation, coordination, and consistency across different business flows.
 *
 * Key responsibilities:
 * - Validate business rules before operations
 * - Coordinate multi-step operations atomically
 * - Ensure data consistency across related entities
 * - Handle error scenarios gracefully
 */
export class BusinessLogicService {
  /**
   * Create a new production order with full material validation and commitment
   */
  static async createProductionOrder(
    order: ProductionOrder,
    bom: PinBOM,
    appContext: any // We'll type this properly based on AppContext
  ): Promise<{ success: boolean; message: string; orderId?: string }> {
    try {
      // 1. Validate material availability
      const validation = await this.validateMaterialAvailabilityForBOM(
        bom,
        order.quantityProduced,
        appContext
      );
      if (!validation.isValid) {
        return {
          success: false,
          message: validation.message || "Không đủ nguyên liệu để sản xuất",
        };
      }

      // 2. Calculate material commitments
      const materialCommitments = this.calculateMaterialCommitments(
        bom,
        order.quantityProduced,
        appContext.pinMaterials
      );

      // 3. Create order with commitments
      const orderWithCommitments: ProductionOrder = {
        ...order,
        committedMaterials: materialCommitments,
        status: "Đang chờ",
      };

      // 4. Commit materials and create order atomically
      await appContext.addProductionOrder(orderWithCommitments, bom);

      // 5. Update material committed quantities
      await this.updateMaterialCommitments(
        materialCommitments,
        "add",
        appContext
      );

      return {
        success: true,
        message: `Đơn hàng sản xuất ${order.productName} đã được tạo thành công`,
        orderId: order.id,
      };
    } catch (error) {
      console.error("Error creating production order:", error);
      return {
        success: false,
        message: `Lỗi tạo đơn hàng: ${
          (error as any)?.message || "Unknown error"
        }`,
      };
    }
  }

  /**
   * Process a sale with inventory validation and stock updates
   */
  static async processSale(
    sale: PinSale,
    newCashTx: CashTransaction,
    appContext: any
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 1. Validate product availability
      const stockValidation = await this.validateStockForSale(sale, appContext);
      if (!stockValidation.isValid) {
        return {
          success: false,
          message: stockValidation.message || "Không đủ hàng trong kho",
        };
      }

      // 2. Process sale
      await appContext.handlePinSale(sale, newCashTx);

      // 3. Update inventory (this should be handled by handlePinSale, but we verify)
      await this.updateInventoryAfterSale(sale, appContext);

      // 4. Check and trigger reorder alerts
      await this.checkReorderPoints(appContext);

      return {
        success: true,
        message: `Đơn hàng cho ${sale.customer.name} đã được xử lý thành công`,
      };
    } catch (error) {
      console.error("Error processing sale:", error);
      return {
        success: false,
        message: `Lỗi xử lý đơn hàng: ${
          (error as any)?.message || "Unknown error"
        }`,
      };
    }
  }

  /**
   * Complete a production order with cost analysis
   */
  static async completeProductionOrder(
    orderId: string,
    actualCosts: ActualCost,
    appContext: any
  ): Promise<{ success: boolean; message: string; costAnalysis?: any }> {
    try {
      const order = appContext.productionOrders.find(
        (o: ProductionOrder) => o.id === orderId
      );
      if (!order) {
        return { success: false, message: "Không tìm thấy đơn hàng sản xuất" };
      }

      if (order.status !== "Đang sản xuất" && order.status !== "Đang chờ") {
        return {
          success: false,
          message: "Đơn hàng không ở trạng thái có thể hoàn thành",
        };
      }

      // Calculate cost analysis
      const costAnalysis = this.calculateCostAnalysis(order, actualCosts);

      // Update order status with lifecycle management
      // This will handle material deduction and cleanup automatically
      await appContext.updateProductionOrderStatus(orderId, "Hoàn thành");

      // Update the order with actual costs and analysis
      const updatedOrder: ProductionOrder = {
        ...order,
        status: "Hoàn thành",
        actualCosts,
        costAnalysis,
        completedAt: new Date().toISOString(),
      };

      await appContext.upsertProductionOrder(updatedOrder);

      return {
        success: true,
        message: `Đơn hàng ${order.productName} đã hoàn thành`,
        costAnalysis,
      };
    } catch (error) {
      console.error("Error completing production order:", error);
      return {
        success: false,
        message: `Lỗi hoàn thành đơn hàng: ${
          (error as any)?.message || "Unknown error"
        }`,
      };
    }
  }

  /**
   * Validate material availability for BOM production
   */
  private static async validateMaterialAvailabilityForBOM(
    bom: PinBOM,
    quantity: number,
    appContext: any
  ): Promise<{ isValid: boolean; message?: string }> {
    const materialRequirements = bom.materials.map((bomMat) => ({
      materialId: bomMat.materialId,
      quantity: bomMat.quantity * quantity,
    }));

    const shortages: string[] = [];

    for (const req of materialRequirements) {
      const material = appContext.pinMaterials.find(
        (m: PinMaterial) => m.id === req.materialId
      );
      if (!material) {
        shortages.push(`Nguyên liệu không tồn tại (${req.materialId})`);
        continue;
      }

      // Calculate available stock (total - committed)
      const committedQty = this.calculateCurrentCommitments(
        material.id,
        appContext.productionOrders
      );
      const availableStock = (material.stock || 0) - committedQty;

      if (availableStock < req.quantity) {
        shortages.push(
          `${material.name}: cần ${req.quantity}, có ${availableStock}`
        );
      }
    }

    return {
      isValid: shortages.length === 0,
      message:
        shortages.length > 0
          ? `Thiếu nguyên liệu: ${shortages.join(", ")}`
          : undefined,
    };
  }

  /**
   * Validate stock for sale
   */
  private static async validateStockForSale(
    sale: PinSale,
    appContext: any
  ): Promise<{ isValid: boolean; message?: string }> {
    const shortages: string[] = [];

    for (const item of sale.items) {
      const product = appContext.pinProducts.find(
        (p: any) => p.id === item.productId
      );
      if (!product) {
        shortages.push(`Sản phẩm không tồn tại (${item.productId})`);
        continue;
      }

      if (product.stock < item.quantity) {
        shortages.push(
          `${product.name}: cần ${item.quantity}, có ${product.stock}`
        );
      }
    }

    return {
      isValid: shortages.length === 0,
      message:
        shortages.length > 0
          ? `Không đủ hàng: ${shortages.join(", ")}`
          : undefined,
    };
  }

  /**
   * Calculate material commitments for BOM
   */
  private static calculateMaterialCommitments(
    bom: PinBOM,
    quantity: number,
    materials: PinMaterial[]
  ): MaterialCommitment[] {
    return bom.materials.map((bomMat) => {
      const material = materials.find((m) => m.id === bomMat.materialId);
      const totalQuantity = bomMat.quantity * quantity;
      const estimatedCost = (material?.purchasePrice || 0) * totalQuantity;

      return {
        materialId: bomMat.materialId,
        quantity: totalQuantity,
        estimatedCost,
        actualCost: undefined,
        actualQuantityUsed: undefined,
      };
    });
  }

  /**
   * Calculate current commitments for a material
   */
  private static calculateCurrentCommitments(
    materialId: string,
    productionOrders: ProductionOrder[]
  ): number {
    return productionOrders
      .filter(
        (order) =>
          order.status === "Đang chờ" || order.status === "Đang sản xuất"
      )
      .reduce((total, order) => {
        const commitment = order.committedMaterials?.find(
          (cm) => cm.materialId === materialId
        );
        return total + (commitment?.quantity || 0);
      }, 0);
  }

  /**
   * Update material committed quantities
   */
  private static async updateMaterialCommitments(
    commitments: MaterialCommitment[],
    operation: "add" | "remove",
    appContext: any
  ): Promise<void> {
    const updates = commitments
      .map((commitment) => {
        const material = appContext.pinMaterials.find(
          (m: PinMaterial) => m.id === commitment.materialId
        );
        if (!material) return null;

        const multiplier = operation === "add" ? 1 : -1;
        const newCommittedQuantity = Math.max(
          0,
          (material.committedQuantity || 0) + commitment.quantity * multiplier
        );

        return {
          ...material,
          committedQuantity: newCommittedQuantity,
        };
      })
      .filter(Boolean);

    // Update materials in batch
    await Promise.all(
      updates.map((material) => appContext.upsertPinMaterial(material))
    );
  }

  /**
   * Update inventory after sale
   */
  private static async updateInventoryAfterSale(
    sale: PinSale,
    appContext: any
  ): Promise<void> {
    // This is typically handled by handlePinSale, but we can add verification here
    for (const item of sale.items) {
      const product = appContext.pinProducts.find(
        (p: any) => p.id === item.productId
      );
      if (product && product.stock >= item.quantity) {
        const updatedProduct = {
          ...product,
          stock: product.stock - item.quantity,
        };
        await appContext.updatePinProduct(updatedProduct);
      }
    }
  }

  /**
   * Check and trigger reorder points
   */
  private static async checkReorderPoints(appContext: any): Promise<void> {
    // Implementation would check materials against minimum stock levels
    // and trigger reorder alerts or automatic purchase orders

    const lowStockMaterials = appContext.pinMaterials.filter(
      (material: PinMaterial) => {
        const minStock = (material as any).minStock || 0;
        const committedQty = this.calculateCurrentCommitments(
          material.id,
          appContext.productionOrders
        );
        const availableStock = (material.stock || 0) - committedQty;

        return availableStock <= minStock;
      }
    );

    if (lowStockMaterials.length > 0) {
      appContext.addToast({
        title: "Cảnh báo tồn kho",
        message: `${lowStockMaterials.length} nguyên liệu sắp hết hàng`,
        type: "warn",
      });
    }
  }

  /**
   * Calculate cost analysis
   */
  private static calculateCostAnalysis(
    order: ProductionOrder,
    actualCosts: ActualCost
  ): any {
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
  }
}
