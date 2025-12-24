import React, { useState, useMemo } from "react";
import { usePinContext } from "../contexts/PinContext";
import { DeliveryBadge, type DeliveryStatus, getNextDeliveryStatuses } from "./DeliveryBadge";
import { Card } from "./ui/Card";
import { DataTable } from "./ui/Table";
import { Button } from "./ui/Button";
import { Icon } from "./common/Icon";
import type { PinSale } from "../types";

export default function DeliveryOrdersView() {
    const { pinSales, currentUser } = usePinContext();
    const [activeTab, setActiveTab] = useState<DeliveryStatus | "all">("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Filter sales that have delivery method = 'delivery'
    const deliveryOrders = useMemo(() => {
        return (pinSales || []).filter((sale) => sale.delivery_method === "delivery");
    }, [pinSales]);

    // Filter by status tab
    const filteredOrders = useMemo(() => {
        let filtered = deliveryOrders;

        if (activeTab !== "all") {
            filtered = filtered.filter((sale) => sale.delivery_status === activeTab);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (sale) =>
                    sale.code?.toLowerCase().includes(query) ||
                    sale.customer.name.toLowerCase().includes(query) ||
                    sale.customer.phone?.toLowerCase().includes(query) ||
                    sale.delivery_address?.toLowerCase().includes(query)
            );
        }

        return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [deliveryOrders, activeTab, searchQuery]);

    // Calculate stats
    const stats = useMemo(() => {
        const pending = deliveryOrders.filter((s) => s.delivery_status === "pending").length;
        const preparing = deliveryOrders.filter((s) => s.delivery_status === "preparing").length;
        const shipping = deliveryOrders.filter((s) => s.delivery_status === "shipping").length;
        const delivered = deliveryOrders.filter((s) => s.delivery_status === "delivered").length;
        const totalCOD = deliveryOrders
            .filter((s) => s.delivery_status !== "delivered" && s.delivery_status !== "cancelled")
            .reduce((sum, s) => sum + (s.cod_amount || 0), 0);

        return { pending, preparing, shipping, delivered, totalCOD };
    }, [deliveryOrders]);

    const handleUpdateStatus = async (saleId: string, newStatus: DeliveryStatus) => {
        // TODO: Implement status update logic
        console.log("Update status:", saleId, newStatus);
        alert(`Chức năng cập nhật trạng thái đang được phát triển.\nĐơn: ${saleId}\nTrạng thái mới: ${newStatus}`);
    };

    const columns = [
        {
            key: "code" as const,
            label: "Mã đơn",
            sortable: true,
            render: (sale: PinSale) => (
                <div className="space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {sale.code || sale.id.slice(0, 8)}
                    </div>
                    <div className="text-xs text-slate-500">
                        {new Date(sale.date).toLocaleDateString("vi-VN")}
                    </div>
                </div>
            ),
        },
        {
            key: "customer" as const,
            label: "Khách hàng",
            render: (sale: PinSale) => (
                <div className="space-y-1">
                    <div className="font-medium text-slate-800 dark:text-slate-100">
                        {sale.customer.name}
                    </div>
                    {sale.customer.phone && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            <Icon name="phone" className="w-3 h-3 inline mr-1" />
                            {sale.customer.phone}
                        </div>
                    )}
                    {sale.delivery_address && (
                        <div className="text-xs text-slate-500 max-w-xs truncate">
                            <Icon name="info" className="w-3 h-3 inline mr-1" />
                            {sale.delivery_address}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: "amount" as const,
            label: "Số tiền",
            align: "right" as const,
            render: (sale: PinSale) => (
                <div className="text-right space-y-1">
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                        {(sale.total + (sale.shipping_fee || 0)).toLocaleString("vi-VN")}đ
                    </div>
                    {sale.shipping_fee && sale.shipping_fee > 0 && (
                        <div className="text-xs text-slate-500">
                            Phí ship: {sale.shipping_fee.toLocaleString("vi-VN")}đ
                        </div>
                    )}
                    <div className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        COD: {(sale.cod_amount || 0).toLocaleString("vi-VN")}đ
                    </div>
                </div>
            ),
        },
        {
            key: "status" as const,
            label: "Trạng thái",
            render: (sale: PinSale) => (
                <div className="space-y-2">
                    <DeliveryBadge status={sale.delivery_status || "pending"} />
                    {sale.shipper_name && (
                        <div className="text-xs text-slate-600 dark:text-slate-400">
                            <Icon name="technician" className="w-3 h-3 inline mr-1" />
                            {sale.shipper_name}
                        </div>
                    )}
                </div>
            ),
        },
        {
            key: "actions" as const,
            label: "",
            width: "120px",
            render: (sale: PinSale) => {
                const currentStatus = sale.delivery_status || "pending";
                const nextStatuses = getNextDeliveryStatuses(currentStatus);

                if (nextStatuses.length === 0) {
                    return null;
                }

                return (
                    <div className="flex gap-1">
                        {nextStatuses.map((status) => (
                            <Button
                                key={status}
                                size="sm"
                                variant={status === "cancelled" ? "danger" : "primary"}
                                onClick={() => handleUpdateStatus(sale.id, status)}
                            >
                                {status === "preparing" && "Chuẩn bị"}
                                {status === "shipping" && "Giao hàng"}
                                {status === "delivered" && "Hoàn thành"}
                                {status === "cancelled" && "Hủy"}
                            </Button>
                        ))}
                    </div>
                );
            },
        },
    ];

    return (
        <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                        Quản lý Đơn Giao Hàng
                    </h1>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                        Theo dõi và quản lý các đơn hàng ship COD
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <Card className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Chờ lấy hàng</div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                </Card>
                <Card className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Đang chuẩn bị</div>
                    <div className="text-2xl font-bold text-blue-600">{stats.preparing}</div>
                </Card>
                <Card className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Đang giao</div>
                    <div className="text-2xl font-bold text-purple-600">{stats.shipping}</div>
                </Card>
                <Card className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">Đã giao</div>
                    <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
                </Card>
                <Card className="p-3">
                    <div className="text-xs text-slate-600 dark:text-slate-400">COD chờ thu</div>
                    <div className="text-lg font-bold text-orange-600">
                        {stats.totalCOD.toLocaleString("vi-VN")}đ
                    </div>
                </Card>
            </div>

            {/* Tabs and Search */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-3 mb-4">
                    {/* Tabs */}
                    <div className="flex gap-2 overflow-x-auto">
                        <button
                            onClick={() => setActiveTab("all")}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${activeTab === "all"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                        >
                            Tất cả ({deliveryOrders.length})
                        </button>
                        <button
                            onClick={() => setActiveTab("pending")}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${activeTab === "pending"
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                        >
                            Chờ lấy ({stats.pending})
                        </button>
                        <button
                            onClick={() => setActiveTab("preparing")}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${activeTab === "preparing"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                        >
                            Chuẩn bị ({stats.preparing})
                        </button>
                        <button
                            onClick={() => setActiveTab("shipping")}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${activeTab === "shipping"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                        >
                            Đang giao ({stats.shipping})
                        </button>
                        <button
                            onClick={() => setActiveTab("delivered")}
                            className={`px-3 py-1.5 text-sm font-medium rounded transition-colors whitespace-nowrap ${activeTab === "delivered"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "text-slate-600 hover:text-slate-900 dark:text-slate-400"
                                }`}
                        >
                            Đã giao ({stats.delivered})
                        </button>
                    </div>

                    {/* Search */}
                    <div className="flex-1 relative">
                        <Icon
                            name="search"
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Tìm theo mã đơn, khách hàng, SĐT..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <DataTable
                    data={filteredOrders}
                    columns={columns}
                    keyExtractor={(sale) => sale.id}
                    emptyMessage="Không có đơn giao hàng nào"
                />
            </Card>
        </div>
    );
}
