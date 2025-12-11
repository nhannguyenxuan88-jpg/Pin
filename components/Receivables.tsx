import React, { useState, useMemo } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction } from "../types";
import DebtCollectionModal from "./DebtCollectionModal";
import SupplierPaymentModal from "./SupplierPaymentModal";
import { Card, StatsCard, CardGrid, type StatsCardProps } from "./ui/Card";
import { DataTable } from "./ui/Table";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { Icon, type IconName } from "./common/Icon";

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

const fmt = (val: number) => val.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export default function ReceivablesNew() {
  const { pinSales, cashTransactions, suppliers, currentUser, addCashTransaction } =
    usePinContext();

  const ctx = usePinContext();
  const workOrders = ctx.pinRepairOrders || [];
  const sales = pinSales || [];
  const goodsReceipts = (ctx as any).goodsReceipts || [];
  const currentBranchId = (ctx as any).currentBranchId;

  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">("customers");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);
  const [preSelectedDebtId, setPreSelectedDebtId] = useState<string | undefined>(undefined);

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

      // Check payment status first - skip fully paid sales
      const paymentStatus = (sale as any).paymentStatus;
      if (paymentStatus === "paid") continue;

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

  const activeList: Array<Row | SupplierRow> =
    activeTab === "customers" ? customerFiltered : supplierFiltered;

  // Calculate stats
  const totalCustomerDebt = customerRows.reduce((s, r) => s + r.debt, 0);
  const totalSupplierDebt = supplierRows.reduce((s, r) => s + r.debt, 0);
  const totalDebt = activeList.reduce((s, r: any) => s + r.debt, 0);

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
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-2.5 rounded-xl min-w-[120px]">
            <div className="text-xs opacity-80">Tổng công nợ</div>
            <div className="text-base font-bold">
              {fmt(totalCustomerDebt + totalSupplierDebt)} đ
            </div>
            <div className="text-[10px] opacity-70">
              ↗{customerRows.length + supplierRows.length} khoản
            </div>
          </div>
          <div className="bg-gradient-to-r from-green-500 to-green-600 text-white px-4 py-2.5 rounded-xl min-w-[120px]">
            <div className="text-xs opacity-80">Công nợ KH</div>
            <div className="text-base font-bold">{fmt(totalCustomerDebt)} đ</div>
            <div className="text-[10px] opacity-70">↗{customerRows.length} khoản</div>
          </div>
          <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl min-w-[120px]">
            <div className="text-xs opacity-80">Công nợ NCC</div>
            <div className="text-base font-bold">{fmt(totalSupplierDebt)} đ</div>
            <div className="text-[10px] opacity-70">↗{supplierRows.length} khoản</div>
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
                activeTab === "customers" ? "Tìm theo tên, SĐT..." : "Tìm theo tên nhà cung cấp..."
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
              activeTab === "customers" ? (customerColumns as any) : (supplierColumns as any)
            }
            keyExtractor={(row: any) => row.id}
            emptyMessage="Không có công nợ"
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
    </div>
  );
}
