// Installment Service - Quản lý trả góp với Supabase
import { supabase, isSupabaseConfigured } from "../../supabaseClient";
import type { InstallmentPlan, InstallmentPayment, PinSale } from "../../types";

const STORAGE_KEY = "pin_installment_plans";

export class InstallmentService {
  /**
   * Lấy tất cả kế hoạch trả góp
   */
  static async getAllInstallmentPlans(): Promise<InstallmentPlan[]> {
    try {
      if (isSupabaseConfigured()) {
        // Fetch from Supabase
        const { data: plans, error } = await supabase
          .from("pin_installment_plans")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) throw error;

        if (plans && plans.length > 0) {
          // Fetch payments for each plan
          const plansWithPayments = await Promise.all(
            plans.map(async (plan) => {
              const { data: payments } = await supabase
                .from("pin_installment_payments")
                .select("*")
                .eq("installment_plan_id", plan.id)
                .order("payment_number", { ascending: true });

              const installmentPlan: InstallmentPlan = {
                id: plan.id,
                saleId: plan.sale_id,
                customerId: plan.customer_id,
                customerName: plan.customer_name || "",
                customerPhone: plan.customer_phone || "",
                totalAmount: Number(plan.total_amount),
                downPayment: Number(plan.down_payment),
                remainingAmount: Number(plan.remaining_balance),
                numberOfInstallments: plan.terms,
                monthlyPayment: Number(plan.monthly_amount),
                interestRate: Number(plan.interest_rate) || 0,
                startDate: plan.start_date,
                endDate: plan.end_date || "",
                status: plan.status,
                payments: (payments || []).map((p) => ({
                  id: p.id,
                  installmentPlanId: p.installment_plan_id,
                  periodNumber: p.payment_number,
                  dueDate: p.due_date,
                  amount: Number(p.amount),
                  status: p.status,
                  paidAmount: Number(p.paid_amount) || 0,
                  paidDate: p.paid_date,
                })),
              };

              return this.checkOverdue(installmentPlan);
            })
          );

          return plansWithPayments;
        }
        return [];
      } else {
        // Fallback to localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const plans = JSON.parse(stored) as InstallmentPlan[];
          return plans.map((plan) => this.checkOverdue(plan));
        }
        return [];
      }
    } catch (error) {
      console.error("Error loading installment plans:", error);
      // Fallback to localStorage on error
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const plans = JSON.parse(stored) as InstallmentPlan[];
        return plans.map((plan) => this.checkOverdue(plan));
      }
      return [];
    }
  }

  /**
   * Lưu kế hoạch trả góp
   */
  static async saveInstallmentPlan(plan: InstallmentPlan): Promise<boolean> {
    try {
      if (isSupabaseConfigured()) {
        // Save to Supabase
        const planData = {
          id: plan.id || `INST-${plan.saleId}`,
          sale_id: plan.saleId,
          customer_id: plan.customerId,
          total_amount: plan.totalAmount,
          down_payment: plan.downPayment,
          terms: plan.numberOfInstallments,
          monthly_amount: plan.monthlyPayment,
          interest_rate: plan.interestRate || 0,
          start_date: plan.startDate,
          status: plan.status,
          remaining_balance: plan.remainingAmount,
          updated_at: new Date().toISOString(),
        };

        const { error: planError } = await supabase
          .from("pin_installment_plans")
          .upsert(planData, { onConflict: "id" });

        if (planError) throw planError;

        // Save payments
        if (plan.payments && plan.payments.length > 0) {
          const paymentsData = plan.payments.map((p) => ({
            id: p.id,
            installment_plan_id: plan.id || `INST-${plan.saleId}`,
            payment_number: p.periodNumber,
            due_date: p.dueDate,
            amount: p.amount,
            status: p.status,
            paid_amount: p.paidAmount || 0,
            paid_date: p.paidDate || null,
            updated_at: new Date().toISOString(),
          }));

          const { error: paymentsError } = await supabase
            .from("pin_installment_payments")
            .upsert(paymentsData, { onConflict: "id" });

          if (paymentsError) throw paymentsError;
        }

        // Also save to localStorage as backup
        this.saveToLocalStorage(plan);
        return true;
      } else {
        // Save to localStorage only
        return this.saveToLocalStorage(plan);
      }
    } catch (error) {
      console.error("Error saving installment plan:", error);
      // Fallback to localStorage
      return this.saveToLocalStorage(plan);
    }
  }

  /**
   * Lưu vào localStorage (backup)
   */
  private static saveToLocalStorage(plan: InstallmentPlan): boolean {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const plans = stored ? JSON.parse(stored) : [];
      const existingIndex = plans.findIndex((p: InstallmentPlan) => p.saleId === plan.saleId);

      if (existingIndex >= 0) {
        plans[existingIndex] = plan;
      } else {
        plans.push(plan);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
      return true;
    } catch (error) {
      console.error("Error saving to localStorage:", error);
      return false;
    }
  }

  /**
   * Lấy kế hoạch trả góp theo saleId
   */
  static async getInstallmentBySaleId(saleId: string): Promise<InstallmentPlan | null> {
    const plans = await this.getAllInstallmentPlans();
    return plans.find((p) => p.saleId === saleId) || null;
  }

  /**
   * Lấy các kế hoạch trả góp của khách hàng
   */
  static async getCustomerInstallments(customerId: string): Promise<InstallmentPlan[]> {
    const plans = await this.getAllInstallmentPlans();
    return plans.filter((p) => p.customerId === customerId);
  }

  /**
   * Tạo kế hoạch trả góp mới
   */
  static createInstallmentPlan(
    sale: PinSale,
    downPayment: number,
    terms: number,
    interestRate: number = 0
  ): InstallmentPlan {
    const remainingAmount = sale.total - downPayment;
    // Lãi suất tính theo công thức: còn lại * (1 + lãi suất % * số tháng / 100)
    const totalWithInterest = remainingAmount * (1 + (interestRate * terms) / 100);
    const monthlyPayment = Math.ceil(totalWithInterest / terms);

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + terms);
    const planId = `INST-${sale.id}`;

    // Tạo các kỳ thanh toán
    const payments: InstallmentPayment[] = [];
    for (let i = 1; i <= terms; i++) {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      payments.push({
        id: `IP-${sale.id}-${i}`,
        installmentPlanId: planId,
        periodNumber: i,
        dueDate: dueDate.toISOString(),
        amount:
          i === terms
            ? totalWithInterest - monthlyPayment * (terms - 1) // Kỳ cuối lấy phần còn lại
            : monthlyPayment,
        status: "pending",
        paidAmount: 0,
      });
    }

    return {
      id: planId,
      saleId: sale.id,
      customerId: sale.customer?.id || "",
      customerName: sale.customer?.name || "",
      customerPhone: sale.customer?.phone || "",
      totalAmount: sale.total,
      downPayment,
      remainingAmount: remainingAmount,
      numberOfInstallments: terms,
      monthlyPayment: monthlyPayment,
      interestRate,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      status: "active",
      payments,
    };
  }

  /**
   * Tính số tiền tất toán sớm (có thể giảm lãi)
   */
  static calculateEarlySettlement(
    remainingBalance: number,
    remainingTerms: number,
    discountRate: number = 5 // Giảm 5% cho mỗi kỳ còn lại
  ): { discountedAmount: number; discount: number } {
    // Tính giảm giá dựa trên số kỳ còn lại
    const discountPercent = Math.min(remainingTerms * discountRate, 30); // Tối đa 30%
    const discount = Math.floor((remainingBalance * discountPercent) / 100);
    const discountedAmount = remainingBalance - discount;

    return {
      discountedAmount: Math.ceil(discountedAmount),
      discount,
    };
  }

  /**
   * Ghi nhận thanh toán 1 kỳ
   */
  static async recordPayment(
    saleId: string,
    periodNumber: number,
    paidAmount: number
  ): Promise<InstallmentPlan | null> {
    const plan = await this.getInstallmentBySaleId(saleId);
    if (!plan) return null;

    const updatedPayments = plan.payments.map((payment) => {
      if (payment.periodNumber === periodNumber) {
        return {
          ...payment,
          paidAmount,
          paidDate: new Date().toISOString(),
          status: paidAmount >= payment.amount ? "paid" : "partial",
        } as InstallmentPayment;
      }
      return payment;
    });

    // Tính tổng tiền phải trả góp (có lãi) = tổng các kỳ
    const totalInstallmentAmount = plan.payments.reduce((sum, p) => sum + p.amount, 0);

    // Tính tổng đã trả = tổng các kỳ đã paid
    const totalPaid = updatedPayments
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + p.amount, 0);

    // Số tiền còn lại = tổng phải trả - đã trả
    const remainingAmount = totalInstallmentAmount - totalPaid;

    console.log("📊 Tính toán trả góp:", {
      saleId,
      periodNumber,
      paidAmount,
      totalInstallmentAmount,
      totalPaid,
      remainingAmount,
      numberOfPayments: plan.payments.length,
      paidPayments: updatedPayments.filter((p) => p.status === "paid").length,
    });

    // Kiểm tra đã thanh toán hết chưa
    const allPaid = updatedPayments.every((p) => p.status === "paid");

    const updatedPlan: InstallmentPlan = {
      ...plan,
      payments: updatedPayments,
      remainingAmount: Math.max(0, remainingAmount),
      status: allPaid ? "completed" : plan.status,
    };

    await this.saveInstallmentPlan(updatedPlan);
    return updatedPlan;
  }

  /**
   * Tất toán sớm
   */
  static async settleEarly(saleId: string): Promise<InstallmentPlan | null> {
    const plan = await this.getInstallmentBySaleId(saleId);
    if (!plan) return null;

    // Đánh dấu tất cả các kỳ chưa trả là "paid"
    const updatedPayments = plan.payments.map((payment) => {
      if (
        payment.status === "pending" ||
        payment.status === "partial" ||
        payment.status === "overdue"
      ) {
        return {
          ...payment,
          paidAmount: payment.amount,
          paidDate: new Date().toISOString(),
          status: "paid",
        } as InstallmentPayment;
      }
      return payment;
    });

    const updatedPlan: InstallmentPlan = {
      ...plan,
      payments: updatedPayments,
      status: "completed",
      remainingBalance: 0,
    };

    await this.saveInstallmentPlan(updatedPlan);
    return updatedPlan;
  }

  /**
   * Kiểm tra và cập nhật trạng thái quá hạn
   */
  static checkOverdue(plan: InstallmentPlan): InstallmentPlan {
    if (plan.status === "completed" || plan.status === "cancelled") {
      return plan;
    }

    const now = new Date();
    let hasOverdue = false;

    const updatedPayments = plan.payments.map((payment) => {
      if (
        (payment.status === "pending" || payment.status === "partial") &&
        new Date(payment.dueDate) < now
      ) {
        hasOverdue = true;
        return { ...payment, status: "overdue" } as InstallmentPayment;
      }
      return payment;
    });

    return {
      ...plan,
      payments: updatedPayments,
      status: hasOverdue ? "overdue" : plan.status,
    };
  }

  /**
   * Lấy tổng hợp các khoản trả góp theo tháng
   */
  static getMonthlySchedule(plans: InstallmentPlan[]): Map<string, InstallmentPayment[]> {
    const schedule = new Map<string, InstallmentPayment[]>();

    plans.forEach((plan) => {
      plan.payments.forEach((payment) => {
        const monthKey = payment.dueDate.substring(0, 7); // YYYY-MM
        const existing = schedule.get(monthKey) || [];
        existing.push(payment);
        schedule.set(monthKey, existing);
      });
    });

    return schedule;
  }

  /**
   * Lấy các khoản đến hạn trong tháng này
   */
  static getDueThisMonth(plans: InstallmentPlan[]): InstallmentPayment[] {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const duePayments: InstallmentPayment[] = [];

    plans.forEach((plan) => {
      if (plan.status === "active" || plan.status === "overdue") {
        plan.payments.forEach((payment) => {
          const paymentMonth = payment.dueDate.substring(0, 7);
          if (paymentMonth === thisMonth && payment.status !== "paid") {
            duePayments.push(payment);
          }
        });
      }
    });

    return duePayments.sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
  }

  /**
   * Tính tổng doanh thu trả góp dự kiến
   */
  static calculateTotalExpectedRevenue(plans: InstallmentPlan[]): number {
    return plans.reduce((total, plan) => {
      if (plan.status === "active" || plan.status === "overdue") {
        const unpaidAmount = plan.payments
          .filter((p) => p.status !== "paid")
          .reduce((sum, p) => sum + p.amount, 0);
        return total + unpaidAmount;
      }
      return total;
    }, 0);
  }
}
