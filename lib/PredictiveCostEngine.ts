import {
  ProductionOrder,
  PinMaterial,
  CostPrediction,
  PredictionFactor,
  RiskAssessment,
  RiskFactor,
  PinBOM,
} from "../types";

/**
 * Cấp 3: AI-Powered Cost Prediction Engine
 * Analyzes historical production data to predict costs before production starts
 */

class PredictiveCostEngine {
  private historicalOrders: ProductionOrder[];
  private materials: PinMaterial[];
  private learningRate = 0.1;
  private minHistoricalData = 3; // Minimum orders needed for prediction

  constructor(historicalOrders: ProductionOrder[], materials: PinMaterial[]) {
    this.historicalOrders = historicalOrders.filter(
      (order) => order.status === "Hoàn thành" && order.costAnalysis
    );
    this.materials = materials;
  }

  /**
   * Main prediction function - generates cost prediction for a new production order
   */
  public predictCost(order: ProductionOrder, bom: PinBOM): CostPrediction {
    const historicalSimilarOrders = this.findSimilarOrders(order);

    if (historicalSimilarOrders.length < this.minHistoricalData) {
      return this.createBasicPrediction(order, bom);
    }

    const predictionFactors = this.analyzePredictionFactors(
      order,
      bom,
      historicalSimilarOrders
    );
    const predictedCost = this.calculatePredictedCost(
      order,
      predictionFactors,
      historicalSimilarOrders
    );
    const riskAssessment = this.assessRisk(
      order,
      bom,
      predictedCost,
      historicalSimilarOrders
    );
    const confidence = this.calculateConfidence(
      historicalSimilarOrders,
      predictionFactors
    );

    return {
      orderId: order.id,
      predictedTotalCost: predictedCost,
      confidenceLevel: confidence,
      basedOnHistoricalOrders: historicalSimilarOrders.length,
      predictionFactors,
      riskAssessment,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Find similar historical orders for comparison
   */
  private findSimilarOrders(targetOrder: ProductionOrder): ProductionOrder[] {
    return this.historicalOrders
      .map((order) => ({
        order,
        similarity: this.calculateSimilarity(targetOrder, order),
      }))
      .filter((item) => item.similarity > 0.3) // 30% similarity threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10) // Top 10 most similar orders
      .map((item) => item.order);
  }

  /**
   * Calculate similarity score between two orders
   */
  private calculateSimilarity(
    order1: ProductionOrder,
    order2: ProductionOrder
  ): number {
    let similarity = 0;
    let factors = 0;

    // Product name similarity (40% weight)
    if (order1.productName === order2.productName) {
      similarity += 0.4;
    } else if (
      order1.productName
        .toLowerCase()
        .includes(order2.productName.toLowerCase()) ||
      order2.productName
        .toLowerCase()
        .includes(order1.productName.toLowerCase())
    ) {
      similarity += 0.2;
    }
    factors += 0.4;

    // Quantity similarity (30% weight)
    const quantityRatio =
      Math.min(order1.quantityProduced, order2.quantityProduced) /
      Math.max(order1.quantityProduced, order2.quantityProduced);
    similarity += quantityRatio * 0.3;
    factors += 0.3;

    // BOM similarity (30% weight)
    if (order1.bomId === order2.bomId) {
      similarity += 0.3;
    }
    factors += 0.3;

    return similarity / factors;
  }

  /**
   * Analyze prediction factors that influence cost
   */
  private analyzePredictionFactors(
    order: ProductionOrder,
    bom: PinBOM,
    similarOrders: ProductionOrder[]
  ): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    // Material price trend analysis
    const materialTrend = this.analyzeMaterialPriceTrend(bom);
    factors.push({
      factor: "material_price_trend",
      impact:
        materialTrend > 0.05
          ? "negative"
          : materialTrend < -0.05
          ? "positive"
          : "neutral",
      weight: 0.3,
      description: `Giá NVL ${materialTrend > 0 ? "tăng" : "giảm"} ${(
        Math.abs(materialTrend) * 100
      ).toFixed(1)}% so với trung bình`,
    });

    // Supplier reliability analysis
    const supplierReliability = this.analyzeSupplierReliability(bom);
    factors.push({
      factor: "supplier_reliability",
      impact:
        supplierReliability > 0.8
          ? "positive"
          : supplierReliability < 0.6
          ? "negative"
          : "neutral",
      weight: 0.2,
      description: `Độ tin cậy nhà cung cấp: ${(
        supplierReliability * 100
      ).toFixed(0)}%`,
    });

    // Complexity level analysis
    const complexityLevel = this.analyzeComplexity(bom);
    factors.push({
      factor: "complexity_level",
      impact:
        complexityLevel > 0.7
          ? "negative"
          : complexityLevel < 0.3
          ? "positive"
          : "neutral",
      weight: 0.25,
      description: `Độ phức tạp sản phẩm: ${
        complexityLevel > 0.7
          ? "cao"
          : complexityLevel < 0.3
          ? "thấp"
          : "trung bình"
      }`,
    });

    // Team efficiency analysis
    const teamEfficiency = this.analyzeTeamEfficiency(similarOrders);
    factors.push({
      factor: "team_efficiency",
      impact:
        teamEfficiency > 1.1
          ? "positive"
          : teamEfficiency < 0.9
          ? "negative"
          : "neutral",
      weight: 0.25,
      description: `Hiệu suất team: ${(teamEfficiency * 100).toFixed(
        0
      )}% so với mục tiêu`,
    });

    return factors;
  }

  /**
   * Calculate predicted cost based on factors and historical data
   */
  private calculatePredictedCost(
    order: ProductionOrder,
    factors: PredictionFactor[],
    similarOrders: ProductionOrder[]
  ): number {
    // Base cost from similar orders
    const averageVarianceRatio =
      similarOrders.reduce(
        (sum, order) => sum + order.costAnalysis!.actualCost / order.totalCost,
        0
      ) / similarOrders.length;

    let basePredictedCost = order.totalCost * averageVarianceRatio;

    // Apply prediction factors
    for (const factor of factors) {
      let adjustment = 0;

      switch (factor.impact) {
        case "positive":
          adjustment = -0.05 * factor.weight; // 5% improvement weighted by factor importance
          break;
        case "negative":
          adjustment = 0.1 * factor.weight; // 10% increase weighted by factor importance
          break;
        case "neutral":
          adjustment = 0;
          break;
      }

      basePredictedCost *= 1 + adjustment;
    }

    return Math.round(basePredictedCost);
  }

  /**
   * Assess risk factors for the production order
   */
  private assessRisk(
    order: ProductionOrder,
    bom: PinBOM,
    predictedCost: number,
    similarOrders: ProductionOrder[]
  ): RiskAssessment {
    const riskFactors: RiskFactor[] = [];

    // Budget overrun risk
    const costVarianceRisk =
      (predictedCost - order.totalCost) / order.totalCost;
    if (costVarianceRisk > 0.05) {
      riskFactors.push({
        type: "budget_overrun",
        severity:
          costVarianceRisk > 0.2
            ? "critical"
            : costVarianceRisk > 0.1
            ? "high"
            : "medium",
        probability: Math.min(0.9, costVarianceRisk * 2),
        description: `Chi phí dự kiến vượt ngân sách ${(
          costVarianceRisk * 100
        ).toFixed(1)}%`,
        impact: predictedCost - order.totalCost,
      });
    }

    // Material shortage risk
    const shortageRisk = this.assessMaterialShortageRisk(
      bom,
      order.quantityProduced
    );
    if (shortageRisk.probability > 0.3) {
      riskFactors.push({
        type: "material_shortage",
        severity: shortageRisk.probability > 0.7 ? "critical" : "high",
        probability: shortageRisk.probability,
        description: shortageRisk.description,
        impact: shortageRisk.estimatedCostImpact,
      });
    }

    // Capacity constraint risk
    const capacityRisk = this.assessCapacityRisk(order, similarOrders);
    if (capacityRisk > 0.4) {
      riskFactors.push({
        type: "capacity_constraint",
        severity: capacityRisk > 0.8 ? "critical" : "medium",
        probability: capacityRisk,
        description: `Rủi ro về năng lực sản xuất trong thời gian peak`,
        impact: order.totalCost * 0.15, // Estimated 15% cost increase due to delays
      });
    }

    const overallRisk = this.calculateOverallRisk(riskFactors);
    const mitigationSuggestions =
      this.generateMitigationSuggestions(riskFactors);

    return {
      overallRisk,
      riskFactors,
      mitigationSuggestions,
    };
  }

  /**
   * Helper methods for specific analyses
   */
  private analyzeMaterialPriceTrend(bom: PinBOM): number {
    // Simulate material price trend analysis
    // In real implementation, this would analyze historical material prices
    const recentOrders = this.historicalOrders.slice(-5);
    if (recentOrders.length < 2) return 0;

    const avgOldCost =
      recentOrders
        .slice(0, 2)
        .reduce(
          (sum, order) => sum + (order.costAnalysis?.materialVariance || 0),
          0
        ) / 2;
    const avgRecentCost =
      recentOrders
        .slice(-2)
        .reduce(
          (sum, order) => sum + (order.costAnalysis?.materialVariance || 0),
          0
        ) / 2;

    return avgOldCost !== 0
      ? (avgRecentCost - avgOldCost) / Math.abs(avgOldCost)
      : 0;
  }

  private analyzeSupplierReliability(bom: PinBOM): number {
    // Simulate supplier reliability based on historical performance
    // Random value between 0.6 and 0.95 for simulation
    return 0.6 + Math.random() * 0.35;
  }

  private analyzeComplexity(bom: PinBOM): number {
    // Complexity based on number of materials and their types
    const materialCount = bom.materials.length;
    if (materialCount <= 3) return 0.2;
    if (materialCount <= 6) return 0.5;
    return 0.8;
  }

  private analyzeTeamEfficiency(similarOrders: ProductionOrder[]): number {
    if (similarOrders.length === 0) return 1.0;

    const efficiencies = similarOrders.map(
      (order) =>
        order.totalCost / (order.costAnalysis?.actualCost || order.totalCost)
    );

    return (
      efficiencies.reduce((sum, eff) => sum + eff, 0) / efficiencies.length
    );
  }

  private assessMaterialShortageRisk(
    bom: PinBOM,
    quantityToProduce: number
  ): {
    probability: number;
    description: string;
    estimatedCostImpact: number;
  } {
    let totalRisk = 0;
    let riskCount = 0;
    let totalImpact = 0;

    for (const bomMaterial of bom.materials) {
      const material = this.materials.find(
        (m) => m.id === bomMaterial.materialId
      );
      if (!material) continue;

      const requiredQuantity = bomMaterial.quantity * quantityToProduce;
      const availableStock =
        (material.stock || 0) - (material.committedQuantity || 0);

      if (requiredQuantity > availableStock) {
        const shortfall = requiredQuantity - availableStock;
        const riskLevel = shortfall / requiredQuantity;
        totalRisk += riskLevel;
        totalImpact += shortfall * (material.purchasePrice || 0) * 1.2; // 20% premium for urgent procurement
        riskCount++;
      }
    }

    const avgRisk = riskCount > 0 ? totalRisk / riskCount : 0;

    return {
      probability: Math.min(1, avgRisk),
      description:
        riskCount > 0
          ? `${riskCount} nguyên vật liệu có nguy cơ thiếu hụt`
          : "Đủ nguyên vật liệu cho sản xuất",
      estimatedCostImpact: totalImpact,
    };
  }

  private assessCapacityRisk(
    order: ProductionOrder,
    similarOrders: ProductionOrder[]
  ): number {
    // Simulate capacity risk based on current workload
    // In real implementation, this would analyze current production schedule
    const currentMonth = new Date().getMonth();
    const peakMonths = [10, 11, 0, 1]; // Nov, Dec, Jan, Feb (holiday season)

    return peakMonths.includes(currentMonth) ? 0.7 : 0.2;
  }

  private calculateOverallRisk(
    riskFactors: RiskFactor[]
  ): "low" | "medium" | "high" | "critical" {
    if (riskFactors.length === 0) return "low";

    const avgSeverity =
      riskFactors.reduce((sum, factor) => {
        const severityScore = { low: 1, medium: 2, high: 3, critical: 4 };
        return sum + severityScore[factor.severity];
      }, 0) / riskFactors.length;

    if (avgSeverity >= 3.5) return "critical";
    if (avgSeverity >= 2.5) return "high";
    if (avgSeverity >= 1.5) return "medium";
    return "low";
  }

  private generateMitigationSuggestions(riskFactors: RiskFactor[]): string[] {
    const suggestions: string[] = [];

    for (const factor of riskFactors) {
      switch (factor.type) {
        case "budget_overrun":
          suggestions.push(
            "Xem xét tối ưu hóa quy trình hoặc thương lượng giá với nhà cung cấp"
          );
          break;
        case "material_shortage":
          suggestions.push(
            "Đặt hàng bổ sung nguyên vật liệu hoặc tìm nhà cung cấp thay thế"
          );
          break;
        case "capacity_constraint":
          suggestions.push("Xem xét gia hạn deadline hoặc tăng cường nhân lực");
          break;
        case "supplier_delay":
          suggestions.push("Liên hệ nhà cung cấp xác nhận delivery schedule");
          break;
        case "quality_risk":
          suggestions.push("Tăng cường quality control và testing");
          break;
      }
    }

    return Array.from(new Set(suggestions)); // Remove duplicates
  }

  private createBasicPrediction(
    order: ProductionOrder,
    bom: PinBOM
  ): CostPrediction {
    // When insufficient historical data, provide basic prediction
    const basicVariance = 1.05; // Assume 5% typical overrun

    return {
      orderId: order.id,
      predictedTotalCost: Math.round(order.totalCost * basicVariance),
      confidenceLevel: 0.6, // Lower confidence due to limited data
      basedOnHistoricalOrders: this.historicalOrders.length,
      predictionFactors: [
        {
          factor: "material_price_trend",
          impact: "neutral",
          weight: 0.5,
          description: "Chưa đủ dữ liệu lịch sử để phân tích chi tiết",
        },
      ],
      riskAssessment: {
        overallRisk: "medium",
        riskFactors: [],
        mitigationSuggestions: [
          "Thu thập thêm dữ liệu lịch sử để cải thiện độ chính xác dự đoán",
        ],
      },
      lastUpdated: new Date().toISOString(),
    };
  }

  private calculateConfidence(
    similarOrders: ProductionOrder[],
    factors: PredictionFactor[]
  ): number {
    let confidence = 0.5; // Base confidence

    // More historical data = higher confidence
    const dataFactor = Math.min(1, similarOrders.length / 10);
    confidence += dataFactor * 0.3;

    // Factor reliability
    const factorReliability =
      factors.reduce((sum, factor) => sum + factor.weight, 0) / factors.length;
    confidence += factorReliability * 0.2;

    return Math.min(1, confidence);
  }

  /**
   * Update the engine with new completed order data
   */
  public updateWithNewData(completedOrder: ProductionOrder): void {
    if (completedOrder.status === "Hoàn thành" && completedOrder.costAnalysis) {
      this.historicalOrders.push(completedOrder);

      // Keep only recent data (last 100 orders) to maintain relevance
      if (this.historicalOrders.length > 100) {
        this.historicalOrders = this.historicalOrders.slice(-100);
      }
    }
  }
}

export default PredictiveCostEngine;
