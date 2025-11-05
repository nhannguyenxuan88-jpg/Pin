import {
  PinMaterial,
  ProductionOrder,
  InventoryForecast,
  DemandProjection,
  ReorderRecommendation,
  PinBOM,
} from "../types";

/**
 * Cấp 3: Smart Inventory Analytics System
 * Provides intelligent inventory management with demand forecasting and automated alerts
 */

class SmartInventoryAnalytics {
  private materials: PinMaterial[];
  private productionOrders: ProductionOrder[];
  private boms: PinBOM[];
  private historicalConsumption: Map<string, number[]> = new Map();

  constructor(
    materials: PinMaterial[],
    productionOrders: ProductionOrder[],
    boms: PinBOM[]
  ) {
    this.materials = materials;
    this.productionOrders = productionOrders;
    this.boms = boms;
    this.buildHistoricalConsumption();
  }

  /**
   * Generate comprehensive inventory forecast for all materials
   */
  public generateInventoryForecast(): InventoryForecast[] {
    return this.materials.map((material) => this.forecastMaterial(material));
  }

  /**
   * Generate forecast for a specific material
   */
  public forecastMaterial(material: PinMaterial): InventoryForecast {
    const projectedDemand = this.calculateProjectedDemand(material.id);
    const currentStock =
      (material.stock || 0) - (material.committedQuantity || 0);
    const reorderPoint = this.calculateReorderPoint(material);
    const optimalOrderQuantity = this.calculateOptimalOrderQuantity(material);
    const stockoutRisk = this.calculateStockoutRisk(material, projectedDemand);
    const recommendedAction = this.generateReorderRecommendation(
      material,
      currentStock,
      reorderPoint,
      stockoutRisk,
      optimalOrderQuantity
    );

    return {
      materialId: material.id,
      currentStock,
      projectedDemand,
      reorderPoint,
      optimalOrderQuantity,
      stockoutRisk,
      recommendedAction,
    };
  }

  /**
   * Get critical inventory alerts that need immediate attention
   */
  public getCriticalAlerts(): InventoryForecast[] {
    const forecasts = this.generateInventoryForecast();
    return forecasts.filter(
      (forecast) =>
        forecast.recommendedAction.action === "immediate" ||
        forecast.stockoutRisk > 0.7 ||
        forecast.recommendedAction.urgencyLevel === "critical"
    );
  }

  /**
   * Calculate projected demand for next 30 days
   */
  private calculateProjectedDemand(materialId: string): DemandProjection[] {
    const projections: DemandProjection[] = [];
    const today = new Date();

    // Get all active and pending orders that will consume this material
    const activeOrders = this.productionOrders.filter(
      (order) => order.status === "Đang chờ" || order.status === "Đang sản xuất"
    );

    // Project demand for next 30 days (weekly intervals)
    for (let week = 0; week < 4; week++) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + week * 7);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);

      let weeklyDemand = 0;
      const contributingOrders: string[] = [];

      // Calculate demand from scheduled orders
      for (const order of activeOrders) {
        const bom = this.boms.find((b) => b.id === order.bomId);
        if (!bom) continue;

        const materialInBom = bom.materials.find(
          (m) => m.materialId === materialId
        );
        if (!materialInBom) continue;

        // Estimate when this order will consume materials (simplified)
        const orderCreated = new Date(order.creationDate);
        const estimatedProductionStart = new Date(orderCreated);
        estimatedProductionStart.setDate(orderCreated.getDate() + 1); // Assume 1 day lead time

        if (
          estimatedProductionStart >= weekStart &&
          estimatedProductionStart < weekEnd
        ) {
          weeklyDemand += materialInBom.quantity * order.quantityProduced;
          contributingOrders.push(order.id);
        }
      }

      // Add historical trend analysis
      const historicalAvg = this.getHistoricalWeeklyAverage(materialId);
      const seasonalAdjustment = this.getSeasonalAdjustment(weekStart);
      const trendAdjustedDemand =
        weeklyDemand + historicalAvg * seasonalAdjustment;

      projections.push({
        date: weekStart.toISOString().split("T")[0],
        projectedDemand: Math.round(trendAdjustedDemand),
        confidence: this.calculateDemandConfidence(
          contributingOrders.length,
          historicalAvg
        ),
        basedOnOrders: contributingOrders,
      });
    }

    return projections;
  }

  /**
   * Calculate optimal reorder point using safety stock formula
   */
  private calculateReorderPoint(material: PinMaterial): number {
    const averageDailyDemand = this.getAverageDailyDemand(material.id);
    const leadTimeDays = 7; // Assume 7 days supplier lead time
    const safetyStockDays = 3; // 3 days safety stock
    const demandVariability = this.getDemandVariability(material.id);

    // Reorder Point = (Average Daily Demand × Lead Time) + Safety Stock
    const baseDemand = averageDailyDemand * leadTimeDays;
    const safetyStock =
      averageDailyDemand * safetyStockDays * (1 + demandVariability);

    return Math.ceil(baseDemand + safetyStock);
  }

  /**
   * Calculate optimal order quantity using Economic Order Quantity (EOQ)
   */
  private calculateOptimalOrderQuantity(material: PinMaterial): number {
    const annualDemand = this.getAnnualDemand(material.id);
    const orderingCost = 100000; // VND - estimated cost per order (admin, shipping, etc.)
    const holdingCostRate = 0.2; // 20% of item value per year
    const itemCost = material.purchasePrice || 1000;
    const holdingCost = itemCost * holdingCostRate;

    // EOQ = √(2 × Annual Demand × Ordering Cost / Holding Cost)
    const eoq = Math.sqrt((2 * annualDemand * orderingCost) / holdingCost);

    // Minimum order of 10 units, maximum of 1000
    return Math.max(10, Math.min(1000, Math.ceil(eoq)));
  }

  /**
   * Calculate stockout risk probability
   */
  private calculateStockoutRisk(
    material: PinMaterial,
    projectedDemand: DemandProjection[]
  ): number {
    const currentAvailableStock =
      (material.stock || 0) - (material.committedQuantity || 0);
    const totalProjectedDemand = projectedDemand.reduce(
      (sum, proj) => sum + proj.projectedDemand,
      0
    );

    if (currentAvailableStock <= 0) return 1.0; // Already out of stock
    if (totalProjectedDemand === 0) return 0.1; // Minimal risk if no projected demand

    const coverageRatio = currentAvailableStock / totalProjectedDemand;

    if (coverageRatio >= 1.5) return 0.1; // Low risk - 150%+ coverage
    if (coverageRatio >= 1.0) return 0.3; // Medium risk - 100-150% coverage
    if (coverageRatio >= 0.5) return 0.6; // High risk - 50-100% coverage
    return 0.9; // Critical risk - less than 50% coverage
  }

  /**
   * Generate reorder recommendation
   */
  private generateReorderRecommendation(
    material: PinMaterial,
    currentStock: number,
    reorderPoint: number,
    stockoutRisk: number,
    optimalQuantity: number
  ): ReorderRecommendation {
    let action: ReorderRecommendation["action"] = "no_action_needed";
    let urgencyLevel: ReorderRecommendation["urgencyLevel"] = "low";
    let reasonCode = "STOCK_ADEQUATE";
    let recommendedQuantity = 0;

    if (currentStock <= 0) {
      action = "immediate";
      urgencyLevel = "critical";
      reasonCode = "OUT_OF_STOCK";
      recommendedQuantity = optimalQuantity * 2; // Emergency order
    } else if (stockoutRisk > 0.8) {
      action = "immediate";
      urgencyLevel = "critical";
      reasonCode = "CRITICAL_LOW_STOCK";
      recommendedQuantity = optimalQuantity;
    } else if (currentStock <= reorderPoint) {
      action = "within_week";
      urgencyLevel = "high";
      reasonCode = "BELOW_REORDER_POINT";
      recommendedQuantity = optimalQuantity;
    } else if (stockoutRisk > 0.5) {
      action = "within_month";
      urgencyLevel = "medium";
      reasonCode = "PROJECTED_SHORTAGE";
      recommendedQuantity = Math.ceil(optimalQuantity * 0.7);
    }

    const estimatedCost = recommendedQuantity * (material.purchasePrice || 0);

    return {
      action,
      recommendedQuantity,
      urgencyLevel,
      reasonCode,
      estimatedCost,
      preferredSupplierId: material.supplier || "default-supplier",
    };
  }

  /**
   * Helper methods for calculations
   */
  private buildHistoricalConsumption(): void {
    // Build historical consumption data from completed orders
    const completedOrders = this.productionOrders.filter(
      (order) =>
        order.status === "Hoàn thành" && order.actualCosts?.materialCosts
    );

    for (const order of completedOrders) {
      const materialCosts = order.actualCosts?.materialCosts || [];

      for (const materialCost of materialCosts) {
        const consumption =
          this.historicalConsumption.get(materialCost.materialId) || [];
        consumption.push(
          materialCost.actualQuantityUsed || materialCost.quantity
        );
        this.historicalConsumption.set(materialCost.materialId, consumption);
      }
    }
  }

  private getAverageDailyDemand(materialId: string): number {
    const consumption = this.historicalConsumption.get(materialId) || [];
    if (consumption.length === 0) return 1; // Default minimal demand

    const totalConsumption = consumption.reduce((sum, qty) => sum + qty, 0);
    const avgOrderConsumption = totalConsumption / consumption.length;

    // Estimate orders per day (simplified)
    const ordersPerDay = Math.max(0.1, this.productionOrders.length / 90); // Last 90 days

    return avgOrderConsumption * ordersPerDay;
  }

  private getDemandVariability(materialId: string): number {
    const consumption = this.historicalConsumption.get(materialId) || [];
    if (consumption.length < 2) return 0.3; // Default 30% variability

    const mean =
      consumption.reduce((sum, qty) => sum + qty, 0) / consumption.length;
    const variance =
      consumption.reduce((sum, qty) => sum + Math.pow(qty - mean, 2), 0) /
      consumption.length;
    const standardDeviation = Math.sqrt(variance);

    return mean > 0 ? standardDeviation / mean : 0.3;
  }

  private getAnnualDemand(materialId: string): number {
    return this.getAverageDailyDemand(materialId) * 365;
  }

  private getHistoricalWeeklyAverage(materialId: string): number {
    return this.getAverageDailyDemand(materialId) * 7;
  }

  private getSeasonalAdjustment(date: Date): number {
    // Simplified seasonal adjustment
    const month = date.getMonth();

    // Higher demand in Q4 (Oct-Dec) and Q1 (Jan-Mar)
    if (month >= 9 || month <= 2) return 1.2; // 20% increase
    if (month >= 6 && month <= 8) return 0.8; // 20% decrease in summer

    return 1.0; // Normal demand
  }

  private calculateDemandConfidence(
    scheduledOrders: number,
    historicalAverage: number
  ): number {
    let confidence = 0.5; // Base confidence

    // More scheduled orders = higher confidence
    if (scheduledOrders > 0) {
      confidence += Math.min(0.4, scheduledOrders * 0.1);
    }

    // Historical data availability
    if (historicalAverage > 0) {
      confidence += 0.2;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Update analytics with new data
   */
  public updateData(
    materials: PinMaterial[],
    productionOrders: ProductionOrder[],
    boms: PinBOM[]
  ): void {
    this.materials = materials;
    this.productionOrders = productionOrders;
    this.boms = boms;
    this.buildHistoricalConsumption();
  }

  /**
   * Get materials that need immediate attention
   */
  public getUrgentMaterials(): PinMaterial[] {
    const forecasts = this.generateInventoryForecast();
    const urgentForecastIds = forecasts
      .filter(
        (forecast) =>
          forecast.recommendedAction.urgencyLevel === "critical" ||
          forecast.recommendedAction.action === "immediate"
      )
      .map((forecast) => forecast.materialId);

    return this.materials.filter((material) =>
      urgentForecastIds.includes(material.id)
    );
  }

  /**
   * Generate summary statistics
   */
  public getInventorySummary(): {
    totalMaterials: number;
    criticalLowStock: number;
    adequateStock: number;
    overStock: number;
    totalValueAtRisk: number;
  } {
    const forecasts = this.generateInventoryForecast();

    let criticalLowStock = 0;
    let adequateStock = 0;
    let overStock = 0;
    let totalValueAtRisk = 0;

    for (const forecast of forecasts) {
      const material = this.materials.find((m) => m.id === forecast.materialId);
      const materialValue =
        (material?.purchasePrice || 0) * forecast.currentStock;

      if (forecast.stockoutRisk > 0.7) {
        criticalLowStock++;
        totalValueAtRisk += materialValue;
      } else if (forecast.currentStock > forecast.optimalOrderQuantity * 3) {
        overStock++;
      } else {
        adequateStock++;
      }
    }

    return {
      totalMaterials: this.materials.length,
      criticalLowStock,
      adequateStock,
      overStock,
      totalValueAtRisk,
    };
  }
}

export default SmartInventoryAnalytics;
