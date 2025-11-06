import React, { useMemo, useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { CashTransaction } from "../types";
import {
  MagnifyingGlassIcon,
  EllipsisVerticalIcon,
  PlusIcon,
  BanknotesIcon,
} from "./common/Icons";
import DebtCollectionModal from "./DebtCollectionModal";
import SupplierPaymentModal from "./SupplierPaymentModal";

const fmt = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    Math.max(0, Number(n) || 0)
  );

// Unified row type for receivables
type Row = {
  id: string;
  kind: "workorder" | "sale";
  date: string;
  customerName: string;
  customerPhone?: string;
  title: string; // e.g., Đơn Sửa Chữa: 1.SC..., Đơn Hàng: ...
  summary: string; // short line beneath title
  details: string[]; // bullet-like lines (products, repair details...)
  technician?: string;
  amount: number; // total
  paid: number; // sum cash tx
  debt: number; // amount - paid
};

export default function Receivables() {
  const ctx = usePinContext();
  const workOrders = (ctx as any).workOrders || [];
  const sales = ctx.pinSales || [];
  const cashTransactions = ctx.cashTransactions || [];
  const currentBranchId = (ctx as any).currentBranchId;
  const addCashTransaction = ctx.addCashTransaction;
  const currentUser = ctx.currentUser;
  const suppliers = ctx.suppliers || [];
  const goodsReceipts = (ctx as any).goodsReceipts || [];

  // Build lookup maps for quick sum of payments
  const paidByWO = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (
        t.workOrderId &&
        (!currentBranchId || t.branchId === currentBranchId)
      ) {
        m.set(
          t.workOrderId,
          (m.get(t.workOrderId) || 0) + (Number(t.amount) || 0)
        );
      }
    }
    return m;
  }, [cashTransactions, currentBranchId]);

  const paidBySale = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of cashTransactions || []) {
      if (t.saleId && (!currentBranchId || t.branchId === currentBranchId)) {
        m.set(t.saleId, (m.get(t.saleId) || 0) + (Number(t.amount) || 0));
      }
    }
    return m;
  }, [cashTransactions, currentBranchId]);

  const rows: Row[] = useMemo(() => {
    const list: Row[] = [];

    // Work orders
    (workOrders || [])
      .filter(
        (w: any) =>
          (!currentBranchId || w.branchId === currentBranchId) &&
          (Number(w.total) || 0) > 0
      )
      .forEach((w: any) => {
        const paid = paidByWO.get(w.id) || 0;
        const debt = Math.max(0, (Number(w.total) || 0) - paid);
        if (debt <= 0) return;
        const details: string[] = [];
        if (w.partsUsed && w.partsUsed.length) {
          details.push(
            `Sản phẩm thêm: ` +
              w.partsUsed
                .map((p: any) => `${p.quantity} x ${p.partName}`)
                .join("; ")
          );
        }
        if (w.quotationItems && w.quotationItems.length) {
          details.push(
            `Gia công/Đặt hàng: ` +
              w.quotationItems
                .map((q: any) => `${q.quantity} x ${q.description}`)
                .join("; ")
          );
        }
        const summary = w.issueDescription || "";
        list.push({
          id: w.id,
          kind: "workorder",
          date: w.creationDate,
          customerName: w.customerName,
          customerPhone: w.customerPhone,
          title: `Đơn Sửa Chữa: ${w.id}`,
          summary,
          details,
          technician: w.technicianName,
          amount: Number(w.total) || 0,
          paid,
          debt,
        });
      });

    // Sales
    (sales || [])
      .filter(
        (s: any) =>
          (!currentBranchId || s.branchId === currentBranchId) &&
          (Number(s.total) || 0) > 0
      )
      .forEach((s: any) => {
        const paid = paidBySale.get(s.id) || 0;
        const debt = Math.max(0, (Number(s.total) || 0) - paid);
        if (debt <= 0) return;
        const details: string[] = [];
        if (s.items && s.items.length) {
          details.push(
            `Sản phẩm đã bán: ` +
              s.items
                .map((it: any) => `${it.quantity} x ${it.partName}`)
                .join("; ")
          );
        }
        list.push({
          id: s.id,
          kind: "sale",
          date: s.date,
          customerName: s.customer?.name || "Khách lẻ",
          customerPhone: s.customer?.phone,
          title: `Đơn Hàng: ${s.id}`,
          summary: "",
          details,
          amount: Number(s.total) || 0,
          paid,
          debt,
        });
      });

    // Sort by date desc
    return list.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [workOrders, sales, paidByWO, paidBySale, currentBranchId]);

  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">(
    "customers"
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [showCollectModal, setShowCollectModal] = useState(false);
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      return (
        r.customerName.toLowerCase().includes(q) ||
        (r.customerPhone || "").includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q) ||
        r.details.some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [rows, query]);

  // Suppliers tab data aggregation
  type SupplierRow = {
    id: string;
    date: string;
    customerName: string; // supplier name
    title: string;
    details: string[];
    amount: number;
    paid: number;
    debt: number;
  };

  const supplierRows: SupplierRow[] = useMemo(() => {
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
      });
    }
    return arr.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [goodsReceipts, cashTransactions, suppliers, currentBranchId]);

  const supplierFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return supplierRows;
    return supplierRows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q)
    );
  }, [supplierRows, query]);

  const activeList: Array<Row | SupplierRow> = (
    activeTab === "customers" ? filtered : supplierFiltered
  ) as any[];

  const totalDebt = (activeList as any[]).reduce((s, r: any) => s + r.debt, 0);
  const selectedIds = Object.keys(selected).filter((k) => selected[k]);
  const selectedDebt = (activeList as any[])
    .filter((r: any) => selectedIds.includes(r.id))
    .reduce((s, r: any) => s + r.debt, 0);

  const toggleAll = (checked: boolean) => {
    const next: Record<string, boolean> = {};
    if (checked) (activeList as any[]).forEach((r: any) => (next[r.id] = true));
    setSelected(next);
  };
  const toggleOne = (id: string, checked: boolean) =>
    setSelected((p) => ({ ...p, [id]: checked }));

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
        )}?`
      )
    )
      return;

    const now = new Date().toISOString();
    for (const row of filtered.filter((r) => selectedIds.includes(r.id))) {
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
        paymentSourceId: "cash", // default cash; can extend UI later
        branchId: currentBranchId,
        category: row.kind === "workorder" ? "service_income" : "sale_income",
        ...(row.kind === "workorder"
          ? { workOrderId: row.id }
          : { saleId: row.id }),
      };
      await addCashTransaction(tx);
    }
    // Clear selection after done
    setSelected({});
    alert("Đã ghi nhận thu nợ cho các đơn đã chọn.");
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
        {/* Toolbar + Tabs */}
        <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              className={`px-3 py-1.5 rounded text-sm font-semibold ${
                activeTab === "customers"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
              onClick={() => setActiveTab("customers")}
            >
              Công nợ khách hàng
            </button>
            <button
              className={`px-3 py-1.5 rounded text-sm font-semibold ${
                activeTab === "suppliers"
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              }`}
              onClick={() => setActiveTab("suppliers")}
            >
              Công nợ nhà cung cấp
            </button>
          </div>
          <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-slate-900 rounded-md px-2 py-1">
            <MagnifyingGlassIcon className="w-5 h-5 text-slate-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                activeTab === "customers"
                  ? "Tìm SĐT / Tên KH / Tên sản phẩm / IMEI"
                  : "Tìm tên / SĐT nhà cung cấp"
              }
              className="flex-1 bg-transparent outline-none text-sm py-1"
            />
          </div>
          {/* Placeholder for future filters */}
          <div className="hidden sm:block w-px h-6 bg-slate-200 dark:bg-slate-700" />
          <div className="ml-auto text-sm">
            Tổng công nợ:{" "}
            <span className="font-semibold text-rose-600">
              {fmt(totalDebt)}
            </span>
          </div>
          <button
            className="ml-2 inline-flex items-center gap-1 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold px-3 py-2 rounded"
            onClick={() =>
              activeTab === "customers"
                ? setShowCollectModal(true)
                : setShowSupplierPayModal(true)
            }
          >
            <PlusIcon className="w-4 h-4" />
            {activeTab === "customers" ? "Thu nợ" : "Chi trả nợ"}
          </button>
          <button className="p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700">
            <EllipsisVerticalIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Table header */}
        <div className="px-3 sm:px-4 py-2 text-xs uppercase tracking-wide text-slate-500 grid grid-cols-12 gap-3">
          <div className="col-span-5 sm:col-span-5 flex items-center gap-3">
            <input
              type="checkbox"
              checked={
                selectedIds.length === activeList.length &&
                activeList.length > 0
              }
              onChange={(e) => toggleAll(e.target.checked)}
            />
            <span>
              {activeTab === "customers" ? "Khách hàng nợ" : "Nhà cung cấp"}
            </span>
          </div>
          <div className="col-span-3 sm:col-span-4">Nội dung</div>
          <div className="col-span-4 sm:col-span-3 grid grid-cols-3 text-right">
            <div>Số tiền</div>
            <div>Đã trả</div>
            <div>Còn nợ</div>
          </div>
        </div>

        {/* Selection summary bar */}
        {selectedIds.length > 0 && activeTab === "customers" && (
          <div className="px-3 sm:px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border-t border-b border-amber-200 dark:border-amber-700 flex items-center justify-between text-sm">
            <div>Đã chọn {selectedIds.length} đơn</div>
            <button
              onClick={handleCollectAllSelected}
              className="inline-flex items-center gap-2 bg-rose-600 hover:bg-rose-700 text-white font-semibold px-3 py-1.5 rounded"
              title="Trả hết nợ"
            >
              <BanknotesIcon className="w-5 h-5" /> Trả hết nợ (
              {fmt(selectedDebt)})
            </button>
          </div>
        )}

        {/* Rows */}
        <div>
          {(activeList as any[]).map((r: any, idx: number) => (
            <div
              key={r.id}
              className={`grid grid-cols-12 gap-3 items-start px-3 sm:px-4 py-3 border-t border-slate-200 dark:border-slate-700 ${
                idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-900/40" : ""
              }`}
            >
              {/* Left: customer */}
              <div className="col-span-5 sm:col-span-5">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!selected[r.id]}
                    onChange={(e) => toggleOne(r.id, e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">
                      {r.customerName}
                    </div>
                    {activeTab === "customers" && r.customerPhone && (
                      <div className="text-sm text-slate-500">
                        Phone: {r.customerPhone}
                      </div>
                    )}
                    <div className="text-xs text-sky-600 cursor-pointer hover:underline">
                      {r.title}
                    </div>
                    {r.date && (
                      <div className="text-xs text-slate-500">
                        Ngày tạo đơn:{" "}
                        {new Date(r.date).toLocaleDateString("vi-VN")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Middle: content */}
              <div className="col-span-3 sm:col-span-4 text-sm text-slate-700 dark:text-slate-300">
                {r.summary && (
                  <div>
                    {r.summary}{" "}
                    {r.kind === "workorder" && (
                      <span className="text-emerald-600">(Kiểm tra)</span>
                    )}
                  </div>
                )}
                {r.details.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {r.details.slice(0, 6).map((d: string, i: number) => (
                      <div key={i} className="text-xs leading-snug">
                        {d}
                      </div>
                    ))}
                  </div>
                )}
                {r.technician && (
                  <div className="mt-1 text-xs text-slate-500">
                    NV.Kỹ thuật: {r.technician}
                  </div>
                )}
              </div>

              {/* Right: numbers */}
              <div className="col-span-4 sm:col-span-3 grid grid-cols-3 text-right text-sm">
                <div className="font-medium text-slate-800 dark:text-slate-100">
                  {fmt(r.amount)}
                </div>
                <div className="text-slate-600">{fmt(r.paid)}</div>
                <div className="font-bold text-rose-600">{fmt(r.debt)}</div>
              </div>

              {/* Row actions */}
              <div className="absolute right-2 sm:right-3">
                <button className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                  <EllipsisVerticalIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}

          {activeList.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              Không có công nợ.
            </div>
          )}
        </div>
      </div>
      {/* Modal: Thu nợ khách hàng */}
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
