import type { PinContextType } from "../../contexts/types";
import type { PinRepairOrder, PinProduct, PinMaterial, CashTransaction } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";

export interface RepairService {
  addRepairOrder: (order: PinRepairOrder) => Promise<void>;
  updateRepairOrder: (order: PinRepairOrder) => Promise<void>;
  deleteRepairOrder: (orderId: string) => Promise<void>;
  upsertPinRepairOrder: (order: PinRepairOrder) => Promise<void>;
}

interface DBPinRepairOrder {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  product_id: string;
  product_name: string;
  problem_description: string;
  status: string;
  estimated_cost: number;
  actual_cost?: number;
  deposit_amount?: number;
  materials_used?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  user_id?: string;
  user_name?: string;
}

export function createRepairService(ctx: PinContextType): RepairService {
  return {
    addRepairOrder: async (order) => {
      if (IS_OFFLINE_MODE) {
        ctx.setRepairOrders((prev: PinRepairOrder[]) => [order, ...prev]);
        ctx.addToast?.({
          title: "Đã tạo đơn sửa chữa (Offline)",
          message: order.id,
          type: "success",
        });
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để tạo đơn sửa chữa.",
          type: "warn",
        });
        return;
      }

      try {
        const basePayload: DBPinRepairOrder = {
          id: order.id,
          customer_name: order.customerName,
          customer_phone: order.customerPhone || "",
          customer_address: order.customerAddress || "",
          product_id: order.productId || "",
          product_name: order.productName,
          problem_description: order.problemDescription,
          status: order.status,
          estimated_cost: order.estimatedCost || 0,
          actual_cost: order.actualCost,
          deposit_amount: order.depositAmount || 0,
          materials_used: JSON.stringify(order.materialsUsed ?? []),
          notes: order.notes,
          created_at: order.createdAt,
          updated_at: order.updatedAt,
          completed_at: order.completedAt,
          user_id: ctx.currentUser?.id ?? "",
          user_name: ctx.currentUser?.name ?? "",
        };

        const { error: insertErr } = await supabase.from("pin_repair_orders").insert(basePayload);

        if (insertErr) {
          ctx.addToast?.({
            title: "Lỗi lưu đơn sửa chữa",
            message: insertErr.message || String(insertErr),
            type: "error",
          });
          return;
        }

        ctx.setRepairOrders((prev: PinRepairOrder[]) => [order, ...prev]);
        ctx.addToast?.({
          title: "Đã tạo đơn sửa chữa",
          message: order.id,
          type: "success",
        });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Exception inserting repair order:", e);
        ctx.addToast?.({
          title: "Lỗi lưu đơn sửa chữa",
          message: errorMessage,
          type: "error",
        });
      }
    },

    updateRepairOrder: async (order) => {
      if (IS_OFFLINE_MODE) {
        ctx.setRepairOrders((prev: PinRepairOrder[]) =>
          prev.map((o: PinRepairOrder) => (o.id === order.id ? order : o))
        );
        ctx.addToast?.({
          title: "Đã cập nhật đơn (Offline)",
          message: order.id,
          type: "success",
        });
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để sửa đơn sửa chữa.",
          type: "warn",
        });
        return;
      }

      try {
        const updatePayload: Partial<DBPinRepairOrder> = {
          customer_name: order.customerName,
          customer_phone: order.customerPhone || "",
          customer_address: order.customerAddress || "",
          product_id: order.productId || "",
          product_name: order.productName,
          problem_description: order.problemDescription,
          status: order.status,
          estimated_cost: order.estimatedCost || 0,
          actual_cost: order.actualCost,
          deposit_amount: order.depositAmount || 0,
          materials_used: JSON.stringify(order.materialsUsed ?? []),
          notes: order.notes,
          updated_at: new Date().toISOString(),
          completed_at: order.completedAt,
        };

        const { error: upErr } = await supabase
          .from("pin_repair_orders")
          .update(updatePayload)
          .eq("id", order.id);

        if (upErr) {
          ctx.addToast?.({
            title: "Lỗi cập nhật đơn sửa chữa",
            message: upErr.message || String(upErr),
            type: "error",
          });
          return;
        }

        // Deduct materials used if order is completed (check Vietnamese status)
        const completedStatuses = ["completed", "Đã sửa xong", "Trả máy"];
        if (completedStatuses.includes(order.status) && order.materialsUsed) {
          for (const m of order.materialsUsed) {
            const mat = ctx.pinMaterials.find(
              (material: PinMaterial) => material.id === m.materialId
            );
            if (!mat) continue;
            const remaining = Math.max(0, (mat.stock || 0) - (m.quantity || 0));
            await supabase
              .from("pin_materials")
              .update({ stock: remaining })
              .eq("id", m.materialId);
            ctx.setPinMaterials((prev: PinMaterial[]) =>
              prev.map((material: PinMaterial) =>
                material.id === m.materialId ? { ...material, stock: remaining } : material
              )
            );
          }
        }

        // Create cash transaction for payment
        const paidStatuses = ["paid", "partial"];
        if (paidStatuses.includes(order.paymentStatus || "") && ctx.addCashTransaction) {
          // Check if cash transaction already exists for this repair
          const existingTx = ctx.cashTransactions?.find(
            (t: CashTransaction) => t.workOrderId === order.id
          );
          
          // Calculate payment amount
          let paymentAmount = 0;
          if (order.paymentStatus === "paid") {
            paymentAmount = order.total || 0;
          } else if (order.paymentStatus === "partial") {
            paymentAmount = (order.depositAmount || 0) + (order.partialPaymentAmount || 0);
          }
          
          // Only create/update if there's a payment and no existing transaction
          if (paymentAmount > 0 && !existingTx) {
            const cashTx: CashTransaction = {
              id: `CT-REPAIR-${Date.now()}`,
              type: "income",
              date: new Date().toISOString(),
              amount: paymentAmount,
              contact: {
                id: order.customerPhone || order.id,
                name: order.customerName || "Khách sửa chữa",
              },
              notes: `Thu tiền sửa chữa: ${order.deviceName || order.productName || "Thiết bị"} - ${order.id} #app:pincorp`,
              paymentSourceId: order.paymentMethod || "cash",
              branchId: "main",
              workOrderId: order.id,
              category: "service_income",
            };
            await ctx.addCashTransaction(cashTx);
          }
        }

        ctx.setRepairOrders((prev: PinRepairOrder[]) =>
          prev.map((o: PinRepairOrder) => (o.id === order.id ? order : o))
        );
        ctx.addToast?.({
          title: "Đã cập nhật đơn sửa chữa",
          message: order.id,
          type: "success",
        });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Exception updating repair order:", e);
        ctx.addToast?.({
          title: "Lỗi cập nhật đơn sửa chữa",
          message: errorMessage,
          type: "error",
        });
      }
    },

    deleteRepairOrder: async (orderId) => {
      if (IS_OFFLINE_MODE) {
        ctx.setRepairOrders((prev: PinRepairOrder[]) =>
          prev.filter((o: PinRepairOrder) => o.id !== orderId)
        );
        ctx.addToast?.({
          title: "Đã xoá đơn sửa chữa (Offline)",
          message: orderId,
          type: "success",
        });
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để xoá đơn sửa chữa.",
          type: "warn",
        });
        return;
      }

      try {
        const { error: delErr } = await supabase
          .from("pin_repair_orders")
          .delete()
          .eq("id", orderId);

        if (delErr) {
          ctx.addToast?.({
            title: "Lỗi xoá đơn sửa chữa",
            message: delErr.message || String(delErr),
            type: "error",
          });
          return;
        }

        ctx.setRepairOrders((prev: PinRepairOrder[]) =>
          prev.filter((o: PinRepairOrder) => o.id !== orderId)
        );
        ctx.addToast?.({
          title: "Đã xoá đơn sửa chữa",
          message: orderId,
          type: "success",
        });
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        console.error("Exception deleting repair order:", e);
        ctx.addToast?.({
          title: "Lỗi xoá đơn sửa chữa",
          message: errorMessage,
          type: "error",
        });
      }
    },

    upsertPinRepairOrder: async (order) => {
      // Check if order exists
      const existing = ctx.pinRepairOrders?.find((o: PinRepairOrder) => o.id === order.id);
      if (existing) {
        // Update existing order
        const service = createRepairService(ctx);
        await service.updateRepairOrder(order);
      } else {
        // Add new order
        const service = createRepairService(ctx);
        await service.addRepairOrder(order);
      }
    },
  };
}
