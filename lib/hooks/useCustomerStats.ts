/**
 * Customer Statistics Hook
 * Calculate comprehensive customer analytics and KPIs
 */

import { useMemo } from "react";
import type { Customer, Sale, WorkOrder } from "../../types";
import type { CustomerSegment } from "./useCustomerSegmentation";

export interface CustomerStats {
  // Overall metrics
  totalCustomers: number;
  newCustomersThisMonth: number;
  newCustomersLastMonth: number;
  growthRate: number; // percentage

  // Segment breakdown
  segmentBreakdown: {
    segment: CustomerSegment;
    count: number;
    percentage: number;
    totalSpent: number;
    avgSpent: number;
  }[];

  // Top performers
  topVIPCustomers: {
    customer: Customer;
    totalSpent: number;
    visitCount: number;
    lastVisit: string | null;
  }[];

  // At risk analysis
  atRiskCount: number;
  atRiskPotentialLoss: number; // Total spent by at-risk customers

  // Revenue metrics
  totalRevenue: number;
  avgRevenuePerCustomer: number;
  avgOrderValue: number;

  // Engagement metrics
  activeCustomers: number; // Visited in last 90 days
  inactiveCustomers: number; // Not visited in 90+ days
  avgVisitsPerCustomer: number;

  // Time-based trends
  newCustomersByMonth: { month: string; count: number }[];
}

/**
 * Calculate comprehensive customer statistics
 */
export function useCustomerStats(
  customers: Customer[],
  sales: Sale[],
  workOrders: WorkOrder[],
  customerRFMData: Array<{
    customer: Customer;
    segment: CustomerSegment;
    monetary: number;
    frequency: number;
    recency: number;
  }>
): CustomerStats {
  return useMemo(() => {
    const today = new Date();
    const thisMonth = today.getMonth();
    const thisYear = today.getFullYear();

    // Calculate new customers this month and last month
    const newCustomersThisMonth = customers.filter((c) => {
      // For demo, we'll use first work order date as join date
      const customerOrders = workOrders.filter(
        (wo) => wo.customerPhone === c.phone
      );
      if (customerOrders.length === 0) return false;
      const firstOrder = customerOrders.sort(
        (a, b) =>
          new Date(a.creationDate).getTime() -
          new Date(b.creationDate).getTime()
      )[0];
      const orderDate = new Date(firstOrder.creationDate);
      return (
        orderDate.getMonth() === thisMonth &&
        orderDate.getFullYear() === thisYear
      );
    }).length;

    const lastMonthDate = new Date(thisYear, thisMonth - 1, 1);
    const newCustomersLastMonth = customers.filter((c) => {
      const customerOrders = workOrders.filter(
        (wo) => wo.customerPhone === c.phone
      );
      if (customerOrders.length === 0) return false;
      const firstOrder = customerOrders.sort(
        (a, b) =>
          new Date(a.creationDate).getTime() -
          new Date(b.creationDate).getTime()
      )[0];
      const orderDate = new Date(firstOrder.creationDate);
      return (
        orderDate.getMonth() === lastMonthDate.getMonth() &&
        orderDate.getFullYear() === lastMonthDate.getFullYear()
      );
    }).length;

    const growthRate =
      newCustomersLastMonth > 0
        ? ((newCustomersThisMonth - newCustomersLastMonth) /
            newCustomersLastMonth) *
          100
        : 0;

    // Segment breakdown
    const segmentCounts = new Map<CustomerSegment, number>();
    const segmentRevenue = new Map<CustomerSegment, number>();

    customerRFMData.forEach((rfm) => {
      segmentCounts.set(rfm.segment, (segmentCounts.get(rfm.segment) || 0) + 1);
      segmentRevenue.set(
        rfm.segment,
        (segmentRevenue.get(rfm.segment) || 0) + rfm.monetary
      );
    });

    const segments: CustomerSegment[] = [
      "VIP",
      "Loyal",
      "Potential",
      "At Risk",
      "Lost",
      "New",
    ];

    const segmentBreakdown = segments.map((segment) => {
      const count = segmentCounts.get(segment) || 0;
      const totalSpent = segmentRevenue.get(segment) || 0;
      return {
        segment,
        count,
        percentage: customers.length > 0 ? (count / customers.length) * 100 : 0,
        totalSpent,
        avgSpent: count > 0 ? totalSpent / count : 0,
      };
    });

    // Top VIP customers
    const topVIPCustomers = customerRFMData
      .filter((rfm) => rfm.segment === "VIP" || rfm.monetary > 0)
      .sort((a, b) => b.monetary - a.monetary)
      .slice(0, 5)
      .map((rfm) => {
        const customerOrders = workOrders.filter(
          (wo) => wo.customerPhone === rfm.customer.phone
        );
        const lastOrder = customerOrders.sort(
          (a, b) =>
            new Date(b.creationDate).getTime() -
            new Date(a.creationDate).getTime()
        )[0];
        return {
          customer: rfm.customer,
          totalSpent: rfm.monetary,
          visitCount: rfm.frequency,
          lastVisit: lastOrder ? lastOrder.creationDate : null,
        };
      });

    // At risk analysis
    const atRiskCustomers = customerRFMData.filter(
      (rfm) => rfm.segment === "At Risk"
    );
    const atRiskCount = atRiskCustomers.length;
    const atRiskPotentialLoss = atRiskCustomers.reduce(
      (sum, rfm) => sum + rfm.monetary,
      0
    );

    // Revenue metrics
    const totalRevenue = sales.reduce((sum, sale) => sum + sale.total, 0);
    const avgRevenuePerCustomer =
      customers.length > 0 ? totalRevenue / customers.length : 0;
    const avgOrderValue =
      workOrders.length > 0 ? totalRevenue / workOrders.length : 0;

    // Engagement metrics
    const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
    const activeCustomers = customers.filter((c) => {
      const customerOrders = workOrders.filter(
        (wo) => wo.customerPhone === c.phone
      );
      if (customerOrders.length === 0) return false;
      const lastOrder = customerOrders.sort(
        (a, b) =>
          new Date(b.creationDate).getTime() -
          new Date(a.creationDate).getTime()
      )[0];
      return new Date(lastOrder.creationDate) >= ninetyDaysAgo;
    }).length;

    const inactiveCustomers = customers.length - activeCustomers;
    const totalVisits = workOrders.length;
    const avgVisitsPerCustomer =
      customers.length > 0 ? totalVisits / customers.length : 0;

    // New customers by month (last 6 months)
    const newCustomersByMonth: { month: string; count: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(thisYear, thisMonth - i, 1);
      const monthName = date.toLocaleDateString("vi-VN", {
        month: "short",
        year: "numeric",
      });
      const count = customers.filter((c) => {
        const customerOrders = workOrders.filter(
          (wo) => wo.customerPhone === c.phone
        );
        if (customerOrders.length === 0) return false;
        const firstOrder = customerOrders.sort(
          (a, b) =>
            new Date(a.creationDate).getTime() -
            new Date(b.creationDate).getTime()
        )[0];
        const orderDate = new Date(firstOrder.creationDate);
        return (
          orderDate.getMonth() === date.getMonth() &&
          orderDate.getFullYear() === date.getFullYear()
        );
      }).length;
      newCustomersByMonth.push({ month: monthName, count });
    }

    return {
      totalCustomers: customers.length,
      newCustomersThisMonth,
      newCustomersLastMonth,
      growthRate,
      segmentBreakdown,
      topVIPCustomers,
      atRiskCount,
      atRiskPotentialLoss,
      totalRevenue,
      avgRevenuePerCustomer,
      avgOrderValue,
      activeCustomers,
      inactiveCustomers,
      avgVisitsPerCustomer,
      newCustomersByMonth,
    };
  }, [customers, sales, workOrders, customerRFMData]);
}
