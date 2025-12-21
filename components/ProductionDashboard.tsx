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
  PencilSquareIcon,
  PlusIcon,
  TrashIcon,
  UserIcon,
} from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

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
  productSku?: string;
}

const ProductionOrderCard: React.FC<ProductionOrderCardProps> = ({
  order,
  onMove,
  onViewDetails,
  currentUser,
  isDragging = false,
  isCompleting = false,
  productSku,
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

  // Helper to format user name (e.g. "lam.tcag@gmail.com" -> "Lam.tcag")
  const formatUserName = (name: string | undefined) => {
    if (!name) return "";
    if (name.includes("@")) {
      const [localPart] = name.split("@");
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }
    return name;
  };

  return (
    <div
      className={`
        bg-white dark:bg-slate-800 rounded-2xl shadow-lg border-2 
        ${statusInfo.borderColor} ${statusInfo.bgColor}
        p-5 cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-1
        ${isDragging ? "opacity-50 rotate-2 scale-105 shadow-2xl" : ""}
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
            <h3 className="font-bold text-slate-800 dark:text-slate-100 text-sm">
              {productSku ? (
                <span className="text-blue-600 dark:text-blue-400 font-mono tracking-tight">
                  {productSku}
                </span>
              ) : (
                <span className="text-slate-500 font-mono text-xs">#{order.id.slice(0, 8)}</span>
              )}
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              {productSku ? `ID: #${order.id.slice(0, 8)}` : order.status}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500 dark:text-slate-400">Số lượng</p>
          <p className="font-bold text-slate-800 dark:text-slate-100">{order.quantityProduced}</p>
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
            <span>{formatUserName(order.userName)}</span>
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
              className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-md shadow-blue-500/30 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5"
            >
              Bắt đầu
            </button>
          )}
          {order.status === "Đang sản xuất" && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickMove("Hoàn thành");
              }}
              disabled={!currentUser || isCompleting}
              className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-xs font-semibold py-2 px-3 rounded-lg shadow-md shadow-green-500/30 hover:shadow-lg transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompleting ? "Đang hoàn thành..." : "Hoàn thành"}
            </button>
          )}
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
  completingOrderId: string | null;
  boms?: PinBOM[];
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
  boms = [],
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const orderId = e.dataTransfer.getData("orderId");
    if (orderId) {
      onMove(orderId, status);
    }
  };

  return (
    <div className="flex-1 min-w-80">
      <div className={`${bgColor} ${textColor} rounded-t-lg p-3 flex items-center space-x-2`}>
        {icon}
        <h3 className="font-bold text-lg">{title}</h3>
        <span className="bg-white/20 px-2 py-1 rounded-full text-sm font-semibold">
          {orders.length}
        </span>
      </div>
      <div
        className={`
          min-h-96 space-y-3 p-2 rounded-b-lg border-2 border-dashed transition-colors
          ${isDragOver
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
            <p className="text-sm">Không có đơn hàng</p>
          </div>
        ) : (
          orders.map((order) => {
            const bom = boms.find((b) => b.id === order.bomId);
            return (
              <div
                key={order.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("orderId", order.id);
                }}
              >
                <ProductionOrderCard
                  order={order}
                  onMove={onMove}
                  onViewDetails={onViewDetails}
                  currentUser={currentUser}
                  isCompleting={completingOrderId === order.id}
                  productSku={bom?.productSku}
                />
              </div>
            );
          })
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
  onCreateOrderFromBOM?: (bomId: string) => void;
  onEditBOM?: (bomId: string) => void;
  onDeleteBOM?: (bomId: string) => void;
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
  onCreateOrderFromBOM,
  onEditBOM,
  onDeleteBOM,
  completeOrder,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<ProductionOrder | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [completingOrderId, setCompletingOrderId] = useState<string | null>(null);

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
        (a, b) => new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
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
      <div className="space-y-2 p-1">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center space-y-2 lg:space-y-0 animate-fadeIn">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              📊 Production Dashboard
            </h1>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Quản lý trực quan quy trình sản xuất với Kanban Board
            </p>
          </div>

          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
            <input
              type="text"
              placeholder="🔍 Tìm kiếm lệnh sản xuất..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            />
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 animate-fadeIn">
          {/* In Progress Orders */}
          <div className="relative bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 p-3 rounded-xl border border-blue-200 dark:border-blue-800 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium uppercase tracking-wide">
                  Đang sản xuất
                </p>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {ordersByStatus["Đang sản xuất"].length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center shadow-md">
                <BeakerIcon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Completed Orders */}
          <div className="relative bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-3 rounded-xl border border-green-200 dark:border-green-800 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-green-700 dark:text-green-300 font-medium uppercase tracking-wide">
                  Hoàn thành
                </p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {ordersByStatus["Hoàn thành"].length}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl flex items-center justify-center shadow-md">
                <CheckCircleIcon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>

          {/* Total Value */}
          <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-3 rounded-xl border border-purple-200 dark:border-purple-800 shadow-md">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium uppercase tracking-wide">
                  Tổng giá trị
                </p>
                <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {formatCurrency(
                    Object.values(ordersByStatus)
                      .flat()
                      .reduce((sum, order) => sum + order.totalCost, 0)
                  )}
                </p>
              </div>
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-md">
                <CurrencyDollarIcon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Layout: BOM List (Left) + Kanban Board (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left Side: BOM Management */}
          <div className="lg:col-span-3 space-y-3">
            <div className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-200 dark:border-slate-700 shadow-lg">
              {/* BOM Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <BeakerIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  <h3 className="font-bold text-slate-900 dark:text-white">
                    Quản lý Công thức Sản xuất (BOM)
                  </h3>
                </div>
              </div>

              {/* BOM List */}
              <div className="p-3">
                <div className="mb-3">
                  <input
                    type="text"
                    placeholder="Tìm kiếm BOM..."
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                  />
                </div>

                <div className="space-y-2 max-h-[600px] overflow-y-auto">
                  {/* Danh sách BOM (1) - Hiển thị item đầu tiên */}
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                    Danh sách BOM ({boms.length})
                  </div>

                  {boms.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                      <BeakerIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Chưa có BOM</p>
                    </div>
                  ) : (
                    boms.map((bom) => {
                      const totalCost = bom.materials.reduce((sum, mat) => {
                        const material = materials.find((m) => m.id === mat.materialId);
                        return sum + (material?.purchasePrice || 0) * mat.quantity;
                      }, 0);

                      return (
                        <div
                          key={bom.id}
                          className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg p-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div
                              className="flex-1 min-w-0 cursor-pointer"
                              onClick={() => onCreateOrderFromBOM?.(bom.id)}
                            >
                              <h4 className="font-semibold text-slate-900 dark:text-white text-sm truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                {bom.productName}
                              </h4>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {bom.materials.length} nguyên liệu
                              </p>
                            </div>
                            <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditBOM?.(bom.id);
                                }}
                                className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                                title="Chỉnh sửa BOM"
                              >
                                <PencilSquareIcon className="w-4 h-4" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm(`Bạn có chắc muốn xóa BOM "${bom.productName}"?`)) {
                                    onDeleteBOM?.(bom.id);
                                  }
                                }}
                                className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                title="Xóa BOM"
                              >
                                <TrashIcon className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div
                            className="text-xs text-green-600 dark:text-green-400 font-semibold cursor-pointer"
                            onClick={() => onCreateOrderFromBOM?.(bom.id)}
                          >
                            {formatCurrency(totalCost)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <button
                  onClick={onManageBOMs}
                  disabled={!currentUser}
                  className={`w-full mt-3 flex items-center justify-center gap-2 px-4 py-2.5 font-medium rounded-lg shadow-sm transition-all ${currentUser
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-purple-500/30"
                    : "bg-purple-300 text-white/80 cursor-not-allowed opacity-50"
                    }`}
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Tạo BOM</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Side: Kanban Board */}
          <div className="lg:col-span-9">
            <div className="flex space-x-4 overflow-x-auto pb-4">
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
                boms={boms}
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
                boms={boms}
              />
            </div>
          </div>
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
                    className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${selectedOrder.status === "Hoàn thành"
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
                          const material = materials.find((m) => m.id === bomMat.materialId);
                          const required = bomMat.quantity * selectedOrder.quantityProduced;
                          const cost = required * (material?.purchasePrice || 0);

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
              {selectedOrder.additionalCosts && selectedOrder.additionalCosts.length > 0 && (
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">
                    Chi phí phát sinh
                  </h4>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <div className="space-y-2">
                      {selectedOrder.additionalCosts.map((cost, index) => (
                        <div key={index} className="flex justify-between items-center">
                          <p className="text-slate-800 dark:text-slate-100">{cost.description}</p>
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
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Ghi chú</h4>
                  <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                    <p className="text-slate-800 dark:text-slate-100">{selectedOrder.notes}</p>
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
