import React, { useState, useMemo } from "react";
import type { PinSale, ProductionOrder } from "../types";
import { Card, CardGrid, CardTitle, CardBody, StatsCard } from "./ui/Card";
import { Badge } from "./ui/Badge";
import { DataTable, Column } from "./ui/Table";
import { Icon } from "./common/Icon";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

interface PinReportManagerProps {
  sales: PinSale[];
  orders?: ProductionOrder[];
}

const PinReportManager: React.FC<PinReportManagerProps> = ({
  sales,
  orders = [],
}) => {
  const today = new Date();
  const lastMonth = new Date(today);
  lastMonth.setMonth(today.getMonth() - 1);

  const [startDate, setStartDate] = useState(
    lastMonth.toISOString().split("T")[0]
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [selectedTab, setSelectedTab] = useState<"sales" | "production">(
    "sales"
  );

  const reportData = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);

    const filteredSales = sales.filter((s) => {
      const saleDate = new Date(s.date);
      return saleDate >= start && saleDate <= end;
    });

    const filteredOrders = orders.filter((o) => {
      const od = new Date(o.creationDate);
      return od >= start && od <= end && o.status !== "Đã hủy";
    });

    const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total, 0);
    const totalCost = filteredSales.reduce(
      (sum, s) =>
        sum +
        s.items.reduce((itemSum, i) => itemSum + i.costPrice * i.quantity, 0),
      0
    );
    const totalProfit = totalRevenue - totalCost;

    const productStats = new Map<
      string,
      { sold: number; revenue: number; profit: number }
    >();

    filteredSales.forEach((sale) => {
      sale.items.forEach((item) => {
        const existing = productStats.get(item.productName) || {
          sold: 0,
          revenue: 0,
          profit: 0,
        };
        productStats.set(item.productName, {
          sold: existing.sold + item.quantity,
          revenue: existing.revenue + item.price * item.quantity,
          profit:
            existing.profit + (item.price - item.costPrice) * item.quantity,
        });
      });
    });

    const topProducts = Array.from(productStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // Production stats
    const productionStats = {
      total: filteredOrders.length,
      completed: filteredOrders.filter((o) => o.status === "Hoàn thành").length,
      inProgress: filteredOrders.filter((o) => o.status === "Đang sản xuất")
        .length,
      pending: filteredOrders.filter((o) => o.status === "Chờ sản xuất").length,
    };

    return {
      filteredSales,
      filteredOrders,
      totalRevenue,
      totalCost,
      totalProfit,
      topProducts,
      productionStats,
    };
  }, [sales, orders, startDate, endDate]);

  const salesColumns: Column<PinSale>[] = [
    {
      key: "date",
      label: "Ngày",
      sortable: true,
      render: (sale) => new Date(sale.date).toLocaleDateString("vi-VN"),
    },
    {
      key: "customer",
      label: "Khách hàng",
      render: (sale) => (
        <div>
          <div className="font-medium">{sale.customer.name}</div>
          {sale.customer.phone && (
            <div className="text-xs text-pin-gray-500 dark:text-pin-dark-500">
              {sale.customer.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "items",
      label: "Sản phẩm",
      render: (sale) => (
        <div className="text-sm">
          {sale.items.length} sản phẩm (
          {sale.items.reduce((sum, i) => sum + i.quantity, 0)} SP)
        </div>
      ),
    },
    {
      key: "total",
      label: "Tổng tiền",
      align: "right",
      sortable: true,
      render: (sale) => (
        <span className="font-bold text-pin-blue-600 dark:text-pin-blue-400">
          {formatCurrency(sale.total)}
        </span>
      ),
    },
    {
      key: "paymentMethod",
      label: "Thanh toán",
      render: (sale) => (
        <Badge variant="success" size="sm">
          {sale.paymentMethod}
        </Badge>
      ),
    },
  ];

  const productColumns: Column<{
    name: string;
    sold: number;
    revenue: number;
    profit: number;
  }>[] = [
    {
      key: "name",
      label: "Sản phẩm",
      sortable: true,
      render: (item) => <div className="font-medium">{item.name}</div>,
    },
    {
      key: "sold",
      label: "Đã bán",
      align: "center",
      sortable: true,
      render: (item) => (
        <Badge variant="primary" size="sm">
          {item.sold}
        </Badge>
      ),
    },
    {
      key: "revenue",
      label: "Doanh thu",
      align: "right",
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-pin-green-600 dark:text-pin-green-400">
          {formatCurrency(item.revenue)}
        </span>
      ),
    },
    {
      key: "profit",
      label: "Lợi nhuận",
      align: "right",
      sortable: true,
      render: (item) => (
        <span className="font-semibold text-pin-blue-600 dark:text-pin-blue-400">
          {formatCurrency(item.profit)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-pin-gray-900 dark:text-pin-dark-900">
            Báo cáo & Thống kê
          </h1>
          <p className="text-pin-gray-500 dark:text-pin-dark-500 mt-1">
            Phân tích doanh thu và hiệu quả kinh doanh
          </p>
        </div>

        {/* Date Filter */}
        <Card padding="sm" className="flex items-center gap-3 w-full sm:w-auto">
          <Icon name="calendar" size="md" tone="muted" />
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-pin-gray-200 dark:border-pin-dark-400 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-pin-blue-500"
          />
          <span className="text-pin-gray-400">đến</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-pin-gray-200 dark:border-pin-dark-400 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-pin-blue-500"
          />
        </Card>
      </div>

      {/* Stats Cards */}
      <CardGrid cols={4}>
        <StatsCard
          title="Tổng doanh thu"
          value={formatCurrency(reportData.totalRevenue)}
          iconName="money"
          variant="primary"
        />
        <StatsCard
          title="Lợi nhuận"
          value={formatCurrency(reportData.totalProfit)}
          iconName="progressUp"
          variant="success"
        />
        <StatsCard
          title="Đơn hàng"
          value={reportData.filteredSales.length}
          iconName="sales"
          variant="warning"
        />
        <StatsCard
          title="Sản xuất"
          value={reportData.productionStats.total}
          iconName="stock"
          variant="info"
        />
      </CardGrid>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-pin-gray-200 dark:border-pin-dark-300">
        <button
          onClick={() => setSelectedTab("sales")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            selectedTab === "sales"
              ? "border-pin-blue-500 text-pin-blue-600 dark:text-pin-blue-400"
              : "border-transparent text-pin-gray-600 dark:text-pin-dark-600 hover:text-pin-gray-900 dark:hover:text-pin-dark-900"
          }`}
        >
          <Icon
            name="sales"
            size="sm"
            tone={selectedTab === "sales" ? "primary" : "muted"}
            className="inline mr-2"
          />
          Bán hàng ({reportData.filteredSales.length})
        </button>
        <button
          onClick={() => setSelectedTab("production")}
          className={`px-4 py-2 font-medium text-sm transition-colors border-b-2 ${
            selectedTab === "production"
              ? "border-pin-blue-500 text-pin-blue-600 dark:text-pin-blue-400"
              : "border-transparent text-pin-gray-600 dark:text-pin-dark-600 hover:text-pin-gray-900 dark:hover:text-pin-dark-900"
          }`}
        >
          <Icon
            name="stock"
            size="sm"
            tone={selectedTab === "production" ? "primary" : "muted"}
            className="inline mr-2"
          />
          Sản xuất ({reportData.productionStats.total})
        </button>
      </div>

      {/* Tab Content */}
      {selectedTab === "sales" && (
        <div className="space-y-6">
          {/* Sales Table */}
          <Card padding="none">
            <div className="p-6 border-b border-pin-gray-200 dark:border-pin-dark-300">
              <CardTitle icon={<Icon name="ratios" size="md" tone="primary" />}>
                Chi tiết đơn hàng
              </CardTitle>
            </div>
            <div className="p-6">
              <DataTable
                columns={salesColumns}
                data={reportData.filteredSales}
                keyExtractor={(sale) => sale.id}
                emptyMessage="Không có đơn hàng trong khoảng thời gian này"
              />
            </div>
          </Card>

          {/* Top Products */}
          <Card>
            <CardTitle
              icon={<Icon name="progressUp" size="md" tone="primary" />}
              subtitle="Sản phẩm bán chạy nhất"
            >
              Top sản phẩm
            </CardTitle>
            <CardBody className="mt-6">
              <DataTable
                columns={productColumns}
                data={reportData.topProducts}
                keyExtractor={(item) => item.name}
                emptyMessage="Chưa có dữ liệu sản phẩm"
              />
            </CardBody>
          </Card>
        </div>
      )}

      {selectedTab === "production" && (
        <Card>
          <CardTitle
            icon={<Icon name="stock" size="md" tone="primary" />}
            subtitle="Thống kê sản xuất"
          >
            Tình trạng sản xuất
          </CardTitle>
          <CardBody className="mt-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-pin-blue-50 dark:bg-pin-blue-900/20">
                <div className="text-2xl font-bold text-pin-blue-600 dark:text-pin-blue-400">
                  {reportData.productionStats.total}
                </div>
                <div className="text-sm text-pin-gray-600 dark:text-pin-dark-600 mt-1">
                  Tổng đơn
                </div>
              </div>
              <div className="p-4 rounded-lg bg-pin-green-50 dark:bg-pin-green-900/20">
                <div className="text-2xl font-bold text-pin-green-600 dark:text-pin-green-400">
                  {reportData.productionStats.completed}
                </div>
                <div className="text-sm text-pin-gray-600 dark:text-pin-dark-600 mt-1">
                  Hoàn thành
                </div>
              </div>
              <div className="p-4 rounded-lg bg-pin-yellow-50 dark:bg-pin-yellow-900/20">
                <div className="text-2xl font-bold text-pin-yellow-600 dark:text-pin-yellow-400">
                  {reportData.productionStats.inProgress}
                </div>
                <div className="text-sm text-pin-gray-600 dark:text-pin-dark-600 mt-1">
                  Đang sản xuất
                </div>
              </div>
              <div className="p-4 rounded-lg bg-pin-gray-100 dark:bg-pin-dark-300">
                <div className="text-2xl font-bold text-pin-gray-600 dark:text-pin-dark-600">
                  {reportData.productionStats.pending}
                </div>
                <div className="text-sm text-pin-gray-600 dark:text-pin-dark-600 mt-1">
                  Chờ sản xuất
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};

export default PinReportManager;
