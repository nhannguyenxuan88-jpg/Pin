import React, { useState, useMemo, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type { PinProduct, PinBOM, ProductionOrder } from "../types";
import { XMarkIcon } from "./common/Icons";
import { Icon, type IconName } from "./common/Icon";
import Pagination from "./common/Pagination";
import ProductDeletionModal from "./ProductDeletionModal";
import { useProductDeletion, DeletionOptions } from "../lib/hooks/useProductDeletion";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

type ActionButtonVariant = "danger" | "warning" | "primary" | "muted";

interface ActionButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> {
  icon: IconName;
  label: string;
  variant: ActionButtonVariant;
}

const variantStyles: Record<ActionButtonVariant, string> = {
  danger: "text-rose-400",
  warning: "text-amber-400",
  primary: "text-cyan-400",
  muted: "text-slate-400 dark:text-slate-300",
};

const ActionButton: React.FC<ActionButtonProps> = ({
  icon,
  label,
  variant,
  disabled,
  className,
  ...props
}) => {
  const tooltipClasses = disabled
    ? "hidden"
    : "pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 translate-y-1 opacity-0 group-hover:opacity-100 group-hover:-translate-y-0 transition-all duration-150 rounded-md bg-slate-900/90 text-white text-[11px] font-medium px-2 py-1 whitespace-nowrap shadow-lg z-50";

  return (
    <div className={`relative group ${className ?? ""}`}>
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        className={`h-10 w-10 rounded-full flex items-center justify-center ring-1 ring-inset transition-colors duration-200 focus:outline-none ${
          disabled
            ? "opacity-30 cursor-not-allowed bg-slate-100 ring-slate-200 dark:bg-slate-800/40 dark:ring-slate-600"
            : "bg-slate-50 ring-slate-200 dark:bg-slate-700 dark:ring-slate-500 hover:bg-slate-100 dark:hover:bg-slate-600 hover:-translate-y-0.5"
        }`}
        {...props}
      >
        <Icon
          name={icon}
          weight="bold"
          className={`w-6 h-6 transition-opacity duration-200 ${
            disabled ? "opacity-75" : "opacity-100"
          } ${variantStyles[variant]}`}
        />
      </button>
      <div className={tooltipClasses}>{label}</div>
    </div>
  );
};

// --- Edit Price Modal ---
const EditPriceModal: React.FC<{
  product: PinProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (product: PinProduct) => void;
  onToast?: (message: string, type: "success" | "error" | "warn" | "info") => void;
}> = ({ product, isOpen, onClose, onSave, onToast }) => {
  const [retailPrice, setRetailPrice] = useState(0);
  const [wholesalePrice, setWholesalePrice] = useState(0);
  const { currentUser } = usePinContext();

  useEffect(() => {
    if (isOpen && product) {
      setRetailPrice(product.retailPrice || product.sellingPrice || 0);
      setWholesalePrice(
        product.wholesalePrice ||
          Math.round((product.retailPrice || product.sellingPrice || 0) * 0.9)
      );
    }
  }, [product, isOpen]);

  const handleSave = () => {
    if (!currentUser) {
      onToast?.("Vui lòng đăng nhập để thực hiện thao tác", "warn");
      return;
    }
    if (product) {
      const retail = Number(retailPrice) || 0;
      const wholesale = Number(wholesalePrice) || 0;
      onSave({
        ...product,
        retailPrice: retail,
        wholesalePrice: wholesale,
        sellingPrice: retail, // Keep for backward compatibility
      });
      onClose();
    }
  };

  if (!isOpen || !product) return null;

  const profitRetail = retailPrice - product.costPrice;
  const profitMarginRetail = product.costPrice > 0 ? (profitRetail / product.costPrice) * 100 : 0;
  const profitWholesale = wholesalePrice - product.costPrice;
  const profitMarginWholesale =
    product.costPrice > 0 ? (profitWholesale / product.costPrice) * 100 : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg w-full max-w-md">
        <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Cập nhật Giá bán</h3>
          <button onClick={onClose}>
            <XMarkIcon className="w-6 h-6 text-slate-500 dark:text-slate-400" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="font-semibold text-slate-800 dark:text-slate-100">{product.name}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Giá vốn
            </label>
            <input
              type="text"
              value={formatCurrency(product.costPrice)}
              disabled
              className="mt-1 w-full p-2 border rounded-md bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Icon name="money" className="w-4 h-4 text-green-600 dark:text-green-400" />
              Giá bán lẻ (*)
            </label>
            <input
              type="number"
              value={retailPrice}
              onChange={(e) => setRetailPrice(Number(e.target.value))}
              className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
              autoFocus
            />
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lợi nhuận: {formatCurrency(profitRetail)} ({profitMarginRetail >= 0 ? "+" : ""}
              {profitMarginRetail.toFixed(1)}%)
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Icon name="storefront" className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Giá bán sỉ
            </label>
            <input
              type="number"
              value={wholesalePrice}
              onChange={(e) => setWholesalePrice(Number(e.target.value))}
              className="mt-1 w-full p-2 border rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-white border-slate-300 dark:border-slate-600"
            />
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">
              Lợi nhuận: {formatCurrency(profitWholesale)} ({profitMarginWholesale >= 0 ? "+" : ""}
              {profitMarginWholesale.toFixed(1)}%)
            </div>
          </div>
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-t dark:border-slate-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-slate-200 text-slate-800 dark:bg-slate-600 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            disabled={!currentUser}
            title={!currentUser ? "Bạn phải đăng nhập để lưu thay đổi" : undefined}
            className={`font-semibold py-2 px-4 rounded-lg ${
              currentUser ? "bg-sky-600 text-white" : "bg-sky-300 text-white/70 cursor-not-allowed"
            }`}
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main Component ---
interface PinProductManagerProps {
  products: PinProduct[];
  updateProduct: (product: PinProduct) => void;
}

const ITEMS_PER_PAGE = 10;

const PinProductManager: React.FC<PinProductManagerProps> = ({ products, updateProduct }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Persist modal state
  useEffect(() => {
    const saved = localStorage.getItem("pinProductManager_modal");
    if (saved === "true") setIsModalOpen(true);
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      localStorage.setItem("pinProductManager_modal", "true");
    } else {
      localStorage.removeItem("pinProductManager_modal");
    }
  }, [isModalOpen]);
  const [editingProduct, setEditingProduct] = useState<PinProduct | null>(null);
  const {
    currentUser,
    removePinProductAndReturnMaterials,
    syncProductsFromCompletedOrders,
    pinBOMs,
    productionOrders,
    addToast,
  } = usePinContext();

  // Toast helper
  const showToast = (message: string, type: "success" | "error" | "warn" | "info") => {
    addToast?.({ id: crypto.randomUUID(), message, type });
  };

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const showConfirmDialog = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog(null);
  };
  const { deleteProductWithOptions } = useProductDeletion();
  const [deleteQtyMap, setDeleteQtyMap] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showProductForm, setShowProductForm] = useState<{
    type: "edit";
    product: PinProduct;
  } | null>(null);
  const [deletionModalProduct, setDeletionModalProduct] = useState<PinProduct | null>(null);

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [products, searchTerm]
  );

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);

  return (
    <div className="space-y-2 p-1">
      {/* Advanced deletion modal */}
      <ProductDeletionModal
        product={deletionModalProduct}
        onClose={() => setDeletionModalProduct(null)}
        onConfirm={async (product, options: DeletionOptions) => {
          try {
            const result = await deleteProductWithOptions(product, options);
            if (result.success) {
              addToast?.({
                title: "Thành công",
                message: result.message,
                type: "success",
              });
            } else {
              addToast?.({
                title: "Lỗi",
                message: result.message,
                type: "error",
              });
            }
          } catch (error) {
            addToast?.({
              title: "Lỗi",
              message: "Lỗi khi xóa sản phẩm: " + (error as Error).message,
              type: "error",
            });
          } finally {
            setDeletionModalProduct(null);
          }
        }}
      />

      <EditPriceModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingProduct(null);
        }}
        onSave={updateProduct}
        product={editingProduct}
        onToast={showToast}
      />
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 animate-fadeIn">
        <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Icon name="cube" className="w-6 h-6 text-slate-700 dark:text-slate-300" />
          Quản lý Thành phẩm
        </h1>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={syncProductsFromCompletedOrders}
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition-all duration-200 flex items-center gap-1 text-xs whitespace-nowrap"
          >
            <Icon name="arrows-clockwise" className="w-4 h-4 text-white" />
            Sync từ Đơn hoàn thành
          </button>
          <div className="px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-nowrap">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Tổng: </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {products.length}
            </span>
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {" "}
              sản phẩm
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 animate-fadeIn">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <input
            type="text"
            placeholder="Tìm theo tên hoặc SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm font-medium focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
          />
          {filteredProducts.length !== products.length && (
            <div className="px-3 md:px-5 py-2 md:py-3 bg-slate-100 dark:bg-slate-800 rounded-lg md:rounded-xl border border-slate-200 dark:border-slate-700 text-center md:text-left">
              <span className="text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                Tìm thấy:{" "}
              </span>
              <span className="text-sm md:text-lg font-bold text-slate-800 dark:text-slate-200">
                {filteredProducts.length}
              </span>
              <span className="hidden md:inline text-sm font-semibold text-slate-600 dark:text-slate-400">
                {" "}
                sản phẩm
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-700 overflow-x-auto">
        {/* Mobile Card View */}
        <div className="md:hidden space-y-2 p-2">
          {paginatedProducts.map((product) => {
            const retailPrice = product.retailPrice || product.sellingPrice || 0;
            const wholesalePrice = product.wholesalePrice || 0;
            const profitRetail = retailPrice - product.costPrice;
            const profitMarginRetail =
              product.costPrice > 0 ? (profitRetail / product.costPrice) * 100 : 0;

            return (
              <div
                key={product.id}
                className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 border border-slate-200 dark:border-slate-600"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm truncate">
                      {product.name}
                    </h3>
                    <span className="text-[10px] font-mono text-slate-500 bg-slate-200 dark:bg-slate-600 px-1.5 py-0.5 rounded">
                      {product.sku}
                    </span>
                  </div>
                  <div
                    className={`text-xs font-bold px-2 py-1 rounded ${product.stock <= 10 ? "bg-red-100 text-red-600 dark:bg-red-900/50 dark:text-red-400" : product.stock <= 50 ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-400" : "bg-green-100 text-green-600 dark:bg-green-900/50 dark:text-green-400"}`}
                  >
                    Kho: {product.stock}
                  </div>
                </div>

                {/* Prices */}
                <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                  <div>
                    <span className="text-slate-500 block">Giá vốn</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatCurrency(product.costPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bán lẻ</span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(retailPrice)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Bán sỉ</span>
                    <span className="font-medium text-blue-600 dark:text-blue-400">
                      {formatCurrency(wholesalePrice)}
                    </span>
                  </div>
                </div>

                {/* Profit & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-600">
                  <span
                    className={`text-xs ${profitMarginRetail >= 20 ? "text-green-600" : profitMarginRetail >= 10 ? "text-yellow-600" : "text-red-600"}`}
                  >
                    LN: {formatCurrency(profitRetail)} ({profitMarginRetail.toFixed(0)}%)
                  </span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          showToast("Vui lòng đăng nhập", "warn");
                          return;
                        }
                        setEditingProduct(product);
                        setIsModalOpen(true);
                      }}
                      disabled={!currentUser}
                      className={`p-1.5 rounded ${currentUser ? "text-cyan-500 hover:bg-cyan-50 dark:hover:bg-cyan-900/30" : "text-slate-400"}`}
                    >
                      <Icon name="money" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          showToast("Vui lòng đăng nhập", "warn");
                          return;
                        }
                        setDeletionModalProduct(product);
                      }}
                      disabled={!currentUser}
                      className={`p-1.5 rounded ${currentUser ? "text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/30" : "text-slate-400"}`}
                    >
                      <Icon name="gear" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length === 0 && (
            <div className="text-center p-8 text-slate-500 dark:text-slate-400">
              Chưa có thành phẩm nào.
            </div>
          )}
        </div>

        {/* Desktop Table View */}
        <table className="hidden md:table w-full text-left min-w-max">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <tr>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Icon name="package" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Tên Thành phẩm
                </div>
              </th>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300">
                <div className="flex items-center gap-2">
                  <Icon name="tag" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  SKU
                </div>
              </th>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <Icon name="chart-bar" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Tồn kho
                </div>
              </th>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <Icon name="coins" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Giá vốn
                </div>
              </th>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-right">
                <div className="flex items-center gap-2 justify-end">
                  <Icon name="money" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Giá bán
                </div>
              </th>
              <th className="p-3 font-semibold text-slate-700 dark:text-slate-300 text-center">
                <div className="flex items-center gap-2 justify-center">
                  <Icon name="gear" className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                  Thao tác
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {paginatedProducts.map((product) => {
              const retailPrice = product.retailPrice || product.sellingPrice || 0;
              const wholesalePrice = product.wholesalePrice || 0;
              const profitRetail = retailPrice - product.costPrice;
              const profitMarginRetail =
                product.costPrice > 0 ? (profitRetail / product.costPrice) * 100 : 0;

              return (
                <tr
                  key={product.id}
                  className="border-t dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="p-3">
                    <div>
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {product.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Lợi nhuận lẻ: {formatCurrency(profitRetail)} (
                        {profitMarginRetail > 0 ? "+" : ""}
                        {profitMarginRetail.toFixed(1)}%)
                      </div>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className="bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded text-sm font-mono text-slate-700 dark:text-slate-300">
                      {product.sku}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div
                      className={`font-bold ${
                        product.stock <= 10
                          ? "text-red-500"
                          : product.stock <= 50
                            ? "text-yellow-500"
                            : "text-green-600 dark:text-green-400"
                      }`}
                    >
                      {product.stock}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {product.stock <= 10 ? "Thấp" : product.stock <= 50 ? "Vừa" : "Ổn"}
                    </div>
                  </td>
                  <td className="p-3 text-right text-slate-800 dark:text-slate-200">
                    {formatCurrency(product.costPrice)}
                  </td>
                  <td className="p-3 text-right">
                    <div className="space-y-1">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">
                        Lẻ: {formatCurrency(retailPrice)}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Sỉ: {formatCurrency(wholesalePrice)}
                      </div>
                    </div>
                    <div
                      className={`text-xs mt-1 ${
                        profitMarginRetail >= 20
                          ? "text-green-500"
                          : profitMarginRetail >= 10
                            ? "text-yellow-500"
                            : "text-red-500"
                      }`}
                    >
                      {profitMarginRetail >= 20 ? "Tốt" : profitMarginRetail >= 10 ? "TB" : "Thấp"}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                      {/* Quantity input and delete button */}
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>SL</span>
                        <input
                          type="number"
                          min={1}
                          max={product.stock}
                          placeholder="SL"
                          value={deleteQtyMap[product.id] ?? ""}
                          onChange={(e) =>
                            setDeleteQtyMap((m) => ({
                              ...m,
                              [product.id]: Number(e.target.value),
                            }))
                          }
                          className="w-16 h-8 px-2 text-sm rounded-lg border border-slate-400/70 bg-transparent text-slate-800 dark:text-white focus:ring-2 focus:ring-red-400/40 focus:border-red-400"
                          title="Số lượng muốn xóa và hoàn kho NVL"
                        />
                        <ActionButton
                          icon="trash"
                          label="Xóa & hoàn kho"
                          variant="danger"
                          disabled={
                            !deleteQtyMap[product.id] ||
                            deleteQtyMap[product.id] <= 0 ||
                            !currentUser
                          }
                          onClick={() => {
                            if (!currentUser) {
                              showToast("Vui lòng đăng nhập để thực hiện thao tác", "warn");
                              return;
                            }
                            const qty = deleteQtyMap[product.id] ?? product.stock;
                            if (!qty || qty <= 0) {
                              showToast("Vui lòng nhập số lượng > 0 để xóa", "warn");
                              return;
                            }

                            // Check for active production orders
                            const relatedBOMs = pinBOMs.filter(
                              (bom: PinBOM) =>
                                bom.productSku === product.sku || bom.productName === product.name
                            );
                            const bomIds = relatedBOMs.map((bom: PinBOM) => bom.id);
                            const activeOrders = productionOrders.filter(
                              (order: ProductionOrder) =>
                                bomIds.includes(order.bomId) &&
                                order.status !== "Hoàn thành" &&
                                order.status !== "Đã hủy"
                            );

                            if (activeOrders.length > 0) {
                              showToast(
                                `Không thể xóa sản phẩm "${product.name}" - có ${activeOrders.length} đơn hàng sản xuất đang hoạt động. Vui lòng hoàn thành hoặc hủy các đơn hàng này trước.`,
                                "error"
                              );
                              return;
                            }

                            // Show additional warnings for BOMs and completed orders
                            const completedOrders = productionOrders.filter(
                              (order: ProductionOrder) =>
                                bomIds.includes(order.bomId) &&
                                (order.status === "Hoàn thành" || order.status === "Đã hủy")
                            );

                            let warningMessage = `Xóa ${qty} đơn vị thành phẩm "${product.name}"? Hệ thống sẽ hoàn kho NVL theo BOM và số lượng bạn đã chọn.`;

                            if (relatedBOMs.length > 0) {
                              warningMessage += ` ⚠️ Sẽ ảnh hưởng đến ${relatedBOMs.length} công thức sản xuất (BOM).`;
                            }
                            if (completedOrders.length > 0) {
                              warningMessage += ` ⚠️ Có ${completedOrders.length} đơn hàng đã hoàn thành liên quan.`;
                            }

                            const productToDelete = product;
                            const qtyToDelete = qty;
                            showConfirmDialog(
                              "Xác nhận xóa sản phẩm",
                              warningMessage,
                              () => removePinProductAndReturnMaterials(productToDelete, qtyToDelete)
                            );
                          }}
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2">
                        <ActionButton
                          icon="gear"
                          label="Xóa nâng cao"
                          variant="warning"
                          onClick={() => {
                            if (!currentUser) {
                              showToast("Vui lòng đăng nhập để thực hiện thao tác", "warn");
                              return;
                            }
                            setDeletionModalProduct(product);
                          }}
                        />

                        <ActionButton
                          icon="money"
                          label="Sửa giá bán"
                          variant="primary"
                          disabled={!currentUser}
                          onClick={() => {
                            if (!currentUser) {
                              showToast("Vui lòng đăng nhập để thực hiện thao tác", "warn");
                              return;
                            }
                            setEditingProduct(product);
                            setIsModalOpen(true);
                          }}
                        />

                        <ActionButton
                          icon="pencil"
                          label="Sửa thông tin"
                          variant="muted"
                          disabled={!currentUser}
                          onClick={() => {
                            if (!currentUser) {
                              showToast("Vui lòng đăng nhập để thực hiện thao tác", "warn");
                              return;
                            }
                            showToast(
                              "Tính năng sửa thông tin sản phẩm sẽ được phát triển trong phiên bản tiếp theo.",
                              "info"
                            );
                          }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filteredProducts.length === 0 && (
          <div className="hidden md:block text-center p-8 text-slate-500 dark:text-slate-400">
            Chưa có thành phẩm nào.
          </div>
        )}
      </div>
      {totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          itemsPerPage={ITEMS_PER_PAGE}
          totalItems={filteredProducts.length}
        />
      )}

      {/* Confirm Dialog Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {confirmDialog.title}
            </h3>
            <p className="text-slate-600 dark:text-slate-300 mb-6 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-600 transition"
              >
                Hủy
              </button>
              <button
                onClick={() => {
                  confirmDialog.onConfirm();
                  closeConfirmDialog();
                }}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinProductManager;
