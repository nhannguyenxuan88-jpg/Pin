/**
 * Audit Log Service
 * Tracks all CRUD operations and user activities
 */

import type { PinContextType } from "../../contexts/types";

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: "create" | "read" | "update" | "delete" | "export" | "import";
  entity: string; // "material", "product", "sale", "repair", etc.
  entityId: string;
  entityName?: string;
  changes?: {
    before?: any;
    after?: any;
  };
  metadata?: any;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilter {
  userId?: string;
  action?: AuditLog["action"];
  entity?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchQuery?: string;
}

export interface AuditLogService {
  log: (log: Omit<AuditLog, "id" | "timestamp">) => void;
  getLogs: (filter?: AuditLogFilter, limit?: number) => AuditLog[];
  getLogById: (id: string) => AuditLog | null;
  getLogsByEntity: (entity: string, entityId: string) => AuditLog[];
  getUserActivity: (userId: string, limit?: number) => AuditLog[];
  getRecentActivity: (limit?: number) => AuditLog[];
  clearOldLogs: (daysToKeep?: number) => void;
  exportLogs: (filter?: AuditLogFilter) => void;
  getStatistics: () => {
    totalLogs: number;
    byAction: Record<string, number>;
    byEntity: Record<string, number>;
    byUser: Record<string, number>;
    recentActivity: AuditLog[];
  };
}

export function createAuditLogService(ctx: PinContextType): AuditLogService {
  const STORAGE_KEY = "pincorp-audit-logs";
  const MAX_LOGS = 10000; // Giữ tối đa 10k logs

  const loadLogs = (): AuditLog[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to load audit logs:", error);
      return [];
    }
  };

  const saveLogs = (logs: AuditLog[]) => {
    try {
      // Chỉ giữ MAX_LOGS logs gần nhất
      const toSave = logs.slice(0, MAX_LOGS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (error) {
      console.error("Failed to save audit logs:", error);
    }
  };

  const getUserInfo = () => {
    const user = ctx.currentUser;
    return {
      userId: user?.id || "unknown",
      userName: user?.email || "Unknown User",
    };
  };

  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      // IP address cần backend API để lấy chính xác
      ipAddress: "client-side", // Placeholder
    };
  };

  return {
    log: (logData) => {
      const logs = loadLogs();
      const userInfo = getUserInfo();
      const browserInfo = getBrowserInfo();

      const newLog: AuditLog = {
        id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        ...userInfo,
        ...browserInfo,
        ...logData,
      };

      logs.unshift(newLog);
      saveLogs(logs);

      // Log to console in development
      if (process.env.NODE_ENV === "development") {
        console.log("[Audit]", newLog.action, newLog.entity, newLog.entityId);
      }
    },

    getLogs: (filter, limit = 100) => {
      let logs = loadLogs();

      // Apply filters
      if (filter) {
        if (filter.userId) {
          logs = logs.filter((log) => log.userId === filter.userId);
        }
        if (filter.action) {
          logs = logs.filter((log) => log.action === filter.action);
        }
        if (filter.entity) {
          logs = logs.filter((log) => log.entity === filter.entity);
        }
        if (filter.dateFrom) {
          logs = logs.filter(
            (log) => new Date(log.timestamp) >= filter.dateFrom!
          );
        }
        if (filter.dateTo) {
          logs = logs.filter(
            (log) => new Date(log.timestamp) <= filter.dateTo!
          );
        }
        if (filter.searchQuery) {
          const query = filter.searchQuery.toLowerCase();
          logs = logs.filter(
            (log) =>
              log.entityName?.toLowerCase().includes(query) ||
              log.action.toLowerCase().includes(query) ||
              log.entity.toLowerCase().includes(query) ||
              log.userName.toLowerCase().includes(query)
          );
        }
      }

      return logs.slice(0, limit);
    },

    getLogById: (id) => {
      const logs = loadLogs();
      return logs.find((log) => log.id === id) || null;
    },

    getLogsByEntity: (entity, entityId) => {
      const logs = loadLogs();
      return logs.filter(
        (log) => log.entity === entity && log.entityId === entityId
      );
    },

    getUserActivity: (userId, limit = 50) => {
      const logs = loadLogs();
      return logs.filter((log) => log.userId === userId).slice(0, limit);
    },

    getRecentActivity: (limit = 20) => {
      const logs = loadLogs();
      return logs.slice(0, limit);
    },

    clearOldLogs: (daysToKeep = 90) => {
      const logs = loadLogs();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const filtered = logs.filter(
        (log) => new Date(log.timestamp) >= cutoffDate
      );

      saveLogs(filtered);

      ctx.addToast?.({
        type: "success",
        title: "Đã xóa logs cũ",
        message: `Đã xóa ${
          logs.length - filtered.length
        } logs cũ hơn ${daysToKeep} ngày`,
      });
    },

    exportLogs: (filter) => {
      try {
        const logs = filter
          ? loadLogs().filter((log) => {
              if (filter.userId && log.userId !== filter.userId) return false;
              if (filter.action && log.action !== filter.action) return false;
              if (filter.entity && log.entity !== filter.entity) return false;
              if (filter.dateFrom && new Date(log.timestamp) < filter.dateFrom)
                return false;
              if (filter.dateTo && new Date(log.timestamp) > filter.dateTo)
                return false;
              return true;
            })
          : loadLogs();

        const blob = new Blob([JSON.stringify(logs, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const timestamp = new Date().toISOString().split("T")[0];
        a.download = `audit-logs-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        ctx.addToast?.({
          type: "success",
          title: "Xuất audit logs thành công",
          message: `Đã xuất ${logs.length} logs`,
        });
      } catch (error: any) {
        ctx.addToast?.({
          type: "error",
          title: "Lỗi xuất logs",
          message: error?.message || String(error),
        });
      }
    },

    getStatistics: () => {
      const logs = loadLogs();

      const byAction: Record<string, number> = {};
      const byEntity: Record<string, number> = {};
      const byUser: Record<string, number> = {};

      logs.forEach((log) => {
        byAction[log.action] = (byAction[log.action] || 0) + 1;
        byEntity[log.entity] = (byEntity[log.entity] || 0) + 1;
        byUser[log.userName] = (byUser[log.userName] || 0) + 1;
      });

      return {
        totalLogs: logs.length,
        byAction,
        byEntity,
        byUser,
        recentActivity: logs.slice(0, 10),
      };
    },
  };
}
