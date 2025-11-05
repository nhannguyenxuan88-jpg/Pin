/**
 * Comprehensive Financial Dashboard
 * Displays capital tracking, asset management, and cash flow analysis
 */

import React, { useState, useMemo } from "react";
import { usePinContext } from "../contexts/PinContext";
import { FinancialAnalyticsService } from "../lib/services/FinancialAnalyticsService";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  BarChart3,
  Building,
  Wallet,
  Target,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Calculator,
} from "lucide-react";

const FinancialDashboard: React.FC = () => {
  const { fixedAssets = [], currentUser, addToast } = usePinContext();
  // TODO: Wire real values from context/service when available
  const cashFlows: any[] = [];
  const capitalStructure: any[] = [];

  const [selectedPeriod, setSelectedPeriod] = useState<
    "month" | "quarter" | "year"
  >("month");
  const [activeTab, setActiveTab] = useState<
    "overview" | "assets" | "cashflow" | "ratios"
  >("overview");

  // Calculate financial metrics
  const financialMetrics = useMemo(() => {
    const currentDate = new Date();
    const currentCapital = capitalStructure[capitalStructure.length - 1];

    if (!currentCapital) {
      return {
        totalAssets: 0,
        totalLiabilities: 0,
        totalEquity: 0,
        workingCapital: 0,
        assetValue: 0,
        monthlyRevenue: 0,
        monthlyExpenses: 0,
        netCashFlow: 0,
        ratios: null,
      };
    }

    const assetValue = FinancialAnalyticsService.calculateTotalAssetValue(
      fixedAssets,
      currentDate
    );
    const totalEquity =
      currentCapital.totalAssets - currentCapital.totalLiabilities;

    // Calculate monthly cash flows
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0
    );

    const monthlyAnalysis = FinancialAnalyticsService.analyzeCashFlowByPeriod(
      cashFlows,
      startOfMonth,
      endOfMonth
    );

    const monthlyRevenue = cashFlows
      .filter((cf) => {
        const cfDate = new Date(cf.date);
        return (
          cfDate >= startOfMonth &&
          cfDate <= endOfMonth &&
          cf.category === "operating" &&
          cf.amount > 0
        );
      })
      .reduce((sum, cf) => sum + cf.amount, 0);

    const monthlyExpenses = Math.abs(
      cashFlows
        .filter((cf) => {
          const cfDate = new Date(cf.date);
          return (
            cfDate >= startOfMonth &&
            cfDate <= endOfMonth &&
            cf.category === "operating" &&
            cf.amount < 0
          );
        })
        .reduce((sum, cf) => sum + cf.amount, 0)
    );

    return {
      totalAssets: currentCapital.totalAssets,
      totalLiabilities: currentCapital.totalLiabilities,
      totalEquity,
      workingCapital: currentCapital.workingCapital,
      assetValue,
      monthlyRevenue,
      monthlyExpenses,
      netCashFlow: monthlyAnalysis.netCashFlow,
      ratios: FinancialAnalyticsService.calculateFinancialRatios(
        fixedAssets,
        cashFlows,
        currentCapital,
        0, // inventory value - would need to calculate from inventory data
        monthlyRevenue,
        monthlyRevenue - monthlyExpenses
      ),
    };
  }, [fixedAssets, cashFlows, capitalStructure]);

  // Asset breakdown by category
  const assetBreakdown = useMemo(() => {
    const breakdown = fixedAssets.reduce((acc, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return acc;

      const bookValue = FinancialAnalyticsService.calculateBookValue(asset);
      acc[asset.category] = (acc[asset.category] || 0) + bookValue;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(breakdown).map(([category, value]) => ({
      category: category.replace("_", " ").toUpperCase(),
      value,
      percentage:
        financialMetrics.assetValue > 0
          ? (value / financialMetrics.assetValue) * 100
          : 0,
    }));
  }, [fixedAssets, financialMetrics.assetValue]);

  // Cash flow trends
  const cashFlowTrends = useMemo(() => {
    const last12Months = [];
    const currentDate = new Date();

    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i,
        1
      );
      const nextMonth = new Date(
        currentDate.getFullYear(),
        currentDate.getMonth() - i + 1,
        0
      );

      const monthFlows = FinancialAnalyticsService.analyzeCashFlowByPeriod(
        cashFlows,
        monthDate,
        nextMonth
      );

      last12Months.push({
        month: monthDate.toLocaleDateString("vi-VN", {
          month: "short",
          year: "numeric",
        }),
        operating: monthFlows.operating,
        investing: monthFlows.investing,
        financing: monthFlows.financing,
        net: monthFlows.netCashFlow,
      });
    }

    return last12Months;
  }, [cashFlows]);

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-gray-500">
            Vui lòng đăng nhập để xem báo cáo tài chính
          </p>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  const getHealthColor = (
    ratio: number,
    good: { min?: number; max?: number }
  ) => {
    if (good.min && ratio < good.min) return "text-red-600 bg-red-50";
    if (good.max && ratio > good.max) return "text-red-600 bg-red-50";
    return "text-green-600 bg-green-50";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Báo cáo Tài chính Tổng hợp
          </h1>
          <p className="text-gray-600">Theo dõi vốn, tài sản, và dòng tiền</p>
        </div>
        <div className="flex space-x-2">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="month">Tháng này</option>
            <option value="quarter">Quý này</option>
            <option value="year">Năm này</option>
          </select>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { key: "overview", label: "Tổng quan", icon: PieChart },
            { key: "assets", label: "Tài sản", icon: Building },
            { key: "cashflow", label: "Dòng tiền", icon: Wallet },
            { key: "ratios", label: "Chỉ số tài chính", icon: Calculator },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.key
                    ? "border-blue-500 text-blue-600"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Tổng Tài sản
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(financialMetrics.totalAssets)}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-full">
                  <Building className="w-6 h-6 text-blue-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Giá trị sổ sách tài sản:</span>
                <span className="font-medium">
                  {formatCurrency(financialMetrics.assetValue)}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Vốn Chủ sở hữu
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(financialMetrics.totalEquity)}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded-full">
                  <DollarSign className="w-6 h-6 text-green-600" />
                </div>
              </div>
              <div className="mt-4 flex items-center space-x-2 text-sm">
                <span className="text-gray-500">Nợ phải trả:</span>
                <span className="font-medium">
                  {formatCurrency(financialMetrics.totalLiabilities)}
                </span>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Vốn Lưu động
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      financialMetrics.workingCapital >= 0
                        ? "text-gray-900"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(financialMetrics.workingCapital)}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    financialMetrics.workingCapital >= 0
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}
                >
                  <Wallet
                    className={`w-6 h-6 ${
                      financialMetrics.workingCapital >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center space-x-1">
                  {financialMetrics.workingCapital >= 0 ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${
                      financialMetrics.workingCapital >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {financialMetrics.workingCapital >= 0
                      ? "Tình hình tài chính tốt"
                      : "Cần tăng thanh khoản"}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">
                    Dòng Tiền Tháng
                  </p>
                  <p
                    className={`text-2xl font-semibold ${
                      financialMetrics.netCashFlow >= 0
                        ? "text-gray-900"
                        : "text-red-600"
                    }`}
                  >
                    {formatCurrency(financialMetrics.netCashFlow)}
                  </p>
                </div>
                <div
                  className={`p-3 rounded-full ${
                    financialMetrics.netCashFlow >= 0
                      ? "bg-green-50"
                      : "bg-red-50"
                  }`}
                >
                  {financialMetrics.netCashFlow >= 0 ? (
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  ) : (
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  )}
                </div>
              </div>
              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Thu nhập:</span>
                  <span className="text-green-600">
                    {formatCurrency(financialMetrics.monthlyRevenue)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Chi phí:</span>
                  <span className="text-red-600">
                    {formatCurrency(financialMetrics.monthlyExpenses)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Breakdown Chart */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Cơ cấu Tài sản
            </h3>
            <div className="space-y-4">
              {assetBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-4 h-4 rounded-full bg-blue-${
                        ((index % 3) + 1) * 200
                      }`}
                    />
                    <span className="text-sm font-medium text-gray-900">
                      {item.category}
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div
                        className={`bg-blue-${
                          ((index % 3) + 1) * 200
                        } h-2 rounded-full`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600 w-20 text-right">
                      {item.percentage.toFixed(1)}%
                    </span>
                    <span className="text-sm font-medium text-gray-900 w-32 text-right">
                      {formatCurrency(item.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Assets Tab */}
      {activeTab === "assets" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow border overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">
                Danh sách Tài sản Cố định
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tài sản
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Ngày mua
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Giá gốc
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Giá trị hiện tại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Khấu hao
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Trạng thái
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {fixedAssets.map((asset) => {
                    const bookValue =
                      FinancialAnalyticsService.calculateBookValue(asset);
                    const depreciation = asset.purchasePrice - bookValue;
                    const depreciationRate = (
                      (depreciation / asset.purchasePrice) *
                      100
                    ).toFixed(1);

                    return (
                      <tr key={asset.id}>
                        <td className="px-6 py-4">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {asset.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {asset.description}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 capitalize">
                          {asset.category.replace("_", " ")}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(asset.purchaseDate).toLocaleDateString(
                            "vi-VN"
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {formatCurrency(asset.purchasePrice)}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          {formatCurrency(bookValue)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatCurrency(depreciation)} ({depreciationRate}%)
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              asset.status === "active"
                                ? "bg-green-100 text-green-800"
                                : asset.status === "under_maintenance"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {asset.status === "active"
                              ? "Hoạt động"
                              : asset.status === "under_maintenance"
                              ? "Bảo trì"
                              : asset.status === "disposed"
                              ? "Đã thanh lý"
                              : "Đã bán"}
                          </span>
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

      {/* Cash Flow Tab */}
      {activeTab === "cashflow" && (
        <div className="space-y-6">
          {/* Cash Flow Chart */}
          <div className="bg-white p-6 rounded-lg shadow border">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Xu hướng Dòng tiền 12 tháng
            </h3>
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Simple bar chart representation */}
                <div className="space-y-2">
                  {cashFlowTrends.map((trend, index) => (
                    <div key={index} className="flex items-center space-x-4">
                      <div className="w-20 text-sm text-gray-600">
                        {trend.month}
                      </div>
                      <div className="flex-1 flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-4 bg-green-500 rounded" />
                          <span className="text-xs text-gray-600">
                            Hoạt động
                          </span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-4 bg-blue-500 rounded" />
                          <span className="text-xs text-gray-600">Đầu tư</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <div className="w-2 h-4 bg-purple-500 rounded" />
                          <span className="text-xs text-gray-600">
                            Tài chính
                          </span>
                        </div>
                      </div>
                      <div className="w-32 text-right">
                        <span
                          className={`text-sm font-medium ${
                            trend.net >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(trend.net)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Financial Ratios Tab */}
      {activeTab === "ratios" && financialMetrics.ratios && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Liquidity Ratios */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Tỷ lệ Thanh khoản
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tỷ lệ hiện thời</span>
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${getHealthColor(
                      financialMetrics.ratios.currentRatio,
                      { min: 1.2, max: 3 }
                    )}`}
                  >
                    {financialMetrics.ratios.currentRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Tỷ lệ thanh toán nhanh
                  </span>
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${getHealthColor(
                      financialMetrics.ratios.quickRatio,
                      { min: 1 }
                    )}`}
                  >
                    {financialMetrics.ratios.quickRatio.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tỷ lệ tiền mặt</span>
                  <span className="text-sm font-medium">
                    {financialMetrics.ratios.cashRatio.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Profitability Ratios */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Tỷ lệ Lợi nhuận
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Biên lợi nhuận gộp
                  </span>
                  <span className="text-sm font-medium">
                    {(financialMetrics.ratios.grossProfitMargin * 100).toFixed(
                      1
                    )}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">
                    Biên lợi nhuận ròng
                  </span>
                  <span
                    className={`text-sm font-medium ${
                      financialMetrics.ratios.netProfitMargin > 0
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {(financialMetrics.ratios.netProfitMargin * 100).toFixed(1)}
                    %
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ROA</span>
                  <span className="text-sm font-medium">
                    {(financialMetrics.ratios.returnOnAssets * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">ROE</span>
                  <span className="text-sm font-medium">
                    {(financialMetrics.ratios.returnOnEquity * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Leverage Ratios */}
            <div className="bg-white p-6 rounded-lg shadow border">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">
                Tỷ lệ Đòn bẩy
              </h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Nợ trên tài sản</span>
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${getHealthColor(
                      financialMetrics.ratios.debtToAssets,
                      { max: 0.6 }
                    )}`}
                  >
                    {(financialMetrics.ratios.debtToAssets * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Nợ trên vốn</span>
                  <span
                    className={`text-sm font-medium px-2 py-1 rounded ${getHealthColor(
                      financialMetrics.ratios.debtToEquity,
                      { max: 2 }
                    )}`}
                  >
                    {financialMetrics.ratios.debtToEquity.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Tỷ lệ vốn chủ</span>
                  <span className="text-sm font-medium">
                    {(financialMetrics.ratios.equityRatio * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialDashboard;
