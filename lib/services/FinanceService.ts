import type { PinContextType } from "../../../contexts/pincorp/types";
import type { FixedAsset, CapitalInvestment } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";

export interface FinanceService {
  // Fixed assets
  upsertPinFixedAsset: (asset: FixedAsset) => Promise<void>;
  deletePinFixedAsset: (assetId: string) => Promise<void>;
  // Capital investments
  upsertPinCapitalInvestment: (investment: CapitalInvestment) => Promise<void>;
  deletePinCapitalInvestment: (investmentId: string) => Promise<void>;
  // Cash transactions
  deleteCashTransactions: (filter: {
    id?: string;
    saleId?: string;
    workOrderId?: string;
  }) => Promise<number>;
}

export function createFinanceService(
  ctx: PinContextType | any
): FinanceService {
  return {
    upsertPinFixedAsset: async (asset) => {
      if (IS_OFFLINE_MODE) {
        ctx.setFixedAssets?.((prev: FixedAsset[]) => {
          const idx = prev.findIndex((a) => a.id === asset.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = asset;
            return next;
          }
          return [asset, ...prev];
        });
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để lưu tài sản.",
          type: "warn",
        });
        return;
      }

      try {
        const payload: any = {
          id: asset.id,
          name: asset.name,
          category: asset.category,
          purchase_price: asset.purchasePrice,
          current_value: asset.currentValue ?? asset.purchasePrice,
          purchase_date: asset.purchaseDate,
          useful_life: asset.usefulLife,
          salvage_value: asset.salvageValue,
          depreciation_method: asset.depreciationMethod,
          location: asset.location ?? null,
          description: asset.description ?? null,
          status: asset.status ?? "active",
          // created_by handled by RLS default/trigger if needed
          created_at: asset.created_at ?? new Date().toISOString(),
        };
        const { error } = await supabase
          .from("pincorp_fixed_assets")
          .upsert([payload]);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi lưu tài sản",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setFixedAssets?.((prev: FixedAsset[]) => {
          const idx = prev.findIndex((a) => a.id === asset.id);
          if (idx > -1) return prev.map((a) => (a.id === asset.id ? asset : a));
          return [asset, ...prev];
        });
        ctx.addToast?.({
          title: "Đã lưu tài sản",
          message: asset.name,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception upserting fixed asset:", e);
        ctx.addToast?.({
          title: "Lỗi lưu tài sản",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },

    deletePinFixedAsset: async (assetId) => {
      if (IS_OFFLINE_MODE) {
        ctx.setFixedAssets?.((prev: FixedAsset[]) =>
          prev.filter((a) => a.id !== assetId)
        );
        return;
      }
      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để xoá tài sản.",
          type: "warn",
        });
        return;
      }
      try {
        const { error } = await supabase
          .from("pincorp_fixed_assets")
          .delete()
          .eq("id", assetId);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi xoá tài sản",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setFixedAssets?.((prev: FixedAsset[]) =>
          prev.filter((a) => a.id !== assetId)
        );
        ctx.addToast?.({
          title: "Đã xoá tài sản",
          message: assetId,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception deleting fixed asset:", e);
        ctx.addToast?.({
          title: "Lỗi xoá tài sản",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },

    upsertPinCapitalInvestment: async (investment) => {
      if (IS_OFFLINE_MODE) {
        ctx.setCapitalInvestments?.((prev: CapitalInvestment[]) => {
          const idx = prev.findIndex((i) => i.id === investment.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = investment;
            return next;
          }
          return [investment, ...prev];
        });
        return;
      }
      if (!ctx.currentUser) {
        ctx.addToast?.({
          title: "Yêu cầu đăng nhập",
          message: "Bạn phải đăng nhập để lưu vốn đầu tư.",
          type: "warn",
        });
        return;
      }
      try {
        const payload: any = {
          id: investment.id,
          type: (investment as any).type || "other",
          amount: investment.amount,
          description: investment.description || null,
          date: investment.date,
          notes: (investment as any).notes || null,
          created_at: investment.created_at || new Date().toISOString(),
        };
        const { error } = await supabase
          .from("pincorp_capital_investments")
          .upsert([payload]);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi lưu vốn đầu tư",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setCapitalInvestments?.((prev: CapitalInvestment[]) => {
          const idx = prev.findIndex((i) => i.id === investment.id);
          if (idx > -1)
            return prev.map((i) => (i.id === investment.id ? investment : i));
          return [investment, ...prev];
        });
        ctx.addToast?.({
          title: "Đã lưu vốn đầu tư",
          message: investment.description || investment.id,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception upserting capital investment:", e);
        ctx.addToast?.({
          title: "Lỗi lưu vốn đầu tư",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },
    deletePinCapitalInvestment: async (investmentId: string) => {
      if (IS_OFFLINE_MODE) {
        ctx.setCapitalInvestments?.((prev: any[]) =>
          prev.filter((i) => i.id !== investmentId)
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
          .from("pincorp_capital_investments")
          .delete()
          .eq("id", investmentId);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi xoá vốn đầu tư",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setCapitalInvestments?.((prev: any[]) =>
          prev.filter((i) => i.id !== investmentId)
        );
        ctx.addToast?.({
          title: "Đã xoá vốn đầu tư",
          message: investmentId,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception deleting capital investment:", e);
        ctx.addToast?.({
          title: "Lỗi xoá vốn đầu tư",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },

    // Centralized delete for cashtransactions
    deleteCashTransactions: async (filter) => {
      try {
        // Update local state first for responsiveness
        if (filter?.id || filter?.saleId || filter?.workOrderId) {
          ctx.setCashTransactions?.((prev: any[]) =>
            prev.filter((t) =>
              (filter.id && t.id !== filter.id) ||
              (filter.saleId && t.saleId !== filter.saleId) ||
              (filter.workOrderId && t.workOrderId !== filter.workOrderId)
                ? true
                : !(filter.id || filter.saleId || filter.workOrderId)
            )
          );
        }

        if (IS_OFFLINE_MODE || !ctx.currentUser) {
          return 0; // local-only
        }

        // Count first
        let countQuery = supabase
          .from("cashtransactions")
          .select("id", { count: "exact", head: true });
        if (filter.id) countQuery = countQuery.eq("id", filter.id);
        if (filter.saleId) countQuery = countQuery.eq("saleid", filter.saleId);
        if (filter.workOrderId)
          countQuery = countQuery.eq("workorderid", filter.workOrderId);
        const { error: countErr, count } = await countQuery;
        if (countErr) {
          ctx.addToast?.({
            title: "Lỗi xoá sổ quỹ",
            message: countErr.message || String(countErr),
            type: "error",
          });
          return 0;
        }

        // Then delete
        let delQuery = supabase.from("cashtransactions").delete();
        if (filter.id) delQuery = delQuery.eq("id", filter.id);
        if (filter.saleId) delQuery = delQuery.eq("saleid", filter.saleId);
        if (filter.workOrderId)
          delQuery = delQuery.eq("workorderid", filter.workOrderId);
        const { error: delErr } = await delQuery;
        if (delErr) {
          ctx.addToast?.({
            title: "Lỗi xoá sổ quỹ",
            message: delErr.message || String(delErr),
            type: "error",
          });
          return 0;
        }
        return typeof count === "number" ? count : 0;
      } catch (e: any) {
        ctx.addToast?.({
          title: "Lỗi xoá sổ quỹ",
          message: e?.message || String(e),
          type: "error",
        });
        return 0;
      }
    },
  };
}
