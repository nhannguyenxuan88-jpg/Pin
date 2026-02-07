import type { PinContextType } from "../../contexts/types";
import type { PinBOM, ProductionOrder, PinProduct, PinMaterial } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import { generateProductSKU } from "../../lib/sku";

let syncRunning = false;

const isMissingRpcError = (message: string): boolean => {
  const m = (message || "").toLowerCase();
  return (
    m.includes("does not exist") ||
    (m.includes("function") && m.includes("pin_adjust_material_stock") && m.includes("not"))
  );
};

const uuidV4 = (): string => {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) return (crypto as any).randomUUID();
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  // Fallback: UUID-shaped string
  const rnd = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  const a = rnd() + rnd();
  const b = rnd();
  const c = ("4" + rnd().slice(1)).slice(0, 4) + rnd().slice(4, 8);
  const d = ((8 + Math.floor(Math.random() * 4)).toString(16) + rnd().slice(1)).slice(0, 4) + rnd().slice(4, 8);
  const e = rnd() + rnd() + rnd();
  return `${a.slice(0, 8)}-${a.slice(8, 12)}-${b.slice(0, 4)}-${d.slice(0, 4)}-${e.slice(0, 12)}`;
};

// Helper to convert date formats (dd/MM/yyyy -> yyyy-MM-dd for PostgreSQL)
const toPostgresDate = (dateStr: string | undefined): string => {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  // Check if already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return dateStr.split('T')[0];
  }
  // Convert from dd/MM/yyyy format
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return new Date().toISOString().split('T')[0];
};

export interface ProductionService {
  upsertBOM: (bom: PinBOM) => Promise<void>;
  deleteBOM: (bomId: string) => Promise<void>;
  addOrder: (order: ProductionOrder, bom: PinBOM) => Promise<void>;
  updateOrderStatus: (orderId: string, status: ProductionOrder["status"]) => Promise<void>;
  completeOrder: (orderId: string) => Promise<void>;
  syncProductsFromCompletedOrders: () => Promise<void>;
  updateProduct: (product: PinProduct) => Promise<void>;
  removeProductAndReturnMaterials: (product: PinProduct, quantityToRemove: number) => Promise<void>;
}

interface DBPinProduct {
  id: string;
  name: string;
  sku: string;
  stock: number;
  cost_price: number;
  retail_price: number;
  wholesale_price: number;
  category_id?: string | null;
}

interface DBPinBOM {
  id?: string;
  product_name: string;
  product_sku: string;
  materials: PinBOM["materials"];
  notes?: string | null;
}

interface DBProductionOrder {
  id: string;
  creation_date?: string;
  product_name: string;
  bom_id: string;
  quantity_produced: number;
  materials_cost: number;
  additional_costs?: any[];
  total_cost: number;
  status: string;
  notes?: string | null;
  user_name?: string | null;
}

function isValidUUID(v: string | undefined): boolean {
  return (
    !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v)
  );
}

export function createProductionService(ctx: PinContextType): ProductionService {
  const adjustMaterialStockSafe = async (
    materialId: string,
    delta: number,
    materialName: string
  ): Promise<{ ok: true; nextStock?: number } | { ok: false; message: string }> => {
    try {
      const { data, error } = await supabase.rpc("pin_adjust_material_stock", {
        p_material_id: materialId,
        p_delta: delta,
      });
      if (error) {
        if (isMissingRpcError(error.message || "")) {
          // Fallback: non-atomic update (less safe)
          const mat = ctx.pinMaterials.find((m) => m.id === materialId);
          const current = Number(mat?.stock ?? 0);
          const next = current + delta;
          if (next < 0) {
            return {
              ok: false,
              message: `${materialName}: tồn kho ${current}, thay đổi ${delta} (không đủ)`,
            };
          }
          const { error: upErr } = await supabase
            .from("pin_materials")
            .update({ stock: next })
            .eq("id", materialId);
          if (upErr) return { ok: false, message: upErr.message || String(upErr) };
          return { ok: true, nextStock: next };
        }
        return { ok: false, message: error.message || String(error) };
      }
      return { ok: true, nextStock: typeof data === "number" ? data : undefined };
    } catch (e: unknown) {
      return { ok: false, message: e instanceof Error ? e.message : String(e) };
    }
  };

  // Helper: upsert product to DB or state
  const persistProduct = async (product: PinProduct): Promise<boolean> => {
    console.log(`🔧 [persistProduct] Saving "${product.name}" stock=${product.stock}`);
    console.log(`   - IS_OFFLINE_MODE=${IS_OFFLINE_MODE}, currentUser=${!!ctx.currentUser}`);

    if (IS_OFFLINE_MODE || !ctx.currentUser) {
      console.log(`   - Using OFFLINE mode (no DB save)`);
      ctx.setPinProducts((prev: PinProduct[]) => {
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
    // Minimal payload to fit current schema (snake_case)
    const payload: DBPinProduct = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      stock: Number(product.stock ?? 0),
      cost_price: Number(product.costPrice ?? 0),
      retail_price: product.retailPrice ?? product.sellingPrice ?? 0,
      wholesale_price: product.wholesalePrice ?? 0,
      category_id: product.category_id || null,
    };
    console.log(`   - Upserting to DB:`, payload);
    const { error } = await supabase.from("pin_products").upsert(payload);
    if (error) {
      ctx.addToast?.({
        title: "Lỗi lưu sản phẩm",
        message: error.message || String(error),
        type: "error",
      });
      return false;
    }
    ctx.setPinProducts((prev: PinProduct[]) => {
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
        ctx.setBoms((prev: PinBOM[]) => {
          const idx = prev.findIndex((b) => b.id === bom.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = bom;
            return next;
          }
          return [bom, ...prev];
        });
        return;
      }

      // Online: persist to DB (pin_boms) and update state
      const basePayload: DBPinBOM = {
        product_name: bom.productName,
        product_sku: bom.productSku,
        materials: bom.materials || [],
        notes: bom.notes || null,
      };

      // If bom.id is not a valid UUID, insert without id so DB generates one
      if (!isValidUUID(bom.id)) {
        console.log(`🆕 Inserting new BOM: ${bom.productName}`);
        const { data, error } = await supabase
          .from("pin_boms")
          .insert(basePayload)
          .select()
          .single();
        if (error) {
          console.error("❌ Error inserting BOM:", error);
          ctx.addToast?.({
            title: "Lỗi lưu BOM",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        console.log(`✅ BOM inserted with ID: ${data.id}`);
        const newBom: PinBOM = {
          id: data.id,
          productName: data.product_name,
          productSku: data.product_sku,
          materials: data.materials || [],
          notes: data.notes || "",
          created_at: data.created_at,
        };
        ctx.setBoms((prev: PinBOM[]) => {
          // Loại bỏ BOM tạm nếu có (với ID không hợp lệ)
          const filtered = prev.filter((b) => isValidUUID(b.id));
          return [newBom, ...filtered];
        });
        ctx.addToast?.({
          title: "Đã lưu BOM",
          message: `BOM cho sản phẩm "${bom.productName}" đã được lưu`,
          type: "success",
        });
        return;
      }

      // Existing UUID: safe upsert with id
      const payload: DBPinBOM = { id: bom.id, ...basePayload };
      {
        const { error } = await supabase.from("pin_boms").upsert(payload);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi lưu BOM",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
      }
      ctx.setBoms((prev: PinBOM[]) => {
        const idx = prev.findIndex((b) => b.id === bom.id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = bom;
          return next;
        }
        return [bom, ...prev];
      });
      ctx.addToast?.({
        title: "Đã lưu BOM",
        message: `BOM cho sản phẩm "${bom.productName}" đã được lưu`,
        type: "success",
      });
    },
    deleteBOM: async (bomId) => {
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setBoms((prev: PinBOM[]) => prev.filter((b) => b.id !== bomId));
        return;
      }
      const { error } = await supabase.from("pin_boms").delete().eq("id", bomId);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi xoá BOM",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setBoms((prev: PinBOM[]) => prev.filter((b) => b.id !== bomId));
    },
    addOrder: async (order, bom) => {
      // Default status if missing
      const status = (order.status || "Đang chờ") as ProductionOrder["status"];
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setProductionOrders((prev: ProductionOrder[]) => [order, ...prev]);
        ctx.addToast?.({
          title: "Đã tạo lệnh (Offline)",
          message: `${order.productName} - SL: ${order.quantityProduced}`,
          type: "success",
        });
        return;
      }
      const effectiveId = isValidUUID(order.id) ? order.id : uuidV4();
      const normalizedOrder: ProductionOrder = effectiveId === order.id ? order : { ...order, id: effectiveId };

      const payload: DBProductionOrder = {
        id: effectiveId,
        creation_date: toPostgresDate(order.creationDate),
        product_name: order.productName,
        bom_id: order.bomId,
        quantity_produced: Number(order.quantityProduced || 0),
        materials_cost: Number(order.materialsCost || 0),
        additional_costs: order.additionalCosts || [],
        total_cost: Number(order.totalCost || 0),
        status,
        notes: order.notes || null,
        user_name: order.userName || ctx.currentUser?.name || null,
      };
      const { error } = await supabase.from("pin_production_orders").upsert(payload);
      if (error) {
        ctx.addToast?.({
          title: "Lỗi tạo lệnh sản xuất",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      ctx.setProductionOrders((prev: ProductionOrder[]) => [normalizedOrder, ...prev]);
      ctx.addToast?.({
        title: "Đã tạo lệnh sản xuất",
        message: `${order.productName} - SL: ${order.quantityProduced}`,
        type: "success",
      });
    },
    updateOrderStatus: async (orderId, status) => {
      if (IS_OFFLINE_MODE || !ctx.currentUser) {
        ctx.setProductionOrders((prev: ProductionOrder[]) =>
          prev.map((o) => (o.id === orderId ? { ...o, status } : o))
        );
        return;
      }
      const { error } = await supabase
        .from("pin_production_orders")
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
      ctx.setProductionOrders((prev: ProductionOrder[]) =>
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
          const material = ctx.pinMaterials.find((m) => m.id === bomItem.materialId);
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
          ctx.setPinMaterials((prev: PinMaterial[]) =>
            prev.map((m) => (m.id === material.id ? { ...m, stock: newStock } : m))
          );
        }

        // Mark order completed in memory
        ctx.setProductionOrders((prev: ProductionOrder[]) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: "Hoàn thành" as const } : o))
        );

        // Upsert product locally
        const existingProd = ctx.pinProducts.find((p) => p.sku === bom.productSku);
        const prodId = existingProd?.id || bom.id || `OFFLINE-${bom.productSku}`;
        const oldStock = existingProd?.stock || 0;
        const oldCost = existingProd?.costPrice || 0;
        const totalCost = Number(order.totalCost || 0);
        const newStock = oldStock + producedQty;
        const newCost = newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

        const updated: PinProduct = {
          id: prodId,
          name: bom.productName,
          sku: bom.productSku,
          stock: newStock,
          costPrice: isFinite(newCost) ? newCost : oldCost,
          sellingPrice: existingProd?.sellingPrice || 0,
        } as PinProduct;

        ctx.setPinProducts((prev: PinProduct[]) => {
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
          message: `Đã hoàn thành sản xuất ${producedQty} ${bom.productName}`,
          type: "success",
        });
        return;
      }

      // Online path - persist changes
      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để hoàn thành lệnh sản xuất.",
          type: "warn",
        });
        return;
      }
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

      // 1) Pre-check availability from current in-memory snapshot
      const requiredList = (bom.materials || [])
        .map((bomItem) => {
          const material = ctx.pinMaterials.find((m) => m.id === bomItem.materialId);
          const required = Number(bomItem.quantity || 0) * producedQty;
          return { material, required };
        })
        .filter((x) => x.material && x.required > 0) as Array<{ material: PinMaterial; required: number }>;

      for (const { material, required } of requiredList) {
        const currentStock = Number(material.stock ?? 0);
        if (currentStock - required < 0) {
          ctx.addToast?.({
            title: "Không đủ nguyên liệu",
            message: `Nguyên liệu "${material.name}" không đủ. Tồn kho: ${currentStock}, Cần: ${required}`,
            type: "error",
          });
          return;
        }
      }

      // 2) Deduct materials via RPC; rollback if any step fails (best-effort)
      const applied: Array<{ materialId: string; qty: number; materialName: string }> = [];
      for (const { material, required } of requiredList) {
        const res = await adjustMaterialStockSafe(material.id, -required, material.name);
        if (!res.ok) {
          // Rollback what was deducted so far
          for (let i = applied.length - 1; i >= 0; i--) {
            const a = applied[i];
            await adjustMaterialStockSafe(a.materialId, a.qty, a.materialName);
          }
          ctx.addToast?.({
            title: "Không thể trừ kho khi hoàn thành",
            message: res.message,
            type: "error",
          });
          return;
        }
        applied.push({ materialId: material.id, qty: required, materialName: material.name });

        if (typeof res.nextStock === "number") {
          const nextStock = res.nextStock;
          ctx.setPinMaterials((prev: PinMaterial[]) =>
            prev.map((m) => (m.id === material.id ? { ...m, stock: nextStock } : m))
          );
        }

        // Record stock history (export) best-effort
        const historyPayload = {
          id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          material_id: material.id,
          transaction_type: "export",
          quantity_change: -required,
          quantity_before: material.stock,
          quantity_after:
            typeof res.nextStock === "number" ? res.nextStock : Number(material.stock ?? 0) - required,
          reason: `Sản xuất: ${bom.productName} (${order.id})`,
          created_by: ctx.currentUser?.id,
          created_at: new Date().toISOString(),
        };
        try {
          await supabase.from("pin_stock_history").insert(historyPayload);
        } catch (e) {
          console.warn("Không thể ghi lịch sử kho:", e);
        }
      }

      // 3) Mark order as completed in DB
      const { error: updateError } = await supabase
        .from("pin_production_orders")
        .update({ status: "Hoàn thành" })
        .eq("id", orderId);
      if (updateError) {
        // Rollback deducted materials if we couldn't mark completed
        for (let i = applied.length - 1; i >= 0; i--) {
          const a = applied[i];
          await adjustMaterialStockSafe(a.materialId, a.qty, a.materialName);
        }
        ctx.addToast?.({
          title: "Lỗi hoàn thành lệnh sản xuất",
          message: updateError.message || String(updateError),
          type: "error",
        });
        return;
      }

      // 4) Upsert finished product via existing context helper (handles normalize + RLS)
      const existingProd = ctx.pinProducts.find((p) => p.sku === bom.productSku);
      const prodId = existingProd?.id || bom.id || `PINP-${Date.now()}`;
      const oldStock = existingProd?.stock || 0;
      const oldCost = existingProd?.costPrice || 0;
      const totalCost = Number(order.totalCost || 0);
      const newStock = oldStock + producedQty;
      const newCost = newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

      const product: PinProduct = {
        id: prodId,
        name: bom.productName,
        sku: bom.productSku,
        stock: newStock,
        costPrice: isFinite(newCost) ? newCost : oldCost,
        sellingPrice: existingProd?.sellingPrice || 0,
        retailPrice: existingProd?.retailPrice || existingProd?.sellingPrice || 0,
        wholesalePrice: existingProd?.wholesalePrice || 0,
      } as PinProduct;
      const ok = await persistProduct(product);

      // 5) Local state updates
      ctx.setProductionOrders((prev: ProductionOrder[]) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: "Hoàn thành" as const } : o))
      );
      if (ok) {
        ctx.setPinProducts((prev: PinProduct[]) => {
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
        message: `Đã hoàn thành sản xuất ${producedQty} ${bom.productName}. Tồn kho: ${oldStock} → ${newStock}`,
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

      const completedOrders = ctx.productionOrders.filter((o) => o.status === "Hoàn thành");
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

        // Prefer current BOM SKU, fallback by product name in productMap or original state
        // This ensures we find products added in previous iterations of this sync loop
        const findByName = (name: string): PinProduct | undefined => {
          // First check productMap (which includes products added in this sync session)
          for (const [, prod] of productMap) {
            if (prod.name === name) return prod;
          }
          // Fallback to original state
          return ctx.pinProducts.find((p) => p.name === name);
        };
        let existingProduct: PinProduct | undefined =
          productMap.get(bom.productSku) || findByName(bom.productName);

        // Ensure SKU format TP-ddmmyyyy-xxx; migrate if needed
        const tpPattern = /^TP-\d{8}-\d{3}$/;
        let effectiveSku: string = bom.productSku;
        if (!tpPattern.test(effectiveSku || "")) {
          const existingSkuList = Array.from(productMap.values()).map((p) => ({
            sku: p.sku,
          }));
          effectiveSku = generateProductSKU(existingSkuList);
          // Try to persist new SKU; non-blocking on error
          try {
            await supabase.from("pin_boms").upsert({
              id: bom.id,
              product_name: bom.productName,
              product_sku: effectiveSku,
              materials: bom.materials || [],
              notes: bom.notes || null,
            });
            // update state map for boms
            ctx.setBoms((prev: PinBOM[]) =>
              prev.map((b) => (b.id === bom.id ? { ...b, productSku: effectiveSku } : b))
            );
          } catch {
            // Ignore
          }
        }

        const oldStock = existingProduct?.stock || 0;
        const oldCost = existingProduct?.costPrice || 0;
        const newStock = oldStock + producedQty;
        const newCost = newStock > 0 ? (oldCost * oldStock + totalCost) / newStock : oldCost;

        // Debug logs
        console.log(`🔧 [SYNC] Processing order ${order.id} for "${bom.productName}"`);
        console.log(`   - BOM SKU: ${bom.productSku}, Effective SKU: ${effectiveSku}`);
        console.log(`   - Found existing: ${!!existingProduct} (id=${existingProduct?.id})`);
        console.log(`   - Old stock: ${oldStock}, Produced: ${producedQty}, New stock: ${newStock}`);

        const product: PinProduct = {
          id: existingProduct?.id || bom.id || `PINP-${Date.now()}`,
          name: bom.productName,
          sku: effectiveSku,
          stock: newStock,
          costPrice: isFinite(newCost) ? newCost : oldCost,
          retailPrice:
            existingProduct?.retailPrice ||
            existingProduct?.sellingPrice ||
            Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2),
          wholesalePrice:
            existingProduct?.wholesalePrice ||
            Math.round(
              (existingProduct?.retailPrice ||
                Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2)) * 0.9
            ),
          sellingPrice:
            existingProduct?.sellingPrice ||
            Math.round((isFinite(newCost) ? newCost : oldCost) * 1.2),
          category_id: existingProduct?.category_id || undefined,
        } as PinProduct;

        if (IS_OFFLINE_MODE) {
          productMap.set(product.sku, product);
          syncedCount++;
          // mark as synced locally
          ctx.setProductionOrders((prev: ProductionOrder[]) =>
            prev.map((o) =>
              o.id === order.id ? { ...o, status: "Đã nhập kho" as ProductionOrder["status"] } : o
            )
          );
        } else {
          try {
            const ok = await persistProduct(product);
            if (ok) {
              productMap.set(product.sku, product);
              syncedCount++;
            }
            // Update order status in DB and state
            try {
              const { error: statusErr } = await supabase
                .from("pin_production_orders")
                .update({ status: "Đã nhập kho" })
                .eq("id", order.id);
              if (!statusErr) {
                ctx.setProductionOrders((prev: ProductionOrder[]) =>
                  prev.map((o) =>
                    o.id === order.id
                      ? { ...o, status: "Đã nhập kho" as ProductionOrder["status"] }
                      : o
                  )
                );
              }
            } catch {
              // Ignore
            }
          } catch (e: unknown) {
            const errorMessage = e instanceof Error ? e.message : String(e);
            ctx.addToast?.({
              title: "Lỗi lưu sản phẩm",
              message: `Không thể lưu ${product.name}: ${errorMessage}`,
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
      if (!ctx.currentUser && !IS_OFFLINE_MODE) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để xoá/hoàn kho thành phẩm.",
          type: "warn",
        });
        return;
      }

      // Normalize quantity
      const qtyRequested = Math.max(1, Math.floor(Number(quantityToRemove) || 0));
      const qty = Math.min(qtyRequested, Math.max(0, Number(product.stock || 0)));
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
            message: "Không thể hoàn kho NVL vì không tìm thấy công thức tương ứng.",
            type: "warn",
          });
          return;
        }
        const returnMap = new Map<string, number>();
        (bom.materials || []).forEach((m) => {
          const q = (m.quantity || 0) * qtyToReturn;
          if (q > 0) returnMap.set(m.materialId, (returnMap.get(m.materialId) || 0) + q);
        });
        if (returnMap.size === 0) return;

        // OFFLINE: just update local state
        if (IS_OFFLINE_MODE) {
          ctx.setPinMaterials((prev: PinMaterial[]) =>
            prev.map((mat) =>
              returnMap.has(mat.id)
                ? {
                  ...mat,
                  stock: (mat.stock || 0) + (returnMap.get(mat.id) || 0),
                }
                : mat
            )
          );
          return;
        }

        // ONLINE: apply via RPC for atomic increments; rollback on partial failure
        const applied: Array<{ materialId: string; delta: number; materialName: string }> = [];
        for (const [materialId, delta] of returnMap.entries()) {
          const matName = ctx.pinMaterials.find((m) => m.id === materialId)?.name || materialId;
          const res = await adjustMaterialStockSafe(materialId, delta, matName);
          if (!res.ok) {
            // best-effort rollback
            for (const a of applied) {
              await adjustMaterialStockSafe(a.materialId, -a.delta, a.materialName);
            }
            ctx.addToast?.({
              title: "Lỗi hoàn kho NVL",
              message: res.message,
              type: "error",
            });
            throw new Error(res.message);
          }
          applied.push({ materialId, delta, materialName: matName });
        }

        // reflect successful increments locally
        ctx.setPinMaterials((prev: PinMaterial[]) =>
          prev.map((mat) =>
            returnMap.has(mat.id)
              ? {
                ...mat,
                stock: (mat.stock || 0) + (returnMap.get(mat.id) || 0),
              }
              : mat
          )
        );
      };

      if (IS_OFFLINE_MODE) {
        await returnMaterialsForQty(qty);
        const remaining = Math.max(0, (product.stock || 0) - qty);
        if (remaining === 0) {
          ctx.setPinProducts((prev: PinProduct[]) => prev.filter((p) => p.id !== product.id));
        } else {
          ctx.setPinProducts((prev: PinProduct[]) =>
            prev.map((p) => (p.id === product.id ? { ...p, stock: remaining } : p))
          );
        }
        return;
      }

      // Online path
      try {
        await returnMaterialsForQty(qty);
      } catch {
        // Return already toasts; do not proceed with product/order changes
        return;
      }
      const remaining = Math.max(0, (product.stock || 0) - qty);
      if (remaining === 0) {
        // Cancel related completed orders to avoid re-sync, then delete product
        const relatedOrders = ctx.productionOrders.filter((o) => {
          const bom = ctx.pinBOMs.find((b) => b.id === o.bomId);
          return (
            bom &&
            (bom.productSku === product.sku || bom.productName === product.name) &&
            o.status === "Hoàn thành"
          );
        });

        for (const order of relatedOrders) {
          const { error: orderErr } = await supabase
            .from("pin_production_orders")
            .update({ status: "Đã hủy" })
            .eq("id", order.id);
          if (!orderErr) {
            ctx.setProductionOrders((prev: ProductionOrder[]) =>
              prev.map((o) =>
                o.id === order.id ? { ...o, status: "Đã hủy" as ProductionOrder["status"] } : o
              )
            );
          }
        }

        const { error: delErr } = await supabase.from("pin_products").delete().eq("id", product.id);
        if (delErr) {
          ctx.addToast?.({
            title: "Lỗi xoá",
            message: delErr.message || String(delErr),
            type: "error",
          });
          return;
        }
        ctx.setPinProducts((prev: PinProduct[]) => prev.filter((p) => p.id !== product.id));
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
          ctx.setPinProducts((prev: PinProduct[]) =>
            prev.map((p) => (p.id === product.id ? { ...p, stock: remaining } : p))
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
