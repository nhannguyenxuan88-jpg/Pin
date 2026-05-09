import React, { useState, useMemo } from "react";
import type { PinRepairOrder } from "../types";
import { supabase } from "../supabaseClient";
import { usePinContext } from "../contexts/PinContext";
import { Card, CardGrid, CardTitle, StatsCard } from "./ui/Card";
import { StatusBadge, PaymentBadge } from "./ui/Badge";
import { DataTable, Column } from "./ui/Table";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  BanknotesIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  CurrencyDollarIcon,
  MagnifyingGlassIcon,
  PencilSquareIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
  WrenchScrewdriverIcon,
} from "./common/Icons";
import { PinRepairModalNew } from "./PinRepairModalNew";
import { Icon } from "./common/Icon";
import { InvoicePreviewModal } from "./invoices/InvoicePreviewModal";
import RepairInvoiceTemplate from "./invoices/RepairInvoiceTemplate";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

// Date filter options
type DateFilter = "all" | "today" | "week" | "month";

interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const PinRepairManagerNew: React.FC = () => {
  const { pinRepairOrders, upsertPinRepairOrder, deletePinRepairOrder, currentUser, addToast } =
    usePinContext();

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "warn" | "info") => {
    addToast?.({ id: crypto.randomUUID(), message, type });
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PinRepairOrder | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceRepairOrder, setInvoiceRepairOrder] = useState<PinRepairOrder | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);

  // Fetch profiles for name mapping
  React.useEffect(() => {
    const fetchProfiles = async () => {
      if (!currentUser) return;
      try {
        const { data, error } = await supabase.from("profiles").select("id, name, email");
        if (!error && data) setProfiles(data as UserProfile[]);
      } catch (e) {
        // Silently fail - profiles are optional for display
      }
    };
    fetchProfiles();
  }, [currentUser]);

  const STATUS_PENDING = ["Tiếp nhận", "Chờ", "Chờ báo giá", "Chờ vật liệu", "Sẵn sàng sửa"] as const;
  const STATUS_IN_PROGRESS = ["Đang sửa"] as const;
  const STATUS_COMPLETED = ["Đã sửa xong", "Trả máy"] as const;

  const getDisplayName = (technicianName?: string) => {
    if (!technicianName) return "";

    // Check if it matches a profile email
    const profile = profiles.find(p => p.email === technicianName || p.name === technicianName);
    if (profile && profile.name) return profile.name;

    // Fallback logic
    if (technicianName.includes("@")) {
      return technicianName.split("@")[0];
    }
    return technicianName;
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const orders = pinRepairOrders || [];
    const total = orders.length;
    const pending = orders.filter((o: PinRepairOrder) =>
      (STATUS_PENDING as readonly string[]).includes(o.status)
    ).length;
    const inProgress = orders.filter((o: PinRepairOrder) =>
      (STATUS_IN_PROGRESS as readonly string[]).includes(o.status)
    ).length;
    const completed = orders.filter((o: PinRepairOrder) =>
      (STATUS_COMPLETED as readonly string[]).includes(o.status)
    ).length;
    const totalRevenue = orders.reduce((sum: number, o: PinRepairOrder) => sum + (o.total || 0), 0);

    // Calculate estimated profit:
    //   - Vật tư: ước tính biên lợi nhuận 30% trên giá bán cho khách
    //   - Tiền công: tính toàn bộ là lợi nhuận
    const totalProfit = orders.reduce((sum: number, o: PinRepairOrder) => {
      const materialProfit = (o.materialsUsed || []).reduce(
        (s, m) => s + m.quantity * m.price * 0.3,
        0
      );
      const laborProfit = o.laborCost || 0;
      return sum + materialProfit + laborProfit;
    }, 0);

    return {
      total,
      pending,
      inProgress,
      completed,
      totalRevenue,
      totalProfit,
    };
  }, [pinRepairOrders]);

  // Filter by date helper
  const isInDateRange = (date: string, filter: DateFilter): boolean => {
    if (filter === "all") return true;

    const orderDate = new Date(date);
    const now = new Date();

    if (filter === "today") {
      return orderDate.toDateString() === now.toDateString();
    }

    if (filter === "week") {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    }

    if (filter === "month") {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return orderDate >= monthAgo;
    }

    return true;
  };

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = pinRepairOrders || [];

    // Date filter
    filtered = filtered.filter((o: PinRepairOrder) => isInDateRange(o.creationDate, dateFilter));

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((o: PinRepairOrder) => {
        if (statusFilter === "pending") return (STATUS_PENDING as readonly string[]).includes(o.status);
        if (statusFilter === "inProgress") return (STATUS_IN_PROGRESS as readonly string[]).includes(o.status);
        if (statusFilter === "completed") return (STATUS_COMPLETED as readonly string[]).includes(o.status);
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o: PinRepairOrder) =>
          o.customerName?.toLowerCase().includes(query) ||
          o.customerPhone?.includes(query) ||
          o.deviceName?.toLowerCase().includes(query) ||
          o.id?.toLowerCase().includes(query)
      );
    }

    return filtered.sort(
      (a: PinRepairOrder, b: PinRepairOrder) =>
        new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
    );
  }, [pinRepairOrders, statusFilter, searchQuery, dateFilter]);

  const handleOpenModal = (order?: PinRepairOrder) => {
    setSelectedOrder(order || null);
    setModalOpen(true);
  };

  const handleSaveOrder = async (order: PinRepairOrder) => {
    const isNew = !selectedOrder;
    await upsertPinRepairOrder(order);
    setModalOpen(false);
    setSelectedOrder(null);

    // Show invoice preview for new or completed orders
    if (isNew || order.status === "Đã sửa xong" || order.status === "Trả máy") {
      setInvoiceRepairOrder(order);
      setShowInvoicePreview(true);
    }
  };

  const handleDeleteClick = (id: string) => {
    setOrderToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (orderToDelete) {
      try {
        await deletePinRepairOrder(orderToDelete);
        showToast("Đã xóa phiếu sửa chữa thành công", "success");
      } catch (e) {
        showToast("Lỗi khi xóa phiếu sửa chữa", "error");
      }
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

  const handlePrint = (order: PinRepairOrder) => {
    const w = window.open("", "_blank");
    if (!w) {
      showToast("Vui lòng cho phép pop-up để in phiếu", "warn");
      return;
    }

    const materialsHtml = (order.materialsUsed || [])
      .map(
        (m) =>
          `<tr>
            <td>${m.materialName}</td>
            <td style="text-align: center">${m.quantity}</td>
            <td style="text-align: right">${formatCurrency(m.price)}</td>
            <td style="text-align: right">${formatCurrency(m.quantity * m.price)}</td>
          </tr>`
      )
      .join("");

    const totalMaterials =
      order.materialsUsed?.reduce((sum, m) => sum + m.quantity * m.price, 0) || 0;

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Phiếu Sửa Chữa ${order.id}</title>
        <style>
          body {
            font-family: 'Arial', sans-serif;
            margin: 20px;
            line-height: 1.6;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 10px;
          }
          .header h1 {
            margin: 0;
            color: #2563eb;
          }
          .info-section {
            margin: 20px 0;
          }
          .info-row {
            display: flex;
            margin: 8px 0;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px 8px;
          }
          th {
            background: #f3f4f6;
            font-weight: bold;
            text-align: left;
          }
          .total-section {
            margin-top: 30px;
            text-align: right;
          }
          .total-row {
            margin: 8px 0;
            font-size: 16px;
          }
          .grand-total {
            font-size: 20px;
            font-weight: bold;
            color: #2563eb;
            border-top: 2px solid #333;
            padding-top: 10px;
            margin-top: 10px;
          }
          .footer {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .signature {
            text-align: center;
            width: 200px;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PHIẾU SỬA CHỮA</h1>
          <p>Mã phiếu: ${order.id}</p>
        </div>

        <div class="info-section">
          <div class="info-row">
            <div class="info-label">Khách hàng:</div>
            <div>${order.customerName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Số điện thoại:</div>
            <div>${order.customerPhone}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Thiết bị:</div>
            <div>${order.deviceName}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ngày tiếp nhận:</div>
            <div>${new Date(order.creationDate).toLocaleDateString("vi-VN")}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div>${order.status}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Mô tả sự cố:</div>
            <div>${order.issueDescription}</div>
          </div>
          ${order.notes
        ? `<div class="info-row">
            <div class="info-label">Ghi chú:</div>
            <div>${order.notes}</div>
          </div>`
        : ""
      }
        </div>

        <h3>Vật liệu sử dụng</h3>
        <table>
          <thead>
            <tr>
              <th>Vật liệu</th>
              <th style="text-align: center">Số lượng</th>
              <th style="text-align: right">Đơn giá</th>
              <th style="text-align: right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${materialsHtml ||
      '<tr><td colspan="4" style="text-align: center">Không có vật liệu</td></tr>'
      }
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-row">
            Tiền vật liệu: <strong>${formatCurrency(totalMaterials)}</strong>
          </div>
          <div class="total-row">
            Tiền công: <strong>${formatCurrency(order.laborCost || 0)}</strong>
          </div>
          ${order.depositAmount
        ? `<div class="total-row">
            Đã đặt cọc: <strong>${formatCurrency(order.depositAmount)}</strong>
          </div>`
        : ""
      }
          <div class="grand-total">
            Tổng cộng: ${formatCurrency(order.total)}
          </div>
          ${order.paymentStatus === "unpaid"
        ? order.depositAmount && order.depositAmount > 0
          ? `<div style="color: #f97316; margin-top: 10px;">💰 Đã cọc: ${formatCurrency(
            order.depositAmount
          )} | Còn nợ: ${formatCurrency(order.total - order.depositAmount)}</div>`
          : '<div style="color: #ef4444; margin-top: 10px;">Chưa thanh toán</div>'
        : order.paymentStatus === "partial"
          ? `<div style="color: #f97316; margin-top: 10px;">Đã trả: ${formatCurrency(
            (order.depositAmount || 0) + (order.partialPaymentAmount || 0)
          )} | Còn nợ: ${formatCurrency(
            order.total - (order.depositAmount || 0) - (order.partialPaymentAmount || 0)
          )}</div>`
          : '<div style="color: #10b981; margin-top: 10px;">✓ Đã thanh toán</div>'
      }
        </div>

        <div class="footer">
          <div class="signature">
            <p><strong>Khách hàng</strong></p>
            <p>(Ký và ghi rõ họ tên)</p>
          </div>
          <div class="signature">
            <p><strong>Nhân viên</strong></p>
            <p>${order.technicianName || ""}</p>
          </div>
        </div>

        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background: #2563eb; color: white; border: none; border-radius: 5px; cursor: pointer;">
            In phiếu
          </button>
          <button onclick="window.close()" style="padding: 10px 20px; background: #6b7280; color: white; border: none; border-radius: 5px; cursor: pointer; margin-left: 10px;">
            Đóng
          </button>
        </div>
      </body>
      </html>
    `);
    w.document.close();
  };

  const columns: Column<PinRepairOrder>[] = [
    {
      key: "id",
      label: "Mã phiếu",
      width: "180px",
      render: (order) => (
        <div className="space-y-1">
          <div className="font-mono text-sm font-medium text-pin-blue-600 dark:text-pin-blue-400">
            {order.id}
          </div>
          <div className="text-xs text-pin-gray-500 dark:text-pin-dark-500">
            {new Date(order.creationDate).toLocaleString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
          {order.technicianName && (
            <div className="flex items-center gap-1.5 text-xs text-pin-gray-600 dark:text-pin-dark-600">
              <Icon name="technician" tone="primary" size="sm" />
              <span>{getDisplayName(order.technicianName)}</span>
            </div>
          )}
        </div>
      ),
    },
    // ... other columns ...

    {
      key: "customer",
      label: "Khách hàng",
      render: (order) => (
        <div className="space-y-1">
          <div className="font-medium">{order.customerName}</div>
          <div className="flex items-center gap-1.5 text-xs text-pin-gray-500 dark:text-pin-dark-500">
            <Icon name="phone" tone="primary" size="sm" />
            <span>{order.customerPhone}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium text-pin-blue-600 dark:text-pin-blue-400">
            <Icon name="device" tone="primary" size="sm" />
            <span>{order.deviceName}</span>
          </div>
          {order.issueDescription && (
            <div className="text-xs text-pin-gray-500 dark:text-pin-dark-500 line-clamp-2">
              {order.issueDescription}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "materials",
      label: "Chi tiết",
      render: (order) => {
        const materials = order.materialsUsed || [];
        const outsourcing = order.outsourcingItems || [];

        if (materials.length === 0 && outsourcing.length === 0) {
          return (
            <div className="text-xs text-pin-gray-400 dark:text-pin-dark-400 italic">
              Chưa có chi tiết
            </div>
          );
        }
        return (
          <div className="space-y-1">
            {materials.slice(0, 3).map((m: any, idx: number) => (
              <div
                key={`mat-${idx}`}
                className="flex items-center gap-1.5 text-xs text-pin-gray-600 dark:text-pin-dark-600"
              >
                <Icon name="stock" tone="primary" size="sm" />
                <span>
                  {m.materialName || m.name} ×{m.quantity}
                </span>
              </div>
            ))}
            {outsourcing.slice(0, 3).map((o: any, idx: number) => (
              <div
                key={`out-${idx}`}
                className="flex items-center gap-1.5 text-xs text-pin-purple-600 dark:text-pin-purple-400"
              >
                <span className="text-xs">🛠️</span>
                <span>
                  {o.description} ×{o.quantity}
                </span>
              </div>
            ))}
            {materials.length + outsourcing.length > 3 && (
              <div className="text-xs text-pin-gray-400 dark:text-pin-dark-400 italic">
                +{materials.length + outsourcing.length - 3} chi tiết khác
              </div>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      label: "Trạng thái",
      align: "center",
      render: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "total",
      label: "Tổng tiền",
      align: "right",
      sortable: true,
      render: (order) => (
        <span className="font-bold text-pin-blue-600 dark:text-pin-blue-400">
          {formatCurrency(order.total)}
        </span>
      ),
    },
    {
      key: "payment",
      label: "Thanh toán",
      render: (order) => {
        const depositAmount = order.depositAmount || 0;
        const partialPayment = order.partialPaymentAmount || 0;
        const totalPaid = depositAmount + partialPayment;
        const remaining = order.total - totalPaid;

        return (
          <PaymentBadge
            status={order.paymentStatus as "paid" | "unpaid" | "partial"}
            amount={remaining > 0 ? remaining : undefined}
            depositAmount={depositAmount > 0 ? depositAmount : undefined}
            paidAmount={partialPayment > 0 ? partialPayment : undefined}
          />
        );
      },
    },
    {
      key: "actions",
      label: "Thao tác",
      align: "center",
      width: "150px",
      render: (order) => (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleOpenModal(order)}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-300 dark:hover:bg-blue-500/10 rounded-lg transition-colors"
            title="Sửa"
          >
            <PencilSquareIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setInvoiceRepairOrder(order);
              setShowInvoicePreview(true);
            }}
            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:text-slate-400 dark:hover:text-emerald-300 dark:hover:bg-emerald-500/10 rounded-lg transition-colors"
            title="Xem/In phiếu"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(order.id)}
            className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-300 dark:hover:bg-red-500/10 rounded-lg transition-colors"
            title="Xóa"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const statusOverview = [
    {
      key: "all",
      label: "Tổng phiếu",
      value: stats.total,
      icon: ClipboardDocumentListIcon,
      tone: "text-blue-600 dark:text-blue-300",
      active: "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-500/10",
    },
    {
      key: "pending",
      label: "Chờ xử lý",
      value: stats.pending,
      icon: ClockIcon,
      tone: "text-amber-600 dark:text-amber-300",
      active: "border-amber-500 bg-amber-50 dark:border-amber-400 dark:bg-amber-500/10",
    },
    {
      key: "inProgress",
      label: "Đang sửa",
      value: stats.inProgress,
      icon: WrenchScrewdriverIcon,
      tone: "text-cyan-600 dark:text-cyan-300",
      active: "border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-500/10",
    },
    {
      key: "completed",
      label: "Hoàn thành",
      value: stats.completed,
      icon: CheckCircleIcon,
      tone: "text-emerald-600 dark:text-emerald-300",
      active: "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-500/10",
    },
  ];

  const dateOptions: Array<{ value: DateFilter; label: string }> = [
    { value: "all", label: "Tất cả" },
    { value: "today", label: "Hôm nay" },
    { value: "week", label: "Tuần" },
    { value: "month", label: "Tháng" },
  ];

  return (
    <div className="space-y-4 pb-20 md:pb-0 text-slate-900 dark:text-slate-100">
      {/* Header + Filters */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-4 py-4 dark:border-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
              <WrenchScrewdriverIcon className="h-3.5 w-3.5" />
              Service Operations
            </div>
            <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950 dark:text-white md:text-2xl">
              Quản lý Sửa chữa
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Theo dõi phiếu sửa chữa, tiến độ xử lý và thanh toán theo thời gian.
            </p>
          </div>
          <div className="flex flex-wrap items-stretch gap-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="min-w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-slate-500 dark:text-slate-400">
                  <BanknotesIcon className="h-3.5 w-3.5" />
                  Doanh thu
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                  {formatCurrency(stats.totalRevenue)}
                </div>
              </div>
              <div className="min-w-32 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/70">
                <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-slate-500 dark:text-slate-400">
                  <CurrencyDollarIcon className="h-3.5 w-3.5" />
                  Lợi nhuận
                </div>
                <div className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">
                  {formatCurrency(stats.totalProfit)}
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusIcon className="w-5 h-5" />}
              onClick={() => handleOpenModal()}
              className="h-full min-h-[58px] flex-shrink-0 whitespace-nowrap rounded-lg px-5 shadow-none"
            >
              <span className="hidden sm:inline">Tạo phiếu mới</span>
              <span className="sm:hidden">Tạo</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-px border-b border-slate-200 bg-slate-200 dark:border-slate-800 dark:bg-slate-800 sm:grid-cols-4">
          {statusOverview.map((item) => {
            const MetricIcon = item.icon;
            const selected = statusFilter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key)}
                className={`bg-white px-4 py-3 text-left transition-colors dark:bg-slate-900 ${
                  selected ? item.active : "hover:bg-slate-50 dark:hover:bg-slate-800/80"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-2xl font-semibold tabular-nums ${item.tone}`}>
                      {item.value}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                      {item.label}
                    </div>
                  </div>
                  <MetricIcon className={`mt-1 h-5 w-5 ${item.tone}`} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Search + Date Filter */}
        <div className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, thiết bị, mã phiếu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-10 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-blue-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="inline-flex w-full rounded-lg border border-slate-300 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-950 lg:w-auto">
            {dateOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-semibold transition-colors lg:flex-none ${dateFilter === opt.value
                  ? "bg-white text-blue-700 shadow-sm dark:bg-slate-800 dark:text-blue-300"
                  : "text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results info bar */}
      <div className="flex items-center justify-between px-1">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Hiển thị <span className="font-semibold text-blue-600 dark:text-blue-300">{filteredOrders.length}</span>{" "}
          phiếu
          {statusFilter !== "all" && (
            <span className="ml-2 rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
              {statusFilter === "pending" && "Chờ xử lý"}
              {statusFilter === "inProgress" && "Đang sửa"}
              {statusFilter === "completed" && "Hoàn thành"}
            </span>
          )}
          {dateFilter !== "all" && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {dateFilter === "today" && "Hôm nay"}
              {dateFilter === "week" && "7 ngày qua"}
              {dateFilter === "month" && "30 ngày qua"}
            </span>
          )}
        </div>

        {/* Summary moved to header */}
      </div>

      {/* Orders Table */}
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card padding="none" className="rounded-xl border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="overflow-x-auto p-3">
            <DataTable
              columns={columns}
              data={filteredOrders}
              keyExtractor={(order) => order.id}
              emptyMessage="Chưa có phiếu sửa chữa nào"
              className="text-[13px]"
            />
          </div>
        </Card>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {filteredOrders.length === 0 ? (
          <div className="text-center py-8 text-pin-gray-500 dark:text-pin-dark-500">
            Chưa có phiếu sửa chữa nào
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white dark:bg-pin-dark-100 rounded-xl p-3 shadow-sm border border-pin-gray-200 dark:border-pin-dark-400 space-y-3"
            >
              {/* Header: ID + Status */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono text-sm font-bold text-pin-blue-600 dark:text-pin-blue-400">
                    {order.id}
                  </div>
                  <div className="text-[10px] text-pin-gray-500 dark:text-pin-dark-500">
                    {new Date(order.creationDate).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <StatusBadge status={order.status} />
              </div>

              {/* Body: Info */}
              <div className="space-y-1.5 py-2 border-t border-b border-pin-gray-100 dark:border-pin-dark-300 border-dashed">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-pin-gray-500 dark:text-pin-dark-500 w-4">👤</span>
                  <span className="font-medium text-pin-gray-900 dark:text-pin-dark-900">
                    {order.customerName}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-pin-gray-500 dark:text-pin-dark-500 w-4">📱</span>
                  <span className="text-pin-gray-600 dark:text-pin-dark-600">
                    {order.customerPhone}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-pin-gray-500 dark:text-pin-dark-500 w-4">🔧</span>
                  <span className="text-pin-blue-600 dark:text-pin-blue-400 font-medium">
                    {order.deviceName}
                  </span>
                </div>
              </div>

              {/* Footer: Price + Acts */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-pin-blue-600 dark:text-pin-blue-400">
                    {formatCurrency(order.total)}
                  </span>
                  <div className="scale-90 origin-left">
                    <PaymentBadge
                      status={order.paymentStatus as "paid" | "unpaid" | "partial"}
                      amount={
                        order.total -
                        (order.depositAmount || 0) -
                        (order.partialPaymentAmount || 0)
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setInvoiceRepairOrder(order);
                      setShowInvoicePreview(true);
                      // On mobile we might want to auto-open print dialog or just show preview
                    }}
                    className="p-2 bg-pin-green-50 text-pin-green-600 rounded-lg"
                  >
                    <PrinterIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenModal(order)}
                    className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                  >
                    <PencilSquareIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(order.id)}
                    className="p-2 bg-pin-red-50 text-pin-red-600 rounded-lg"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Repair Modal */}
      <PinRepairModalNew
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleSaveOrder}
        initialOrder={selectedOrder}
        currentUser={currentUser as any}
      />

      {/* Delete Confirmation Modal */}
      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} size="sm">
        <ModalHeader>
          <ModalTitle>Xác nhận xóa</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-pin-gray-600 dark:text-pin-dark-600">
            Bạn có chắc chắn muốn xóa phiếu sửa chữa này không? Hành động này không thể hoàn tác.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => setDeleteConfirmOpen(false)}>
            Hủy
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            Xóa phiếu
          </Button>
        </ModalFooter>
      </Modal>

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoiceRepairOrder && (
        <InvoicePreviewModal
          isOpen={showInvoicePreview}
          onClose={() => setShowInvoicePreview(false)}
          title={`Phiếu sửa chữa ${invoiceRepairOrder.id}`}
        >
          <RepairInvoiceTemplate
            repairOrder={invoiceRepairOrder}
            onClose={() => setShowInvoicePreview(false)}
          />
        </InvoicePreviewModal>
      )}
    </div>
  );
};

export default PinRepairManagerNew;
