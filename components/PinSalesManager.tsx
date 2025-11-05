import React, { useState, useMemo, useRef, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type {
  PinProduct,
  PinCartItem,
  PinSale,
  PinCustomer,
} from "../types";
import {
  ShoppingCartIcon,
  PlusIcon,
  MinusIcon,
  TrashIcon,
  BanknotesIcon,
  ArchiveBoxIcon,
  ArrowUturnLeftIcon,
  XMarkIcon,
  CubeIcon,
  PencilSquareIcon,
} from "./common/Icons";
import PinReceiptModal from "./PinReceiptModal";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    amount
  );
const generateUniqueId = (prefix = "PINCUST-") => `${prefix}${Date.now()}`;

// --- New Customer Modal ---
const NewPinCustomerModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (customer: PinCustomer) => void;
  initialName?: string;
}> = ({ isOpen, onClose, onSave, initialName = "" }) => {
  const [formData, setFormData] = useState<Omit<PinCustomer, "id">>({
    name: initialName,
    phone: "",
    address: "",
  });
  const { currentUser } = usePinContext();

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: initialName, phone: "", address: "" });
    }
  }, [isOpen, initialName]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalCustomer: PinCustomer = {
      id: generateUniqueId(),
      ...formData,
    };
    if (!currentUser) {
      alert("Bạn phải đăng nhập để thực hiện thao tác.");
      return;
    }
    onSave(finalCustomer);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex justify-center items-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-lg">
        <form onSubmit={handleSubmit}>
          <div className="p-6">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-6">
              Thêm Khách hàng mới
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tên khách hàng (*)
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md"
                  required
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Số điện thoại (*)
                </label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ""}
                  onChange={handleChange}
                  className="mt-1 block w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md"
                />
              </div>
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800 px-6 py-4 flex justify-end space-x-3 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={!currentUser}
              title={
                !currentUser
                  ? "Bạn phải đăng nhập để thêm khách hàng"
                  : undefined
              }
              className={`font-semibold py-2 px-4 rounded-lg ${
                currentUser
                  ? "bg-sky-600 text-white"
                  : "bg-sky-300 text-white/70 cursor-not-allowed"
              }`}
            >
              Lưu
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- Floating Cart Button for Mobile ---
const FloatingCartButton: React.FC<{
  count: number;
  total: number;
  onClick: () => void;
}> = ({ count, total, onClick }) => (
  <div className="lg:hidden fixed bottom-4 right-4 left-4 z-20">
    <button
      onClick={onClick}
      className="w-full bg-orange-500 text-white font-bold rounded-lg shadow-lg flex items-center py-3 px-5 hover:bg-orange-600 transition-transform hover:scale-105"
    >
      <ShoppingCartIcon className="w-6 h-6" />
      <span className="bg-white text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold ml-3">
        {count}
      </span>
      <span className="mx-auto text-lg">{formatCurrency(total)}</span>
      <span>Tiếp tục &rarr;</span>
    </button>
  </div>
);

// --- Main Component ---
interface PinSalesManagerProps {
  products: PinProduct[];
  cartItems: PinCartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<PinCartItem[]>>;
  handleSale: (
    saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">
  ) => void;
  customers: PinCustomer[];
  setCustomers: React.Dispatch<React.SetStateAction<PinCustomer[]>>;
}

const PinSalesManager: React.FC<PinSalesManagerProps> = ({
  products,
  cartItems,
  setCartItems,
  handleSale,
  customers,
  setCustomers,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [salesCategory, setSalesCategory] = useState<
    "products" | "materials" | "all"
  >("all");
  const { currentUser, pinSales, deletePinSale, updatePinSale, pinMaterials } =
    usePinContext();
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"VND" | "%">("VND");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  // New: payment modes
  const [paymentMode, setPaymentMode] = useState<"full" | "partial" | "debt">(
    "full"
  );
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [mobileView, setMobileView] = useState<"products" | "cart">("products");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [isReceiptVisible, setIsReceiptVisible] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<PinSale | null>(null);
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");

  // Customer state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<PinCustomer | null>(
    null
  );
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const customerInputRef = useRef<HTMLDivElement>(null);

  // Convert materials to product-like format for display
  const availableItems = useMemo(() => {
    const filteredProducts = products.filter(
      (p) =>
        p.stock > 0 &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredMaterials =
      pinMaterials
        ?.filter(
          (m) =>
            (m.stock || 0) > 0 &&
            (m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              m.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .map((material) => ({
          id: material.id,
          name: material.name,
          sku: material.sku || `MAT-${material.id.slice(-4)}`,
          stock: material.stock || 0,
          costPrice: (material as any).purchasePrice || 0,
          // Dùng giá bán lẻ làm mặc định cho cart
          sellingPrice:
            (material as any).retailPrice ||
            (material as any).sellingPrice ||
            (material as any).purchasePrice ||
            0,
          retailPrice: (material as any).retailPrice || 0,
          wholesalePrice: (material as any).wholesalePrice || 0,
          type: "material" as const,
          originalMaterial: material,
        })) || [];

    const productsWithType = filteredProducts.map((p) => ({
      ...p,
      type: "product" as const,
    }));

    if (salesCategory === "products") return productsWithType;
    if (salesCategory === "materials") return filteredMaterials;

    // Show both products and materials
    return [...productsWithType, ...filteredMaterials];
  }, [products, pinMaterials, searchTerm, salesCategory]);

  // Keep backward compatibility
  const availableProducts = availableItems;

  const addToCart = (
    product: PinProduct,
    priceType: "retail" | "wholesale" = "retail"
  ) => {
    setCartItems((prev) => {
      const existing = prev.find(
        (item) => item.productId === product.id && item.priceType === priceType
      );
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id && item.priceType === priceType
            ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
            : item
        );
      }

      // Xác định giá bán dựa trên priceType
      const retailPrice =
        (product as any).retailPrice || product.sellingPrice || 0;
      const wholesalePrice = (product as any).wholesalePrice || 0;
      const finalSellingPrice =
        priceType === "wholesale" && wholesalePrice > 0
          ? wholesalePrice
          : retailPrice;

      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          quantity: 1,
          sellingPrice: finalSellingPrice,
          costPrice: product.costPrice,
          stock: product.stock,
          priceType,
          retailPrice,
          wholesalePrice,
          type: (product as any).type || "product", // Preserve material vs product type
        },
      ];
    });
  };

  const updateQuantity = (
    productId: string,
    quantity: number,
    priceType?: "retail" | "wholesale"
  ) => {
    setCartItems((prev) =>
      prev
        .map((item) => {
          // Nếu có priceType, chỉ cập nhật item có cùng productId VÀ priceType
          // Nếu không có priceType, cập nhật tất cả item có cùng productId (backward compatible)
          const shouldUpdate = priceType
            ? item.productId === productId &&
              (item.priceType || "retail") === priceType
            : item.productId === productId;

          return shouldUpdate
            ? { ...item, quantity: Math.max(0, quantity) }
            : item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const subtotal = useMemo(
    () =>
      cartItems.reduce(
        (sum, item) => sum + item.sellingPrice * item.quantity,
        0
      ),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    if (discountType === "%") {
      return Math.round((subtotal * discount) / 100);
    }
    return discount;
  }, [discount, discountType, subtotal]);

  const total = subtotal - discountAmount;
  const totalCartItems = useMemo(
    () => cartItems.reduce((acc, item) => acc + item.quantity, 0),
    [cartItems]
  );

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return [];
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.phone.includes(customerSearch)
    );
  }, [customers, customerSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customerInputRef.current &&
        !customerInputRef.current.contains(event.target as Node)
      ) {
        setIsCustomerListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectCustomer = (customer: PinCustomer) => {
    setSelectedCustomer(customer);
    setCustomerSearch(customer.name);
    setIsCustomerListOpen(false);
  };

  const { upsertPinCustomer } = usePinContext();

  const handleSaveNewCustomer = async (newCustomer: PinCustomer) => {
    try {
      await upsertPinCustomer(newCustomer);
    } catch (e) {
      console.error("Error upserting pin customer:", e);
    }
    setCustomers((prev) => [newCustomer, ...prev]);
    handleSelectCustomer(newCustomer);
    setIsNewCustomerModalOpen(false);
  };

  const finalizeSale = () => {
    if (!currentUser) {
      alert("Bạn phải đăng nhập để thực hiện thanh toán.");
      return;
    }
    if (cartItems.length === 0 || !paymentMethod) {
      alert("Vui lòng thêm sản phẩm vào giỏ và chọn phương thức thanh toán.");
      return;
    }

    // Validate payment mode
    if (paymentMode === "partial") {
      const amt = Number(paidAmount || 0);
      if (!(amt > 0 && amt < total)) {
        alert(
          "Số tiền thanh toán một phần phải lớn hơn 0 và nhỏ hơn Tổng cộng."
        );
        return;
      }
    }
    if (paymentMode === "debt") {
      // Optional: encourage selecting a customer for debts
      if (!selectedCustomer) {
        if (
          !confirm("Bạn chưa chọn khách hàng. Ghi nợ cho 'Khách vãng lai'?")
        ) {
          return;
        }
      }
    }

    const customerDetails = selectedCustomer
      ? {
          id: selectedCustomer.id,
          name: selectedCustomer.name,
          phone: selectedCustomer.phone,
          address: selectedCustomer.address,
        }
      : { name: customerSearch || "Khách lẻ" };

    const saleData: Omit<PinSale, "id" | "date" | "userId" | "userName"> = {
      items: cartItems,
      subtotal,
      discount: discountAmount,
      total,
      customer: customerDetails,
      paymentMethod,
      paymentStatus:
        paymentMode === "full"
          ? "paid"
          : paymentMode === "partial"
          ? "partial"
          : "debt",
      paidAmount:
        paymentMode === "full"
          ? total
          : paymentMode === "partial"
          ? Math.min(Math.max(1, paidAmount || 0), total)
          : 0,
      dueDate: paymentMode === "debt" ? dueDate || undefined : undefined,
    };
    handleSale(saleData);

    if (printReceipt) {
      setLastSaleData({
        ...saleData,
        id: `SALE-${Date.now()}`,
        date: new Date().toISOString(),
        userId: "",
        userName: "",
      });
      setIsReceiptVisible(true);
    }

    // Reset form
    setCartItems([]);
    setDiscount(0);
    setDiscountType("VND");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setPaymentMethod(null);
    setPaymentMode("full");
    setPaidAmount(0);
    setDueDate("");
    setMobileView("products");
  };

  // Sales history list (recent 50)
  const recentSales = useMemo(() => (pinSales || []).slice(0, 50), [pinSales]);
  const [editingSale, setEditingSale] = useState<PinSale | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Persist modal state
  useEffect(() => {
    const saved = localStorage.getItem("pinSalesHistory_editModal");
    if (saved === "true") setIsEditModalOpen(true);
  }, []);

  useEffect(() => {
    if (isEditModalOpen) {
      localStorage.setItem("pinSalesHistory_editModal", "true");
    } else {
      localStorage.removeItem("pinSalesHistory_editModal");
    }
  }, [isEditModalOpen]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [editDiscountType, setEditDiscountType] = useState<"VND" | "%">("VND");
  const [editPayment, setEditPayment] = useState<"cash" | "bank">("cash");

  const openEdit = (s: PinSale) => {
    setEditingSale(s);
    setEditDiscount(s.discount || 0);
    setEditDiscountType("VND"); // Default to VND for existing sales
    setEditPayment(s.paymentMethod || "cash");
    setIsEditModalOpen(true);
  };
  const saveEdit = async () => {
    if (!editingSale) return;
    const subtotal = editingSale.items.reduce(
      (sum, it) => sum + it.sellingPrice * it.quantity,
      0
    );

    const finalDiscountAmount =
      editDiscountType === "%"
        ? Math.round((subtotal * editDiscount) / 100)
        : editDiscount;

    const updated: PinSale = {
      ...editingSale,
      discount: finalDiscountAmount,
      total: subtotal - finalDiscountAmount,
      paymentMethod: editPayment,
    };
    await updatePinSale(updated);
    setIsEditModalOpen(false);
    setEditingSale(null);
  };

  return (
    <>
      <NewPinCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSave={handleSaveNewCustomer}
        initialName={customerSearch}
      />
      <PinReceiptModal
        isOpen={isReceiptVisible}
        onClose={() => setIsReceiptVisible(false)}
        saleData={lastSaleData}
      />
      <div className="mb-4 border-b border-slate-200 dark:border-slate-700">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("pos")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "pos"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Bán hàng
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "history"
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            Lịch sử
          </button>
        </nav>
      </div>

      {activeTab === "pos" && (
        <div className="lg:grid lg:grid-cols-3 lg:gap-6 h-full">
          {/* Product List */}
          <div
            className={`${
              mobileView === "products" ? "flex" : "hidden"
            } lg:flex flex-col bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 h-full lg:col-span-2`}
          >
            <input
              type="text"
              placeholder="Tìm sản phẩm hoặc nguyên liệu..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md mb-3 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />

            {/* Category Filter */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setSalesCategory("all")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  salesCategory === "all"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                🏪 Tất cả ({availableItems.length})
              </button>
              <button
                onClick={() => setSalesCategory("products")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  salesCategory === "products"
                    ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                📱 Thành phẩm ({products.filter((p) => p.stock > 0).length})
              </button>
              <button
                onClick={() => setSalesCategory("materials")}
                className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                  salesCategory === "materials"
                    ? "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                📦 Nguyên liệu (
                {(pinMaterials || []).filter((m) => (m.stock || 0) > 0).length})
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {availableProducts.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                  {availableProducts.map((product) => (
                    <div
                      key={product.id}
                      className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-sky-500 dark:hover:border-sky-400 hover:bg-sky-50/50 dark:hover:bg-sky-900/20 transition-colors duration-150 h-fit"
                    >
                      {/* Header with name and type badge */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <h3 className="font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-700 dark:group-hover:text-sky-300 text-sm leading-tight flex-1">
                          {product.name}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                            (product as any).type === "material"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                          }`}
                        >
                          {(product as any).type === "material"
                            ? "📦 NVL"
                            : "📱 TP"}
                        </span>
                      </div>

                      {/* SKU */}
                      <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mb-3 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded">
                        SKU: {product.sku}
                      </p>

                      {/* Price and Stock */}
                      <div className="space-y-2 mb-4">
                        {/* Luôn hiển thị giá cho cả material và product */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <BanknotesIcon className="w-3.5 h-3.5" />
                            Giá lẻ
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatCurrency(
                              (product as any).retailPrice ??
                                product.sellingPrice ??
                                0
                            )}
                          </span>
                        </div>

                        {/* Hiển thị giá sỉ nếu có */}
                        {((product as any).wholesalePrice || 0) > 0 && (
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                              <BanknotesIcon className="w-3.5 h-3.5" />
                              Giá sỉ
                            </span>
                            <span className="font-semibold text-slate-800 dark:text-slate-100">
                              {formatCurrency(
                                (product as any).wholesalePrice || 0
                              )}
                            </span>
                          </div>
                        )}

                        {/* Tồn kho */}
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                            <ArchiveBoxIcon className="w-3.5 h-3.5" />
                            Tồn kho
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {product.stock}
                          </span>
                        </div>
                      </div>

                      {/* Add buttons - Retail and Wholesale */}
                      <div className="flex items-center gap-2 w-full">
                        {/* Nút bán lẻ */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart(product, "retail");
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-lg px-3 py-2 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                        >
                          <PlusIcon className="w-4 h-4" />
                          <span>Bán lẻ</span>
                        </button>

                        {/* Nút bán sỉ - chỉ hiển thị nếu có giá sỉ */}
                        {((product as any).wholesalePrice || 0) > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product, "wholesale");
                            }}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 flex items-center justify-center gap-2 transition-colors text-sm font-medium"
                          >
                            <PlusIcon className="w-4 h-4" />
                            <span>Bán sỉ</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                  <CubeIcon className="w-12 h-12 mx-auto text-slate-400 dark:text-slate-500" />
                  <p className="mt-4 font-semibold">
                    {salesCategory === "products"
                      ? "Không có thành phẩm nào"
                      : salesCategory === "materials"
                      ? "Không có nguyên liệu nào"
                      : "Không có sản phẩm nào"}
                  </p>
                  <p className="text-sm">
                    {salesCategory === "products"
                      ? "Hãy hoàn thành sản xuất để có thành phẩm bán."
                      : salesCategory === "materials"
                      ? "Hãy nhập kho nguyên liệu để bán lẻ."
                      : "Thành phẩm và nguyên liệu có tồn kho sẽ hiện ở đây."}
                  </p>
                  {salesCategory === "products" && products.length === 0 && (
                    <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300">
                      <p className="text-sm font-medium">💡 Gợi ý:</p>
                      <p className="text-xs mt-1">
                        1. Tạo BOM → 2. Tạo lệnh sản xuất → 3. Hoàn thành sản
                        xuất
                      </p>
                    </div>
                  )}
                  {salesCategory === "materials" &&
                    (pinMaterials || []).length === 0 && (
                      <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-orange-700 dark:text-orange-300">
                        <p className="text-sm font-medium">💡 Gợi ý:</p>
                        <p className="text-xs mt-1">
                          Vào trang Nguyên liệu để nhập kho các vật tư cần bán
                        </p>
                      </div>
                    )}
                </div>
              )}
            </div>
          </div>

          {/* Cart & Checkout */}
          <div
            className={`${
              mobileView === "cart" ? "flex" : "hidden"
            } lg:flex w-full lg:w-auto flex-col bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border dark:border-slate-700 mt-6 lg:mt-0 h-full lg:col-span-1`}
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center">
                <button
                  onClick={() => setMobileView("products")}
                  className="lg:hidden p-2 mr-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <ArrowUturnLeftIcon className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-bold flex items-center text-slate-800 dark:text-slate-100">
                  <ShoppingCartIcon className="w-6 h-6 mr-3 text-orange-500" />
                  Hóa đơn
                </h2>
              </div>
              {cartItems.length > 0 && (
                <span className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                  {cartItems.length} SP
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {cartItems.length === 0 ? (
                <div className="text-center py-16 text-slate-500 dark:text-slate-400">
                  <ShoppingCartIcon className="w-16 h-16 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                  <p className="font-semibold mb-2">Giỏ hàng trống</p>
                  <p className="text-sm">Thêm sản phẩm để bắt đầu bán hàng</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map((item) => (
                    <div
                      key={`${item.productId}-${item.priceType || "retail"}`}
                      className="bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-4 group hover:border-orange-300 dark:hover:border-orange-600 transition-colors"
                    >
                      {/* Product Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm leading-tight truncate">
                              {item.name}
                            </h3>
                            {/* Badge giá sỉ/lẻ */}
                            {item.priceType && (
                              <span
                                className={`px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ${
                                  item.priceType === "wholesale"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                                    : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                                }`}
                              >
                                {item.priceType === "wholesale"
                                  ? "💰 Sỉ"
                                  : "🛒 Lẻ"}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 px-2 py-1 rounded inline-block">
                            SKU: {item.sku || "N/A"}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Cập nhật hàm xóa để xét cả priceType
                            setCartItems((prev) =>
                              prev.filter(
                                (i) =>
                                  !(
                                    i.productId === item.productId &&
                                    (i.priceType || "retail") ===
                                      (item.priceType || "retail")
                                  )
                              )
                            );
                          }}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Xóa khỏi giỏ hàng"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Price and Quantity */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Đơn giá
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatCurrency(item.sellingPrice)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-600 dark:text-slate-400">
                            Số lượng
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  Math.max(1, item.quantity - 1),
                                  item.priceType
                                )
                              }
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                              disabled={item.quantity <= 1}
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  item.productId,
                                  Math.max(1, Number(e.target.value) || 1),
                                  item.priceType
                                )
                              }
                              className="w-12 text-center border border-slate-300 dark:border-slate-600 rounded-md text-sm py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-medium"
                              min="1"
                            />
                            <button
                              onClick={() =>
                                updateQuantity(
                                  item.productId,
                                  item.quantity + 1,
                                  item.priceType
                                )
                              }
                              className="w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            Thành tiền
                          </span>
                          <span className="font-bold text-orange-600 dark:text-orange-400">
                            {formatCurrency(item.sellingPrice * item.quantity)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-auto pt-6 border-t-2 border-slate-200 dark:border-slate-700 space-y-4">
              <div ref={customerInputRef}>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  👤 Khách hàng
                </label>

                {/* Selected Customer Display */}
                {selectedCustomer && (
                  <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
                          {selectedCustomer.name}
                        </p>
                        <p className="text-xs text-blue-600 dark:text-blue-300">
                          📞 {selectedCustomer.phone}
                        </p>
                        {selectedCustomer.address && (
                          <p className="text-xs text-blue-600 dark:text-blue-300">
                            📍 {selectedCustomer.address}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setSelectedCustomer(null);
                          setCustomerSearch("");
                        }}
                        className="text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 p-1 hover:bg-blue-100 dark:hover:bg-blue-800 rounded transition-colors"
                        title="Bỏ chọn khách hàng"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="flex">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        placeholder={
                          selectedCustomer
                            ? "Tìm khách hàng khác..."
                            : "Tìm theo tên hoặc số điện thoại..."
                        }
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setIsCustomerListOpen(true);
                          if (e.target.value === "") {
                            setSelectedCustomer(null);
                          }
                        }}
                        onFocus={() => setIsCustomerListOpen(true)}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-l-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                      <svg
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                      </svg>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsNewCustomerModalOpen(true)}
                      disabled={!currentUser}
                      title={
                        !currentUser
                          ? "Bạn phải đăng nhập để thêm khách hàng"
                          : "Thêm khách hàng mới"
                      }
                      className={`px-4 py-2 border-t border-b border-r rounded-r-md h-[42px] flex items-center justify-center transition-colors ${
                        currentUser
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 border-blue-300 dark:border-blue-600"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      <PlusIcon className="w-4 h-4" />
                    </button>
                  </div>
                  {isCustomerListOpen &&
                    (customerSearch || filteredCustomers.length > 0) && (
                      <div className="absolute bottom-full mb-2 z-20 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        <div className="p-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            📋 Danh bạ khách hàng ({filteredCustomers.length}{" "}
                            kết quả)
                          </p>
                        </div>

                        {filteredCustomers.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto">
                            {filteredCustomers.map((c, index) => (
                              <div
                                key={c.id}
                                onClick={() => handleSelectCustomer(c)}
                                className={`p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-slate-100 dark:border-slate-700 transition-colors group ${
                                  index === filteredCustomers.length - 1
                                    ? "border-b-0"
                                    : ""
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                      👤 {c.name}
                                    </p>
                                    <div className="mt-1 space-y-1">
                                      <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                        📞 {c.phone}
                                      </p>
                                      {c.address && (
                                        <p className="text-xs text-slate-600 dark:text-slate-400 flex items-center gap-1">
                                          📍 {c.address}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center">
                                    <svg
                                      className="w-4 h-4 text-slate-400 group-hover:text-blue-500"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center">
                            <div className="text-slate-400 mb-2">
                              <svg
                                className="w-12 h-12 mx-auto"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={1.5}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                            </div>
                            <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                              Không tìm thấy khách hàng
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              Thử tìm với từ khóa khác hoặc thêm khách hàng mới
                            </p>
                            <button
                              onClick={() => {
                                setIsNewCustomerModalOpen(true);
                                setIsCustomerListOpen(false);
                              }}
                              disabled={!currentUser}
                              className="mt-3 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors"
                            >
                              ➕ Thêm khách hàng mới
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* Quick Actions */}
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedCustomer({
                        id: "guest",
                        name: "Khách vãng lai",
                        phone: "0000000000",
                        address: "",
                      });
                      setCustomerSearch("");
                      setIsCustomerListOpen(false);
                    }}
                    className="flex-1 px-3 py-2 text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center gap-2 border border-slate-200 dark:border-slate-600"
                  >
                    🚶 Khách vãng lai
                  </button>
                  {customers.length > 0 && (
                    <button
                      onClick={() => {
                        setCustomerSearch("");
                        setIsCustomerListOpen(true);
                      }}
                      className="px-3 py-2 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors flex items-center gap-2 border border-blue-200 dark:border-blue-600"
                    >
                      📋 Danh bạ ({customers.length})
                    </button>
                  )}
                </div>
              </div>
              {/* Order Summary */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-3">
                  📋 Tổng kết đơn hàng
                </h3>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    Tạm tính (
                    {cartItems.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                    sản phẩm)
                  </span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    💰 Giảm giá
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      max={discountType === "%" ? 100 : undefined}
                      className="w-20 p-2 border border-slate-300 dark:border-slate-600 rounded-l-md text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setDiscountType(e.target.value as "VND" | "%");
                        setDiscount(0); // Reset discount when changing type
                      }}
                      className="p-2 border-t border-r border-b border-slate-300 dark:border-slate-600 rounded-r-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                    >
                      <option value="VND">₫</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 dark:text-slate-500 text-xs">
                      Số tiền giảm
                    </span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}

                <div className="border-t border-slate-200 dark:border-slate-600 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-slate-800 dark:text-slate-200">
                      Tổng cộng
                    </span>
                    <span className="font-bold text-xl text-orange-600 dark:text-orange-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>
              {/* Payment Method */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                  💳 Phương thức thanh toán
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ${
                      paymentMethod === "cash"
                        ? "border-green-500 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 shadow-md"
                        : "border-slate-300 dark:border-slate-600 hover:border-green-300 dark:hover:border-green-600"
                    }`}
                  >
                    <BanknotesIcon className="w-5 h-5" />
                    <span className="font-medium">Tiền mặt</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex-1 flex items-center justify-center gap-2 p-3 border-2 rounded-lg transition-all ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md"
                        : "border-slate-300 dark:border-slate-600 hover:border-blue-300 dark:hover:border-blue-600"
                    }`}
                  >
                    <span className="text-lg">🏦</span>
                    <span className="font-medium">Chuyển khoản</span>
                  </button>
                </div>
                {/* Payment Mode (full / partial / debt) */}
                <div className="mt-3">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    📌 Hình thức
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMode("full")}
                      className={`flex-1 p-2 border-2 rounded-lg text-sm ${
                        paymentMode === "full"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          : "border-slate-300 dark:border-slate-600 hover:border-emerald-300 dark:hover:border-emerald-600"
                      }`}
                    >
                      Thanh toán đủ
                    </button>
                    <button
                      onClick={() => {
                        setPaymentMode("partial");
                        setPaidAmount((prev) => (prev > 0 ? prev : total));
                      }}
                      className={`flex-1 p-2 border-2 rounded-lg text-sm ${
                        paymentMode === "partial"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "border-slate-300 dark:border-slate-600 hover:border-amber-300 dark:hover:border-amber-600"
                      }`}
                    >
                      Thanh toán 1 phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentMode("debt");
                        setPaidAmount(0);
                      }}
                      className={`flex-1 p-2 border-2 rounded-lg text-sm ${
                        paymentMode === "debt"
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "border-slate-300 dark:border-slate-600 hover:border-red-300 dark:hover:border-red-600"
                      }`}
                    >
                      Ghi nợ
                    </button>
                  </div>

                  {paymentMode === "partial" && (
                    <div className="mt-3 flex items-center justify-between">
                      <label className="text-sm text-slate-600 dark:text-slate-400">
                        Số tiền khách trả
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={total - 1}
                          value={paidAmount || ""}
                          onChange={(e) =>
                            setPaidAmount(Number(e.target.value || 0))
                          }
                          className="w-36 p-2 border border-slate-300 dark:border-slate-600 rounded-md text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        />
                        <span className="text-xs text-slate-500">
                          Còn lại:{" "}
                          {formatCurrency(
                            Math.max(0, total - (paidAmount || 0))
                          )}
                        </span>
                      </div>
                    </div>
                  )}
                  {paymentMode === "debt" && (
                    <div className="mt-3 flex items-center justify-between">
                      <label className="text-sm text-slate-600 dark:text-slate-400">
                        Hạn thanh toán
                      </label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                      />
                    </div>
                  )}
                </div>
              </div>
              {/* Checkout Options */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg">
                <label className="flex items-center text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printReceipt}
                    onChange={(e) => setPrintReceipt(e.target.checked)}
                    className="mr-3 h-4 w-4 rounded text-orange-600 focus:ring-orange-500 focus:ring-2"
                  />
                  <span className="flex items-center gap-2">
                    🖨️ <span>In hóa đơn sau khi thanh toán</span>
                  </span>
                </label>
              </div>

              {/* Final Checkout Button */}
              <button
                onClick={finalizeSale}
                disabled={
                  !currentUser ||
                  cartItems.length === 0 ||
                  !paymentMethod ||
                  (paymentMode === "partial" &&
                    !(paidAmount > 0 && paidAmount < total))
                }
                title={
                  !currentUser
                    ? "Bạn phải đăng nhập để thực hiện thanh toán"
                    : cartItems.length === 0
                    ? "Giỏ hàng trống"
                    : !paymentMethod
                    ? "Chọn phương thức thanh toán"
                    : "Hoàn tất thanh toán"
                }
                className={`w-full font-bold py-4 rounded-lg text-lg flex items-center justify-center gap-3 transition-all shadow-lg ${
                  !currentUser ||
                  cartItems.length === 0 ||
                  !paymentMethod ||
                  (paymentMode === "partial" &&
                    !(paidAmount > 0 && paidAmount < total))
                    ? "bg-slate-300 dark:bg-slate-600 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    : "bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 transform hover:scale-105 active:scale-95"
                }`}
              >
                {!currentUser ? (
                  <>🔐 Đăng nhập để thanh toán</>
                ) : cartItems.length === 0 ? (
                  <>🛒 Giỏ hàng trống</>
                ) : !paymentMethod ? (
                  <>💳 Chọn phương thức thanh toán</>
                ) : paymentMode === "partial" ? (
                  <>
                    ✨ Thanh {formatCurrency(Math.min(paidAmount || 0, total))}{" "}
                    • Nợ{" "}
                    {formatCurrency(Math.max(0, total - (paidAmount || 0)))}{" "}
                  </>
                ) : paymentMode === "debt" ? (
                  <>📝 Ghi nợ {formatCurrency(total)}</>
                ) : (
                  <>✨ Thanh toán {formatCurrency(total)}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200/60 dark:border-slate-700 p-4">
          <h3 className="text-lg font-bold mb-4">
            Lịch sử bán hàng (50 gần nhất)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-max">
              <thead className="border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50">
                <tr>
                  <th className="p-3">Ngày</th>
                  <th className="p-3">Khách hàng</th>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3 text-right">Tổng</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-slate-500" colSpan={5}>
                      Chưa có hoá đơn nào.
                    </td>
                  </tr>
                )}
                {recentSales.map((s) => (
                  <tr key={s.id} className="border-t dark:border-slate-700">
                    <td className="p-3 text-sm">
                      {new Date(s.date).toLocaleString("vi-VN")}
                    </td>
                    <td className="p-3 text-sm">{s.customer?.name || ""}</td>
                    <td className="p-3 text-sm">
                      {(s.items || [])
                        .map((it) => `${it.sku} x${it.quantity}`)
                        .join(", ")}
                    </td>
                    <td className="p-3 text-right font-semibold">
                      {formatCurrency(s.total)}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => openEdit(s)}
                        disabled={!currentUser}
                        title={
                          !currentUser
                            ? "Bạn phải đăng nhập để sửa"
                            : "Sửa hoá đơn"
                        }
                        className={`mr-2 ${
                          currentUser
                            ? "text-sky-600"
                            : "text-slate-400 cursor-not-allowed"
                        }`}
                      >
                        <PencilSquareIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={async () => {
                          if (!currentUser) {
                            alert("Vui lòng đăng nhập");
                            return;
                          }
                          if (
                            window.confirm(
                              "Xoá hoá đơn này? Tồn kho sẽ được hoàn lại."
                            )
                          ) {
                            await deletePinSale(s.id);
                          }
                        }}
                        disabled={!currentUser}
                        title={
                          !currentUser
                            ? "Bạn phải đăng nhập để xoá"
                            : "Xoá hoá đơn"
                        }
                        className={`${
                          currentUser
                            ? "text-red-500"
                            : "text-red-300 cursor-not-allowed"
                        }`}
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {isEditModalOpen && editingSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b dark:border-slate-700 flex justify-between items-center">
              <h3 className="text-lg font-bold">Sửa hoá đơn</h3>
              <button onClick={() => setIsEditModalOpen(false)}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">Giảm giá</label>
                <div className="flex mt-1">
                  <input
                    type="number"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    min="0"
                    max={editDiscountType === "%" ? 100 : undefined}
                    className="flex-1 p-2 border rounded-l-md bg-white dark:bg-slate-700 text-right"
                  />
                  <select
                    value={editDiscountType}
                    onChange={(e) => {
                      setEditDiscountType(e.target.value as "VND" | "%");
                      setEditDiscount(0);
                    }}
                    className="p-2 border-t border-r border-b rounded-r-md bg-white dark:bg-slate-700"
                  >
                    <option value="VND">₫</option>
                    <option value="%">%</option>
                  </select>
                </div>
                {editDiscountType === "%" &&
                  editDiscount > 0 &&
                  editingSale && (
                    <p className="text-xs text-slate-500 mt-1">
                      Số tiền giảm:{" "}
                      {formatCurrency(
                        Math.round((editingSale.subtotal * editDiscount) / 100)
                      )}
                    </p>
                  )}
              </div>
              <div>
                <label className="block text-sm font-medium">Phương thức</label>
                <div className="flex gap-2 mt-1">
                  <button
                    onClick={() => setEditPayment("cash")}
                    className={`flex-1 p-2 border rounded ${
                      editPayment === "cash"
                        ? "border-sky-500"
                        : "border-slate-300"
                    }`}
                  >
                    Tiền mặt
                  </button>
                  <button
                    onClick={() => setEditPayment("bank")}
                    className={`flex-1 p-2 border rounded ${
                      editPayment === "bank"
                        ? "border-sky-500"
                        : "border-slate-300"
                    }`}
                  >
                    Chuyển khoản
                  </button>
                </div>
              </div>
              <div className="text-right">
                <button
                  onClick={() => setIsEditModalOpen(false)}
                  className="mr-2 bg-slate-200 dark:bg-slate-700 px-4 py-2 rounded"
                >
                  Hủy
                </button>
                <button
                  onClick={saveEdit}
                  className="bg-sky-600 text-white px-4 py-2 rounded"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {cartItems.length > 0 && mobileView === "products" && (
        <FloatingCartButton
          count={totalCartItems}
          total={total}
          onClick={() => setMobileView("cart")}
        />
      )}
    </>
  );
};

export default PinSalesManager;
