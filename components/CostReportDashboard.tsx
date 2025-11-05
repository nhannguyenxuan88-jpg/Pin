import React, { useMemo, useState } from "react";
import type { ProductionOrder, PinMaterial } from "../types";
import {
  ChartBarIcon,
  DocumentChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BuildingLibraryIcon,
  Cog6ToothIcon,
  ArchiveBoxIcon,
} from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

interface CostReportDashboardProps {
  orders: ProductionOrder[];
  materials: PinMaterial[];
}

const CostReportDashboard: React.FC<CostReportDashboardProps> = ({
  orders,
  materials,
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<
    "week" | "month" | "quarter" | "all"
  >("month");
  const [sortBy, setSortBy] = useState<"date" | "variance" | "product">("date");

  // Filter completed orders with cost analysis
  const completedOrdersWithCosts = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (selectedTimeRange) {
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        const quarterStart = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), quarterStart, 1);
        break;
      default:
        startDate = new Date(0);
    }

    return orders
      .filter(
        (order) =>
          order.status === "Hoàn thành" &&
          order.costAnalysis &&
          order.completedAt &&
          new Date(order.completedAt) >= startDate
      )
      .sort((a, b) => {
        switch (sortBy) {
          case "variance":
            return (
              (b.costAnalysis?.variance || 0) - (a.costAnalysis?.variance || 0)
            );
          case "product":
            return a.productName.localeCompare(b.productName);
          default:
            return (
              new Date(b.completedAt!).getTime() -
              new Date(a.completedAt!).getTime()
            );
        }
      });
  }, [orders, selectedTimeRange, sortBy]);

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    if (completedOrdersWithCosts.length === 0) {
      return {
        totalOrders: 0,
        totalEstimatedCost: 0,
        totalActualCost: 0,
        totalVariance: 0,
        averageVariancePercent: 0,
        ordersOverBudget: 0,
        ordersUnderBudget: 0,
      };
    }

    const totalEstimated = completedOrdersWithCosts.reduce(
      (sum, order) => sum + order.totalCost,
      0
    );
    const totalActual = completedOrdersWithCosts.reduce(
      (sum, order) => sum + (order.costAnalysis?.actualCost || 0),
      0
    );
    const totalVariance = totalActual - totalEstimated;
    const averageVariancePercent =
      totalEstimated > 0 ? (totalVariance / totalEstimated) * 100 : 0;

    const ordersOverBudget = completedOrdersWithCosts.filter(
      (order) => (order.costAnalysis?.variance || 0) > 0
    ).length;
    const ordersUnderBudget = completedOrdersWithCosts.filter(
      (order) => (order.costAnalysis?.variance || 0) < 0
    ).length;

    return {
      totalOrders: completedOrdersWithCosts.length,
      totalEstimatedCost: totalEstimated,
      totalActualCost: totalActual,
      totalVariance,
      averageVariancePercent,
      ordersOverBudget,
      ordersUnderBudget,
    };
  }, [completedOrdersWithCosts]);

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-red-600 dark:text-red-400";
    if (variance < 0) return "text-green-600 dark:text-green-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <ArrowTrendingUpIcon className="w-4 h-4" />;
    if (variance < 0) return <ArrowTrendingDownIcon className="w-4 h-4" />;
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <DocumentChartBarIcon className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              Báo cáo Chi phí Sản xuất
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Phân tích ước tính vs thực tế chi phí sản xuất
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex space-x-3">
          <div className="flex items-center space-x-2">
            <Cog6ToothIcon className="w-4 h-4 text-slate-500" />
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="week">7 ngày qua</option>
              <option value="month">Tháng này</option>
              <option value="quarter">Quý này</option>
              <option value="all">Tất cả</option>
            </select>
          </div>

          <div className="flex items-center space-x-2">
            <ArchiveBoxIcon className="w-4 h-4 text-slate-500" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-1 bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
            >
              <option value="date">Ngày hoàn thành</option>
              <option value="variance">Chênh lệch</option>
              <option value="product">Tên sản phẩm</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                Tổng số lệnh
              </p>
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {summaryStats.totalOrders}
              </p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                Tiết kiệm
              </p>
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {summaryStats.ordersUnderBudget}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400">
                {summaryStats.totalOrders > 0
                  ? Math.round(
                      (summaryStats.ordersUnderBudget /
                        summaryStats.totalOrders) *
                        100
                    )
                  : 0}
                % lệnh
              </p>
            </div>
            <ArrowTrendingDownIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                Vượt ngân sách
              </p>
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                {summaryStats.ordersOverBudget}
              </p>
              <p className="text-xs text-red-600 dark:text-red-400">
                {summaryStats.totalOrders > 0
                  ? Math.round(
                      (summaryStats.ordersOverBudget /
                        summaryStats.totalOrders) *
                        100
                    )
                  : 0}
                % lệnh
              </p>
            </div>
            <ArrowTrendingUpIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
                Chênh lệch TB
              </p>
              <p
                className={`text-2xl font-bold ${getVarianceColor(
                  summaryStats.totalVariance
                )}`}
              >
                {summaryStats.averageVariancePercent >= 0 ? "+" : ""}
                {summaryStats.averageVariancePercent.toFixed(1)}%
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                {formatCurrency(Math.abs(summaryStats.totalVariance))}
              </p>
            </div>
            <BuildingLibraryIcon className="w-8 h-8 text-slate-600 dark:text-slate-400" />
          </div>
        </div>
      </div>

      {/* Detailed Cost Analysis Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Chi tiết Phân tích Chi phí
          </h3>
        </div>

        {completedOrdersWithCosts.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            <DocumentChartBarIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>
              Chưa có dữ liệu phân tích chi phí nào trong khoảng thời gian này
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="text-left p-4 font-medium text-slate-700 dark:text-slate-300">
                    Sản phẩm
                  </th>
                  <th className="text-left p-4 font-medium text-slate-700 dark:text-slate-300">
                    Ngày hoàn thành
                  </th>
                  <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                    SL
                  </th>
                  <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                    Ước tính
                  </th>
                  <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                    Thực tế
                  </th>
                  <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                    Chênh lệch
                  </th>
                  <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                    %
                  </th>
                </tr>
              </thead>
              <tbody>
                {completedOrdersWithCosts.map((order, index) => (
                  <tr
                    key={order.id}
                    className={`border-t dark:border-slate-700 ${
                      index % 2 === 0 ? "bg-slate-25 dark:bg-slate-900/50" : ""
                    }`}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-slate-800 dark:text-slate-100">
                          {order.productName}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          #{order.id}
                        </p>
                      </div>
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-400">
                      {formatDate(order.completedAt!)}
                    </td>
                    <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                      {order.quantityProduced}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-800 dark:text-slate-100">
                      {formatCurrency(order.totalCost)}
                    </td>
                    <td className="p-4 text-right font-medium text-slate-800 dark:text-slate-100">
                      {formatCurrency(order.costAnalysis?.actualCost || 0)}
                    </td>
                    <td
                      className={`p-4 text-right font-bold ${getVarianceColor(
                        order.costAnalysis?.variance || 0
                      )}`}
                    >
                      <div className="flex items-center justify-end space-x-1">
                        {getVarianceIcon(order.costAnalysis?.variance || 0)}
                        <span>
                          {order.costAnalysis?.variance &&
                          order.costAnalysis.variance >= 0
                            ? "+"
                            : ""}
                          {formatCurrency(order.costAnalysis?.variance || 0)}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`p-4 text-right font-bold ${getVarianceColor(
                        order.costAnalysis?.variance || 0
                      )}`}
                    >
                      {order.costAnalysis?.variancePercentage &&
                      order.costAnalysis.variancePercentage >= 0
                        ? "+"
                        : ""}
                      {order.costAnalysis?.variancePercentage?.toFixed(1) ||
                        "0.0"}
                      %
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cost Breakdown Analysis */}
      {completedOrdersWithCosts.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Material vs Additional Costs Variance */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Phân tích theo Thành phần Chi phí
            </h3>
            <div className="space-y-4">
              {(() => {
                const totalMaterialVariance = completedOrdersWithCosts.reduce(
                  (sum, order) =>
                    sum + (order.costAnalysis?.materialVariance || 0),
                  0
                );
                const totalAdditionalVariance = completedOrdersWithCosts.reduce(
                  (sum, order) =>
                    sum + (order.costAnalysis?.additionalCostsVariance || 0),
                  0
                );

                return (
                  <>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <span className="text-slate-700 dark:text-slate-300">
                        Chênh lệch NVL
                      </span>
                      <span
                        className={`font-bold ${getVarianceColor(
                          totalMaterialVariance
                        )}`}
                      >
                        {totalMaterialVariance >= 0 ? "+" : ""}
                        {formatCurrency(totalMaterialVariance)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                      <span className="text-slate-700 dark:text-slate-300">
                        Chênh lệch Chi phí khác
                      </span>
                      <span
                        className={`font-bold ${getVarianceColor(
                          totalAdditionalVariance
                        )}`}
                      >
                        {totalAdditionalVariance >= 0 ? "+" : ""}
                        {formatCurrency(totalAdditionalVariance)}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Performance Insights */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              💡 Nhận xét & Khuyến nghị
            </h3>
            <div className="space-y-3 text-sm">
              {summaryStats.averageVariancePercent > 10 && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
                  ⚠️ Chi phí thực tế cao hơn dự tính{" "}
                  {summaryStats.averageVariancePercent.toFixed(1)}%. Cần xem xét
                  lại quy trình ước tính chi phí.
                </div>
              )}

              {summaryStats.averageVariancePercent < -5 && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
                  ✅ Tiết kiệm chi phí tốt! Thực tế thấp hơn ước tính{" "}
                  {Math.abs(summaryStats.averageVariancePercent).toFixed(1)}%.
                </div>
              )}

              {Math.abs(summaryStats.averageVariancePercent) <= 5 && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg">
                  🎯 Ước tính chi phí chính xác! Chênh lệch trung bình chỉ{" "}
                  {Math.abs(summaryStats.averageVariancePercent).toFixed(1)}%.
                </div>
              )}

              {summaryStats.ordersOverBudget >
                summaryStats.ordersUnderBudget && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 rounded-lg">
                  📈 {summaryStats.ordersOverBudget} lệnh vượt ngân sách vs{" "}
                  {summaryStats.ordersUnderBudget} lệnh tiết kiệm. Tập trung tối
                  ưu hóa quy trình sản xuất.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CostReportDashboard;
