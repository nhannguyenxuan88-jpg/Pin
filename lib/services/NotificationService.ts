import type { PinContextType } from "../../contexts/types";
import type { PinMaterial, PinProduct } from "../../types";

export interface Notification {
  id: string;
  type: "low_stock" | "debt_overdue" | "production_complete" | "info";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionUrl?: string;
  data?: any;
}

export interface NotificationSettings {
  lowStockThreshold: number; // Phần trăm tồn kho cảnh báo (mặc định 20%)
  criticalStockThreshold: number; // Phần trăm tồn kho nguy hiểm (mặc định 10%)
  enableLowStockAlerts: boolean;
  enableDebtAlerts: boolean;
  enableProductionAlerts: boolean;
  soundEnabled: boolean;
}

export interface NotificationService {
  checkLowStock: () => Notification[];
  checkDebtOverdue: () => Notification[];
  addNotification: (
    notification: Omit<Notification, "id" | "timestamp">
  ) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  getUnreadCount: () => number;
  getAllNotifications: () => Notification[];
  clearAll: () => void;
  getSettings: () => NotificationSettings;
  updateSettings: (settings: Partial<NotificationSettings>) => void;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  lowStockThreshold: 20,
  criticalStockThreshold: 10,
  enableLowStockAlerts: true,
  enableDebtAlerts: true,
  enableProductionAlerts: true,
  soundEnabled: true,
};

export function createNotificationService(
  ctx: PinContextType
): NotificationService {
  const STORAGE_KEY = "pincorp-notifications";
  const SETTINGS_KEY = "pincorp-notification-settings";

  const loadNotifications = (): Notification[] => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  };

  const saveNotifications = (notifications: Notification[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch (error) {
      console.error("Failed to save notifications:", error);
    }
  };

  const loadSettings = (): NotificationSettings => {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      return data
        ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) }
        : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  };

  const saveSettings = (settings: NotificationSettings) => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  };

  const playNotificationSound = () => {
    const settings = loadSettings();
    if (!settings.soundEnabled) return;

    // Tạo âm thanh thông báo đơn giản
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.error("Failed to play notification sound:", error);
    }
  };

  return {
    checkLowStock: () => {
      const settings = loadSettings();
      if (!settings.enableLowStockAlerts) return [];

      const notifications: Notification[] = [];
      const materials = ctx.pinMaterials || [];

      materials.forEach((material: PinMaterial) => {
        // Bỏ qua nếu không có stock hoặc đang committed
        if (material.stock <= 0) return;

        const availableStock =
          material.stock - (material.committedQuantity || 0);
        const stockPercentage = (availableStock / material.stock) * 100;

        let severity: Notification["severity"] | null = null;
        let message = "";

        if (stockPercentage <= settings.criticalStockThreshold) {
          severity = "critical";
          message = `Tồn kho NGUY HIỂM: ${material.name} (${material.sku}) chỉ còn ${availableStock} ${material.unit}`;
        } else if (stockPercentage <= settings.lowStockThreshold) {
          severity = "high";
          message = `Tồn kho thấp: ${material.name} (${material.sku}) còn ${availableStock} ${material.unit}`;
        }

        if (severity) {
          notifications.push({
            id: `low-stock-${material.id}-${Date.now()}`,
            type: "low_stock",
            severity,
            title: "Cảnh báo tồn kho",
            message,
            timestamp: new Date().toISOString(),
            read: false,
            actionUrl: "/materials",
            data: { materialId: material.id, material },
          });
        }
      });

      // Check products
      const products = ctx.pinProducts || [];
      products.forEach((product: PinProduct) => {
        const qty = (product as any).quantity || (product as any).stock || 0;
        if (qty <= 0) return;

        // Giả sử ngưỡng cho sản phẩm là 5 cái
        if (qty <= 5 && qty > 0) {
          notifications.push({
            id: `low-stock-product-${product.id}-${Date.now()}`,
            type: "low_stock",
            severity: qty <= 2 ? "critical" : "high",
            title: "Cảnh báo tồn kho thành phẩm",
            message: `Sản phẩm ${product.name} (${product.sku}) chỉ còn ${qty} cái`,
            timestamp: new Date().toISOString(),
            read: false,
            actionUrl: "/products",
            data: { productId: product.id, product },
          });
        }
      });

      return notifications;
    },

    checkDebtOverdue: () => {
      const settings = loadSettings();
      if (!settings.enableDebtAlerts) return [];

      const notifications: Notification[] = [];
      const sales = ctx.pinSales || [];
      const now = new Date();

      sales.forEach((sale: any) => {
        const paymentStatus = (sale as any).paymentStatus;
        const dueDate = (sale as any).dueDate;

        if (
          (paymentStatus === "partial" || paymentStatus === "debt") &&
          dueDate
        ) {
          const due = new Date(dueDate);
          const daysOverdue = Math.floor(
            (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysOverdue > 0) {
            notifications.push({
              id: `debt-overdue-${sale.id}-${Date.now()}`,
              type: "debt_overdue",
              severity: daysOverdue > 7 ? "critical" : "high",
              title: "Công nợ quá hạn",
              message: `Đơn hàng ${(sale as any).code || sale.id} của ${
                sale.customer.name
              } đã quá hạn ${daysOverdue} ngày`,
              timestamp: new Date().toISOString(),
              read: false,
              actionUrl: "/receivables",
              data: { saleId: sale.id, sale, daysOverdue },
            });
          }
        }
      });

      // Check repair orders
      const repairOrders = ctx.pinRepairOrders || [];
      repairOrders.forEach((order: any) => {
        if (
          (order.paymentStatus === "partial" ||
            order.paymentStatus === "unpaid") &&
          order.paymentDate
        ) {
          const due = new Date(order.paymentDate);
          const daysOverdue = Math.floor(
            (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysOverdue > 0) {
            notifications.push({
              id: `repair-debt-overdue-${order.id}-${Date.now()}`,
              type: "debt_overdue",
              severity: daysOverdue > 7 ? "critical" : "high",
              title: "Công nợ sửa chữa quá hạn",
              message: `Phiếu sửa chữa ${order.id} của ${order.customerName} đã quá hạn ${daysOverdue} ngày`,
              timestamp: new Date().toISOString(),
              read: false,
              actionUrl: "/repairs",
              data: { repairId: order.id, order, daysOverdue },
            });
          }
        }
      });

      return notifications;
    },

    addNotification: (notification) => {
      const notifications = loadNotifications();
      const newNotification: Notification = {
        ...notification,
        id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        read: false,
      };

      notifications.unshift(newNotification);

      // Chỉ giữ 100 thông báo gần nhất
      if (notifications.length > 100) {
        notifications.splice(100);
      }

      saveNotifications(notifications);
      playNotificationSound();

      // Show toast for important notifications
      if (
        newNotification.severity === "critical" ||
        newNotification.severity === "high"
      ) {
        ctx.addToast?.({
          type: newNotification.severity === "critical" ? "error" : "warn",
          title: newNotification.title,
          message: newNotification.message,
        });
      }
    },

    markAsRead: (id) => {
      const notifications = loadNotifications();
      const notification = notifications.find((n) => n.id === id);
      if (notification) {
        notification.read = true;
        saveNotifications(notifications);
      }
    },

    markAllAsRead: () => {
      const notifications = loadNotifications();
      notifications.forEach((n) => (n.read = true));
      saveNotifications(notifications);
    },

    getUnreadCount: () => {
      const notifications = loadNotifications();
      return notifications.filter((n) => !n.read).length;
    },

    getAllNotifications: () => {
      return loadNotifications();
    },

    clearAll: () => {
      saveNotifications([]);
    },

    getSettings: () => {
      return loadSettings();
    },

    updateSettings: (settings) => {
      const current = loadSettings();
      const updated = { ...current, ...settings };
      saveSettings(updated);
    },
  };
}
