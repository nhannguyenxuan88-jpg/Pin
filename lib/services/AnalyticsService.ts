/**
 * Analytics Service
 * Provides advanced analytics and business intelligence
 */

import type { PinContextType } from "../../contexts/types";
import type {
  PinSale,
  PinProduct,
  PinMaterial,
  CashTransaction,
} from "../../types";
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  subMonths,
  subYears,
  eachMonthOfInterval,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
} from "date-fns";

export interface TimeSeriesData {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
  orders: number;
}

export interface ProductPerformance {
  sku: string;
  name: string;
  totalRevenue: number;
  totalQuantity: number;
  totalOrders: number;
  averagePrice: number;
  profitMargin: number;
}

export interface CustomerAnalytics {
  name: string;
  phone: string;
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  lastOrderDate: string;
}

export interface CategoryAnalytics {
  category: string;
  revenue: number;
  quantity: number;
  orders: number;
  percentage: number;
}

export interface InventoryAnalysis {
  deadStock: PinProduct[]; // Products with no sales in last 90 days
  lowTurnover: PinProduct[]; // Products with high stock but low sales velocity
  stockValue: number;
  totalItems: number;
}

export interface ProfitAnalysis {
  topProfitProducts: ProductPerformance[]; // Sorted by total profit
  averageMargin: number;
}

export interface RetentionMetrics {
  returningRate: number; // % of customers with > 1 order
  dormantCustomers: CustomerAnalytics[]; // Customers with no orders in last 60 days
  totalCustomers: number;
}

export interface DebtOverview {
  totalReceivables: number; // Customer debt
  totalPayables: number; // Supplier debt (mock/placeholder if not available)
  overdueCount: number;
}

export interface AnalyticsService {
  // Time series analysis
  getRevenueTimeSeries: (
    startDate: Date,
    endDate: Date,
    interval: "day" | "month"
  ) => TimeSeriesData[];

  // Product analytics
  getTopProducts: (limit?: number) => ProductPerformance[];
  getProductTrends: (productId: string) => TimeSeriesData[];

  // Customer analytics
  getTopCustomers: (limit?: number) => CustomerAnalytics[];
  getCustomerLifetimeValue: (customerId: string) => number;

  // Comparative analysis
  compareYearOverYear: (year: number) => {
    currentYear: { revenue: number; orders: number };
    previousYear: { revenue: number; orders: number };
    growth: { revenue: number; orders: number };
  };

  compareMonthOverMonth: (
    month: number,
    year: number
  ) => {
    currentMonth: { revenue: number; orders: number };
    previousMonth: { revenue: number; orders: number };
    growth: { revenue: number; orders: number };
  };

  // Predictive analytics
  predictNextMonthRevenue: () => number;
  getTrendDirection: () => "up" | "down" | "stable";

  // Category analysis
  getCategoryBreakdown: () => CategoryAnalytics[];

  // Financial metrics
  getFinancialMetrics: (startDate?: Date, endDate?: Date) => {
    totalRevenue: number;
    totalCost: number;
    grossProfit: number;
    profitMargin: number;
    averageOrderValue: number;
    totalOrders: number;
  };

  // New Advanced Metrics
  getInventoryAnalysis: () => InventoryAnalysis;
  getProfitAnalysis: (limit?: number) => ProfitAnalysis;
  getRetentionMetrics: () => RetentionMetrics;
  getDebtOverview: () => DebtOverview;
}

export function createAnalyticsService(ctx: PinContextType): AnalyticsService {
  console.log("AnalyticsService initialized v2");
  const getSales = (): PinSale[] => ctx.pinSales || [];
  const getProducts = (): PinProduct[] => ctx.pinProducts || [];
  const getMaterials = (): PinMaterial[] => ctx.pinMaterials || [];

  const filterSalesByDateRange = (
    sales: PinSale[],
    startDate: Date,
    endDate: Date
  ): PinSale[] => {
    return sales.filter((sale) => {
      const saleDate = new Date(sale.date);
      return saleDate >= startDate && saleDate <= endDate;
    });
  };

  const calculateRevenue = (sales: PinSale[]): number => {
    return sales.reduce((sum, sale) => sum + sale.total, 0);
  };

  const calculateCost = (sales: PinSale[]): number => {
    return sales.reduce((sum, sale) => {
      const saleCost = sale.items.reduce((itemSum, item) => {
        // Ưu tiên sử dụng giá vốn đã lưu trong item (snapshot tại thời điểm bán)
        // Nếu không có, fallback về giá vốn hiện tại của sản phẩm
        const itemCostPrice = item.costPrice !== undefined && item.costPrice > 0
          ? item.costPrice
          : getProducts().find((p) => p.id === item.productId)?.costPrice || 0;
        return itemSum + itemCostPrice * item.quantity;
      }, 0);
      return sum + saleCost;
    }, 0);
  };

  return {
    getRevenueTimeSeries: (startDate, endDate, interval) => {
      const sales = getSales();
      const filteredSales = filterSalesByDateRange(sales, startDate, endDate);

      let intervals: Date[];
      if (interval === "day") {
        intervals = eachDayOfInterval({ start: startDate, end: endDate });
      } else {
        intervals = eachMonthOfInterval({ start: startDate, end: endDate });
      }

      return intervals.map((date) => {
        const periodStart =
          interval === "day" ? startOfDay(date) : startOfMonth(date);
        const periodEnd =
          interval === "day" ? endOfDay(date) : endOfMonth(date);

        const periodSales = filteredSales.filter((sale) => {
          const saleDate = new Date(sale.date);
          return saleDate >= periodStart && saleDate <= periodEnd;
        });

        const revenue = calculateRevenue(periodSales);
        const cost = calculateCost(periodSales);

        return {
          date: format(date, interval === "day" ? "yyyy-MM-dd" : "yyyy-MM"),
          revenue,
          cost,
          profit: revenue - cost,
          orders: periodSales.length,
        };
      });
    },

    getTopProducts: (limit = 10) => {
      const sales = getSales();
      const products = getProducts();
      const productMap = new Map<string, ProductPerformance>();

      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return;

          const existing = productMap.get(product.id) || {
            sku: product.sku,
            name: product.name,
            totalRevenue: 0,
            totalQuantity: 0,
            totalOrders: 0,
            averagePrice: 0,
            profitMargin: 0,
          };

          // Updated calculation using item.sellingPrice
          existing.totalRevenue += item.sellingPrice * item.quantity;
          existing.totalQuantity += item.quantity;
          existing.totalOrders += 1;

          productMap.set(product.id, existing);
        });
      });

      const result = Array.from(productMap.values()).map((p) => {
        const product = products.find((prod) => prod.sku === p.sku);
        return {
          ...p,
          averagePrice: p.totalRevenue / p.totalQuantity,
          profitMargin: product
            ? ((product.retailPrice - product.costPrice) /
              product.retailPrice) *
            100
            : 0,
        };
      });

      return result
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
    },

    getProductTrends: (productId) => {
      const sales = getSales();
      const now = new Date();
      const sixMonthsAgo = subMonths(now, 6);

      const months = eachMonthOfInterval({
        start: sixMonthsAgo,
        end: now,
      });

      return months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthSales = sales.filter((sale) => {
          const saleDate = new Date(sale.date);
          return saleDate >= monthStart && saleDate <= monthEnd;
        });

        const productSales = monthSales.filter((sale) =>
          sale.items.some((item) => item.productId === productId)
        );

        const revenue = productSales.reduce((sum, sale) => {
          const productItems = sale.items.filter(
            (item) => item.productId === productId
          );
          return (
            sum +
            productItems.reduce(
              (itemSum, item) => itemSum + item.sellingPrice * item.quantity,
              0
            )
          );
        }, 0);

        return {
          date: format(month, "yyyy-MM"),
          revenue,
          cost: 0,
          profit: revenue,
          orders: productSales.length,
        };
      });
    },

    getTopCustomers: (limit = 10) => {
      const sales = getSales();
      const customerMap = new Map<string, CustomerAnalytics>();

      sales.forEach((sale) => {
        const key = `${sale.customer.name}-${sale.customer.phone || ""}`;
        const existing = customerMap.get(key) || {
          name: sale.customer.name,
          phone: sale.customer.phone || "",
          totalRevenue: 0,
          orderCount: 0,
          averageOrderValue: 0,
          lastOrderDate: sale.date,
        };

        existing.totalRevenue += sale.total;
        existing.orderCount += 1;
        if (new Date(sale.date) > new Date(existing.lastOrderDate)) {
          existing.lastOrderDate = sale.date;
        }

        customerMap.set(key, existing);
      });

      const result = Array.from(customerMap.values()).map((c) => ({
        ...c,
        averageOrderValue: c.totalRevenue / c.orderCount,
      }));

      return result
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, limit);
    },

    getCustomerLifetimeValue: (customerId) => {
      const sales = getSales();
      return sales
        .filter(
          (sale) =>
            sale.customer.id === customerId ||
            sale.customer.phone === customerId
        )
        .reduce((sum, sale) => sum + sale.total, 0);
    },

    compareYearOverYear: (year) => {
      const sales = getSales();

      const currentYearStart = startOfYear(new Date(year, 0, 1));
      const currentYearEnd = endOfYear(new Date(year, 0, 1));
      const currentYearSales = filterSalesByDateRange(
        sales,
        currentYearStart,
        currentYearEnd
      );

      const previousYearStart = startOfYear(new Date(year - 1, 0, 1));
      const previousYearEnd = endOfYear(new Date(year - 1, 0, 1));
      const previousYearSales = filterSalesByDateRange(
        sales,
        previousYearStart,
        previousYearEnd
      );

      const currentRevenue = calculateRevenue(currentYearSales);
      const previousRevenue = calculateRevenue(previousYearSales);

      return {
        currentYear: {
          revenue: currentRevenue,
          orders: currentYearSales.length,
        },
        previousYear: {
          revenue: previousRevenue,
          orders: previousYearSales.length,
        },
        growth: {
          revenue:
            previousRevenue > 0
              ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
              : 0,
          orders:
            previousYearSales.length > 0
              ? ((currentYearSales.length - previousYearSales.length) /
                previousYearSales.length) *
              100
              : 0,
        },
      };
    },

    compareMonthOverMonth: (month, year) => {
      const sales = getSales();

      const currentMonthStart = startOfMonth(new Date(year, month - 1, 1));
      const currentMonthEnd = endOfMonth(new Date(year, month - 1, 1));
      const currentMonthSales = filterSalesByDateRange(
        sales,
        currentMonthStart,
        currentMonthEnd
      );

      const previousMonth = subMonths(currentMonthStart, 1);
      const previousMonthStart = startOfMonth(previousMonth);
      const previousMonthEnd = endOfMonth(previousMonth);
      const previousMonthSales = filterSalesByDateRange(
        sales,
        previousMonthStart,
        previousMonthEnd
      );

      const currentRevenue = calculateRevenue(currentMonthSales);
      const previousRevenue = calculateRevenue(previousMonthSales);

      return {
        currentMonth: {
          revenue: currentRevenue,
          orders: currentMonthSales.length,
        },
        previousMonth: {
          revenue: previousRevenue,
          orders: previousMonthSales.length,
        },
        growth: {
          revenue:
            previousRevenue > 0
              ? ((currentRevenue - previousRevenue) / previousRevenue) * 100
              : 0,
          orders:
            previousMonthSales.length > 0
              ? ((currentMonthSales.length - previousMonthSales.length) /
                previousMonthSales.length) *
              100
              : 0,
        },
      };
    },

    predictNextMonthRevenue: () => {
      const sales = getSales();
      const now = new Date();
      const last6Months = eachMonthOfInterval({
        start: subMonths(now, 6),
        end: now,
      });

      const monthlyRevenues = last6Months.map((month) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthSales = filterSalesByDateRange(sales, monthStart, monthEnd);
        return calculateRevenue(monthSales);
      });

      // Simple linear regression prediction
      const average =
        monthlyRevenues.reduce((a, b) => a + b, 0) / monthlyRevenues.length;

      // Calculate trend
      let trend = 0;
      for (let i = 1; i < monthlyRevenues.length; i++) {
        trend += monthlyRevenues[i] - monthlyRevenues[i - 1];
      }
      trend /= monthlyRevenues.length - 1;

      return average + trend;
    },

    getTrendDirection: () => {
      const sales = getSales();
      const now = new Date();
      const lastMonth = subMonths(now, 1);
      const twoMonthsAgo = subMonths(now, 2);

      const lastMonthRevenue = calculateRevenue(
        filterSalesByDateRange(
          sales,
          startOfMonth(lastMonth),
          endOfMonth(lastMonth)
        )
      );

      const twoMonthsAgoRevenue = calculateRevenue(
        filterSalesByDateRange(
          sales,
          startOfMonth(twoMonthsAgo),
          endOfMonth(twoMonthsAgo)
        )
      );

      const change = lastMonthRevenue - twoMonthsAgoRevenue;
      const changePercent = (change / twoMonthsAgoRevenue) * 100;

      if (changePercent > 5) return "up";
      if (changePercent < -5) return "down";
      return "stable";
    },

    getCategoryBreakdown: () => {
      const sales = getSales();
      const products = getProducts();
      const categoryMap = new Map<string, CategoryAnalytics>();

      let totalRevenue = 0;

      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          const category = (product as any)?.category || "Khác";

          const existing = categoryMap.get(category) || {
            category,
            revenue: 0,
            quantity: 0,
            orders: 0,
            percentage: 0,
          };

          const itemRevenue = item.sellingPrice * item.quantity;
          existing.revenue += itemRevenue;
          existing.quantity += item.quantity;
          existing.orders += 1;
          totalRevenue += itemRevenue;

          categoryMap.set(category, existing);
        });
      });

      return Array.from(categoryMap.values()).map((cat) => ({
        ...cat,
        percentage: totalRevenue > 0 ? (cat.revenue / totalRevenue) * 100 : 0,
      }));
    },

    getFinancialMetrics: (startDate?: Date, endDate?: Date) => {
      let sales = getSales();
      
      // Lọc theo khoảng thời gian nếu được cung cấp
      if (startDate && endDate) {
        sales = filterSalesByDateRange(sales, startDate, endDate);
      }
      
      const totalRevenue = calculateRevenue(sales);
      const totalCost = calculateCost(sales);

      return {
        totalRevenue,
        totalCost,
        grossProfit: totalRevenue - totalCost,
        profitMargin:
          totalRevenue > 0
            ? ((totalRevenue - totalCost) / totalRevenue) * 100
            : 0,
        averageOrderValue: sales.length > 0 ? totalRevenue / sales.length : 0,
        totalOrders: sales.length,
      };
    },

    getInventoryAnalysis: () => {
      const products = getProducts();
      const sales = getSales();
      const ninetyDaysAgo = subMonths(new Date(), 3);

      const deadStock = products.filter(p => {
        if (p.stock <= 0) return false;
        const hasRecentSale = sales.some(sale =>
          new Date(sale.date) >= ninetyDaysAgo &&
          sale.items.some(item => item.productId === p.id)
        );
        return !hasRecentSale;
      });

      const lowTurnover = products.filter(p => {
        if (p.stock < 10) return false;
        const totalSold = sales.reduce((sum, sale) => {
          const item = sale.items.find(i => i.productId === p.id);
          return sum + (item ? item.quantity : 0);
        }, 0);
        return totalSold < 5;
      });

      const stockValue = products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);

      return {
        deadStock: deadStock.slice(0, 10),
        lowTurnover: lowTurnover.slice(0, 10),
        stockValue,
        totalItems: products.reduce((sum, p) => sum + p.stock, 0)
      };
    },

    getProfitAnalysis: (limit = 10) => {
      const sales = getSales();
      const products = getProducts();
      const productMap = new Map<string, ProductPerformance & { totalProfit: number }>();

      sales.forEach((sale) => {
        sale.items.forEach((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return;

          // Ưu tiên sử dụng giá vốn đã lưu trong item (snapshot tại thời điểm bán)
          const itemCostPrice = item.costPrice !== undefined && item.costPrice > 0
            ? item.costPrice
            : product.costPrice;
          const profit = (item.sellingPrice - itemCostPrice) * item.quantity;
          const revenue = item.sellingPrice * item.quantity;

          const existing = productMap.get(product.id) || {
            sku: product.sku,
            name: product.name,
            totalRevenue: 0,
            totalQuantity: 0,
            totalOrders: 0,
            averagePrice: 0,
            profitMargin: 0,
            totalProfit: 0
          };

          existing.totalRevenue += revenue;
          existing.totalProfit += profit;
          existing.totalQuantity += item.quantity;
          existing.totalOrders += 1;

          productMap.set(product.id, existing);
        });
      });

      const result = Array.from(productMap.values()).map(p => ({
        ...p,
        averagePrice: p.totalRevenue / p.totalQuantity,
        profitMargin: p.totalRevenue > 0 ? (p.totalProfit / p.totalRevenue) * 100 : 0
      }));

      // Sort by TOTAL PROFIT
      const topProfitProducts = result
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, limit);

      const totalProfit = result.reduce((sum, p) => sum + p.totalProfit, 0);
      const totalRev = result.reduce((sum, p) => sum + p.totalRevenue, 0);
      const averageMargin = totalRev > 0 ? (totalProfit / totalRev) * 100 : 0;

      return {
        topProfitProducts,
        averageMargin
      };
    },

    getRetentionMetrics: () => {
      const sales = getSales();
      const customers = ctx.pinCustomers || [];
      const sixtyDaysAgo = subMonths(new Date(), 2);

      const customerOrders = new Map<string, { count: number, lastOrder: string }>();

      sales.forEach(sale => {
        const id = sale.customer.id || sale.customer.phone;
        if (!id) return;
        const current = customerOrders.get(id) || { count: 0, lastOrder: '' };
        current.count += 1;
        if (!current.lastOrder || new Date(sale.date) > new Date(current.lastOrder)) {
          current.lastOrder = sale.date;
        }
        customerOrders.set(id, current);
      });

      const returningCustomers = Array.from(customerOrders.values()).filter(c => c.count > 1).length;
      const totalActiveCustomers = customerOrders.size;
      const returningRate = totalActiveCustomers > 0 ? (returningCustomers / totalActiveCustomers) * 100 : 0;

      const dormantList: CustomerAnalytics[] = [];
      customerOrders.forEach((data, id) => {
        if (new Date(data.lastOrder) < sixtyDaysAgo) {
          const customerName = sales.find(s => (s.customer.id || s.customer.phone) === id)?.customer.name || 'Unknown';
          dormantList.push({
            name: customerName,
            phone: id,
            totalRevenue: 0,
            orderCount: data.count,
            averageOrderValue: 0,
            lastOrderDate: data.lastOrder
          });
        }
      });

      return {
        returningRate,
        dormantCustomers: dormantList.slice(0, 10),
        totalCustomers: customers.length
      };
    },

    getDebtOverview: () => {
      const customers = ctx.pinCustomers || [];
      const totalReceivables = customers.reduce((sum, c) => sum + ((c as any).debt || 0), 0);

      return {
        totalReceivables,
        totalPayables: 0,
        overdueCount: customers.filter(c => ((c as any).debt || 0) > 0).length
      };
    }
  };
}
