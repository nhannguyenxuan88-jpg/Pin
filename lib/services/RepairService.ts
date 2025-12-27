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
  // Báo giá fields
  quoted_at?: string;
  quote_approved_at?: string;
  quote_approved?: boolean;
  quoted_materials_cost?: number;
  quoted_labor_cost?: number;
  quoted_total?: number;
  has_material_shortage?: boolean;
  linked_purchase_order_id?: string;
  materials_deducted?: boolean;
  materials_deducted_at?: string;
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
          materials_used: order.materialsUsed ?? [],
          labor_cost: order.laborCost || 0,
          total: order.total || 0,
          notes: order.notes ? `${order.notes}\n__OUTSOURCING__${JSON.stringify(order.outsourcingItems ?? [])}` : (order.outsourcingItems?.length ? `__OUTSOURCING__${JSON.stringify(order.outsourcingItems)}` : ""),
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
          materials_used: order.materialsUsed ?? [],
          labor_cost: order.laborCost || 0,
          total: order.total || 0,
          // Stores Outsourcing Items JSON in notes for Profit Reporting
          notes: order.notes ? (order.notes.includes("__OUTSOURCING__") ? order.notes : `${order.notes}\n__OUTSOURCING__${JSON.stringify(order.outsourcingItems ?? [])}`) : (order.outsourcingItems?.length ? `__OUTSOURCING__${JSON.stringify(order.outsourcingItems)}` : ""),
          payment_status: order.paymentStatus || "unpaid",
          partial_payment_amount: order.partialPaymentAmount,
          deposit_amount: order.depositAmount || 0,
          payment_method: ['cash', 'bank', 'transfer', 'card'].includes(order.paymentMethod || '') ? order.paymentMethod : undefined,
          payment_date: order.paymentDate,
          due_date: order.dueDate,
          cash_transaction_id: order.cashTransactionId,
          // Báo giá fields
          quoted_at: order.quotedAt,
          quote_approved_at: order.quoteApprovedAt,
          quote_approved: order.quoteApproved,
          quoted_materials_cost: order.quotedMaterialsCost,
          quoted_labor_cost: order.quotedLaborCost,
          quoted_total: order.quotedTotal,
          has_material_shortage: order.hasMaterialShortage,
          linked_purchase_order_id: order.linkedPurchaseOrderId,
          materials_deducted: order.materialsDeducted,
          materials_deducted_at: order.materialsDeductedAt,
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

        // ===== LOGIC TRỪ KHO (MOTOCARE STANDARD) =====
        // Chỉ trừ kho khi status là 'Trả máy' (Hoàn thành & Giao khách)
        const completedStatuses = ["Trả máy", "completed", "Delivered"];

        const shouldDeductMaterials =
          completedStatuses.includes(order.status) &&
          order.materialsUsed &&
          order.materialsUsed.length > 0 &&
          !order.materialsDeducted; // ✅ Chỉ trừ nếu chưa trừ

        if (shouldDeductMaterials) {
          const warnings: string[] = [];

          for (const m of order.materialsUsed!) {
            let mat = ctx.pinMaterials.find(
              (material: PinMaterial) => material.id === m.materialId
            );
            if (!mat && m.materialName) {
              mat = ctx.pinMaterials.find(
                (material: PinMaterial) =>
                  material.name.toLowerCase() === m.materialName.toLowerCase()
              );
            }
            if (!mat) {
              warnings.push(`⚠️ Không tìm thấy vật tư: ${m.materialName}`);
              continue;
            }

            const currentStock = mat.stock || 0;
            const requestedQty = m.quantity || 0;

            if (currentStock < requestedQty) {
              warnings.push(
                `⚠️ ${mat.name}: Tồn kho ${currentStock}, cần ${requestedQty} (thiếu ${requestedQty - currentStock})`
              );
            }

            // Thực hiện trừ kho
            const remaining = currentStock - requestedQty;

            await supabase.from("pin_materials").update({ stock: remaining }).eq("id", mat.id);
            ctx.setPinMaterials((prev: PinMaterial[]) =>
              prev.map((material: PinMaterial) =>
                material.id === mat!.id ? { ...material, stock: remaining } : material
              )
            );
          }

          // Cập nhật flag đã trừ kho
          await supabase
            .from("pin_repair_orders")
            .update({
              materials_deducted: true,
              materials_deducted_at: new Date().toISOString(),
            })
            .eq("id", order.id);

          order.materialsDeducted = true;
          order.materialsDeductedAt = new Date().toISOString();

          if (warnings.length > 0) {
            ctx.addToast?.({
              title: "⚠️ Cảnh báo tồn kho khi trả máy",
              message: warnings.join("\n"),
              type: "warn",
            });
          }
        }

        // ===== LOGIC THANH TOÁN (Atomic Simulation) =====
        // 1. Check existing transactions
        const existingTxs = ctx.cashTransactions?.filter(t => t.workOrderId === order.id) || [];

        // 2. Handle Deposit Transaction (if added/changed)
        const depositAmount = order.depositAmount || 0;
        const hasDepositTx = existingTxs.some(t => t.category === 'deposit' || t.notes?.toLowerCase().includes('đặt cọc'));

        if (depositAmount > 0 && !hasDepositTx && ctx.addCashTransaction) {
          const depositTx: CashTransaction = {
            id: `CT-DEPOSIT-${order.id}-${Date.now()}`,
            type: "income",
            date: new Date().toISOString(),
            amount: depositAmount,
            contact: {
              id: order.customerPhone || order.id,
              name: order.customerName || "Khách sửa chữa",
            },
            notes: `Đặt cọc sửa chữa: ${order.deviceName} - ${order.id} #app:pincorp`,
            paymentSourceId: order.paymentMethod || "cash",
            branchId: "main",
            workOrderId: order.id,
            category: "service_deposit" as any, // Cast to match category types if needed
          };
          await ctx.addCashTransaction(depositTx);
        }

        // 3. Handle Final Payment Transaction
        // Chỉ tạo khi 'Trả máy' VÀ có thanh toán (paid/partial) VÀ chưa có giao dịch thu nhập dịch vụ
        const hasServiceIncomeTx = existingTxs.some(t => t.category === 'service_income');
        const isCompleted = completedStatuses.includes(order.status);
        const isPaidOrPartial = order.paymentStatus === 'paid' || order.paymentStatus === 'partial';

        if (isCompleted && isPaidOrPartial && !hasServiceIncomeTx && ctx.addCashTransaction) {
          let finalAmount = 0;
          if (order.paymentStatus === 'paid') {
            finalAmount = (order.total || 0) - depositAmount;
          } else if (order.paymentStatus === 'partial') {
            // Nếu partial, lấy số tiền khách trả thêm (ngoài cọc)
            finalAmount = (order.partialPaymentAmount || 0);
          }

          if (finalAmount > 0) {
            const finalTx: CashTransaction = {
              id: `CT-FINAL-${order.id}-${Date.now()}`,
              type: "income",
              date: new Date().toISOString(),
              amount: finalAmount,
              contact: {
                id: order.customerPhone || order.id,
                name: order.customerName || "Khách sửa chữa",
              },
              notes: `Thu tiền sửa chữa (Hoàn tất): ${order.deviceName} - ${order.id} #app:pincorp`,
              paymentSourceId: order.paymentMethod || "cash",
              branchId: "main",
              workOrderId: order.id,
              category: "service_income",
            };
            await ctx.addCashTransaction(finalTx);
          }
        }

        ctx.setRepairOrders((prev: PinRepairOrder[]) =>
          prev.map((o: PinRepairOrder) => (o.id === order.id ? order : o))
        );
        ctx.addToast?.({
          title: "Đã cập nhật đơn sửa chữa",
          message: `${order.status} - ${order.id}`,
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
        // ===== HOÀN TRẢ KHO KHI HỦY PHIẾU =====
        // Tìm đơn sửa chữa cần xóa
        const orderToDelete = ctx.pinRepairOrders?.find((o: PinRepairOrder) => o.id === orderId);

        // Nếu đơn đã trừ kho, hoàn trả lại vật tư
        if (orderToDelete?.materialsDeducted && orderToDelete.materialsUsed) {
          for (const m of orderToDelete.materialsUsed) {
            let mat = ctx.pinMaterials.find(
              (material: PinMaterial) => material.id === m.materialId
            );
            if (!mat && m.materialName) {
              mat = ctx.pinMaterials.find(
                (material: PinMaterial) =>
                  material.name.toLowerCase() === m.materialName.toLowerCase()
              );
            }
            if (!mat) continue;

            // Hoàn trả số lượng về kho
            const restoredStock = (mat.stock || 0) + (m.quantity || 0);
            await supabase.from("pin_materials").update({ stock: restoredStock }).eq("id", mat.id);
            ctx.setPinMaterials((prev: PinMaterial[]) =>
              prev.map((material: PinMaterial) =>
                material.id === mat!.id ? { ...material, stock: restoredStock } : material
              )
            );
          }

          ctx.addToast?.({
            title: "✅ Đã hoàn trả vật tư về kho",
            message: `Phiếu ${orderId}`,
            type: "success",
          });
        }

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
