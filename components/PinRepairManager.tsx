import React, { useState, useMemo } from "react";
import type { PinRepairOrder } from "../types";
import { supabase } from "../supabaseClient";
import { usePinContext } from "../contexts/PinContext";
import { Card, CardGrid, CardTitle, StatsCard } from "./ui/Card";
import { StatusBadge, PaymentBadge } from "./ui/Badge";
import { DataTable, Column } from "./ui/Table";
import { Modal, ModalHeader, ModalTitle, ModalBody, ModalFooter } from "./ui/Modal";
import { Button } from "./ui/Button";
import { WrenchScrewdriverIcon, PlusIcon, PrinterIcon, TrashIcon } from "./common/Icons";
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

    // Calculate profit (assuming 30% margin on materials + full labor cost)
    const totalProfit = orders.reduce((sum: number, o: PinRepairOrder) => {
      const materialsCost = (o.materialsUsed || []).reduce(
        (s, m) => s + m.quantity * m.price * 0.3,
        0
      );
      const laborProfit = o.laborCost || 0;
      return sum + materialsCost + laborProfit;
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
            className="p-2 text-pin-blue-600 hover:bg-pin-blue-50 dark:hover:bg-pin-blue-900/20 rounded-lg transition-colors"
            title="Sửa"
          >
            ✏️
          </button>
          <button
            onClick={() => {
              setInvoiceRepairOrder(order);
              setShowInvoicePreview(true);
            }}
            className="p-2 text-pin-green-600 hover:bg-pin-green-50 dark:hover:bg-pin-green-900/20 rounded-lg transition-colors"
            title="Xem/In phiếu"
          >
            <PrinterIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteClick(order.id)}
            className="p-2 text-pin-red-600 hover:bg-pin-red-50 dark:hover:bg-pin-red-900/20 rounded-lg transition-colors"
            title="Xóa"
          >
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3 md:space-y-4 pb-20 md:pb-0">
      {/* Header + Filters */}
      <div className="rounded-2xl border border-pin-gray-200 dark:border-pin-dark-400 bg-white dark:bg-pin-dark-200 p-3 md:p-4 shadow-sm space-y-3 md:space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-2xl font-bold text-pin-gray-900 dark:text-pin-dark-900 flex items-center gap-2">
              🔧 Quản lý Sửa chữa
            </h1>
            <p className="text-[11px] md:text-sm text-pin-gray-500 dark:text-pin-dark-500">
              Theo dõi phiếu sửa chữa, tiến độ và thanh toán
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden md:flex items-center gap-2">
              <div className="px-2.5 py-1.5 rounded-lg border border-pin-emerald-200 dark:border-pin-emerald-700 bg-pin-emerald-50/70 dark:bg-pin-emerald-900/20">
                <div className="text-[10px] text-pin-gray-500">Doanh thu</div>
                <div className="text-sm font-semibold text-pin-emerald-600 dark:text-pin-emerald-400">
                  {formatCurrency(stats.totalRevenue)}
                </div>
              </div>
              <div className="px-2.5 py-1.5 rounded-lg border border-pin-purple-200 dark:border-pin-purple-700 bg-pin-purple-50/70 dark:bg-pin-purple-900/20">
                <div className="text-[10px] text-pin-gray-500">Lợi nhuận</div>
                <div className="text-sm font-semibold text-pin-purple-600 dark:text-pin-purple-400">
                  {formatCurrency(stats.totalProfit)}
                </div>
              </div>
            </div>
            <Button
              variant="primary"
              size="md"
              leftIcon={<PlusIcon className="w-5 h-5" />}
              onClick={() => handleOpenModal()}
              className="flex-shrink-0 whitespace-nowrap shadow-lg shadow-pin-blue-500/30"
            >
              <span className="hidden sm:inline">Tạo phiếu mới</span>
              <span className="sm:hidden">Tạo</span>
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-2 md:gap-3">
          <button
            onClick={() => setStatusFilter("all")}
            className={`rounded-lg border bg-white dark:bg-pin-dark-100 p-2 md:p-2.5 text-left transition-all hover:shadow-sm ${statusFilter === "all"
              ? "border-pin-blue-300 ring-2 ring-pin-blue-200/40"
              : "border-pin-gray-200 dark:border-pin-dark-400"
              }`}
          >
            <div className="text-base md:text-lg font-semibold text-pin-blue-600 dark:text-pin-blue-400">
              {stats.total}
            </div>
            <div className="text-[10px] md:text-xs text-pin-gray-500 dark:text-pin-dark-500">Tổng phiếu</div>
          </button>

          <button
            onClick={() => setStatusFilter("pending")}
            className={`rounded-lg border bg-white dark:bg-pin-dark-100 p-2 md:p-2.5 text-left transition-all hover:shadow-sm ${statusFilter === "pending"
              ? "border-pin-amber-300 ring-2 ring-pin-amber-200/40"
              : "border-pin-gray-200 dark:border-pin-dark-400"
              }`}
          >
            <div className="text-base md:text-lg font-semibold text-pin-amber-600 dark:text-pin-amber-400">
              {stats.pending}
            </div>
            <div className="text-[10px] md:text-xs text-pin-gray-500 dark:text-pin-dark-500">Chờ xử lý</div>
          </button>

          <button
            onClick={() => setStatusFilter("inProgress")}
            className={`rounded-lg border bg-white dark:bg-pin-dark-100 p-2 md:p-2.5 text-left transition-all hover:shadow-sm ${statusFilter === "inProgress"
              ? "border-pin-cyan-300 ring-2 ring-pin-cyan-200/40"
              : "border-pin-gray-200 dark:border-pin-dark-400"
              }`}
          >
            <div className="text-base md:text-lg font-semibold text-pin-cyan-600 dark:text-pin-cyan-400">
              {stats.inProgress}
            </div>
            <div className="text-[11px] md:text-xs text-pin-gray-500 dark:text-pin-dark-500">
              Đang sửa
            </div>
          </button>

          <button
            onClick={() => setStatusFilter("completed")}
            className={`rounded-lg border bg-white dark:bg-pin-dark-100 p-2 md:p-2.5 text-left transition-all hover:shadow-sm ${statusFilter === "completed"
              ? "border-pin-green-300 ring-2 ring-pin-green-200/40"
              : "border-pin-gray-200 dark:border-pin-dark-400"
              }`}
          >
            <div className="text-base md:text-lg font-semibold text-pin-green-600 dark:text-pin-green-400">
              {stats.completed}
            </div>
            <div className="text-[10px] md:text-xs text-pin-gray-500 dark:text-pin-dark-500">Hoàn thành</div>
          </button>

        </div>

        {/* Search + Date Filter */}
        <div className="flex flex-col lg:flex-row gap-2 md:gap-3">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-pin-gray-400">🔍</span>
              <input
                type="text"
                placeholder="Tìm theo tên, SĐT, thiết bị, mã phiếu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full input-base pl-9 pr-10 text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-pin-gray-400 hover:text-pin-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="inline-flex flex-wrap gap-1 rounded-xl border border-pin-gray-200 dark:border-pin-dark-400 bg-pin-gray-50 dark:bg-pin-dark-200 p-1">
            {[
              { value: "all", label: "Tất cả" },
              { value: "today", label: "Hôm nay" },
              { value: "week", label: "Tuần" },
              { value: "month", label: "Tháng" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDateFilter(opt.value as DateFilter)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${dateFilter === opt.value
                  ? "bg-white dark:bg-pin-dark-100 text-pin-blue-600 shadow-sm"
                  : "text-pin-gray-600 dark:text-pin-dark-600 hover:text-pin-blue-600"
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
        <div className="text-sm text-pin-gray-500 dark:text-pin-dark-500">
          Hiển thị <span className="font-semibold text-pin-blue-600">{filteredOrders.length}</span>{" "}
          phiếu
          {statusFilter !== "all" && (
            <span className="ml-2 px-2 py-0.5 bg-pin-blue-100 dark:bg-pin-blue-900/30 text-pin-blue-600 rounded-full text-xs">
              {statusFilter === "pending" && "Chờ xử lý"}
              {statusFilter === "inProgress" && "Đang sửa"}
              {statusFilter === "completed" && "Hoàn thành"}
            </span>
          )}
          {dateFilter !== "all" && (
            <span className="ml-2 px-2 py-0.5 bg-pin-amber-100 dark:bg-pin-amber-900/30 text-pin-amber-600 rounded-full text-xs">
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
        <Card padding="none">
          <div className="p-4 overflow-x-auto">
            <DataTable
              columns={columns}
              data={filteredOrders}
              keyExtractor={(order) => order.id}
              emptyMessage="Chưa có phiếu sửa chữa nào"
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
                    className="p-2 bg-pin-blue-50 text-pin-blue-600 rounded-lg"
                  >
                    ✏️
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
