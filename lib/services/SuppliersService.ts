import type { Supplier } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import type { PinContextType } from "../../../contexts/pincorp/types";

export interface SuppliersService {
  upsertSupplier: (supplier: Supplier) => Promise<void>;
}

export function createSuppliersService(ctx: PinContextType): SuppliersService {
  return {
    upsertSupplier: async (supplier) => {
      if (IS_OFFLINE_MODE) {
        ctx.setSuppliers((prev) => {
          const idx = prev.findIndex((s) => s.id === supplier.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = supplier;
            return next;
          }
          return [supplier, ...prev];
        });
        return;
      }

      try {
        const payload: any = { ...supplier };
        const { error } = await supabase.from("suppliers").upsert(payload);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi lưu nhà cung cấp",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setSuppliers((prev) => {
          const idx = prev.findIndex((s) => s.id === supplier.id);
          if (idx > -1)
            return prev.map((s) => (s.id === supplier.id ? supplier : s));
          return [supplier, ...prev];
        });
        ctx.addToast?.({
          title: "Đã lưu nhà cung cấp",
          message: supplier.name,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception upserting supplier:", e);
        ctx.addToast?.({
          title: "Lỗi lưu nhà cung cấp",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },
  };
}
