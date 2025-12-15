import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction, InstallmentPlan, InstallmentPayment } from "../types";
import DebtCollectionModal from "./DebtCollectionModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import { Card, StatsCard, CardGrid, type StatsCardProps } from "./ui/Card";
import { DataTable } from "./ui/Table";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Icon, type IconName } from "./common/Icon";
import { InstallmentService } from "../lib/services/InstallmentService";

interface Row {
  id: string;
  date: string;
  customerName: string;
  customerPhone?: string;
  title: string;
  summary?: string;
  details: string[];
  technician?: string;
  kind?: "workorder" | "sale";
  amount: number;
  paid: number;
  debt: number;
}

interface SupplierRow {
  id: string;
  date: string;
  customerName: string;
  title: string;
  details: string[];
  amount: number;
  paid: number;
  debt: number;
  ordersCount?: number;
}

interface InstallmentRow {
  id: string;
  saleId: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  downPayment: number;
  terms: number;
  monthlyAmount: number;
  interestRate: number;
  startDate: string;
  status: "active" | "completed" | "overdue" | "cancelled";
  remainingBalance: number;
  paidTerms: number;
  nextDueDate?: string;
  overdueAmount: number;
  payments: InstallmentPayment[];
}

const fmt = (val: number) => val.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export default function ReceivablesNew() {
  const { pinSales, cashTransactions, suppliers, currentUser, addCashTransaction } =
    usePinContext();

  const ctx = usePinContext();
  const workOrders = ctx.pinRepairOrders || [];
  const sales = pinSales || [];
  const goodsReceipts = (ctx as any).goodsReceipts || [];
  const currentBranchId = (ctx as any).currentBranchId;

  const [activeTab, setActiveTab] = useState<"customers" | "suppliers" | "installments">(
    "customers"
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);
  const [preSelectedDebtId, setPreSelectedDebtId] = useState<string | undefined>(undefined);
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  const [showInstallmentPayModal, setShowInstallmentPayModal] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<InstallmentRow | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [showEarlySettleModal, setShowEarlySettleModal] = useState(false);
  const [showInstallmentReceipt, setShowInstallmentReceipt] = useState(false);
  const [installmentReceiptData, setInstallmentReceiptData] = useState<{
    installmentInfo: InstallmentRow;
    paidAmount: number;
    paymentDate: string;
    paymentMethod: string;
    periodNumber: number;
    remainingBalance: number;
  } | null>(null);

  // Load installment plans
  useEffect(() => {
    const loadInstallments = async () => {
      const plans = await InstallmentService.getAllInstallmentPlans();
      setInstallmentPlans(plans);
    };
    loadInstallments();
  }, []);

  // Calculate customer receivables (from workorders and sales)
  const customerRows = useMemo(() => {
    const paidByWO = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.type !== "income" || !t.workOrderId) continue;
      if (currentBranchId && t.branchId !== currentBranchId) continue;
      paidByWO.set(t.workOrderId, (paidByWO.get(t.workOrderId) || 0) + (Number(t.amount) || 0));
    }
    const paidBySale = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.type !== "income" || !t.saleId) continue;
      if (currentBranchId && t.branchId !== currentBranchId) continue;
      paidBySale.set(t.saleId, (paidBySale.get(t.saleId) || 0) + (Number(t.amount) || 0));
    }

    const arr: Row[] = [];

    for (const wo of workOrders || []) {
      if (currentBranchId && (wo as any).branchId && (wo as any).branchId !== currentBranchId)
        continue;

      // Only show debt for completed/returned orders
      const status = (wo as any).status;
      if (status !== "Trả máy" && status !== "Đã sửa xong") continue;

      const total = Number((wo as any).total ?? 0);
      if (total <= 0) continue;

      // Calculate paid based on paymentStatus or manually calculate
      let paid = 0;
      let debt = 0;

      const paymentStatus = (wo as any).paymentStatus;
      const depositAmount = Number((wo as any).depositAmount ?? 0);

      if (paymentStatus === "paid") {
        // Fully paid, no debt - skip
        continue;
      } else if (paymentStatus === "partial" || paymentStatus === "unpaid") {
        // Partial payment or unpaid - include deposit
        const partialPayment = Number((wo as any).partialPaymentAmount ?? 0);
        paid = depositAmount + partialPayment;
        debt = Math.max(0, total - paid);
      } else {
        // Unknown payment status - calculate from all sources
        const paidFromCash = paidByWO.get(wo.id) || 0;
        const paidFromPartial = Number((wo as any).partialPaymentAmount ?? 0);
        paid = depositAmount + paidFromCash + paidFromPartial;
        debt = Math.max(0, total - paid);
      }

      if (debt <= 0) continue;

      const details: string[] = [];
      if ((wo as any).deviceModel) details.push(`Thiết bị: ${(wo as any).deviceModel}`);
      if ((wo as any).issueDescription) details.push(`Vấn đề: ${(wo as any).issueDescription}`);
      if ((wo as any).partsUsed?.length) {
        const p = (wo as any).partsUsed
          .slice(0, 3)
          .map((x: any) => x.partName || x.part_name)
          .join(", ");
        details.push(`Linh kiện: ${p}`);
      }

      arr.push({
        id: wo.id,
        date: (wo as any).createdDate || (wo as any).created_at || new Date().toISOString(),
        customerName: (wo as any).customerName || "",
        customerPhone: (wo as any).customerPhone,
        title: `Phiếu sửa chữa: ${wo.id}`,
        summary: (wo as any).issueDescription,
        details,
        technician: (wo as any).technician,
        kind: "workorder",
        amount: total,
        paid,
        debt,
      });
    }

    for (const sale of sales || []) {
      if (currentBranchId && (sale as any).branchId && (sale as any).branchId !== currentBranchId)
        continue;
      const total = Number((sale as any).total ?? 0);
      if (total <= 0) continue;

      // Check payment status first - skip fully paid sales and installment sales (handled in installments tab)
      const paymentStatus = (sale as any).paymentStatus;
      if (paymentStatus === "paid" || paymentStatus === "installment") continue;

      // Calculate paid amount from sale record first, then fallback to cash transactions
      const salePaidAmount = Number((sale as any).paidAmount ?? 0);
      const cashTxPaid = paidBySale.get(sale.id) || 0;
      // Use the higher of the two (in case cash transaction was created but paidAmount not updated)
      const paid = Math.max(salePaidAmount, cashTxPaid);
      const debt = Math.max(0, total - paid);
      if (debt <= 0) continue;

      const details: string[] = [];
      if ((sale as any).items?.length) {
        const items = (sale as any).items.slice(0, 3).map((itm: any) => {
          const name = itm.name || itm.productName || itm.product_name || "Sản phẩm";
          const qty = itm.quantity || 1;
          const price = itm.sellingPrice || 0;
          return `${name} (${qty} x ${price.toLocaleString("vi-VN")}đ)`;
        });
        details.push(...items);
        if ((sale as any).items.length > 3) {
          details.push(`... và ${(sale as any).items.length - 3} sản phẩm khác`);
        }
      }

      // Get customer info from sale.customer object
      const customerObj = (sale as any).customer;
      const customerName =
        typeof customerObj === "object"
          ? customerObj?.name || ""
          : (sale as any).customerName || "";
      const customerPhone =
        typeof customerObj === "object"
          ? customerObj?.phone || ""
          : (sale as any).customerPhone || "";

      arr.push({
        id: sale.id,
        date:
          (sale as any).date ||
          (sale as any).saleDate ||
          (sale as any).created_at ||
          new Date().toISOString(),
        customerName,
        customerPhone,
        title: `Đơn hàng: ${sale.code || sale.id}`,
        details,
        kind: "sale",
        amount: total,
        paid,
        debt,
      });
    }

    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [workOrders, sales, cashTransactions, currentBranchId]);

  // Calculate supplier payables (from goods receipts)
  const supplierRows = useMemo(() => {
    const totalBySup = new Map<string, { total: number; latest: string; count: number }>();
    for (const gr of goodsReceipts || []) {
      if (!gr) continue;
      if (currentBranchId && (gr as any).branchId && (gr as any).branchId !== currentBranchId)
        continue;
      const prev = totalBySup.get(gr.supplierId) || {
        total: 0,
        latest: (gr as any).receivedDate || (gr as any).created_at || new Date().toISOString(),
        count: 0,
      };
      prev.total += Number((gr as any).totalAmount ?? 0);
      prev.count += 1;
      const d = new Date(
        (gr as any).receivedDate || (gr as any).created_at || new Date().toISOString()
      );
      const l = new Date(prev.latest);
      if (d.getTime() > l.getTime()) prev.latest = d.toISOString();
      totalBySup.set(gr.supplierId, prev);
    }

    const paidBySup = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.type !== "expense") continue;
      if (t.category && t.category !== "inventory_purchase") continue;
      if (currentBranchId && t.branchId !== currentBranchId) continue;
      const key = t.contact?.id || t.contact?.name;
      if (!key) continue;
      paidBySup.set(key, (paidBySup.get(key) || 0) + (Number(t.amount) || 0));
    }

    const arr: SupplierRow[] = [];
    for (const [supId, info] of totalBySup.entries()) {
      const sup = (suppliers || []).find((s: any) => s.id === supId);
      const name = sup?.name || supId;
      const paid = paidBySup.get(supId) || 0;
      const debt = Math.max(0, (info.total || 0) - paid);
      if (debt <= 0) continue;
      arr.push({
        id: supId,
        date: info.latest,
        customerName: name,
        title: `NCC: ${name}`,
        details: [
          `Số đơn nhập: ${info.count}`,
          `Lần nhập gần nhất: ${new Date(info.latest).toLocaleDateString("vi-VN")}`,
        ],
        amount: info.total,
        paid,
        debt,
        ordersCount: info.count,
      });
    }
    return arr.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [goodsReceipts, cashTransactions, suppliers, currentBranchId]);

  // Calculate installment rows
  const installmentRows = useMemo(() => {
    const customers = (ctx as any).pinCustomers || [];
    return installmentPlans
      .filter((plan) => plan.status !== "completed" && plan.status !== "cancelled")
      .map((plan) => {
        const customer = customers.find((c: any) => c.id === plan.customerId);
        const paidTerms = plan.payments?.filter((p) => p.status === "paid").length || 0;
        const today = new Date();

        // Calculate overdue amount
        let overdueAmount = 0;
        let nextDueDate: string | undefined;

        if (plan.payments) {
          for (const payment of plan.payments) {
            if (payment.status === "pending" || payment.status === "overdue") {
              const dueDate = new Date(payment.dueDate);
              if (dueDate < today && payment.status !== "paid") {
                overdueAmount += payment.amount - (payment.paidAmount || 0);
              }
              if (!nextDueDate && dueDate >= today) {
                nextDueDate = payment.dueDate;
              }
            }
          }
        }

        // Tính số tiền còn lại CHÍNH XÁC từ các kỳ thanh toán
        const totalInstallmentAmount = (plan.payments || []).reduce((sum, p) => sum + p.amount, 0);
        const totalPaid = (plan.payments || [])
          .filter((p) => p.status === "paid")
          .reduce((sum, p) => sum + p.amount, 0);
        const actualRemainingBalance = totalInstallmentAmount - totalPaid;

        return {
          id: plan.id || plan.saleId,
          saleId: plan.saleId,
          customerId: plan.customerId,
          customerName: customer?.name || plan.customerName || "Khách hàng",
          customerPhone: customer?.phone || plan.customerPhone,
          totalAmount: plan.totalAmount,
          downPayment: plan.downPayment,
          terms: plan.numberOfInstallments,
          monthlyAmount: plan.monthlyPayment,
          interestRate: plan.interestRate || 0,
          startDate: plan.startDate,
          status: plan.status,
          remainingBalance: actualRemainingBalance, // Dùng số tiền tính từ payments thay vì field cũ
          paidTerms,
          nextDueDate,
          overdueAmount,
          payments: plan.payments || [],
        } as InstallmentRow;
      })
      .sort((a, b) => {
        // Sort by overdue first, then by next due date
        if (a.overdueAmount > 0 && b.overdueAmount === 0) return -1;
        if (a.overdueAmount === 0 && b.overdueAmount > 0) return 1;
        return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      });
  }, [installmentPlans, ctx]);

  // Filter by search query
  const customerFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customerRows;
    return customerRows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone?.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
    );
  }, [customerRows, query]);

  const supplierFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return supplierRows;
    return supplierRows.filter(
      (r) => r.customerName.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)
    );
  }, [supplierRows, query]);

  const installmentFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return installmentRows;
    return installmentRows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone?.toLowerCase().includes(q) ||
        r.saleId.toLowerCase().includes(q)
    );
  }, [installmentRows, query]);

  const activeList: Array<Row | SupplierRow | InstallmentRow> =
    activeTab === "customers"
      ? customerFiltered
      : activeTab === "suppliers"
        ? supplierFiltered
        : installmentFiltered;

  // Calculate stats
  const totalCustomerDebt = customerRows.reduce((s, r) => s + r.debt, 0);
  const totalSupplierDebt = supplierRows.reduce((s, r) => s + r.debt, 0);
  const totalInstallmentDebt = installmentRows.reduce((s, r) => s + r.remainingBalance, 0);
  const totalDebt =
    activeTab === "installments"
      ? installmentFiltered.reduce((s, r) => s + r.remainingBalance, 0)
      : (activeList as Array<Row | SupplierRow>).reduce((s, r) => s + r.debt, 0);

  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedDebt = activeList
    .filter((r: any) => selectedIds.includes(r.id))
    .reduce((s, r: any) => s + r.debt, 0);

  const activeSummaryCards = useMemo<
    Array<{
      title: string;
      value: string | number;
      iconName: IconName;
      variant: StatsCardProps["variant"];
    }>
  >(() => {
    if (activeTab === "customers") {
      const uniqueCustomers = new Set(
        customerRows.map((row) => `${row.customerPhone || ""}-${row.customerName || ""}`)
      ).size;
      const pendingOrders = customerRows.filter((row) => row.kind === "workorder").length;

      return [
        {
          title: "Tổng công nợ KH",
          value: `${fmt(totalCustomerDebt)} đ`,
          iconName: "money",
          variant: "danger",
        },
        {
          title: "Khách hàng đang nợ",
          value: uniqueCustomers,
          iconName: "customers",
          variant: "primary",
        },
        {
          title: "Phiếu sửa chưa thu",
          value: pendingOrders,
          iconName: "orders",
          variant: "warning",
        },
      ];
    }

    const pendingReceipts = supplierRows.reduce((sum, row) => sum + (row.ordersCount || 0), 0);

    return [
      {
        title: "Tổng công nợ NCC",
        value: `${fmt(totalSupplierDebt)} đ`,
        iconName: "money",
        variant: "danger",
      },
      {
        title: "Nhà cung cấp đang nợ",
        value: supplierRows.length,
        iconName: "stock",
        variant: "primary",
      },
      {
        title: "Đơn nhập chưa thanh toán",
        value: pendingReceipts,
        iconName: "orders",
        variant: "warning",
      },
    ];
  }, [activeTab, customerRows, supplierRows, totalCustomerDebt, totalSupplierDebt]);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) activeList.forEach((r: any) => (next[r.id] = true));
    setSelected(next);
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelected((p) => ({ ...p, [id]: checked }));
  };

  const handleCollectAllSelected = async () => {
    if (!currentUser) {
      alert("Vui lòng đăng nhập để thực hiện thao tác");
      return;
    }
    if (selectedDebt <= 0) return;
    if (
      !window.confirm(`Xác nhận thu đủ cho ${selectedIds.length} đơn, tổng ${fmt(selectedDebt)} đ?`)
    ) {
      return;
    }

    const now = new Date().toISOString();

    if (activeTab === "customers") {
      // Collect from customers
      for (const row of customerFiltered.filter((r) => selectedIds.includes(r.id))) {
        const amount = row.debt;
        if (amount <= 0) continue;
        const tx: CashTransaction = {
          id: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "income",
          date: now,
          amount,
          contact: {
            id: row.customerPhone || row.customerName,
            name: row.customerName,
          },
          notes: `Thu nợ cho ${
            row.kind === "workorder" ? "phiếu sửa chữa" : "đơn hàng"
          } #${row.id} #app:pincorp`,
          paymentSourceId: "cash",
          branchId: currentBranchId,
          category: row.kind === "workorder" ? "service_income" : "sale_income",
          ...(row.kind === "workorder" ? { workOrderId: row.id } : { saleId: row.id }),
        };
        await addCashTransaction(tx);
      }
      setSelected({});
      alert("Đã ghi nhận thu nợ cho các đơn đã chọn.");
    } else {
      // Pay suppliers
      for (const row of supplierFiltered.filter((r) => selectedIds.includes(r.id))) {
        const amount = row.debt;
        if (amount <= 0) continue;
        const tx: CashTransaction = {
          id: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: "expense",
          date: now,
          amount,
          contact: {
            id: row.id,
            name: row.customerName,
          },
          notes: `Thanh toán công nợ NCC ${row.customerName} #app:pincorp`,
          paymentSourceId: "cash",
          branchId: currentBranchId,
          category: "inventory_purchase",
        };
        await addCashTransaction(tx);
      }
      setSelected({});
      alert("Đã ghi nhận thanh toán cho các nhà cung cấp đã chọn.");
    }
  };

  // Handle installment payment
  const handleInstallmentPayment = async () => {
    if (!selectedInstallment || paymentAmount <= 0) return;

    // Find the next unpaid payment
    const nextPayment = selectedInstallment.payments.find(
      (p) => p.status === "pending" || p.status === "overdue"
    );

    if (!nextPayment) {
      alert("Không tìm thấy kỳ thanh toán cần trả");
      return;
    }

    const result = await InstallmentService.recordPayment(
      selectedInstallment.saleId,
      nextPayment.periodNumber,
      paymentAmount
    );

    if (result) {
      // Record cash transaction
      const tx: CashTransaction = {
        id: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "income",
        date: new Date().toISOString(),
        amount: paymentAmount,
        contact: {
          id: selectedInstallment.customerId,
          name: selectedInstallment.customerName,
        },
        notes: `Thu tiền trả góp kỳ ${nextPayment.periodNumber}/${selectedInstallment.terms} - Đơn hàng ${selectedInstallment.saleId}`,
        paymentSourceId: "cash",
        branchId: currentBranchId,
        category: "sale_income",
        saleId: selectedInstallment.saleId,
      };
      await addCashTransaction(tx);

      // Reload installments
      const plans = await InstallmentService.getAllInstallmentPlans();
      setInstallmentPlans(plans);

      // Save receipt data for printing
      setInstallmentReceiptData({
        installmentInfo: selectedInstallment,
        paidAmount: paymentAmount,
        paymentDate: new Date().toISOString(),
        paymentMethod: paymentMethod,
        periodNumber: nextPayment.periodNumber,
        remainingBalance: selectedInstallment.remainingBalance - paymentAmount,
      });
      setShowInstallmentReceipt(true);

      setShowInstallmentPayModal(false);
      setSelectedInstallment(null);
      setPaymentAmount(0);
    }
  };

  // Handle early settlement
  const handleEarlySettlement = async () => {
    if (!selectedInstallment) return;

    const { discountedAmount } = InstallmentService.calculateEarlySettlement(
      selectedInstallment.remainingBalance,
      selectedInstallment.terms - selectedInstallment.paidTerms
    );

    if (
      !window.confirm(
        `Xác nhận tất toán sớm?\n\nSố tiền còn lại: ${fmt(selectedInstallment.remainingBalance)}đ\nGiảm giá tất toán sớm: ${fmt(selectedInstallment.remainingBalance - discountedAmount)}đ\nSố tiền cần thanh toán: ${fmt(discountedAmount)}đ`
      )
    ) {
      return;
    }

    const result = await InstallmentService.settleEarly(selectedInstallment.saleId);

    if (result) {
      // Record cash transaction
      const tx: CashTransaction = {
        id: `CT-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: "income",
        date: new Date().toISOString(),
        amount: discountedAmount,
        contact: {
          id: selectedInstallment.customerId,
          name: selectedInstallment.customerName,
        },
        notes: `Tất toán sớm trả góp - Đơn hàng ${selectedInstallment.saleId}`,
        paymentSourceId: "cash",
        branchId: currentBranchId,
        category: "sale_income",
        saleId: selectedInstallment.saleId,
      };
      await addCashTransaction(tx);

      // Reload installments
      const plans = await InstallmentService.getAllInstallmentPlans();
      setInstallmentPlans(plans);

      setShowEarlySettleModal(false);
      setSelectedInstallment(null);
      alert("Đã tất toán sớm thành công!");
    }
  };

  // DataTable columns for customers
  const customerColumns = [
    {
      key: "select" as const,
      label: "",
      width: "40px",
      render: (row: Row) => (
        <input
          type="checkbox"
          checked={!!selected[row.id]}
          onChange={(e) => toggleOne(row.id, e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
      ),
    },
    {
      key: "customerName" as const,
      label: "Khách hàng",
      sortable: true,
      render: (row: Row) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-100">{row.customerName}</div>
          {row.customerPhone && <div className="text-sm text-slate-500">{row.customerPhone}</div>}
          <div className="text-xs text-blue-600">{row.title}</div>
          <div className="text-xs text-slate-500">
            {new Date(row.date).toLocaleDateString("vi-VN")}
          </div>
        </div>
      ),
    },
    {
      key: "details" as const,
      label: "Chi tiết",
      render: (row: Row) => (
        <div className="space-y-1 max-w-md">
          {row.summary && (
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              {row.summary}
            </div>
          )}
          {row.details.length > 0 && (
            <ul className="space-y-0.5 text-xs">
              {row.details.map((d, i) => (
                <li key={i} className="text-slate-600 dark:text-slate-400 flex items-start">
                  <span className="text-blue-500 mr-1">•</span>
                  <span className="flex-1">{d}</span>
                </li>
              ))}
            </ul>
          )}
          {row.technician && (
            <div className="text-xs text-slate-500 mt-1 italic">
              <Icon name="user" className="w-3 h-3 inline mr-1" />
              {row.technician}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "amount" as const,
      label: "Tổng tiền",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: Row) => (
        <div className="text-right">
          <span className="font-medium text-slate-800 dark:text-slate-100">{fmt(row.amount)}</span>
        </div>
      ),
    },
    {
      key: "paid" as const,
      label: "Đã trả",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: Row) => (
        <div className="text-right">
          <span className="text-slate-600 dark:text-slate-400">{fmt(row.paid)}</span>
        </div>
      ),
    },
    {
      key: "debt" as const,
      label: "Còn nợ",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: Row) => (
        <div className="text-right">
          <span className="font-bold text-rose-600">{fmt(row.debt)}</span>
        </div>
      ),
    },
  ];

  // DataTable columns for suppliers
  const supplierColumns = [
    {
      key: "select" as const,
      label: "",
      width: "40px",
      render: (row: SupplierRow) => (
        <input
          type="checkbox"
          checked={!!selected[row.id]}
          onChange={(e) => toggleOne(row.id, e.target.checked)}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
      ),
    },
    {
      key: "customerName" as const,
      label: "Nhà cung cấp",
      sortable: true,
      render: (row: SupplierRow) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-100">{row.customerName}</div>
          <div className="text-xs text-blue-600">{row.title}</div>
          <div className="text-xs text-slate-500">
            {new Date(row.date).toLocaleDateString("vi-VN")}
          </div>
        </div>
      ),
    },
    {
      key: "details" as const,
      label: "Chi tiết",
      render: (row: SupplierRow) => (
        <div className="space-y-0.5">
          {row.details.map((d, i) => (
            <div key={i} className="text-sm text-slate-600 dark:text-slate-400">
              {d}
            </div>
          ))}
        </div>
      ),
    },
    {
      key: "amount" as const,
      label: "Tổng tiền",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: SupplierRow) => (
        <div className="text-right">
          <span className="font-medium text-slate-800 dark:text-slate-100">{fmt(row.amount)}</span>
        </div>
      ),
    },
    {
      key: "paid" as const,
      label: "Đã trả",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: SupplierRow) => (
        <div className="text-right">
          <span className="text-slate-600 dark:text-slate-400">{fmt(row.paid)}</span>
        </div>
      ),
    },
    {
      key: "debt" as const,
      label: "Còn nợ",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: SupplierRow) => (
        <div className="text-right">
          <span className="font-bold text-rose-600">{fmt(row.debt)}</span>
        </div>
      ),
    },
  ];

  // DataTable columns for installments
  const installmentColumns = [
    {
      key: "customerName" as const,
      label: "Khách hàng",
      sortable: true,
      render: (row: InstallmentRow) => (
        <div className="space-y-1">
          <div className="font-semibold text-slate-100">{row.customerName}</div>
          {row.customerPhone && <div className="text-sm text-slate-400">{row.customerPhone}</div>}
          <div className="text-xs text-sky-400">Đơn: {row.saleId}</div>
          <div className="text-xs text-slate-400">
            Bắt đầu: {new Date(row.startDate).toLocaleDateString("vi-VN")}
          </div>
        </div>
      ),
    },
    {
      key: "terms" as const,
      label: "Kỳ hạn",
      render: (row: InstallmentRow) => (
        <div className="space-y-1">
          <div className="text-sm">
            <span className="font-semibold text-emerald-500">{row.paidTerms}</span>
            <span className="text-slate-400 dark:text-slate-300">/{row.terms} kỳ</span>
          </div>
          <div className="text-xs text-sky-400">Mỗi kỳ: {fmt(row.monthlyAmount)}đ</div>
          {row.interestRate > 0 && (
            <div className="text-xs text-amber-400">Lãi suất: {row.interestRate}%</div>
          )}
          {row.nextDueDate && (
            <div className="text-xs text-slate-300">
              Kỳ tiếp: {new Date(row.nextDueDate).toLocaleDateString("vi-VN")}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "status" as const,
      label: "Trạng thái",
      render: (row: InstallmentRow) => (
        <div className="space-y-1">
          <Badge
            variant={
              row.overdueAmount > 0
                ? "danger"
                : row.status === "active"
                  ? "success"
                  : row.status === "completed"
                    ? "primary"
                    : "secondary"
            }
          >
            {row.overdueAmount > 0
              ? "Quá hạn"
              : row.status === "active"
                ? "Đang trả góp"
                : row.status === "completed"
                  ? "Hoàn tất"
                  : row.status}
          </Badge>
          {row.overdueAmount > 0 && (
            <div className="text-xs text-rose-600 font-semibold">
              Quá hạn: {fmt(row.overdueAmount)}đ
            </div>
          )}
        </div>
      ),
    },
    {
      key: "totalAmount" as const,
      label: "Tổng tiền",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: InstallmentRow) => (
        <div className="text-right space-y-1">
          <div className="font-medium text-slate-100">{fmt(row.totalAmount)}đ</div>
          {row.downPayment > 0 && (
            <div className="text-xs text-emerald-400">Trả trước: {fmt(row.downPayment)}đ</div>
          )}
        </div>
      ),
    },
    {
      key: "remainingBalance" as const,
      label: "Còn lại",
      sortable: true,
      align: "right" as const,
      width: "120px",
      render: (row: InstallmentRow) => (
        <div className="text-right">
          <span className="font-bold text-orange-400">{fmt(row.remainingBalance)}đ</span>
        </div>
      ),
    },
    {
      key: "actions" as const,
      label: "",
      width: "150px",
      render: (row: InstallmentRow) => (
        <div className="flex gap-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setSelectedInstallment(row);
              setPaymentAmount(row.monthlyAmount);
              setShowInstallmentPayModal(true);
            }}
            className="text-xs px-2 py-1"
          >
            <Icon name="money" size="sm" tone="contrast" className="mr-1" />
            Thu tiền
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setSelectedInstallment(row);
              setShowEarlySettleModal(true);
            }}
            className="text-xs px-2 py-1"
            title="Tất toán sớm"
          >
            <Icon name="success" size="sm" tone="muted" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-2 md:p-4 lg:p-6 space-y-3 animate-fade-in pb-20 md:pb-6">
      {/* Header with inline Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg md:text-xl font-bold text-slate-800 dark:text-slate-100">
            Quản lý Công Nợ
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Theo dõi công nợ khách hàng và nhà cung cấp
          </p>
        </div>

        {/* Compact Stats - inline with header */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-3 py-2 rounded-xl min-w-[100px]">
            <div className="text-xs opacity-80">Tổng công nợ</div>
            <div className="text-sm font-bold">
              {fmt(totalCustomerDebt + totalSupplierDebt + totalInstallmentDebt)} đ
            </div>
            <div className="text-[10px] opacity-70">
              ↗{customerRows.length + supplierRows.length + installmentRows.length} khoản
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-3 py-2 rounded-xl min-w-[100px]">
            <div className="text-xs opacity-80">Công nợ KH</div>
            <div className="text-sm font-bold">{fmt(totalCustomerDebt)} đ</div>
            <div className="text-[10px] opacity-70">↗{customerRows.length} khoản</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-3 py-2 rounded-xl min-w-[100px]">
            <div className="text-xs opacity-80">Công nợ NCC</div>
            <div className="text-sm font-bold">{fmt(totalSupplierDebt)} đ</div>
            <div className="text-[10px] opacity-70">↗{supplierRows.length} khoản</div>
          </div>
          <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white px-3 py-2 rounded-xl min-w-[100px]">
            <div className="text-xs opacity-80">Trả góp</div>
            <div className="text-sm font-bold">{fmt(totalInstallmentDebt)} đ</div>
            <div className="text-[10px] opacity-70">↗{installmentRows.length} khoản</div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card padding="sm">
        {/* Tab, Search and Actions - Compact single row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          {/* Tab buttons */}
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            <button
              onClick={() => {
                setActiveTab("customers");
                setSelected({});
              }}
              className={`flex-shrink-0 flex items-center px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === "customers"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                name="customers"
                size="sm"
                tone={activeTab === "customers" ? "primary" : "muted"}
                className="mr-1"
              />
              Công nợKH ({customerRows.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("suppliers");
                setSelected({});
              }}
              className={`flex-shrink-0 flex items-center px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === "suppliers"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                name="stock"
                size="sm"
                tone={activeTab === "suppliers" ? "primary" : "muted"}
                className="mr-1"
              />
              Công nợNCC ({supplierRows.length})
            </button>
            <button
              onClick={() => {
                setActiveTab("installments");
                setSelected({});
              }}
              className={`flex-shrink-0 flex items-center px-2 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === "installments"
                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
            >
              <Icon
                name="calendar"
                size="sm"
                tone={activeTab === "installments" ? "primary" : "muted"}
                className="mr-1"
              />
              Trả góp ({installmentRows.length})
            </button>
          </div>

          {/* Search - compact */}
          <div className="flex-1 relative">
            <Icon
              name="search"
              size="sm"
              tone="muted"
              className="absolute left-2 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder={
                activeTab === "customers"
                  ? "Tìm theo tên, SĐT..."
                  : activeTab === "suppliers"
                    ? "Tìm theo tên nhà cung cấp..."
                    : "Tìm theo tên khách hàng, mã đơn..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Total and Action */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Tổng: <span className="font-semibold text-rose-600">{fmt(totalDebt)} đ</span>
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (activeTab === "customers") {
                  const firstSelectedId = selectedIds.length === 1 ? selectedIds[0] : undefined;
                  setPreSelectedDebtId(firstSelectedId);
                  setShowCollectModal(true);
                } else {
                  setShowSupplierPayModal(true);
                }
              }}
              className="whitespace-nowrap text-xs px-2 py-1"
            >
              <Icon
                name={activeTab === "customers" ? "success" : "money"}
                size="sm"
                tone="contrast"
                className="mr-1"
              />
              {activeTab === "customers" ? "Thu nợ" : "Thanh toán"}
            </Button>
          </div>
        </div>
        {/* Bulk Actions - only show when items selected */}
        {selectedIds.length > 0 && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            <span className="text-slate-600 dark:text-slate-400">
              Đã chọn {selectedIds.length} ({fmt(selectedDebt)} đ)
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCollectAllSelected}
              className="text-xs px-2 py-1"
            >
              <Icon name="success" size="sm" tone="contrast" className="mr-1" />
              {activeTab === "customers" ? "Thu nợ" : "Thanh toán"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSelected({})}
              className="text-xs px-2 py-1"
            >
              Xóa chọn
            </Button>
          </div>
        )}

        {/* DataTable */}
        <div className="mt-2">
          <DataTable
            data={activeList}
            columns={
              activeTab === "customers"
                ? (customerColumns as any)
                : activeTab === "suppliers"
                  ? (supplierColumns as any)
                  : (installmentColumns as any)
            }
            keyExtractor={(row: any) => row.id}
            emptyMessage={
              activeTab === "installments" ? "Không có khoản trả góp" : "Không có công nợ"
            }
          />
        </div>
      </Card>

      {/* Modals */}
      <DebtCollectionModal
        open={showCollectModal}
        onClose={() => {
          setShowCollectModal(false);
          setPreSelectedDebtId(undefined);
        }}
        preSelectedDebtId={preSelectedDebtId}
      />
      <SupplierPaymentModal
        open={showSupplierPayModal}
        onClose={() => setShowSupplierPayModal(false)}
      />

      {/* Installment Payment Modal */}
      {showInstallmentPayModal && selectedInstallment && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                💰 Thu tiền trả góp
              </h3>
              <p className="text-purple-100 text-sm mt-1">
                Ghi nhận thanh toán kỳ {selectedInstallment.paidTerms + 1}
              </p>
            </div>

            <div className="p-6 space-y-5">
              {/* Customer Info Card */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-600">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                      Khách hàng
                    </div>
                    <div className="font-bold text-lg text-slate-800 dark:text-slate-100">
                      {selectedInstallment.customerName}
                    </div>
                    {selectedInstallment.customerPhone && (
                      <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1 mt-1">
                        📞 {selectedInstallment.customerPhone}
                      </div>
                    )}
                  </div>
                  <div className="bg-purple-100 dark:bg-purple-900/30 px-3 py-1 rounded-full">
                    <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      Kỳ {selectedInstallment.paidTerms + 1}/{selectedInstallment.terms}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-300 dark:border-slate-600">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Đơn hàng</div>
                    <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
                      {selectedInstallment.saleId}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Mỗi kỳ</div>
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {fmt(selectedInstallment.monthlyAmount)}đ
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Còn phải trả</div>
                    <div className="text-xl font-bold text-rose-600 dark:text-rose-400">
                      {fmt(selectedInstallment.remainingBalance)}đ
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  💵 Số tiền thanh toán
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    placeholder="Nhập số tiền..."
                    className="w-full px-4 py-3 pr-12 border-2 border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-lg font-semibold focus:border-purple-500 dark:focus:border-purple-400 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900/30 transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium">
                    đ
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setPaymentAmount(selectedInstallment.monthlyAmount)}
                    className="flex-1 px-3 py-1.5 text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                  >
                    Đúng kỳ ({fmt(selectedInstallment.monthlyAmount)}đ)
                  </button>
                  <button
                    onClick={() => setPaymentAmount(selectedInstallment.remainingBalance)}
                    className="flex-1 px-3 py-1.5 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                  >
                    Tất toán ({fmt(selectedInstallment.remainingBalance)}đ)
                  </button>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  💳 Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      paymentMethod === "cash"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-green-400"
                    }`}
                  >
                    <span className="text-2xl">💵</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold">Tiền mặt</div>
                      <div className="text-xs opacity-75">Cash</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 transition-all ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                        : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:border-blue-400"
                    }`}
                  >
                    <span className="text-2xl">🏦</span>
                    <div className="text-left">
                      <div className="text-sm font-semibold">Chuyển khoản</div>
                      <div className="text-xs opacity-75">Bank Transfer</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setShowInstallmentPayModal(false);
                  setSelectedInstallment(null);
                  setPaymentAmount(0);
                  setPaymentMethod("cash");
                }}
              >
                Hủy
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={handleInstallmentPayment}
                disabled={paymentAmount <= 0}
              >
                <Icon name="success" size="sm" tone="contrast" className="mr-1" />
                Xác nhận thanh toán
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Early Settlement Modal */}
      {showEarlySettleModal && selectedInstallment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-4">
              🎉 Tất toán sớm
            </h3>

            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <div className="text-sm text-slate-600 dark:text-slate-400">Khách hàng</div>
                <div className="font-semibold text-slate-800 dark:text-slate-100">
                  {selectedInstallment.customerName}
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Số tiền còn lại:</span>
                    <span className="font-medium">
                      {fmt(selectedInstallment.remainingBalance)}đ
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Số kỳ còn lại:</span>
                    <span className="font-medium">
                      {selectedInstallment.terms - selectedInstallment.paidTerms} kỳ
                    </span>
                  </div>

                  {(() => {
                    const { discountedAmount, discount } =
                      InstallmentService.calculateEarlySettlement(
                        selectedInstallment.remainingBalance,
                        selectedInstallment.terms - selectedInstallment.paidTerms
                      );
                    return (
                      <>
                        <div className="flex justify-between text-green-600">
                          <span>Giảm giá tất toán sớm:</span>
                          <span className="font-medium">-{fmt(discount)}đ</span>
                        </div>
                        <div className="border-t border-green-300 dark:border-green-700 pt-2 mt-2">
                          <div className="flex justify-between text-lg font-bold text-green-700 dark:text-green-400">
                            <span>Cần thanh toán:</span>
                            <span>{fmt(discountedAmount)}đ</span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={handleEarlySettlement}
                >
                  <Icon name="success" size="sm" tone="contrast" className="mr-1" />
                  Xác nhận tất toán
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEarlySettleModal(false);
                    setSelectedInstallment(null);
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Installment Payment Receipt Modal */}
      {showInstallmentReceipt && installmentReceiptData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md mx-4 shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center print:border-black">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 print:text-black">
                🧾 Phiếu thu tiền trả góp
              </h3>
              <button
                onClick={() => {
                  setShowInstallmentReceipt(false);
                  setInstallmentReceiptData(null);
                }}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors print:hidden"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Receipt Content */}
            <div className="p-6 space-y-4 print:text-black">
              <div className="text-center print:text-black">
                <h4 className="text-xl font-bold">PIN Corp</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 print:text-black">
                  Phiếu thu tiền trả góp
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 print:text-black">
                  {new Date(installmentReceiptData.paymentDate).toLocaleString("vi-VN")}
                </p>
              </div>

              <div className="border-t border-b border-slate-200 dark:border-slate-700 py-4 space-y-2 print:border-black">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Khách hàng:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {installmentReceiptData.installmentInfo.customerName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Mã đơn hàng:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {installmentReceiptData.installmentInfo.saleId}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Kỳ thanh toán:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    Kỳ {installmentReceiptData.periodNumber}/{installmentReceiptData.installmentInfo.terms}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Số tiền mỗi kỳ:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {fmt(installmentReceiptData.installmentInfo.monthlyAmount)}đ
                  </span>
                </div>
                <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-700 pt-2 print:border-black">
                  <span className="text-green-600 dark:text-green-400 print:text-black">
                    Số tiền thu:
                  </span>
                  <span className="text-green-600 dark:text-green-400 print:text-black">
                    {fmt(installmentReceiptData.paidAmount)}đ
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Còn lại:
                  </span>
                  <span
                    className={`font-medium ${
                      installmentReceiptData.remainingBalance > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    } print:text-black`}
                  >
                    {fmt(installmentReceiptData.remainingBalance)}đ
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400 print:text-black">
                    Phương thức:
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200 print:text-black">
                    {installmentReceiptData.paymentMethod === "cash" ? "💵 Tiền mặt" : "🏦 Chuyển khoản"}
                  </span>
                </div>
              </div>

              <div className="text-center text-xs text-slate-500 dark:text-slate-400 print:text-black">
                Cảm ơn quý khách!
              </div>
            </div>

            {/* Footer with print button */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-2 justify-end print:hidden">
              <button
                onClick={() => {
                  setShowInstallmentReceipt(false);
                  setInstallmentReceiptData(null);
                }}
                className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-100 transition-colors"
              >
                Đóng
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
              >
                🖨️ In phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Receivables;
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowEarlySettleModal(false);
                    setSelectedInstallment(null);
                  }}
                >
                  Hủy
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
