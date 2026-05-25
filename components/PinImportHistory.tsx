import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";
import { Icon } from "./common/Icon";

// Minimal local type matching our UI needs
interface ImportHistoryRow {
  id: string;
  materialId?: string;
  materialName: string;
  materialSku?: string;
  quantity: number;
  purchasePrice: number;
  totalCost: number;
  supplier?: string;
  importDate: string; // ISO string
  notes?: string;
  userName?: string;
}

const mapDbRow = (row: any): ImportHistoryRow => ({
  id: row.id,
  materialId: row.material_id || row.materialid || undefined,
  materialName: row.material_name || row.materialname || "",
  materialSku: row.material_sku || row.materialsku || undefined,
  quantity: Number(row.quantity ?? 0),
  purchasePrice: Number(row.purchase_price ?? row.purchaseprice ?? 0),
  totalCost: Number(row.total_cost ?? row.totalcost ?? 0),
  supplier: row.supplier || undefined,
  importDate: row.import_date || row.importdate || new Date().toISOString(),
  notes: row.notes || undefined,
  userName: row.user_name || row.username || undefined,
});

const PinImportHistory: React.FC = () => {
  const [rows, setRows] = useState<ImportHistoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [supplier, setSupplier] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchRows = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("pin_material_history")
        .select("*")
        .order("import_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setRows((data || []).map(mapDbRow));
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, []);

  const handleDeleteRow = async (row: ImportHistoryRow) => {
    if (
      !confirm(
        `Xóa bản ghi nhập kho này?\n\n` +
          `Tên: ${row.materialName}\nSKU: ${
            row.materialSku || "-"
          }\nSố lượng: ${row.quantity}\nNhà cung cấp: ${row.supplier || "-"}`
      )
    )
      return;
    try {
      setIsLoading(true);
      setError(null);
      const { error: delErr } = await supabase
        .from("pin_material_history")
        .delete()
        .eq("id", row.id);
      if (delErr) throw delErr;
      // Re-fetch to ensure consistency with server
      await fetchRows();
    } catch (e: any) {
      setError(
        (e?.message || String(e)) + " — cần quyền DELETE/RLS policy cho pin_material_history"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Đồng bộ sản phẩm từ Lịch sử sang Danh sách
  const handleSyncMissingMaterials = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      // 1. Lấy tất cả materials hiện có
      const { data: existingMaterials, error: matErr } = await supabase
        .from("pin_materials")
        .select("name, sku");

      if (matErr) throw matErr;

      const existingNames = new Set(
        (existingMaterials || []).map((m: any) => m.name?.toLowerCase().trim())
      );
      const existingSkus = new Set(
        (existingMaterials || []).map((m: any) => m.sku?.toLowerCase().trim())
      );

      // 2. Tìm các sản phẩm trong lịch sử nhưng không có trong danh sách
      // Group by material name để tính tổng stock
      const historyByName = new Map<
        string,
        {
          name: string;
          sku: string;
          totalQty: number;
          lastPrice: number;
          supplier: string;
        }
      >();

      for (const row of rows) {
        const normalizedName = row.materialName?.toLowerCase().trim() || "";
        if (!normalizedName) continue;

        // Kiểm tra xem đã có trong danh sách chưa
        if (existingNames.has(normalizedName)) continue;
        if (row.materialSku && existingSkus.has(row.materialSku.toLowerCase().trim())) continue;

        // Cộng dồn số lượng theo tên
        const existing = historyByName.get(normalizedName);
        if (existing) {
          existing.totalQty += row.quantity;
          // Cập nhật giá mới nhất
          if (row.purchasePrice > 0) {
            existing.lastPrice = row.purchasePrice;
          }
        } else {
          historyByName.set(normalizedName, {
            name: row.materialName,
            sku: row.materialSku || `NL-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            totalQty: row.quantity,
            lastPrice: row.purchasePrice,
            supplier: row.supplier || "",
          });
        }
      }

      if (historyByName.size === 0) {
        setSuccessMessage("✅ Không có sản phẩm nào bị thiếu - Danh sách đã đồng bộ!");
        return;
      }

      // 3. Insert các sản phẩm bị thiếu
      let insertedCount = 0;
      const errors: string[] = [];

      for (const [, data] of historyByName) {
        try {
          const { error: insertErr } = await supabase.from("pin_materials").insert({
            name: data.name,
            sku: data.sku,
            unit: "cái",
            purchase_price: data.lastPrice,
            retail_price: Math.round(data.lastPrice * 1.4),
            wholesale_price: Math.round(data.lastPrice * 1.2),
            stock: data.totalQty,
            committed_quantity: 0,
            supplier: data.supplier || null,
            updated_at: new Date().toISOString(),
          });

          if (insertErr) {
            if (insertErr.code === "23505") {
              // Duplicate - skip
              console.log(`Skipped duplicate: ${data.name}`);
            } else {
              errors.push(`${data.name}: ${insertErr.message}`);
            }
          } else {
            insertedCount++;
          }
        } catch (e: any) {
          errors.push(`${data.name}: ${e.message}`);
        }
      }

      if (insertedCount > 0) {
        setSuccessMessage(
          `✅ Đã thêm ${insertedCount} sản phẩm vào Danh sách!` +
            (errors.length > 0 ? `\n⚠️ ${errors.length} lỗi` : "")
        );
      } else if (errors.length > 0) {
        setError(`Lỗi khi đồng bộ: ${errors.slice(0, 3).join(", ")}`);
      } else {
        setSuccessMessage("✅ Không có sản phẩm mới cần thêm.");
      }
    } catch (e: any) {
      setError((e?.message || String(e)) + " — Lỗi khi đồng bộ");
    } finally {
      setIsLoading(false);
    }
  };

  const suppliers = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => r.supplier && set.add(r.supplier));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.materialName.toLowerCase().includes(term) ||
          (r.materialSku || "").toLowerCase().includes(term)
      );
    }
    if (supplier) list = list.filter((r) => r.supplier === supplier);
    if (startDate) list = list.filter((r) => r.importDate >= startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setDate(end.getDate() + 1);
      list = list.filter((r) => r.importDate < end.toISOString());
    }
    return list;
  }, [rows, searchTerm, supplier, startDate, endDate]);

  const totals = useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.qty += r.quantity;
        acc.cost += r.totalCost;
        return acc;
      },
      { qty: 0, cost: 0 }
    );
  }, [filtered]);

  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(n);

  const fmtDateTime = (iso: string) => {
    const date = new Date(iso);
    // Format: dd/mm/yyyy HH:mm (chỉ hiện giờ nếu không phải 00:00 hoặc 07:00 - timezone default)
    const day = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    const hours = date.getHours();
    const minutes = date.getMinutes();

    // Nếu giờ là 00:00 hoặc 07:00 (thường là timezone default), chỉ hiển thị ngày
    if ((hours === 0 && minutes === 0) || (hours === 7 && minutes === 0)) {
      return `${day}/${month}/${year}`;
    }

    return `${day}/${month}/${year} ${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {/* Header removed per request */}

      {isLoading && (
        <div className="p-2 md:p-3 text-xs md:text-sm text-blue-800 bg-blue-100 border-b border-blue-300 dark:text-blue-200 dark:bg-blue-900/30 dark:border-blue-800">
          Đang xử lý...
        </div>
      )}
      {error && (
        <div className="p-2 md:p-3 text-xs md:text-sm text-red-800 bg-red-100 border-b border-red-300 dark:text-red-200 dark:bg-red-900/30 dark:border-red-800">
          Lỗi: {error}
        </div>
      )}
      {successMessage && (
        <div className="p-2 md:p-3 text-xs md:text-sm text-green-800 bg-green-100 border-b border-green-300 dark:text-green-200 dark:bg-green-900/30 dark:border-green-800">
          {successMessage}
        </div>
      )}

      {/* Filters + actions */}
      <div className="p-4 bg-gray-50/50 border-b border-gray-200 dark:bg-slate-900/50 dark:border-slate-800 space-y-4">
        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Tìm theo tên hoặc SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-10"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2">
               <Icon name="search" size="sm" tone="muted" />
            </span>
          </div>
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-10 appearance-none"
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-10"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white rounded-xl border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all h-10"
          />
        </div>

        {/* Stats + Actions Row */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-3">
             <div className="flex-1 md:flex-none bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 flex items-center gap-4 min-w-[160px] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                   <Icon name="package" size="md" tone="primary" weight="bold" />
                </div>
                <div>
                   <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Tổng lượt nhập</div>
                   <div className="text-xl font-black text-gray-900 dark:text-white leading-none">{filtered.length}</div>
                </div>
             </div>
             <div className="flex-1 md:flex-none bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl p-3 flex items-center gap-4 min-w-[200px] shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                   <Icon name="money" size="md" tone="success" weight="bold" />
                </div>
                <div>
                   <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Tổng giá trị</div>
                   <div className="text-xl font-black text-gray-900 dark:text-white leading-none">{fmtMoney(totals.cost)}</div>
                </div>
             </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncMissingMaterials}
              disabled={isLoading || rows.length === 0}
              className="flex-1 md:flex-none px-4 py-2.5 bg-slate-900 dark:bg-blue-600 text-white rounded-xl hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Icon name="arrows-clockwise" size="sm" />
              Đồng bộ từ Lịch sử
            </button>
            <button
              onClick={async () => {
                if (!confirm("Bạn có chắc chắn muốn xóa TẤT CẢ lịch sử nhập kho? Hành động không thể hoàn tác.")) return;
                try {
                  setIsLoading(true);
                  setError(null);
                  const { error: delErr } = await supabase.from("pin_material_history").delete().gte("import_date", "0001-01-01");
                  if (delErr) throw delErr;
                } catch (e: any) {
                  setError((e?.message || String(e)) + " — cần quyền DELETE/RLS policy cho pin_material_history");
                } finally {
                  await fetchRows();
                  setIsLoading(false);
                }
              }}
              className="flex-1 md:flex-none px-4 py-2.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl hover:bg-red-500 hover:text-white text-xs font-bold transition-all flex items-center justify-center gap-2 group"
            >
              <Icon name="trash" size="sm" className="group-hover:text-white" />
              Xóa lịch sử
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Icon name="package" size="xl" tone="muted" className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Không có lịch sử nhập kho phù hợp</p>
            </div>
          </div>
        ) : (
          <>
            {/* Mobile Card View */}
            <div className="md:hidden p-3 space-y-3">
              {filtered.map((r) => (
                <div
                  key={r.id}
                  className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-3 shadow-sm"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                        {r.materialName}
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">
                        {r.materialSku || "-"}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRow(r)}
                      className="ml-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <Icon name="trash" size="sm" />
                    </button>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <div className="text-gray-500 dark:text-gray-400 text-[10px] mb-0.5">
                        Số lượng
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {r.quantity.toLocaleString("vi-VN")}
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-2">
                      <div className="text-gray-500 dark:text-gray-400 text-[10px] mb-0.5">
                        Đơn giá
                      </div>
                      <div className="font-semibold text-gray-500 dark:text-gray-400">
                        {fmtMoney(r.purchasePrice)}
                      </div>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg mb-2">
                    <span className="text-xs text-gray-600 dark:text-gray-400">Thành tiền</span>
                    <span className="font-bold text-green-600 dark:text-green-400">
                      {fmtMoney(r.totalCost)}
                    </span>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <div className="flex items-center gap-1">
                      <Icon name="calendar" size="sm" />
                      {fmtDateTime(r.importDate)}
                    </div>
                    {r.supplier && (
                      <div className="flex items-center gap-1 truncate ml-2">
                        <Icon name="assets" size="sm" />
                        {r.supplier}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-sm text-gray-800 dark:text-white">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <tr className="bg-slate-100 dark:bg-slate-800/80 border-b-2 border-gray-200 dark:border-slate-700">
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Ngày nhập
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Vật liệu</th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">SKU</th>
                  <th className="px-4 py-4 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Số lượng
                  </th>
                  <th className="px-4 py-4 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Đơn giá</th>
                  <th className="px-4 py-4 text-right text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Thành tiền
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Nhà cung cấp
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                    Người nhập
                  </th>
                  <th className="px-4 py-4 text-left text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">Ghi chú</th>
                  <th className="px-4 py-4 text-center text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest w-20">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                      {fmtDateTime(r.importDate)}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                      {r.materialName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                      {r.materialSku || "-"}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-gray-700 dark:text-slate-300 tabular-nums">
                      {r.quantity.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-600 dark:text-slate-400 font-mono tabular-nums">
                      {fmtMoney(r.purchasePrice)}
                    </td>
                    <td className="px-4 py-4 text-right text-gray-900 dark:text-white font-mono font-black tabular-nums">
                      {fmtMoney(r.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {r.supplier || "-"}
                    </td>
                    <td className="px-4 py-4 text-gray-700 dark:text-gray-300">
                      {r.userName ? (
                        <div className="flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center text-[10px] font-bold text-blue-500 uppercase">
                              {r.userName.split("@")[0].charAt(0)}
                           </div>
                           <span className="text-xs">{r.userName.split("@")[0]}</span>
                        </div>
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">
                      {r.notes || "-"}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => handleDeleteRow(r)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all group/btn"
                        title="Xóa bản ghi này"
                      >
                        <Icon name="trash" size="sm" className="transition-transform group-hover/btn:scale-110" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
};

export default PinImportHistory;
