import React, { useState, useMemo } from "react";
import type { PinRepairOrder } from "../types";
import { usePinContext } from "../contexts/PinContext";
import { Card, CardGrid, CardTitle, CardBody, StatsCard } from "./ui/Card";
import { StatusBadge, PaymentBadge } from "./ui/Badge";
import { DataTable, Column } from "./ui/Table";
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalBody,
  ModalFooter,
} from "./ui/Modal";
import { Button } from "./ui/Button";
import {
  WrenchScrewdriverIcon,
  PlusIcon,
  PrinterIcon,
  TrashIcon,
  DocumentTextIcon,
} from "./common/Icons";
import { PinRepairModalNew } from "./PinRepairModalNew";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);

const PinRepairManagerNew: React.FC = () => {
  const {
    pinRepairOrders,
    upsertPinRepairOrder,
    deletePinRepairOrder,
    currentUser,
  } = usePinContext();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PinRepairOrder | null>(
    null
  );
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calculate statistics
  const stats = useMemo(() => {
    const orders = pinRepairOrders || [];
    const total = orders.length;
    const pending = orders.filter(
      (o) => o.status === "Tiếp nhận" || o.status === "Chờ"
    ).length;
    const inProgress = orders.filter((o) => o.status === "Đang sửa").length;
    const completed = orders.filter(
      (o) => o.status === "Đã sửa xong" || o.status === "Trả máy"
    ).length;
    const totalRevenue = orders.reduce((sum, o) => sum + (o.total || 0), 0);
    const unpaidAmount = orders
      .filter((o) => o.paymentStatus === "unpaid")
      .reduce((sum, o) => sum + (o.total || 0), 0);

    return {
      total,
      pending,
      inProgress,
      completed,
      totalRevenue,
      unpaidAmount,
    };
  }, [pinRepairOrders]);

  // Filter and search orders
  const filteredOrders = useMemo(() => {
    let filtered = pinRepairOrders || [];

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((o) => {
        if (statusFilter === "pending")
          return o.status === "Tiếp nhận" || o.status === "Chờ";
        if (statusFilter === "inProgress") return o.status === "Đang sửa";
        if (statusFilter === "completed")
          return o.status === "Đã sửa xong" || o.status === "Trả máy";
        return true;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (o) =>
          o.customerName?.toLowerCase().includes(query) ||
          o.customerPhone?.includes(query) ||
          o.deviceName?.toLowerCase().includes(query) ||
          o.id?.toLowerCase().includes(query)
      );
    }

    return filtered.sort(
      (a, b) =>
        new Date(b.creationDate).getTime() - new Date(a.creationDate).getTime()
    );
  }, [pinRepairOrders, statusFilter, searchQuery]);

  const handleOpenModal = (order?: PinRepairOrder) => {
    setSelectedOrder(order || null);
    setModalOpen(true);
  };

  const handleSaveOrder = async (order: PinRepairOrder) => {
    await upsertPinRepairOrder(order);
    setModalOpen(false);
    setSelectedOrder(null);
  };

  const handleDeleteClick = (id: string) => {
    setOrderToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (orderToDelete) {
      await deletePinRepairOrder(orderToDelete);
      setDeleteConfirmOpen(false);
      setOrderToDelete(null);
    }
  };

  const handlePrint = (order: PinRepairOrder) => {
    const w = window.open("", "_blank");
    if (!w) return alert("Vui lòng cho phép pop-up để in phiếu");

    const materialsHtml = (order.materialsUsed || [])
      .map(
        (m) =>
          `<tr>
            <td>${m.materialName}</td>
            <td style="text-align: center">${m.quantity}</td>
            <td style="text-align: right">${formatCurrency(m.price)}</td>
            <td style="text-align: right">${formatCurrency(
              m.quantity * m.price
            )}</td>
          </tr>`
      )
      .join("");

    const totalMaterials =
      order.materialsUsed?.reduce((sum, m) => sum + m.quantity * m.price, 0) ||
      0;

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
            <div>${new Date(order.creationDate).toLocaleDateString(
              "vi-VN"
            )}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Trạng thái:</div>
            <div>${order.status}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Mô tả sự cố:</div>
            <div>${order.issueDescription}</div>
          </div>
          ${
            order.notes
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
            ${
              materialsHtml ||
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
          ${
            order.depositAmount
              ? `<div class="total-row">
            Đã đặt cọc: <strong>${formatCurrency(order.depositAmount)}</strong>
          </div>`
              : ""
          }
          <div class="grand-total">
            Tổng cộng: ${formatCurrency(order.total)}
          </div>
          ${
            order.paymentStatus === "unpaid"
              ? order.depositAmount && order.depositAmount > 0
                ? `<div style="color: #f97316; margin-top: 10px;">💰 Đã cọc: ${formatCurrency(
                    order.depositAmount
                  )} | Còn nợ: ${formatCurrency(
                    order.total - order.depositAmount
                  )}</div>`
                : '<div style="color: #ef4444; margin-top: 10px;">Chưa thanh toán</div>'
              : order.paymentStatus === "partial"
              ? `<div style="color: #f97316; margin-top: 10px;">Đã trả: ${formatCurrency(
                  (order.depositAmount || 0) + (order.partialPaymentAmount || 0)
                )} | Còn nợ: ${formatCurrency(
                  order.total -
                    (order.depositAmount || 0) -
                    (order.partialPaymentAmount || 0)
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
            <div className="text-xs text-pin-gray-600 dark:text-pin-dark-600">
              👤 {order.technicianName}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "customer",
      label: "Khách hàng",
      render: (order) => (
        <div className="space-y-1">
          <div className="font-medium">{order.customerName}</div>
          <div className="text-xs text-pin-gray-500 dark:text-pin-dark-500">
            📞 {order.customerPhone}
          </div>
          <div className="text-xs font-medium text-pin-blue-600 dark:text-pin-blue-400">
            🛠 {order.deviceName}
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
        if (materials.length === 0) {
          return (
            <div className="text-xs text-pin-gray-400 dark:text-pin-dark-400 italic">
              Chưa có vật tư
            </div>
          );
        }
        return (
          <div className="space-y-1">
            {materials.slice(0, 3).map((m: any, idx: number) => (
              <div
                key={idx}
                className="text-xs text-pin-gray-600 dark:text-pin-dark-600"
              >
                📦 {m.materialName || m.name} ×{m.quantity}
              </div>
            ))}
            {materials.length > 3 && (
              <div className="text-xs text-pin-gray-400 dark:text-pin-dark-400 italic">
                +{materials.length - 3} vật tư khác
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

        if (order.paymentStatus === "paid") {
          return (
            <div className="text-sm font-medium text-pin-green-600 dark:text-pin-green-400">
              ✓ Đã thanh toán
            </div>
          );
        }

        return (
          <div className="space-y-1 text-sm">
            {depositAmount > 0 && (
              <div className="text-pin-green-600 dark:text-pin-green-400 font-medium">
                💰 Đã cọc {formatCurrency(depositAmount)}
              </div>
            )}
            {partialPayment > 0 && (
              <div className="text-pin-green-600 dark:text-pin-green-400 font-medium">
                💳 Đã trả {formatCurrency(partialPayment)}
              </div>
            )}
            {remaining > 0 && (
              <div className="text-pin-red-600 dark:text-pin-red-400 font-medium">
                📌 Còn nợ {formatCurrency(remaining)}
              </div>
            )}
            {totalPaid === 0 && (
              <div className="text-pin-red-600 dark:text-pin-red-400 font-medium">
                ⚠ Chưa thanh toán
              </div>
            )}
          </div>
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
            onClick={() => handlePrint(order)}
            className="p-2 text-pin-green-600 hover:bg-pin-green-50 dark:hover:bg-pin-green-900/20 rounded-lg transition-colors"
            title="In phiếu"
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
    <div className="space-y-6">
      {/* Page Header with Stats */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-pin-gray-900 dark:text-pin-dark-900">
            Quản lý Sửa chữa
          </h1>
          <p className="text-pin-gray-500 dark:text-pin-dark-500 mt-1">
            Quản lý phiếu sửa chữa và bảo hành
          </p>
        </div>

        {/* 4 Stats Cards + Button */}
        <div className="flex flex-col gap-3 lg:flex-1 lg:max-w-4xl">
          <div className="flex items-center gap-3">
            <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatsCard
                title="Tổng phiếu"
                value={stats.total}
                iconName="orders"
                variant="primary"
                compact
              />
              <StatsCard
                title="Chờ xử lý"
                value={stats.pending}
                iconName="pending"
                variant="warning"
                compact
              />
              <StatsCard
                title="Đang sửa"
                value={stats.inProgress}
                iconName="repairs"
                variant="primary"
                compact
              />
              <StatsCard
                title="Hoàn thành"
                value={stats.completed}
                iconName="success"
                variant="success"
                compact
              />
            </div>
            <Button
              variant="primary"
              size="lg"
              leftIcon={<PlusIcon className="w-5 h-5" />}
              onClick={() => handleOpenModal()}
              className="flex-shrink-0"
            >
              Tạo phiếu mới
            </Button>
          </div>
        </div>
      </div>

      {/* Revenue Stats - 2 Cards */}
      <CardGrid cols={2}>
        <StatsCard
          title="Tổng doanh thu"
          value={formatCurrency(stats.totalRevenue)}
          iconName="money"
          variant="success"
        />
        <StatsCard
          title="Chưa thanh toán"
          value={formatCurrency(stats.unpaidAmount)}
          iconName="calendar"
          variant="danger"
        />
      </CardGrid>

      {/* Filters */}
      <Card padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="Tìm theo tên, SĐT, thiết bị, mã phiếu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-pin-gray-50 dark:bg-pin-dark-100 border border-pin-gray-200 dark:border-pin-dark-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pin-blue-500"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-pin-gray-50 dark:bg-pin-dark-100 border border-pin-gray-200 dark:border-pin-dark-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-pin-blue-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="pending">Chờ xử lý</option>
            <option value="inProgress">Đang sửa</option>
            <option value="completed">Hoàn thành</option>
          </select>
        </div>
      </Card>

      {/* Orders Table */}
      <Card padding="none">
        <div className="p-6 border-b border-pin-gray-200 dark:border-pin-dark-300">
          <CardTitle icon={<WrenchScrewdriverIcon className="w-5 h-5" />}>
            Danh sách phiếu sửa chữa ({filteredOrders.length})
          </CardTitle>
        </div>
        <div className="p-6">
          <DataTable
            columns={columns}
            data={filteredOrders}
            keyExtractor={(order) => order.id}
            emptyMessage="Chưa có phiếu sửa chữa nào"
          />
        </div>
      </Card>

      {/* Repair Modal */}
      <PinRepairModalNew
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedOrder(null);
        }}
        onSave={handleSaveOrder}
        initialOrder={selectedOrder}
        currentUser={currentUser}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        size="sm"
      >
        <ModalHeader>
          <ModalTitle>Xác nhận xóa</ModalTitle>
        </ModalHeader>
        <ModalBody>
          <p className="text-pin-gray-600 dark:text-pin-dark-600">
            Bạn có chắc chắn muốn xóa phiếu sửa chữa này không? Hành động này
            không thể hoàn tác.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button
            variant="secondary"
            onClick={() => setDeleteConfirmOpen(false)}
          >
            Hủy
          </Button>
          <Button variant="danger" onClick={handleDeleteConfirm}>
            Xóa phiếu
          </Button>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default PinRepairManagerNew;
