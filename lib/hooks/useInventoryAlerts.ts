/**
 * Inventory Alerts Hook
 * Detect low stock and expiring inventory items
 */

import { useMemo } from "react";
import type { Part } from "../../types";

export interface InventoryAlert {
  id: string;
  partId: string;
  partName: string;
  type: "low_stock" | "out_of_stock" | "expiring_soon" | "expired";
  severity: "critical" | "warning" | "info";
  message: string;
  currentStock?: number;
  minStock?: number;
  expiryDate?: string;
  daysUntilExpiry?: number;
}

interface UseInventoryAlertsOptions {
  lowStockThreshold?: number; // Default: use part.min_stock
  expiringSoonDays?: number; // Default: 30 days
}

/**
 * Hook to get inventory alerts for parts
 */
export function useInventoryAlerts(
  parts: Part[],
  options: UseInventoryAlertsOptions = {}
): InventoryAlert[] {
  const { expiringSoonDays = 30 } = options;

  return useMemo(() => {
    const alerts: InventoryAlert[] = [];
    const today = new Date();
    const expiryThreshold = new Date(today);
    expiryThreshold.setDate(today.getDate() + expiringSoonDays);

    parts.forEach((part) => {
      const stock = part.stock || 0;
      const minStock = part.min_stock || 0;

      // Check out of stock
      if (stock === 0) {
        alerts.push({
          id: `out_of_stock_${part.id}`,
          partId: part.id,
          partName: part.name,
          type: "out_of_stock",
          severity: "critical",
          message: `Hết hàng: ${part.name}`,
          currentStock: stock,
          minStock: minStock,
        });
      }
      // Check low stock (but not zero)
      else if (minStock > 0 && stock <= minStock && stock > 0) {
        alerts.push({
          id: `low_stock_${part.id}`,
          partId: part.id,
          partName: part.name,
          type: "low_stock",
          severity: stock <= minStock / 2 ? "critical" : "warning",
          message: `Sắp hết hàng: ${part.name} (còn ${stock}/${minStock})`,
          currentStock: stock,
          minStock: minStock,
        });
      }

      // Check expiry date
      if (part.expiry_date) {
        const expiryDate = new Date(part.expiry_date);
        const daysUntilExpiry = Math.floor(
          (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysUntilExpiry < 0) {
          // Expired
          alerts.push({
            id: `expired_${part.id}`,
            partId: part.id,
            partName: part.name,
            type: "expired",
            severity: "critical",
            message: `Đã hết hạn: ${part.name} (hết hạn ${Math.abs(
              daysUntilExpiry
            )} ngày trước)`,
            expiryDate: part.expiry_date,
            daysUntilExpiry,
            currentStock: stock,
          });
        } else if (daysUntilExpiry <= expiringSoonDays) {
          // Expiring soon
          alerts.push({
            id: `expiring_soon_${part.id}`,
            partId: part.id,
            partName: part.name,
            type: "expiring_soon",
            severity: daysUntilExpiry <= 7 ? "critical" : "warning",
            message: `Sắp hết hạn: ${part.name} (còn ${daysUntilExpiry} ngày)`,
            expiryDate: part.expiry_date,
            daysUntilExpiry,
            currentStock: stock,
          });
        }
      }
    });

    // Sort by severity (critical first, then warning)
    return alerts.sort((a, b) => {
      if (a.severity === b.severity) return 0;
      return a.severity === "critical" ? -1 : 1;
    });
  }, [parts, expiringSoonDays]);
}

/**
 * Get summary statistics for alerts
 */
export function getAlertStats(alerts: InventoryAlert[]) {
  return {
    total: alerts.length,
    critical: alerts.filter((a) => a.severity === "critical").length,
    warning: alerts.filter((a) => a.severity === "warning").length,
    outOfStock: alerts.filter((a) => a.type === "out_of_stock").length,
    lowStock: alerts.filter((a) => a.type === "low_stock").length,
    expired: alerts.filter((a) => a.type === "expired").length,
    expiringSoon: alerts.filter((a) => a.type === "expiring_soon").length,
  };
}
