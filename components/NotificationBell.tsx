import React, { useState, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import { createNotificationService } from "../lib/services/NotificationService";
import type { Notification } from "../lib/services/NotificationService";
import { BellIcon, XMarkIcon, CheckIcon, TrashIcon } from "./common/Icons";
import { useNavigate } from "react-router-dom";

const NotificationBell: React.FC = () => {
  const ctx = usePinContext();
  const navigate = useNavigate();
  const notificationService = createNotificationService(ctx);

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for new notifications every 30 seconds
  useEffect(() => {
    const checkNotifications = () => {
      // Check low stock
      const lowStockNotifs = notificationService.checkLowStock();
      lowStockNotifs.forEach((n) => notificationService.addNotification(n));

      // Check debt overdue
      const debtNotifs = notificationService.checkDebtOverdue();
      debtNotifs.forEach((n) => notificationService.addNotification(n));

      // Update UI
      updateNotifications();
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [ctx.pinMaterials, ctx.pinProducts, ctx.pinSales, ctx.pinRepairOrders]);

  const updateNotifications = () => {
    const allNotifs = notificationService.getAllNotifications();
    setNotifications(allNotifs);
    setUnreadCount(notificationService.getUnreadCount());
  };

  const handleMarkAsRead = (id: string) => {
    notificationService.markAsRead(id);
    updateNotifications();
  };

  const handleMarkAllAsRead = () => {
    notificationService.markAllAsRead();
    updateNotifications();
  };

  const handleClearAll = () => {
    if (confirm("Xóa tất cả thông báo?")) {
      notificationService.clearAll();
      updateNotifications();
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    setIsOpen(false);
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
    }
  };

  const getSeverityColor = (severity: Notification["severity"]) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-800 dark:text-red-300";
      case "high":
        return "bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-700 text-orange-800 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300";
      default:
        return "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300";
    }
  };

  const getTypeIcon = (type: Notification["type"]) => {
    switch (type) {
      case "low_stock":
        return "📦";
      case "debt_overdue":
        return "💰";
      case "production_complete":
        return "✅";
      default:
        return "ℹ️";
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <BellIcon className="w-6 h-6 text-slate-600 dark:text-slate-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 animate-slide-in-top">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <BellIcon className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                <h3 className="font-semibold text-slate-800 dark:text-slate-100">
                  Thông báo
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <>
                    <button
                      onClick={handleMarkAllAsRead}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Đánh dấu tất cả đã đọc"
                    >
                      <CheckIcon className="w-4 h-4 text-slate-500" />
                    </button>
                    <button
                      onClick={handleClearAll}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      title="Xóa tất cả"
                    >
                      <TrashIcon className="w-4 h-4 text-slate-500" />
                    </button>
                  </>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <XMarkIcon className="w-4 h-4 text-slate-500" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                  <BellIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="font-medium">Không có thông báo</p>
                  <p className="text-sm mt-1">Bạn đã xem hết thông báo</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => handleNotificationClick(notification)}
                      className={`p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors ${
                        !notification.read
                          ? "bg-blue-50 dark:bg-blue-900/10"
                          : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-2xl flex-shrink-0">
                          {getTypeIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full border ${getSeverityColor(
                                notification.severity
                              )}`}
                            >
                              {notification.severity === "critical"
                                ? "Nguy hiểm"
                                : notification.severity === "high"
                                ? "Cao"
                                : notification.severity === "medium"
                                ? "Trung bình"
                                : "Thấp"}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {new Date(notification.timestamp).toLocaleString(
                                "vi-VN",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  day: "2-digit",
                                  month: "2-digit",
                                }
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationBell;
