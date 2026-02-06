/**
 * PurchaseOrderManager - Quản lý đơn đặt hàng NCC (Redesigned like MotoCare)
 */
import React, { useState, useEffect, useMemo } from "react";
import { PurchaseOrderService } from "../lib/services/PurchaseOrderService";
import { usePinContext } from "../contexts/PinContext";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus, PinMaterial, Supplier } from "../types";
import { PlusIcon, TrashIcon, XMarkIcon } from "./common/Icons";
import { getErrorMessage } from "../lib/utils/errorUtils";

// Format currency
const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("vi-VN").format(amount) + " đ";

// Status config
const STATUS_CONFIG: Record<PurchaseOrderStatus, { label: string; bg: string; text: string; icon: string }> = {
    draft: { label: "NHÁP", bg: "bg-slate-600", text: "text-slate-100", icon: "📝" },
    confirmed: { label: "ĐÃ ĐẶT", bg: "bg-blue-600", text: "text-blue-100", icon: "✓" },
    partial: { label: "NHẬN 1 PHẦN", bg: "bg-amber-600", text: "text-amber-100", icon: "⏳" },
    received: { label: "ĐÃ NHẬN", bg: "bg-emerald-600", text: "text-emerald-100", icon: "✓" },
    cancelled: { label: "ĐÃ HỦY", bg: "bg-red-600", text: "text-red-100", icon: "✕" },
};

interface Props {
    materials: PinMaterial[];
    suppliers: Supplier[];
}

export default function PurchaseOrderManager({ materials, suppliers }: Props) {
    const ctx = usePinContext();
    const currentUser = ctx.currentUser;

    const [orders, setOrders] = useState<PurchaseOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
    const [statusFilter, setStatusFilter] = useState<PurchaseOrderStatus | "all">("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Form state
    const [formData, setFormData] = useState({
        supplierId: "",
        supplierName: "",
        notes: "",
        expectedDate: "",
        items: [] as PurchaseOrderItem[],
    });

    // Material search for form
    const [materialSearch, setMaterialSearch] = useState("");

    // Quick add modals
    const [showAddMaterial, setShowAddMaterial] = useState(false);
    const [showAddSupplier, setShowAddSupplier] = useState(false);
    const [newMaterial, setNewMaterial] = useState({ name: "", sku: "", unit: "Cái", purchasePrice: 0, retailPrice: 0 });
    const [newSupplier, setNewSupplier] = useState({ name: "", phone: "" });

    // Load orders
    useEffect(() => {
        loadOrders();
    }, []);

    const loadOrders = async () => {
        setLoading(true);
        const data = await PurchaseOrderService.getOrders();
        setOrders(data);
        setLoading(false);
    };

    // Filter counts
    const statusCounts = useMemo(() => ({
        all: orders.length,
        draft: orders.filter((o) => o.status === "draft").length,
        confirmed: orders.filter((o) => o.status === "confirmed").length,
        received: orders.filter((o) => o.status === "received").length,
        cancelled: orders.filter((o) => o.status === "cancelled").length,
    }), [orders]);

    // Filtered orders
    const filteredOrders = useMemo(() => {
        let result = orders;
        if (statusFilter !== "all") {
            result = result.filter((o) => o.status === statusFilter);
        }
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            result = result.filter((o) =>
                o.code.toLowerCase().includes(term) ||
                o.supplierName.toLowerCase().includes(term)
            );
        }
        return result;
    }, [orders, statusFilter, searchTerm]);

    // Filtered materials for form
    const filteredMaterials = useMemo(() => {
        if (!materialSearch) return materials.slice(0, 50);
        const term = materialSearch.toLowerCase();
        return materials.filter((m) =>
            m.name.toLowerCase().includes(term) ||
            m.sku.toLowerCase().includes(term)
        ).slice(0, 50);
    }, [materials, materialSearch]);

    // Reset form  
    const resetForm = () => {
        setFormData({ supplierId: "", supplierName: "", notes: "", expectedDate: "", items: [] });
        setEditingOrder(null);
        setMaterialSearch("");
    };

    // Quick add material
    const handleAddMaterial = async () => {
        if (!newMaterial.name.trim()) {
            alert("Vui lòng nhập tên sản phẩm");
            return;
        }
        try {
            const sku = newMaterial.sku || `NL-${Date.now()}`;
            await ctx.addPinMaterial?.({
                id: crypto.randomUUID(),
                name: newMaterial.name,
                sku,
                unit: newMaterial.unit,
                purchasePrice: newMaterial.purchasePrice,
                retailPrice: newMaterial.retailPrice,
                stock: 0,
                wholesalePrice: newMaterial.retailPrice,
            });
            setShowAddMaterial(false);
            setNewMaterial({ name: "", sku: "", unit: "Cái", purchasePrice: 0, retailPrice: 0 });
            alert("Đã thêm sản phẩm mới!");
        } catch (err) {
            alert("Lỗi: " + getErrorMessage(err));
        }
    };

    // Quick add supplier
    const handleAddSupplier = async () => {
        if (!newSupplier.name.trim()) {
            alert("Vui lòng nhập tên NCC");
            return;
        }
        try {
            const id = crypto.randomUUID();
            await ctx.addSupplier?.({ id, name: newSupplier.name, phone: newSupplier.phone });
            // Auto select new supplier
            setFormData(prev => ({ ...prev, supplierId: id, supplierName: newSupplier.name }));
            setShowAddSupplier(false);
            setNewSupplier({ name: "", phone: "" });
        } catch (err) {
            alert("Lỗi: " + getErrorMessage(err));
        }
    };

    // Add material to cart
    const addMaterialToCart = (material: PinMaterial) => {
        const existing = formData.items.find((i) => i.materialId === material.id);
        if (existing) {
            // Increase quantity
            setFormData((prev) => ({
                ...prev,
                items: prev.items.map((i) =>
                    i.materialId === material.id
                        ? { ...i, quantity: i.quantity + 1, totalPrice: (i.quantity + 1) * i.unitPrice }
                        : i
                ),
            }));
        } else {
            // Add new
            setFormData((prev) => ({
                ...prev,
                items: [
                    ...prev.items,
                    {
                        id: crypto.randomUUID(),
                        materialId: material.id,
                        materialName: material.name,
                        materialSku: material.sku,
                        quantity: 1,
                        unit: material.unit,
                        unitPrice: material.purchasePrice || 0,
                        totalPrice: material.purchasePrice || 0,
                        receivedQuantity: 0,
                    },
                ],
            }));
        }
    };

    // Update item quantity
    const updateItemQuantity = (id: string, quantity: number) => {
        if (quantity <= 0) {
            removeItem(id);
            return;
        }
        setFormData((prev) => ({
            ...prev,
            items: prev.items.map((i) =>
                i.id === id ? { ...i, quantity, totalPrice: quantity * i.unitPrice } : i
            ),
        }));
    };

    // Remove item
    const removeItem = (id: string) => {
        setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((i) => i.id !== id),
        }));
    };

    // Cart total
    const cartTotal = useMemo(
        () => formData.items.reduce((sum, i) => sum + i.totalPrice, 0),
        [formData.items]
    );

    // Submit
    const handleSubmit = async () => {
        if (!formData.supplierName.trim()) {
            alert("Vui lòng chọn nhà cung cấp");
            return;
        }
        if (formData.items.length === 0) {
            alert("Vui lòng thêm ít nhất 1 sản phẩm");
            return;
        }

        try {
            if (editingOrder) {
                await PurchaseOrderService.updateOrder(editingOrder.id, {
                    ...formData,
                    items: formData.items,
                });
            } else {
                await PurchaseOrderService.createOrder({
                    ...formData,
                    status: "draft",
                    totalAmount: cartTotal,
                    paidAmount: 0,
                    items: formData.items,
                    createdBy: currentUser?.name,
                });
            }
            await loadOrders();
            setShowForm(false);
            resetForm();
        } catch (err) {
            alert("Lỗi khi lưu đơn hàng: " + getErrorMessage(err));
        }
    };

    // Actions
    const handleConfirm = async (id: string) => {
        if (confirm("Xác nhận đơn hàng này?")) {
            await PurchaseOrderService.confirmOrder(id);
            await loadOrders();
        }
    };

    const handleCancel = async (id: string) => {
        if (confirm("Hủy đơn hàng này?")) {
            await PurchaseOrderService.cancelOrder(id);
            await loadOrders();
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Xóa đơn hàng này?")) {
            await PurchaseOrderService.deleteOrder(id);
            await loadOrders();
        }
    };

    return (
        <div className="h-full flex flex-col bg-slate-900 text-white">
            {/* Filter Tabs */}
            <div className="flex items-center gap-2 p-3 border-b border-slate-700">
                {[
                    { value: "all" as const, label: "TẤT CẢ" },
                    { value: "draft" as const, label: "NHÁP" },
                    { value: "confirmed" as const, label: "ĐÃ ĐẶT" },
                    { value: "received" as const, label: "ĐÃ NHẬN" },
                    { value: "cancelled" as const, label: "ĐÃ HỦY" },
                ].map((tab) => (
                    <button
                        key={tab.value}
                        onClick={() => setStatusFilter(tab.value)}
                        className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${statusFilter === tab.value
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                            }`}
                    >
                        {tab.label}{" "}
                        <span className="ml-1 opacity-70">{statusCounts[tab.value]}</span>
                    </button>
                ))}

                <div className="flex-1" />

                <button
                    onClick={() => {
                        resetForm();
                        setShowForm(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-bold transition-colors"
                >
                    <PlusIcon className="w-4 h-4" />
                    Tạo đơn mới
                </button>
            </div>

            {/* Orders List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-center py-12 text-slate-400">Đang tải...</div>
                ) : filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">Chưa có đơn đặt hàng nào</div>
                ) : (
                    filteredOrders.map((order) => (
                        <div
                            key={order.id}
                            className="bg-slate-800 rounded-xl p-4 border border-slate-700 hover:border-slate-600 transition-colors"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-mono font-bold text-white">
                                        {order.code}
                                    </span>
                                    <span
                                        className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${STATUS_CONFIG[order.status].bg} ${STATUS_CONFIG[order.status].text}`}
                                    >
                                        {STATUS_CONFIG[order.status].icon} {STATUS_CONFIG[order.status].label}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs text-slate-400">
                                        Tổng tiền ({order.items.length} món)
                                    </div>
                                    <div className="text-xl font-bold text-emerald-400">
                                        {formatCurrency(order.totalAmount)}
                                    </div>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">Nhà cung cấp:</div>
                                    <div className="text-cyan-400 font-medium">{order.supplierName}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">Người tạo:</div>
                                    <div className="text-white">{order.createdBy || "—"}</div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">Ngày đặt:</div>
                                    <div className="text-white">
                                        {order.created_at
                                            ? new Date(order.created_at).toLocaleDateString("vi-VN")
                                            : "—"}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-slate-400 text-xs mb-1">Dự kiến:</div>
                                    <div className="text-white">
                                        {order.expectedDate
                                            ? new Date(order.expectedDate).toLocaleDateString("vi-VN")
                                            : "—"}
                                    </div>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-700">
                                {order.status === "draft" && (
                                    <>
                                        <button
                                            onClick={() => handleConfirm(order.id)}
                                            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                                        >
                                            ✓ Xác nhận đặt
                                        </button>
                                        <button
                                            onClick={() => handleDelete(order.id)}
                                            className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded-lg"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                                {order.status === "confirmed" && (
                                    <>
                                        <button
                                            onClick={() => {/* TODO: Receive flow */ }}
                                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
                                        >
                                            🚚 Nhận hàng
                                        </button>
                                        <button
                                            onClick={() => handleCancel(order.id)}
                                            className="px-3 py-1.5 text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 rounded-lg font-medium"
                                        >
                                            Hủy
                                        </button>
                                    </>
                                )}
                                <button className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg">
                                    👁️
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Create/Edit Modal - Split Layout like MotoCare */}
            {showForm && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden border border-slate-700">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 bg-emerald-600">
                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                🛒 {editingOrder ? "Sửa đơn đặt hàng" : "Tạo đơn đặt hàng mới"}
                            </h3>
                            <button
                                onClick={() => {
                                    setShowForm(false);
                                    resetForm();
                                }}
                                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
                            >
                                <XMarkIcon className="w-6 h-6 text-white" />
                            </button>
                        </div>

                        {/* Modal Body - 2 Column Layout */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left: Product Search */}
                            <div className="w-1/2 border-r border-slate-700 flex flex-col">
                                {/* Search */}
                                <div className="p-4 border-b border-slate-700">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder="🔍 Tìm theo tên, SKU, mã vạch..."
                                            value={materialSearch}
                                            onChange={(e) => setMaterialSearch(e.target.value)}
                                            className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-emerald-500 focus:outline-none"
                                        />
                                        <button
                                            onClick={() => setShowAddMaterial(true)}
                                            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-sm flex items-center gap-1"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                            Tạo mới
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-3 text-xs text-slate-400">
                                        <span>Tất cả: {materials.length}</span>
                                        <span className="px-2 py-0.5 bg-red-600 text-white rounded">
                                            Sắp hết: {materials.filter((m) => m.stock <= 5).length}
                                        </span>
                                    </div>
                                </div>

                                {/* Product List */}
                                <div className="flex-1 overflow-y-auto">
                                    {filteredMaterials.map((mat) => (
                                        <div
                                            key={mat.id}
                                            onClick={() => addMaterialToCart(mat)}
                                            className="p-3 border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors"
                                        >
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="font-medium text-white">{mat.name}</div>
                                                    <div className="text-xs text-slate-400 mt-0.5">
                                                        SKU: {mat.sku} • {mat.supplier || "Chưa có NCC"}
                                                    </div>
                                                    <div className="flex items-center gap-4 mt-1 text-xs">
                                                        <span>
                                                            Giá nhập:{" "}
                                                            <span className="text-amber-400 font-medium">
                                                                {formatCurrency(mat.purchasePrice || 0)}
                                                            </span>
                                                        </span>
                                                        <span>
                                                            Giá bán:{" "}
                                                            <span className="text-emerald-400 font-medium">
                                                                {formatCurrency(mat.retailPrice || mat.wholesalePrice || 0)}
                                                            </span>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div
                                                    className={`px-2 py-1 rounded text-xs font-bold ${mat.stock === 0
                                                        ? "bg-red-600 text-white"
                                                        : mat.stock <= 5
                                                            ? "bg-amber-600 text-white"
                                                            : "bg-slate-600 text-slate-200"
                                                        }`}
                                                >
                                                    Tồn: {mat.stock}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: Cart */}
                            <div className="w-1/2 flex flex-col bg-slate-850">
                                {/* Cart Header */}
                                <div className="p-4 border-b border-slate-700 flex items-center justify-between">
                                    <h4 className="font-bold text-white">Giỏ hàng</h4>
                                    <span className="text-sm text-slate-400">
                                        {formData.items.length} sản phẩm
                                    </span>
                                </div>

                                {/* Supplier Select */}
                                <div className="p-4 border-b border-slate-700">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-slate-400">🏢</span>
                                        <span className="text-sm text-slate-300">Nhà cung cấp</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <select
                                            value={formData.supplierId}
                                            onChange={(e) => {
                                                const sup = suppliers.find((s) => s.id === e.target.value);
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    supplierId: e.target.value,
                                                    supplierName: sup?.name || "",
                                                }));
                                            }}
                                            className="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                        >
                                            <option value="">-- Chọn nhà cung cấp --</option>
                                            {suppliers.map((s) => (
                                                <option key={s.id} value={s.id}>
                                                    {s.name}
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setShowAddSupplier(true)}
                                            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
                                        >
                                            <PlusIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Cart Items */}
                                <div className="flex-1 overflow-y-auto">
                                    {formData.items.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-slate-400">
                                            <span className="text-4xl mb-2">🛒</span>
                                            <span>Chưa có sản phẩm nào</span>
                                            <span className="text-xs">Chọn sản phẩm bên trái</span>
                                        </div>
                                    ) : (
                                        formData.items.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 border-b border-slate-700 flex items-center gap-3"
                                            >
                                                <div className="flex-1">
                                                    <div className="text-sm font-medium text-white">
                                                        {item.materialName}
                                                    </div>
                                                    <div className="text-xs text-slate-400">
                                                        {formatCurrency(item.unitPrice)} × {item.quantity}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        onClick={() => updateItemQuantity(item.id, item.quantity - 1)}
                                                        className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded text-white"
                                                    >
                                                        -
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={(e) =>
                                                            updateItemQuantity(item.id, parseInt(e.target.value) || 1)
                                                        }
                                                        className="w-12 text-center bg-slate-900 border border-slate-600 rounded text-white"
                                                    />
                                                    <button
                                                        onClick={() => updateItemQuantity(item.id, item.quantity + 1)}
                                                        className="w-7 h-7 bg-slate-700 hover:bg-slate-600 rounded text-white"
                                                    >
                                                        +
                                                    </button>
                                                </div>
                                                <div className="text-sm font-bold text-emerald-400 w-24 text-right">
                                                    {formatCurrency(item.totalPrice)}
                                                </div>
                                                <button
                                                    onClick={() => removeItem(item.id)}
                                                    className="p-1 text-slate-400 hover:text-red-400"
                                                >
                                                    <TrashIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Date & Notes */}
                                <div className="p-4 border-t border-slate-700 grid grid-cols-2 gap-4">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                                            📅 Ngày giao hàng
                                        </div>
                                        <input
                                            type="date"
                                            value={formData.expectedDate}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, expectedDate: e.target.value }))
                                            }
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2 mb-1 text-xs text-slate-400">
                                            📝 Ghi chú
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="Nhập ghi chú..."
                                            value={formData.notes}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, notes: e.target.value }))
                                            }
                                            className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Total & Actions */}
                                <div className="p-4 border-t border-slate-700 bg-slate-900">
                                    <div className="flex items-center justify-between mb-4">
                                        <span className="text-lg font-bold text-white">Tổng cộng:</span>
                                        <span className="text-2xl font-bold text-emerald-400">
                                            {formatCurrency(cartTotal)}
                                        </span>
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => {
                                                setShowForm(false);
                                                resetForm();
                                            }}
                                            className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-bold"
                                        >
                                            Hủy
                                        </button>
                                        <button
                                            onClick={handleSubmit}
                                            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                                        >
                                            {editingOrder ? "Cập nhật" : "Tạo đơn"}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Material Modal */}
            {showAddMaterial && (
                <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700">
                        <div className="flex items-center justify-between px-4 py-3 bg-emerald-600 rounded-t-xl">
                            <h4 className="font-bold text-white">➕ Thêm sản phẩm mới</h4>
                            <button onClick={() => setShowAddMaterial(false)} className="text-white/70 hover:text-white">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Tên sản phẩm *</label>
                                <input
                                    type="text"
                                    value={newMaterial.name}
                                    onChange={(e) => setNewMaterial(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    placeholder="Nhập tên sản phẩm..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Mã SKU</label>
                                    <input
                                        type="text"
                                        value={newMaterial.sku}
                                        onChange={(e) => setNewMaterial(prev => ({ ...prev, sku: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                        placeholder="Tự động nếu bỏ trống"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Đơn vị</label>
                                    <input
                                        type="text"
                                        value={newMaterial.unit}
                                        onChange={(e) => setNewMaterial(prev => ({ ...prev, unit: e.target.value }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Giá nhập</label>
                                    <input
                                        type="number"
                                        value={newMaterial.purchasePrice}
                                        onChange={(e) => setNewMaterial(prev => ({ ...prev, purchasePrice: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Giá bán</label>
                                    <input
                                        type="number"
                                        value={newMaterial.retailPrice}
                                        onChange={(e) => setNewMaterial(prev => ({ ...prev, retailPrice: parseFloat(e.target.value) || 0 }))}
                                        className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 p-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowAddMaterial(false)}
                                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAddMaterial}
                                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                            >
                                Thêm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Quick Add Supplier Modal */}
            {showAddSupplier && (
                <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
                    <div className="bg-slate-800 rounded-xl w-full max-w-md border border-slate-700">
                        <div className="flex items-center justify-between px-4 py-3 bg-blue-600 rounded-t-xl">
                            <h4 className="font-bold text-white">🏢 Thêm nhà cung cấp mới</h4>
                            <button onClick={() => setShowAddSupplier(false)} className="text-white/70 hover:text-white">
                                <XMarkIcon className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Tên NCC *</label>
                                <input
                                    type="text"
                                    value={newSupplier.name}
                                    onChange={(e) => setNewSupplier(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    placeholder="Nhập tên nhà cung cấp..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-slate-400 mb-1">Số điện thoại</label>
                                <input
                                    type="tel"
                                    value={newSupplier.phone}
                                    onChange={(e) => setNewSupplier(prev => ({ ...prev, phone: e.target.value }))}
                                    className="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                                    placeholder="0xxx xxx xxx"
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 p-4 border-t border-slate-700">
                            <button
                                onClick={() => setShowAddSupplier(false)}
                                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAddSupplier}
                                className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                            >
                                Thêm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

