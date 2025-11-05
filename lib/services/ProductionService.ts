import type { PinContextType } from "../../../contexts/pincorp/types";
import type { PinBOM, ProductionOrder, PinProduct } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import { generateProductSKU } from "../../lib/sku";

let syncRunning = false;

export interface ProductionService {
  upsertBOM: (bom: PinBOM) => Promise<void>;
  deleteBOM: (bomId: string) => Promise<void>;
  addOrder: (order: ProductionOrder, bom: PinBOM) => Promise<void>;
  updateOrderStatus: (
    orderId: string,
    status: ProductionOrder["status"]
  ) => Promise<void>;
  completeOrder: (orderId: string) => Promise<void>;
  syncProductsFromCompletedOrders: () => Promise<void>;
  updateProduct: (product: PinProduct) => Promise<void>;
  removeProductAndReturnMaterials: (
    product: PinProduct,
    quantityToRemove: number
  ) => Promise<void>;
}

export function createProductionService(
  ctx: PinContextType
): ProductionService {
  // Helper: upsert product to DB or state
  const persistProduct = async (product: PinProduct): Promise<boolean> => {
    if (IS_OFFLINE_MODE || !ctx.currentUser) {
      ctx.setPinProducts((prev) => {
        const idx = prev.findIndex((p) => p.id === product.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = product;
          return next;
        }
        return [product, ...prev];
      });
      return true;
    }
    // Minimal payload to fit current schema; avoid retailprice/wholesaleprice which may not exist
    let payload: any = {
      id: (product as any).id,
      name: (product as any).name,
      sku: (product as any).sku,
      stock: Number((product as any).stock ?? 0),
      costprice: Number((product as any).costPrice ?? 0),
      // keep sellingprice if exists for legacy UIs, remove if column missing
      sellingprice: (product as any).sellingPrice ?? null,
    };
    let { error } = await supabase.from("pincorp_products").upsert(payload);
    if (error) {
      // Retry if sellingprice column is missing
      if (
        /sellingprice/i.test(error.message || "") &&
        /column|not exist|schema cache/i.test(error.message || "")
      ) {
        const retryPayload = { ...payload } as any;
        delete retryPayload.sellingprice;
        const retry = await supabase
          .from("pincorp_products")
          .upsert(retryPayload);
        error = retry.error as any;
      }
    }
    if (error) {
      ctx.addToast?.({
        title: "Lỗi lưu sản phẩm",
        message: error.message || String(error),
        type: "error",
      });
      return false;
    }
    ctx.setPinProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = product;
        return next;
      }
      return [product, ...prev];
    });
    return true;
  };

  return {
    upsertBOM: async (bom) => {
      // Offline-first: update memory only when offline or unauthenticated
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setBoms((prev: any[]) => {
          const idx = prev.findIndex((b: any) => b.id === (bom as any).id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = bom as any;
            return next;
          }
          return [bom as any, ...prev];
        });
        return;
      }

      // Online: persist to DB (pincorp_boms) and update state
      const payload: any = {
        id: (bom as any).id,
        productname: (bom as any).productName,
        productsku: (bom as any).productSku,
        materials: (bom as any).materials || [],
        notes: (bom as any).notes || null,
      };
      const { error } = await supabase.from("pincorp_boms").upsert(payload);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi lưu BOM",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setBoms((prev: any[]) => {
        const idx = prev.findIndex((b: any) => b.id === (bom as any).id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = bom as any;
          return next;
        }
        return [bom as any, ...prev];
      });
      ctx.addToast?.({
        title: "Đã lưu BOM",
        message: `BOM cho sản phẩm \"${(bom as any).productName}\" đã được lưu`,
        type: "success",
      });
    },
    deleteBOM: async (bomId) => {
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setBoms((prev: any[]) => prev.filter((b: any) => b.id !== bomId));
        return;
      }
      const { error } = await supabase
        .from("pincorp_boms")
        .delete()
        .eq("id", bomId);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi xoá BOM",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setBoms((prev: any[]) => prev.filter((b: any) => b.id !== bomId));
    },
    addOrder: async (order, bom) => {
      // Default status if missing
      const status = (order.status || "Đang chờ") as ProductionOrder["status"];
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setProductionOrders((prev) => [order, ...prev]);
        ctx.addToast?.({
          title: "Đã tạo lệnh (Offline)",
          message: `${order.productName} - SL: ${order.quantityProduced}`,
          type: "success",
        });
        return;
      }
      const payload: any = {
        id: order.id,
        productname: order.productName,
        bomid: order.bomId,
        quantityproduced: Number(order.quantityProduced || 0),
        materialscost: Number(order.materialsCost || 0),
        totalcost: Number(order.totalCost || 0),
        status,
        notes: order.notes || null,
      };
      // Note: pincorp_productionorders currently has no created_by column; do not include it
      const { error } = await supabase
        .from("pincorp_productionorders")
        .upsert(payload);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi tạo lệnh sản xuất",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setProductionOrders((prev) => [order, ...prev]);
      ctx.addToast?.({
        title: "Đã tạo lệnh sản xuất",
        message: `${order.productName} - SL: ${order.quantityProduced}`,
        type: "success",
      });
    },
    updateOrderStatus: async (orderId, status) => {
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setProductionOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
        return;
      }
      const { error } = await supabase
        .from("pincorp_productionorders")
        .update({ status })
        .eq("id", orderId);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi cập nhật trạng thái",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setProductionOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
    },
    completeOrder: async (orderId) => {
      // Offline-first guard
      if (IS_OFFLINE_MODE) {
        const order = ctx.productionOrders.find((o) => o.id === orderId);
        if (!order) return;
        const bom = ctx.pinBOMs.find((b) => b.id === order.bomId);
        if (!bom) return;

        const producedQty = Number(order.quantityProduced || 0);
        if (producedQty <= 0) return;

        // Deduct materials locally
        for (const bomItem of bom.materials || []) {
          const material = ctx.pinMaterials.find(
            (m) => m.id === bomItem.materialId
          );
          if (!material) continue;
          const required = Number(bomItem.quantity || 0) * producedQty;
          const newStock = (material.stock || 0) - required;
          if (newStock < 0) {
            ctx.addToast?.({
              title: "Không đủ nguyên liệu",
              message: `Nguyên liệu "${material.name}" không đủ. Tồn kho: ${material.stock}, Cần: ${required}`,
              type: "error",
            });
            return;
          }
          ctx.setPinMaterials((prev) =>
            prev.map((m) =>
              m.id === material.id ? { ...m, stock: newStock } : m
            )
          );
        }

        // Mark order completed in memory
        ctx.setProductionOrders((prev) =>
          prev.map((o) =>
            o.id === orderId ? { ...o, status: "Hoàn thành" } : o
          )
        );

        // Upsert product locally
        const existingProd = ctx.pinProducts.find(
          (p) => p.sku === (bom as any).productSku
        );
        const prodId =
          existingProd?.id ||
          (bom as any).id ||
          `OFFLINE-${(bom as any).productSku}`;
        const oldStock = existingProd?.stock || 0;
        const oldCost = existingProd?.costPrice || 0;
        const totalCost = Number(order.totalCost || 0);
        const newStock = oldStock + producedQty;
        const newCost =
          newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

        const updated: PinProduct = {
          id: prodId,
          name: (bom as any).productName,
          sku: (bom as any).productSku,
          stock: newStock,
          costPrice: isFinite(newCost) ? newCost : oldCost,
          sellingPrice: existingProd?.sellingPrice || 0,
        } as PinProduct;

        ctx.setPinProducts((prev) => {
          const idx = prev.findIndex((p) => p.id === prodId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [updated, ...prev];
        });

        ctx.addToast?.({
          title: "Hoàn thành sản xuất (Offline)",
          message: `Đã hoàn thành sản xuất ${producedQty} ${
            (bom as any).productName
          }`,
          type: "success",
        });
        return;
      }

      // Online path - persist changes
      const order = ctx.productionOrders.find((o) => o.id === orderId);
      if (!order) {
        ctx.addToast?.({
          title: "Không tìm thấy lệnh sản xuất",
          message: "Lệnh sản xuất không tồn tại.",
          type: "error",
        });
        return;
      }
      if (order.status === "Hoàn thành") {
        ctx.addToast?.({
          title: "Lệnh đã hoàn thành",
          message: "Lệnh sản xuất này đã được hoàn thành trước đó.",
          type: "warn",
        });
        return;
      }
      const bom = ctx.pinBOMs.find((b) => b.id === order.bomId);
      if (!bom) {
        ctx.addToast?.({
          title: "Không tìm thấy BOM",
          message: "BOM không tồn tại cho lệnh sản xuất này.",
          type: "error",
        });
        return;
      }
      const producedQty = Number(order.quantityProduced || 0);
      if (producedQty <= 0) {
        ctx.addToast?.({
          title: "Số lượng sản xuất không hợp lệ",
          message: "Số lượng sản xuất phải > 0.",
          type: "error",
        });
        return;
      }

      // 1) Deduct materials with persistence via upsertPinMaterial
      for (const bomItem of bom.materials || []) {
        const material = ctx.pinMaterials.find(
          (m) => m.id === bomItem.materialId
        );
        if (!material) continue;
        const required = Number(bomItem.quantity || 0) * producedQty;
        const newStock = (material.stock || 0) - required;
        if (newStock < 0) {
          ctx.addToast?.({
            title: "Không đủ nguyên liệu",
            message: `Nguyên liệu "${material.name}" không đủ. Tồn kho: ${material.stock}, Cần: ${required}`,
            type: "error",
          });
          return;
        }

        // Persist material change directly (avoid ctx dependency)
        try {
          if (!IS_OFFLINE_MODE) {
            await supabase
              .from("pincorp_materials")
              .update({ stock: newStock })
              .eq("id", material.id);
          }
        } catch {}
        // Update local state
        ctx.setPinMaterials((prev) =>
          prev.map((m) =>
            m.id === material.id ? { ...m, stock: newStock } : m
          )
        );

        // Record stock history (export)
        const historyPayload = {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          material_id: material.id,
          transaction_type: "export",
          quantity_change: -required,
          quantity_before: material.stock,
          quantity_after: newStock,
          reason: `Sản xuất: ${(bom as any).productName} (${order.id})`,
          created_by: ctx.currentUser?.id,
          created_at: new Date().toISOString(),
        } as any;
        try {
          await supabase.from("pincorp_stock_history").insert(historyPayload);
        } catch (e) {
          console.warn("Không thể ghi lịch sử kho:", e);
        }
      }

      // 2) Mark order as completed in DB
      const { error: updateError } = await supabase
        .from("pincorp_productionorders")
        .update({ status: "Hoàn thành" })
        .eq("id", orderId);
      if (updateError) {
        ctx.addToast?.({
          title: "Lỗi hoàn thành lệnh sản xuất",
          message: updateError.message || String(updateError),
          type: "error",
        });
        return;
      }

      // 3) Upsert finished product via existing context helper (handles normalize + RLS)
      const existingProd = ctx.pinProducts.find(
        (p) => p.sku === (bom as any).productSku
      );
      const prodId =
        existingProd?.id || (bom as any).id || `PINP-${Date.now()}`;
      const oldStock = existingProd?.stock || 0;
      const oldCost = existingProd?.costPrice || 0;
      const totalCost = Number(order.totalCost || 0);
      const newStock = oldStock + producedQty;
      const newCost =
        newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

      const product: PinProduct = {
        id: prodId,
        name: (bom as any).productName,
        sku: (bom as any).productSku,
        stock: newStock,
        costPrice: isFinite(newCost) ? newCost : oldCost,
        sellingPrice: existingProd?.sellingPrice || 0,
      } as PinProduct;
      const ok = await persistProduct(product);

      // 4) Local state updates
      ctx.setProductionOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "Hoàn thành" } : o))
      );
      if (ok) {
        ctx.setPinProducts((prev) => {
          const idx = prev.findIndex((p) => p.id === prodId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = product;
            return next;
          }
          return [product, ...prev];
        });
      }

      ctx.addToast?.({
        title: "Hoàn thành sản xuất",
        message: `Đã hoàn thành sản xuất ${producedQty} ${
          (bom as any).productName
        }. Tồn kho: ${oldStock} → ${newStock}`,
        type: "success",
      });
    },
    syncProductsFromCompletedOrders: async () => {
      if (syncRunning) {
        ctx.addToast?.({
          title: "Đang đồng bộ",
          message: "Vui lòng đợi quá trình hiện tại hoàn tất.",
          type: "info",
        });
        return;
      }
      syncRunning = true;

      if (!ctx.currentUser && !IS_OFFLINE_MODE) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để đồng bộ sản phẩm.",
          type: "warn",
        });
        syncRunning = false;
        return;
      }

      const completedOrders = ctx.productionOrders.filter(
        (o) => o.status === "Hoàn thành"
      );
      if (completedOrders.length === 0) {
        ctx.addToast?.({
          title: "Không có đơn hoàn thành",
          message: "Không có đơn sản xuất nào đã hoàn thành để đồng bộ.",
          type: "info",
        });
        syncRunning = false;
        return;
      }

      const productMap = new Map<string, PinProduct>();
      ctx.pinProducts.forEach((p) => productMap.set(p.sku, p));

      let syncedCount = 0;
      for (const order of completedOrders) {
        const bom = ctx.pinBOMs.find((b) => b.id === order.bomId);
        if (!bom) continue;

        const producedQty = Number(order.quantityProduced || 0);
        const totalCost = Number(order.totalCost || 0);

        // Prefer current BOM SKU, fallback by product name for legacy
        let existingProduct =
          productMap.get((bom as any).productSku) ||
          ctx.pinProducts.find((p) => p.name === (bom as any).productName);

        // Ensure SKU format TP-ddmmyyyy-xxx; migrate if needed
        const tpPattern = /^TP-\d{8}-\d{3}$/;
        let effectiveSku: string = (bom as any).productSku;
        if (!tpPattern.test(effectiveSku || "")) {
          const existingSkuList = Array.from(productMap.values()).map((p) => ({
            sku: p.sku,
          }));
          effectiveSku = generateProductSKU(existingSkuList);
          // Try to persist new SKU; non-blocking on error
          try {
            await supabase.from("pincorp_boms").upsert({
              id: (bom as any).id,
              productname: (bom as any).productName,
              productsku: effectiveSku,
              materials: (bom as any).materials || [],
              notes: (bom as any).notes || null,
            });
            // update state map for boms
            ctx.setBoms((prev: any[]) =>
              prev.map((b: any) =>
                b.id === (bom as any).id
                  ? { ...(b as any), productSku: effectiveSku }
                  : b
              )
            );
          } catch {}
        }

        const oldStock = existingProduct?.stock || 0;
        const oldCost = existingProduct?.costPrice || 0;
        const newStock = oldStock + producedQty;
        const newCost =
          newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

        const product: PinProduct = {
          id: existingProduct?.id || (bom as any).id || `PINP-${Date.now()}`,
          name: (bom as any).productName,
          sku: effectiveSku,
          stock: newStock,
          costPrice: isFinite(newCost) ? newCost : oldCost,
          retailPrice:
            (existingProduct as any)?.retailPrice ||
            (existingProduct as any)?.sellingPrice ||
            Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2),
          wholesalePrice:
            (existingProduct as any)?.wholesalePrice ||
            Math.round(
              ((existingProduct as any)?.retailPrice ||
                Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2)) * 0.9
            ),
          sellingPrice:
            (existingProduct as any)?.sellingPrice ||
            Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2),
        } as PinProduct;

        if (IS_OFFLINE_MODE) {
          productMap.set(product.sku, product);
          syncedCount++;
          // mark as synced locally
          ctx.setProductionOrders((prev) =>
            prev.map((o) =>
              o.id === order.id ? { ...o, status: "Đã nhập kho" } : o
            )
          );
        } else {
          try {
            const ok = await persistProduct(product);
            if (ok) {
              productMap.set(product.sku, product);
              syncedCount++;
            } else {
              // do not count as synced if persist failed
            }
            // Update order status in DB and state
            try {
              const { error: statusErr } = await supabase
                .from("pincorp_productionorders")
                .update({ status: "Đã nhập kho" })
                .eq("id", order.id);
              if (!statusErr) {
                ctx.setProductionOrders((prev) =>
                  prev.map((o) =>
                    o.id === order.id ? { ...o, status: "Đã nhập kho" } : o
                  )
                );
              }
            } catch {}
          } catch (e: any) {
            ctx.addToast?.({
              title: "Lỗi lưu sản phẩm",
              message: `Không thể lưu ${product.name}: ${e?.message || e}`,
              type: "error",
            });
          }
        }
      }

      // Update memory state with merged map
      ctx.setPinProducts(Array.from(productMap.values()));
      ctx.addToast?.({
        title: "Đồng bộ thành phẩm thành công",
        message: `Đã đồng bộ ${syncedCount}/${completedOrders.length} sản phẩm và lưu vào cơ sở dữ liệu`,
        type: "success",
      });
      syncRunning = false;
    },
    updateProduct: async (product) => {
      await persistProduct(product);
    },
    removeProductAndReturnMaterials: async (product, quantityToRemove) => {
      // Normalize quantity
      const qtyRequested = Math.max(
        1,
        Math.floor(Number(quantityToRemove) || 0)
      );
      const qty = Math.min(
        qtyRequested,
        Math.max(0, Number(product.stock || 0))
      );
      if (qty <= 0) {
        ctx.addToast?.({
          title: "Số lượng không hợp lệ",
          message: "Số lượng xoá phải > 0 và không vượt quá tồn kho.",
          type: "warn",
        });
        return;
      }

      // Helper: return materials for qty based on BOM
      const returnMaterialsForQty = async (qtyToReturn: number) => {
        const bom = ctx.pinBOMs.find(
          (b) => b.productSku === product.sku || b.productName === product.name
        );
        if (!bom) {
          ctx.addToast?.({
            title: "Không tìm thấy BOM",
            message:
              "Không thể hoàn kho NVL vì không tìm thấy công thức tương ứng.",
            type: "warn",
          });
          return;
        }
        const returnMap = new Map<string, number>();
        (bom.materials || []).forEach((m) => {
          const q = (m.quantity || 0) * qtyToReturn;
          if (q > 0)
            returnMap.set(m.materialId, (returnMap.get(m.materialId) || 0) + q);
        });
        if (returnMap.size === 0) return;

        // Apply to state and persist via upsertPinMaterial
        ctx.setPinMaterials((prev) =>
          prev.map((mat) =>
            returnMap.has(mat.id)
              ? {
                  ...mat,
                  stock: (mat.stock || 0) + (returnMap.get(mat.id) || 0),
                }
              : mat
          )
        );
        // Persist each material change (online only)
        if (!IS_OFFLINE_MODE) {
          for (const [materialId, delta] of returnMap.entries()) {
            const mat = ctx.pinMaterials.find((m) => m.id === materialId);
            if (mat) {
              try {
                await supabase
                  .from("pincorp_materials")
                  .update({ stock: (mat.stock || 0) + delta })
                  .eq("id", materialId);
              } catch {}
            }
          }
        }
      };

      if (IS_OFFLINE_MODE) {
        await returnMaterialsForQty(qty);
        const remaining = Math.max(0, (product.stock || 0) - qty);
        if (remaining === 0) {
          ctx.setPinProducts((prev) => prev.filter((p) => p.id !== product.id));
        } else {
          ctx.setPinProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, stock: remaining } : p
            )
          );
        }
        return;
      }

      // Online path
      await returnMaterialsForQty(qty);
      const remaining = Math.max(0, (product.stock || 0) - qty);
      if (remaining === 0) {
        // Cancel related completed orders to avoid re-sync, then delete product
        const relatedOrders = ctx.productionOrders.filter((o) => {
          const bom = ctx.pinBOMs.find((b) => b.id === o.bomId);
          return (
            bom &&
            ((bom as any).productSku === product.sku ||
              (bom as any).productName === product.name) &&
            o.status === "Hoàn thành"
          );
        });

        for (const order of relatedOrders) {
          const { error: orderErr } = await supabase
            .from("pincorp_productionorders")
            .update({ status: "Đã hủy" })
            .eq("id", order.id);
          if (!orderErr) {
            ctx.setProductionOrders((prev) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: "Đã hủy" } : o
              )
            );
          }
        }

        const { error: delErr } = await supabase
          .from("pincorp_products")
          .delete()
          .eq("id", product.id);
        if (delErr) {
          ctx.addToast?.({
            title: "Lỗi xoá",
            message: delErr.message || String(delErr),
            type: "error",
          });
          return;
        }
        ctx.setPinProducts((prev) => prev.filter((p) => p.id !== product.id));
        ctx.addToast?.({
          title: "Đã xoá thành phẩm",
          message: `${product.name} (xóa ${qty}) và hủy ${relatedOrders.length} lệnh sản xuất liên quan`,
          type: "success",
        });
      } else {
        // Partial: update product stock
        const ok = await persistProduct({
          ...product,
          stock: remaining,
        } as PinProduct);
        if (ok) {
          ctx.setPinProducts((prev) =>
            prev.map((p) =>
              p.id === product.id ? { ...p, stock: remaining } : p
            )
          );
        }
        ctx.addToast?.({
          title: "Đã cập nhật tồn kho",
          message: `${product.name}: -${qty}, còn ${remaining}`,
          type: "success",
        });
      }
    },
  };
}
