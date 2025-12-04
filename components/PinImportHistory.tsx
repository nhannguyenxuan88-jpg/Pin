import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabaseClient";

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

// Edit modal state
interface EditFormData {
  materialName: string;
  materialSku: string;
  quantity: number;
  purchasePrice: number;
  supplier: string;
  notes: string;
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

  // Edit modal state
  const [editingRow, setEditingRow] = useState<ImportHistoryRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    materialName: "",
    materialSku: "",
    quantity: 0,
    purchasePrice: 0,
    supplier: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  // Generate random SKU (NL-XXXXXXXX)
  const generateNewSKU = (existingSkus: Set<string>) => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const generateRandomCode = () => {
      let result = "";
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return `NL-${result}`;
    };

    let newSku = generateRandomCode();
    let attempts = 0;
    while (existingSkus.has(newSku) && attempts < 100) {
      newSku = generateRandomCode();
      attempts++;
    }
    return newSku;
  };

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

  // Open edit modal
  const handleEditRow = (row: ImportHistoryRow) => {
    setEditingRow(row);
    setEditForm({
      materialName: row.materialName,
      materialSku: row.materialSku || "",
      quantity: row.quantity,
      purchasePrice: row.purchasePrice,
      supplier: row.supplier || "",
      notes: row.notes || "",
    });
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingRow) return;

    try {
      setIsSaving(true);
      setError(null);

      const totalCost = editForm.quantity * editForm.purchasePrice;

      // Update pin_material_history
      const { error: updateErr } = await supabase
        .from("pin_material_history")
        .update({
          material_name: editForm.materialName,
          material_sku: editForm.materialSku || null,
          quantity: editForm.quantity,
          purchase_price: editForm.purchasePrice,
          total_cost: totalCost,
          supplier: editForm.supplier || null,
          notes: editForm.notes || null,
        })
        .eq("id", editingRow.id);

      if (updateErr) throw updateErr;

      // Also update pin_materials if materialId exists and SKU changed
      if (editingRow.materialId && editForm.materialSku !== editingRow.materialSku) {
        const { error: matErr } = await supabase
          .from("pin_materials")
          .update({
            sku: editForm.materialSku || null,
            name: editForm.materialName,
          })
          .eq("id", editingRow.materialId);

        if (matErr) {
          console.warn("Không thể cập nhật pin_materials:", matErr.message);
        }
      }

      // Close modal and refresh
      setEditingRow(null);
      await fetchRows();
    } catch (e: any) {
      setError(
        (e?.message || String(e)) + " — cần quyền UPDATE/RLS policy cho pin_material_history"
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Regenerate ALL SKUs with new format
  const handleRegenerateAllSKUs = async () => {
    if (
      !confirm(
        `Bạn có chắc muốn TẠO LẠI TẤT CẢ mã SKU?\n\n` +
          `✅ SKU mới sẽ theo format: NL-XXXXXXXX (8 ký tự ngẫu nhiên)\n` +
          `✅ Đảm bảo không trùng lặp\n` +
          `⚠️ SKU cũ sẽ bị thay thế hoàn toàn\n` +
          `⚠️ Cập nhật cả Lịch sử và Danh sách vật liệu`
      )
    )
      return;

    try {
      setIsLoading(true);
      setError(null);
      setSuccessMessage(null);

      const usedSkus = new Set<string>();
      let materialsUpdated = 0;
      let historyUpdated = 0;

      // 1. Get ALL materials from pin_materials
      const { data: allMaterials, error: fetchMatErr } = await supabase
        .from("pin_materials")
        .select("id, sku, name");

      if (fetchMatErr) {
        throw new Error("Lỗi lấy danh sách materials: " + fetchMatErr.message);
      }

      // 2. Create mapping: material name -> new SKU
      const nameToSkuMap = new Map<string, string>();

      // Update all materials in pin_materials table
      if (allMaterials && allMaterials.length > 0) {
        for (const mat of allMaterials) {
          const newSku = generateNewSKU(usedSkus);
          usedSkus.add(newSku);

          // Store mapping by name (normalized)
          const normalizedName = mat.name?.trim().toLowerCase() || "";
          if (normalizedName) {
            nameToSkuMap.set(normalizedName, newSku);
          }

          const { error: matErr } = await supabase
            .from("pin_materials")
            .update({ sku: newSku })
            .eq("id", mat.id);

          if (!matErr) {
            materialsUpdated++;
          } else {
            console.error(`Lỗi cập nhật material ${mat.id}:`, matErr.message);
          }
        }
      }

      // 3. Update ALL history records - match by material name
      const { data: allHistory, error: fetchHistErr } = await supabase
        .from("pin_material_history")
        .select("id, material_name, material_sku");

      if (fetchHistErr) {
        console.error("Lỗi lấy history:", fetchHistErr.message);
      }

      if (allHistory && allHistory.length > 0) {
        for (const hist of allHistory) {
          const normalizedName = hist.material_name?.trim().toLowerCase() || "";

          // Try to find matching SKU from material name
          let newSku = nameToSkuMap.get(normalizedName);

          // If no match found, generate a new unique SKU
          if (!newSku) {
            newSku = generateNewSKU(usedSkus);
            usedSkus.add(newSku);
          }

          const { error: histErr } = await supabase
            .from("pin_material_history")
            .update({ material_sku: newSku })
            .eq("id", hist.id);

          if (!histErr) {
            historyUpdated++;
          } else {
            console.error(`Lỗi cập nhật history ${hist.id}:`, histErr.message);
          }
        }
      }

      setSuccessMessage(
        `✅ Đã cập nhật thành công!\n` +
          `• ${materialsUpdated}/${allMaterials?.length || 0} vật liệu trong Danh sách\n` +
          `• ${historyUpdated}/${allHistory?.length || 0} bản ghi trong Lịch sử`
      );

      // Refresh data
      await fetchRows();
    } catch (e: any) {
      setError((e?.message || String(e)) + " — Lỗi khi tạo lại SKU");
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
          Đang tải lịch sử...
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
      <div className="p-3 md:p-4 bg-gray-50 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 space-y-2 md:space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4 md:gap-3">
          <input
            type="text"
            placeholder="🔍 Tìm theo tên hoặc SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleRegenerateAllSKUs}
            disabled={isLoading || rows.length === 0}
            className="px-2.5 md:px-3 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-xs md:text-sm font-medium"
            title="Tạo lại tất cả mã SKU theo format mới (NL-XXXXXXXX)"
          >
            🔄 Tạo lại tất cả SKU
          </button>
          <button
            onClick={async () => {
              if (
                !confirm(
                  "Bạn có chắc chắn muốn xóa TẤT CẢ lịch sử nhập kho? Hành động không thể hoàn tác."
                )
              )
                return;
              try {
                setIsLoading(true);
                setError(null);
                const { error: delErr } = await supabase
                  .from("pin_material_history")
                  .delete()
                  .gte("import_date", "0001-01-01");
                if (delErr) throw delErr;
              } catch (e: any) {
                setError(
                  (e?.message || String(e)) +
                    " — cần quyền DELETE/RLS policy cho pin_material_history"
                );
              } finally {
                await fetchRows();
                setIsLoading(false);
              }
            }}
            className="px-2.5 md:px-3 py-1.5 md:py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 text-xs md:text-sm font-medium"
            title="Xóa toàn bộ lịch sử nhập kho"
          >
            🗑️ Xóa lịch sử nhập kho
          </button>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 text-xs md:text-sm">
          <div className="px-2.5 md:px-3 py-1.5 md:py-2 bg-blue-100 text-blue-800 rounded-lg dark:bg-blue-900/30 dark:text-blue-200">
            📦 Tổng lượt nhập: <strong>{filtered.length}</strong>
          </div>
          <div className="px-2.5 md:px-3 py-1.5 md:py-2 bg-green-100 text-green-800 rounded-lg dark:bg-green-900/30 dark:text-green-200">
            💰 Tổng giá trị: <strong>{fmtMoney(totals.cost)}</strong>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-2xl mb-2">📭</p>
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
                    <div className="flex items-center gap-1 ml-2">
                      <button
                        onClick={() => handleEditRow(r)}
                        className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                        title="Sửa"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteRow(r)}
                        className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                        title="Xóa"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
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
                      <div className="font-semibold text-yellow-600 dark:text-yellow-400">
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
                    <span>📅 {fmtDateTime(r.importDate)}</span>
                    {r.supplier && <span className="truncate ml-2">🏢 {r.supplier}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-sm text-gray-800 dark:text-white">
              <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                    Ngày nhập
                  </th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">Vật liệu</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">SKU</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                    Số lượng
                  </th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">Đơn giá</th>
                  <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                    Thành tiền
                  </th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                    Nhà cung cấp
                  </th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                    Người nhập
                  </th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">Ghi chú</th>
                  <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
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
                    <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-white">
                      {r.quantity.toLocaleString("vi-VN")}
                    </td>
                    <td className="px-4 py-3 text-right text-yellow-600 dark:text-yellow-400 font-mono">
                      {fmtMoney(r.purchasePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-mono font-bold">
                      {fmtMoney(r.totalCost)}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {r.supplier || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {r.userName || "-"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">
                      {r.notes || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditRow(r)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500"
                          title="Sửa bản ghi này"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteRow(r)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500"
                          title="Xóa bản ghi này"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                ✏️ Sửa bản ghi nhập kho
              </h3>
              <button
                onClick={() => setEditingRow(null)}
                className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4">
              {/* SKU - Highlight this field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SKU <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.materialSku}
                  onChange={(e) => setEditForm({ ...editForm, materialSku: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-yellow-50 dark:bg-yellow-900/20 text-gray-900 dark:text-white rounded-lg border-2 border-yellow-400 dark:border-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 font-mono"
                  placeholder="VD: NL-A1B2C3D4"
                />
                <p className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
                  ⚠️ Format mới: NL-XXXXXXXX (8 ký tự)
                </p>
              </div>

              {/* Material Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tên vật liệu
                </label>
                <input
                  type="text"
                  value={editForm.materialName}
                  onChange={(e) => setEditForm({ ...editForm, materialName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Quantity & Price */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Số lượng
                  </label>
                  <input
                    type="number"
                    value={editForm.quantity}
                    onChange={(e) =>
                      setEditForm({ ...editForm, quantity: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Đơn giá (VNĐ)
                  </label>
                  <input
                    type="number"
                    value={editForm.purchasePrice}
                    onChange={(e) =>
                      setEditForm({ ...editForm, purchasePrice: Number(e.target.value) || 0 })
                    }
                    className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              </div>

              {/* Total (calculated) */}
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Thành tiền:</span>
                  <span className="text-lg font-bold text-green-600 dark:text-green-400">
                    {new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
                      editForm.quantity * editForm.purchasePrice
                    )}
                  </span>
                </div>
              </div>

              {/* Supplier */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nhà cung cấp
                </label>
                <input
                  type="text"
                  value={editForm.supplier}
                  onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ghi chú
                </label>
                <textarea
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg border border-gray-300 dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditingRow(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isSaving || !editForm.materialName}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving ? "Đang lưu..." : "💾 Lưu thay đổi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinImportHistory;
