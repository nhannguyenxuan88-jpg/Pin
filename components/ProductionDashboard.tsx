import React, { useState, useMemo, useCallback } from "react";
import type { ProductionOrder, PinMaterial, PinBOM, User } from "../types";
import {
  ArrowPathIcon,
  BeakerIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClipboardDocumentCheckIcon,
  ClockIcon,
  CurrencyDollarIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  UserIcon,
} from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

interface ProductionOrderCardProps {
  order: ProductionOrder;
  onMove: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  onViewDetails: (order: ProductionOrder) => void;
  currentUser?: User | null;
  isDragging?: boolean;
  isCompleting?: boolean;
}

const ProductionOrderCard: React.FC<ProductionOrderCardProps> = ({
  order,
  onMove,
  onViewDetails,
  currentUser,
  isDragging = false,
  isCompleting = false,
}) => {
  const getStatusInfo = (status: ProductionOrder["status"]) => {
    switch (status) {
      case "Đang chờ":
        return {
          icon: <ClockIcon className="w-4 h-4" />,
          color: "bg-amber-500",
          bgColor: "bg-amber-50 dark:bg-amber-900/20",
          borderColor: "border-amber-200 dark:border-amber-800",
        };
      case "Đang sản xuất":
        return {
          icon: <ArrowPathIcon className="w-4 h-4 animate-spin" />,
          color: "bg-blue-500",
          bgColor: "bg-blue-50 dark:bg-blue-900/20",
          borderColor: "border-blue-200 dark:border-blue-800",
        };
      case "Hoàn thành":
        return {
          icon: <CheckCircleIcon className="w-4 h-4" />,
          color: "bg-green-500",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-800",
        };
      default:
        return {
          icon: <ExclamationTriangleIcon className="w-4 h-4" />,
          color: "bg-gray-500",
          bgColor: "bg-gray-50 dark:bg-gray-900/20",
          borderColor: "border-gray-200 dark:border-gray-800",
        };
    }
  };

  const statusInfo = getStatusInfo(order.status);

  const handleQuickMove = (newStatus: ProductionOrder["status"]) => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để thực hiện thao tác.");
      return;
    }
    onMove(order.id, newStatus);
  };

  return (
    <div
      className={`
        bg-white dark:bg-slate-800 rounded-lg shadow-sm border-2 
        ${statusInfo.borderColor} ${statusInfo.bgColor}
        p-4 cursor-pointer transition-all duration-200 hover:shadow-md
        ${isDragging ? "opacity-50 rotate-2 scale-105" : ""}
      `}
      onClick={() => onViewDetails(order)}
    >
      {/* Header with Status */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div
            className={`w-8 h-8 ${statusInfo.color} rounded-full flex items-center justify-center text-white`}
          >
            {statusInfo.icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
              #{order.id}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {order.status}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Số lượng</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">
            {order.quantityProduced}
          </p>
        </div>
      </div>

      {/* Product Name */}
      <div className="mb-3">
        <h4 className="font-medium text-slate-800 dark:text-slate-100 line-clamp-2">
          {order.productName}
        </h4>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
        <div className="flex items-center space-x-2">
          <CalendarIcon className="w-3 h-3" />
          <span>{formatDate(order.creationDate)}</span>
        </div>
        {order.userName && (
          <div className="flex items-center space-x-2">
            <UserIcon className="w-3 h-3" />
            <span>{order.userName}</span>
          </div>
        )}
        <div className="flex items-center space-x-2">
          <CurrencyDollarIcon className="w-3 h-3" />
          <span className="font-medium">{formatCurrency(order.totalCost)}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
        <div className="flex space-x-1">
          {order.status === "Đang chờ" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickMove("Đang sản xuất");
              }}
              className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs py-1 px-2 rounded transition-colors"
            >
              Bắt đầu
            </button>
          )}
          {order.status === "Đang sản xuất" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (!isCompleting) {
                  handleQuickMove("Hoàn thành");
                }
              }}
              className={`flex-1 text-white text-xs py-1 px-2 rounded transition-colors ${
                isCompleting
                  ? "bg-green-300 cursor-not-allowed"
                  : "bg-green-500 hover:bg-green-600"
              }`}
              disabled={isCompleting}
            >
              {isCompleting ? "Đang lưu..." : "Hoàn thành"}
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onViewDetails(order);
            }}
            className="flex-1 bg-slate-500 hover:bg-slate-600 text-white text-xs py-1 px-2 rounded transition-colors"
          >
            Chi tiết
          </button>
        </div>
      </div>
    </div>
  );
};

interface KanbanColumnProps {
  title: string;
  status: ProductionOrder["status"];
  orders: ProductionOrder[];
  onMove: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  onViewDetails: (order: ProductionOrder) => void;
  currentUser?: User | null;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  completingOrderId?: string | null;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  title,
  status,
  orders,
  onMove,
  onViewDetails,
  currentUser,
  icon,
  bgColor,
  textColor,
  completingOrderId,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const orderId = e.dataTransfer.getData("text/plain");
      if (orderId && currentUser) {
        onMove(orderId, status);
      }
    },
    [onMove, status, currentUser]
  );

  const totalCost = useMemo(
    () => orders.reduce((sum, order) => sum + order.totalCost, 0),
    [orders]
  );

  return (
    <div className="flex-1 min-w-80">
      {/* Column Header */}
      <div className={`${bgColor} ${textColor} rounded-lg p-4 mb-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {icon}
            <h2 className="font-semibold">{title}</h2>
            <span className="bg-white/20 text-sm px-2 py-1 rounded-full">
              {orders.length}
            </span>
          </div>
          <div className="text-right text-sm opacity-90">
            <p>Tổng giá trị</p>
            <p className="font-semibold">{formatCurrency(totalCost)}</p>
          </div>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        className={`
          min-h-96 space-y-3 p-2 rounded-lg border-2 border-dashed transition-colors
          ${
            isDragOver
              ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
              : "border-slate-200 dark:border-slate-700"
          }
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {orders.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500">
            <div className="text-center">
              <ClipboardDocumentCheckIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Không có lệnh sản xuất</p>
            </div>
          </div>
        ) : (
          orders.map((order) => (
            <div
              key={order.id}
              draggable={currentUser ? true : false}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", order.id);
              }}
            >
              <ProductionOrderCard
                order={order}
                onMove={onMove}
                onViewDetails={onViewDetails}
                currentUser={currentUser}
                isCompleting={completingOrderId === order.id}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};

interface ProductionDashboardProps {
  orders: ProductionOrder[];
  updateOrder: (orderId: string, newStatus: ProductionOrder["status"]) => void;
  currentUser?: User | null;
  materials?: PinMaterial[];
  boms?: PinBOM[];
  onCreateOrder?: () => void;
  onManageBOMs?: () => void;
  completeOrder?: (orderId: string) => Promise<void>;
}

const ProductionDashboard: React.FC<ProductionDashboardProps> = ({
  orders = [],
  updateOrder,
  currentUser,
  materials = [],
  boms = [],
  onCreateOrder,
  onManageBOMs,
  completeOrder,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(
    null
  );

  // Filter orders based on search
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;
    const term = searchTerm.toLowerCase();
    return orders.filter(
      (order) =>
        order.productName.toLowerCase().includes(term) ||
        order.id.toLowerCase().includes(term) ||
        order.userName?.toLowerCase().includes(term)
    );
  }, [orders, searchTerm]);

  // Group orders by status
  const ordersByStatus = useMemo(() => {
    const grouped = {
      "Đang chờ": [] as ProductionOrder[],
      "Đang sản xuất": [] as ProductionOrder[],
      "Hoàn thành": [] as ProductionOrder[],
    };

    filteredOrders.forEach((order) => {
      if (order.status === "Đã hủy") return;
      const key = (
        order.status === "Đã nhập kho" ? "Hoàn thành" : order.status
      ) as keyof typeof grouped;
      if (grouped[key]) grouped[key].push(order);
    });

    // Sort by creation date (newest first)
    Object.keys(grouped).forEach((status) => {
      grouped[status as keyof typeof grouped].sort(
        (a, b) =>
          new Date(b.creationDate).getTime() -
          new Date(a.creationDate).getTime()
      );
    });

    return grouped;
  }, [filteredOrders]);

  const handleViewDetails = useCallback((order: ProductionOrder) => {
    setSelectedOrder(order);
  }, []);

  const closeDetails = useCallback(() => {
    setSelectedOrder(null);
  }, []);

  const getBomDetails = useCallback(
    (order: ProductionOrder) => {
      const bom = boms.find((b) => b.id === order.bomId);
      return bom;
    },
    [boms]
  );

  // Intercept moves to "Hoàn thành" to run completion flow with stock deduction
  const handleMove = useCallback(
    async (orderId: string, newStatus: ProductionOrder["status"]) => {
      if (newStatus === "Hoàn thành" && completeOrder) {
        try {
          setCompletingOrderId(orderId);
          await completeOrder(orderId);
        } catch (e) {
          // Errors are handled upstream; keep UI responsive
          console.error("Error completing order via Kanban:", e);
        } finally {
          setCompletingOrderId(null);
        }
      } else {
        // For other transitions, keep the lightweight status update
        updateOrder(orderId, newStatus);
      }
    },
    [completeOrder, updateOrder]
  );

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              📊 Production Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1">
              Quản lý trực quan quy trình sản xuất với Kanban Board
            </p>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
            <input
              type="text"
              placeholder="Tìm kiếm lệnh sản xuất..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />

            <button
              onClick={onCreateOrder}
              disabled={!currentUser}
              className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
              title={
                !currentUser
                  ? "Vui lòng đăng nhập để tạo lệnh sản xuất"
                  : "Tạo lệnh sản xuất mới"
              }
            >
              <PlusIcon className="w-5 h-5" />
              <span>Tạo lệnh sản xuất</span>
            </button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <ClockIcon className="w-8 h-8 text-amber-600" />
              <div>
                <p className="text-2xl font-bold text-amber-800 dark:text-amber-300">
                  {ordersByStatus["Đang chờ"].length}
                </p>
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Đang chờ
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <ArrowPathIcon className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">
                  {ordersByStatus["Đang sản xuất"].length}
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Đang sản xuất
                </p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <CheckCircleIcon className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {ordersByStatus["Hoàn thành"].length}
                </p>
                <p className="text-sm text-green-600 dark:text-green-400">
                  Hoàn thành
                </p>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
            <div className="flex items-center space-x-3">
              <CurrencyDollarIcon className="w-8 h-8 text-slate-600" />
              <div>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">
                  {formatCurrency(
                    Object.values(ordersByStatus)
                      .flat()
                      .reduce((sum, order) => sum + order.totalCost, 0)
                  )}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Tổng giá trị
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex space-x-6 overflow-x-auto pb-4">
          <KanbanColumn
            title="Đang chờ"
            status="Đang chờ"
            orders={ordersByStatus["Đang chờ"]}
            onMove={handleMove}
            onViewDetails={handleViewDetails}
            currentUser={currentUser}
            icon={<ClockIcon className="w-5 h-5" />}
            bgColor="bg-amber-500"
            textColor="text-white"
            completingOrderId={completingOrderId}
          />

          <KanbanColumn
            title="Đang sản xuất"
            status="Đang sản xuất"
            orders={ordersByStatus["Đang sản xuất"]}
            onMove={handleMove}
            onViewDetails={handleViewDetails}
            currentUser={currentUser}
            icon={<ArrowPathIcon className="w-5 h-5" />}
            bgColor="bg-blue-500"
            textColor="text-white"
            completingOrderId={completingOrderId}
          />

          <KanbanColumn
            title="Hoàn thành"
            status="Hoàn thành"
            orders={ordersByStatus["Hoàn thành"]}
            onMove={handleMove}
            onViewDetails={handleViewDetails}
            currentUser={currentUser}
            icon={<CheckCircleIcon className="w-5 h-5" />}
            bgColor="bg-green-500"
            textColor="text-white"
            completingOrderId={completingOrderId}
          />
        </div>
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Chi tiết Lệnh sản xuất #{selectedOrder.id}
              </h3>
              <button
                onClick={closeDetails}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <span className="sr-only">Đóng</span>✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Thành phẩm
                  </label>
                  <p className="text-slate-900 dark:text-slate-100 font-semibold">
                    {selectedOrder.productName}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Số lượng
                  </label>
                  <p className="text-slate-900 dark:text-slate-100 font-semibold">
                    {selectedOrder.quantityProduced}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Ngày tạo
                  </label>
                  <p className="text-slate-900 dark:text-slate-100">
                    {formatDate(selectedOrder.creationDate)}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Trạng thái
                  </label>
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                      selectedOrder.status === "Hoàn thành"
                        ? "bg-green-100 text-green-800"
                        : selectedOrder.status === "Đang sản xuất"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              {/* BOM Details */}
              {(() => {
                const bom = getBomDetails(selectedOrder);
                return bom ? (
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                      Chi tiết nguyên vật liệu (BOM)
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="space-y-2">
                        {bom.materials.map((bomMat) => {
                          const material = materials.find(
                            (m) => m.id === bomMat.materialId
                          );
                          const required =
                            bomMat.quantity * selectedOrder.quantityProduced;
                          const cost =
                            required * (material?.purchasePrice || 0);

                          return (
                            <div
                              key={bomMat.materialId}
                              className="flex justify-between items-center"
                            >
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-100">
                                  {material?.name || "N/A"}
                                </p>
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                  {required} {material?.unit || "đơn vị"}
                                </p>
                              </div>
                              <p className="font-semibold text-slate-800 dark:text-slate-100">
                                {formatCurrency(cost)}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Additional Costs */}
              {selectedOrder.additionalCosts &&
                selectedOrder.additionalCosts.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                      Chi phí phát sinh
                    </h4>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                      <div className="space-y-2">
                        {selectedOrder.additionalCosts.map((cost, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center"
                          >
                            <p className="text-slate-800 dark:text-slate-100">
                              {cost.description}
                            </p>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">
                              {formatCurrency(cost.amount)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    Ghi chú
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-800 dark:text-slate-100">
                      {selectedOrder.notes}
                    </p>
                  </div>
                </div>
              )}

              {/* Total Cost */}
              <div className="border-t dark:border-slate-700 pt-4">
                <div className="flex justify-between items-center">
                  <h4 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Tổng giá vốn
                  </h4>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedOrder.totalCost)}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t dark:border-slate-700 flex justify-end">
              <button
                onClick={closeDetails}
                className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
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

export default ProductionDashboard;
