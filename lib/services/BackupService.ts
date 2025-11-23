import type { PinContextType } from "../../contexts/types";
import { supabase, IS_OFFLINE_MODE } from "../../supabaseClient";
import type {
  PinMaterial,
  PinBOM,
  ProductionOrder,
  PinProduct,
  PinSale,
  PinCustomer,
  Supplier,
  PinRepairOrder,
  CashTransaction,
  PinMaterialHistory,
} from "../../types";

export interface BackupData {
  version: string;
  timestamp: string;
  data: {
    materials: PinMaterial[];
    boms: PinBOM[];
    productionOrders: ProductionOrder[];
    products: PinProduct[];
    sales: PinSale[];
    customers: PinCustomer[];
    suppliers: Supplier[];
    repairOrders: PinRepairOrder[];
    cashTransactions: CashTransaction[];
    materialHistory: PinMaterialHistory[];
  };
}

export interface BackupService {
  exportAllData: () => Promise<BackupData>;
  exportToJSON: () => Promise<void>;
  exportToExcel: () => Promise<void>;
  importFromJSON: (file: File) => Promise<void>;
  createAutoBackup: () => Promise<void>;
  getBackupHistory: () => Promise<BackupData[]>;
}

export function createBackupService(ctx: PinContextType): BackupService {
  const gatherAllData = async (): Promise<BackupData["data"]> => {
    return {
      materials: ctx.pinMaterials || [],
      boms: ctx.pinBOMs || [],
      productionOrders: ctx.productionOrders || [],
      products: ctx.pinProducts || [],
      sales: ctx.pinSales || [],
      customers: ctx.pinCustomers || [],
      suppliers: ctx.suppliers || [],
      repairOrders: ctx.pinRepairOrders || [],
      cashTransactions: ctx.cashTransactions || [],
      materialHistory: ctx.pinMaterialHistory || [],
    };
  };

  return {
    exportAllData: async () => {
      const data = await gatherAllData();
      return {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        data,
      };
    },

    exportToJSON: async () => {
      try {
        const backupData = await gatherAllData();
        const backup: BackupData = {
          version: "1.0.0",
          timestamp: new Date().toISOString(),
          data: backupData,
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        a.download = `pincorp-backup-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ctx.addToast?.({
          type: "success",
          title: "Xuất dữ liệu thành công",
          message: `Đã tạo file backup tại ${a.download}`,
        });
      } catch (error: any) {
        ctx.addToast?.({
          type: "error",
          title: "Lỗi xuất dữ liệu",
          message: error?.message || String(error),
        });
        throw error;
      }
    },

    exportToExcel: async () => {
      try {
        const data = await gatherAllData();

        // Tạo CSV cho từng sheet
        const sheets: { [key: string]: string } = {};

        // Materials
        if (data.materials.length > 0) {
          const headers = [
            "SKU",
            "Tên",
            "Đơn vị",
            "Giá nhập",
            "Giá bán lẻ",
            "Giá bán sỉ",
            "Tồn kho",
            "NCC",
          ];
          const rows = data.materials.map((m) => [
            m.sku,
            m.name,
            m.unit,
            m.purchasePrice,
            m.retailPrice || 0,
            m.wholesalePrice || 0,
            m.stock,
            m.supplier || "",
          ]);
          sheets["Nguyên liệu"] = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        }

        // Products
        if (data.products.length > 0) {
          const headers = [
            "SKU",
            "Tên",
            "Giá vốn",
            "Giá bán",
            "Tồn kho",
            "Ngày sản xuất",
          ];
          const rows = data.products.map((p) => [
            p.sku,
            p.name,
            p.costPrice,
            p.sellingPrice,
            (p as any).quantity || p.stock || 0,
            new Date(
              (p as any).productionDate || (p as any).createdAt || Date.now()
            ).toLocaleDateString("vi-VN"),
          ]);
          sheets["Thành phẩm"] = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        }

        // Sales
        if (data.sales.length > 0) {
          const headers = [
            "Mã đơn",
            "Ngày",
            "Khách hàng",
            "Tổng tiền",
            "Trạng thái TT",
            "Phương thức",
          ];
          const rows = data.sales.map((s) => [
            (s as any).code || s.id,
            new Date(s.date).toLocaleDateString("vi-VN"),
            s.customer.name,
            s.total,
            (s as any).paymentStatus || "paid",
            s.paymentMethod,
          ]);
          sheets["Bán hàng"] = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        }

        // Customers
        if (data.customers.length > 0) {
          const headers = ["Tên", "SĐT", "Địa chỉ", "Ghi chú"];
          const rows = data.customers.map((c) => [
            c.name,
            c.phone || "",
            c.address || "",
            c.notes || "",
          ]);
          sheets["Khách hàng"] = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        }

        // Repair Orders
        if (data.repairOrders.length > 0) {
          const headers = [
            "Mã",
            "Ngày",
            "Khách hàng",
            "SĐT",
            "Thiết bị",
            "Tổng tiền",
            "Trạng thái",
          ];
          const rows = data.repairOrders.map((r) => [
            r.id,
            new Date(r.creationDate).toLocaleDateString("vi-VN"),
            r.customerName,
            r.customerPhone,
            r.deviceName || "",
            r.total,
            r.status,
          ]);
          sheets["Sửa chữa"] = [headers, ...rows]
            .map((row) => row.map((cell) => `"${cell}"`).join(","))
            .join("\n");
        }

        // Tạo ZIP file với nhiều CSV (giả lập Excel)
        // Hoặc xuất từng sheet
        for (const [sheetName, content] of Object.entries(sheets)) {
          const blob = new Blob(["\ufeff" + content], {
            type: "text/csv;charset=utf-8;",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          const timestamp = new Date().toISOString().split("T")[0];
          a.download = `pincorp-${sheetName}-${timestamp}.csv`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        ctx.addToast?.({
          type: "success",
          title: "Xuất Excel thành công",
          message: `Đã tạo ${Object.keys(sheets).length} file CSV`,
        });
      } catch (error: any) {
        ctx.addToast?.({
          type: "error",
          title: "Lỗi xuất Excel",
          message: error?.message || String(error),
        });
        throw error;
      }
    },

    importFromJSON: async (file: File) => {
      try {
        const text = await file.text();
        const backup: BackupData = JSON.parse(text);

        if (!backup.version || !backup.data) {
          throw new Error("File backup không hợp lệ");
        }

        // Confirm before import
        const confirmed = confirm(
          `Bạn có chắc muốn import dữ liệu từ backup?\n\n` +
            `Thời gian: ${new Date(backup.timestamp).toLocaleString(
              "vi-VN"
            )}\n` +
            `Nguyên liệu: ${backup.data.materials?.length || 0}\n` +
            `Sản phẩm: ${backup.data.products?.length || 0}\n` +
            `Đơn hàng: ${backup.data.sales?.length || 0}\n\n` +
            `⚠️ CẢNH BÁO: Dữ liệu hiện tại sẽ được ghi đè!`
        );

        if (!confirmed) return;

        // Import data
        if (backup.data.materials) ctx.setPinMaterials(backup.data.materials);
        if (backup.data.boms) ctx.setBoms(backup.data.boms);
        if (backup.data.productionOrders)
          ctx.setProductionOrders(backup.data.productionOrders);
        if (backup.data.products) ctx.setPinProducts(backup.data.products);
        if (backup.data.sales) ctx.setPinSales(backup.data.sales);
        if (backup.data.customers) ctx.setPinCustomers(backup.data.customers);
        if (backup.data.suppliers) ctx.setSuppliers(backup.data.suppliers);
        if (backup.data.repairOrders)
          ctx.setRepairOrders(backup.data.repairOrders);
        if (backup.data.cashTransactions)
          ctx.setCashTransactions(backup.data.cashTransactions);
        if (backup.data.materialHistory)
          ctx.setPinMaterialHistory(backup.data.materialHistory);

        ctx.addToast?.({
          type: "success",
          title: "Import thành công",
          message: "Đã khôi phục dữ liệu từ backup",
        });
      } catch (error: any) {
        ctx.addToast?.({
          type: "error",
          title: "Lỗi import dữ liệu",
          message: error?.message || String(error),
        });
        throw error;
      }
    },

    createAutoBackup: async () => {
      try {
        const backup = await gatherAllData();
        const key = `pincorp-auto-backup-${
          new Date().toISOString().split("T")[0]
        }`;
        localStorage.setItem(
          key,
          JSON.stringify({
            version: "1.0.0",
            timestamp: new Date().toISOString(),
            data: backup,
          })
        );

        // Chỉ giữ 7 backup gần nhất
        const allKeys = Object.keys(localStorage).filter((k) =>
          k.startsWith("pincorp-auto-backup-")
        );
        if (allKeys.length > 7) {
          allKeys.sort();
          allKeys.slice(0, allKeys.length - 7).forEach((k) => {
            localStorage.removeItem(k);
          });
        }
      } catch (error) {
        console.error("Auto backup failed:", error);
      }
    },

    getBackupHistory: async () => {
      const allKeys = Object.keys(localStorage).filter((k) =>
        k.startsWith("pincorp-auto-backup-")
      );
      return allKeys
        .map((key) => {
          try {
            return JSON.parse(localStorage.getItem(key) || "");
          } catch {
            return null;
          }
        })
        .filter((b) => b !== null);
    },
  };
}
