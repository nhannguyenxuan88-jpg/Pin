import React, { useState } from "react";
import { usePinContext } from "../contexts/PinContext";
import {
  UserGroupIcon,
  PlusIcon,
  PencilSquareIcon,
  TrashIcon,
  BuildingLibraryIcon,
  ArrowDownTrayIcon,
} from "./common/Icons";
import type { PinCustomer, Supplier } from "../types";
import BackupManager from "./BackupManager";

const PinSettings: React.FC = () => {
  const {
    pinCustomers,
    setPinCustomers,
    suppliers,
    setSuppliers,
    upsertSupplier,
    upsertPinCustomer,
  } = usePinContext();

  const [activeTab, setActiveTab] = useState<
    "customers" | "suppliers" | "backup"
  >("customers");
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<PinCustomer | null>(
    null
  );
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const [supplierForm, setSupplierForm] = useState({
    name: "",
    phone: "",
    address: "",
  });

  const handleAddCustomer = async () => {
    if (!customerForm.name.trim()) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }

    const newCustomer: PinCustomer = {
      id: crypto.randomUUID(),
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
    };

    try {
      await upsertPinCustomer(newCustomer);
      setShowCustomerModal(false);
      setCustomerForm({ name: "", phone: "", address: "" });
    } catch (error) {
      console.error("Error adding customer:", error);
      alert("Lỗi khi thêm khách hàng: " + (error as any).message);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!editingCustomer || !customerForm.name.trim()) {
      alert("Vui lòng nhập tên khách hàng");
      return;
    }

    const updatedCustomer: PinCustomer = {
      ...editingCustomer,
      name: customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      address: customerForm.address.trim(),
    };

    try {
      await upsertPinCustomer(updatedCustomer);
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setCustomerForm({ name: "", phone: "", address: "" });
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Lỗi khi cập nhật khách hàng: " + (error as any).message);
    }
  };

  const handleDeleteCustomer = (id: string) => {
    if (window.confirm("Bạn có chắc muốn xóa khách hàng này?")) {
      setPinCustomers(pinCustomers.filter((c: PinCustomer) => c.id !== id));
      alert("Đã xóa khách hàng");
    }
  };

  const handleAddSupplier = async () => {
    if (!supplierForm.name.trim()) {
      alert("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    const newSupplier: Supplier = {
      id: crypto.randomUUID(),
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      address: supplierForm.address.trim(),
    };

    try {
      await upsertSupplier(newSupplier);
      setShowSupplierModal(false);
      setSupplierForm({ name: "", phone: "", address: "" });
    } catch (error) {
      console.error("Error adding supplier:", error);
      alert("Lỗi khi thêm nhà cung cấp: " + (error as any).message);
    }
  };

  const handleUpdateSupplier = async () => {
    if (!editingSupplier || !supplierForm.name.trim()) {
      alert("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    const updatedSupplier: Supplier = {
      ...editingSupplier,
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      address: supplierForm.address.trim(),
    };

    try {
      await upsertSupplier(updatedSupplier);
      setShowSupplierModal(false);
      setEditingSupplier(null);
      setSupplierForm({ name: "", phone: "", address: "" });
    } catch (error) {
      console.error("Error updating supplier:", error);
      alert("Lỗi khi cập nhật nhà cung cấp: " + (error as any).message);
    }
  };

  const handleDeleteSupplier = (id: string) => {
    if (window.confirm("Bạn có chắc muốn xóa nhà cung cấp này?")) {
      setSuppliers(suppliers.filter((s: Supplier) => s.id !== id));
      alert("Đã xóa nhà cung cấp");
    }
  };

  const openEditCustomer = (customer: PinCustomer) => {
    setEditingCustomer(customer);
    setCustomerForm({
      name: customer.name,
      phone: customer.phone || "",
      address: customer.address || "",
    });
    setShowCustomerModal(true);
  };

  const openEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setSupplierForm({
      name: supplier.name,
      phone: supplier.phone || "",
      address: supplier.address || "",
    });
    setShowSupplierModal(true);
  };

  const openAddCustomer = () => {
    setEditingCustomer(null);
    setCustomerForm({ name: "", phone: "", address: "" });
    setShowCustomerModal(true);
  };

  const openAddSupplier = () => {
    setEditingSupplier(null);
    setSupplierForm({ name: "", phone: "", address: "" });
    setShowSupplierModal(true);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100">
        Danh bạ
      </h1>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border dark:border-slate-700">
        <div className="flex border-b dark:border-slate-700">
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "customers"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <UserGroupIcon className="w-5 h-5" />
            <span>Khách hàng</span>
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "suppliers"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <BuildingLibraryIcon className="w-5 h-5" />
            <span>Nhà cung cấp</span>
          </button>
          <button
            onClick={() => setActiveTab("backup")}
            className={`flex-1 flex items-center justify-center space-x-2 px-6 py-4 font-medium transition-colors ${
              activeTab === "backup"
                ? "border-b-2 border-blue-600 text-blue-600 dark:text-blue-400"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            }`}
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            <span>Sao lưu</span>
          </button>
        </div>

        <div className="p-6">
          {activeTab === "customers" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Danh sách khách hàng ({pinCustomers.length})
                </h2>
                <button
                  onClick={openAddCustomer}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Thêm khách hàng</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Tên khách hàng
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Số điện thoại
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Địa chỉ
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {pinCustomers.map((customer: PinCustomer) => (
                      <tr
                        key={customer.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium">
                          {customer.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {customer.phone || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {customer.address || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditCustomer(customer)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Xóa"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {pinCustomers.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Chưa có khách hàng nào
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "suppliers" ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Danh sách nhà cung cấp ({suppliers.length})
                </h2>
                <button
                  onClick={openAddSupplier}
                  className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <PlusIcon className="w-5 h-5" />
                  <span>Thêm nhà cung cấp</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Tên nhà cung cấp
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Số điện thoại
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Địa chỉ
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-slate-600 dark:text-slate-300">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-slate-700">
                    {suppliers.map((supplier: Supplier) => (
                      <tr
                        key={supplier.id}
                        className="hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3 text-slate-800 dark:text-slate-100 font-medium">
                          {supplier.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {supplier.phone || "-"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {supplier.address || "-"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => openEditSupplier(supplier)}
                              className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                              title="Chỉnh sửa"
                            >
                              <PencilSquareIcon className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(supplier.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                              title="Xóa"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {suppliers.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    Chưa có nhà cung cấp nào
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-2">
                  📦 Quản lý Sao lưu & Khôi phục
                </h2>
                <p className="text-slate-600 dark:text-slate-400 text-sm">
                  Sao lưu toàn bộ dữ liệu để đảm bảo an toàn
                </p>
              </div>

              <button
                onClick={() => setShowBackupModal(true)}
                className="w-full flex items-center justify-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-4 rounded-xl font-medium transition-all shadow-lg hover:shadow-xl"
              >
                <ArrowDownTrayIcon className="w-6 h-6" />
                <span>Mở Quản lý Sao lưu</span>
              </button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">💾</div>
                  <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    Xuất JSON
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Toàn bộ dữ liệu có thể import lại
                  </p>
                </div>

                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">📊</div>
                  <h3 className="font-semibold text-emerald-800 dark:text-emerald-300 mb-1">
                    Xuất Excel
                  </h3>
                  <p className="text-sm text-emerald-700 dark:text-emerald-400">
                    File CSV dễ đọc và phân tích
                  </p>
                </div>

                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="text-2xl mb-2">🔄</div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-1">
                    Khôi phục
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    Import dữ liệu từ file backup
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                <h4 className="font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <span>💡</span>
                  <span>Khuyến nghị</span>
                </h4>
                <ul className="text-sm text-slate-600 dark:text-slate-300 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Sao lưu dữ liệu hàng ngày để tránh mất mát</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>Lưu file backup vào nhiều nơi khác nhau</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>
                      Kiểm tra file backup định kỳ để đảm bảo có thể khôi phục
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    <span>
                      Sử dụng dịch vụ cloud (Google Drive, Dropbox) để lưu trữ
                      an toàn
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup Modal */}
      <BackupManager
        isOpen={showBackupModal}
        onClose={() => setShowBackupModal(false)}
      />

      {/* Customer Modal */}
      {showCustomerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                {editingCustomer
                  ? "Chỉnh sửa khách hàng"
                  : "Thêm khách hàng mới"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên khách hàng <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerForm.name}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập tên khách hàng"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={customerForm.phone}
                  onChange={(e) =>
                    setCustomerForm({ ...customerForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ
                </label>
                <textarea
                  value={customerForm.address}
                  onChange={(e) =>
                    setCustomerForm({
                      ...customerForm,
                      address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập địa chỉ"
                />
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCustomerModal(false);
                  setEditingCustomer(null);
                  setCustomerForm({ name: "", phone: "", address: "" });
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={
                  editingCustomer ? handleUpdateCustomer : handleAddCustomer
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingCustomer ? "Cập nhật" : "Thêm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b dark:border-slate-700">
              <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                {editingSupplier
                  ? "Chỉnh sửa nhà cung cấp"
                  : "Thêm nhà cung cấp mới"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Tên nhà cung cấp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={supplierForm.name}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập tên nhà cung cấp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={supplierForm.phone}
                  onChange={(e) =>
                    setSupplierForm({ ...supplierForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập số điện thoại"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Địa chỉ
                </label>
                <textarea
                  value={supplierForm.address}
                  onChange={(e) =>
                    setSupplierForm({
                      ...supplierForm,
                      address: e.target.value,
                    })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100"
                  placeholder="Nhập địa chỉ"
                />
              </div>
            </div>
            <div className="p-6 border-t dark:border-slate-700 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowSupplierModal(false);
                  setEditingSupplier(null);
                  setSupplierForm({ name: "", phone: "", address: "" });
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={
                  editingSupplier ? handleUpdateSupplier : handleAddSupplier
                }
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                {editingSupplier ? "Cập nhật" : "Thêm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinSettings;
