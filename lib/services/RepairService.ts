import type { CashTransaction, PinRepairOrder } from "../../types";
import type { PinContextType } from "../../../contexts/pincorp/types";
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
        ctx.setRepairOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === order.id);
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
              (m) =>
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
              .from("pincorp_materials")
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
            ctx.setPinMaterials((prev) =>
              prev.map((m) =>
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
            await supabase.from("pincorp_stock_history").insert(history);
          }
        }

        // 2) Build payload for pincorp_repairorders (whitelisted keys)
        const payload: any = {
          id: order.id,
          creationdate: order.creationDate,
          customername: order.customerName,
          customerphone: order.customerPhone,
          devicename: order.deviceName,
          issuedescription: order.issueDescription,
          technicianname: order.technicianName ?? null,
          status: order.status,
          materialsused:
            order.materialsUsed !== undefined
              ? JSON.stringify(order.materialsUsed)
              : null,
          laborcost: order.laborCost,
          total: order.total,
          notes: order.notes ?? null,
          paymentstatus: order.paymentStatus,
          partialpaymentamount: order.partialPaymentAmount ?? null,
          paymentmethod: order.paymentMethod ?? null,
          paymentdate: order.paymentDate ?? null,
          cashtransactionid: order.cashTransactionId ?? null,
        };

        const { error: repErr } = await supabase
          .from("pincorp_repairorders")
          .upsert(payload);
        if (repErr) {
          ctx.addToast?.({
            title: "Lỗi lưu repair order",
            message: repErr.message || String(repErr),
            type: "error",
          });
          return;
        }
        // local state
        ctx.setRepairOrders((prev) => {
          const idx = prev.findIndex((o) => o.id === order.id);
          if (idx > -1) return prev.map((o) => (o.id === order.id ? order : o));
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
        ctx.setRepairOrders((prev) => prev.filter((o) => o.id !== orderId));
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
          .from("pincorp_repairorders")
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
        ctx.setRepairOrders((prev) => prev.filter((o) => o.id !== orderId));
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
