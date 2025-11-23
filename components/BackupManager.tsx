import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createBackupService } from "../lib/services/BackupService";
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ClockIcon,
  DocumentArrowDownIcon,
  XMarkIcon,
} from "./common/Icons";

interface BackupManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BackupManager: React.FC<BackupManagerProps> = ({ isOpen, onClose }) => {
  const ctx = usePinContext();
  const backupService = createBackupService(ctx);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleExportJSON = async () => {
    try {
      setIsExporting(true);
      await backupService.exportToJSON();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setIsExporting(true);
      await backupService.exportToExcel();
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      await backupService.importFromJSON(file);
    } catch (error) {
      console.error("Import failed:", error);
    } finally {
      setIsImporting(false);
      e.target.value = ""; // Reset input
    }
  };

  const handleAutoBackup = async () => {
    await backupService.createAutoBackup();
    ctx.addToast?.({
      type: "success",
      title: "Sao lưu tự động",
      message: "Đã tạo bản sao lưu tự động",
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-zoom-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
              📦 Quản lý Sao lưu
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sao lưu và khôi phục dữ liệu hệ thống
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Export Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <ArrowDownTrayIcon className="w-5 h-5" />
              Xuất dữ liệu (Export)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Export JSON */}
              <button
                onClick={handleExportJSON}
                disabled={isExporting}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <DocumentArrowDownIcon className="w-12 h-12 text-blue-500 mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    Xuất JSON
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Toàn bộ dữ liệu (có thể import lại)
                  </div>
                </div>
              </button>

              {/* Export Excel */}
              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-emerald-300 dark:border-emerald-700 rounded-xl hover:border-emerald-500 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <DocumentArrowDownIcon className="w-12 h-12 text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <div className="font-semibold text-slate-700 dark:text-slate-200">
                    Xuất Excel (CSV)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Nhiều file CSV (dễ đọc)
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Import Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <ArrowUpTrayIcon className="w-5 h-5" />
              Nhập dữ liệu (Import)
            </h3>

            <div className="border-2 border-dashed border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:border-amber-500 dark:hover:border-amber-500 transition-all">
              <label className="flex flex-col items-center justify-center cursor-pointer group">
                <ArrowUpTrayIcon className="w-12 h-12 text-amber-500 mb-3 group-hover:scale-110 transition-transform" />
                <div className="text-center">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    {isImporting ? "Đang nhập..." : "Khôi phục từ file JSON"}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    ⚠️ Dữ liệu hiện tại sẽ bị ghi đè
                  </div>
                </div>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Auto Backup Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2">
              <ClockIcon className="w-5 h-5" />
              Sao lưu tự động
            </h3>

            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-medium text-slate-700 dark:text-slate-200">
                    Sao lưu nhanh
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Lưu vào LocalStorage (tối đa 7 bản)
                  </div>
                </div>
                <button
                  onClick={handleAutoBackup}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium text-sm"
                >
                  Sao lưu ngay
                </button>
              </div>

              <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                💡 <strong>Lưu ý:</strong> Sao lưu tự động chỉ lưu trên trình
                duyệt này. Để sao lưu an toàn, hãy xuất ra file JSON và lưu vào
                máy tính.
              </div>
            </div>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">
              ℹ️ Thông tin quan trọng
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1 list-disc list-inside">
              <li>File JSON chứa toàn bộ dữ liệu và có thể import lại</li>
              <li>File CSV dễ đọc nhưng không thể import lại</li>
              <li>Nên sao lưu định kỳ để tránh mất dữ liệu</li>
              <li>Import sẽ ghi đè dữ liệu hiện tại, hãy cẩn thận</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default BackupManager;
