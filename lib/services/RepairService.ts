import type { PinContextType } from "../../contexts/types";
import type { PinRepairOrder, PinMaterial, CashTransaction } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";

export interface RepairService {
  addRepairOrder: (order: PinRepairOrder) => Promise<void>;
  updateRepairOrder: (order: PinRepairOrder) => Promise<void>;
  deleteRepairOrder: (orderId: string) => Promise<void>;
  upsertPinRepairOrder: (order: PinRepairOrder) => Promise<void>;
}

// Database column mapping - match actual Supabase table schema
interface DBPinRepairOrder {
  id: string;
  creation_date: string;
  customer_name: string;
  customer_phone: string;
  device_name?: string;
  issue_description: string;
  technician_name?: string;
  status: string;
  materials_used?: string; // JSONB stored as string
  labor_cost: number;
  total: number;
  notes?: string;
  payment_status: string;
  partial_payment_amount?: number;
  deposit_amount?: number;
  payment_method?: string;
  payment_date?: string;
  due_date?: string;
  cash_transaction_id?: string;
  created_at?: string;
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
          creation_date: order.creationDate,
          customer_name: order.customerName,
          customer_phone: order.customerPhone || "",
          device_name: order.deviceName || "",
          issue_description: order.issueDescription,
          technician_name: order.technicianName || "",
          status: order.status,
          materials_used: JSON.stringify(order.materialsUsed ?? []),
          labor_cost: order.laborCost || 0,
          total: order.total || 0,
          notes: order.notes || "",
          payment_status: order.paymentStatus || "unpaid",
          partial_payment_amount: order.partialPaymentAmount,
          deposit_amount: order.depositAmount || 0,
          payment_method: order.paymentMethod,
          payment_date: order.paymentDate,
          due_date: order.dueDate,
          cash_transaction_id: order.cashTransactionId,
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

        // Create cash transaction for deposit (tiền đặt cọc khi tạo phiếu)
        const depositAmount = order.depositAmount || 0;
        if (depositAmount > 0 && ctx.addCashTransaction) {
          const depositTx: CashTransaction = {
            id: `CT-DEPOSIT-${order.id}-${Date.now()}`,
            type: "income",
            date: new Date().toISOString(),
            amount: depositAmount,
            contact: {
              id: order.customerPhone || order.id,
              name: order.customerName || "Khách sửa chữa",
            },
            notes: `Đặt cọc sửa chữa: ${order.deviceName || "Thiết bị"} - ${order.id} #app:pincorp`,
            paymentSourceId: order.paymentMethod || "cash",
            branchId: "main",
            workOrderId: order.id,
            category: "deposit",
          };
          await ctx.addCashTransaction(depositTx);
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
          device_name: order.deviceName || "",
          issue_description: order.issueDescription,
          technician_name: order.technicianName || "",
          status: order.status,
          materials_used: JSON.stringify(order.materialsUsed ?? []),
          labor_cost: order.laborCost || 0,
          total: order.total || 0,
          notes: order.notes || "",
          payment_status: order.paymentStatus || "unpaid",
          partial_payment_amount: order.partialPaymentAmount,
          deposit_amount: order.depositAmount || 0,
          payment_method: order.paymentMethod,
          payment_date: order.paymentDate,
          due_date: order.dueDate,
          cash_transaction_id: order.cashTransactionId,
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
