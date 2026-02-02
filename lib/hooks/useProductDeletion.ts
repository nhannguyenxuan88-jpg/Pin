/**
 * Enhanced Product Deletion Validation Hook
 * Prevents orphaned production orders and data integrity issues
 */

import { usePinContext } from "../../contexts/PinContext";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import { PinProduct, PinBOM, ProductionOrder } from "../../types";

export interface ProductDeletionImpact {
  canDelete: boolean;
  blockers: string[];
  warnings: string[];
  relatedBOMs: PinBOM[];
  activeOrders: ProductionOrder[];
  completedOrders: ProductionOrder[];
  suggestedActions: string[];
}

export interface DeletionOptions {
  forceDelete?: boolean;
  cancelActiveOrders?: boolean;
  completeActiveOrders?: boolean;
  deleteBOMs?: boolean;
  returnMaterials?: boolean;
  /**
   * Số lượng muốn xóa. Mặc định: toàn bộ tồn kho hiện tại.
   */
  quantity?: number;
}

export function useProductDeletion() {
  const ctx = usePinContext();

  /**
   * Analyze the impact of deleting a product
   */
  const analyzeProductDeletionImpact = (
    product: PinProduct
  ): ProductDeletionImpact => {
    const { pinBOMs, productionOrders } = ctx;

    // Find related BOMs
    const relatedBOMs = pinBOMs.filter(
      (bom: PinBOM) =>
        bom.productSku === product.sku || bom.productName === product.name
    );

    // Find related production orders
    const bomIds = relatedBOMs.map((bom: PinBOM) => bom.id);
    const activeOrders = productionOrders.filter(
      (order: ProductionOrder) =>
        bomIds.includes(order.bomId) &&
        order.status !== "Hoàn thành" &&
        order.status !== "Đã hủy"
    );

    const completedOrders = productionOrders.filter(
      (order: ProductionOrder) =>
        bomIds.includes(order.bomId) &&
        (order.status === "Hoàn thành" || order.status === "Đã hủy")
    );

    // Determine blockers and warnings
    const blockers: string[] = [];
    const warnings: string[] = [];
    const suggestedActions: string[] = [];

    if (activeOrders.length > 0) {
      blockers.push(
        `${activeOrders.length} đơn hàng sản xuất đang hoạt động sẽ bị ảnh hưởng`
      );
      suggestedActions.push(
        "Hủy hoặc hoàn thành các đơn hàng sản xuất trước khi xóa sản phẩm"
      );
    }

    if (relatedBOMs.length > 0) {
      warnings.push(
        `${relatedBOMs.length} công thức sản xuất (BOM) liên quan sẽ bị xóa`
      );
      suggestedActions.push(
        "Kiểm tra và sao lưu các công thức sản xuất quan trọng"
      );
    }

    if (completedOrders.length > 0) {
      warnings.push(
        `${completedOrders.length} đơn hàng đã hoàn thành sẽ bị ảnh hưởng đến lịch sử`
      );
      suggestedActions.push("Cân nhắc việc lưu trữ thay vì xóa hoàn toàn");
    }

    const canDelete = blockers.length === 0;

    return {
      canDelete,
      blockers,
      warnings,
      relatedBOMs,
      activeOrders,
      completedOrders,
      suggestedActions,
    };
  };

  /**
   * Validate if a product can be safely deleted
   */
  const validateProductDeletion = (product: PinProduct): boolean => {
    const impact = analyzeProductDeletionImpact(product);
    return impact.canDelete;
  };

  /**
   * Enhanced product deletion with options
   */
  const deleteProductWithOptions = async (
    product: PinProduct,
    options: DeletionOptions = {}
  ): Promise<{ success: boolean; message: string }> => {
    const impact = analyzeProductDeletionImpact(product);
    const requestedQty = Math.floor(
      Number(options.quantity ?? product.stock ?? 0)
    );
    const qty = Math.max(1, Math.min(requestedQty, Number(product.stock || 0)));

    try {
      // Handle active orders first if needed
      if (impact.activeOrders.length > 0) {
        if (options.cancelActiveOrders) {
          for (const order of impact.activeOrders) {
            await ctx.updateProductionOrderStatus(order.id, "Đã hủy");
          }
        } else if (options.completeActiveOrders) {
          for (const order of impact.activeOrders) {
            await ctx.updateProductionOrderStatus(order.id, "Hoàn thành");
          }
        } else if (!options.forceDelete) {
          return {
            success: false,
            message:
              "Không thể xóa sản phẩm do còn đơn hàng sản xuất đang hoạt động",
          };
        }
      }
      // Delete related BOMs if requested
      if (options.deleteBOMs && impact.relatedBOMs.length > 0) {
        for (const bom of impact.relatedBOMs) {
          await ctx.deletePinBOM(bom.id);
        }
      }

      // Delete the product (with material return if specified)
      if (options.returnMaterials) {
        await ctx.removePinProductAndReturnMaterials(product, qty);
      } else {
        const remaining = Math.max(0, (product.stock || 0) - qty);
        if (remaining === 0) {
          // Không hoàn NVL – xóa hoàn toàn: hủy các đơn hoàn thành liên quan để tránh re-sync
          const relatedBOMs = ctx.pinBOMs.filter(
            (bom: PinBOM) =>
              bom.productSku === product.sku || bom.productName === product.name
          );
          const bomIds = relatedBOMs.map((b: PinBOM) => b.id);
          const completedOrders = ctx.productionOrders.filter(
            (o: ProductionOrder) =>
              bomIds.includes(o.bomId) && o.status === "Hoàn thành"
          );
          for (const order of completedOrders) {
            try {
              const { error } = await supabase
                .from("pin_production_orders")
                .update({ status: "Đã hủy" })
                .eq("id", order.id);
              if (!error) {
                ctx.setProductionOrders((prev: ProductionOrder[]) =>
                  prev.map((o: ProductionOrder) =>
                    o.id === order.id ? { ...o, status: "Đã hủy" } : o
                  )
                );
              }
            } catch (orderError) {
              // Tiếp tục với đơn hàng tiếp theo nếu có lỗi
            }
          }

          if (IS_OFFLINE_MODE) {
            ctx.setPinProducts((prev: PinProduct[]) =>
              prev.filter((p: PinProduct) => p.id !== product.id)
            );
          } else {
            const { error: delErr } = await supabase
              .from("pin_products")
              .delete()
              .eq("id", product.id);
            if (delErr) {
              return {
                success: false,
                message: delErr.message || String(delErr),
              };
            }
            ctx.setPinProducts((prev: PinProduct[]) =>
              prev.filter((p: PinProduct) => p.id !== product.id)
            );
          }
        } else {
          // Giảm tồn kho một phần, không hoàn NVL
          if (IS_OFFLINE_MODE) {
            ctx.setPinProducts((prev: PinProduct[]) =>
              prev.map((p: PinProduct) =>
                p.id === product.id ? { ...p, stock: remaining } : p
              )
            );
          } else {
            const { error: updErr } = await supabase
              .from("pin_products")
              .update({ stock: remaining })
              .eq("id", product.id);
            if (updErr) {
              return {
                success: false,
                message: updErr.message || String(updErr),
              };
            }
            ctx.setPinProducts((prev: PinProduct[]) =>
              prev.map((p: PinProduct) =>
                p.id === product.id ? { ...p, stock: remaining } : p
              )
            );
          }
        }
      }

      return {
        success: true,
        message: options.returnMaterials
          ? `Đã xóa ${qty} và hoàn kho NVL thành công`
          : `Đã xóa ${qty} khỏi tồn kho` +
            (Math.max(0, (product.stock || 0) - qty) === 0
              ? " và xóa thành phẩm"
              : ""),
      };
    } catch (error) {
      return {
        success: false,
        message: `Lỗi khi xóa sản phẩm: ${
          error instanceof Error ? error.message : String(error)
        }`,
      };
    }
  };

  /**
   * Cleanup orphaned data in the system
   */
  const cleanupOrphanedData = (): {
    orphanedBOMs: PinBOM[];
    orphanedOrders: ProductionOrder[];
    cleanupReport: string;
  } => {
    const { pinProducts, pinBOMs, productionOrders } = ctx;

    // Find orphaned BOMs (no matching product)
    const orphanedBOMs = pinBOMs.filter((bom: PinBOM) => {
      return !pinProducts.some(
        (product: PinProduct) =>
          product.sku === bom.productSku || product.name === bom.productName
      );
    });

    // Find orphaned production orders (no matching BOM)
    const orphanedOrders = productionOrders.filter((order: ProductionOrder) => {
      return !pinBOMs.some((bom: PinBOM) => bom.id === order.bomId);
    });

    const cleanupActions: string[] = [];

    // Cleanup orphaned BOMs
    if (orphanedBOMs.length > 0) {
      cleanupActions.push(
        `Phát hiện ${orphanedBOMs.length} BOM mồ côi - cần xem xét xóa`
      );
    }

    // Cleanup orphaned orders
    if (orphanedOrders.length > 0) {
      cleanupActions.push(
        `Phát hiện ${orphanedOrders.length} đơn hàng sản xuất mồ côi - cần xem xét xóa`
      );
    }

    const cleanupReport =
      cleanupActions.length > 0
        ? cleanupActions.join("\n")
        : "Không phát hiện dữ liệu mồ côi nào";

    return {
      orphanedBOMs,
      orphanedOrders,
      cleanupReport,
    };
  };

  /**
   * Get product deletion preview for UI
   */
  const getProductDeletionPreview = (
    product: PinProduct
  ): {
    title: string;
    impact: ProductDeletionImpact;
    recommendedAction: "safe" | "warning" | "blocked";
  } => {
    const impact = analyzeProductDeletionImpact(product);

    let title: string;
    let recommendedAction: "safe" | "warning" | "blocked";

    if (impact.blockers.length > 0) {
      title = `⛔ Không thể xóa sản phẩm "${product.name}"`;
      recommendedAction = "blocked";
    } else if (impact.warnings.length > 0) {
      title = `⚠️ Cẩn thận khi xóa sản phẩm "${product.name}"`;
      recommendedAction = "warning";
    } else {
      title = `✅ An toàn để xóa sản phẩm "${product.name}"`;
      recommendedAction = "safe";
    }

    return {
      title,
      impact,
      recommendedAction,
    };
  };

  return {
    analyzeProductDeletionImpact,
    validateProductDeletion,
    deleteProductWithOptions,
    cleanupOrphanedData,
    getProductDeletionPreview,
  };
}
