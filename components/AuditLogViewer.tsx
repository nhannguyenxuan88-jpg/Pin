import React, { useState, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createAuditLogService } from "../lib/services/AuditLogService";
import type { AuditLog, AuditLogFilter } from "../lib/services/AuditLogService";
import { Card } from "./ui/Card";
import { Icon } from "./common/Icon";
import { format } from "date-fns";

const AuditLogViewer: React.FC = () => {
  const ctx = usePinContext();
  const auditLogService = createAuditLogService(ctx);

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<AuditLogFilter>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    loadLogs();
  }, [filter, searchQuery]);

  const loadLogs = () => {
    const filterWithSearch = { ...filter, searchQuery };
    const result = auditLogService.getLogs(filterWithSearch, 100);
    setLogs(result);
  };

  const stats = auditLogService.getStatistics();

  const getActionIcon = (action: AuditLog["action"]) => {
    switch (action) {
      case "create":
        return "🆕";
      case "read":
        return "👁️";
      case "update":
        return "✏️";
      case "delete":
        return "🗑️";
      case "export":
        return "📤";
      case "import":
        return "📥";
      default:
        return "📝";
    }
  };

  const getActionColor = (action: AuditLog["action"]) => {
    switch (action) {
      case "create":
        return "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800";
      case "read":
        return "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "update":
        return "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case "delete":
        return "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800";
      case "export":
      case "import":
        return "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      default:
        return "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600";
    }
  };

  const handleExport = () => {
    auditLogService.exportLogs(filter);
  };

  const handleClearOld = () => {
    if (confirm("Xóa tất cả logs cũ hơn 90 ngày?")) {
      auditLogService.clearOldLogs(90);
      loadLogs();
    }
  };

  return (
    <div className="space-y-6 p-4 lg:p-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 dark:text-slate-100">
            📝 Audit Logs
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Lịch sử hoạt động và thay đổi dữ liệu
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
          >
            {showStats ? "Ẩn thống kê" : "Xem thống kê"}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-colors"
          >
            📤 Xuất logs
          </button>
          <button
            onClick={handleClearOld}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
          >
            🗑️ Xóa cũ
          </button>
        </div>
      </div>

      {/* Statistics */}
      {showStats && (
        <Card>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
              📊 Thống kê
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="text-sm text-blue-700 dark:text-blue-300 mb-1">
                  Tổng số logs
                </div>
                <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
                  {stats.totalLogs.toLocaleString()}
                </div>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <div className="text-sm text-emerald-700 dark:text-emerald-300 mb-2">
                  Theo hành động
                </div>
                <div className="space-y-1">
                  {Object.entries(stats.byAction).map(([action, count]) => (
                    <div
                      key={action}
                      className="flex justify-between text-xs text-emerald-700 dark:text-emerald-300"
                    >
                      <span className="capitalize">{action}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                <div className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                  Theo module
                </div>
                <div className="space-y-1">
                  {Object.entries(stats.byEntity)
                    .slice(0, 5)
                    .map(([entity, count]) => (
                      <div
                        key={entity}
                        className="flex justify-between text-xs text-purple-700 dark:text-purple-300"
                      >
                        <span className="capitalize">{entity}</span>
                        <span className="font-semibold">{count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tìm kiếm
              </label>
              <div className="relative">
                <Icon
                  name="search"
                  size="md"
                  tone="muted"
                  className="absolute left-3 top-1/2 -translate-y-1/2"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm theo tên, hành động..."
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Hành động
              </label>
              <select
                value={filter.action || ""}
                onChange={(e) =>
                  setFilter({
                    ...filter,
                    action: e.target.value as any,
                  })
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="">Tất cả</option>
                <option value="create">Tạo mới</option>
                <option value="read">Xem</option>
                <option value="update">Cập nhật</option>
                <option value="delete">Xóa</option>
                <option value="export">Xuất</option>
                <option value="import">Nhập</option>
              </select>
            </div>

            {/* Entity Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Module
              </label>
              <select
                value={filter.entity || ""}
                onChange={(e) =>
                  setFilter({ ...filter, entity: e.target.value })
                }
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
              >
                <option value="">Tất cả</option>
                <option value="material">Nguyên liệu</option>
                <option value="product">Sản phẩm</option>
                <option value="sale">Bán hàng</option>
                <option value="repair">Sửa chữa</option>
                <option value="production">Sản xuất</option>
                <option value="customer">Khách hàng</option>
                <option value="supplier">Nhà cung cấp</option>
              </select>
            </div>

            {/* Clear Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilter({});
                  setSearchQuery("");
                }}
                className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Xóa bộ lọc
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Logs Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Thời gian
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Người dùng
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Hành động
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Module
                </th>
                <th className="text-left p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Chi tiết
                </th>
                <th className="text-center p-4 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Không có logs
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {format(new Date(log.timestamp), "dd/MM/yyyy HH:mm:ss")}
                    </td>
                    <td className="p-4 text-sm text-slate-700 dark:text-slate-300">
                      {log.userName}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getActionColor(
                          log.action
                        )}`}
                      >
                        {getActionIcon(log.action)}
                        <span className="capitalize">{log.action}</span>
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400 capitalize">
                      {log.entity}
                    </td>
                    <td className="p-4 text-sm text-slate-600 dark:text-slate-400">
                      {log.entityName || log.entityId}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {logs.length > 0 && (
          <div className="p-4 border-t border-slate-200 dark:border-slate-700 text-center text-sm text-slate-600 dark:text-slate-400">
            Hiển thị {logs.length} logs gần nhất
          </div>
        )}
      </Card>

      {/* Log Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                Chi tiết Log
              </h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <Icon name="close" size="md" tone="muted" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  ID
                </label>
                <div className="mt-1 text-slate-800 dark:text-slate-200 font-mono text-sm">
                  {selectedLog.id}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Thời gian
                </label>
                <div className="mt-1 text-slate-800 dark:text-slate-200">
                  {format(
                    new Date(selectedLog.timestamp),
                    "dd/MM/yyyy HH:mm:ss"
                  )}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Người dùng
                </label>
                <div className="mt-1 text-slate-800 dark:text-slate-200">
                  {selectedLog.userName} ({selectedLog.userId})
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Hành động
                </label>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getActionColor(
                      selectedLog.action
                    )}`}
                  >
                    {getActionIcon(selectedLog.action)}
                    <span className="capitalize">{selectedLog.action}</span>
                  </span>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  Module / Entity
                </label>
                <div className="mt-1 text-slate-800 dark:text-slate-200">
                  {selectedLog.entity} -{" "}
                  {selectedLog.entityName || selectedLog.entityId}
                </div>
              </div>

              {selectedLog.changes && (
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Thay đổi
                  </label>
                  <div className="mt-2 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg">
                    <pre className="text-xs text-slate-700 dark:text-slate-300 overflow-auto max-h-60">
                      {JSON.stringify(selectedLog.changes, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">
                  User Agent
                </label>
                <div className="mt-1 text-xs text-slate-600 dark:text-slate-400 break-all">
                  {selectedLog.userAgent}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 p-4 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-6 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors font-medium"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogViewer;
