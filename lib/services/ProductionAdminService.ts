import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import type { PinContextType } from "../../../contexts/pincorp/types";

export interface ProductionAdminService {
  resetProductionData: (options: Record<string, boolean>) => Promise<void>;
}

export function createProductionAdminService(
  ctx: PinContextType | any
): ProductionAdminService {
  return {
    resetProductionData: async (options) => {
      if (IS_OFFLINE_MODE) {
        try {
          if ((options as any).workOrders) ctx.setWorkOrders?.([]);
          if ((options as any).parts) ctx.setParts?.([]);
          if ((options as any).transactions) ctx.setTransactions?.([]);
          if (options.customers) ctx.setCustomers?.([]);
          if (options.sales) ctx.setSales?.([]);
          if (options.materials) ctx.setPinMaterials([]);
          if (options.boms) ctx.setBoms([]);
          if (options.productionOrders) ctx.setProductionOrders([]);
          if (options.products) ctx.setPinProducts([]);
          if (options.pinSales) ctx.setPinSales([]);
          if (options.repairOrders) ctx.setRepairOrders([]);
          if (options.fixedAssets) ctx.setFixedAssets?.([]);
          if (options.capitalInvestments) ctx.setCapitalInvestments?.([]);
          if (options.cashTransactions) ctx.setCashTransactions([]);
          ctx.setGoodsReceipts?.([]);
          ctx.setPinCartItems?.([]);
          ctx.addToast?.({
            message:
              "Đã xoá dữ liệu cục bộ (offline). Khi kết nối cơ sở dữ liệu, hãy chạy reset lại để xoá trên server.",
            type: "success",
          });
        } catch {
          ctx.addToast?.({
            message: "Không thể xoá dữ liệu cục bộ trong chế độ offline",
            type: "error",
          });
        }
        return;
      }

      if (!ctx.currentUser) {
        ctx.addToast?.({
          message: "Yêu cầu đăng nhập để thực hiện reset",
          type: "error",
        });
        return;
      }

      const deleteAllFromTable = async (tableName: string) => {
        const BATCH = 500;
        let totalDeleted = 0;
        while (true) {
          const { data: rows, error: selErr } = await supabase
            .from(tableName)
            .select("id")
            .limit(BATCH);
          if (selErr) {
            console.error(`❌ Error selecting from ${tableName}:`, selErr);
            break;
          }
          if (!rows || rows.length === 0) break;
          const ids = rows.map((r: any) => r.id).filter(Boolean);
          const { error: delErr } = await supabase
            .from(tableName)
            .delete()
            .in("id", ids);
          if (delErr) {
            console.error(`❌ Bulk delete failed on ${tableName}:`, delErr);
            for (const id of ids) {
              const { error } = await supabase
                .from(tableName)
                .delete()
                .eq("id", id);
              if (error) console.error(`❌ Failed to delete ${id}`, error);
              else totalDeleted++;
            }
          } else {
            totalDeleted += ids.length;
          }
          if (rows.length < BATCH) break;
        }
        console.log(`✅ Deleted ~${totalDeleted} records from ${tableName}`);
      };

      try {
        // PIN tables
        if (options.materials) {
          await deleteAllFromTable("pincorp_materials");
          ctx.setPinMaterials([]);
        }
        if (options.boms) {
          await deleteAllFromTable("pincorp_boms");
          ctx.setBoms([]);
        }
        if (options.productionOrders) {
          await deleteAllFromTable("pincorp_productionorders");
          ctx.setProductionOrders([]);
        }
        if (options.products) {
          await deleteAllFromTable("pincorp_products");
          ctx.setPinProducts([]);
        }
        if (options.customers) {
          await deleteAllFromTable("pincorp_customers");
          ctx.setPinCustomers([]);
        }
        if (options.sales) {
          await deleteAllFromTable("pincorp_sales");
          ctx.setPinSales([]);
        }
        if (options.repairOrders) {
          await deleteAllFromTable("pincorp_repairorders");
          ctx.setRepairOrders([]);
        }
        if (options.fixedAssets) {
          await deleteAllFromTable("pincorp_fixed_assets");
          ctx.setFixedAssets?.([]);
        }
        if (options.capitalInvestments) {
          await deleteAllFromTable("pincorp_capital_investments");
          ctx.setCapitalInvestments?.([]);
        }
        if (options.cashTransactions) {
          await deleteAllFromTable("cashtransactions");
          ctx.setCashTransactions([]);
        }
        if (options.cartItems) {
          ctx.setPinCartItems?.([]);
        }

        // MotoCare optional resets when running from full AppContext via PinContext
        const isMotoCareReset =
          (options as any).workOrders ||
          (options as any).parts ||
          (options as any).transactions;
        if ((options as any).workOrders) {
          await deleteAllFromTable("motocare_workorders");
          ctx.setWorkOrders?.([]);
        }
        if ((options as any).parts) {
          await deleteAllFromTable("motocare_parts");
          ctx.setParts?.([]);
        }
        if ((options as any).transactions) {
          await deleteAllFromTable("motocare_inventorytransactions");
          ctx.setTransactions?.([]);
        }
        if (isMotoCareReset && options.customers) {
          await deleteAllFromTable("motocare_customers");
          ctx.setCustomers?.([]);
        }
        if (isMotoCareReset && options.sales) {
          await deleteAllFromTable("motocare_sales");
          ctx.setSales?.([]);
        }
        if (
          isMotoCareReset &&
          (((options as any).transactions as boolean) ||
            (options as any).parts ||
            options.sales)
        ) {
          await deleteAllFromTable("goods_receipts");
          ctx.setGoodsReceipts?.([]);
        }

        ctx.addToast?.({
          message: "Đã reset dữ liệu production thành công!",
          type: "success",
        });
      } catch (error: any) {
        console.error("❌ Reset failed:", error);
        ctx.addToast?.({
          message: `Lỗi reset data: ${error?.message || String(error)}`,
          type: "error",
        });
      }
    },
  };
}
