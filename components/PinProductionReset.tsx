/**
 * PIN Corp Production Reset Component
 * Giao diện để xóa hết dữ liệu demo và chuẩn bị production
 */

import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import {
  ResetDataOptions,
  DEFAULT_RESET_OPTIONS,
  validateResetOptions,
  createBackupBeforeReset,
  getDataStats,
} from "../lib/utils/dataReset";
import {
  ExclamationTriangleIcon as WarningIcon,
  TrashIcon,
  XMarkIcon as XIcon,
  DocumentTextIcon as BackupIcon,
} from "./common/Icons";

const PinProductionReset: React.FC = () => {
  const {
    pinMaterials,
    pinBOMs,
    productionOrders,
    pinProducts,
    pinCustomers,
    pinSales,
    pinRepairOrders,
    pinCartItems,
    fixedAssets,
    capitalInvestments,
    cashTransactions,
    resetProductionData,
    addToast,
    currentUser,
  } = usePinContext();

  const [resetOptions, setResetOptions] = useState<ResetDataOptions>(
    DEFAULT_RESET_OPTIONS
  );
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  // Tính toán stats
  const dataStats = getDataStats({
    pinMaterials,
    pinBOMs,
    productionOrders,
    pinProducts,
    pinCustomers,
    pinSales,
    pinRepairOrders,
    pinCartItems,
    fixedAssets,
    capitalInvestments,
    cashTransactions,
  });

  const warnings = validateResetOptions(resetOptions);
  const totalRecords = Object.values(dataStats).reduce(
    (sum, count) => sum + count,
    0
  );

  const handleOptionChange = (key: keyof ResetDataOptions) => {
    setResetOptions((prev: ResetDataOptions) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const executeReset = async () => {
    console.log("🚀 executeReset called", { confirmText, resetOptions });

    if (confirmText !== "RESET PIN CORP DATA") {
      console.log("❌ Confirm text mismatch:", confirmText);
      addToast({
        id: Date.now().toString(),
        message: 'Vui lòng nhập chính xác "RESET PIN CORP DATA"',
        type: "error",
      });
      return;
    }

    setIsResetting(true);
    console.log("⏳ Starting reset process...");

    try {
      // Tạo backup timestamp
      const backupName = new Date().toISOString().replace(/[:.]/g, "-");

      console.log("🔄 Starting database reset...", resetOptions);

      // Sử dụng function reset thật sự từ database
      await resetProductionData(
        resetOptions as unknown as Record<string, boolean>
      );

      console.log("✅ Reset completed successfully");

      setShowConfirmDialog(false);
      setConfirmText("");
    } catch (error) {
      console.error("❌ Reset error:", error);

      addToast({
        id: Date.now().toString(),
        title: "Lỗi reset",
        message: `❌ Lỗi khi reset dữ liệu: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        type: "error",
      });
    } finally {
      setIsResetting(false);
    }
  };

  if (!currentUser || !currentUser.departmentIds?.includes("dept_admin")) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <div className="flex items-center">
            <XIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <span className="text-red-800 dark:text-red-200">
              Chỉ Admin mới có quyền reset dữ liệu
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-lg">
            <TrashIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              🚀 Production Reset - PIN Corp
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Xóa hết dữ liệu demo để triển khai thực tế
            </p>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 dark:bg-yellow-900/50 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
        <div className="flex items-start space-x-3">
          <WarningIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
          <div>
            <h3 className="text-yellow-800 dark:text-yellow-200 font-medium">
              ⚠️ Cảnh báo quan trọng
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 mt-1">
              Thao tác này sẽ xóa vĩnh viễn dữ liệu demo. Hãy chắc chắn bạn đã
              backup nếu cần.
            </p>
          </div>
        </div>
      </div>

      {/* Data Statistics */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          📊 Thống kê Dữ liệu Hiện tại
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(dataStats).map(([key, count]) => (
            <div
              key={key}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
            >
              <div className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {count}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Tổng cộng:{" "}
            <span className="font-bold text-gray-900 dark:text-white">
              {totalRecords}
            </span>{" "}
            records
          </div>
        </div>
      </div>

      {/* Reset Options */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🎛️ Tùy chọn Reset
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(resetOptions).map(([key, value]) => {
            if (key === "confirmReset") return null;
            return (
              <label
                key={key}
                className="flex items-center space-x-3 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={value as boolean}
                  onChange={() =>
                    handleOptionChange(key as keyof ResetDataOptions)
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-700 dark:text-gray-300 capitalize">
                  {key.replace(/([A-Z])/g, " $1").trim()}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({dataStats[key as keyof typeof dataStats]} items)
                </span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-lg p-4">
          <h3 className="text-red-800 dark:text-red-200 font-medium mb-2">
            ⚠️ Cảnh báo
          </h3>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li
                key={index}
                className="text-red-700 dark:text-red-300 text-sm"
              >
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex space-x-4">
        <button
          onClick={() => {
            console.log("🖱️ Reset button clicked!", {
              resetOptions,
              totalRecords,
              addToast: !!addToast,
            });
            // Test addToast function
            addToast({
              id: Date.now().toString(),
              message: "Test toast - Reset button clicked!",
              type: "info",
            });
            setShowConfirmDialog(true);
          }}
          disabled={isResetting || totalRecords === 0}
          className="flex items-center space-x-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
        >
          <TrashIcon className="w-5 h-5" />
          <span>🗑️ Reset Dữ liệu Production</span>
        </button>

        <button
          onClick={() => setResetOptions(DEFAULT_RESET_OPTIONS)}
          className="flex items-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          <BackupIcon className="w-5 h-5" />
          <span>Reset Options</span>
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-md p-6">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
                <WarningIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Xác nhận Reset Dữ liệu
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Thao tác này không thể hoàn tác. Nhập chính xác text bên dưới để
                xác nhận:
              </p>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg mb-4">
                <code className="text-red-600 dark:text-red-400 font-mono">
                  RESET PIN CORP DATA
                </code>
              </div>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Nhập text xác nhận..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white mb-4"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmDialog(false);
                    setConfirmText("");
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-500"
                >
                  Hủy
                </button>
                <button
                  onClick={() => {
                    console.log("💥 Confirm reset clicked!", {
                      confirmText,
                      resetOptions,
                    });
                    executeReset();
                  }}
                  disabled={
                    confirmText !== "RESET PIN CORP DATA" || isResetting
                  }
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isResetting ? "⏳ Đang reset..." : "💥 XÁC NHẬN RESET"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinProductionReset;
