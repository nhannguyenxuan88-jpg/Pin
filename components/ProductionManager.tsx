import React, { useState, useMemo, useEffect } from "react";
import type { ProductionOrder, PinMaterial, PinBOM } from "../types";
import { TrashIcon, XMarkIcon } from "./common/Icons";
import OwnerDisplay from "./common/OwnerDisplay";
import Pagination from "./common/Pagination";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

// --- Main Component ---
interface ProductionManagerProps {
  orders: ProductionOrder[];
  updateOrder: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  completeOrder?: (orderId: string) => Promise<void>;
  currentUser?: { id?: string } | null;
  materials?: PinMaterial[];
  boms?: PinBOM[];
}

const ITEMS_PER_PAGE = 10;

const ProductionManager: React.FC<ProductionManagerProps> = ({
  orders,
  updateOrder,
  completeOrder,
  currentUser,
  materials = [],
  boms = [],
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [detailOrder, setDetailOrder] = useState<ProductionOrder | null>(null);
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);
  const [resumeChecked, setResumeChecked] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Recovery: detect a pending production completion after a reload and offer to resume
  useEffect(() => {
    if (resumeChecked) return;
    const tokenStr = localStorage.getItem("pending-production-completion");
    if (!tokenStr) {
      setResumeChecked(true);
      return;
    }
    let token: { orderId?: string; startedAt?: number } | null = null;
    try {
      token = JSON.parse(tokenStr);
    } catch {
      // Bad token, clear it
      localStorage.removeItem("pending-production-completion");
      setResumeChecked(true);
      return;
    }
    if (!token?.orderId) {
      localStorage.removeItem("pending-production-completion");
      setResumeChecked(true);
      return;
    }

    const pendingOrder = orders.find((o) => o.id === token!.orderId);
    if (!pendingOrder) {
      // Orders may not be loaded yet; wait for next render
      return;
    }

    if (pendingOrder.status === "Hoàn thành") {
      // Already completed — clean up token
      localStorage.removeItem("pending-production-completion");
      setResumeChecked(true);
      return;
    }

    // If user is not logged in yet, defer until they log in
    if (!currentUser) {
      return;
    }

    const proceed = window.confirm(
      `Phát hiện thao tác hoàn thành Lệnh #${pendingOrder.id} đang dở dang.\n\nBạn có muốn tiếp tục hoàn thành không?`
    );
    if (!proceed) {
      localStorage.removeItem("pending-production-completion");
      setResumeChecked(true);
      return;
    }

    // Resume without showing the second confirmation dialog
    const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "Đang lưu dữ liệu sản xuất. Vui lòng chờ để tránh mất dữ liệu.";
      return e.returnValue;
    };
    (async () => {
      try {
        setCompletingOrderId(pendingOrder.id);
        window.addEventListener("beforeunload", beforeUnloadHandler);
        await completeOrder?.(pendingOrder.id);
        // Clear token on success
        localStorage.removeItem("pending-production-completion");
      } catch (e) {
        console.error("Lỗi khi tiếp tục hoàn thành lệnh sản xuất:", e);
      } finally {
        setCompletingOrderId(null);
        window.removeEventListener("beforeunload", beforeUnloadHandler);
        setResumeChecked(true);
      }
    })();
  }, [orders, currentUser, resumeChecked, completeOrder]);

  const filteredOrders = useMemo(() => {
    const sortedOrders = [...orders].sort(
      (a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
    );
    if (!searchTerm.trim()) {
      return sortedOrders;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return sortedOrders.filter(
      (order) =>
        order.productName.toLowerCase().includes(lowercasedTerm) ||
        order.id.toLowerCase().includes(lowercasedTerm)
    );
  }, [orders, searchTerm]);

  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredOrders.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredOrders, currentPage]);

  const totalPages = Math.ceil(filteredOrders.length / ITEMS_PER_PAGE);

  const getStatusChipClass = (status: ProductionOrder["status"]) => {
    switch (status) {
      case "Hoàn thành":
        return "bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300";
      case "Đã nhập kho":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300";
      case "Đang sản xuất":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300";
      case "Đang chờ":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300";
      case "Đã hủy":
        return "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200";
    }
  };

  const handleCancelOrder = (order: ProductionOrder) => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để thực hiện thao tác.");
      return;
    }
    const message =
      order.status === "Hoàn thành"
        ? `Bạn có chắc chắn muốn tháo dỡ Lệnh sản xuất #${order.id} không? Thành phẩm sẽ bị trừ và nguyên vật liệu sẽ được hoàn trả về kho.`
        : `Bạn có chắc chắn muốn hủy Lệnh sản xuất #${order.id} không? Nguyên vật liệu đã sử dụng sẽ được hoàn trả về kho.`;

    if (window.confirm(message)) {
      updateOrder(order.id, "Đã hủy");
    }
  };

  const handleCompleteOrder = async (order: ProductionOrder) => {
    console.log("🔧 [DEBUG] handleCompleteOrder called for order:", order.id);

    if (!currentUser) {
      console.log("🔧 [DEBUG] No currentUser");
      alert("Vui lòng đăng nhập để thực hiện thao tác.");
      return;
    }

    if (!completeOrder) {
      console.log("🔧 [DEBUG] No completeOrder function provided");
      alert("Chức năng hoàn thành lệnh sản xuất chưa được kích hoạt.");
      return;
    }

    console.log("🔧 [DEBUG] All checks passed, showing confirmation...");

    const message =
      `Hoàn thành lệnh sản xuất #${order.id}?\n\n` +
      `• Sản phẩm: ${order.productName}\n` +
      `• Số lượng: ${order.quantityProduced}\n` +
      `• Tồn kho thành phẩm sẽ được tăng lên\n\n` +
      `Bạn có chắc chắn muốn tiếp tục?`;

    if (window.confirm(message)) {
      console.log("🔧 [DEBUG] User confirmed, calling completeOrder...");
      // Guard against accidental reload/close while saving
      const beforeUnloadHandler = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        // Some browsers ignore custom text
        e.returnValue = "Đang lưu dữ liệu sản xuất. Vui lòng chờ để tránh mất dữ liệu.";
        return e.returnValue;
      };
      try {
        setCompletingOrderId(order.id);
        window.addEventListener("beforeunload", beforeUnloadHandler);
        // Persist a minimal resume token in case the tab is closed/refreshed mid-flight
        localStorage.setItem(
          "pending-production-completion",
          JSON.stringify({ orderId: order.id, startedAt: Date.now() })
        );
        await completeOrder(order.id);
        console.log("🔧 [DEBUG] completeOrder finished successfully");
        // Clear the resume token on success
        localStorage.removeItem("pending-production-completion");
      } catch (error) {
        console.error("🔧 [DEBUG] Error in completeOrder:", error);
        alert("Có lỗi xảy ra khi hoàn thành lệnh sản xuất. Vui lòng thử lại.");
      } finally {
        setCompletingOrderId(null);
        window.removeEventListener("beforeunload", beforeUnloadHandler);
      }
    } else {
      console.log("🔧 [DEBUG] User cancelled");
    }
  };

  return (
    <>
      <div className="space-y-4 md:space-y-6 pb-20 md:pb-0">
        {/* Search - Mobile optimized */}
        <div className="flex justify-end">
          <input
            type="text"
            placeholder="Tìm theo tên SP hoặc mã lệnh..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full sm:w-72 input-base text-sm"
          />
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-x-auto">
          <table className="w-full text-left min-w-max">
            <thead className="border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Mã Lệnh</th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Ngày tạo</th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">
                  Tên Thành phẩm
                </th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Người tạo</th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-center">
                  Số lượng
                </th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300">Trạng thái</th>
                <th className="p-3 font-semibold text-slate-600 dark:text-slate-300 text-right">
                  Tổng giá vốn
                </th>
                <th className="p-3"></th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {paginatedOrders.map((order) => (
                <tr
                  key={order.id}
                  className={`border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/50 ${order.status === "Đã hủy"
                    ? "bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400"
                    : ""
                    }`}
                >
                  <td
                    className={`p-3 font-medium ${order.status === "Đã hủy"
                      ? "text-slate-500"
                      : "text-sky-600 dark:text-sky-400"
                      }`}
                  >
                    {order.id}
                  </td>
                  <td
                    className={`p-3 text-slate-600 dark:text-slate-300 ${order.status === "Đã hủy" && "line-through"
                      }`}
                  >
                    {order.creationDate}
                  </td>
                  <td
                    className={`p-3 font-medium ${order.status === "Đã hủy"
                      ? "text-slate-500 line-through"
                      : "text-slate-800 dark:text-slate-200"
                      }`}
                  >
                    {order.productName}
                  </td>
                  <td
                    className={`p-3 text-slate-600 dark:text-slate-300 ${order.status === "Đã hủy" && "line-through"
                      }`}
                  >
                    <OwnerDisplay owner={order.userName ?? null} />
                  </td>
                  <td
                    className={`p-3 text-center ${order.status === "Đã hủy"
                      ? "text-slate-500 line-through"
                      : "text-slate-800 dark:text-slate-200"
                      }`}
                  >
                    {order.quantityProduced}
                  </td>
                  <td className="p-3">
                    <select
                      value={order.status}
                      onChange={(e) => {
                        if (!currentUser) {
                          alert("Vui lòng đăng nhập để thực hiện thao tác.");
                          return;
                        }
                        updateOrder(order.id, e.target.value as ProductionOrder["status"]);
                      }}
                      disabled={
                        order.status === "Đã hủy" || order.status === "Hoàn thành" || order.status === "Đã nhập kho" || !currentUser
                      }
                      title={!currentUser ? "Bạn phải đăng nhập để thay đổi trạng thái" : undefined}
                      className={`px-2 py-1 text-xs font-semibold rounded-full border-0 focus:ring-0 focus:outline-none appearance-none ${getStatusChipClass(
                        order.status
                      )}`}
                    >
                      <option value="Đang chờ">Đang chờ</option>
                      <option value="Đang sản xuất">Đang sản xuất</option>
                      <option value="Hoàn thành">Hoàn thành</option>
                      <option value="Đã nhập kho" disabled>
                        Đã nhập kho
                      </option>
                      <option value="Đã hủy" disabled>
                        Đã hủy
                      </option>
                    </select>
                  </td>
                  <td
                    className={`p-3 text-right font-semibold ${order.status === "Đã hủy"
                      ? "text-slate-500 line-through"
                      : "text-slate-900 dark:text-slate-100"
                      }`}
                  >
                    {formatCurrency(order.totalCost)}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setDetailOrder(order)}
                        className="text-slate-600 dark:text-slate-300 underline"
                      >
                        Chi tiết
                      </button>
                      {order.status !== "Hoàn thành" && order.status !== "Đã nhập kho" && order.status !== "Đã hủy" && (
                        <button
                          onClick={() => handleCompleteOrder(order)}
                          disabled={!currentUser || completingOrderId === order.id}
                          className={`px-2 py-1 text-xs rounded ${!currentUser || completingOrderId === order.id
                            ? "bg-green-200 text-green-600 cursor-not-allowed"
                            : "bg-green-600 text-white hover:bg-green-700"
                            }`}
                          title={
                            !currentUser
                              ? "Bạn phải đăng nhập để hoàn thành lệnh"
                              : completingOrderId === order.id
                                ? "Đang lưu dữ liệu..."
                                : "Hoàn thành lệnh sản xuất - tăng tồn kho thành phẩm"
                          }
                        >
                          {completingOrderId === order.id ? "Đang lưu..." : "Hoàn thành"}
                        </button>
                      )}
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={order.status === "Đã hủy" || !currentUser}
                        className={`p-1 ${!currentUser ? "text-red-300 cursor-not-allowed" : "text-red-500"
                          } disabled:text-red-500/30 disabled:cursor-not-allowed`}
                        title={
                          !currentUser
                            ? "Bạn phải đăng nhập để hủy lệnh"
                            : order.status === "Đã hủy"
                              ? "Lệnh đã được hủy"
                              : order.status === "Hoàn thành"
                                ? "Tháo dỡ lệnh sản xuất"
                                : "Hủy lệnh sản xuất"
                        }
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredOrders.length === 0 && (
            <div className="text-center p-8 text-slate-500 dark:text-slate-400">
              {searchTerm ? "Không tìm thấy lệnh sản xuất nào." : "Chưa có lệnh sản xuất nào."}
            </div>
          )}
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-3">
          {paginatedOrders.length === 0 ? (
            <div className="text-center p-8 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-800 rounded-lg">
              {searchTerm ? "Không tìm thấy lệnh sản xuất nào." : "Chưa có lệnh sản xuất nào."}
            </div>
          ) : (
            paginatedOrders.map((order) => (
              <div
                key={order.id}
                className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-700 p-3 ${order.status === "Đã hủy" ? "opacity-60" : ""
                  }`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <div
                      className={`font-medium text-sm ${order.status === "Đã hủy"
                        ? "text-slate-500 line-through"
                        : "text-sky-600 dark:text-sky-400"
                        }`}
                    >
                      {order.id}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {order.creationDate}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusChipClass(order.status)}`}
                  >
                    {order.status}
                  </span>
                </div>

                {/* Product Name */}
                <div
                  className={`font-medium text-sm mb-2 ${order.status === "Đã hủy"
                    ? "text-slate-500 line-through"
                    : "text-slate-800 dark:text-slate-200"
                    }`}
                >
                  {order.productName}
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                  <div className="text-slate-500 dark:text-slate-400">
                    Số lượng:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {order.quantityProduced}
                    </span>
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">
                    Người tạo:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {order.userName || "N/A"}
                    </span>
                  </div>
                </div>

                {/* Total Cost */}
                <div className="flex items-center justify-between pt-2 border-t dark:border-slate-700">
                  <button
                    onClick={() => setDetailOrder(order)}
                    className="text-xs text-sky-600 dark:text-sky-400 font-medium"
                  >
                    Giá vốn: {formatCurrency(order.totalCost)}
                  </button>
                  <div className="flex items-center gap-2">
                    {order.status === "Đang sản xuất" && completeOrder && (
                      <button
                        onClick={() => handleCompleteOrder(order)}
                        disabled={!currentUser || completingOrderId === order.id}
                        className={`px-2 py-1 text-xs rounded ${!currentUser || completingOrderId === order.id
                          ? "bg-green-200 text-green-600 cursor-not-allowed"
                          : "bg-green-600 text-white"
                          }`}
                      >
                        {completingOrderId === order.id ? "..." : "Hoàn thành"}
                      </button>
                    )}
                    {order.status !== "Đã hủy" && (
                      <button
                        onClick={() => handleCancelOrder(order)}
                        disabled={!currentUser}
                        className="p-1.5 text-red-500 bg-red-50 dark:bg-red-900/20 rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            itemsPerPage={ITEMS_PER_PAGE}
            totalItems={filteredOrders.length}
          />
        )}
      </div>
      {detailOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl">
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <h3 className="text-lg font-bold">Chi tiết chi phí Lệnh {detailOrder.id}</h3>
              <button onClick={() => setDetailOrder(null)}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 space-y-3">
              <div className="flex justify-between text-sm">
                <span>Ngày tạo</span>
                <span>{detailOrder.creationDate}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Thành phẩm</span>
                <span>{detailOrder.productName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Số lượng</span>
                <span>{detailOrder.quantityProduced}</span>
              </div>
              <div className="border-t dark:border-slate-700 pt-3">
                <p className="font-semibold mb-2">Chi tiết NVL (ước tính theo BOM)</p>
                <div className="space-y-1 text-sm max-h-48 overflow-y-auto pr-2">
                  {(boms.find((b) => b.id === detailOrder.bomId)?.materials || []).map((m) => {
                    const matInfo = materials.find((mm) => mm.id === m.materialId);
                    const required = (m.quantity || 0) * (detailOrder.quantityProduced || 0);
                    const unitCost = matInfo?.purchasePrice || 0;
                    return (
                      <div key={m.materialId} className="flex justify-between">
                        <span className="truncate mr-2">{matInfo?.name || m.materialId}</span>
                        <span>
                          {required} x {formatCurrency(unitCost)} ={" "}
                          <strong>{formatCurrency(required * unitCost)}</strong>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              {detailOrder.additionalCosts?.length ? (
                <div className="border-t dark:border-slate-700 pt-3">
                  <p className="font-semibold mb-2">Chi phí phát sinh</p>
                  <div className="space-y-1 text-sm">
                    {detailOrder.additionalCosts.map((c, idx) => (
                      <div key={idx} className="flex justify-between">
                        <span>{c.description}</span>
                        <span>{formatCurrency(c.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="border-t dark:border-slate-700 pt-3 flex justify-between font-bold">
                <span>Tổng giá vốn</span>
                <span>{formatCurrency(detailOrder.totalCost)}</span>
              </div>
            </div>
            <div className="p-4 border-t dark:border-slate-700 flex justify-end">
              <button
                onClick={() => setDetailOrder(null)}
                className="bg-slate-200 dark:bg-slate-700 px-4 py-2 rounded-lg"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductionManager;
