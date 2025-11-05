import React, { useMemo, useState } from "react";
import type {
  ProductionOrder,
  PinMaterial,
  PinBOM,
  CostPrediction,
  InventoryForecast,
} from "../types";
import {
  ChartBarIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CpuChipIcon,
  BeakerIcon,
  CubeIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "./common/Icons";
import PredictiveCostEngine from "../lib/PredictiveCostEngine";
import SmartInventoryAnalytics from "../lib/SmartInventoryAnalytics";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

interface PredictiveDashboardProps {
  orders: ProductionOrder[];
  materials: PinMaterial[];
  boms: PinBOM[];
}

const PredictiveDashboard: React.FC<PredictiveDashboardProps> = ({
  orders,
  materials,
  boms,
}) => {
  const [selectedTab, setSelectedTab] = useState<
    "overview" | "cost_prediction" | "inventory_forecast"
  >("overview");

  // Initialize prediction engines
  const { costEngine, inventoryAnalytics } = useMemo(() => {
    const costEngine = new PredictiveCostEngine(orders, materials);
    const inventoryAnalytics = new SmartInventoryAnalytics(
      materials,
      orders,
      boms
    );
    return { costEngine, inventoryAnalytics };
  }, [orders, materials, boms]);

  // Generate predictions for active orders
  const activePredictions = useMemo(() => {
    const activeOrders = orders.filter(
      (order) => order.status === "Mới" || order.status === "Đang chờ"
    );

    return activeOrders
      .map((order) => {
        const bom = boms.find((b) => b.id === order.bomId);
        if (!bom) return null;

        const prediction = costEngine.predictCost(order, bom);
        return { order, prediction, bom };
      })
      .filter(Boolean);
  }, [orders, boms, costEngine]);

  // Generate inventory forecasts
  const inventoryForecasts = useMemo(() => {
    return inventoryAnalytics.generateInventoryForecast();
  }, [inventoryAnalytics]);

  // Get critical alerts
  const criticalInventoryAlerts = useMemo(() => {
    return inventoryAnalytics.getCriticalAlerts();
  }, [inventoryAnalytics]);

  const inventorySummary = useMemo(() => {
    return inventoryAnalytics.getInventorySummary();
  }, [inventoryAnalytics]);

  // Calculate overview metrics
  const overviewMetrics = useMemo(() => {
    const totalPredictedCost = activePredictions.reduce(
      (sum, item) => sum + (item?.prediction.predictedTotalCost || 0),
      0
    );
    const totalEstimatedCost = activePredictions.reduce(
      (sum, item) => sum + (item?.order.totalCost || 0),
      0
    );
    const averageConfidence =
      activePredictions.length > 0
        ? activePredictions.reduce(
            (sum, item) => sum + (item?.prediction.confidenceLevel || 0),
            0
          ) / activePredictions.length
        : 0;
    const highRiskOrders = activePredictions.filter(
      (item) =>
        item?.prediction.riskAssessment.overallRisk === "high" ||
        item?.prediction.riskAssessment.overallRisk === "critical"
    ).length;

    return {
      totalPredictedCost,
      totalEstimatedCost,
      costVariance: totalPredictedCost - totalEstimatedCost,
      averageConfidence: averageConfidence * 100,
      highRiskOrders,
      totalActiveOrders: activePredictions.length,
    };
  }, [activePredictions]);

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "critical":
        return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20";
      case "high":
        return "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20";
      default:
        return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20";
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "critical":
        return "text-red-600 dark:text-red-400";
      case "high":
        return "text-orange-600 dark:text-orange-400";
      case "medium":
        return "text-yellow-600 dark:text-yellow-400";
      default:
        return "text-green-600 dark:text-green-400";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-3">
          <CpuChipIcon className="w-8 h-8 text-purple-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              🔮 Dashboard Dự đoán Thông minh
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              AI-powered cost prediction và smart inventory management
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8">
          {[
            {
              key: "overview",
              label: "Tổng quan",
              icon: <ChartBarIcon className="w-4 h-4" />,
            },
            {
              key: "cost_prediction",
              label: "Dự đoán Chi phí",
              icon: <BeakerIcon className="w-4 h-4" />,
            },
            {
              key: "inventory_forecast",
              label: "Dự báo Tồn kho",
              icon: <CubeIcon className="w-4 h-4" />,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                selectedTab === tab.key
                  ? "border-purple-500 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                    Chi phí Dự đoán
                  </p>
                  <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                    {formatCurrency(overviewMetrics.totalPredictedCost)}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Chênh lệch: {overviewMetrics.costVariance >= 0 ? "+" : ""}
                    {formatCurrency(overviewMetrics.costVariance)}
                  </p>
                </div>
                <BeakerIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 dark:text-green-400 text-sm font-medium">
                    Độ tin cậy AI
                  </p>
                  <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                    {overviewMetrics.averageConfidence.toFixed(0)}%
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {overviewMetrics.totalActiveOrders} lệnh đang phân tích
                  </p>
                </div>
                <CpuChipIcon className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">
                    Lệnh Rủi ro cao
                  </p>
                  <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
                    {overviewMetrics.highRiskOrders}
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Cần attention ngay
                  </p>
                </div>
                <ExclamationTriangleIcon className="w-8 h-8 text-orange-600 dark:text-orange-400" />
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 dark:text-red-400 text-sm font-medium">
                    NVL Thiếu hụt
                  </p>
                  <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                    {criticalInventoryAlerts.length}
                  </p>
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Cần đặt hàng urgent
                  </p>
                </div>
                <CubeIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
            </div>
          </div>

          {/* Critical Alerts Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* High Risk Orders */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700">
              <div className="p-4 border-b dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                  <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 mr-2" />
                  Lệnh SX Rủi ro Cao
                </h3>
              </div>
              <div className="p-4">
                {activePredictions.filter(
                  (item) =>
                    item?.prediction.riskAssessment.overallRisk === "high" ||
                    item?.prediction.riskAssessment.overallRisk === "critical"
                ).length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Tất cả lệnh sản xuất trong tình trạng an toàn</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePredictions
                      .filter(
                        (item) =>
                          item?.prediction.riskAssessment.overallRisk ===
                            "high" ||
                          item?.prediction.riskAssessment.overallRisk ===
                            "critical"
                      )
                      .slice(0, 5)
                      .map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              #{item?.order.id} - {item?.order.productName}
                            </p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                              Dự đoán:{" "}
                              {formatCurrency(
                                item?.prediction.predictedTotalCost || 0
                              )}
                            </p>
                          </div>
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(
                              item?.prediction.riskAssessment.overallRisk ||
                                "low"
                            )}`}
                          >
                            {item?.prediction.riskAssessment.overallRisk ===
                            "critical"
                              ? "Nguy cấp"
                              : "Cao"}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>

            {/* Critical Inventory Alerts */}
            <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700">
              <div className="p-4 border-b dark:border-slate-700">
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center">
                  <CubeIcon className="w-5 h-5 text-red-500 mr-2" />
                  Cảnh báo Tồn kho
                </h3>
              </div>
              <div className="p-4">
                {criticalInventoryAlerts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    <CheckCircleIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>Tất cả nguyên vật liệu đủ tồn kho</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {criticalInventoryAlerts
                      .slice(0, 5)
                      .map((forecast, index) => {
                        const material = materials.find(
                          (m) => m.id === forecast.materialId
                        );
                        return (
                          <div
                            key={index}
                            className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                          >
                            <div>
                              <p className="font-medium text-slate-800 dark:text-slate-100">
                                {material?.name || forecast.materialId}
                              </p>
                              <p className="text-sm text-slate-600 dark:text-slate-400">
                                Tồn kho: {forecast.currentStock}{" "}
                                {material?.unit}
                              </p>
                            </div>
                            <div
                              className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(
                                forecast.recommendedAction.urgencyLevel
                              )}`}
                            >
                              {forecast.recommendedAction.urgencyLevel ===
                              "critical"
                                ? "Nguy cấp"
                                : "Cần đặt hàng"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cost Prediction Tab */}
      {selectedTab === "cost_prediction" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Chi tiết Dự đoán Chi phí
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-700 dark:text-slate-300">
                      Lệnh SX
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Ước tính
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Dự đoán
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Tin cậy
                    </th>
                    <th className="text-center p-4 font-medium text-slate-700 dark:text-slate-300">
                      Rủi ro
                    </th>
                    <th className="text-left p-4 font-medium text-slate-700 dark:text-slate-300">
                      Yếu tố chính
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activePredictions.map((item, index) => (
                    <tr
                      key={index}
                      className={`border-t dark:border-slate-700 ${
                        index % 2 === 0
                          ? "bg-slate-25 dark:bg-slate-900/50"
                          : ""
                      }`}
                    >
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-slate-800 dark:text-slate-100">
                            #{item?.order.id}
                          </p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            {item?.order.productName}
                          </p>
                        </div>
                      </td>
                      <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                        {formatCurrency(item?.order.totalCost || 0)}
                      </td>
                      <td className="p-4 text-right font-medium text-slate-800 dark:text-slate-100">
                        {formatCurrency(
                          item?.prediction.predictedTotalCost || 0
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end">
                          <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 mr-2">
                            <div
                              className="bg-green-500 h-2 rounded-full"
                              style={{
                                width: `${
                                  (item?.prediction.confidenceLevel || 0) * 100
                                }%`,
                              }}
                            />
                          </div>
                          <span className="text-sm text-slate-600 dark:text-slate-400">
                            {(
                              (item?.prediction.confidenceLevel || 0) * 100
                            ).toFixed(0)}
                            %
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${getRiskColor(
                            item?.prediction.riskAssessment.overallRisk || "low"
                          )}`}
                        >
                          {item?.prediction.riskAssessment.overallRisk ===
                          "critical"
                            ? "Nguy cấp"
                            : item?.prediction.riskAssessment.overallRisk ===
                              "high"
                            ? "Cao"
                            : item?.prediction.riskAssessment.overallRisk ===
                              "medium"
                            ? "TB"
                            : "Thấp"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="space-y-1">
                          {item?.prediction.predictionFactors
                            .slice(0, 2)
                            .map((factor, fIndex) => (
                              <div
                                key={fIndex}
                                className="text-xs text-slate-600 dark:text-slate-400"
                              >
                                • {factor.description}
                              </div>
                            ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Forecast Tab */}
      {selectedTab === "inventory_forecast" && (
        <div className="space-y-6">
          {/* Inventory Summary */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                {inventorySummary.totalMaterials}
              </p>
              <p className="text-blue-600 dark:text-blue-400 text-sm">
                Tổng NVL
              </p>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-red-800 dark:text-red-200">
                {inventorySummary.criticalLowStock}
              </p>
              <p className="text-red-600 dark:text-red-400 text-sm">Sắp hết</p>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-green-800 dark:text-green-200">
                {inventorySummary.adequateStock}
              </p>
              <p className="text-green-600 dark:text-green-400 text-sm">
                Đủ tồn kho
              </p>
            </div>
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-amber-800 dark:text-amber-200">
                {inventorySummary.overStock}
              </p>
              <p className="text-amber-600 dark:text-amber-400 text-sm">
                Dư thừa
              </p>
            </div>
          </div>

          {/* Detailed Inventory Forecast */}
          <div className="bg-white dark:bg-slate-900 rounded-lg border dark:border-slate-700 overflow-hidden">
            <div className="p-4 border-b dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                Dự báo Tồn kho Chi tiết
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800">
                  <tr>
                    <th className="text-left p-4 font-medium text-slate-700 dark:text-slate-300">
                      Nguyên vật liệu
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Tồn kho
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Dự báo cần
                    </th>
                    <th className="text-right p-4 font-medium text-slate-700 dark:text-slate-300">
                      Rủi ro hết
                    </th>
                    <th className="text-center p-4 font-medium text-slate-700 dark:text-slate-300">
                      Khuyến nghị
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryForecasts.map((forecast, index) => {
                    const material = materials.find(
                      (m) => m.id === forecast.materialId
                    );
                    const totalDemand = forecast.projectedDemand.reduce(
                      (sum, proj) => sum + proj.projectedDemand,
                      0
                    );
                    return (
                      <tr
                        key={index}
                        className={`border-t dark:border-slate-700 ${
                          index % 2 === 0
                            ? "bg-slate-25 dark:bg-slate-900/50"
                            : ""
                        }`}
                      >
                        <td className="p-4">
                          <div>
                            <p className="font-medium text-slate-800 dark:text-slate-100">
                              {material?.name || forecast.materialId}
                            </p>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                              {material?.unit}
                            </p>
                          </div>
                        </td>
                        <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                          {forecast.currentStock}
                        </td>
                        <td className="p-4 text-right text-slate-600 dark:text-slate-400">
                          {totalDemand}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end">
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-2 mr-2">
                              <div
                                className={`h-2 rounded-full ${
                                  forecast.stockoutRisk > 0.7
                                    ? "bg-red-500"
                                    : forecast.stockoutRisk > 0.4
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                                }`}
                                style={{
                                  width: `${forecast.stockoutRisk * 100}%`,
                                }}
                              />
                            </div>
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {(forecast.stockoutRisk * 100).toFixed(0)}%
                            </span>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          <div
                            className={`px-2 py-1 rounded text-xs font-medium ${getUrgencyColor(
                              forecast.recommendedAction.urgencyLevel
                            )}`}
                          >
                            {forecast.recommendedAction.action === "immediate"
                              ? "Đặt ngay"
                              : forecast.recommendedAction.action ===
                                "within_week"
                              ? "Trong tuần"
                              : forecast.recommendedAction.action ===
                                "within_month"
                              ? "Trong tháng"
                              : "OK"}
                          </div>
                          {forecast.recommendedAction.recommendedQuantity >
                            0 && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                              SL:{" "}
                              {forecast.recommendedAction.recommendedQuantity}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* AI Insights Footer */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg p-6">
        <div className="flex items-start space-x-3">
          <SparklesIcon className="w-6 h-6 text-purple-600 mt-1" />
          <div>
            <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-2">
              💡 AI Insights & Khuyến nghị
            </h4>
            <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {overviewMetrics.costVariance > 0 && (
                <p>
                  • Chi phí dự đoán cao hơn ước tính{" "}
                  {formatCurrency(overviewMetrics.costVariance)}. Xem xét tối ưu
                  hóa quy trình sản xuất.
                </p>
              )}
              {overviewMetrics.averageConfidence < 70 && (
                <p>
                  • Độ tin cậy dự đoán thấp (
                  {overviewMetrics.averageConfidence.toFixed(0)}%). Thu thập
                  thêm dữ liệu lịch sử để cải thiện độ chính xác.
                </p>
              )}
              {criticalInventoryAlerts.length > 0 && (
                <p>
                  • {criticalInventoryAlerts.length} nguyên vật liệu cần đặt
                  hàng gấp để tránh gián đoạn sản xuất.
                </p>
              )}
              {inventorySummary.overStock > 0 && (
                <p>
                  • {inventorySummary.overStock} nguyên vật liệu dư thừa. Xem
                  xét giảm đặt hàng để tối ưu cash flow.
                </p>
              )}
              {overviewMetrics.highRiskOrders === 0 &&
                criticalInventoryAlerts.length === 0 && (
                  <p>
                    • ✅ Hệ thống hoạt động tốt! Tất cả lệnh sản xuất và tồn kho
                    trong tình trạng an toàn.
                  </p>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PredictiveDashboard;
