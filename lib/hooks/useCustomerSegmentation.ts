/**
 * Customer Segmentation using RFM Analysis
 * Recency - Frequency - Monetary
 */

import { useMemo } from "react";
import type { Customer, Sale } from "../../types";

export type CustomerSegment =
  | "VIP"
  | "Loyal"
  | "Potential"
  | "At Risk"
  | "Lost"
  | "New";

export interface CustomerRFM {
  customerId: string;
  customer: Customer;
  recency: number; // Days since last purchase
  frequency: number; // Number of purchases
  monetary: number; // Total spent
  recencyScore: number; // 1-5
  frequencyScore: number; // 1-5
  monetaryScore: number; // 1-5
  rfmScore: number; // Combined score
  segment: CustomerSegment;
}

/**
 * Calculate RFM scores for customers
 */
export function useCustomerSegmentation(
  customers: Customer[],
  sales: Sale[]
): CustomerRFM[] {
  return useMemo(() => {
    const today = new Date();
    const customerData: Map<
      string,
      {
        customer: Customer;
        lastPurchase: Date | null;
        totalPurchases: number;
        totalSpent: number;
      }
    > = new Map();

    // Initialize customer data
    customers.forEach((customer) => {
      customerData.set(customer.id, {
        customer,
        lastPurchase: null,
        totalPurchases: 0,
        totalSpent: 0,
      });
    });

    // Process sales
    sales.forEach((sale) => {
      if (!sale.customer_id) return;

      const data = customerData.get(sale.customer_id);
      if (!data) return;

      const saleDate = new Date(sale.created_at || sale.sale_date);

      // Update last purchase
      if (!data.lastPurchase || saleDate > data.lastPurchase) {
        data.lastPurchase = saleDate;
      }

      // Update frequency and monetary
      data.totalPurchases++;
      data.totalSpent += sale.total_amount || 0;
    });

    // Calculate RFM metrics
    const rfmData: Array<{
      customerId: string;
      customer: Customer;
      recency: number;
      frequency: number;
      monetary: number;
    }> = [];

    customerData.forEach((data, customerId) => {
      const recency = data.lastPurchase
        ? Math.floor(
            (today.getTime() - data.lastPurchase.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 999; // Very high number for customers with no purchases

      rfmData.push({
        customerId,
        customer: data.customer,
        recency,
        frequency: data.totalPurchases,
        monetary: data.totalSpent,
      });
    });

    // Calculate quintiles for scoring (1-5)
    const recencyValues = rfmData.map((d) => d.recency).sort((a, b) => a - b);
    const frequencyValues = rfmData
      .map((d) => d.frequency)
      .sort((a, b) => b - a); // Descending
    const monetaryValues = rfmData.map((d) => d.monetary).sort((a, b) => b - a); // Descending

    const getQuintile = (
      value: number,
      sortedValues: number[],
      reverse = false
    ): number => {
      if (sortedValues.length === 0) return 1;

      const quintileSize = Math.ceil(sortedValues.length / 5);
      const index = sortedValues.indexOf(value);

      if (index === -1) return 1;

      const quintile = Math.floor(index / quintileSize) + 1;
      return reverse ? 6 - Math.min(quintile, 5) : Math.min(quintile, 5);
    };

    // Assign scores and segments
    const results: CustomerRFM[] = rfmData.map((data) => {
      // Lower recency is better (recent customers), so reverse the score
      const recencyScore = 6 - getQuintile(data.recency, recencyValues);
      const frequencyScore = getQuintile(data.frequency, frequencyValues);
      const monetaryScore = getQuintile(data.monetary, monetaryValues);

      const rfmScore = recencyScore + frequencyScore + monetaryScore;

      // Determine segment based on RFM scores
      let segment: CustomerSegment;

      if (data.frequency === 0) {
        segment = "New";
      } else if (
        recencyScore >= 4 &&
        frequencyScore >= 4 &&
        monetaryScore >= 4
      ) {
        segment = "VIP";
      } else if (frequencyScore >= 3 && monetaryScore >= 3) {
        segment = "Loyal";
      } else if (
        recencyScore >= 3 &&
        (frequencyScore <= 2 || monetaryScore <= 2)
      ) {
        segment = "Potential";
      } else if (recencyScore <= 2 && frequencyScore >= 2) {
        segment = "At Risk";
      } else {
        segment = "Lost";
      }

      return {
        customerId: data.customerId,
        customer: data.customer,
        recency: data.recency,
        frequency: data.frequency,
        monetary: data.monetary,
        recencyScore,
        frequencyScore,
        monetaryScore,
        rfmScore,
        segment,
      };
    });

    // Sort by RFM score descending
    return results.sort((a, b) => b.rfmScore - a.rfmScore);
  }, [customers, sales]);
}

/**
 * Get segment statistics
 */
export function getSegmentStats(rfmData: CustomerRFM[]) {
  const segments = {
    VIP: 0,
    Loyal: 0,
    Potential: 0,
    "At Risk": 0,
    Lost: 0,
    New: 0,
  };

  rfmData.forEach((data) => {
    segments[data.segment]++;
  });

  return segments;
}

/**
 * Get segment color for UI
 */
export function getSegmentColor(segment: CustomerSegment): string {
  switch (segment) {
    case "VIP":
      return "text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800";
    case "Loyal":
      return "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    case "Potential":
      return "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    case "At Risk":
      return "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800";
    case "Lost":
      return "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    case "New":
      return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800";
    default:
      return "text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800";
  }
}

/**
 * Get segment description
 */
export function getSegmentDescription(segment: CustomerSegment): string {
  switch (segment) {
    case "VIP":
      return "Khách hàng VIP - Mua thường xuyên, chi tiêu cao, mới mua gần đây";
    case "Loyal":
      return "Khách hàng trung thành - Mua đều đặn với giá trị tốt";
    case "Potential":
      return "Khách hàng tiềm năng - Mới mua gần đây nhưng chưa thường xuyên";
    case "At Risk":
      return "Khách hàng có nguy cơ mất - Đã lâu không mua dù trước đây thường xuyên";
    case "Lost":
      return "Khách hàng đã mất - Lâu không mua và ít tương tác";
    case "New":
      return "Khách hàng mới - Chưa có giao dịch";
    default:
      return "";
  }
}
