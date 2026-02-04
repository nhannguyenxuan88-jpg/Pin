import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { PinMaterialHistory, PinMaterial } from "../types";
import { supabase } from "../supabaseClient";

interface MaterialHistoryViewerProps {
  onClose?: () => void;
}

const MaterialHistoryViewer: React.FC<MaterialHistoryViewerProps> = ({
  onClose,
}) => {
  const { pinMaterialHistory, pinMaterials, reloadPinMaterialHistory, currentUser } =
    usePinContext();

  // Local fallback: fetch directly if context has no data
  const [localHistory, setLocalHistory] = useState<PinMaterialHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedFallbackSource, setUsedFallbackSource] = useState<
    "none" | "direct" | "stock_history"
  >("none");

  const fetchHistoryDirect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Note: keep mapping robust to snake/camel cases
      const { data, error } = await supabase
        .from("pin_material_history")
        .select("*")
        .order("import_date", { ascending: false })
        .limit(1000);
      if (error) throw error;
      const mapped = (data || []).map(
        (row: any): PinMaterialHistory => ({
          id: row.id,
          materialId: row.material_id || row.materialid || undefined,
          materialName: row.material_name || row.materialname || "",
          materialSku: row.material_sku || row.materialsku || undefined,
          quantity: Number(row.quantity ?? 0),
          purchasePrice: Number(row.purchase_price ?? row.purchaseprice ?? 0),
          totalCost: Number(row.total_cost ?? row.totalcost ?? 0),
          supplier: row.supplier || undefined,
          importDate:
            row.import_date || row.importdate || new Date().toISOString(),
          notes: row.notes || undefined,
          userId: row.user_id || row.userid || undefined,
          userName: row.user_name || row.username || undefined,
          branchId: row.branch_id || row.branchid || "main",
          created_at: row.created_at || row.createdat || undefined,
        })
      );
      setLocalHistory(mapped);
      setUsedFallbackSource("direct");
      console.log("📥 Direct history fetched:", mapped.length);

      // If no records found, attempt fallback from stock history
      if ((mapped || []).length === 0) {
        const { data: stockRows, error: stockErr } = await supabase
          .from("pin_stock_history")
          .select("*")
          .eq("transaction_type", "import")
          .order("created_at", { ascending: false })
          .limit(1000);
        if (!stockErr && Array.isArray(stockRows)) {
          const byId: Record<string, { name: string; sku?: string }> = {};
          pinMaterials.forEach(
            (m: PinMaterial) => (byId[m.id] = { name: m.name, sku: m.sku })
          );
          const mappedFromStock: PinMaterialHistory[] = stockRows.map(
            (row: any) => {
              const lookup = row.material_id
                ? byId[row.material_id]
                : undefined;
              return {
                id: row.id,
                materialId: row.material_id,
                materialName: lookup?.name || row.material_id || "(Không rõ)",
                materialSku: lookup?.sku,
                quantity: Math.abs(Number(row.quantity_change ?? 0)),
                purchasePrice: 0,
                totalCost: 0,
                supplier: undefined,
                importDate: row.created_at || new Date().toISOString(),
                notes: row.reason || undefined,
                userId: row.created_by || undefined,
                userName: undefined,
                branchId: "main", // fallback to main branch
                created_at: row.created_at || undefined,
              } as PinMaterialHistory;
            }
          );
          setLocalHistory(mappedFromStock);
          setUsedFallbackSource("stock_history");
          console.log(
            "📥 Fallback stock history fetched:",
            mappedFromStock.length
          );
        }
      }
    } catch (e: unknown) {
      console.error("Direct history fetch failed:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!pinMaterialHistory || pinMaterialHistory.length === 0) {
      fetchHistoryDirect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debug log
  console.log(
    "📊 MaterialHistoryViewer - pinMaterialHistory:",
    pinMaterialHistory
  );
  console.log(
    "📊 MaterialHistoryViewer - pinMaterialHistory.length:",
    pinMaterialHistory.length
  );

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState("");

  // Choose effective source (context preferred; fallback to local)
  const sourceHistory: PinMaterialHistory[] =
    pinMaterialHistory.length > 0 ? pinMaterialHistory : localHistory;

  // Get unique suppliers from history
  const suppliers = useMemo(() => {
    const uniqueSuppliers = new Set<string>();
    sourceHistory.forEach((h) => {
      if (h.supplier) uniqueSuppliers.add(h.supplier);
    });
    return Array.from(uniqueSuppliers).sort();
  }, [sourceHistory]);

  // Filter history
  const filteredHistory = useMemo(() => {
    let filtered = [...sourceHistory];

    // Filter by search term (material name or SKU)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (h) =>
          h.materialName.toLowerCase().includes(term) ||
          h.materialSku?.toLowerCase().includes(term)
      );
    }

    // Filter by material ID
    if (selectedMaterialId) {
      filtered = filtered.filter((h) => h.materialId === selectedMaterialId);
    }

    // Filter by date range
    if (startDate) {
      filtered = filtered.filter((h) => h.importDate >= startDate);
    }
    if (endDate) {
      const endDatePlusOne = new Date(endDate);
      endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
      filtered = filtered.filter(
        (h) => h.importDate < endDatePlusOne.toISOString()
      );
    }

    // Filter by supplier
    if (selectedSupplier) {
      filtered = filtered.filter((h) => h.supplier === selectedSupplier);
    }

    // Sort by import date (newest first)
    filtered.sort(
      (a, b) =>
        new Date(b.importDate).getTime() - new Date(a.importDate).getTime()
    );

    return filtered;
  }, [
    sourceHistory,
    searchTerm,
    selectedMaterialId,
    startDate,
    endDate,
    selectedSupplier,
  ]);

  // Calculate totals
  const totals = useMemo(() => {
    return filteredHistory.reduce(
      (acc, h) => {
        acc.totalQuantity += h.quantity;
        acc.totalCost += h.totalCost;
        return acc;
      },
      { totalQuantity: 0, totalCost: 0 }
    );
  }, [filteredHistory]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleString("vi-VN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMaterialId("");
    setStartDate("");
    setEndDate("");
    setSelectedSupplier("");
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900">
      {(() => {
        console.log("✅ MaterialHistoryViewer RENDERED", {
          historyCount: sourceHistory.length,
          filteredCount: filteredHistory.length,
        });
        return null;
      })()}
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-blue-600 dark:bg-gray-800 border-b border-blue-700 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            📊 Lịch sử nhập nguyên vật liệu
          </h2>
          <span className="text-xs px-2 py-1 bg-blue-900/40 text-white rounded">
            {sourceHistory.length} bản ghi
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              reloadPinMaterialHistory?.();
              fetchHistoryDirect();
            }}
            className="px-3 py-2 bg-blue-700 text-white rounded hover:bg-blue-600 text-sm"
          >
            🔄 Tải lại
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
            >
              Đóng
            </button>
          )}
        </div>
      </div>

      {/* Loading / Error states */}
      {isLoading && (
        <div className="p-3 text-sm text-blue-200 bg-blue-900/30 border-b border-blue-800">
          Đang tải lịch sử nhập kho...
        </div>
      )}
      {error && (
        <div className="p-3 text-sm text-red-200 bg-red-900/30 border-b border-red-800">
          Lỗi tải dữ liệu: {error}
        </div>
      )}
      {!error && usedFallbackSource !== "none" && (
        <div className="p-3 text-xs text-yellow-800 bg-yellow-100 border-b border-yellow-300 dark:text-yellow-200 dark:bg-yellow-900/30 dark:border-yellow-800">
          Đang hiển thị lịch sử từ nguồn:{" "}
          {usedFallbackSource === "direct"
            ? "pin_material_history"
            : "pin_stock_history"}
        </div>
      )}
      {!isLoading && !error && sourceHistory.length === 0 && (
        <div className="p-3 text-xs flex items-center gap-2 text-gray-700 bg-gray-100 border-b border-gray-300 dark:text-gray-200 dark:bg-gray-800 dark:border-gray-700">
          Chưa có bản ghi lịch sử. Hãy nhập hàng hoặc thêm 1 bản ghi mẫu để kiểm
          tra UI.
          <button
            className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={async () => {
              try {
                const demo = {
                  // id: let DB generate UUID (do not set to avoid uuid parse error)
                  material_id: pinMaterials[0]?.id ?? null,
                  material_name: pinMaterials[0]?.name ?? "Vật liệu demo",
                  material_sku: pinMaterials[0]?.sku ?? "DEMO-000",
                  quantity: 5,
                  purchase_price: 10000,
                  total_cost: 50000,
                  supplier: "NCC Demo",
                  import_date: new Date().toISOString(),
                  notes: "Bản ghi demo để kiểm tra hiển thị",
                  user_id: currentUser?.id ?? null,
                  user_name: currentUser?.email ?? "Demo",
                  branch_id: "main",
                  created_at: new Date().toISOString(),
                };
                const { error: insertError } = await supabase
                  .from("pin_material_history")
                  .insert(demo);
                if (insertError) throw insertError;
                await reloadPinMaterialHistory?.();
                await fetchHistoryDirect();
              } catch (e: unknown) {
                const errMsg = e instanceof Error ? e.message : String(e);
                setError(errMsg);
              }
            }}
          >
            ➕ Thêm bản ghi demo
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="p-4 bg-gray-800 border-b border-gray-700 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search */}
          <input
            type="text"
            placeholder="🔍 Tìm theo tên hoặc SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          />

          {/* Material filter */}
          <select
            value={selectedMaterialId}
            onChange={(e) => setSelectedMaterialId(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tất cả vật liệu</option>
            {pinMaterials.map((m: PinMaterial) => (
              <option key={m.id} value={m.id}>
                {m.name} - {m.sku}
              </option>
            ))}
          </select>

          {/* Supplier filter */}
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          >
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Date range */}
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            placeholder="Từ ngày"
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            placeholder="Đến ngày"
            className="px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          />

          {/* Clear filters button */}
          <button
            onClick={clearFilters}
            className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            🔄 Xóa bộ lọc
          </button>
        </div>

        {/* Summary */}
        <div className="flex gap-4 text-sm">
          <div className="px-3 py-2 bg-blue-900/30 text-blue-300 rounded">
            📦 Tổng lượt nhập: <strong>{filteredHistory.length}</strong>
          </div>
          <div className="px-3 py-2 bg-green-900/30 text-green-300 rounded">
            💰 Tổng giá trị: <strong>{formatCurrency(totals.totalCost)}</strong>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {filteredHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <p className="text-2xl mb-2">📭</p>
              <p>Không có lịch sử nhập kho phù hợp</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm text-gray-800 dark:text-white">
            <thead className="sticky top-0 bg-gray-100 border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  Ngày nhập
                </th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  Vật liệu
                </th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  SKU
                </th>
                <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                  Số lượng
                </th>
                <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                  Đơn giá
                </th>
                <th className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                  Thành tiền
                </th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  Nhà cung cấp
                </th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  Người nhập
                </th>
                <th className="px-4 py-3 text-left text-gray-700 dark:text-gray-200">
                  Ghi chú
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map((h) => (
                <tr
                  key={h.id}
                  className="border-b border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                >
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    {formatDate(h.importDate)}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800 dark:text-white">
                    {h.materialName}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                    {h.materialSku || "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-700 dark:text-white">
                    {h.quantity.toLocaleString("vi-VN")}
                  </td>
                  <td className="px-4 py-3 text-right text-yellow-600 dark:text-yellow-400 font-mono">
                    {formatCurrency(h.purchasePrice)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-mono font-bold">
                    {formatCurrency(h.totalCost)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {h.supplier || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                    {h.userName || "-"}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs truncate">
                    {h.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default MaterialHistoryViewer;
