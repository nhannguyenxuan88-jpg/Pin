/**
 * Service Reminders Hook
 * Calculate when customers need maintenance based on:
 * - Time since last service (3, 6, 12 months)
 * - Estimated mileage (if tracked)
 * - Service history patterns
 */

import { useMemo } from "react";
import type { Customer, WorkOrder } from "../../types";

export type ReminderType = "overdue" | "due_soon" | "upcoming" | "on_track";
export type ReminderReason = "time_based" | "pattern_based" | "first_service";

export interface ServiceReminder {
  customer: Customer;
  lastServiceDate: string | null;
  daysSinceService: number;
  reminderType: ReminderType;
  reminderReason: ReminderReason;
  recommendedAction: string;
  urgency: "high" | "medium" | "low";
  estimatedServiceDate: string;
}

/**
 * Calculate service reminders for all customers
 */
export function useServiceReminders(
  customers: Customer[],
  workOrders: WorkOrder[]
): ServiceReminder[] {
  return useMemo(() => {
    const today = new Date();
    const reminders: ServiceReminder[] = [];

    // Group work orders by customer phone
    const workOrdersByCustomer = new Map<string, WorkOrder[]>();
    workOrders.forEach((wo) => {
      if (!workOrdersByCustomer.has(wo.customerPhone)) {
        workOrdersByCustomer.set(wo.customerPhone, []);
      }
      workOrdersByCustomer.get(wo.customerPhone)!.push(wo);
    });

    customers.forEach((customer) => {
      const customerWorkOrders = workOrdersByCustomer.get(customer.phone) || [];

      // Sort by date descending
      const sortedOrders = customerWorkOrders
        .filter((wo) => wo.status === "Hoàn thành")
        .sort(
          (a, b) =>
            new Date(b.creationDate).getTime() -
            new Date(a.creationDate).getTime()
        );

      const lastService = sortedOrders[0];
      const lastServiceDate = lastService
        ? new Date(lastService.creationDate)
        : null;
      const daysSinceService = lastServiceDate
        ? Math.floor(
            (today.getTime() - lastServiceDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : Infinity;

      // Calculate service frequency (average days between services)
      let avgDaysBetweenServices = 90; // Default 3 months
      if (sortedOrders.length >= 2) {
        const intervals: number[] = [];
        for (let i = 0; i < sortedOrders.length - 1; i++) {
          const date1 = new Date(sortedOrders[i].creationDate).getTime();
          const date2 = new Date(sortedOrders[i + 1].creationDate).getTime();
          intervals.push((date1 - date2) / (1000 * 60 * 60 * 24));
        }
        avgDaysBetweenServices =
          intervals.reduce((a, b) => a + b, 0) / intervals.length;
      }

      // Determine reminder type and urgency
      let reminderType: ReminderType;
      let reminderReason: ReminderReason;
      let urgency: "high" | "medium" | "low";
      let recommendedAction: string;

      if (sortedOrders.length === 0) {
        // New customer, never serviced
        reminderType = "upcoming";
        reminderReason = "first_service";
        urgency = "low";
        recommendedAction = "Liên hệ để tư vấn dịch vụ bảo dưỡng định kỳ";
      } else if (daysSinceService > avgDaysBetweenServices * 1.5) {
        // Overdue (>150% of normal interval)
        reminderType = "overdue";
        reminderReason = "pattern_based";
        urgency = "high";
        recommendedAction = `Quá hạn ${Math.floor(
          daysSinceService - avgDaysBetweenServices
        )} ngày! Cần bảo dưỡng ngay`;
      } else if (daysSinceService > avgDaysBetweenServices * 0.9) {
        // Due soon (>90% of normal interval)
        reminderType = "due_soon";
        reminderReason = "pattern_based";
        urgency = "medium";
        recommendedAction = `Sắp đến lịch bảo dưỡng (còn ~${Math.floor(
          avgDaysBetweenServices - daysSinceService
        )} ngày)`;
      } else if (daysSinceService > avgDaysBetweenServices * 0.7) {
        // Upcoming (>70% of normal interval)
        reminderType = "upcoming";
        reminderReason = "pattern_based";
        urgency = "low";
        recommendedAction = `Nhắc nhở trước ${Math.floor(
          avgDaysBetweenServices - daysSinceService
        )} ngày`;
      } else {
        // On track
        reminderType = "on_track";
        reminderReason = "time_based";
        urgency = "low";
        recommendedAction = "Khách hàng vừa mới bảo dưỡng";
      }

      // Calculate estimated next service date
      const estimatedNextServiceMs = lastServiceDate
        ? lastServiceDate.getTime() +
          avgDaysBetweenServices * 24 * 60 * 60 * 1000
        : today.getTime() + 30 * 24 * 60 * 60 * 1000; // 30 days for new customers

      reminders.push({
        customer,
        lastServiceDate: lastServiceDate
          ? lastServiceDate.toISOString().split("T")[0]
          : null,
        daysSinceService: isFinite(daysSinceService) ? daysSinceService : 0,
        reminderType,
        reminderReason,
        recommendedAction,
        urgency,
        estimatedServiceDate: new Date(estimatedNextServiceMs)
          .toISOString()
          .split("T")[0],
      });
    });

    // Sort by urgency (high -> medium -> low) and days since service
    return reminders.sort((a, b) => {
      const urgencyOrder = { high: 0, medium: 1, low: 2 };
      if (a.urgency !== b.urgency) {
        return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      }
      return b.daysSinceService - a.daysSinceService;
    });
  }, [customers, workOrders]);
}

/**
 * Get reminder statistics
 */
export function getReminderStats(reminders: ServiceReminder[]) {
  return {
    total: reminders.length,
    overdue: reminders.filter((r) => r.reminderType === "overdue").length,
    dueSoon: reminders.filter((r) => r.reminderType === "due_soon").length,
    upcoming: reminders.filter((r) => r.reminderType === "upcoming").length,
    onTrack: reminders.filter((r) => r.reminderType === "on_track").length,
    highUrgency: reminders.filter((r) => r.urgency === "high").length,
    mediumUrgency: reminders.filter((r) => r.urgency === "medium").length,
  };
}

/**
 * Filter reminders by type
 */
export function filterRemindersByType(
  reminders: ServiceReminder[],
  type: ReminderType | "all"
): ServiceReminder[] {
  if (type === "all") return reminders;
  return reminders.filter((r) => r.reminderType === type);
}
