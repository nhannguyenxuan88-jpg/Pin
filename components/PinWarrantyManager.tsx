import React, { useMemo, useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import { PinRepairOrder } from "../types";

type WarrantyStatus = "active" | "expiring" | "expired";

const DEFAULT_WARRANTY_MONTHS = 3;
const EXPIRING_SOON_DAYS = 15;

interface WarrantyRow {
  order: PinRepairOrder;
  warrantyMonths: number;
  warrantyStartDate: Date;
  warrantyExpiryDate: Date;
  remainingDays: number;
  status: WarrantyStatus;
}

const parseWarrantyMonths = (order: PinRepairOrder): number => {
  const raw = (order as any).warrantyPeriod;

  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.floor(parsed);
    }
    const monthMatch = trimmed.match(/(\d+)\s*th[aá]ng/i);
    if (monthMatch) {
      return Number(monthMatch[1]);
    }
  }

  return DEFAULT_WARRANTY_MONTHS;
};

const addMonths = (baseDate: Date, months: number): Date => {
  const d = new Date(baseDate);
  d.setMonth(d.getMonth() + months);
  return d;
};

const normalizeDate = (value?: string): Date => {
  if (!value) return new Date();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
};

const PinWarrantyManager: React.FC = () => {
  const { pinRepairOrders } = usePinContext();
  const [search, setSearch] = useState("");

  const rows = useMemo<WarrantyRow[]>(() => {
    const now = new Date();

    return (pinRepairOrders || [])
      .filter((order) => order.status === "Trả máy")
      .map((order) => {
        const warrantyMonths = parseWarrantyMonths(order);
        const warrantyStartDate = normalizeDate(order.paymentDate || order.creationDate);
        const warrantyExpiryDate = addMonths(warrantyStartDate, warrantyMonths);
        const remainingDays = Math.ceil(
          (warrantyExpiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );

        let status: WarrantyStatus = "active";
        if (remainingDays < 0) {
          status = "expired";
        } else if (remainingDays <= EXPIRING_SOON_DAYS) {
          status = "expiring";
        }

        return {
          order,
          warrantyMonths,
          warrantyStartDate,
          warrantyExpiryDate,
          remainingDays,
          status,
        };
      })
      .sort((a, b) => a.warrantyExpiryDate.getTime() - b.warrantyExpiryDate.getTime());
  }, [pinRepairOrders]);

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter(({ order }) => {
      const text = [order.id, order.customerName, order.customerPhone, order.deviceName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(keyword);
    });
  }, [rows, search]);

  const summary = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        if (row.status === "active") acc.active += 1;
        if (row.status === "expiring") acc.expiring += 1;
        if (row.status === "expired") acc.expired += 1;
        return acc;
      },
      { total: filteredRows.length, active: 0, expiring: 0, expired: 0 }
    );
  }, [filteredRows]);

  const getStatusLabel = (status: WarrantyStatus, remainingDays: number): string => {
    if (status === "expired") return "Hết hạn";
    if (status === "expiring") return `Sắp hết hạn (${remainingDays} ngày)`;
    return `Còn hạn (${remainingDays} ngày)`;
  };

  const getStatusClass = (status: WarrantyStatus): string => {
    if (status === "expired") {
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    }
    if (status === "expiring") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    }
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300";
  };

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-pin-gray-900 dark:text-pin-gray-100">
            Quản lý bảo hành
          </h1>
          <p className="text-sm text-pin-gray-500 dark:text-pin-gray-400 mt-1">
            Theo dõi các đơn sửa chữa đã trả máy và thời hạn bảo hành.
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm theo mã đơn, khách hàng, số điện thoại..."
          className="w-full md:w-96 px-3 py-2 rounded-lg border border-pin-gray-300 dark:border-pin-gray-600 bg-white dark:bg-pin-gray-800 text-sm outline-none focus:ring-2 focus:ring-pin-blue-500"
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl p-4 border border-pin-gray-200 dark:border-pin-gray-700 bg-white dark:bg-pin-gray-800">
          <p className="text-xs text-pin-gray-500 dark:text-pin-gray-400">Tổng đơn bảo hành</p>
          <p className="text-2xl font-bold text-pin-gray-900 dark:text-pin-gray-100 mt-1">{summary.total}</p>
        </div>
        <div className="rounded-xl p-4 border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20">
          <p className="text-xs text-emerald-600 dark:text-emerald-400">Còn hạn</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">{summary.active}</p>
        </div>
        <div className="rounded-xl p-4 border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20">
          <p className="text-xs text-amber-600 dark:text-amber-400">Sắp hết hạn</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 mt-1">{summary.expiring}</p>
        </div>
        <div className="rounded-xl p-4 border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20">
          <p className="text-xs text-red-600 dark:text-red-400">Đã hết hạn</p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{summary.expired}</p>
        </div>
      </div>

      <div className="rounded-xl border border-pin-gray-200 dark:border-pin-gray-700 overflow-hidden bg-white dark:bg-pin-gray-800">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-pin-gray-50 dark:bg-pin-gray-900/60 text-pin-gray-600 dark:text-pin-gray-300">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Mã đơn</th>
                <th className="text-left px-4 py-3 font-semibold">Khách hàng</th>
                <th className="text-left px-4 py-3 font-semibold">Thiết bị</th>
                <th className="text-left px-4 py-3 font-semibold">Bắt đầu BH</th>
                <th className="text-left px-4 py-3 font-semibold">Hết hạn</th>
                <th className="text-left px-4 py-3 font-semibold">Thời hạn</th>
                <th className="text-left px-4 py-3 font-semibold">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-pin-gray-500 dark:text-pin-gray-400"
                  >
                    Chưa có đơn bảo hành phù hợp.
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => (
                <tr
                  key={row.order.id}
                  className="border-t border-pin-gray-100 dark:border-pin-gray-700/60 hover:bg-pin-gray-50/70 dark:hover:bg-pin-gray-700/30"
                >
                  <td className="px-4 py-3 font-medium text-pin-gray-800 dark:text-pin-gray-100">
                    {row.order.id}
                  </td>
                  <td className="px-4 py-3 text-pin-gray-700 dark:text-pin-gray-200">
                    <div className="font-medium">{row.order.customerName || "-"}</div>
                    <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400 mt-0.5">
                      {row.order.customerPhone || "-"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-pin-gray-700 dark:text-pin-gray-200">
                    {row.order.deviceName || "-"}
                  </td>
                  <td className="px-4 py-3 text-pin-gray-700 dark:text-pin-gray-200">
                    {formatDate(row.warrantyStartDate)}
                  </td>
                  <td className="px-4 py-3 text-pin-gray-700 dark:text-pin-gray-200">
                    {formatDate(row.warrantyExpiryDate)}
                  </td>
                  <td className="px-4 py-3 text-pin-gray-700 dark:text-pin-gray-200">
                    {row.warrantyMonths} tháng
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusClass(
                        row.status
                      )}`}
                    >
                      {getStatusLabel(row.status, row.remainingDays)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PinWarrantyManager;
