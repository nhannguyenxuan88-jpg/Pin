import type { PinCustomer } from "../../types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import type { PinContextType } from "../../../contexts/pincorp/types";

export interface CustomersService {
  upsertPinCustomer: (customer: PinCustomer) => Promise<void>;
}

export function createCustomersService(ctx: PinContextType): CustomersService {
  return {
    upsertPinCustomer: async (customer) => {
      // Optimistic/offline-first
      if (IS_OFFLINE_MODE) {
        ctx.setPinCustomers((prev) => {
          const idx = prev.findIndex((c) => c.id === customer.id);
          if (idx > -1) {
            const next = [...prev];
            next[idx] = customer;
            return next;
          }
          return [customer, ...prev];
        });
        return;
      }

      try {
        // Minimal normalization for DB
        const payload: any = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          address: customer.address ?? null,
          notes: customer.notes ?? null,
        };
        const { error } = await supabase
          .from("pincorp_customers")
          .upsert(payload);
        if (error) {
          ctx.addToast?.({
            title: "Lỗi lưu khách hàng",
            message: error.message || String(error),
            type: "error",
          });
          return;
        }
        ctx.setPinCustomers((prev) => {
          const idx = prev.findIndex((c) => c.id === customer.id);
          if (idx > -1)
            return prev.map((c) => (c.id === customer.id ? customer : c));
          return [customer, ...prev];
        });
        ctx.addToast?.({
          title: "Đã lưu khách hàng",
          message: customer.name,
          type: "success",
        });
      } catch (e: any) {
        console.error("Exception upserting pincorp_customer:", e);
        ctx.addToast?.({
          title: "Lỗi lưu khách hàng",
          message: e?.message || String(e),
          type: "error",
        });
      }
    },
  };
}
