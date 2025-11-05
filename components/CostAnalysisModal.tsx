import React, { useState, useMemo } from "react";
import type {
  ProductionOrder,
  PinMaterial,
  ActualCost,
  MaterialCommitment,
  AdditionalCost,
  CostAnalysis,
} from "../types";
import {
  XMarkIcon,
  PlusIcon,
  TrashIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
} from "./common/Icons";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );

interface CostAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: ProductionOrder;
  materials: PinMaterial[];
  onSaveActualCosts: (order: ProductionOrder, actualCosts: ActualCost) => void;
}

const CostAnalysisModal: React.FC<CostAnalysisModalProps> = ({
  isOpen,
  onClose,
  order,
  materials,
  onSaveActualCosts,
}) => {
  // State for actual costs input
  const [actualMaterialCosts, setActualMaterialCosts] = useState<
    MaterialCommitment[]
  >(
    order.committedMaterials?.map((cm) => ({
      ...cm,
      actualCost: cm.estimatedCost,
      actualQuantityUsed: cm.quantity,
    })) || []
  );

  const [laborCost, setLaborCost] = useState(order.actualCosts?.laborCost || 0);
  const [electricityCost, setElectricityCost] = useState(
    order.actualCosts?.electricityCost || 0
  );
  const [machineryCost, setMachineryCost] = useState(
    order.actualCosts?.machineryCost || 0
  );
  const [otherCosts, setOtherCosts] = useState<AdditionalCost[]>(
    order.actualCosts?.otherCosts || []
  );
  const [newOtherCost, setNewOtherCost] = useState({
    description: "",
    amount: 0,
  });

  // Calculate totals and analysis
  const calculatedCosts = useMemo(() => {
    const materialTotal = actualMaterialCosts.reduce(
      (sum, mc) => sum + (mc.actualCost || 0),
      0
    );
    const otherTotal = otherCosts.reduce((sum, cost) => sum + cost.amount, 0);
    const totalActualCost =
      materialTotal + laborCost + electricityCost + machineryCost + otherTotal;

    const estimatedMaterialCost = order.materialsCost;
    const estimatedTotal = order.totalCost;

    const materialVariance = materialTotal - estimatedMaterialCost;
    const additionalCostsVariance =
      laborCost +
      electricityCost +
      machineryCost +
      otherTotal -
      (order.additionalCosts?.reduce((sum, cost) => sum + cost.amount, 0) || 0);

    const totalVariance = totalActualCost - estimatedTotal;
    const variancePercentage =
      estimatedTotal > 0 ? (totalVariance / estimatedTotal) * 100 : 0;

    const analysis: CostAnalysis = {
      estimatedCost: estimatedTotal,
      actualCost: totalActualCost,
      variance: totalVariance,
      variancePercentage,
      materialVariance,
      additionalCostsVariance,
    };

    return {
      materialTotal,
      otherTotal,
      totalActualCost,
      analysis,
    };
  }, [
    actualMaterialCosts,
    laborCost,
    electricityCost,
    machineryCost,
    otherCosts,
    order,
  ]);

  const handleMaterialCostChange = (
    index: number,
    field: keyof MaterialCommitment,
    value: number
  ) => {
    setActualMaterialCosts((prev) =>
      prev.map((mc, i) => (i === index ? { ...mc, [field]: value } : mc))
    );
  };

  const handleAddOtherCost = () => {
    if (newOtherCost.description.trim() && newOtherCost.amount > 0) {
      setOtherCosts((prev) => [...prev, newOtherCost]);
      setNewOtherCost({ description: "", amount: 0 });
    }
  };

  const handleRemoveOtherCost = (index: number) => {
    setOtherCosts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const actualCosts: ActualCost = {
      materialCosts: actualMaterialCosts,
      laborCost,
      electricityCost,
      machineryCost,
      otherCosts,
      totalActualCost: calculatedCosts.totalActualCost,
    };

    const updatedOrder: ProductionOrder = {
      ...order,
      actualCosts,
      costAnalysis: calculatedCosts.analysis,
      completedAt: new Date().toISOString(),
    };

    onSaveActualCosts(updatedOrder, actualCosts);
    onClose();
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-red-600 dark:text-red-400";
    if (variance < 0) return "text-green-600 dark:text-green-400";
    return "text-gray-600 dark:text-gray-400";
  };

  const getVarianceIcon = (variance: number) => {
    if (variance > 0) return <ArrowTrendingUpIcon className="w-4 h-4" />;
    if (variance < 0) return <ArrowTrendingDownIcon className="w-4 h-4" />;
    return <ChartBarIcon className="w-4 h-4" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-slate-700">
          <div className="flex items-center space-x-3">
            <ChartBarIcon className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Phân tích Chi phí Thực tế
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Lệnh sản xuất #{order.id} - {order.productName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Panel - Cost Input */}
          <div className="w-2/3 border-r dark:border-slate-700 overflow-y-auto p-6">
            <div className="space-y-6">
              {/* Material Costs */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  Chi phí Nguyên vật liệu
                </h3>
                <div className="space-y-3">
                  {actualMaterialCosts.map((mc, index) => {
                    const material = materials.find(
                      (m) => m.id === mc.materialId
                    );
                    return (
                      <div
                        key={mc.materialId}
                        className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-medium text-slate-800 dark:text-slate-100">
                            {material?.name || mc.materialId}
                          </h4>
                          <div className="text-sm text-slate-600 dark:text-slate-400">
                            Ước tính: {formatCurrency(mc.estimatedCost)}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              SL thực sử dụng
                            </label>
                            <input
                              type="number"
                              value={mc.actualQuantityUsed || mc.quantity}
                              onChange={(e) =>
                                handleMaterialCostChange(
                                  index,
                                  "actualQuantityUsed",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
                              step="0.1"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Giá thực tế ({material?.unit})
                            </label>
                            <input
                              type="number"
                              value={
                                mc.actualCost
                                  ? mc.actualCost /
                                    (mc.actualQuantityUsed || mc.quantity)
                                  : material?.purchasePrice || 0
                              }
                              onChange={(e) => {
                                const unitPrice =
                                  parseFloat(e.target.value) || 0;
                                const totalCost =
                                  unitPrice *
                                  (mc.actualQuantityUsed || mc.quantity);
                                handleMaterialCostChange(
                                  index,
                                  "actualCost",
                                  totalCost
                                );
                              }}
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                              Tổng chi phí thực tế
                            </label>
                            <input
                              type="number"
                              value={mc.actualCost || 0}
                              onChange={(e) =>
                                handleMaterialCostChange(
                                  index,
                                  "actualCost",
                                  parseFloat(e.target.value) || 0
                                )
                              }
                              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Additional Costs */}
              <div>
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                  Chi phí bổ sung
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Chi phí nhân công
                    </label>
                    <input
                      type="number"
                      value={laborCost}
                      onChange={(e) =>
                        setLaborCost(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Chi phí điện
                    </label>
                    <input
                      type="number"
                      value={electricityCost}
                      onChange={(e) =>
                        setElectricityCost(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Chi phí máy móc
                    </label>
                    <input
                      type="number"
                      value={machineryCost}
                      onChange={(e) =>
                        setMachineryCost(parseFloat(e.target.value) || 0)
                      }
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Other Costs */}
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-medium text-slate-800 dark:text-slate-100">
                      Chi phí khác
                    </h4>
                    <button
                      onClick={handleAddOtherCost}
                      disabled={
                        !newOtherCost.description.trim() ||
                        newOtherCost.amount <= 0
                      }
                      className="flex items-center space-x-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white px-3 py-1 rounded text-sm"
                    >
                      <PlusIcon className="w-3 h-3" />
                      <span>Thêm</span>
                    </button>
                  </div>

                  <div className="flex space-x-2 mb-3">
                    <input
                      type="text"
                      value={newOtherCost.description}
                      onChange={(e) =>
                        setNewOtherCost((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
                      placeholder="Mô tả chi phí"
                    />
                    <input
                      type="number"
                      value={newOtherCost.amount}
                      onChange={(e) =>
                        setNewOtherCost((prev) => ({
                          ...prev,
                          amount: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-32 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-sm"
                      placeholder="Số tiền"
                    />
                  </div>

                  {otherCosts.length > 0 && (
                    <div className="space-y-2">
                      {otherCosts.map((cost, index) => (
                        <div
                          key={index}
                          className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-lg"
                        >
                          <span className="text-slate-800 dark:text-slate-100">
                            {cost.description}
                          </span>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {formatCurrency(cost.amount)}
                            </span>
                            <button
                              onClick={() => handleRemoveOtherCost(index)}
                              className="text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 p-1 rounded"
                            >
                              <TrashIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - Cost Analysis */}
          <div className="w-1/3 overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              Phân tích Chi phí
            </h3>

            <div className="space-y-4">
              {/* Cost Breakdown */}
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-3">
                  Thành phần chi phí
                </h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Chi phí NVL:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedCosts.materialTotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chi phí nhân công:</span>
                    <span className="font-semibold">
                      {formatCurrency(laborCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chi phí điện:</span>
                    <span className="font-semibold">
                      {formatCurrency(electricityCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chi phí máy móc:</span>
                    <span className="font-semibold">
                      {formatCurrency(machineryCost)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Chi phí khác:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedCosts.otherTotal)}
                    </span>
                  </div>
                  <div className="border-t dark:border-slate-600 pt-2 flex justify-between font-bold text-base">
                    <span>Tổng thực tế:</span>
                    <span className="text-blue-600 dark:text-blue-400">
                      {formatCurrency(calculatedCosts.totalActualCost)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Variance Analysis */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-3">
                  So sánh Ước tính vs Thực tế
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span>Ước tính:</span>
                    <span className="font-semibold">
                      {formatCurrency(order.totalCost)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Thực tế:</span>
                    <span className="font-semibold">
                      {formatCurrency(calculatedCosts.totalActualCost)}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center ${getVarianceColor(
                      calculatedCosts.analysis.variance
                    )}`}
                  >
                    <div className="flex items-center space-x-1">
                      {getVarianceIcon(calculatedCosts.analysis.variance)}
                      <span>Chênh lệch:</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">
                        {calculatedCosts.analysis.variance >= 0 ? "+" : ""}
                        {formatCurrency(calculatedCosts.analysis.variance)}
                      </div>
                      <div className="text-xs">
                        (
                        {calculatedCosts.analysis.variancePercentage >= 0
                          ? "+"
                          : ""}
                        {calculatedCosts.analysis.variancePercentage.toFixed(1)}
                        %)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Detailed Variance */}
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-3">
                  Chi tiết Chênh lệch
                </h4>
                <div className="space-y-2 text-sm">
                  <div
                    className={`flex justify-between ${getVarianceColor(
                      calculatedCosts.analysis.materialVariance
                    )}`}
                  >
                    <span>NVL:</span>
                    <span className="font-semibold">
                      {calculatedCosts.analysis.materialVariance >= 0
                        ? "+"
                        : ""}
                      {formatCurrency(
                        calculatedCosts.analysis.materialVariance
                      )}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between ${getVarianceColor(
                      calculatedCosts.analysis.additionalCostsVariance
                    )}`}
                  >
                    <span>Chi phí khác:</span>
                    <span className="font-semibold">
                      {calculatedCosts.analysis.additionalCostsVariance >= 0
                        ? "+"
                        : ""}
                      {formatCurrency(
                        calculatedCosts.analysis.additionalCostsVariance
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profitability Insights */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <h4 className="font-medium text-slate-800 dark:text-slate-100 mb-2">
                  💡 Phân tích
                </h4>
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  {calculatedCosts.analysis.variance > 0 ? (
                    <p>
                      Chi phí thực tế cao hơn ước tính{" "}
                      {formatCurrency(
                        Math.abs(calculatedCosts.analysis.variance)
                      )}
                      . Cần xem xét tối ưu hóa quy trình.
                    </p>
                  ) : calculatedCosts.analysis.variance < 0 ? (
                    <p>
                      Tiết kiệm được{" "}
                      {formatCurrency(
                        Math.abs(calculatedCosts.analysis.variance)
                      )}{" "}
                      so với ước tính. Hiệu suất sản xuất tốt!
                    </p>
                  ) : (
                    <p>
                      Chi phí thực tế khớp với ước tính. Kế hoạch tài chính
                      chính xác!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t dark:border-slate-700 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors font-medium"
          >
            💾 Lưu phân tích chi phí
          </button>
        </div>
      </div>
    </div>
  );
};

export default CostAnalysisModal;
