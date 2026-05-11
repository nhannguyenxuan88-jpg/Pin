import React, { useState, useMemo, useRef, useEffect } from "react";
import { usePinContext } from "../contexts/PinContext";
import type {
  PinProduct,
  PinCartItem,
  PinSale,
  PinCustomer,
  PinMaterial,
  InstallmentPlan,
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
  MagnifyingGlassIcon,
  ChevronRightIcon,
  UsersIcon,
  PrinterIcon,
  CalendarIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CheckCircleIcon,
} from "./common/Icons";
import { InvoicePreviewModal } from "./invoices/InvoicePreviewModal";
import SalesInvoiceTemplate from "./invoices/SalesInvoiceTemplate";
import InstallmentModal from "./InstallmentModal";
import { FloatingCartButton } from "./pos/FloatingCartButton";
import { SmartPriceInput } from "./pos/SmartPriceInput";
import { NewPinCustomerModal } from "./pos/NewPinCustomerModal";
import { EmptyState } from "./ui/EmptyState";
import { Button } from "./ui/Button";
import { InstallmentService } from "../lib/services/InstallmentService";
import { supabase } from "../supabaseClient";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(amount);

const getSaleCost = (sale: PinSale) =>
  (sale.items || []).reduce(
    (sum, item) => sum + Number(item.costPrice || 0) * Number(item.quantity || 0),
    0
  );

const getProductBadge = (name = "") => {
  const normalized = name.toLowerCase();
  if (normalized.includes("pin")) return "bg-amber-300";
  if (normalized.includes("mạch") || normalized.includes("mach")) return "bg-sky-300";
  if (normalized.includes("dây") || normalized.includes("day")) return "bg-violet-300";
  if (normalized.includes("sạc") || normalized.includes("sac")) return "bg-emerald-300";
  return "bg-slate-300";
};

// --- Main Component ---
interface PinSalesManagerProps {
  products: PinProduct[];
  cartItems: PinCartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<PinCartItem[]>>;
  handleSale: (saleData: Omit<PinSale, "id" | "date" | "userId" | "userName">) => void;
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
  const [salesCategory, setSalesCategory] = useState<"products" | "materials" | "all">("all");
  const { currentUser, pinSales, deletePinSale, updatePinSale, pinMaterials, addToast } = usePinContext();

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

  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"VND" | "%">("VND");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  // New: payment modes
  const [paymentMode, setPaymentMode] = useState<"full" | "partial" | "debt" | "installment">(
    "full"
  );
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");
  const [mobileView, setMobileView] = useState<"products" | "cart">("products");
  const [printReceipt, setPrintReceipt] = useState(true);
  const [isReceiptVisible, setIsReceiptVisible] = useState(false);
  const [lastSaleData, setLastSaleData] = useState<PinSale | null>(null);
  const [activeTab, setActiveTab] = useState<"pos" | "history">("pos");
  const [showInvoicePreview, setShowInvoicePreview] = useState(false);
  const [invoiceSaleData, setInvoiceSaleData] = useState<PinSale | null>(null);

  // Installment (trả góp) state
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlan | null>(null);

  // Delivery (giao hàng) state
  const [deliveryMethod, setDeliveryMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [deliveryPhone, setDeliveryPhone] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [shippingFee, setShippingFee] = useState(0);
  const [shippingCarrier, setShippingCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const getLocalDateString = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const getLocalTimeString = (date = new Date()) =>
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

  // Custom Date State
  const [saleDate, setSaleDate] = useState<string>(() => getLocalDateString());

  // Customer state
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<PinCustomer | null>(null);
  const [isCustomerListOpen, setIsCustomerListOpen] = useState(false);
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const customerInputRef = useRef<HTMLDivElement>(null);
  const [showAllProducts, setShowAllProducts] = useState(false);
  const PRODUCTS_LIMIT = 20;

  // Convert materials to product-like format for display
  const allAvailableItems = useMemo(() => {
    const filteredProducts = products.filter(
      (p) =>
        p.stock > 0 &&
        (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredMaterials =
      pinMaterials
        ?.filter(
          (m: PinMaterial) =>
            (m.stock || 0) > 0 &&
            (m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              m.sku?.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .map((material: PinMaterial) => ({
          id: material.id,
          name: material.name,
          sku: material.sku || `MAT-${material.id.slice(-4)}`,
          stock: material.stock || 0,
          costPrice: material.purchasePrice || 0,
          // Dùng giá bán lẻ làm mặc định cho cart
          sellingPrice:
            material.retailPrice || material.sellingPrice || material.purchasePrice || 0,
          retailPrice: material.retailPrice || 0,
          wholesalePrice: material.wholesalePrice || 0,
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

  // Giới hạn số sản phẩm hiển thị để tăng hiệu suất
  const availableItems = useMemo(() => {
    // Khi đang tìm kiếm, hiển thị tất cả kết quả tìm kiếm
    if (searchTerm.trim()) return allAvailableItems;
    // Khi không tìm kiếm, giới hạn 20 sản phẩm trừ khi user chọn xem tất cả
    if (showAllProducts) return allAvailableItems;
    return allAvailableItems.slice(0, PRODUCTS_LIMIT);
  }, [allAvailableItems, showAllProducts, searchTerm]);

  const hasMoreProducts = allAvailableItems.length > PRODUCTS_LIMIT && !searchTerm.trim();

  // Keep backward compatibility
  const availableProducts = availableItems;

  const addToCart = (product: PinProduct, priceType: "retail" | "wholesale" = "retail") => {
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
      const retailPrice = (product as any).retailPrice || product.sellingPrice || 0;
      const wholesalePrice = (product as any).wholesalePrice || 0;
      const finalSellingPrice =
        priceType === "wholesale" && wholesalePrice > 0 ? wholesalePrice : retailPrice;

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
            ? item.productId === productId && (item.priceType || "retail") === priceType
            : item.productId === productId;

          if (!shouldUpdate) return item;
          const maxQty = Number.isFinite(item.stock) ? Math.max(0, item.stock) : quantity;
          return { ...item, quantity: Math.max(0, Math.min(quantity, maxQty)) };
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const updatePrice = (
    productId: string,
    newPrice: number,
    priceType?: "retail" | "wholesale"
  ) => {
    setCartItems((prev) =>
      prev.map((item) => {
        const shouldUpdate = priceType
          ? item.productId === productId && (item.priceType || "retail") === priceType
          : item.productId === productId;
        return shouldUpdate ? { ...item, sellingPrice: newPrice } : item;
      })
    );
  };

  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0),
    [cartItems]
  );

  const discountAmount = useMemo(() => {
    if (discountType === "%") {
      return Math.round((subtotal * discount) / 100);
    }
    return discount;
  }, [discount, discountType, subtotal]);

  // Ensure total is never negative
  const total = Math.max(0, subtotal - discountAmount);
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
      if (customerInputRef.current && !customerInputRef.current.contains(event.target as Node)) {
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
      showToast("Lỗi khi lưu khách hàng. Vui lòng thử lại.", "error");
    }
    setCustomers((prev) => [newCustomer, ...prev]);
    handleSelectCustomer(newCustomer);
    setIsNewCustomerModalOpen(false);
  };

  const finalizeSale = () => {
    if (!currentUser) {
      showToast("Bạn phải đăng nhập để thực hiện thanh toán.", "warn");
      return;
    }
    if (cartItems.length === 0 || !paymentMethod) {
      showToast("Vui lòng thêm sản phẩm vào giỏ và chọn phương thức thanh toán.", "warn");
      return;
    }

    // Validate payment mode
    if (paymentMode === "partial") {
      const amt = Number(paidAmount || 0);
      if (!(amt > 0 && amt < total)) {
        showToast("Số tiền thanh toán một phần phải lớn hơn 0 và nhỏ hơn Tổng cộng.", "warn");
        return;
      }
    }
    if (paymentMode === "debt") {
      // Optional: encourage selecting a customer for debts
      if (!selectedCustomer) {
        showConfirmDialog(
          "Xác nhận ghi nợ",
          "Bạn chưa chọn khách hàng. Ghi nợ cho 'Khách vãng lai'?",
          () => proceedWithSale()
        );
        return;
      }
    }
    if (paymentMode === "installment") {
      if (!selectedCustomer) {
        showToast("Vui lòng chọn khách hàng để trả góp!", "warn");
        return;
      }
      if (!installmentPlan) {
        showToast("Vui lòng thiết lập kế hoạch trả góp!", "warn");
        setShowInstallmentModal(true);
        return;
      }
    }

    proceedWithSale();
  };

  const proceedWithSale = () => {
    const customerDetails = selectedCustomer
      ? {
        id: selectedCustomer.id,
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        address: selectedCustomer.address,
      }
      : { name: customerSearch || "Khách lẻ" };

    // Determine payment status and paid amount based on mode
    let paymentStatus: "paid" | "partial" | "debt" | "installment" = "paid";
    let finalPaidAmount = total;

    if (paymentMode === "full") {
      paymentStatus = "paid";
      finalPaidAmount = total;
    } else if (paymentMode === "partial") {
      paymentStatus = "partial";
      finalPaidAmount = Math.min(Math.max(1, paidAmount || 0), total);
    } else if (paymentMode === "debt") {
      paymentStatus = "debt";
      finalPaidAmount = 0;
    } else if (paymentMode === "installment") {
      paymentStatus = "installment";
      finalPaidAmount = installmentPlan?.downPayment || 0;
    }

    const saleData: Omit<PinSale, "id" | "date" | "userId" | "userName"> = {
      items: cartItems,
      subtotal,
      discount: discountAmount,
      total,
      customer: customerDetails,
      paymentMethod,
      paymentStatus,
      paidAmount: finalPaidAmount,
      dueDate: paymentMode === "debt" ? dueDate || undefined : undefined,
      isInstallment: paymentMode === "installment",
      installmentPlan: paymentMode === "installment" ? installmentPlan || undefined : undefined,
      // Delivery fields
      delivery_method: deliveryMethod,
      delivery_status: deliveryMethod === 'delivery' ? 'pending' : undefined,
      delivery_address: deliveryMethod === 'delivery' ? deliveryAddress : undefined,
      delivery_phone: deliveryMethod === 'delivery' ? (deliveryPhone || selectedCustomer?.phone) : undefined,
      delivery_note: deliveryMethod === 'delivery' ? deliveryNote : undefined,
      cod_amount: deliveryMethod === 'delivery' ? (total + shippingFee - finalPaidAmount) : undefined,
      shipping_fee: deliveryMethod === 'delivery' ? shippingFee : undefined,
      shipping_carrier: deliveryMethod === 'delivery' ? shippingCarrier : undefined,
      tracking_number: deliveryMethod === 'delivery' ? trackingNumber : undefined,
    };
    handleSale(saleData);

    const completedSale: PinSale = {
      ...saleData,
      id: `SALE-${Date.now()}`,
      // Combine date and time
      date: new Date(`${saleDate}T${getLocalTimeString()}:00`).toISOString(),
      userId: currentUser?.id || "",
      userName: currentUser?.name || "",
      code: `HD${Date.now().toString().slice(-8)}`,
    };

    // Save installment plan if applicable
    if (paymentMode === "installment" && installmentPlan) {
      const planToSave: InstallmentPlan = {
        ...installmentPlan,
        saleId: completedSale.id,
        customerId: selectedCustomer?.id || "",
      };
      InstallmentService.saveInstallmentPlan(planToSave);
    }

    // Show invoice preview
    setInvoiceSaleData(completedSale);
    setShowInvoicePreview(true);

    if (printReceipt) {
      setLastSaleData(completedSale);
      setIsReceiptVisible(true);
    }

    // Reset form
    setCartItems([]);
    setDiscount(0);
    setDiscountType("VND");
    setCustomerSearch("");
    setSelectedCustomer(null);
    setPaymentMethod("cash");
    setPaymentMode("full");
    setPaidAmount(0);
    setDueDate("");
    setInstallmentPlan(null);
    setDeliveryMethod('pickup');
    setDeliveryAddress('');
    setDeliveryPhone('');
    setDeliveryNote('');
    setShippingFee(0);
    setShippingCarrier('');
    setTrackingNumber('');
    setMobileView("products");

    // Reset date to today (local time)
    setSaleDate(getLocalDateString());
  };

  // Load installment plans for sales
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  useEffect(() => {
    InstallmentService.getAllInstallmentPlans().then((plans) => {
      setInstallmentPlans(plans);
    });
  }, [pinSales]);

  // Sales history list (recent 50)
  const recentSales = useMemo(() => (pinSales || []).slice(0, 50), [pinSales]);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatusFilter, setHistoryStatusFilter] = useState<
    "all" | "paid" | "partial" | "debt" | "installment" | "cancelled"
  >("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<"all" | "today" | "7d" | "month">(
    "all"
  );

  const getSalePaymentStatus = (sale: PinSale): "paid" | "partial" | "debt" | "installment" | "cancelled" => {
    if (sale.paymentStatus === "cancelled") return "cancelled";
    const linkedPlan = installmentPlans.find((plan) => plan.saleId === sale.id);
    const actualInstallmentPlan = sale.installmentPlan || linkedPlan;
    if (sale.isInstallment || actualInstallmentPlan) return "installment";
    if (sale.paidAmount !== undefined && sale.paidAmount > 0 && sale.paidAmount < sale.total) {
      return "partial";
    }
    if (sale.paidAmount === 0 || sale.paymentStatus === "debt") return "debt";
    return "paid";
  };

  const filteredHistorySales = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const sevenDaysAgo = startOfToday - 6 * 24 * 60 * 60 * 1000;

    return recentSales.filter((sale) => {
      const saleTime = new Date(sale.date).getTime();
      if (historyDateFilter === "today" && saleTime < startOfToday) return false;
      if (historyDateFilter === "7d" && saleTime < sevenDaysAgo) return false;
      if (historyDateFilter === "month" && saleTime < startOfMonth) return false;

      const status = getSalePaymentStatus(sale);
      if (status === "cancelled" && historyStatusFilter !== "cancelled") return false;
      if (historyStatusFilter !== "all" && status !== historyStatusFilter) return false;

      if (!query) return true;
      const searchable = [
        sale.code,
        sale.id,
        sale.customer?.name,
        sale.customer?.phone,
        ...(sale.items || []).map((item) => `${item.name} ${item.sku}`),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [recentSales, historySearch, historyDateFilter, historyStatusFilter, installmentPlans]);

  const historyMetrics = useMemo(() => {
    const revenue = filteredHistorySales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
    const cost = filteredHistorySales.reduce((sum, sale) => sum + getSaleCost(sale), 0);
    const paid = filteredHistorySales.reduce((sum, sale) => {
      const paidAmount =
        typeof sale.paidAmount === "number"
          ? sale.paidAmount
          : sale.paymentStatus === "debt"
            ? 0
            : sale.total;
      return sum + Math.min(Number(sale.total || 0), Math.max(0, Number(paidAmount || 0)));
    }, 0);
    const debt = Math.max(0, revenue - paid);
    const profit = revenue - cost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
    const completed = filteredHistorySales.filter(
      (sale) => sale.paymentStatus !== "debt" && sale.paidAmount !== 0
    ).length;

    return {
      revenue,
      cost,
      paid,
      debt,
      profit,
      margin,
      completed,
      count: filteredHistorySales.length,
    };
  }, [filteredHistorySales]);
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

  // Payment detail modal
  const [paymentDetailSale, setPaymentDetailSale] = useState<PinSale | null>(null);
  const [showPaymentDetail, setShowPaymentDetail] = useState(false);

  const openEdit = (s: PinSale) => {
    setEditingSale(s);
    setEditDiscount(s.discount || 0);
    setEditDiscountType("VND"); // Default to VND for existing sales
    setEditPayment(s.paymentMethod || "cash");
    setIsEditModalOpen(true);
  };
  const saveEdit = async () => {
    if (!editingSale) return;
    const subtotal = editingSale.items.reduce((sum, it) => sum + it.sellingPrice * it.quantity, 0);

    const finalDiscountAmount =
      editDiscountType === "%" ? Math.round((subtotal * editDiscount) / 100) : editDiscount;

    const newTotal = subtotal - finalDiscountAmount;
    const isInstallment = editingSale.isInstallment || editingSale.paymentStatus === "installment";
    const rawPaid =
      typeof editingSale.paidAmount === "number"
        ? editingSale.paidAmount
        : editingSale.paymentStatus === "debt"
          ? 0
          : editingSale.total;
    const adjustedPaid = isInstallment
      ? Math.min(Math.max(0, rawPaid), newTotal)
      : editingSale.paymentStatus === "debt"
        ? 0
        : Math.min(Math.max(0, rawPaid), newTotal);

    const normalizedStatus: PinSale["paymentStatus"] = isInstallment
      ? "installment"
      : adjustedPaid <= 0
        ? "debt"
        : adjustedPaid < newTotal
          ? "partial"
          : "paid";

    const updated: PinSale = {
      ...editingSale,
      discount: finalDiscountAmount,
      total: newTotal,
      paidAmount: adjustedPaid,
      paymentStatus: normalizedStatus,
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
        onToast={showToast}
      />
      {/* Invoice Preview Modal for Print */}
      {isReceiptVisible && lastSaleData && (
        <InvoicePreviewModal
          isOpen={isReceiptVisible}
          onClose={() => setIsReceiptVisible(false)}
          title={`Hóa đơn ${lastSaleData.code || lastSaleData.id}`}
        >
          <SalesInvoiceTemplate sale={lastSaleData} onClose={() => setIsReceiptVisible(false)} />
        </InvoicePreviewModal>
      )}
      {/* Modern Segmented Tab Navigation */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex p-1 bg-pin-gray-100/50 dark:bg-pin-gray-800/50 backdrop-blur-md rounded-xl border border-pin-gray-200/50 dark:border-pin-gray-700/30">
          <button
            onClick={() => setActiveTab("pos")}
            className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold text-sm transition-all duration-300 ${
              activeTab === "pos"
                ? "bg-white dark:bg-pin-gray-700 text-pin-blue-600 dark:text-pin-blue-400 shadow-md scale-105"
                : "text-pin-gray-500 dark:text-pin-gray-400 hover:text-pin-gray-700 dark:hover:text-pin-gray-200"
            }`}
          >
            <ShoppingCartIcon className="w-4 h-4" />
            <span>Tạo đơn mới</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-2 py-2 px-6 rounded-lg font-semibold text-sm transition-all duration-300 ${
              activeTab === "history"
                ? "bg-white dark:bg-pin-gray-700 text-pin-blue-600 dark:text-pin-blue-400 shadow-md scale-105"
                : "text-pin-gray-500 dark:text-pin-gray-400 hover:text-pin-gray-700 dark:hover:text-pin-gray-200"
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            <span>Lịch sử giao dịch</span>
          </button>
        </div>
      </div>

      {activeTab === "pos" && (
        <div
          className={`lg:grid lg:gap-4 h-full transition-all duration-300 ${cartItems.length > 0 ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}
        >
          {/* Product List */}
          <div
            className={`${mobileView === "products" ? "flex" : "hidden"
              } lg:flex flex-col bg-white dark:bg-pin-gray-800 p-2 md:p-4 rounded-lg shadow-sm border dark:border-pin-gray-700 h-full ${cartItems.length > 0 ? "lg:col-span-2" : "lg:col-span-1"}`}
          >
            {/* Modern Search Bar */}
            <div className="relative mb-4 group">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pin-gray-400 group-focus-within:text-pin-blue-500 transition-colors">
                <MagnifyingGlassIcon className="w-5 h-5" />
              </div>
              <input
                type="text"
                placeholder="Tìm tên sản phẩm hoặc mã SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-pin-gray-50 dark:bg-pin-gray-700/50 border border-pin-gray-200 dark:border-pin-gray-600 rounded-xl text-sm focus:ring-2 focus:ring-pin-blue-500/20 focus:border-pin-blue-500 transition-all outline-none"
              />
            </div>

            {/* Scientific Category Chips */}
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
              <button
                onClick={() => setSalesCategory("all")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  salesCategory === "all"
                    ? "bg-pin-blue-500 text-white border-pin-blue-500 shadow-md shadow-pin-blue-500/20"
                    : "bg-transparent text-pin-gray-600 dark:text-pin-gray-300 border-pin-gray-200 dark:border-pin-gray-700 hover:bg-pin-gray-50 dark:hover:bg-pin-gray-700"
                }`}
              >
                <span>Tất cả</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${salesCategory === "all" ? "bg-white/20" : "bg-pin-gray-100 dark:bg-pin-gray-800"}`}>{availableItems.length}</span>
              </button>
              <button
                onClick={() => setSalesCategory("products")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  salesCategory === "products"
                    ? "bg-pin-blue-500 text-white border-pin-blue-500 shadow-md shadow-pin-blue-500/20"
                    : "bg-transparent text-pin-gray-600 dark:text-pin-gray-300 border-pin-gray-200 dark:border-pin-gray-700 hover:bg-pin-gray-50 dark:hover:bg-pin-gray-700"
                }`}
              >
                <span>Thành phẩm</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${salesCategory === "products" ? "bg-white/20" : "bg-pin-gray-100 dark:bg-pin-gray-800"}`}>{products.filter((p) => p.stock > 0).length}</span>
              </button>
              <button
                onClick={() => setSalesCategory("materials")}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border ${
                  salesCategory === "materials"
                    ? "bg-pin-blue-500 text-white border-pin-blue-500 shadow-md shadow-pin-blue-500/20"
                    : "bg-transparent text-pin-gray-600 dark:text-pin-gray-300 border-pin-gray-200 dark:border-pin-gray-700 hover:bg-pin-gray-50 dark:hover:bg-pin-gray-700"
                }`}
              >
                <span>Nguyên vật liệu</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${salesCategory === "materials" ? "bg-white/20" : "bg-pin-gray-100 dark:bg-pin-gray-800"}`}>
                  {(pinMaterials || []).filter((m: PinMaterial) => (m.stock || 0) > 0).length}
                </span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 pb-24 md:pb-0">
              {availableProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {availableProducts.map((product: PinProduct & { type?: string }) => (
                    <div
                      key={product.id}
                      className="group relative bg-white dark:bg-pin-gray-800 p-4 rounded-xl border border-pin-gray-200 dark:border-pin-gray-700/50 hover:border-pin-blue-400 dark:hover:border-pin-blue-500/50 transition-all duration-300"
                    >
                      {/* Product Type Badge */}
                      <div className="absolute top-3 right-3">
                        <span
                          className={`flex items-center justify-center p-1.5 rounded-lg border ${(product as any).type === "material"
                            ? "bg-orange-50 text-orange-500 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20"
                            : "bg-emerald-50 text-emerald-500 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            }`}
                          title={(product as any).type === "material" ? "Nguyên vật liệu" : "Thành phẩm"}
                        >
                          {(product as any).type === "material" ? <ArchiveBoxIcon className="w-3.5 h-3.5" /> : <CubeIcon className="w-3.5 h-3.5" />}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex flex-col h-full">
                        <div className="mb-3 pr-8">
                          <h3 className="font-bold text-pin-gray-800 dark:text-pin-gray-100 text-sm leading-tight line-clamp-2 group-hover:text-pin-blue-600 dark:group-hover:text-pin-blue-400 transition-colors">
                            {product.name}
                          </h3>
                          <p className="text-[10px] font-mono text-pin-gray-400 mt-1">
                            {product.sku}
                          </p>
                        </div>

                        <div className="mt-auto space-y-3">
                          {/* Stock info */}
                          <div className="flex justify-end">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${product.stock === 0
                                ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                                : product.stock <= 5
                                  ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20"
                                  : "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                              }`}>
                              {product.stock === 0 ? "HẾT HÀNG" : `Kho: ${product.stock}`}
                            </span>
                          </div>

                          {/* Action Buttons with Prices */}
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, "retail");
                              }}
                              className="group/btn flex flex-col items-center justify-center py-2 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-white rounded-lg transition-all active:scale-95"
                            >
                              <span className="text-[9px] uppercase tracking-wide opacity-80 mb-0.5">Giá lẻ</span>
                              <span className="text-xs font-semibold">
                                {formatCurrency((product as any).retailPrice ?? product.sellingPrice ?? 0).replace('₫', '')}
                              </span>
                            </button>
                            {((product as any).wholesalePrice || 0) > 0 ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addToCart(product, "wholesale");
                                }}
                                className="group/btn flex flex-col items-center justify-center py-2 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white rounded-lg transition-all active:scale-95"
                              >
                                <span className="text-[9px] uppercase tracking-wide opacity-80 mb-0.5">Giá sỉ</span>
                                <span className="text-xs font-semibold">
                                  {formatCurrency((product as any).wholesalePrice).replace('₫', '')}
                                </span>
                              </button>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-2 bg-pin-gray-50 dark:bg-pin-gray-800/50 text-pin-gray-400 rounded-lg text-[9px] uppercase tracking-wide opacity-60 border border-dashed border-pin-gray-200 dark:border-pin-gray-700">
                                <span>Giá sỉ</span>
                                <span className="text-xs">Trống</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {/* Nút xem thêm khi có nhiều hơn 20 sản phẩm */}
              {hasMoreProducts && !showAllProducts && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setShowAllProducts(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-pin-blue-100 hover:bg-pin-blue-200 dark:bg-pin-blue-900/30 dark:hover:bg-pin-blue-800/50 text-pin-blue-700 dark:text-pin-blue-300 rounded-lg transition-colors text-sm font-medium"
                  >
                    📦 Xem thêm {allAvailableItems.length - PRODUCTS_LIMIT} sản phẩm khác
                  </button>
                </div>
              )}
              {showAllProducts && hasMoreProducts && (
                <div className="mt-3 text-center">
                  <button
                    onClick={() => setShowAllProducts(false)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium"
                  >
                    ⬆️ Thu gọn
                  </button>
                </div>
              )}

              {availableProducts.length === 0 && (
                <EmptyState
                  title={
                    salesCategory === "products"
                      ? "Không có thành phẩm nào"
                      : salesCategory === "materials"
                        ? "Không có nguyên liệu nào"
                        : "Không có sản phẩm nào"
                  }
                  description={
                    salesCategory === "products"
                      ? "Hãy hoàn thành sản xuất để có thành phẩm bán."
                      : salesCategory === "materials"
                        ? "Hãy nhập kho nguyên liệu để bán lẻ."
                        : "Thành phẩm và nguyên liệu có tồn kho sẽ hiện ở đây."
                  }
                  icon="cube"
                  action={
                    salesCategory === "products" && products.length === 0 ? (
                      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-700 dark:text-blue-300">
                        <p className="text-sm font-medium">💡 Gợi ý:</p>
                        <p className="text-xs mt-1">
                          1. Tạo BOM → 2. Tạo lệnh sản xuất → 3. Hoàn thành sản xuất
                        </p>
                      </div>
                    ) : null
                  }
                />
              )}
            </div>
          </div>

          {/* Cart & Checkout - Premium Glassmorphism Look */}
          {(cartItems.length > 0 || mobileView === "cart") && (
            <div
              className={`${mobileView === "cart" ? "flex" : "hidden lg:flex"
                } w-full lg:w-auto flex-col bg-white/90 dark:bg-pin-gray-800/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-pin-gray-100 dark:border-pin-gray-700/50 mt-6 lg:mt-0 lg:col-span-1 animate-in slide-in-from-right-5 duration-300 h-fit sticky top-4`}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <button
                    onClick={() => setMobileView("products")}
                    className="lg:hidden p-2 mr-2 -ml-2 text-pin-gray-600 dark:text-pin-gray-300 hover:bg-pin-gray-100 dark:hover:bg-pin-gray-700 rounded-lg transition-colors"
                  >
                    <ArrowUturnLeftIcon className="w-5 h-5" />
                  </button>
                  <h2 className="text-xl font-bold flex items-center text-pin-gray-800 dark:text-pin-gray-100">
                    <span className="bg-orange-100 dark:bg-orange-500/20 p-2 rounded-lg mr-3">
                      <ShoppingCartIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </span>
                    Hóa đơn
                  </h2>
                </div>
                {cartItems.length > 0 && (
                  <span className="bg-pin-gray-100 text-pin-gray-600 dark:bg-pin-gray-700 dark:text-pin-gray-300 px-3 py-1 rounded-full text-xs font-bold shadow-sm">
                    {cartItems.length} SP
                  </span>
                )}
              </div>

              {/* 1. Khách hàng - Đặt trên cùng */}

              {/* 1. Customer Section */}
              <div className="mb-6">
                {/* Modern Date/Time Picker */}
                <div className="mb-6 p-4 bg-pin-gray-50/50 dark:bg-pin-gray-700/30 rounded-2xl border border-pin-gray-200/50 dark:border-pin-gray-700/30 backdrop-blur-sm">
                  <div className="flex gap-4">
                    <div className="flex-1 group">
                      <label className="block text-[10px] font-bold text-pin-gray-400 dark:text-pin-gray-500 mb-1.5 uppercase tracking-widest">
                        Ngày giao dịch
                      </label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pin-gray-400 group-focus-within:text-pin-blue-500 transition-colors pointer-events-none">
                          <CalendarIcon className="w-4 h-4" />
                        </div>
                        <input
                          type="date"
                          value={saleDate}
                          onChange={(e) => setSaleDate(e.target.value)}
                          className="w-full pl-9 pr-3 py-2 bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-600 rounded-xl text-sm font-semibold text-pin-gray-700 dark:text-pin-gray-200 focus:ring-4 focus:ring-pin-blue-500/10 focus:border-pin-blue-500 transition-all outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={customerInputRef} className="pb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-bold text-pin-gray-700 dark:text-pin-gray-200 flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-pin-blue-500" />
                      <span>Khách hàng</span>
                    </label>
                    {!selectedCustomer && (
                      <button
                        onClick={() => setIsNewCustomerModalOpen(true)}
                        className="text-[10px] font-bold text-pin-blue-600 dark:text-pin-blue-400 hover:underline uppercase tracking-wider"
                      >
                        + Thêm mới
                      </button>
                    )}
                  </div>

                  {/* Selected Customer Card */}
                  {selectedCustomer ? (
                    <div className="group relative p-4 bg-gradient-to-br from-pin-blue-50 to-indigo-50 dark:from-pin-blue-900/20 dark:to-indigo-900/20 border border-pin-blue-200/50 dark:border-pin-blue-700/30 rounded-2xl transition-all hover:shadow-lg hover:shadow-pin-blue-500/5">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-pin-blue-600 text-white flex items-center justify-center font-bold text-sm shadow-md">
                            {selectedCustomer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-pin-gray-800 dark:text-pin-gray-100 text-sm">
                              {selectedCustomer.name}
                            </p>
                            <p className="text-xs text-pin-gray-500 dark:text-pin-gray-400 mt-0.5">
                              📞 {selectedCustomer.phone}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedCustomer(null);
                            setCustomerSearch("");
                          }}
                          className="p-1.5 bg-white dark:bg-pin-gray-800 text-pin-gray-400 hover:text-red-500 rounded-lg shadow-sm transition-all active:scale-95"
                        >
                          <XMarkIcon className="w-4 h-4" />
                        </button>
                      </div>
                      {selectedCustomer.address && (
                        <div className="mt-3 pt-3 border-t border-pin-blue-100 dark:border-pin-blue-800/50">
                          <p className="text-[11px] text-pin-gray-500 dark:text-pin-gray-400 italic">
                            📍 {selectedCustomer.address}
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="relative group">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-pin-gray-400 group-focus-within:text-pin-blue-500 transition-colors">
                        <MagnifyingGlassIcon className="w-4 h-4" />
                      </div>
                      <input
                        type="text"
                        placeholder="Tìm tên hoặc số điện thoại..."
                        value={customerSearch}
                        onChange={(e) => {
                          setCustomerSearch(e.target.value);
                          setIsCustomerListOpen(true);
                        }}
                        onFocus={() => setIsCustomerListOpen(true)}
                        className="w-full pl-9 pr-4 py-2.5 bg-pin-gray-50 dark:bg-pin-gray-700/50 border border-pin-gray-200 dark:border-pin-gray-600 rounded-xl text-sm focus:ring-4 focus:ring-pin-blue-500/10 focus:border-pin-blue-500 transition-all outline-none"
                      />

                      {/* Dropdown Results */}
                      {isCustomerListOpen && (customerSearch || filteredCustomers.length > 0) && (
                        <div className="absolute top-full mt-2 z-50 w-full bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-700 rounded-2xl shadow-2xl overflow-hidden animate-slideUp">
                          <div className="p-3 bg-pin-gray-50 dark:bg-pin-gray-700/50 border-b dark:border-pin-gray-700">
                            <span className="text-[10px] font-bold text-pin-gray-400 uppercase tracking-widest">Kết quả tìm kiếm</span>
                          </div>
                          <div className="max-h-64 overflow-y-auto no-scrollbar">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.map((c) => (
                                <button
                                  key={c.id}
                                  onClick={() => handleSelectCustomer(c)}
                                  className="w-full p-3 flex items-center justify-between hover:bg-pin-blue-50 dark:hover:bg-pin-blue-900/20 transition-colors border-b dark:border-pin-gray-700 last:border-0"
                                >
                                  <div className="text-left">
                                    <p className="font-bold text-pin-gray-800 dark:text-pin-gray-100 text-sm">{c.name}</p>
                                    <p className="text-[11px] text-pin-gray-500">{c.phone}</p>
                                  </div>
                                  <ChevronRightIcon className="w-4 h-4 text-pin-gray-300" />
                                </button>
                              ))
                            ) : (
                              <div className="p-6 text-center">
                                <p className="text-xs text-pin-gray-400">Không tìm thấy khách hàng này</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Action Chips */}
                  {!selectedCustomer && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedCustomer({
                            id: "guest",
                            name: "Khách lẻ",
                            phone: "0000000000",
                            address: "",
                          });
                          setCustomerSearch("");
                          setIsCustomerListOpen(false);
                        }}
                        className="px-3 py-1.5 bg-pin-gray-100 dark:bg-pin-gray-700 text-pin-gray-600 dark:text-pin-gray-300 rounded-lg text-[11px] font-bold hover:bg-pin-gray-200 dark:hover:bg-pin-gray-600 transition-all border border-pin-gray-200 dark:border-pin-gray-600"
                      >
                        👤 Khách vãng lai
                      </button>
                      <button
                        onClick={() => {
                          setCustomerSearch("");
                          setIsCustomerListOpen(true);
                        }}
                        className="px-3 py-1.5 bg-pin-blue-50 dark:bg-pin-blue-900/20 text-pin-blue-600 dark:text-pin-blue-400 rounded-lg text-[11px] font-bold hover:bg-pin-blue-100 transition-all border border-pin-blue-100 dark:border-pin-blue-800"
                      >
                        📒 Danh bạ ({customers.length})
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Modern Cart Items List */}
              {cartItems.length > 0 && (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-xs font-bold text-pin-gray-400 uppercase tracking-widest">Sản phẩm trong giỏ</p>
                    <button
                      onClick={() => setCartItems([])}
                      className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors"
                    >
                      Xóa tất cả
                    </button>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                    {cartItems.map((item) => (
                      <div
                        key={`${item.productId}-${item.priceType || "retail"}`}
                        className="group relative bg-white dark:bg-pin-gray-700/50 p-3 rounded-2xl border border-pin-gray-100 dark:border-pin-gray-700/50 hover:border-pin-blue-200 dark:hover:border-pin-blue-800 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-pin-gray-800 dark:text-pin-gray-100 truncate">
                              {item.name}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
                                item.priceType === "wholesale"
                                  ? "bg-pin-blue-100 text-pin-blue-600 dark:bg-pin-blue-900/40"
                                  : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"
                              }`}>
                                {item.priceType === "wholesale" ? "Giá sỉ" : "Giá lẻ"}
                              </span>
                              <span className="text-[10px] text-pin-gray-400">SKU: {item.sku}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => updateQuantity(item.productId, 0, item.priceType)}
                            className="p-1 text-pin-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex flex-col">
                            <SmartPriceInput
                              value={item.sellingPrice}
                              onUpdate={(val) => updatePrice(item.productId, val, item.priceType)}
                              priceType={item.priceType || 'retail'}
                            />
                            <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400 mt-1">
                              Σ {formatCurrency(item.sellingPrice * item.quantity)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 bg-pin-gray-50 dark:bg-pin-gray-800 p-1 rounded-xl border dark:border-pin-gray-700">
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity - 1, item.priceType)}
                              className="w-7 h-7 flex items-center justify-center bg-white dark:bg-pin-gray-700 rounded-lg shadow-sm text-pin-gray-400 hover:text-red-500 transition-all active:scale-90"
                            >
                              <MinusIcon className="w-3 h-3" />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.productId, parseInt(e.target.value) || 0, item.priceType)}
                              className="w-8 text-center text-xs font-black bg-transparent border-none p-0 focus:ring-0 text-pin-gray-700 dark:text-pin-gray-200"
                            />
                            <button
                              onClick={() => updateQuantity(item.productId, item.quantity + 1, item.priceType)}
                              className="w-7 h-7 flex items-center justify-center bg-white dark:bg-pin-gray-700 rounded-lg shadow-sm text-pin-gray-400 hover:text-emerald-500 transition-all active:scale-90"
                            >
                              <PlusIcon className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Modern Order Summary Card */}
              <div className="bg-gradient-to-br from-pin-gray-50 to-pin-gray-100 dark:from-pin-gray-800/80 dark:to-pin-gray-900/80 p-5 rounded-3xl border border-pin-gray-200 dark:border-pin-gray-700 shadow-inner space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold text-pin-gray-500 dark:text-pin-gray-400">
                    <span>Tạm tính ({totalCartItems} SP)</span>
                    <span className="text-pin-gray-800 dark:text-pin-gray-200">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-pin-gray-500 dark:text-pin-gray-400">Giảm giá</span>
                      <div className="flex items-center bg-white dark:bg-pin-gray-700 rounded-lg border dark:border-pin-gray-600 p-0.5 overflow-hidden">
                        <input
                          type="number"
                          value={discount || ""}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          placeholder="0"
                          className="w-16 px-2 py-1 text-xs text-right bg-transparent border-none focus:ring-0 text-pin-gray-800 dark:text-pin-gray-200 font-bold"
                        />
                        <select
                          value={discountType}
                          onChange={(e) => {
                            setDiscountType(e.target.value as "VND" | "%");
                            setDiscount(0);
                          }}
                          className="bg-pin-gray-50 dark:bg-pin-gray-600 px-1 py-1 text-[10px] font-black border-none focus:ring-0 text-pin-gray-600 dark:text-pin-gray-300"
                        >
                          <option value="VND">₫</option>
                          <option value="%">%</option>
                        </select>
                      </div>
                    </div>
                    {discountAmount > 0 && (
                      <span className="text-xs font-bold text-red-500">-{formatCurrency(discountAmount)}</span>
                    )}
                  </div>
                </div>

                <div className="pt-5 border-t-2 border-dashed border-pin-gray-200 dark:border-pin-gray-700">
                  <div className="flex justify-between items-end mb-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-pin-gray-400 uppercase tracking-widest mb-1">Tổng tiền thanh toán</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-red-600 dark:from-orange-400 dark:to-red-500">
                          {formatCurrency(total).replace('₫', '')}
                        </span>
                        <span className="text-sm font-black text-orange-600 dark:text-orange-500 italic">VNĐ</span>
                      </div>
                    </div>
                    <div className="bg-emerald-500/10 dark:bg-emerald-500/20 px-3 py-1.5 rounded-2xl border border-emerald-500/20">
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter flex items-center gap-1">
                        <CheckCircleIcon className="w-3 h-3" /> Sẵn sàng
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={finalizeSale}
                    disabled={!currentUser || cartItems.length === 0}
                    className="relative w-full group overflow-hidden rounded-3xl"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-pin-blue-600 via-indigo-600 to-pin-blue-700 group-hover:scale-105 transition-transform duration-500" />
                    <div className="shimmer absolute inset-0 opacity-30" />
                    <div className="relative py-5 px-6 flex items-center justify-center gap-3 text-white">
                      <ShoppingCartIcon className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                      <span className="text-lg font-black tracking-tighter uppercase">Xác nhận thanh toán</span>
                      <ChevronRightIcon className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </button>
                </div>
              </div>

              {/* 4. Payment & Checkout Actions */}
              <div className="mt-6 space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-pin-gray-400 uppercase tracking-widest mb-3 px-1">Phương thức thanh toán</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${
                        paymentMethod === "cash"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 shadow-lg shadow-emerald-500/10"
                          : "border-pin-gray-100 dark:border-pin-gray-700 hover:border-emerald-200 dark:hover:border-emerald-800 text-pin-gray-500"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === "cash" ? "bg-emerald-500 text-white" : "bg-pin-gray-100 dark:bg-pin-gray-700"}`}>
                        <BanknotesIcon className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold">Tiền mặt</span>
                    </button>
                    <button
                      onClick={() => setPaymentMethod("bank")}
                      className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all duration-300 ${
                        paymentMethod === "bank"
                          ? "border-pin-blue-500 bg-pin-blue-50 dark:bg-pin-blue-900/20 text-pin-blue-700 dark:text-pin-blue-400 shadow-lg shadow-pin-blue-500/10"
                          : "border-pin-gray-100 dark:border-pin-gray-700 hover:border-pin-blue-200 dark:hover:border-pin-blue-800 text-pin-gray-500"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${paymentMethod === "bank" ? "bg-pin-blue-500 text-white" : "bg-pin-gray-100 dark:bg-pin-gray-700"}`}>
                        <span className="text-sm">🏦</span>
                      </div>
                      <span className="text-xs font-bold">Chuyển khoản</span>
                    </button>
                  </div>
                </div>

                {/* Modern Payment Modes */}
                <div className="p-4 bg-pin-gray-50/50 dark:bg-pin-gray-800/50 rounded-3xl border border-pin-gray-200 dark:border-pin-gray-700">
                  <label className="block text-[10px] font-bold text-pin-gray-400 uppercase tracking-widest mb-3 px-1">Hình thức</label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'full', label: 'Đủ', color: 'emerald' },
                      { id: 'partial', label: '1 phần', color: 'amber' },
                      { id: 'debt', label: 'Ghi nợ', color: 'red' },
                      { id: 'installment', label: 'Trả góp', color: 'purple' }
                    ].map((mode) => (
                      <button
                        key={mode.id}
                        onClick={() => {
                          if (mode.id === 'installment' && !selectedCustomer) {
                            showToast("Vui lòng chọn khách hàng trước khi trả góp!", "warn");
                            return;
                          }
                          setPaymentMode(mode.id as any);
                          if (mode.id === 'installment') setShowInstallmentModal(true);
                          if (mode.id === 'partial') setPaidAmount(total);
                          if (mode.id === 'debt') setPaidAmount(0);
                        }}
                        className={`py-2 px-1 rounded-xl text-[10px] font-black transition-all border-2 ${
                          paymentMode === mode.id
                            ? `border-${mode.color}-500 bg-${mode.color}-50 dark:bg-${mode.color}-900/20 text-${mode.color}-700 dark:text-${mode.color}-400`
                            : "border-transparent bg-white dark:bg-pin-gray-700 text-pin-gray-500 hover:bg-pin-gray-100"
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>

                  {/* Mode Details */}
                  {paymentMode === "partial" && (
                    <div className="mt-4 pt-4 border-t border-pin-gray-200 dark:border-pin-gray-700 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pin-gray-500">Khách trả trước</span>
                        <div className="flex items-center bg-white dark:bg-pin-gray-700 rounded-lg border dark:border-pin-gray-600 p-1">
                          <input
                            type="number"
                            value={paidAmount || ""}
                            onChange={(e) => setPaidAmount(Number(e.target.value))}
                            className="w-24 text-right text-sm font-black bg-transparent border-none focus:ring-0 text-pin-blue-600"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-right text-pin-gray-400 mt-1 font-bold">Còn nợ: {formatCurrency(total - (paidAmount || 0))}</p>
                    </div>
                  )}

                  {paymentMode === "debt" && (
                    <div className="mt-4 pt-4 border-t border-pin-gray-200 dark:border-pin-gray-700 animate-fadeIn">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-pin-gray-500">Hạn thanh toán</span>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="bg-white dark:bg-pin-gray-700 px-2 py-1.5 rounded-lg border dark:border-pin-gray-600 text-xs font-bold outline-none focus:ring-2 focus:ring-pin-blue-500/20"
                        />
                      </div>
                    </div>
                  )}

                  {paymentMode === "installment" && installmentPlan && (
                    <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-2xl border border-purple-100 dark:border-purple-800 animate-fadeIn">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Kế hoạch trả góp</span>
                        <button onClick={() => setShowInstallmentModal(true)} className="text-[10px] font-bold text-purple-600 underline">Sửa</button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 gap-x-4">
                        <div className="flex flex-col">
                          <span className="text-[9px] text-pin-gray-400 font-bold uppercase">Trả trước</span>
                          <span className="text-xs font-black text-emerald-600">{formatCurrency(installmentPlan.downPayment)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-pin-gray-400 font-bold uppercase">Mỗi tháng</span>
                          <span className="text-xs font-black text-red-600">{formatCurrency(installmentPlan.monthlyPayment)}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Modern Delivery Selection */}
                <div>
                  <div className="flex items-center gap-2 mb-3 px-1">
                    <label className="text-[10px] font-bold text-pin-gray-400 uppercase tracking-widest">Hình thức nhận hàng</label>
                  </div>
                  <div className="flex p-1 bg-pin-gray-100 dark:bg-pin-gray-800 rounded-2xl border border-pin-gray-200 dark:border-pin-gray-700">
                    <button
                      onClick={() => setDeliveryMethod('pickup')}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        deliveryMethod === 'pickup'
                          ? "bg-white dark:bg-pin-gray-700 text-pin-blue-600 shadow-sm"
                          : "text-pin-gray-500 hover:text-pin-gray-700"
                      }`}
                    >
                      🏪 Tại cửa hàng
                    </button>
                    <button
                      onClick={() => {
                        setDeliveryMethod('delivery');
                        if (selectedCustomer) {
                          setDeliveryAddress(selectedCustomer.address || '');
                          setDeliveryPhone(selectedCustomer.phone || '');
                        }
                      }}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${
                        deliveryMethod === 'delivery'
                          ? "bg-white dark:bg-pin-gray-700 text-orange-600 shadow-sm"
                          : "text-pin-gray-500 hover:text-pin-gray-700"
                      }`}
                    >
                      🚚 Giao hàng
                    </button>
                  </div>

                  {deliveryMethod === 'delivery' && (
                    <div className="mt-4 p-4 bg-orange-50/50 dark:bg-orange-900/10 rounded-3xl border border-orange-100 dark:border-orange-900/30 space-y-3 animate-fadeIn">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2">
                          <label className="text-[10px] font-bold text-orange-600/70 uppercase mb-1 block">Địa chỉ giao hàng</label>
                          <input
                            type="text"
                            value={deliveryAddress}
                            onChange={(e) => setDeliveryAddress(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border dark:border-pin-gray-700 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-orange-600/70 uppercase mb-1 block">SĐT nhận</label>
                          <input
                            type="text"
                            value={deliveryPhone}
                            onChange={(e) => setDeliveryPhone(e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border dark:border-pin-gray-700 rounded-xl text-xs font-bold outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-orange-600/70 uppercase mb-1 block">Phí ship</label>
                          <input
                            type="number"
                            value={shippingFee || ''}
                            onChange={(e) => setShippingFee(Number(e.target.value))}
                            className="w-full px-3 py-2 bg-white dark:bg-pin-gray-800 border dark:border-pin-gray-700 rounded-xl text-xs font-bold text-right outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 animate-slideUp">
            <div className="group bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-pin-blue-500/5 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-pin-gray-400 group-hover:text-pin-blue-500 transition-colors">Doanh thu</span>
                <span className="w-9 h-9 rounded-xl bg-pin-blue-50 dark:bg-pin-blue-900/30 text-pin-blue-600 dark:text-pin-blue-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <BanknotesIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-pin-gray-900 dark:text-white tracking-tight">{formatCurrency(historyMetrics.revenue)}</div>
              <div className="mt-2 text-[10px] font-bold text-pin-gray-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {historyMetrics.count}/{recentSales.length} hóa đơn đang hiển thị
              </div>
            </div>

            <div className="group bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-pin-gray-400 group-hover:text-emerald-500 transition-colors">Lợi nhuận gộp</span>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 text-[9px] font-black text-emerald-600 dark:text-emerald-300">
                    {historyMetrics.margin.toFixed(1)}%
                  </span>
                  <span className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <ArrowTrendingUpIcon className="w-4 h-4" />
                  </span>
                </div>
              </div>
              <div className={`text-2xl font-black tracking-tight ${historyMetrics.profit >= 0 ? "text-emerald-500 dark:text-emerald-300" : "text-red-500"}`}>
                {formatCurrency(historyMetrics.profit)}
              </div>
              <div className="mt-2 text-[10px] font-bold text-pin-gray-500 dark:text-pin-gray-300">Giá vốn: {formatCurrency(historyMetrics.cost)}</div>
            </div>

            <div className="group bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-teal-500/5 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-pin-gray-400 group-hover:text-teal-500 transition-colors">Đã thu</span>
                <span className="w-9 h-9 rounded-xl bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <CheckCircleIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-teal-600 dark:text-teal-400 tracking-tight">{formatCurrency(historyMetrics.paid)}</div>
              <div className="mt-2 text-[10px] font-bold text-pin-gray-500 dark:text-pin-gray-300">{historyMetrics.completed} đơn đã/đang thu</div>
            </div>

            <div className="group bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-700 rounded-2xl p-4 shadow-sm hover:shadow-lg hover:shadow-orange-500/5 transition-all duration-300">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-pin-gray-400 group-hover:text-orange-500 transition-colors">Công nợ</span>
                <span className="w-9 h-9 rounded-xl bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <ClockIcon className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl font-black text-orange-500 dark:text-orange-300 tracking-tight">{formatCurrency(historyMetrics.debt)}</div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-pin-gray-200 dark:bg-pin-gray-600">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-300 to-amber-400 transition-all"
                  style={{
                    width: `${historyMetrics.revenue > 0 ? Math.min(100, (historyMetrics.debt / historyMetrics.revenue) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-pin-gray-200 bg-white p-3 shadow-sm dark:border-pin-gray-700 dark:bg-pin-gray-800 md:flex-row md:items-center">
            <div className="relative flex-1">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-pin-gray-400 dark:text-pin-gray-300" />
              <input
                type="text"
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Tìm mã đơn, khách hàng hoặc sản phẩm..."
                className="w-full rounded-xl border border-pin-gray-200 bg-pin-gray-50 py-2.5 pl-10 pr-3 text-sm font-semibold text-pin-gray-800 outline-none transition focus:border-pin-blue-500 dark:border-pin-gray-700 dark:bg-pin-gray-900/40 dark:text-pin-gray-100"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Tất cả"],
                ["today", "Hôm nay"],
                ["7d", "7 ngày"],
                ["month", "Tháng này"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setHistoryDateFilter(value as typeof historyDateFilter)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${
                    historyDateFilter === value
                      ? "bg-pin-blue-600 text-white shadow-lg shadow-pin-blue-600/20"
                      : "bg-pin-gray-100 text-pin-gray-600 hover:bg-pin-gray-200 hover:text-pin-gray-800 dark:bg-pin-gray-700/60 dark:text-pin-gray-300 dark:hover:bg-pin-gray-700 dark:hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
              <select
                value={historyStatusFilter}
                onChange={(event) => setHistoryStatusFilter(event.target.value as typeof historyStatusFilter)}
                className="rounded-xl border border-pin-gray-200 bg-white px-3.5 py-2 text-xs font-black text-pin-gray-700 outline-none dark:border-pin-gray-700 dark:bg-pin-gray-900 dark:text-pin-gray-100"
              >
                <option value="all">Mọi trạng thái</option>
                <option value="paid">Hoàn tất</option>
                <option value="partial">Cần trả</option>
                <option value="debt">Ghi nợ</option>
                <option value="installment">Trả góp</option>
                <option value="cancelled">Đã hủy</option>
              </select>
            </div>
          </div>

          {/* Mobile view - Modern History Cards */}
          <div className="md:hidden space-y-4">
            {filteredHistorySales.length === 0 ? (
              <div className="p-12 text-center bg-pin-gray-50 dark:bg-pin-gray-700/30 rounded-3xl border-2 border-dashed border-pin-gray-200 dark:border-pin-gray-600">
                <ArchiveBoxIcon className="w-12 h-12 mx-auto text-pin-gray-300 mb-3" />
                <p className="text-sm font-bold text-pin-gray-400 italic">Chưa có giao dịch nào gần đây</p>
              </div>
            ) : (
              filteredHistorySales.map((s: PinSale) => {
                const linkedPlan = installmentPlans.find((p) => p.saleId === s.id);
                const actualInstallmentPlan = s.installmentPlan || linkedPlan;
                let paymentStatus: "paid" | "partial" | "debt" | "installment" | "cancelled" = "paid";

                if (s.paymentStatus === "cancelled") paymentStatus = "cancelled";
                else if (s.isInstallment || actualInstallmentPlan) paymentStatus = "installment";
                else if (s.paidAmount !== undefined && s.paidAmount > 0 && s.paidAmount < s.total) paymentStatus = "partial";
                else if (s.paidAmount === 0 || s.paymentStatus === "debt") paymentStatus = "debt";

                const statusColor = {
                  paid: "from-emerald-50 to-teal-50 text-emerald-600 border-emerald-100 dark:from-emerald-900/20 dark:to-teal-900/20",
                  partial: "from-amber-50 to-orange-50 text-amber-600 border-amber-100 dark:from-amber-900/20 dark:to-orange-900/20",
                  debt: "from-red-50 to-rose-50 text-red-600 border-red-100 dark:from-red-900/20 dark:to-rose-900/20",
                  installment: "from-purple-50 to-indigo-50 text-purple-600 border-purple-100 dark:from-purple-900/20 dark:to-indigo-900/20",
                  cancelled: "from-slate-100 to-slate-200 text-slate-500 border-slate-200 dark:from-slate-800/40 dark:to-slate-700/40",
                }[paymentStatus];
                const saleCost = getSaleCost(s);
                const saleProfit = Number(s.total || 0) - saleCost;

                return (
                  <div key={s.id} className="bg-white dark:bg-pin-gray-800 p-4 rounded-3xl border border-pin-gray-100 dark:border-pin-gray-700 shadow-sm animate-fadeIn">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <span className="text-[10px] font-black text-pin-blue-600 dark:text-pin-blue-400 bg-pin-blue-50 dark:bg-pin-blue-900/30 px-2 py-1 rounded-lg uppercase tracking-widest">{s.code || s.id.slice(0, 8)}</span>
                        <p className="text-[10px] text-pin-gray-400 font-bold mt-1 uppercase tracking-tighter">
                          {new Date(s.date).toLocaleDateString('vi-VN')} • {new Date(s.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border bg-gradient-to-br ${statusColor}`}>
                        {paymentStatus === 'paid'
                          ? 'Hoàn tất'
                          : paymentStatus === 'partial'
                            ? 'Một phần'
                            : paymentStatus === 'debt'
                              ? 'Nợ'
                              : paymentStatus === 'installment'
                                ? 'Trả góp'
                                : 'Đã hủy'}
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-sm font-black text-pin-gray-800 dark:text-pin-gray-100 mb-1">{s.customer?.name || "Khách vãng lai"}</p>
                      <p
                        className="text-xs text-pin-gray-500 line-clamp-1 italic dark:text-pin-gray-300"
                        title={(s.items || []).map((it: PinCartItem) => `${it.name} x${it.quantity}`).join(", ")}
                      >
                        {(s.items || []).map((it: PinCartItem) => it.name).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-pin-gray-50 dark:border-pin-gray-700">
                      <div>
                        <span className="block text-lg font-black text-orange-600 dark:text-orange-500">{formatCurrency(s.total)}</span>
                        <span className={`block text-[11px] font-black ${saleProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                          LN {formatCurrency(saleProfit)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => { setInvoiceSaleData(s); setShowInvoicePreview(true); }} className="w-9 h-9 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all" title="In hóa đơn"><PrinterIcon className="w-4 h-4" /></button>
                        <button onClick={() => openEdit(s)} className="w-9 h-9 flex items-center justify-center bg-pin-blue-50 dark:bg-pin-blue-900/30 text-pin-blue-600 rounded-xl hover:bg-pin-blue-100 transition-all" title="Sửa"><PencilSquareIcon className="w-4 h-4" /></button>
                        <button onClick={() => showConfirmDialog("Hủy hóa đơn", "Bạn có chắc chắn muốn hủy đơn này không?", () => deletePinSale(s.id))} className="ml-1 w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-900/30 text-red-500 rounded-xl hover:bg-red-100 transition-all" title="Hủy"><TrashIcon className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop view - Modern History Table */}
          <div className="hidden md:block overflow-hidden bg-white dark:bg-pin-gray-800 rounded-2xl border border-pin-gray-200 dark:border-pin-gray-700 shadow-sm">
            <div className="px-5 py-4 border-b border-pin-gray-100 dark:border-pin-gray-700 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-pin-gray-900 dark:text-white">Sổ giao dịch</h3>
                <p className="text-[11px] font-bold text-pin-gray-400 mt-0.5">
                  {filteredHistorySales.length} kết quả phù hợp bộ lọc
                </p>
              </div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-pin-gray-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Cập nhật theo hóa đơn gần nhất
              </div>
            </div>
            <div className="overflow-x-auto no-scrollbar">
              <table className="w-full text-left min-w-max border-separate border-spacing-0">
                <thead>
                  <tr className="bg-pin-gray-50/50 dark:bg-pin-gray-900/30">
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50">Mã đơn</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50">Ngày giờ</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50">Khách hàng</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50">Sản phẩm</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50 text-center">Trạng thái</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50 text-right">Tổng tiền</th>
                    <th className="px-5 py-4 text-[10px] font-black text-pin-gray-400 uppercase tracking-widest border-b border-pin-gray-100 dark:border-pin-gray-700/50 text-right">Lợi nhuận</th>
                    <th className="px-5 py-4 border-b border-pin-gray-100 dark:border-pin-gray-700/50"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pin-gray-50 dark:divide-pin-gray-700">
                  {filteredHistorySales.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center">
                        <p className="text-sm font-bold text-pin-gray-400 italic">Chưa có lịch sử giao dịch</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistorySales.map((s: PinSale) => {
                      const linkedPlan = installmentPlans.find((p) => p.saleId === s.id);
                      const actualInstallmentPlan = s.installmentPlan || linkedPlan;
                      let paymentStatus: "paid" | "partial" | "debt" | "installment" | "cancelled" = "paid";

                      if (s.paymentStatus === "cancelled") paymentStatus = "cancelled";
                      else if (s.isInstallment || actualInstallmentPlan) paymentStatus = "installment";
                      else if (s.paidAmount !== undefined && s.paidAmount > 0 && s.paidAmount < s.total) paymentStatus = "partial";
                      else if (s.paidAmount === 0 || s.paymentStatus === "debt") paymentStatus = "debt";

                      const statusStyle = {
                        paid: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
                        partial: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
                        debt: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
                        installment: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
                        cancelled: "bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-300",
                      }[paymentStatus];
                      const saleCost = getSaleCost(s);
                      const saleProfit = Number(s.total || 0) - saleCost;

                      return (
                        <tr key={s.id} className="hover:bg-pin-gray-50/50 dark:hover:bg-white/[0.02] transition-colors group">
                          <td className="px-5 py-4 align-middle">
                            <span className="text-xs font-bold text-pin-blue-600 dark:text-pin-blue-400 font-mono group-hover:underline cursor-pointer">{s.code || s.id.slice(0, 8)}</span>
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs font-medium text-pin-gray-700 dark:text-pin-gray-300">{new Date(s.date).toLocaleDateString('vi-VN')}</span>
                              <span className="text-[11px] text-pin-gray-400">{new Date(s.date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded bg-pin-gray-100 dark:bg-pin-gray-700 flex items-center justify-center text-[10px] font-bold text-pin-gray-500 shrinks-0">
                                {(s.customer?.name || "K").charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-medium text-pin-gray-800 dark:text-pin-gray-200">{s.customer?.name || "Khách lẻ"}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle">
                            <div className="max-w-[220px]">
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center justify-center bg-pin-gray-100 dark:bg-pin-gray-800 text-pin-gray-500 dark:text-pin-gray-400 text-[10px] font-bold px-1.5 rounded min-w-[20px] shrink-0">
                                  {(s.items || []).length}
                                </span>
                                <p className="text-xs text-pin-gray-600 dark:text-pin-gray-300 truncate" title={(s.items || []).map(it => `${it.name} x${it.quantity}`).join(", ")}>
                                  {(s.items || []).map((it: PinCartItem) => `${it.name}`).join(", ")}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle text-center">
                            <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${statusStyle}`}>
                              {paymentStatus === 'paid'
                                ? 'Hoàn tất'
                                : paymentStatus === 'partial'
                                  ? 'Cần trả'
                                  : paymentStatus === 'debt'
                                    ? 'Ghi nợ'
                                    : paymentStatus === 'installment'
                                      ? 'Trả góp'
                                      : 'Đã hủy'}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-middle text-right">
                            <span className="text-sm font-semibold text-pin-gray-900 dark:text-white">{formatCurrency(s.total)}</span>
                          </td>
                          <td className="px-5 py-4 align-middle text-right">
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-sm font-semibold ${saleProfit >= 0 ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                                {saleProfit > 0 ? "+" : ""}{formatCurrency(saleProfit)}
                              </span>
                              <div className="flex items-center gap-1" title={`Giá vốn: ${formatCurrency(saleCost)}`}>
                                {saleProfit >= 0 ? <ArrowTrendingUpIcon className="w-3 h-3 text-emerald-500/70" /> : null}
                                <span className={`text-[10px] font-medium ${saleProfit >= 0 ? "text-emerald-500/70" : "text-red-500/70"}`}>
                                  {Number(s.total) > 0 ? ((saleProfit / Number(s.total)) * 100).toFixed(0) : 0}%
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 align-middle text-right">
                            <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setInvoiceSaleData(s); setShowInvoicePreview(true); }} className="p-1.5 text-pin-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-md transition-all" title="In hóa đơn"><PrinterIcon className="w-4 h-4" /></button>
                              <button onClick={() => openEdit(s)} className="p-1.5 text-pin-gray-400 hover:text-pin-blue-600 hover:bg-pin-blue-50 dark:hover:bg-pin-blue-500/10 rounded-md transition-all" title="Sửa"><PencilSquareIcon className="w-4 h-4" /></button>
                              <button onClick={() => showConfirmDialog("Hủy hóa đơn", "Bạn có chắc chắn muốn hủy đơn này không?", () => deletePinSale(s.id))} className="p-1.5 text-pin-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-md transition-all" title="Hủy"><TrashIcon className="w-4 h-4" /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {isEditModalOpen && editingSale && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-pin-gray-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-4 border-b dark:border-pin-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-bold">Sửa hoá đơn</h3>
              <button onClick={() => setIsEditModalOpen(false)}>
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-sm font-medium">Ngày bán</label>
                <input
                  type="datetime-local"
                  value={
                    editingSale?.date ? new Date(editingSale.date).toISOString().slice(0, 16) : ""
                  }
                  onChange={(e) => {
                    if (editingSale) {
                      const newDate = new Date(e.target.value).toISOString();
                      setEditingSale({ ...editingSale, date: newDate });
                    }
                  }}
                  className="w-full p-2 border rounded-md bg-white dark:bg-pin-gray-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Giảm giá</label>
                <div className="flex mt-1">
                  <input
                    type="number"
                    value={editDiscount}
                    onChange={(e) => setEditDiscount(Number(e.target.value))}
                    min="0"
                    max={editDiscountType === "%" ? 100 : undefined}
                    className="flex-1 p-2 border rounded-l-md bg-white dark:bg-pin-gray-700 text-right"
                  />
                  <select
                    value={editDiscountType}
                    onChange={(e) => {
                      setEditDiscountType(e.target.value as "VND" | "%");
                      setEditDiscount(0);
                    }}
                    className="p-2 border-t border-r border-b rounded-r-md bg-white dark:bg-pin-gray-700"
                  >
                    <option value="VND">₫</option>
                    <option value="%">%</option>
                  </select>
                </div>
                {editDiscountType === "%" && editDiscount > 0 && editingSale && (
                  <p className="text-xs text-pin-gray-500 mt-1">
                    Số tiền giảm:{" "}
                    {formatCurrency(Math.round((editingSale.subtotal * editDiscount) / 100))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium">Phương thức</label>
                <div className="flex gap-2 mt-1">
                  <Button
                    variant={editPayment === "cash" ? "primary" : "secondary"}
                    onClick={() => setEditPayment("cash")}
                    className="flex-1"
                  >
                    Tiền mặt
                  </Button>
                  <Button
                    variant={editPayment === "bank" ? "primary" : "secondary"}
                    onClick={() => setEditPayment("bank")}
                    className="flex-1"
                  >
                    Chuyển khoản
                  </Button>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-4">
                <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
                  Hủy
                </Button>
                <Button variant="primary" onClick={saveEdit}>
                  Lưu
                </Button>
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

      {/* Invoice Preview Modal */}
      {showInvoicePreview && invoiceSaleData && (
        <InvoicePreviewModal
          isOpen={showInvoicePreview}
          onClose={() => setShowInvoicePreview(false)}
          title={`Hóa đơn bán hàng ${invoiceSaleData.code || ""}`}
        >
          <SalesInvoiceTemplate
            sale={invoiceSaleData}
            onClose={() => setShowInvoicePreview(false)}
          />
        </InvoicePreviewModal>
      )}

      {/* Payment Detail Modal */}
      {showPaymentDetail && paymentDetailSale && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-pin-gray-800 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Chi tiết thanh toán</h3>
              <button
                onClick={() => {
                  setShowPaymentDetail(false);
                  setPaymentDetailSale(null);
                }}
                className="text-white hover:bg-white/20 rounded-full p-1"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-pin-gray-50 dark:bg-pin-gray-700/50 p-4 rounded-xl">
                <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400 mb-1">Số phiếu</div>
                <div className="font-mono font-bold text-lg text-blue-600 dark:text-blue-400">
                  {paymentDetailSale.code || paymentDetailSale.id.slice(0, 8)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400 mb-1">Ngày bán</div>
                  <div className="text-sm font-medium">
                    {new Date(paymentDetailSale.date).toLocaleDateString("vi-VN")}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400 mb-1">Khách hàng</div>
                  <div className="text-sm font-medium">
                    {paymentDetailSale.customer?.name || "Khách lẻ"}
                  </div>
                </div>
              </div>

              <div className="border-t dark:border-pin-gray-600 pt-4">
                <div className="text-sm font-semibold mb-3">Thông tin thanh toán</div>

                {(paymentDetailSale.isInstallment || paymentDetailSale.installmentPlan) &&
                  paymentDetailSale.installmentPlan ? (
                  // Trả góp
                  <div className="space-y-3 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        Tổng đơn hàng
                      </span>
                      <span className="font-bold">{formatCurrency(paymentDetailSale.total)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">Trả trước</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(paymentDetailSale.installmentPlan.downPayment)}
                      </span>
                    </div>
                    <div className="border-t dark:border-purple-700/30 pt-2 flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        Còn phải trả (góp)
                      </span>
                      <span className="font-bold text-purple-600 dark:text-purple-400">
                        {formatCurrency(
                          paymentDetailSale.total - paymentDetailSale.installmentPlan.downPayment
                        )}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t dark:border-purple-700/30">
                      <div className="text-center">
                        <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400">Số kỳ</div>
                        <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                          {paymentDetailSale.installmentPlan.numberOfInstallments}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400">Lãi suất</div>
                        <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                          {paymentDetailSale.installmentPlan.interestRate}%
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-pin-gray-500 dark:text-pin-gray-400">Mỗi kỳ</div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(paymentDetailSale.installmentPlan.monthlyPayment)}
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t dark:border-purple-700/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Tiến độ thanh toán</span>
                        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                          {paymentDetailSale.installmentPlan.payments?.filter(
                            (p) => p.status === "paid"
                          ).length || 0}
                          /{paymentDetailSale.installmentPlan.numberOfInstallments} kỳ
                        </span>
                      </div>
                      <div className="w-full bg-pin-gray-200 dark:bg-pin-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${((paymentDetailSale.installmentPlan.payments?.filter((p) => p.status === "paid").length || 0) / paymentDetailSale.installmentPlan.numberOfInstallments) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t dark:border-purple-700/30">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">Còn lại</span>
                      <span className="font-bold text-lg text-rose-600 dark:text-rose-400">
                        {formatCurrency(paymentDetailSale.installmentPlan.remainingAmount || 0)}
                      </span>
                    </div>
                  </div>
                ) : paymentDetailSale.paidAmount !== undefined &&
                  paymentDetailSale.paidAmount > 0 &&
                  paymentDetailSale.paidAmount < paymentDetailSale.total ? (
                  // Trả 1 phần
                  <div className="space-y-3 bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        Tổng đơn hàng
                      </span>
                      <span className="font-bold">{formatCurrency(paymentDetailSale.total)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        Đã thanh toán
                      </span>
                      <span className="font-semibold text-green-600 dark:text-green-400">
                        {formatCurrency(paymentDetailSale.paidAmount)}
                      </span>
                    </div>
                    <div className="mt-2">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-pin-gray-500 dark:text-pin-gray-400">Tiến độ</span>
                        <span className="text-xs font-medium">
                          {Math.round(
                            (paymentDetailSale.paidAmount / paymentDetailSale.total) * 100
                          )}
                          %
                        </span>
                      </div>
                      <div className="w-full bg-pin-gray-200 dark:bg-pin-gray-700 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-yellow-500 to-yellow-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${(paymentDetailSale.paidAmount / paymentDetailSale.total) * 100}%`,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-3 pt-3 border-t dark:border-yellow-700/30">
                      <span className="text-sm font-medium text-pin-gray-600 dark:text-pin-gray-400">
                        Còn nợ
                      </span>
                      <span className="font-bold text-lg text-rose-600 dark:text-rose-400">
                        {formatCurrency(paymentDetailSale.total - paymentDetailSale.paidAmount)}
                      </span>
                    </div>
                    {paymentDetailSale.dueDate && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-pin-gray-500 dark:text-pin-gray-400">Hạn thanh toán</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400">
                          {new Date(paymentDetailSale.dueDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  // Công nợ (chưa trả gì)
                  <div className="space-y-3 bg-rose-50 dark:bg-rose-900/20 p-4 rounded-xl">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        Tổng đơn hàng
                      </span>
                      <span className="font-bold">{formatCurrency(paymentDetailSale.total)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t dark:border-rose-700/30">
                      <span className="text-sm font-medium text-pin-gray-600 dark:text-pin-gray-400">
                        Công nợ
                      </span>
                      <span className="font-bold text-lg text-rose-600 dark:text-rose-400">
                        {formatCurrency(paymentDetailSale.total)}
                      </span>
                    </div>
                    {paymentDetailSale.dueDate && (
                      <div className="flex justify-between items-center text-sm pt-2 border-t dark:border-rose-700/30">
                        <span className="text-pin-gray-500 dark:text-pin-gray-400">Hạn thanh toán</span>
                        <span className="font-medium text-orange-600 dark:text-orange-400">
                          {new Date(paymentDetailSale.dueDate).toLocaleDateString("vi-VN")}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="bg-pin-gray-50 dark:bg-pin-gray-900/50 px-6 py-4">
              <button
                onClick={() => {
                  setShowPaymentDetail(false);
                  setPaymentDetailSale(null);
                }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Installment Modal */}
      <InstallmentModal
        isOpen={showInstallmentModal}
        onClose={() => {
          setShowInstallmentModal(false);
          if (!installmentPlan) {
            setPaymentMode("full");
          }
        }}
        sale={{
          items: cartItems,
          subtotal,
          discount: discountAmount,
          total,
          customer: selectedCustomer
            ? {
              id: selectedCustomer.id,
              name: selectedCustomer.name,
              phone: selectedCustomer.phone,
              address: selectedCustomer.address,
            }
            : { name: customerSearch || "Khách lẻ" },
          paymentMethod: paymentMethod || "cash",
        }}
        total={total}
        initialDownPayment={installmentPlan?.downPayment}
        initialTerms={installmentPlan?.numberOfInstallments}
        initialInterestRate={installmentPlan?.interestRate}
        onConfirm={(plan, downPayment) => {
          setInstallmentPlan(plan);
          setPaidAmount(downPayment);
          setShowInstallmentModal(false);
        }}
      />

      {/* Confirm Dialog Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-pin-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-lg font-bold text-pin-gray-900 dark:text-white mb-4">
              {confirmDialog.title}
            </h3>
            <p className="text-pin-gray-600 dark:text-pin-gray-300 mb-6 whitespace-pre-line">
              {confirmDialog.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={closeConfirmDialog}
                className="px-4 py-2 bg-pin-gray-200 dark:bg-pin-gray-700 text-pin-gray-700 dark:text-pin-gray-300 rounded-lg hover:bg-pin-gray-300 dark:hover:bg-pin-gray-600 transition"
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
    </>
  );
};

export default PinSalesManager;
