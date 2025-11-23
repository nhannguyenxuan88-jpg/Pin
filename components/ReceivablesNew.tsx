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

const fmt = (val: number) =>
  val.toLocaleString("vi-VN", { maximumFractionDigits: 0 });

export default function ReceivablesNew() {
  const {
    pinSales,
    cashTransactions,
    suppliers,
    currentUser,
    addCashTransaction,
  } = usePinContext();

  const ctx = usePinContext();
  const workOrders = ctx.pinRepairOrders || [];
  const sales = pinSales || [];
  const goodsReceipts = (ctx as any).goodsReceipts || [];
  const currentBranchId = (ctx as any).currentBranchId;

  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">(
    "customers"
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);

  // Calculate customer receivables (from workorders and sales)
  const customerRows = useMemo(() => {
    const paidByWO = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.type !== "income" || !t.workOrderId) continue;
      if (currentBranchId && t.branchId !== currentBranchId) continue;
      paidByWO.set(
        t.workOrderId,
        (paidByWO.get(t.workOrderId) || 0) + (Number(t.amount) || 0)
      );
    }
    const paidBySale = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.type !== "income" || !t.saleId) continue;
      if (currentBranchId && t.branchId !== currentBranchId) continue;
      paidBySale.set(
        t.saleId,
        (paidBySale.get(t.saleId) || 0) + (Number(t.amount) || 0)
      );
    }

    const arr: Row[] = [];

    for (const wo of workOrders || []) {
      if (
        currentBranchId &&
        (wo as any).branchId &&
        (wo as any).branchId !== currentBranchId
      )
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
      if ((wo as any).deviceModel)
        details.push(`Thiết bị: ${(wo as any).deviceModel}`);
      if ((wo as any).issueDescription)
        details.push(`Vấn đề: ${(wo as any).issueDescription}`);
      if ((wo as any).partsUsed?.length) {
        const p = (wo as any).partsUsed
          .slice(0, 3)
          .map((x: any) => x.partName || x.part_name)
          .join(", ");
        details.push(`Linh kiện: ${p}`);
      }

      arr.push({
        id: wo.id,
        date:
          (wo as any).createdDate ||
          (wo as any).created_at ||
          new Date().toISOString(),
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
      if (
        currentBranchId &&
        (sale as any).branchId &&
        (sale as any).branchId !== currentBranchId
      )
        continue;
      const total = Number((sale as any).total ?? 0);
      if (total <= 0) continue;
      const paid = paidBySale.get(sale.id) || 0;
      const debt = Math.max(0, total - paid);
      if (debt <= 0) continue;

      const details: string[] = [];
      if ((sale as any).items?.length) {
        const items = (sale as any).items.slice(0, 4).map((itm: any) => {
          const name = itm.productName || itm.product_name || "N/A";
          const qty = itm.quantity || 1;
          return `${name} x${qty}`;
        });
        details.push(...items);
      }

      arr.push({
        id: sale.id,
        date:
          (sale as any).saleDate ||
          (sale as any).created_at ||
          new Date().toISOString(),
        customerName: (sale as any).customerName || "",
        customerPhone: (sale as any).customerPhone,
        title: `Đơn hàng: ${sale.code || sale.id}`,
        details,
        kind: "sale",
        amount: total,
        paid,
        debt,
      });
    }

    return arr.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [workOrders, sales, cashTransactions, currentBranchId]);

  // Calculate supplier payables (from goods receipts)
  const supplierRows = useMemo(() => {
    const totalBySup = new Map<
      string,
      { total: number; latest: string; count: number }
    >();
    for (const gr of goodsReceipts || []) {
      if (!gr) continue;
      if (
        currentBranchId &&
        (gr as any).branchId &&
        (gr as any).branchId !== currentBranchId
      )
        continue;
      const prev = totalBySup.get(gr.supplierId) || {
        total: 0,
        latest:
          (gr as any).receivedDate ||
          (gr as any).created_at ||
          new Date().toISOString(),
        count: 0,
      };
      prev.total += Number((gr as any).totalAmount ?? 0);
      prev.count += 1;
      const d = new Date(
        (gr as any).receivedDate ||
          (gr as any).created_at ||
          new Date().toISOString()
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
          `Lần nhập gần nhất: ${new Date(info.latest).toLocaleDateString(
            "vi-VN"
          )}`,
        ],
        amount: info.total,
        paid,
        debt,
        ordersCount: info.count,
      });
    }
    return arr.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
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
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
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
        customerRows.map(
          (row) => `${row.customerPhone || ""}-${row.customerName || ""}`
        )
      ).size;
      const pendingOrders = customerRows.filter(
        (row) => row.kind === "workorder"
      ).length;

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

    const pendingReceipts = supplierRows.reduce(
      (sum, row) => sum + (row.ordersCount || 0),
      0
    );

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
  }, [
    activeTab,
    customerRows,
    supplierRows,
    totalCustomerDebt,
    totalSupplierDebt,
  ]);

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
      !window.confirm(
        `Xác nhận thu đủ cho ${selectedIds.length} đơn, tổng ${fmt(
          selectedDebt
        )} đ?`
      )
    ) {
      return;
    }

    const now = new Date().toISOString();

    if (activeTab === "customers") {
      // Collect from customers
      for (const row of customerFiltered.filter((r) =>
        selectedIds.includes(r.id)
      )) {
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
          } #${row.id}`,
          paymentSourceId: "cash",
          branchId: currentBranchId,
          category: row.kind === "workorder" ? "service_income" : "sale_income",
          ...(row.kind === "workorder"
            ? { workOrderId: row.id }
            : { saleId: row.id }),
        };
        await addCashTransaction(tx);
      }
      setSelected({});
      alert("Đã ghi nhận thu nợ cho các đơn đã chọn.");
    } else {
      // Pay suppliers
      for (const row of supplierFiltered.filter((r) =>
        selectedIds.includes(r.id)
      )) {
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
          notes: `Thanh toán công nợ NCC ${row.customerName}`,
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
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {row.customerName}
          </div>
          {row.customerPhone && (
            <div className="text-sm text-slate-500">{row.customerPhone}</div>
          )}
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
        <div className="space-y-1">
          {row.summary && (
            <div className="text-sm text-slate-700 dark:text-slate-300">
              {row.summary}
              {row.kind === "workorder" && (
                <Badge variant="success" className="ml-2">
                  Kiểm tra
                </Badge>
              )}
            </div>
          )}
          {row.details.length > 0 && (
            <div className="space-y-0.5">
              {row.details.slice(0, 3).map((d, i) => (
                <div
                  key={i}
                  className="text-xs text-slate-600 dark:text-slate-400"
                >
                  {d}
                </div>
              ))}
            </div>
          )}
          {row.technician && (
            <div className="text-xs text-slate-500">NV: {row.technician}</div>
          )}
        </div>
      ),
    },
    {
      key: "amount" as const,
      label: "Tổng tiền",
      sortable: true,
      align: "right" as const,
      render: (row: Row) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {fmt(row.amount)}
        </span>
      ),
    },
    {
      key: "paid" as const,
      label: "Đã trả",
      sortable: true,
      align: "right" as const,
      render: (row: Row) => (
        <span className="text-slate-600 dark:text-slate-400">
          {fmt(row.paid)}
        </span>
      ),
    },
    {
      key: "debt" as const,
      label: "Còn nợ",
      sortable: true,
      align: "right" as const,
      render: (row: Row) => (
        <span className="font-bold text-rose-600">{fmt(row.debt)}</span>
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
          <div className="font-semibold text-slate-800 dark:text-slate-100">
            {row.customerName}
          </div>
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
      render: (row: SupplierRow) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {fmt(row.amount)}
        </span>
      ),
    },
    {
      key: "paid" as const,
      label: "Đã trả",
      sortable: true,
      align: "right" as const,
      render: (row: SupplierRow) => (
        <span className="text-slate-600 dark:text-slate-400">
          {fmt(row.paid)}
        </span>
      ),
    },
    {
      key: "debt" as const,
      label: "Còn nợ",
      sortable: true,
      align: "right" as const,
      render: (row: SupplierRow) => (
        <span className="font-bold text-rose-600">{fmt(row.debt)}</span>
      ),
    },
  ];

  return (
    <div className="p-4 sm:p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Quản lý Công Nợ
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            Theo dõi công nợ khách hàng và nhà cung cấp
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <CardGrid cols={3}>
        <StatsCard
          title="Tổng công nợ"
          value={`${fmt(totalCustomerDebt + totalSupplierDebt)} đ`}
          iconName="money"
          variant="primary"
        />
        <StatsCard
          title="Công nợ khách hàng"
          value={`${fmt(totalCustomerDebt)} đ`}
          iconName="customers"
          trend={{
            value: customerRows.length,
            label: "khoản",
          }}
          variant="success"
        />
        <StatsCard
          title="Công nợ nhà cung cấp"
          value={`${fmt(totalSupplierDebt)} đ`}
          iconName="stock"
          trend={{
            value: supplierRows.length,
            label: "khoản",
          }}
          variant="warning"
        />
      </CardGrid>

      {/* Main Card */}
      <Card>
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  setActiveTab("customers");
                  setSelected({});
                }}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "customers"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <Icon
                  name="customers"
                  size="sm"
                  tone={activeTab === "customers" ? "primary" : "muted"}
                  className="mr-2"
                />
                Công nợ khách hàng ({customerRows.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab("suppliers");
                  setSelected({});
                }}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === "suppliers"
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                }`}
              >
                <Icon
                  name="stock"
                  size="sm"
                  tone={activeTab === "suppliers" ? "primary" : "muted"}
                  className="mr-2"
                />
                Công nợ nhà cung cấp ({supplierRows.length})
              </button>
            </div>
            <div className="lg:ml-auto text-sm text-slate-600 dark:text-slate-400">
              Tổng công nợ đang hiển thị:
              <span className="ml-1 font-semibold text-rose-600">
                {fmt(totalDebt)} đ
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                onClick={() =>
                  activeTab === "customers"
                    ? setShowCollectModal(true)
                    : setShowSupplierPayModal(true)
                }
                className="whitespace-nowrap"
              >
                <Icon
                  name={activeTab === "customers" ? "success" : "money"}
                  size="sm"
                  tone="contrast"
                  className="mr-2"
                />
                {activeTab === "customers" ? "Thu nợ" : "Thanh toán NCC"}
              </Button>
              {selectedIds.length > 0 && (
                <Button
                  variant="secondary"
                  onClick={() => setSelected({})}
                  className="whitespace-nowrap"
                >
                  Xóa lựa chọn
                </Button>
              )}
            </div>
          </div>

          <CardGrid cols={3}>
            {activeSummaryCards.map((card) => (
              <StatsCard key={card.title} {...card} />
            ))}
          </CardGrid>
        </div>

        {/* Search and Actions */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="flex-1 relative">
              <Icon
                name="search"
                size="md"
                tone="muted"
                className="absolute left-3 top-1/2 -translate-y-1/2"
              />
              <input
                type="text"
                placeholder={
                  activeTab === "customers"
                    ? "Tìm theo tên, SĐT..."
                    : "Tìm theo tên nhà cung cấp..."
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Bulk Actions */}
            {selectedIds.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Đã chọn {selectedIds.length} ({fmt(selectedDebt)} đ)
                </span>
                <Button variant="primary" onClick={handleCollectAllSelected}>
                  <Icon
                    name="success"
                    size="sm"
                    tone="contrast"
                    className="mr-2"
                  />
                  {activeTab === "customers" ? "Thu nợ" : "Thanh toán"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* DataTable */}
        <div className="p-0 sm:p-4">
          <DataTable
            data={activeList}
            columns={
              activeTab === "customers"
                ? (customerColumns as any)
                : (supplierColumns as any)
            }
            keyExtractor={(row: any) => row.id}
            emptyMessage="Không có công nợ"
          />
        </div>
      </Card>

      {/* Modals */}
      <DebtCollectionModal
        open={showCollectModal}
        onClose={() => setShowCollectModal(false)}
      />
      <SupplierPaymentModal
        open={showSupplierPayModal}
        onClose={() => setShowSupplierPayModal(false)}
      />
    </div>
  );
}
