import type { PinContextType } from "../../contexts/types";
import type {
  CashTransaction,
  PinSale,
  PinProduct,
  PinMaterial,
} from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import { generateFormattedId } from "../../lib/id";

export interface SalesService {
  handlePinSale: (
    saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">,
    newCashTx: CashTransaction
  ) => Promise<void>;
  deletePinSale: (saleId: string) => Promise<void>;
  updatePinSale: (sale: PinSale) => Promise<void>;
}

export function createSalesService(ctx: PinContextType): SalesService {
  return {
    handlePinSale: async (saleData, newCashTx) => {
      if (!ctx.currentUser && !IS_OFFLINE_MODE) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để lưu đơn PIN.",
          type: "warn",
        });
        return;
      }

      // Prepare base sale data (code will be generated per-attempt)
      const newSaleBase: Omit<PinSale, "id"> & { id?: string } = {
        ...saleData,
        date: new Date().toISOString(),
        userId: ctx.currentUser ? ctx.currentUser.id : "offline",
        userName: ctx.currentUser ? ctx.currentUser.name : "Offline",
      } as any;

      if (IS_OFFLINE_MODE) {
        const offlineSale: PinSale = {
          ...(newSaleBase as any),
          id: `OFF-${Date.now()}`,
        } as PinSale;
        ctx.setPinSales((prev: PinSale[]) => [offlineSale, ...prev]);
        await ctx.addCashTransaction?.(newCashTx);
        return;
      }

      try {
        // Prepare DB payload for pin_sales (snake_case)
        const paymentStatus =
          (newSaleBase as any).paymentStatus ||
          (typeof (saleData as any).paidAmount === "number" &&
          (saleData as any).paidAmount < saleData.total
            ? "partial"
            : "paid");
        // Build-and-insert with retry on unique code conflicts
        let inserted: any = null;
        let pinSaleError: any = null;
        let finalCode: string | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const saleCode = await generateFormattedId("LTN-BH");
          finalCode = saleCode;
          let payload: any = {
            code: saleCode,
            date: newSaleBase.date,
            items: newSaleBase.items,
            subtotal: newSaleBase.subtotal,
            discount: newSaleBase.discount,
            total: newSaleBase.total,
            customer: newSaleBase.customer,
            payment_method: newSaleBase.paymentMethod,
            payment_status: paymentStatus,
            paid_amount:
              typeof (saleData as any).paidAmount === "number"
                ? Math.max(0, (saleData as any).paidAmount)
                : newCashTx?.amount ?? newSaleBase.total,
            due_date: (newSaleBase as any).dueDate ?? null,
            user_id: newSaleBase.userId,
            user_name: newSaleBase.userName,
          };

          // Ensure JSON text fields for DB
          if (
            payload.items !== undefined &&
            typeof payload.items !== "string"
          ) {
            try {
              payload.items = JSON.stringify(payload.items);
            } catch {}
          }
          if (
            payload.customer !== undefined &&
            typeof payload.customer !== "string"
          ) {
            try {
              payload.customer = JSON.stringify(payload.customer);
            } catch {}
          }

          const res = await supabase
            .from("pin_sales")
            .insert(payload)
            .select()
            .single();
          inserted = res.data;
          pinSaleError = res.error;

          // Retry logic on unique code violation or 409 Conflict
          const isUniqueViolation =
            !!pinSaleError &&
            (/duplicate key|unique constraint|23505|409|Conflict/i.test(
              pinSaleError.message || ""
            ) ||
              pinSaleError.status === 409);

          if (!pinSaleError || !isUniqueViolation) {
            break;
          }
        }
        // Fallback: older deployments without `code` column
        if (
          pinSaleError &&
          /column|does not exist/i.test(pinSaleError.message || "")
        ) {
          try {
            const res2 = await supabase
              .from("pin_sales")
              .insert({
                date: newSaleBase.date,
                items: JSON.stringify(newSaleBase.items ?? []),
                subtotal: newSaleBase.subtotal,
                discount: newSaleBase.discount,
                total: newSaleBase.total,
                customer: JSON.stringify(newSaleBase.customer ?? {}),
                payment_method: newSaleBase.paymentMethod,
                payment_status: paymentStatus,
                paid_amount:
                  typeof (saleData as any).paidAmount === "number"
                    ? Math.max(0, (saleData as any).paidAmount)
                    : newCashTx?.amount ?? newSaleBase.total,
                due_date: (newSaleBase as any).dueDate ?? null,
                user_id: newSaleBase.userId,
                user_name: newSaleBase.userName,
              })
              .select()
              .single();
            inserted = res2.data;
            pinSaleError = res2.error;
          } catch (e) {
            pinSaleError = e;
          }
        }
        if (pinSaleError) {
          ctx.addToast?.({
            title: "Lỗi lưu đơn PIN",
            message: pinSaleError.message || String(pinSaleError),
            type: "error",
          });
          if (
            (pinSaleError as any).code === "42501" ||
            /permission|policy|rls/i.test(pinSaleError.message || "")
          ) {
            ctx.addToast?.({
              title: "Quyền truy cập bị chặn",
              message: "Kiểm tra RLS/policy trên bảng pin_sales",
              type: "warn",
            });
          }
          return;
        }

        // Add sale with returned UUID id
        const savedSale: PinSale = {
          ...(newSaleBase as any),
          id: (inserted as any)?.id,
          code: finalCode || (inserted as any)?.code,
        } as PinSale;
        ctx.setPinSales((prev: PinSale[]) => [savedSale, ...prev]);

        // Inventory adjustments after sale
        try {
          const usageByProduct = new Map<string, number>();
          const usageByMaterial = new Map<string, number>();
          (newSaleBase.items || []).forEach((it: any) => {
            const q = Number(it.quantity || 0);
            const pid = it.productId;
            const itemType = it.type || "product";
            if (pid && q > 0) {
              if (itemType === "material")
                usageByMaterial.set(pid, (usageByMaterial.get(pid) || 0) + q);
              else usageByProduct.set(pid, (usageByProduct.get(pid) || 0) + q);
            }
          });

          // Products
          for (const [productId, qty] of usageByProduct.entries()) {
            const prod = ctx.pinProducts.find(
              (p: PinProduct) => p.id === productId
            );
            if (!prod) continue;
            const remaining = Math.max(0, (prod.stock || 0) - qty);
            const pld = {
              id: prod.id,
              name: prod.name,
              sku: prod.sku,
              stock: remaining,
              costPrice: (prod as any).costPrice,
              sellingPrice: (prod as any).sellingPrice,
              created_by: ctx.currentUser?.id,
            } as any;
            const { error: upErr } = await supabase
              .from("pin_products")
              .update({ stock: remaining })
              .eq("id", productId);
            if (!upErr) {
              ctx.setPinProducts((prev: PinProduct[]) =>
                prev.map((p: PinProduct) =>
                  p.id === productId ? { ...p, stock: remaining } : p
                )
              );
            } else {
              ctx.addToast?.({
                title: "Lỗi cập nhật tồn kho thành phẩm",
                message: upErr.message || String(upErr),
                type: "error",
              });
            }
          }

          // Materials
          for (const [materialId, qty] of usageByMaterial.entries()) {
            const mat = ctx.pinMaterials.find(
              (m: PinMaterial) => m.id === materialId
            );
            if (!mat) continue;
            const remaining = Math.max(0, (mat.stock || 0) - qty);
            const mld = {
              id: mat.id,
              name: mat.name,
              sku: (mat as any).sku,
              stock: remaining,
              purchasePrice: (mat as any).purchasePrice,
              retailPrice: (mat as any).retailPrice,
              wholesalePrice: (mat as any).wholesalePrice,
              created_by: (mat as any).created_by || ctx.currentUser?.id,
            } as any;
            const { error: upErr } = await supabase
              .from("pin_materials")
              .update({ stock: remaining })
              .eq("id", materialId);
            if (!upErr) {
              ctx.setPinMaterials((prev: PinMaterial[]) =>
                prev.map((m: PinMaterial) =>
                  m.id === materialId ? { ...m, stock: remaining } : m
                )
              );
            } else {
              ctx.addToast?.({
                title: "Lỗi cập nhật tồn kho nguyên liệu",
                message: upErr.message || String(upErr),
                type: "error",
              });
            }
          }
        } catch (e) {
          console.error("Exception khi trừ kho sau bán hàng:", e);
        }

        // Cash transaction
        if ((newCashTx?.amount || 0) > 0) {
          const tag = "#app:pincorp";
          const txWithSale = {
            ...newCashTx,
            saleId: (inserted as any)?.id,
            notes: `${newCashTx.notes ? newCashTx.notes + " " : ""}${tag}`,
          } as CashTransaction;
          await ctx.addCashTransaction?.(txWithSale);
        }
      } catch (e: any) {
        console.error("Exception inserting pin sale:", e);
        ctx.addToast?.({
          title: "Lỗi lưu đơn PIN",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },

    deletePinSale: async (saleId) => {
      const sale = ctx.pinSales.find((s: PinSale) => s.id === saleId);
      if (!sale) {
        ctx.addToast?.({
          title: "Không tìm thấy hoá đơn",
          message: saleId,
          type: "warn",
        });
        return;
      }

      if (IS_OFFLINE_MODE) {
        const usageByProduct = new Map<string, number>();
        const usageByMaterial = new Map<string, number>();
        (sale.items || []).forEach((it: any) => {
          const pid = it.productId;
          const q = Number(it.quantity || 0);
          const itemType = it.type || "product";
          if (pid && q > 0) {
            if (itemType === "material")
              usageByMaterial.set(pid, (usageByMaterial.get(pid) || 0) + q);
            else usageByProduct.set(pid, (usageByProduct.get(pid) || 0) + q);
          }
        });
        ctx.setPinProducts((prev: PinProduct[]) =>
          prev.map((p: PinProduct) =>
            usageByProduct.has(p.id)
              ? {
                  ...p,
                  stock: (p.stock || 0) + (usageByProduct.get(p.id) || 0),
                }
              : p
          )
        );
        ctx.setPinMaterials((prev: PinMaterial[]) =>
          prev.map((m: PinMaterial) =>
            usageByMaterial.has(m.id)
              ? {
                  ...m,
                  stock: (m.stock || 0) + (usageByMaterial.get(m.id) || 0),
                }
              : m
          )
        );
        ctx.setPinSales((prev: PinSale[]) =>
          prev.filter((s: PinSale) => s.id !== saleId)
        );
        ctx.setCashTransactions?.((prev: CashTransaction[]) =>
          prev.filter((t: CashTransaction) => t.saleId !== saleId)
        );
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để xoá hoá đơn.",
          type: "warn",
        });
        return;
      }

      try {
        // Return stock
        const usageByProduct = new Map<string, number>();
        const usageByMaterial = new Map<string, number>();
        (sale.items || []).forEach((it: any) => {
          const pid = it.productId;
          const q = Number(it.quantity || 0);
          const itemType = it.type || "product";
          if (pid && q > 0) {
            if (itemType === "material")
              usageByMaterial.set(pid, (usageByMaterial.get(pid) || 0) + q);
            else usageByProduct.set(pid, (usageByProduct.get(pid) || 0) + q);
          }
        });

        for (const [productId, qty] of usageByProduct.entries()) {
          const prod = ctx.pinProducts.find(
            (p: PinProduct) => p.id === productId
          );
          if (!prod) continue;
          const remaining = (prod.stock || 0) + qty;
          const pld = {
            id: prod.id,
            name: prod.name,
            sku: prod.sku,
            stock: remaining,
            costPrice: (prod as any).costPrice,
            sellingPrice: (prod as any).sellingPrice,
            created_by: ctx.currentUser?.id,
          } as any;
          await supabase
            .from("pin_products")
            .update({ stock: remaining })
            .eq("id", productId);
        }

        for (const [materialId, qty] of usageByMaterial.entries()) {
          const mat = ctx.pinMaterials.find(
            (m: PinMaterial) => m.id === materialId
          );
          if (!mat) continue;
          const remaining = (mat.stock || 0) + qty;
          const mld = {
            id: mat.id,
            name: mat.name,
            sku: (mat as any).sku,
            stock: remaining,
            purchasePrice: (mat as any).purchasePrice,
            retailPrice: (mat as any).retailPrice,
            wholesalePrice: (mat as any).wholesalePrice,
            created_by: (mat as any).created_by || ctx.currentUser?.id,
          } as any;
          await supabase
            .from("pin_materials")
            .update({ stock: remaining })
            .eq("id", materialId);
        }

        // Delete cash transactions via centralized finance helper
        await (ctx as any).deleteCashTransactions?.({ saleId });

        const { error: delSaleErr } = await supabase
          .from("pin_sales")
          .delete()
          .eq("id", saleId);
        if (delSaleErr) {
          ctx.addToast?.({
            title: "Lỗi xoá hoá đơn",
            message: delSaleErr.message || String(delSaleErr),
            type: "error",
          });
          return;
        }

        ctx.setPinSales((prev: PinSale[]) =>
          prev.filter((s: PinSale) => s.id !== saleId)
        );
        ctx.addToast?.({
          title: "Đã xoá hoá đơn",
          message: saleId,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception xoá hoá đơn PIN:", e);
        ctx.addToast?.({
          title: "Lỗi xoá hoá đơn",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },

    updatePinSale: async (sale) => {
      if (IS_OFFLINE_MODE) {
        ctx.setPinSales((prev: PinSale[]) =>
          prev.map((s: PinSale) => (s.id === sale.id ? sale : s))
        );
        ctx.setCashTransactions?.((prev: CashTransaction[]) =>
          prev.map((t: CashTransaction) =>
            t.saleId === sale.id
              ? {
                  ...t,
                  amount: sale.total,
                  paymentSourceId: sale.paymentMethod,
                }
              : t
          )
        );
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để sửa hoá đơn.",
          type: "warn",
        });
        return;
      }

      try {
        let payload: any = { ...sale };
        // Normalize at boundary if needed; ensure JSON-string fields
        if (payload.items !== undefined && typeof payload.items !== "string") {
          try {
            payload.items = JSON.stringify(payload.items);
          } catch {}
        }
        if (
          payload.customer !== undefined &&
          typeof payload.customer !== "string"
        ) {
          try {
            payload.customer = JSON.stringify(payload.customer);
          } catch {}
        }

        // Map to snake_case for pin_sales
        const updatePayload: any = {
          code: sale.code ?? null,
          date: sale.date,
          items: payload.items,
          subtotal: sale.subtotal,
          discount: sale.discount,
          total: sale.total,
          customer: payload.customer,
          payment_method: sale.paymentMethod,
          payment_status: sale.paymentStatus ?? null,
          paid_amount: sale.paidAmount ?? null,
          due_date: sale.dueDate ?? null,
          user_id: sale.userId,
          user_name: sale.userName,
        };
        const { error: upErr } = await supabase
          .from("pin_sales")
          .update(updatePayload)
          .eq("id", sale.id);
        if (upErr) {
          ctx.addToast?.({
            title: "Lỗi lưu hoá đơn",
            message: upErr.message || String(upErr),
            type: "error",
          });
          return;
        }

        // Also update related cash transaction if exists
        const related = ctx.cashTransactions?.find(
          (t: CashTransaction) => t.saleId === sale.id
        );
        if (related) {
          const tag = "#app:pincorp";
          const updatedTx: CashTransaction = {
            ...related,
            amount: sale.total,
            paymentSourceId: sale.paymentMethod,
            notes:
              (related.notes || `Cập nhật hoá đơn ${sale.id}`) +
              (/#app:(pin|pincorp)/i.test(related.notes || "")
                ? ""
                : ` ${tag}`),
          };
          await ctx.addCashTransaction?.(updatedTx);
        }

        ctx.setPinSales((prev: PinSale[]) =>
          prev.map((s: PinSale) => (s.id === sale.id ? sale : s))
        );
        ctx.addToast?.({
          title: "Đã cập nhật hoá đơn",
          message: sale.id,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception cập nhật hoá đơn PIN:", e);
        ctx.addToast?.({
          title: "Lỗi cập nhật hoá đơn",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },
  };
}
