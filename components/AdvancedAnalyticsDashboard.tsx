import React, { useState, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createAnalyticsService } from "../lib/services/AnalyticsService";
import type { TimeSeriesData } from "../lib/services/AnalyticsService";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Card, CardGrid, StatsCard } from "./ui/Card";
import { Icon } from "./common/Icon";
import { subMonths, startOfMonth, endOfMonth } from "date-fns";

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const AdvancedAnalyticsDashboard: React.FC = () => {
  const ctx = usePinContext();
  const analyticsService = createAnalyticsService(ctx);

  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "6months">(
    "30days"
  );
  const [loading, setLoading] = useState(false);

  // Calculate date range
  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "7days":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30days":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "6months":
        startDate = subMonths(now, 6);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate, endDate: now };
  };

  // Load analytics data
  const { startDate, endDate } = getDateRange();
  const timeSeriesData = analyticsService.getRevenueTimeSeries(
    startDate,
    endDate,
    timeRange === "6months" ? "month" : "day"
  );
  const topProducts = analyticsService.getTopProducts(10);
  const topCustomers = analyticsService.getTopCustomers(10);
  const categoryBreakdown = analyticsService.getCategoryBreakdown();
  const financialMetrics = analyticsService.getFinancialMetrics();
  const trendDirection = analyticsService.getTrendDirection();
  const predictedRevenue = analyticsService.predictNextMonthRevenue();

  // Year over year comparison
  const currentYear = new Date().getFullYear();
  const yoyComparison = analyticsService.compareYearOverYear(currentYear);

  // Month over month comparison
  const currentMonth = new Date().getMonth() + 1;
  const momComparison = analyticsService.compareMonthOverMonth(
    currentMonth,
    currentYear
  );

  const formatCurrency = (value: number) => {
    return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100">
            📊 Phân tích Nâng cao
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Tổng quan kinh doanh và xu hướng
          </p>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2">
          {[
            { value: "7days", label: "7 ngày" },
            { value: "30days", label: "30 ngày" },
            { value: "6months", label: "6 tháng" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value as any)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                timeRange === option.value
                  ? "bg-blue-500 text-white"
                  : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <CardGrid cols={4}>
        <StatsCard
          title="Tổng doanh thu"
          value={`${formatCurrency(financialMetrics.totalRevenue)} đ`}
          iconName="money"
          variant="primary"
          trend={{
            value: yoyComparison.growth.revenue,
            label: "so với năm trước",
          }}
        />
        <StatsCard
          title="Lợi nhuận gộp"
          value={`${formatCurrency(financialMetrics.grossProfit)} đ`}
          iconName="success"
          variant="success"
          trend={{
            value: financialMetrics.profitMargin,
            label: "biên lợi nhuận",
          }}
        />
        <StatsCard
          title="Đơn hàng"
          value={financialMetrics.totalOrders}
          iconName="orders"
          variant="warning"
          trend={{
            value: momComparison.growth.orders,
            label: "so với tháng trước",
          }}
        />
        <StatsCard
          title="Giá trị TB/đơn"
          value={`${formatCurrency(financialMetrics.averageOrderValue)} đ`}
          iconName="capital"
          variant="info"
        />
      </CardGrid>

      {/* Predictive Analytics */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
            <Icon name="highlight" size="md" tone="primary" />
            Dự báo & Xu hướng
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                Dự báo doanh thu tháng sau
              </div>
              <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {formatCurrency(predictedRevenue)} đ
              </div>
            </div>
            <div
              className={`p-4 rounded-lg border ${
                trendDirection === "up"
                  ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                  : trendDirection === "down"
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
              }`}
            >
              <div
                className={`text-sm mb-1 ${
                  trendDirection === "up"
                    ? "text-green-700 dark:text-green-300"
                    : trendDirection === "down"
                    ? "text-red-700 dark:text-red-300"
                    : "text-yellow-700 dark:text-yellow-300"
                }`}
              >
                Xu hướng hiện tại
              </div>
              <div
                className={`text-2xl font-bold ${
                  trendDirection === "up"
                    ? "text-green-800 dark:text-green-200"
                    : trendDirection === "down"
                    ? "text-red-800 dark:text-red-200"
                    : "text-yellow-800 dark:text-yellow-200"
                }`}
              >
                {trendDirection === "up"
                  ? "📈 Tăng trưởng"
                  : trendDirection === "down"
                  ? "📉 Giảm"
                  : "➡️ Ổn định"}
              </div>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="text-sm text-purple-700 dark:text-purple-300 mb-1">
                Tăng trưởng YoY
              </div>
              <div className="text-2xl font-bold text-purple-800 dark:text-purple-200">
                {formatPercent(yoyComparison.growth.revenue)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Revenue Trend Chart */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Xu hướng Doanh thu & Lợi nhuận
          </h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="date"
                stroke="#64748b"
                style={{ fontSize: "12px" }}
              />
              <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#1e293b",
                  border: "none",
                  borderRadius: "8px",
                  color: "#fff",
                }}
                formatter={(value: number) => formatCurrency(value) + " đ"}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3b82f6"
                strokeWidth={2}
                name="Doanh thu"
                dot={{ fill: "#3b82f6" }}
              />
              <Line
                type="monotone"
                dataKey="profit"
                stroke="#10b981"
                strokeWidth={2}
                name="Lợi nhuận"
                dot={{ fill: "#10b981" }}
              />
              <Line
                type="monotone"
                dataKey="cost"
                stroke="#f59e0b"
                strokeWidth={2}
                name="Chi phí"
                dot={{ fill: "#f59e0b" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Products */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Top 10 Sản phẩm Bán chạy
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  stroke="#64748b"
                  style={{ fontSize: "11px" }}
                />
                <YAxis stroke="#64748b" style={{ fontSize: "12px" }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#1e293b",
                    border: "none",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value: number) => formatCurrency(value) + " đ"}
                />
                <Bar dataKey="totalRevenue" fill="#3b82f6" name="Doanh thu" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Phân bố theo Danh mục
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryBreakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) =>
                    `${entry.category}: ${entry.percentage.toFixed(1)}%`
                  }
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="revenue"
                >
                  {categoryBreakdown.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value) + " đ"}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Top Customers */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
            Top 10 Khách hàng Tiềm năng
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    #
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Khách hàng
                  </th>
                  <th className="text-left p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    SĐT
                  </th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Tổng chi tiêu
                  </th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Số đơn
                  </th>
                  <th className="text-right p-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Trung bình/đơn
                  </th>
                </tr>
              </thead>
              <tbody>
                {topCustomers.map((customer, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                      {index + 1}
                    </td>
                    <td className="p-3 text-sm font-medium text-slate-800 dark:text-slate-200">
                      {customer.name}
                    </td>
                    <td className="p-3 text-sm text-slate-600 dark:text-slate-400">
                      {customer.phone}
                    </td>
                    <td className="p-3 text-sm text-right font-semibold text-blue-600 dark:text-blue-400">
                      {formatCurrency(customer.totalRevenue)} đ
                    </td>
                    <td className="p-3 text-sm text-right text-slate-600 dark:text-slate-400">
                      {customer.orderCount}
                    </td>
                    <td className="p-3 text-sm text-right text-slate-600 dark:text-slate-400">
                      {formatCurrency(customer.averageOrderValue)} đ
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
