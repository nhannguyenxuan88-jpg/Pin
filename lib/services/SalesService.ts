import type { PinContextType } from "../../../contexts/pincorp/types";
import type { CashTransaction, PinSale } from "../../types";
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

      const saleId = await generateFormattedId("LTN-BH");
      const newSale: PinSale = {
        ...saleData,
        id: saleId,
        date: new Date().toISOString(),
        userId: ctx.currentUser ? ctx.currentUser.id : "offline",
        userName: ctx.currentUser ? ctx.currentUser.name : "Offline",
      } as PinSale;

      if (IS_OFFLINE_MODE) {
        ctx.setPinSales((prev) => [newSale, ...prev]);
        await ctx.addCashTransaction?.(newCashTx);
        return;
      }

      try {
        // Prepare DB payload (normalize at API boundary if needed)
        let payload: any = {
          id: newSale.id,
          date: newSale.date,
          items: newSale.items,
          subtotal: newSale.subtotal,
          discount: newSale.discount,
          total: newSale.total,
          customer: newSale.customer,
          paymentmethod: newSale.paymentMethod,
          userid: newSale.userId,
          username: newSale.userName,
          created_by: (newSale as any).created_by || ctx.currentUser?.id,
        };

        // Ensure JSON text fields for DB
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

        const { error: pinSaleError } = await supabase
          .from("pincorp_sales")
          .insert(payload);
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
              message: "Kiểm tra RLS/policy trên bảng pincorp_sales",
              type: "warn",
            });
          }
          return;
        }

        // Optimistically add sale to local state
        ctx.setPinSales((prev) => [newSale, ...prev]);

        // Inventory adjustments after sale
        try {
          const usageByProduct = new Map<string, number>();
          const usageByMaterial = new Map<string, number>();
          (newSale.items || []).forEach((it: any) => {
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
            const prod = ctx.pinProducts.find((p) => p.id === productId);
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
              .from("pincorp_products")
              .upsert(pld);
            if (!upErr) {
              ctx.setPinProducts((prev) =>
                prev.map((p) =>
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
            const mat = ctx.pinMaterials.find((m) => m.id === materialId);
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
              .from("pincorp_materials")
              .upsert(mld);
            if (!upErr) {
              ctx.setPinMaterials((prev) =>
                prev.map((m) =>
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
            saleId: newSale.id,
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
      const sale = ctx.pinSales.find((s) => s.id === saleId);
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
        ctx.setPinProducts((prev) =>
          prev.map((p) =>
            usageByProduct.has(p.id)
              ? {
                  ...p,
                  stock: (p.stock || 0) + (usageByProduct.get(p.id) || 0),
                }
              : p
          )
        );
        ctx.setPinMaterials((prev) =>
          prev.map((m) =>
            usageByMaterial.has(m.id)
              ? {
                  ...m,
                  stock: (m.stock || 0) + (usageByMaterial.get(m.id) || 0),
                }
              : m
          )
        );
        ctx.setPinSales((prev) => prev.filter((s) => s.id !== saleId));
        ctx.setCashTransactions?.((prev) =>
          prev.filter((t) => t.saleId !== saleId)
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
          const prod = ctx.pinProducts.find((p) => p.id === productId);
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
          await supabase.from("pincorp_products").upsert(pld);
        }

        for (const [materialId, qty] of usageByMaterial.entries()) {
          const mat = ctx.pinMaterials.find((m) => m.id === materialId);
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
          await supabase.from("pincorp_materials").upsert(mld);
        }

        // Delete cash transactions via centralized finance helper
        await (ctx as any).deleteCashTransactions?.({ saleId });

        const { error: delSaleErr } = await supabase
          .from("pincorp_sales")
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

        ctx.setPinSales((prev) => prev.filter((s) => s.id !== saleId));
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
        ctx.setPinSales((prev) =>
          prev.map((s) => (s.id === sale.id ? sale : s))
        );
        ctx.setCashTransactions?.((prev) =>
          prev.map((t) =>
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

        const { error: upErr } = await supabase
          .from("pincorp_sales")
          .upsert(payload);
        if (upErr) {
          ctx.addToast?.({
            title: "Lỗi lưu hoá đơn",
            message: upErr.message || String(upErr),
            type: "error",
          });
          return;
        }

        // Also update related cash transaction if exists
        const related = ctx.cashTransactions?.find((t) => t.saleId === sale.id);
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

        ctx.setPinSales((prev) =>
          prev.map((s) => (s.id === sale.id ? sale : s))
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
