import type { CashTransaction, PinRepairOrder } from "../../types";
import type { PinContextType } from "../../contexts/types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";

function genId(prefix: string) {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface RepairService {
  upsertPinRepairOrder: (
    order: PinRepairOrder,
    newCashTx?: CashTransaction
  ) => Promise<void>;
  deletePinRepairOrder: (orderId: string) => Promise<void>;
}

export function createRepairService(ctx: PinContextType): RepairService {
  return {
    upsertPinRepairOrder: async (order, newCashTx) => {
      if (IS_OFFLINE_MODE) {
        ctx.setRepairOrders((prev: any[]) => {
          const idx = prev.findIndex((o: any) => o.id === order.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = order;
            return next;
          }
          return [order, ...prev];
        });
        if (newCashTx)
          await (ctx as any).addCashTransaction?.({
            ...newCashTx,
            notes: `${
              newCashTx.notes ? newCashTx.notes + " " : ""
            }#app:pincorp`,
          });
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để lưu repair order.",
          type: "warn",
        });
        return;
      }

      try {
        // 1) Deduct materials used (export from stock) and write stock history
        if (order.materialsUsed && order.materialsUsed.length > 0) {
          for (const material of order.materialsUsed) {
            const stockMaterial = ctx.pinMaterials.find(
              (m: any) =>
                m.name === material.materialName ||
                (m as any).id === material.materialName ||
                m.id === material.materialId
            );
            if (!stockMaterial) continue;
            const newStock =
              (stockMaterial.stock || 0) - (material.quantity || 0);
            if (newStock < 0) {
              ctx.addToast?.({
                title: "Không đủ vật tư",
                message: `Vật tư "${stockMaterial.name}" không đủ. Tồn kho: ${stockMaterial.stock}, Cần: ${material.quantity}`,
                type: "error",
              });
              return;
            }
            const { error: updErr } = await supabase
              .from("pin_materials")
              .update({ stock: newStock })
              .eq("id", stockMaterial.id);
            if (updErr) {
              ctx.addToast?.({
                title: "Lỗi cập nhật vật tư",
                message: `Không thể cập nhật tồn kho cho "${stockMaterial.name}"`,
                type: "error",
              });
              return;
            }
            // local state
            ctx.setPinMaterials((prev: any[]) =>
              prev.map((m: any) =>
                m.id === stockMaterial.id ? { ...m, stock: newStock } : m
              )
            );
            // stock history
            const history = {
              id: genId("HIST-"),
              material_id: stockMaterial.id,
              transaction_type: "export",
              quantity_change: -(material.quantity || 0),
              quantity_before: stockMaterial.stock || 0,
              quantity_after: newStock,
              reason: `Sửa chữa: ${order.customerName} - ${order.deviceName} (${order.id})`,
              created_by: ctx.currentUser?.id,
              created_at: new Date().toISOString(),
            } as any;
            await supabase.from("pin_stock_history").insert(history);
          }
        }

        // 2) Build payload for pin_repair_orders (snake_case)
        // Ensure required fields are not null
        if (!order.deviceName) {
          ctx.addToast?.({
            title: "Lỗi dữ liệu",
            message: "Thiếu thông tin tên thiết bị (deviceName)",
            type: "error",
          });
          return;
        }

        const basePayload: any = {
          id: order.id,
          creation_date: order.creationDate,
          customer_name: order.customerName || "Khách lẻ",
          customer_phone: order.customerPhone || "",
          device_name: order.deviceName,
          issue_description: order.issueDescription || "",
          technician_name: order.technicianName ?? null,
          status: order.status,
          // Let Supabase map JSON automatically; avoid stringifying to reduce type issues
          materials_used: order.materialsUsed ?? null,
          labor_cost: order.laborCost ?? 0,
          total: order.total ?? 0,
          notes: order.notes ?? null,
          payment_status: order.paymentStatus,
          partial_payment_amount: order.partialPaymentAmount ?? null,
          deposit_amount: order.depositAmount ?? null,
          payment_method: order.paymentMethod ?? null,
          payment_date: order.paymentDate ?? null,
          cash_transaction_id: order.cashTransactionId ?? null,
        };

        // Resilient upsert: if DB is missing optional columns (e.g., cash_transaction_id),
        // retry by removing the offending column up to 3 times.
        const tryUpsert = async () => {
          let attempt = 0;
          let payload = { ...basePayload };
          while (attempt < 3) {
            const { error } = await supabase
              .from("pin_repair_orders")
              .upsert(payload);
            if (!error) return { ok: true } as const;

            const msg = (error as any)?.message || String(error);
            // Detect missing column messages
            const colMatch = msg.match(
              /'([^']+)' column|column\s+"?([a-zA-Z0-9_]+)"?\s+does not exist/i
            );
            const missingCol = colMatch?.[1] || colMatch?.[2];
            if (missingCol && missingCol in payload) {
              // Remove the missing column and retry
              delete (payload as any)[missingCol];
              attempt += 1;
              continue;
            }
            // Specific fallback for cash_transaction_id common in older schemas
            if (
              /cash_transaction_id/i.test(msg) &&
              "cash_transaction_id" in payload
            ) {
              delete (payload as any)["cash_transaction_id"];
              attempt += 1;
              continue;
            }
            // Give up if we can't sanitize further
            return { ok: false, error } as const;
          }
          return {
            ok: false,
            error: new Error("Exceeded retry attempts"),
          } as const;
        };

        const result = await tryUpsert();
        if (!result.ok) {
          const repErr: any = (result as any).error;
          ctx.addToast?.({
            title: "Lỗi lưu repair order",
            message: repErr?.message || String(repErr),
            type: "error",
          });
          return;
        }
        // local state
        ctx.setRepairOrders((prev: any[]) => {
          const idx = prev.findIndex((o: any) => o.id === order.id);
          if (idx > -1)
            return prev.map((o: any) => (o.id === order.id ? order : o));
          return [order, ...prev];
        });
        ctx.addToast?.({
          title: "Đã lưu repair order",
          message: order.id,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception while saving repair order:", e);
        ctx.addToast?.({
          title: "Lỗi lưu repair order",
          message: e?.message || String(e),
          type: "error",
        });
        return;
      }

      if (newCashTx)
        await (ctx as any).addCashTransaction?.({
          ...newCashTx,
          notes: `${newCashTx.notes ? newCashTx.notes + " " : ""}#app:pincorp`,
        });
    },

    deletePinRepairOrder: async (orderId) => {
      if (IS_OFFLINE_MODE) {
        ctx.setRepairOrders((prev: any[]) =>
          prev.filter((o: any) => o.id !== orderId)
        );
        return;
      }
      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để xoá.",
          type: "warn",
        });
        return;
      }
      try {
        const { error } = await supabase
          .from("pin_repair_orders")
          .delete()
          .eq("id", orderId);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi xoá repair order",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setRepairOrders((prev: any[]) =>
          prev.filter((o: any) => o.id !== orderId)
        );
        ctx.addToast?.({
          title: "Đã xoá repair order",
          message: orderId,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception deleting repair order:", e);
        ctx.addToast?.({
          title: "Lỗi xoá repair order",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },
  };
}
