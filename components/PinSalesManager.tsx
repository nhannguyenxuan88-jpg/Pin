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

  const [invoiceInventoryLogs, setInvoiceInventoryLogs] = useState<{
    isLoading: boolean;
    error: string | null;
    materials: Array<{ name: string; sku?: string; quantity: number }>;
    products: Array<{ name: string; sku?: string; quantity: number }>;
  } | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!showInvoicePreview || !invoiceSaleData) return;

      const invNo = invoiceSaleData.code || invoiceSaleData.id;
      setInvoiceInventoryLogs({
        isLoading: true,
        error: null,
        materials: [],
        products: [],
      });

      try {
        const matById = new Map((pinMaterials || []).map((m: PinMaterial) => [m.id, m]));
        const prodById = new Map((products || []).map((p: PinProduct) => [p.id, p]));

        const [matRes, prodRes] = await Promise.all([
          supabase
            .from("pin_stock_history")
            .select("material_id, quantity_change, transaction_type, invoice_number")
            .eq("invoice_number", invNo)
            .eq("transaction_type", "export"),
          supabase
            .from("pin_product_stock_history")
            .select("product_id, quantity_change, transaction_type, invoice_number")
            .eq("invoice_number", invNo)
            .eq("transaction_type", "export"),
        ]);

        // If product history table doesn't exist yet, ignore.
        const prodMissingTable =
          !!prodRes.error && /does not exist|42P01/i.test(prodRes.error.message || "");
        const matMissingTable =
          !!matRes.error && /does not exist|42P01/i.test(matRes.error.message || "");

        const materials: Array<{ name: string; sku?: string; quantity: number }> = [];
        if (!matRes.error && Array.isArray(matRes.data)) {
          for (const row of matRes.data as any[]) {
            const id = row.material_id;
            const m = id ? matById.get(id) : undefined;
            const qty = Math.abs(Number(row.quantity_change ?? 0));
            if (qty <= 0) continue;
            materials.push({
              name: m?.name || id || "(Không rõ)",
              sku: m?.sku,
              quantity: qty,
            });
          }
        }

        const productsOut: Array<{ name: string; sku?: string; quantity: number }> = [];
        if (!prodRes.error && Array.isArray(prodRes.data)) {
          for (const row of prodRes.data as any[]) {
            const id = row.product_id;
            const p = id ? prodById.get(id) : undefined;
            const qty = Math.abs(Number(row.quantity_change ?? 0));
            if (qty <= 0) continue;
            productsOut.push({
              name: p?.name || id || "(Không rõ)",
              sku: p?.sku,
              quantity: qty,
            });
          }
        }

        const errors: string[] = [];
        if (matRes.error && !matMissingTable) errors.push(matRes.error.message);
        if (prodRes.error && !prodMissingTable) errors.push(prodRes.error.message);

        setInvoiceInventoryLogs({
          isLoading: false,
          error: errors.length ? errors.join(" | ") : null,
          materials,
          products: productsOut,
        });
      } catch (e: any) {
        setInvoiceInventoryLogs({
          isLoading: false,
          error: e?.message || String(e),
          materials: [],
          products: [],
        });
      }
    };

    run();
  }, [showInvoicePreview, invoiceSaleData, pinMaterials, products]);

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

  // Custom Date/Time State
  const [saleDate, setSaleDate] = useState<string>(() => new Date().toISOString().split("T")[0]);
  const [saleTime, setSaleTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  });

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

          return shouldUpdate ? { ...item, quantity: Math.max(0, quantity) } : item;
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
      date: new Date(`${saleDate}T${saleTime}:00`).toISOString(),
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

    // Reset date/time to now
    const now = new Date();
    setSaleDate(now.toISOString().split("T")[0]);
    setSaleTime(
      `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    );
  };

  // Sales history list (recent 50)
  const recentSales = useMemo(() => (pinSales || []).slice(0, 50), [pinSales]);
  const [editingSale, setEditingSale] = useState<PinSale | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Load installment plans for sales
  const [installmentPlans, setInstallmentPlans] = useState<InstallmentPlan[]>([]);
  useEffect(() => {
    InstallmentService.getAllInstallmentPlans().then((plans) => {
      setInstallmentPlans(plans);
    });
  }, [pinSales]);

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
      {/* Mobile-optimized Tab Navigation */}
      <div className="mb-3 md:mb-4 rounded-lg bg-white/70 dark:bg-pin-gray-800/70 border border-pin-gray-200/70 dark:border-pin-gray-700/60 px-2">
        <nav className="flex space-x-4 md:space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("pos")}
            className={`py-2 md:py-3 px-1 font-medium text-xs md:text-sm ${activeTab === "pos"
              ? "text-pin-gray-900 dark:text-white"
              : "text-pin-gray-500 dark:text-pin-gray-400 hover:text-pin-gray-700 dark:hover:text-pin-gray-200"
              }`}
          >
            🛒 Bán hàng
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`py-2 md:py-3 px-1 font-medium text-xs md:text-sm ${activeTab === "history"
              ? "text-pin-gray-900 dark:text-white"
              : "text-pin-gray-500 dark:text-pin-gray-400 hover:text-pin-gray-700 dark:hover:text-pin-gray-200"
              }`}
          >
            📋 Lịch sử
          </button>
        </nav>
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
            {/* Compact Search for mobile */}
            <input
              type="text"
              placeholder="🔍 Tìm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full p-2 text-sm border border-pin-gray-300 dark:border-pin-gray-600 rounded-lg mb-2 bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 focus:ring-2 focus:ring-pin-blue-500 focus:border-transparent"
            />

            {/* Category Filter - Compact on mobile */}
            <div className="flex gap-2 mb-2 overflow-x-auto pb-1 scrollbar-hide">
              <button
                onClick={() => setSalesCategory("all")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap ${salesCategory === "all"
                  ? "bg-pin-gray-900 text-white dark:bg-pin-gray-100 dark:text-pin-gray-900"
                  : "bg-pin-gray-100 text-pin-gray-600 dark:bg-pin-gray-700 dark:text-pin-gray-300"
                  }`}
              >
                Tất cả ({availableItems.length})
              </button>
              <button
                onClick={() => setSalesCategory("products")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap ${salesCategory === "products"
                  ? "bg-pin-gray-900 text-white dark:bg-pin-gray-100 dark:text-pin-gray-900"
                  : "bg-pin-gray-100 text-pin-gray-600 dark:bg-pin-gray-700 dark:text-pin-gray-300"
                  }`}
              >
                📱 TP ({products.filter((p) => p.stock > 0).length})
              </button>
              <button
                onClick={() => setSalesCategory("materials")}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors whitespace-nowrap ${salesCategory === "materials"
                  ? "bg-pin-gray-900 text-white dark:bg-pin-gray-100 dark:text-pin-gray-900"
                  : "bg-pin-gray-100 text-pin-gray-600 dark:bg-pin-gray-700 dark:text-pin-gray-300"
                  }`}
              >
                📦 NVL ({(pinMaterials || []).filter((m: PinMaterial) => (m.stock || 0) > 0).length}
                )
              </button>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 -mr-1 pb-24 md:pb-0">
              {availableProducts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-3">
                  {availableProducts.map((product: PinProduct & { type?: string }) => (
                    <div
                      key={product.id}
                      className="bg-white dark:bg-pin-gray-800 p-2 md:p-3 rounded-lg border border-pin-gray-200 dark:border-pin-gray-700 hover:border-pin-blue-500 dark:hover:border-pin-blue-400 hover:shadow-md transition-all duration-150"
                    >
                      {/* Mobile: Single row layout */}
                      <div className="md:hidden flex items-center gap-2">
                        {/* Type badge */}
                        <span
                          className={`w-6 h-6 flex items-center justify-center text-xs rounded flex-shrink-0 ${(product as any).type === "material"
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                            : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                            }`}
                        >
                          {(product as any).type === "material" ? "📦" : "📱"}
                        </span>

                        {/* Name + Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-pin-gray-800 dark:text-pin-gray-100 text-sm truncate">
                            {product.name}
                          </h3>
                          <div className="flex items-center gap-3 text-xs text-pin-gray-500">
                            <span className="font-semibold text-amber-600 dark:text-amber-400">
                              {formatCurrency(
                                (product as any).retailPrice ?? product.sellingPrice ?? 0
                              )}
                            </span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-medium ${product.stock === 0
                                ? "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                                : product.stock <= 5
                                  ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-pin-gray-100 text-pin-gray-600 dark:bg-pin-gray-700 dark:text-pin-gray-300"
                                }`}
                            >
                              {product.stock === 0 ? "Hết" : `Kho: ${product.stock}`}
                            </span>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-1 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product, "retail");
                            }}
                            className="bg-emerald-500 active:bg-emerald-600 text-white rounded px-2.5 py-1.5 text-xs font-medium"
                          >
                            +Lẻ
                          </button>
                          {((product as any).wholesalePrice || 0) > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, "wholesale");
                              }}
                              className="bg-pin-blue-500 active:bg-pin-blue-600 text-white rounded px-2.5 py-1.5 text-xs font-medium"
                            >
                              +Sỉ
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Desktop: Original card layout */}
                      <div className="hidden md:block">
                        {/* Header with name and type badge */}
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <h3 className="font-medium text-pin-gray-800 dark:text-pin-gray-100 text-sm leading-tight flex-1 line-clamp-2">
                            {product.name}
                          </h3>
                          <span
                            className={`px-1 py-0.5 text-[10px] font-medium rounded flex-shrink-0 ${(product as any).type === "material"
                              ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                              }`}
                          >
                            {(product as any).type === "material" ? "📦" : "📱"}
                          </span>
                        </div>

                        {/* SKU */}
                        <p className="text-[10px] font-mono text-pin-gray-500 dark:text-pin-gray-400 mb-2 bg-pin-gray-50 dark:bg-pin-gray-700/50 px-1.5 py-0.5 rounded truncate">
                          {product.sku}
                        </p>

                        {/* Price and Stock */}
                        <div className="space-y-0.5 mb-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-pin-gray-500">Giá</span>
                            <span className="font-semibold text-pin-gray-800 dark:text-pin-gray-100 text-xs">
                              {formatCurrency(
                                (product as any).retailPrice ?? product.sellingPrice ?? 0
                              )}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-pin-gray-500">Kho</span>
                            <span className="font-medium text-pin-gray-700 dark:text-pin-gray-300 text-xs">
                              {product.stock}
                            </span>
                          </div>
                        </div>

                        {/* Add buttons */}
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addToCart(product, "retail");
                            }}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded px-1.5 py-1.5 flex items-center justify-center gap-0.5 transition-colors text-xs font-medium"
                          >
                            <PlusIcon className="w-3 h-3" />
                            <span>Lẻ</span>
                          </button>
                          {((product as any).wholesalePrice || 0) > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                addToCart(product, "wholesale");
                              }}
                              className="flex-1 bg-pin-blue-500 hover:bg-pin-blue-600 text-white rounded px-1.5 py-1.5 flex items-center justify-center gap-0.5 transition-colors text-xs font-medium"
                            >
                              <PlusIcon className="w-3 h-3" />
                              <span>Sỉ</span>
                            </button>
                          )}
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
                {/* 0. Sale Date/Time - Styled */}
                <div className="mb-4 p-4 bg-pin-gray-50 dark:bg-pin-gray-700/30 rounded-xl border border-pin-gray-200 dark:border-pin-gray-700/50">
                  <div className="flex gap-4">
                    {/* Date Picker */}
                    <div className="flex-1 group">
                      <label className="block text-xs font-semibold text-pin-gray-500 dark:text-pin-gray-400 mb-1.5 uppercase tracking-wider">
                        Ngày bán
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 text-pin-gray-400 group-focus-within:text-pin-blue-500 transition-colors pointer-events-none">
                          <CalendarIcon className="w-5 h-5" />
                        </div>
                        <input
                          type="date"
                          value={saleDate}
                          onChange={(e) => setSaleDate(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-600 rounded-lg text-sm font-medium text-pin-gray-700 dark:text-pin-gray-200 focus:ring-2 focus:ring-pin-blue-500/20 focus:border-pin-blue-500 transition-all shadow-sm group-hover:border-pin-gray-300 dark:group-hover:border-pin-gray-500"
                        />
                      </div>
                    </div>

                    {/* Time Picker */}
                    <div className="w-1/3 group">
                      <label className="block text-xs font-semibold text-pin-gray-500 dark:text-pin-gray-400 mb-1.5 uppercase tracking-wider">
                        Giờ
                      </label>
                      <div className="relative flex items-center">
                        <div className="absolute left-3 text-pin-gray-400 group-focus-within:text-pin-blue-500 transition-colors pointer-events-none">
                          <ClockIcon className="w-5 h-5" />
                        </div>
                        <input
                          type="time"
                          value={saleTime}
                          onChange={(e) => setSaleTime(e.target.value)}
                          className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-600 rounded-lg text-sm font-medium text-pin-gray-700 dark:text-pin-gray-200 focus:ring-2 focus:ring-pin-blue-500/20 focus:border-pin-blue-500 transition-all shadow-sm group-hover:border-pin-gray-300 dark:group-hover:border-pin-gray-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div ref={customerInputRef} className="pb-4 border-b border-pin-gray-200 dark:border-pin-gray-700">
                  <label className="block text-sm font-semibold text-pin-gray-700 dark:text-pin-gray-300 mb-2">
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
                          <XMarkIcon className="w-4 h-4" />
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
                          className="w-full pl-10 pr-4 py-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-l-md bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        />

                        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                          <MagnifyingGlassIcon className="w-5 h-5 text-pin-gray-400" />
                        </div>
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
                        className={`px-4 py-2 border-t border-b border-r rounded-r-md h-[42px] flex items-center justify-center transition-colors ${currentUser
                          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-800 border-blue-300 dark:border-blue-600"
                          : "bg-pin-gray-200 dark:bg-pin-gray-700 text-pin-gray-400 cursor-not-allowed border-pin-gray-300 dark:border-pin-gray-600"
                          }`}
                      >
                        <PlusIcon className="w-4 h-4" />
                      </button>
                    </div>
                    {isCustomerListOpen && (customerSearch || filteredCustomers.length > 0) && (
                      <div className="absolute bottom-full mb-2 z-20 w-full bg-white dark:bg-pin-gray-800 border border-pin-gray-200 dark:border-pin-gray-600 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                        <div className="p-2 border-b border-pin-gray-100 dark:border-pin-gray-700 bg-pin-gray-50 dark:bg-pin-gray-700/50">
                          <p className="text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400">
                            📋 Danh bạ khách hàng ({filteredCustomers.length} kết quả)
                          </p>
                        </div>

                        {filteredCustomers.length > 0 ? (
                          <div className="max-h-48 overflow-y-auto">
                            {filteredCustomers.map((c, index) => (
                              <div
                                key={c.id}
                                onClick={() => handleSelectCustomer(c)}
                                className={`p-3 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer border-b border-pin-gray-100 dark:border-pin-gray-700 transition-colors group ${index === filteredCustomers.length - 1 ? "border-b-0" : ""
                                  }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex-1">
                                    <p className="font-semibold text-pin-gray-800 dark:text-pin-gray-200 text-sm group-hover:text-blue-700 dark:group-hover:text-blue-300">
                                      👤 {c.name}
                                    </p>
                                    <div className="mt-1 space-y-1">
                                      <p className="text-xs text-pin-gray-600 dark:text-pin-gray-400 flex items-center gap-1">
                                        📞 {c.phone}
                                      </p>
                                      {c.address && (
                                        <p className="text-xs text-pin-gray-600 dark:text-pin-gray-400 flex items-center gap-1">
                                          📍 {c.address}
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center">
                                    <ChevronRightIcon className="w-4 h-4 text-pin-gray-400 group-hover:text-blue-500" />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-6 text-center">
                            <div className="text-pin-gray-400 mb-2">
                              <UsersIcon className="w-12 h-12 mx-auto" />
                            </div>
                            <p className="text-sm font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                              Không tìm thấy khách hàng
                            </p>
                            <p className="text-xs text-pin-gray-500 dark:text-pin-gray-500">
                              Thử tìm với từ khóa khác hoặc thêm khách hàng mới
                            </p>
                            <button
                              onClick={() => {
                                setIsNewCustomerModalOpen(true);
                                setIsCustomerListOpen(false);
                              }}
                              disabled={!currentUser}
                              className="mt-3 px-3 py-1.5 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 disabled:bg-pin-gray-300 disabled:cursor-not-allowed transition-colors"
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
                      className="flex-1 px-3 py-2 text-xs bg-pin-gray-100 dark:bg-pin-gray-700 text-pin-gray-600 dark:text-pin-gray-300 rounded-lg hover:bg-pin-gray-200 dark:hover:bg-pin-gray-600 transition-colors flex items-center justify-center gap-2 border border-pin-gray-200 dark:border-pin-gray-600"
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
              </div>

              {/* 2. Cart Items List - Compact */}
              {cartItems.length > 0 && (
                <div className="space-y-1.5 mb-3 pb-3 border-b border-pin-gray-200 dark:border-pin-gray-700">
                  <p className="text-sm font-semibold text-pin-gray-700 dark:text-pin-gray-300 mb-1.5">
                    🛒 Sản phẩm trong giỏ:
                  </p>
                  <div className="space-y-1.5">
                    {cartItems.map((item) => (
                      <div
                        key={`${item.productId}-${item.priceType || "retail"}`}
                        className="bg-pin-gray-50 dark:bg-pin-gray-700/50 rounded-lg p-2"
                      >
                        {/* Row 1: Name + Price Type */}
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="font-medium text-pin-gray-800 dark:text-pin-gray-100 text-sm leading-tight">
                            {item.name}
                          </span>
                          <span
                            className={`flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded ${item.priceType === "wholesale"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                              : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                              }`}
                          >
                            {item.priceType === "wholesale" ? "Sỉ" : "Lẻ"}
                          </span>
                        </div>
                        {/* Row 2: Price calculation + Quantity controls */}
                        <div className="flex items-center justify-between mt-2 pl-2 border-l-2 border-pin-gray-200 dark:border-pin-gray-600">
                          <div className="flex flex-col items-start gap-1">
                            <div className="flex items-baseline gap-1">
                              <span className="text-xs text-pin-gray-400">Giá:</span>
                              <SmartPriceInput
                                value={item.sellingPrice}
                                onUpdate={(val) => updatePrice(item.productId, val, item.priceType)}
                                priceType={item.priceType || 'retail'}
                              />
                            </div>
                            <span className="text-[10px] text-pin-gray-400">
                              Thành tiền: <span className="font-semibold text-orange-600 dark:text-orange-400">{formatCurrency(item.sellingPrice * item.quantity)}</span>
                            </span>
                          </div>
                          <div className="flex items-center gap-1 bg-pin-gray-100 dark:bg-pin-gray-800 rounded-lg p-1">
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity - 1, item.priceType)
                              }
                              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-pin-gray-700 rounded-md shadow-sm text-pin-gray-600 dark:text-pin-gray-300 hover:text-red-500 active:scale-95 transition-all"
                            >
                              <MinusIcon className="w-4 h-4" />
                            </button>
                            <input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 1;
                                updateQuantity(item.productId, newQty, item.priceType);
                              }}
                              className="w-10 text-center text-sm font-bold bg-transparent border-none p-0 focus:ring-0 text-pin-gray-800 dark:text-pin-gray-200"
                            />
                            <button
                              onClick={() =>
                                updateQuantity(item.productId, item.quantity + 1, item.priceType)
                              }
                              className="w-8 h-8 flex items-center justify-center bg-white dark:bg-pin-gray-700 rounded-md shadow-sm text-pin-gray-600 dark:text-pin-gray-300 hover:text-green-500 active:scale-95 transition-all"
                            >
                              <PlusIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Order Summary */}
              <div className="bg-pin-gray-50 dark:bg-pin-gray-800/50 p-4 rounded-lg space-y-3">
                <h3 className="font-semibold text-pin-gray-700 dark:text-pin-gray-300 text-sm mb-3">
                  📋 Tổng kết đơn hàng
                </h3>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-pin-gray-600 dark:text-pin-gray-400">
                    Tạm tính ({cartItems.reduce((sum, item) => sum + item.quantity, 0)} sản phẩm)
                  </span>
                  <span className="font-medium text-pin-gray-800 dark:text-pin-gray-200">
                    {formatCurrency(subtotal)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-pin-gray-600 dark:text-pin-gray-400">💰 Giảm giá</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discount || ""}
                      onChange={(e) => setDiscount(Number(e.target.value))}
                      placeholder="0"
                      min="0"
                      max={discountType === "%" ? 100 : undefined}
                      className="w-20 p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-l-md text-right bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 text-sm"
                    />
                    <select
                      value={discountType}
                      onChange={(e) => {
                        setDiscountType(e.target.value as "VND" | "%");
                        setDiscount(0); // Reset discount when changing type
                      }}
                      className="p-2 border-t border-r border-b border-pin-gray-300 dark:border-pin-gray-600 rounded-r-md bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 text-sm"
                    >
                      <option value="VND">₫</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-pin-gray-500 dark:text-pin-gray-500 text-xs">Số tiền giảm</span>
                    <span className="text-red-600 dark:text-red-400 font-medium">
                      -{formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}

                <div className="border-t border-pin-gray-200 dark:border-pin-gray-600 pt-3 mt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-lg text-pin-gray-800 dark:text-pin-gray-200">
                      Tổng cộng
                    </span>
                    <span className="font-bold text-xl text-orange-600 dark:text-orange-400">
                      {formatCurrency(total)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="space-y-3 pb-4 md:pb-0">
                <label className="block text-xs font-bold text-pin-gray-500 dark:text-pin-gray-400 uppercase tracking-wider mb-3">
                  Phương thức thanh toán
                </label>
                <div className="grid grid-cols-2 gap-3 p-1 bg-pin-gray-100 dark:bg-pin-gray-700/50 rounded-xl">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all text-sm font-semibold relative overflow-hidden ${paymentMethod === "cash"
                      ? "bg-white dark:bg-pin-gray-600 text-green-600 dark:text-green-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-pin-gray-500 dark:text-pin-gray-400 hover:bg-white/50 dark:hover:bg-pin-gray-700"
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-1 ${paymentMethod === "cash" ? "bg-green-100 dark:bg-green-900/30" : "bg-pin-gray-200 dark:bg-pin-gray-700"}`}>
                      <BanknotesIcon className="w-4 h-4" />
                    </div>
                    Tiền mặt
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-2 py-3 rounded-lg transition-all text-sm font-semibold relative overflow-hidden ${paymentMethod === "bank"
                      ? "bg-white dark:bg-pin-gray-600 text-blue-600 dark:text-blue-400 shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                      : "text-pin-gray-500 dark:text-pin-gray-400 hover:bg-white/50 dark:hover:bg-pin-gray-700"
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center mr-1 ${paymentMethod === "bank" ? "bg-blue-100 dark:bg-blue-900/30" : "bg-pin-gray-200 dark:bg-pin-gray-700"}`}>
                      <span className="text-xs font-bold">🏦</span>
                    </div>
                    Chuyển khoản
                  </button>
                </div>

                {/* Payment Mode - Only show when payment method is selected */}
                {paymentMethod && (
                  <div className="mt-3 pt-3 border-t border-pin-gray-200 dark:border-pin-gray-700">
                    <label className="block text-sm font-semibold text-pin-gray-700 dark:text-pin-gray-300 mb-2">
                      📌 Hình thức
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      <button
                        onClick={() => setPaymentMode("full")}
                        className={`p-2 border-2 rounded-lg text-xs font-medium text-center ${paymentMode === "full"
                          ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          : "border-pin-gray-300 dark:border-pin-gray-600 hover:border-emerald-300 dark:hover:border-emerald-600"
                          }`}
                      >
                        Đủ
                      </button>
                      <button
                        onClick={() => {
                          setPaymentMode("partial");
                          setPaidAmount((prev) => (prev > 0 ? prev : total));
                        }}
                        className={`p-2 border-2 rounded-lg text-xs font-medium text-center ${paymentMode === "partial"
                          ? "border-amber-500 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "border-pin-gray-300 dark:border-pin-gray-600 hover:border-amber-300 dark:hover:border-amber-600"
                          }`}
                      >
                        1 phần
                      </button>
                      <button
                        onClick={() => {
                          setPaymentMode("debt");
                          setPaidAmount(0);
                        }}
                        className={`p-2 border-2 rounded-lg text-xs font-medium text-center ${paymentMode === "debt"
                          ? "border-red-500 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                          : "border-pin-gray-300 dark:border-pin-gray-600 hover:border-red-300 dark:hover:border-red-600"
                          }`}
                      >
                        Ghi nợ
                      </button>
                      <button
                        onClick={() => {
                          if (!selectedCustomer) {
                            showToast("Vui lòng chọn khách hàng trước khi trả góp!", "warn");
                            return;
                          }
                          setPaymentMode("installment");
                          setShowInstallmentModal(true);
                        }}
                        className={`p-2 border-2 rounded-lg text-xs font-medium text-center ${paymentMode === "installment"
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "border-pin-gray-300 dark:border-pin-gray-600 hover:border-purple-300 dark:hover:border-purple-600"
                          }`}
                      >
                        Trả góp
                      </button>
                    </div>

                    {paymentMode === "partial" && (
                      <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <label className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                          Số tiền khách trả
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={1}
                            max={total - 1}
                            value={paidAmount || ""}
                            onChange={(e) => setPaidAmount(Number(e.target.value || 0))}
                            className="flex-1 md:w-36 p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-right bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 text-sm"
                          />
                          <span className="text-xs text-pin-gray-500 whitespace-nowrap">
                            Còn: {formatCurrency(Math.max(0, total - (paidAmount || 0)))}
                          </span>
                        </div>
                      </div>
                    )}
                    {paymentMode === "debt" && (
                      <div className="mt-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <label className="text-sm text-pin-gray-600 dark:text-pin-gray-400">
                          Hạn thanh toán
                        </label>
                        <input
                          type="date"
                          value={dueDate}
                          onChange={(e) => setDueDate(e.target.value)}
                          className="p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100 text-sm [color-scheme:light] dark:[color-scheme:dark]"
                        />
                      </div>
                    )}
                    {paymentMode === "installment" && installmentPlan && (
                      <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-semibold text-purple-700 dark:text-purple-300">
                            📅 Kế hoạch trả góp
                          </span>
                          <button
                            onClick={() => setShowInstallmentModal(true)}
                            className="text-xs text-purple-600 hover:text-purple-800 underline"
                          >
                            Sửa
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>
                            <span className="text-pin-gray-500">Trả trước:</span>{" "}
                            <span className="font-medium text-green-600">
                              {formatCurrency(installmentPlan.downPayment)}
                            </span>
                          </div>
                          <div>
                            <span className="text-pin-gray-500">Số kỳ:</span>{" "}
                            <span className="font-medium">
                              {installmentPlan.numberOfInstallments} tháng
                            </span>
                          </div>
                          <div>
                            <span className="text-pin-gray-500">Mỗi tháng:</span>{" "}
                            <span className="font-medium text-red-600">
                              {formatCurrency(installmentPlan.monthlyPayment)}
                            </span>
                          </div>
                          <div>
                            <span className="text-pin-gray-500">Tổng trả:</span>{" "}
                            <span className="font-medium">
                              {formatCurrency(
                                installmentPlan.remainingAmount + installmentPlan.downPayment
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Delivery Section */}
              <div className="space-y-3 pt-3 border-t border-pin-gray-200 dark:border-pin-gray-700">
                <label className="block text-sm font-semibold text-pin-gray-700 dark:text-pin-gray-300">
                  🚚 Giao hàng
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      setDeliveryMethod('pickup');
                      setDeliveryAddress('');
                      setDeliveryPhone('');
                      setDeliveryNote('');
                      setShippingFee(0);
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 border-2 rounded-lg transition-all text-sm ${deliveryMethod === 'pickup'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 shadow-md'
                      : 'border-pin-gray-300 dark:border-pin-gray-600 hover:border-blue-300 dark:hover:border-blue-600'
                      }`}
                  >
                    <span className="text-base">🏪</span>
                    <span className="font-medium">Tự lấy</span>
                  </button>
                  <button
                    onClick={() => {
                      setDeliveryMethod('delivery');
                      // Auto-fill from selected customer
                      if (selectedCustomer) {
                        setDeliveryAddress(selectedCustomer.address || '');
                        setDeliveryPhone(selectedCustomer.phone || '');
                      }
                    }}
                    className={`flex items-center justify-center gap-2 p-2.5 border-2 rounded-lg transition-all text-sm ${deliveryMethod === 'delivery'
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 shadow-md'
                      : 'border-pin-gray-300 dark:border-pin-gray-600 hover:border-orange-300 dark:hover:border-orange-600'
                      }`}
                  >
                    <span className="text-base">🚚</span>
                    <span className="font-medium">Giao hàng</span>
                  </button>
                </div>

                {deliveryMethod === 'delivery' && (
                  <div className="mt-3 space-y-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-700">
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        Địa chỉ giao hàng *
                      </label>
                      <input
                        type="text"
                        value={deliveryAddress}
                        onChange={(e) => setDeliveryAddress(e.target.value)}
                        placeholder="Nhập địa chỉ giao hàng"
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        SĐT nhận hàng
                      </label>
                      <input
                        type="text"
                        value={deliveryPhone}
                        onChange={(e) => setDeliveryPhone(e.target.value)}
                        placeholder={selectedCustomer?.phone || "Số điện thoại"}
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        Đơn vị vận chuyển
                      </label>
                      <select
                        value={shippingCarrier}
                        onChange={(e) => setShippingCarrier(e.target.value)}
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      >
                        <option value="">-- Chọn đơn vị --</option>
                        <option value="GHN">Giao Hàng Nhanh (GHN)</option>
                        <option value="GHTK">Giao Hàng Tiết Kiệm (GHTK)</option>
                        <option value="VNPost">VNPost</option>
                        <option value="J&T">J&T Express</option>
                        <option value="ViettelPost">Viettel Post</option>
                        <option value="BestExpress">Best Express</option>
                        <option value="NinjaVan">Ninja Van</option>
                        <option value="ShopeeExpress">Shopee Express</option>
                        <option value="Other">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        Mã vận đơn
                      </label>
                      <input
                        type="text"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="Nhập mã vận đơn (nếu có)"
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        Phí ship
                      </label>
                      <input
                        type="number"
                        value={shippingFee || ''}
                        onChange={(e) => setShippingFee(Number(e.target.value) || 0)}
                        placeholder="0"
                        min="0"
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-pin-gray-600 dark:text-pin-gray-400 mb-1">
                        Ghi chú
                      </label>
                      <textarea
                        value={deliveryNote}
                        onChange={(e) => setDeliveryNote(e.target.value)}
                        placeholder="Ghi chú giao hàng (tùy chọn)"
                        rows={2}
                        className="w-full p-2 border border-pin-gray-300 dark:border-pin-gray-600 rounded-md text-sm bg-white dark:bg-pin-gray-700 text-pin-gray-900 dark:text-pin-gray-100"
                      />
                    </div>
                    {shippingFee > 0 && (
                      <div className="flex justify-between items-center text-sm pt-2 border-t border-orange-200 dark:border-orange-700">
                        <span className="text-pin-gray-600 dark:text-pin-gray-400">Tổng + phí ship:</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">
                          {formatCurrency(total + shippingFee)}
                        </span>
                      </div>
                    )}
                    {deliveryMethod === 'delivery' && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-pin-gray-600 dark:text-pin-gray-400">COD cần thu:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(total + shippingFee - (paymentMode === 'full' ? total : (paidAmount || 0)))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Checkout Options */}
              <div className="bg-pin-gray-50 dark:bg-pin-gray-800/50 p-3 rounded-lg">
                <label className="flex items-center text-sm text-pin-gray-700 dark:text-pin-gray-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={printReceipt}
                    onChange={(e) => setPrintReceipt(e.target.checked)}
                    className="mr-2 h-4 w-4 rounded text-orange-600 focus:ring-orange-500 focus:ring-2"
                  />
                  <span className="flex items-center gap-1.5">
                    🖨️ <span className="text-xs md:text-sm">In hóa đơn sau khi thanh toán</span>
                  </span>
                </label>
              </div>

              {/* Final Checkout Button - With bottom padding for mobile */}
              <div className="pb-20 md:pb-0">
                <button
                  onClick={finalizeSale}
                  disabled={
                    !currentUser ||
                    cartItems.length === 0 ||
                    (paymentMode === "partial" && !(paidAmount > 0 && paidAmount < total))
                  }
                  title={
                    !currentUser
                      ? "Bạn phải đăng nhập để thực hiện thanh toán"
                      : cartItems.length === 0
                        ? "Giỏ hàng trống"
                        : "Hoàn tất thanh toán"
                  }
                  className={`w-full font-semibold py-3 md:py-4 rounded-lg text-base md:text-lg flex items-center justify-center gap-2 transition-all ${!currentUser ||
                    cartItems.length === 0 ||
                    (paymentMode === "partial" && !(paidAmount > 0 && paidAmount < total))
                    ? "bg-pin-gray-300 dark:bg-pin-gray-600 text-pin-gray-500 dark:text-pin-gray-400 cursor-not-allowed"
                    : "bg-pin-gray-900 text-white hover:bg-pin-gray-800"
                    }`}
                >
                  {!currentUser ? (
                    <>Đăng nhập</>
                  ) : cartItems.length === 0 ? (
                    <>Giỏ hàng trống</>
                  ) : paymentMode === "partial" ? (
                    <>
                      Thanh {formatCurrency(Math.min(paidAmount || 0, total))} • Nợ{" "}
                      {formatCurrency(Math.max(0, total - (paidAmount || 0)))}{" "}
                    </>
                  ) : paymentMode === "debt" ? (
                    <>Ghi nợ {formatCurrency(total)}</>
                  ) : (
                    <>Thanh toán {formatCurrency(total)}</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="bg-white dark:bg-pin-gray-800 rounded-lg border border-pin-gray-200/60 dark:border-pin-gray-700 p-3 md:p-4">
          <h3 className="text-base md:text-lg font-bold mb-3 md:mb-4">
            Lịch sử bán hàng (50 gần nhất)
          </h3>

          {/* Mobile view - Cards */}
          <div className="md:hidden space-y-2">
            {recentSales.length === 0 && (
              <div className="p-4 text-center text-pin-gray-500">Chưa có hoá đơn nào.</div>
            )}
            {recentSales.map((s: PinSale) => {
              // Tìm installment plan từ database nếu có
              const linkedPlan = installmentPlans.find((p) => p.saleId === s.id);
              const actualInstallmentPlan = s.installmentPlan || linkedPlan;

              // Xác định trạng thái thanh toán từ dữ liệu thực tế
              let paymentStatus: "paid" | "partial" | "debt" | "installment";

              // Ưu tiên check installment trước
              if (s.isInstallment || actualInstallmentPlan) {
                paymentStatus = "installment";
              }
              // Heuristic: Nếu đã trả 1 phần (20-80% tổng tiền) và paymentStatus trong DB là "installment",
              // hoặc có code chứa "INST" thì coi như trả góp
              else if (
                s.paidAmount !== undefined &&
                s.paidAmount > 0 &&
                s.paidAmount < s.total &&
                (s.paymentStatus === "installment" || (s.code && s.code.includes("INST")))
              ) {
                paymentStatus = "installment";
              } else if (s.paidAmount !== undefined && s.paidAmount > 0 && s.paidAmount < s.total) {
                paymentStatus = "partial";
              } else if (s.paidAmount === 0 || s.paymentStatus === "debt") {
                paymentStatus = "debt";
              } else {
                paymentStatus = "paid";
              }

              const statusConfig = {
                paid: {
                  label: "Đã thanh toán",
                  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                },
                partial: {
                  label: `Trả ${formatCurrency(s.paidAmount || 0)}/${formatCurrency(s.total)}`,
                  color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                  detail: `Còn nợ: ${formatCurrency(s.total - (s.paidAmount || 0))}`,
                },
                debt: {
                  label: "Công nợ",
                  color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                  detail: s.dueDate
                    ? `Hạn: ${new Date(s.dueDate).toLocaleDateString("vi-VN")}`
                    : undefined,
                },
                installment: {
                  label: "Trả góp",
                  color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
                  detail: actualInstallmentPlan
                    ? `${actualInstallmentPlan.payments?.filter((p) => p.status === "paid").length || 0}/${actualInstallmentPlan.numberOfInstallments} kỳ - Lãi ${actualInstallmentPlan.interestRate}%`
                    : undefined,
                },
              }[paymentStatus];

              return (
                <div
                  key={s.id}
                  className="bg-white dark:bg-pin-gray-800 rounded-lg p-3 border border-pin-gray-200 dark:border-pin-gray-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-mono font-semibold text-pin-gray-700 dark:text-pin-gray-300">
                        {s.code || s.id.slice(0, 8)}
                      </span>
                      <span className="text-xs text-pin-gray-500">
                        {new Date(s.date).toLocaleString("vi-VN")}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="font-bold text-sm text-pin-gray-800 dark:text-pin-gray-100">
                        {formatCurrency(s.total)}
                      </span>
                      <button
                        onClick={() => {
                          if (
                            paymentStatus === "installment" ||
                            paymentStatus === "partial" ||
                            paymentStatus === "debt"
                          ) {
                            // Nếu là trả góp nhưng không có plan, tạo một plan giả từ thông tin có sẵn
                            let finalInstallmentPlan = actualInstallmentPlan;
                            if (paymentStatus === "installment" && !actualInstallmentPlan) {
                              // Tạo plan giả dựa trên thông tin từ đơn hàng
                              const downPayment = s.paidAmount || 0;
                              const baseRemainingAmount = s.total - downPayment;
                              // Giả định 9 kỳ, lãi suất 2.39% (có thể lấy từ note hoặc default)
                              const numberOfInstallments = 9;
                              const interestRate = 2.39;
                              const totalWithInterest =
                                baseRemainingAmount *
                                (1 + (interestRate * numberOfInstallments) / 100);
                              const monthlyPayment = Math.ceil(
                                totalWithInterest / numberOfInstallments
                              );

                              // Tính số kỳ đã trả và số tiền còn lại (bao gồm lãi)
                              const paidTerms = downPayment > 0 ? 1 : 0;
                              const totalPaid = paidTerms * monthlyPayment;
                              const remainingAmountWithInterest = totalWithInterest - totalPaid;

                              finalInstallmentPlan = {
                                id: `FALLBACK-${s.id}`,
                                saleId: s.id,
                                customerId: s.customer?.id || "",
                                customerName: s.customer?.name || "",
                                customerPhone: s.customer?.phone || "",
                                totalAmount: s.total,
                                downPayment,
                                remainingAmount: remainingAmountWithInterest,
                                numberOfInstallments,
                                monthlyPayment,
                                interestRate,
                                startDate: s.date,
                                endDate: "",
                                status: "active",
                                payments: Array.from({ length: numberOfInstallments }, (_, i) => ({
                                  id: `PAY-${i + 1}`,
                                  installmentPlanId: `FALLBACK-${s.id}`,
                                  periodNumber: i + 1,
                                  dueDate: "",
                                  amount: monthlyPayment,
                                  status: (i < paidTerms ? "paid" : "pending") as
                                    | "paid"
                                    | "pending"
                                    | "partial"
                                    | "overdue",
                                  paidAmount: i < paidTerms ? monthlyPayment : 0,
                                  paidDate: i < paidTerms ? s.date : undefined,
                                })),
                              };
                            }

                            setPaymentDetailSale({
                              ...s,
                              isInstallment: paymentStatus === "installment",
                              installmentPlan: finalInstallmentPlan,
                            });
                            setShowPaymentDetail(true);
                          }
                        }}
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusConfig.color} ${paymentStatus === "installment" ||
                          paymentStatus === "partial" ||
                          paymentStatus === "debt"
                          ? "cursor-pointer hover:opacity-80"
                          : ""
                          }`}
                        title={
                          paymentStatus === "installment" ||
                            paymentStatus === "partial" ||
                            paymentStatus === "debt"
                            ? "Click để xem chi tiết"
                            : ""
                        }
                      >
                        {statusConfig.label}
                      </button>
                      {statusConfig.detail && (
                        <span className="text-[9px] text-pin-gray-500 dark:text-pin-gray-400">
                          {statusConfig.detail}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-pin-gray-800 dark:text-pin-gray-100 mb-1">
                    {s.customer?.name || "Khách lẻ"}
                  </div>
                  <div className="text-xs text-pin-gray-600 dark:text-pin-gray-400 mb-2 line-clamp-2">
                    {(s.items || [])
                      .map((it: PinCartItem) => `${it.name} x${it.quantity}`)
                      .join(", ")}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        setInvoiceSaleData(s);
                        setShowInvoicePreview(true);
                      }}
                      className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                      title="Xem/In hóa đơn"
                    >
                      <PrinterIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openEdit(s)}
                      disabled={!currentUser}
                      className={`p-1.5 rounded ${currentUser ? "text-pin-blue-600 hover:bg-pin-blue-50 dark:hover:bg-pin-blue-900/30" : "text-pin-gray-400 cursor-not-allowed"}`}
                    >
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (!currentUser) {
                          showToast("Vui lòng đăng nhập", "warn");
                          return;
                        }
                        showConfirmDialog(
                          "Xác nhận xóa",
                          "Xoá hoá đơn này?",
                          async () => {
                            await deletePinSale(s.id);
                          }
                        );
                      }}
                      disabled={!currentUser}
                      className={`p-1.5 rounded ${currentUser ? "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30" : "text-red-300 cursor-not-allowed"}`}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop view - Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left min-w-max">
              <thead className="border-b dark:border-pin-gray-700 bg-pin-gray-50 dark:bg-pin-gray-700/50">
                <tr>
                  <th className="p-3">Số phiếu</th>
                  <th className="p-3">Ngày</th>
                  <th className="p-3">Khách hàng</th>
                  <th className="p-3">Sản phẩm</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-right">Tổng</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentSales.length === 0 && (
                  <tr>
                    <td className="p-4 text-center text-pin-gray-500" colSpan={7}>
                      Chưa có hoá đơn nào.
                    </td>
                  </tr>
                )}
                {recentSales.map((s: PinSale) => {
                  // Tìm installment plan từ database nếu có
                  const linkedPlan = installmentPlans.find((p) => p.saleId === s.id);
                  const actualInstallmentPlan = s.installmentPlan || linkedPlan;

                  // Xác định trạng thái thanh toán từ dữ liệu thực tế
                  let paymentStatus: "paid" | "partial" | "debt" | "installment";

                  // Ưu tiên check installment trước
                  if (s.isInstallment || actualInstallmentPlan) {
                    paymentStatus = "installment";
                  }
                  // Heuristic: Nếu có paymentStatus là "installment" trong DB hoặc code chứa pattern trả góp
                  else if (
                    s.paidAmount !== undefined &&
                    s.paidAmount > 0 &&
                    s.paidAmount < s.total &&
                    (s.paymentStatus === "installment" || (s.code && s.code.includes("INST")))
                  ) {
                    paymentStatus = "installment";
                  } else if (
                    s.paidAmount !== undefined &&
                    s.paidAmount > 0 &&
                    s.paidAmount < s.total
                  ) {
                    paymentStatus = "partial";
                  } else if (s.paidAmount === 0 || s.paymentStatus === "debt") {
                    paymentStatus = "debt";
                  } else {
                    paymentStatus = "paid";
                  }

                  const statusConfig = {
                    paid: {
                      label: "Đã thanh toán",
                      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                    },
                    partial: {
                      label: `Trả ${formatCurrency(s.paidAmount || 0)}`,
                      color:
                        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                      detail: `Còn nợ: ${formatCurrency(s.total - (s.paidAmount || 0))}`,
                    },
                    debt: {
                      label: "Công nợ",
                      color: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                      detail: s.dueDate
                        ? `Hạn: ${new Date(s.dueDate).toLocaleDateString("vi-VN")}`
                        : undefined,
                    },
                    installment: {
                      label: "Trả góp",
                      color:
                        "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
                      detail: actualInstallmentPlan
                        ? `${actualInstallmentPlan.payments?.filter((p) => p.status === "paid").length || 0}/${actualInstallmentPlan.numberOfInstallments} kỳ - Lãi ${actualInstallmentPlan.interestRate}%`
                        : undefined,
                    },
                  }[paymentStatus];

                  return (
                    <tr key={s.id} className="border-t dark:border-pin-gray-700">
                      <td className="p-3 text-sm font-mono font-semibold text-blue-600 dark:text-blue-400">
                        {s.code || s.id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-sm text-pin-gray-600 dark:text-pin-gray-400">
                        {new Date(s.date).toLocaleString("vi-VN")}
                      </td>
                      <td className="p-3 text-sm font-medium">{s.customer?.name || "Khách lẻ"}</td>
                      <td className="p-3 text-sm max-w-md">
                        <div className="space-y-0.5">
                          {(s.items || []).slice(0, 3).map((it: PinCartItem, idx: number) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-pin-gray-800 dark:text-pin-gray-200">{it.name}</span>
                              <span className="text-pin-gray-500 text-xs">x{it.quantity}</span>
                            </div>
                          ))}
                          {(s.items || []).length > 3 && (
                            <div className="text-xs text-pin-gray-500">
                              +{(s.items || []).length - 3} sản phẩm khác
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <button
                          onClick={() => {
                            if (
                              paymentStatus === "installment" ||
                              paymentStatus === "partial" ||
                              paymentStatus === "debt"
                            ) {
                              // Nếu là trả góp nhưng không có plan, tạo một plan giả từ thông tin có sẵn
                              let finalInstallmentPlan = actualInstallmentPlan;
                              if (paymentStatus === "installment" && !actualInstallmentPlan) {
                                const downPayment = s.paidAmount || 0;
                                const baseRemainingAmount = s.total - downPayment;
                                const numberOfInstallments = 9;
                                const interestRate = 2.39;
                                const totalWithInterest =
                                  baseRemainingAmount *
                                  (1 + (interestRate * numberOfInstallments) / 100);
                                const monthlyPayment = Math.ceil(
                                  totalWithInterest / numberOfInstallments
                                );

                                // Tính số kỳ đã trả và số tiền còn lại (bao gồm lãi)
                                const paidTerms = downPayment > 0 ? 1 : 0;
                                const totalPaid = paidTerms * monthlyPayment;
                                const remainingAmountWithInterest = totalWithInterest - totalPaid;

                                finalInstallmentPlan = {
                                  id: `FALLBACK-${s.id}`,
                                  saleId: s.id,
                                  customerId: s.customer?.id || "",
                                  customerName: s.customer?.name || "",
                                  customerPhone: s.customer?.phone || "",
                                  totalAmount: s.total,
                                  downPayment,
                                  remainingAmount: remainingAmountWithInterest,
                                  numberOfInstallments,
                                  monthlyPayment,
                                  interestRate,
                                  startDate: s.date,
                                  endDate: "",
                                  status: "active",
                                  payments: Array.from(
                                    { length: numberOfInstallments },
                                    (_, i) => ({
                                      id: `PAY-${i + 1}`,
                                      installmentPlanId: `FALLBACK-${s.id}`,
                                      periodNumber: i + 1,
                                      dueDate: "",
                                      amount: monthlyPayment,
                                      status: (i < paidTerms ? "paid" : "pending") as
                                        | "paid"
                                        | "pending"
                                        | "partial"
                                        | "overdue",
                                      paidAmount: i < paidTerms ? monthlyPayment : 0,
                                      paidDate: i < paidTerms ? s.date : undefined,
                                    })
                                  ),
                                };
                              }

                              setPaymentDetailSale({
                                ...s,
                                isInstallment: paymentStatus === "installment",
                                installmentPlan: finalInstallmentPlan,
                              });
                              setShowPaymentDetail(true);
                            }
                          }}
                          className={`inline-flex flex-col items-start text-xs px-3 py-1 rounded-lg font-medium whitespace-nowrap ${statusConfig.color} ${paymentStatus === "installment" ||
                            paymentStatus === "partial" ||
                            paymentStatus === "debt"
                            ? "cursor-pointer hover:opacity-80"
                            : ""
                            }`}
                          title={
                            paymentStatus === "installment" ||
                              paymentStatus === "partial" ||
                              paymentStatus === "debt"
                              ? "Click để xem chi tiết"
                              : ""
                          }
                        >
                          <span>{statusConfig.label}</span>
                          {statusConfig.detail && (
                            <span className="text-[10px] opacity-75 mt-0.5">
                              {statusConfig.detail}
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3 text-right font-semibold text-pin-gray-800 dark:text-pin-gray-100">
                        {formatCurrency(s.total)}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => {
                            setInvoiceSaleData(s);
                            setShowInvoicePreview(true);
                          }}
                          title="Xem/In hóa đơn"
                          className="mr-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                        >
                          <PrinterIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => openEdit(s)}
                          disabled={!currentUser}
                          title={!currentUser ? "Bạn phải đăng nhập để sửa" : "Sửa hoá đơn"}
                          className={`mr-2 ${currentUser ? "text-pin-blue-600" : "text-pin-gray-400 cursor-not-allowed"
                            }`}
                        >
                          <PencilSquareIcon className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            if (!currentUser) {
                              showToast("Vui lòng đăng nhập", "warn");
                              return;
                            }
                            showConfirmDialog(
                              "Xác nhận xóa",
                              "Xoá hoá đơn này? Tồn kho sẽ được hoàn lại.",
                              async () => {
                                await deletePinSale(s.id);
                              }
                            );
                          }}
                          disabled={!currentUser}
                          title={!currentUser ? "Bạn phải đăng nhập để xoá" : "Xoá hoá đơn"}
                          className={`${currentUser ? "text-red-500" : "text-red-300 cursor-not-allowed"
                            }`}
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
            inventoryLogs={
              invoiceInventoryLogs || {
                isLoading: true,
                error: null,
                materials: [],
                products: [],
              }
            }
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
