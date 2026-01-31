import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createAnalyticsService } from "../lib/services/AnalyticsService";
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
import { Card, StatsCard } from "./ui/Card";
import { Icon } from "./common/Icon";
import { subMonths } from "date-fns";

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

  const [timeRange, setTimeRange] = useState<"7days" | "30days" | "6months">("30days");
  const [activeTab, setActiveTab] = useState<"overview" | "inventory" | "customers">("overview");

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
  const financialMetrics = analyticsService.getFinancialMetrics(startDate, endDate);
  const categoryBreakdown = analyticsService.getCategoryBreakdown(startDate, endDate);

  // New metrics
  // New metrics with strict safe-guards
  const profitAnalysis = typeof analyticsService.getProfitAnalysis === 'function'
    ? analyticsService.getProfitAnalysis(10, startDate, endDate)
    : { topProfitProducts: [], averageMargin: 0 };

  const inventoryAnalysis = typeof analyticsService.getInventoryAnalysis === 'function'
    ? analyticsService.getInventoryAnalysis()
    : { deadStock: [], lowTurnover: [], stockValue: 0, totalItems: 0 };

  const retentionMetrics = typeof analyticsService.getRetentionMetrics === 'function'
    ? analyticsService.getRetentionMetrics()
    : { returningRate: 0, dormantCustomers: [], totalCustomers: 0 };

  const debtOverview = typeof analyticsService.getDebtOverview === 'function'
    ? analyticsService.getDebtOverview()
    : { totalReceivables: 0, totalPayables: 0, overdueCount: 0 };

  const topCustomers = typeof analyticsService.getTopCustomers === 'function'
    ? analyticsService.getTopCustomers(10, startDate, endDate)
    : [];

  const topProducts = typeof analyticsService.getTopProducts === 'function'
    ? analyticsService.getTopProducts(10, startDate, endDate)
    : [];

  const formatCurrency = (value: number) => {
    return value.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  };

  return (
    <div className="space-y-4 p-3 lg:p-4 min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-3xl">📊</span> Phân tích Kinh doanh & Báo cáo
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tổng hợp các chỉ số quan trọng để ra quyết định
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
          {[
            { value: "7days", label: "7 ngày" },
            { value: "30days", label: "30 ngày" },
            { value: "6months", label: "6 tháng" },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setTimeRange(option.value as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${timeRange === option.value
                ? "bg-blue-600 text-white shadow-md"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-slate-200 dark:border-slate-700">
        {[
          { id: "overview", label: "Tổng quan", icon: "overview" },
          { id: "inventory", label: "Hàng hóa & Lợi nhuận", icon: "stock" },
          { id: "customers", label: "Khách hàng & Công nợ", icon: "customers" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`pb-3 px-1 text-sm font-semibold flex items-center gap-2 transition-colors relative ${activeTab === tab.id
              ? "text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
          >
            <Icon name={tab.icon as any} size="sm" />
            {tab.label}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === "overview" && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatsCard
                title="Doanh thu"
                value={`${formatCurrency(financialMetrics.totalRevenue)} đ`}
                iconName="money"
                variant="primary"
                compact
              />
              <StatsCard
                title="Lợi nhuận gộp"
                value={`${formatCurrency(financialMetrics.grossProfit)} đ`}
                iconName="success"
                variant="success"
                compact
                trend={{
                  value: Math.round(financialMetrics.profitMargin * 10) / 10,
                  label: "biên lợi nhuận",
                }}
              />
              <StatsCard
                title="Đơn hàng"
                value={financialMetrics.totalOrders}
                iconName="orders"
                variant="warning"
                compact
              />
              <StatsCard
                title="Giá trị TB/đơn"
                value={`${formatCurrency(financialMetrics.averageOrderValue)} đ`}
                iconName="capital"
                variant="info"
                compact
              />
            </div>

            {/* Revenue Chart */}
            <Card padding="sm">
              <h3 className="text-base font-semibold mb-4 text-slate-800 dark:text-slate-100">
                Xu hướng Doanh thu & Lợi nhuận
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={timeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `${val / 1000000}M`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "none",
                      borderRadius: "8px",
                      color: "#fff",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    formatter={(value: number) => formatCurrency(value) + " đ"}
                    labelStyle={{ color: "#94a3b8", marginBottom: "0.5rem" }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#3b82f6"
                    strokeWidth={3}
                    dot={false}
                    name="Doanh thu"
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    name="Lợi nhuận"
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Top Products & Categories */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top 10 Selling Products (List View) */}
              <Card padding="md">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="text-xl">🏆</span>
                  Top 10 Sản phẩm Bán chạy
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-2 rounded-l-lg">#</th>
                        <th className="px-3 py-2">Sản phẩm</th>
                        <th className="px-3 py-2 text-right">SL Bán</th>
                        <th className="px-3 py-2 text-right rounded-r-lg">Doanh thu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {topProducts.map((product, index) => (
                        <tr key={product.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <td className="px-3 py-3 font-medium text-slate-500">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-800 dark:text-slate-200 line-clamp-1" title={product.name}>
                              {product.name}
                            </div>
                            <div className="text-xs text-slate-500 font-mono">{product.sku}</div>
                          </td>
                          <td className="px-3 py-3 text-right font-medium text-slate-700 dark:text-slate-300">
                            {product.totalQuantity}
                          </td>
                          <td className="px-3 py-3 text-right">
                            <div className="font-bold text-blue-600 dark:text-blue-400">
                              {formatCurrency(product.totalRevenue)}
                            </div>
                            {/* Visual bar relative to top product */}
                            <div className="w-full bg-slate-100 dark:bg-slate-700 h-1 mt-1 rounded-full overflow-hidden">
                              <div
                                className="bg-blue-500 h-full rounded-full"
                                style={{
                                  width: `${(product.totalRevenue / topProducts[0].totalRevenue) * 100}%`
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                      {topProducts.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                            Chưa có dữ liệu bán hàng
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Category Breakdown */}
              <Card padding="md">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                  <span className="text-xl">🍰</span>
                  Phân bổ theo Danh mục
                </h3>
                <div className="flex flex-col h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown as any[]}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="revenue"
                      >
                        {categoryBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{
                          backgroundColor: "#1e293b",
                          border: "none",
                          borderRadius: "8px",
                          color: "#fff"
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        formatter={(value, entry: any) => (
                          <span className="text-slate-600 dark:text-slate-300 ml-1">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Category Details in Text */}
                  <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-1">
                    {categoryBreakdown.map((cat, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                          <span className="text-slate-700 dark:text-slate-300">{cat.category}</span>
                        </div>
                        <div className="text-right">
                          <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(cat.revenue)}</span>
                          <span className="text-slate-500 ml-1">({cat.percentage.toFixed(1)}%)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            {/* Top Customers */}
            <Card padding="md">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <span className="text-xl">💎</span>
                Top 10 Khách hàng Tiềm năng
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-4 py-3 rounded-l-lg">#</th>
                      <th className="px-4 py-3">Khách hàng</th>
                      <th className="px-4 py-3">SĐT</th>
                      <th className="px-4 py-3 text-right">Tổng chi tiêu</th>
                      <th className="px-4 py-3 text-center">Số đơn</th>
                      <th className="px-4 py-3 text-right rounded-r-lg">TB/đơn</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {topCustomers.map((customer, index) => (
                      <tr key={index} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-500">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {customer.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {customer.phone || "-"}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(customer.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700 dark:text-slate-300">
                          {customer.orderCount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500">
                          {formatCurrency(customer.averageOrderValue)}
                        </td>
                      </tr>
                    ))}
                    {topCustomers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                          Chưa có dữ liệu khách hàng
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>


          </>
        )}

        {activeTab === "inventory" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Inventory Health */}
            <Card padding="md">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Icon name="stock" className="text-amber-500" />
                  Sức khỏe Tồn kho
                </h3>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Giá trị tồn kho</div>
                  <div className="text-lg font-bold text-slate-800 dark:text-slate-100">
                    {formatCurrency(inventoryAnalysis.stockValue)} đ
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-100 dark:border-red-800/50">
                  <div className="text-red-600 dark:text-red-400 font-bold text-xl mb-1">
                    {inventoryAnalysis.deadStock.length}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Sản phẩm "Chết"<br />(&gt;90 ngày không bán)
                  </div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg border border-amber-100 dark:border-amber-800/50">
                  <div className="text-amber-600 dark:text-amber-400 font-bold text-xl mb-1">
                    {inventoryAnalysis.lowTurnover.length}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-400">
                    Vòng quay thấp<br />(Tồn nhiều bán chậm)
                  </div>
                </div>
              </div>

              <h4 className="text-sm font-semibold mb-2">Danh sách Cần Xả hàng (Top 5)</h4>
              <div className="space-y-2">
                {inventoryAnalysis.deadStock.slice(0, 5).map(p => (
                  <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded">
                    <span className="truncate flex-1 font-medium">{p.name}</span>
                    <span className="text-slate-500 ml-2">Tồn: {p.stock}</span>
                  </div>
                ))}
                {inventoryAnalysis.deadStock.length === 0 && (
                  <div className="text-sm text-green-600 italic">Kho hàng khỏe mạnh! Không có hàng tồn lâu.</div>
                )}
              </div>
            </Card>

            {/* Profit Analysis */}
            <Card padding="md">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Icon name="capital" className="text-green-500" />
                Top Lợi Nhuận
              </h3>
              <div className="space-y-3">
                {profitAnalysis.topProfitProducts.slice(0, 7).map((p, idx) => (
                  <div key={p.sku} className="relative">
                    <div className="flex justify-between text-sm z-10 relative mb-1">
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {idx + 1}. {p.name}
                      </span>
                      <span className="font-bold text-green-600 dark:text-green-400">
                        +{formatCurrency(p.profitMargin * p.totalRevenue / 100)}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-green-500 h-full rounded-full"
                        style={{ width: `${(p.profitMargin * p.totalRevenue / 100) / (profitAnalysis.topProfitProducts[0].profitMargin * profitAnalysis.topProfitProducts[0].totalRevenue / 100) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-[10px] text-slate-400">
                      <span>Doanh thu: {formatCurrency(p.totalRevenue)}</span>
                      <span>Lãi: {p.profitMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {activeTab === "customers" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Customer Retention */}
            <Card padding="md">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Icon name="customers" className="text-blue-500" />
                Trung thành & Giữ chân
              </h3>

              <div className="flex items-center justify-center p-4">
                <div className="relative w-32 h-32 flex items-center justify-center rounded-full border-8 border-slate-100 dark:border-slate-800">
                  <div className="absolute inset-0 rounded-full border-8 border-blue-500" style={{ clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`, transform: `rotate(${retentionMetrics.returningRate * 3.6}deg)` }}></div>
                  <div className="text-center z-10">
                    <div className="text-2xl font-bold text-blue-600">{retentionMetrics.returningRate.toFixed(0)}%</div>
                    <div className="text-[10px] uppercase text-slate-500 font-bold">Quay lại</div>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <h4 className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Cảnh báo: Khách VIP "Ngủ đông"</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {retentionMetrics.dormantCustomers.map((c, i) => (
                    <div key={i} className="flex justify-between items-center text-sm p-2 bg-red-50 dark:bg-red-900/10 rounded border-l-2 border-red-500">
                      <div>
                        <div className="font-medium text-slate-800 dark:text-slate-200">{c.name}</div>
                        <div className="text-[10px] text-slate-500">{new Date(c.lastOrderDate).toLocaleDateString("vi-VN")}</div>
                      </div>
                      <button className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 shadow-sm hover:bg-slate-50">
                        Gọi ngay
                      </button>
                    </div>
                  ))}
                  {retentionMetrics.dormantCustomers.length === 0 && (
                    <div className="text-center text-sm text-slate-500 py-4">Tuyệt vời! Khách hàng đều mua sắm đều đặn.</div>
                  )}
                </div>
              </div>
            </Card>

            {/* Debt Overview */}
            <Card padding="md">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Icon name="warning" className="text-red-500" />
                Sổ nợ (Công nợ)
              </h3>


              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-xl border border-red-100 dark:border-red-800/50 mb-4 text-center">
                <div className="text-sm text-red-600 dark:text-red-400 font-medium uppercase tracking-wider mb-1">Phải thu khách hàng</div>
                <div className="text-3xl font-bold text-slate-900 dark:text-white">
                  {formatCurrency(debtOverview.totalReceivables)} đ
                </div>
                <div className="text-xs text-red-500 mt-1">
                  {debtOverview.overdueCount} khách đang nợ
                </div>
              </div>

              <div className="text-sm text-slate-500 mb-2">Thống kê nhanh:</div>
              <div className="space-y-2">
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span>Nợ phải trả NCC</span>
                  <span className="font-medium">{formatCurrency(debtOverview.totalPayables)} đ</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded">
                  <span>Dự báo nợ xấu</span>
                  <span className="font-medium text-orange-500">0 đ</span>
                </div>
              </div>

              <div className="mt-6 flex justify-center">
                <button className="text-sm text-blue-600 hover:underline">
                  Xem báo cáo công nợ chi tiết →
                </button>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div >
  );
};

export default AdvancedAnalyticsDashboard;
