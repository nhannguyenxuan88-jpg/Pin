/**
 * Financial Analytics Service
 * Provides comprehensive financial calculations and analysis
 */

import {
  FixedAsset,
  CashFlow,
  CapitalStructure,
  FinancialRatio,
  CashFlowForecast,
  InventoryTransaction,
  CashTransaction,
} from "../../types";

export class FinancialAnalyticsService {
  /**
   * Calculate depreciation for fixed assets
   */
  static calculateDepreciation(asset: FixedAsset, currentDate: Date): number {
    const purchaseDate = new Date(asset.purchaseDate);
    const ageInYears =
      (currentDate.getTime() - purchaseDate.getTime()) /
      (365.25 * 24 * 60 * 60 * 1000);

    switch (asset.depreciationMethod) {
      case "straight_line":
        return this.straightLineDepreciation(asset, ageInYears);
      case "declining_balance":
        return this.decliningBalanceDepreciation(asset, ageInYears);
      case "sum_of_years":
        return this.sumOfYearsDepreciation(asset, ageInYears);
      case "units_of_production":
        return this.unitsOfProductionDepreciation(asset, ageInYears);
      default:
        return this.straightLineDepreciation(asset, ageInYears);
    }
  }

  private static straightLineDepreciation(
    asset: FixedAsset,
    ageInYears: number
  ): number {
    const depreciableAmount = asset.purchasePrice - asset.salvageValue;
    const annualDepreciation = depreciableAmount / asset.usefulLife;
    const totalDepreciation = Math.min(
      annualDepreciation * ageInYears,
      depreciableAmount
    );
    return totalDepreciation;
  }

  private static decliningBalanceDepreciation(
    asset: FixedAsset,
    ageInYears: number
  ): number {
    const rate = 2 / asset.usefulLife; // Double declining balance
    let bookValue = asset.purchasePrice;
    let totalDepreciation = 0;

    for (let year = 0; year < Math.floor(ageInYears); year++) {
      const yearlyDepreciation = Math.min(
        bookValue * rate,
        bookValue - asset.salvageValue
      );
      totalDepreciation += yearlyDepreciation;
      bookValue -= yearlyDepreciation;

      if (bookValue <= asset.salvageValue) break;
    }

    // Handle partial year
    const partialYear = ageInYears - Math.floor(ageInYears);
    if (partialYear > 0 && bookValue > asset.salvageValue) {
      const partialDepreciation = Math.min(
        bookValue * rate * partialYear,
        bookValue - asset.salvageValue
      );
      totalDepreciation += partialDepreciation;
    }

    return totalDepreciation;
  }

  private static sumOfYearsDepreciation(
    asset: FixedAsset,
    ageInYears: number
  ): number {
    const depreciableAmount = asset.purchasePrice - asset.salvageValue;
    const sumOfYears = (asset.usefulLife * (asset.usefulLife + 1)) / 2;
    let totalDepreciation = 0;

    for (let year = 1; year <= Math.ceil(ageInYears); year++) {
      const remainingLife = asset.usefulLife - (year - 1);
      const yearlyRate = remainingLife / sumOfYears;
      const yearlyDepreciation = depreciableAmount * yearlyRate;

      if (year <= ageInYears) {
        totalDepreciation += yearlyDepreciation;
      } else {
        // Partial year
        const partialYear = ageInYears - (year - 1);
        totalDepreciation += yearlyDepreciation * partialYear;
      }
    }

    return Math.min(totalDepreciation, depreciableAmount);
  }

  private static unitsOfProductionDepreciation(
    asset: FixedAsset,
    ageInYears: number
  ): number {
    // Simplified - would need actual production data
    // For now, use straight line as fallback
    return this.straightLineDepreciation(asset, ageInYears);
  }

  /**
   * Calculate current book value of asset
   */
  static calculateBookValue(
    asset: FixedAsset,
    currentDate: Date = new Date()
  ): number {
    const depreciation = this.calculateDepreciation(asset, currentDate);
    return Math.max(asset.purchasePrice - depreciation, asset.salvageValue);
  }

  /**
   * Calculate financial ratios
   */
  static calculateFinancialRatios(
    assets: FixedAsset[],
    cashFlows: CashFlow[],
    capitalStructure: CapitalStructure,
    inventoryValue: number,
    salesRevenue: number,
    netIncome: number
  ): FinancialRatio {
    const currentDate = new Date();
    const currentAssets =
      inventoryValue + capitalStructure.equity.retainedEarnings; // Simplified
    const totalAssets = capitalStructure.totalAssets;
    const currentLiabilities =
      capitalStructure.debt.shortTermDebt +
      capitalStructure.debt.accountsPayable;
    const totalLiabilities = capitalStructure.totalLiabilities;
    const totalEquity = totalAssets - totalLiabilities;

    return {
      date: currentDate.toISOString(),

      // Liquidity Ratios
      currentRatio:
        currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
      quickRatio:
        currentLiabilities > 0
          ? (currentAssets - inventoryValue) / currentLiabilities
          : 0,
      cashRatio:
        currentLiabilities > 0
          ? capitalStructure.equity.retainedEarnings / currentLiabilities
          : 0,
      workingCapitalRatio: capitalStructure.workingCapital / totalAssets,

      // Profitability Ratios
      grossProfitMargin:
        salesRevenue > 0
          ? (salesRevenue - this.calculateCOGS(cashFlows)) / salesRevenue
          : 0,
      netProfitMargin: salesRevenue > 0 ? netIncome / salesRevenue : 0,
      returnOnAssets: totalAssets > 0 ? netIncome / totalAssets : 0,
      returnOnEquity: totalEquity > 0 ? netIncome / totalEquity : 0,

      // Efficiency Ratios (simplified)
      inventoryTurnover:
        inventoryValue > 0 ? this.calculateCOGS(cashFlows) / inventoryValue : 0,
      receivablesTurnover: 12, // Placeholder - would need accounts receivable data
      assetTurnover: totalAssets > 0 ? salesRevenue / totalAssets : 0,

      // Leverage Ratios
      debtToAssets: totalAssets > 0 ? totalLiabilities / totalAssets : 0,
      debtToEquity: totalEquity > 0 ? totalLiabilities / totalEquity : 0,
      equityRatio: totalAssets > 0 ? totalEquity / totalAssets : 0,
      interestCoverage:
        this.calculateInterestExpense(cashFlows) > 0
          ? netIncome / this.calculateInterestExpense(cashFlows)
          : 0,
    };
  }

  private static calculateCOGS(cashFlows: CashFlow[]): number {
    return cashFlows
      .filter(
        (cf) =>
          cf.category === "operating" &&
          cf.subcategory === "cost_of_goods_sold" &&
          cf.amount < 0
      )
      .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
  }

  private static calculateInterestExpense(cashFlows: CashFlow[]): number {
    return cashFlows
      .filter(
        (cf) =>
          cf.category === "financing" &&
          cf.subcategory === "interest_expense" &&
          cf.amount < 0
      )
      .reduce((sum, cf) => sum + Math.abs(cf.amount), 0);
  }

  /**
   * Generate cash flow forecast
   */
  static generateCashFlowForecast(
    historicalCashFlows: CashFlow[],
    forecastPeriodMonths: number = 12
  ): CashFlowForecast {
    const currentDate = new Date();
    const endDate = new Date(
      currentDate.getTime() + forecastPeriodMonths * 30 * 24 * 60 * 60 * 1000
    );

    // Analyze historical patterns
    const monthlyPatterns = this.analyzeMonthlyPatterns(historicalCashFlows);

    const projectedInflows = [];
    const projectedOutflows = [];

    for (let month = 0; month < forecastPeriodMonths; month++) {
      const forecastDate = new Date(
        currentDate.getTime() + month * 30 * 24 * 60 * 60 * 1000
      );
      const monthKey = `${forecastDate.getFullYear()}-${
        forecastDate.getMonth() + 1
      }`;

      // Project based on historical averages with seasonal adjustments
      Object.entries(monthlyPatterns).forEach(([subcategory, data]) => {
        if (data.avgAmount > 0) {
          projectedInflows.push({
            date: forecastDate.toISOString().split("T")[0],
            category: subcategory,
            description: `Projected ${subcategory}`,
            amount: data.avgAmount * (1 + data.growthRate),
            probability: data.confidence,
          });
        } else {
          projectedOutflows.push({
            date: forecastDate.toISOString().split("T")[0],
            category: subcategory,
            description: `Projected ${subcategory}`,
            amount: Math.abs(data.avgAmount * (1 + data.growthRate)),
            probability: data.confidence,
          });
        }
      });
    }

    const totalInflows = projectedInflows.reduce(
      (sum, p) => sum + p.amount * p.probability,
      0
    );
    const totalOutflows = projectedOutflows.reduce(
      (sum, p) => sum + p.amount * p.probability,
      0
    );

    return {
      id: `forecast-${Date.now()}`,
      name: `${forecastPeriodMonths}-Month Cash Flow Forecast`,
      startDate: currentDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      projectedInflows,
      projectedOutflows,
      netCashFlow: totalInflows - totalOutflows,
      cumulativeCashFlow: totalInflows - totalOutflows, // Simplified
      confidence: this.calculateForecastConfidence(monthlyPatterns),
      assumptions: "Based on historical patterns with linear trend projection",
      created_at: new Date().toISOString(),
    };
  }

  private static analyzeMonthlyPatterns(cashFlows: CashFlow[]) {
    const patterns: {
      [subcategory: string]: {
        avgAmount: number;
        growthRate: number;
        confidence: number;
      };
    } = {};

    // Group by subcategory and calculate averages
    const subcategoryGroups: { [key: string]: CashFlow[] } = {};

    cashFlows.forEach((cf) => {
      if (!subcategoryGroups[cf.subcategory]) {
        subcategoryGroups[cf.subcategory] = [];
      }
      subcategoryGroups[cf.subcategory].push(cf);
    });

    Object.entries(subcategoryGroups).forEach(([subcategory, flows]) => {
      const amounts = flows.map((f) => f.amount);
      const avgAmount =
        amounts.reduce((sum, amt) => sum + amt, 0) / amounts.length;

      // Simple growth rate calculation (could be more sophisticated)
      const recentFlows = flows.slice(-6); // Last 6 entries
      const oldFlows = flows.slice(0, 6); // First 6 entries

      let growthRate = 0;
      if (oldFlows.length > 0 && recentFlows.length > 0) {
        const oldAvg =
          oldFlows.reduce((sum, f) => sum + f.amount, 0) / oldFlows.length;
        const recentAvg =
          recentFlows.reduce((sum, f) => sum + f.amount, 0) /
          recentFlows.length;
        growthRate = oldAvg !== 0 ? (recentAvg - oldAvg) / Math.abs(oldAvg) : 0;
      }

      // Confidence based on consistency
      const variance =
        amounts.reduce((sum, amt) => sum + Math.pow(amt - avgAmount, 2), 0) /
        amounts.length;
      const stdDev = Math.sqrt(variance);
      const confidence = Math.max(
        0.3,
        Math.min(0.95, 1 - stdDev / Math.abs(avgAmount))
      );

      patterns[subcategory] = {
        avgAmount,
        growthRate: Math.max(-0.5, Math.min(0.5, growthRate)), // Cap growth rate
        confidence,
      };
    });

    return patterns;
  }

  private static calculateForecastConfidence(patterns: {
    [key: string]: { confidence: number };
  }): "high" | "medium" | "low" {
    const confidences = Object.values(patterns).map((p) => p.confidence);
    const avgConfidence =
      confidences.reduce((sum, c) => sum + c, 0) / confidences.length;

    if (avgConfidence > 0.8) return "high";
    if (avgConfidence > 0.6) return "medium";
    return "low";
  }

  /**
   * Calculate working capital
   */
  static calculateWorkingCapital(
    currentAssets: number,
    currentLiabilities: number
  ): number {
    return currentAssets - currentLiabilities;
  }

  /**
   * Calculate debt service coverage ratio
   */
  static calculateDebtServiceCoverage(
    netOperatingIncome: number,
    totalDebtService: number
  ): number {
    return totalDebtService > 0 ? netOperatingIncome / totalDebtService : 0;
  }

  /**
   * Asset valuation with depreciation
   */
  static calculateTotalAssetValue(
    assets: FixedAsset[],
    currentDate: Date = new Date()
  ): number {
    return assets.reduce((total, asset) => {
      if (asset.status === "disposed" || asset.status === "sold") return total;
      return total + this.calculateBookValue(asset, currentDate);
    }, 0);
  }

  /**
   * Cash flow analysis by period
   */
  static analyzeCashFlowByPeriod(
    cashFlows: CashFlow[],
    startDate: Date,
    endDate: Date
  ): {
    operating: number;
    investing: number;
    financing: number;
    netCashFlow: number;
  } {
    const periodFlows = cashFlows.filter((cf) => {
      const cfDate = new Date(cf.date);
      return cfDate >= startDate && cfDate <= endDate;
    });

    const operating = periodFlows
      .filter((cf) => cf.category === "operating")
      .reduce((sum, cf) => sum + cf.amount, 0);

    const investing = periodFlows
      .filter((cf) => cf.category === "investing")
      .reduce((sum, cf) => sum + cf.amount, 0);

    const financing = periodFlows
      .filter((cf) => cf.category === "financing")
      .reduce((sum, cf) => sum + cf.amount, 0);

    return {
      operating,
      investing,
      financing,
      netCashFlow: operating + investing + financing,
    };
  }
}
