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
  if (normalized.includes("máº¡ch") || normalized.includes("mach")) return "bg-sky-300";
  if (normalized.includes("dÃ¢y") || normalized.includes("day")) return "bg-violet-300";
  if (normalized.includes("sáº¡c") || normalized.includes("sac")) return "bg-emerald-300";
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
              name: m?.name || id || "(KhÃ´ng rÃµ)",
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
              name: p?.name || id || "(KhÃ´ng rÃµ)",
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

  // Installment (tráº£ gÃ³p) state
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  const [installmentPlan, setInstallmentPlan] = useState<InstallmentPlan | null>(null);

  // Delivery (giao hÃ ng) state
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
          // DÃ¹ng giÃ¡ bÃ¡n láº» lÃ m máº·c Ä‘á»‹nh cho cart
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

  // Giá»›i háº¡n sá»‘ sáº£n pháº©m hiá»ƒn thá»‹ Ä‘á»ƒ tÄƒng hiá»‡u suáº¥t
  const availableItems = useMemo(() => {
    // Khi Ä‘ang tÃ¬m kiáº¿m, hiá»ƒn thá»‹ táº¥t cáº£ káº¿t quáº£ tÃ¬m kiáº¿m
    if (searchTerm.trim()) return allAvailableItems;
    // Khi khÃ´ng tÃ¬m kiáº¿m, giá»›i háº¡n 20 sáº£n pháº©m trá»« khi user chá»n xem táº¥t cáº£
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

      // XÃ¡c Ä‘á»‹nh giÃ¡ bÃ¡n dá»±a trÃªn priceType
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
          // Náº¿u cÃ³ priceType, chá»‰ cáº­p nháº­t item cÃ³ cÃ¹ng productId VÃ€ priceType
          // Náº¿u khÃ´ng cÃ³ priceType, cáº­p nháº­t táº¥t cáº£ item cÃ³ cÃ¹ng productId (backward compatible)
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
      showToast("Lá»—i khi lÆ°u khÃ¡ch hÃ ng. Vui lÃ²ng thá»­ láº¡i.", "error");
    }
    setCustomers((prev) => [newCustomer, ...prev]);
    handleSelectCustomer(newCustomer);
    setIsNewCustomerModalOpen(false);
  };

  const finalizeSale = () => {
    if (!currentUser) {
      showToast("Báº¡n pháº£i Ä‘Äƒng nháº­p Ä‘á»ƒ thá»±c hiá»‡n thanh toÃ¡n.", "warn");
      return;
    }
    if (cartItems.length === 0 || !paymentMethod) {
      showToast("Vui lÃ²ng thÃªm sáº£n pháº©m vÃ o giá» vÃ  chá»n phÆ°Æ¡ng thá»©c thanh toÃ¡n.", "warn");
      return;
    }

    // Validate payment mode
    if (paymentMode === "partial") {
      const amt = Number(paidAmount || 0);
      if (!(amt > 0 && amt < total)) {
        showToast("Sá»‘ tiá»n thanh toÃ¡n má»™t pháº§n pháº£i lá»›n hÆ¡n 0 vÃ  nhá» hÆ¡n Tá»•ng cá»™ng.", "warn");
        return;
      }
    }
    if (paymentMode === "debt") {
      // Optional: encourage selecting a customer for debts
      if (!selectedCustomer) {
        showConfirmDialog(
          "XÃ¡c nháº­n ghi ná»£",
          "Báº¡n chÆ°a chá»n khÃ¡ch hÃ ng. Ghi ná»£ cho 'KhÃ¡ch vÃ£ng lai'?",
          () => proceedWithSale()
        );
        return;
      }
    }
    if (paymentMode === "installment") {
      if (!selectedCustomer) {
        showToast("Vui lÃ²ng chá»n khÃ¡ch hÃ ng Ä‘á»ƒ tráº£ gÃ³p!", "warn");
        return;
      }
      if (!installmentPlan) {
        showToast("Vui lÃ²ng thiáº¿t láº­p káº¿ hoáº¡ch tráº£ gÃ³p!", "warn");
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
      : { name: customerSearch || "KhÃ¡ch láº»" };

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
    "all" | "paid" | "partial" | "debt" | "installment"
  >("all");
  const [historyDateFilter, setHistoryDateFilter] = useState<"all" | "today" | "7d" | "month">(
    "all"
  );

  const getSalePaymentStatus = (sale: PinSale): "paid" | "partial" | "debt" | "installment" => {
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
    <div className="flex flex-col h-screen bg-slate-950 text-slate-200 font-mono text-[10px] uppercase tracking-widest overflow-hidden">
      {/* HEADER SECTION - ULTRA COMPACT */}
      <header className="h-8 border-b border-slate-800 flex items-center justify-between px-4 bg-slate-900/50">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="font-bold text-slate-100">POS.TERMINAL_STATION.01</span>
          </div>
          <div className="h-4 w-[1px] bg-slate-800" />
          <div className="flex gap-4">
            <span className="text-slate-500">OPERATOR: <span className="text-slate-300">{currentUser?.name || 'GUEST'}</span></span>
            <span className="text-slate-500">SESSION: <span className="text-slate-300">{new Date().toLocaleString()}</span></span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {['SALE', 'HISTORY', 'ANALYTICS'].map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileView(tab.toLowerCase() as any)}
              className={`px-4 h-8 flex items-center transition-all border-x border-transparent ${
                (mobileView === tab.toLowerCase() || (mobileView === 'products' && tab === 'SALE'))
                  ? 'bg-slate-800 text-emerald-400 border-slate-700 shadow-[inset_0_0_10px_rgba(52,211,153,0.1)]'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {mobileView === 'products' || mobileView === 'sale' ? (
          <>
            {/* LEFT COLUMN: PRODUCT GRID & SEARCH */}
            <div className="flex-1 flex flex-col border-r border-slate-800">
              <div className="p-2 border-b border-slate-800 bg-slate-950 flex gap-2">
                <div className="flex-1 relative">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search className="w-3 h-3 text-slate-500" />
                  </div>
                  <input
                    type="text"
                    placeholder="SEARCH_PRODUCT_BY_NAME_OR_SKU..."
                    className="w-full bg-slate-900 border border-slate-800 rounded-none h-10 pl-10 pr-4 text-emerald-400 placeholder:text-slate-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all font-mono"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-950/50">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  {filteredProducts.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => addToCart(p)}
                      className="group bg-slate-900/40 border border-slate-800 hover:border-emerald-500/50 transition-all cursor-pointer aspect-square flex flex-col p-2"
                    >
                      <div className="flex-1 overflow-hidden relative bg-slate-950/50 border border-slate-800/30">
                         {p.image ? (
                          <img src={p.image} className="w-full h-full object-contain mix-blend-screen opacity-70 group-hover:opacity-100 transition-opacity" />
                         ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-800"><Box className="w-8 h-8 opacity-20"/></div>
                         )}
                         <div className="absolute top-1 right-2 text-[8px] text-slate-600 bg-slate-950/80 px-1 border border-slate-800/50">#{p.sku}</div>
                         <div className="absolute bottom-1 right-2 bg-emerald-500/5 px-1 text-emerald-500 text-[8px]">STOCK: {p.stock}</div>
                      </div>
                      <div className="mt-2 text-center">
                        <div className="truncate text-[9px] text-slate-400 font-bold">{p.name}</div>
                        <div className="text-emerald-400 text-[11px] tabular-nums font-black mt-1">{formatCurrency(p.price)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: CART */}
            <div className="w-96 flex flex-col bg-slate-900 border-l border-slate-800 shadow-2xl">
              <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center">
                <span className="text-slate-500 text-[9px] font-bold tracking-widest">STATION.LOG.ACTIVE</span>
                <span className="text-emerald-400 text-[9px] font-bold tabular-nums">ITEMS: {cartItems.length}</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {cartItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-800 gap-4 opacity-50">
                    <ShoppingCart className="w-12 h-12" />
                    <span className="text-[9px]">IDLE_STATE_WAITING_FOR_INPUT</span>
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="bg-slate-950/40 border border-slate-800/50 p-2 group hover:bg-slate-800/40 transition-all">
                      <div className="flex justify-between items-start mb-2">
                         <span className="text-slate-300 font-bold truncate pr-3">{item.name}</span>
                         <button onClick={() => removeFromCart(item.id)} className="text-slate-700 hover:text-rose-500 transition-colors"><X className="w-3 h-3"/></button>
                      </div>
                      <div className="flex justify-between items-center tabular-nums">
                         <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5">
                            <button onClick={() => updateCartItemQuantity(item.id, item.quantity - 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-800 text-slate-500">-</button>
                            <span className="w-6 text-center text-emerald-400 font-bold">{item.quantity}</span>
                            <button onClick={() => updateCartItemQuantity(item.id, item.quantity + 1)} className="w-5 h-5 flex items-center justify-center hover:bg-slate-800 text-slate-500">+</button>
                         </div>
                         <span className="text-emerald-400 font-black">{formatCurrency(item.price * item.quantity)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
                 <div className="space-y-1 text-slate-500 text-[9px] font-bold">
                    <div className="flex justify-between">
                       <span>SUBTOTAL_RAW</span>
                       <span className="text-slate-300">{formatCurrency(subtotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                       <span>MODIFIER_ADJUST</span>
                       <div className="flex gap-1">
                          <input 
                            type="number"
                            value={discount || ''}
                            onChange={(e) => setDiscount(Number(e.target.value))}
                            className="bg-slate-900 border border-slate-800 w-16 px-1 text-right text-emerald-400 outline-none h-5"
                          />
                          <select 
                            value={discountType} 
                            onChange={(e) => setDiscountType(e.target.value as any)}
                            className="bg-slate-900 border border-slate-800 text-[8px] outline-none"
                          >
                            <option value="VND">VND</option>
                            <option value="%">%</option>
                          </select>
                       </div>
                    </div>
                 </div>

                 <div className="pt-3 border-t border-slate-800 flex justify-between items-end">
                    <div className="text-[9px] text-emerald-500/50 font-bold">TOTAL_EXECUTION_VAL</div>
                    <div className="text-2xl font-black text-emerald-400 tabular-nums drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                      {formatCurrency(total)}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2 pb-2">
                    {['CASH', 'TRANSFER'].map(m => (
                      <button 
                        key={m}
                        onClick={() => setPaymentMethod(m.toLowerCase() as any)}
                        className={`h-10 text-[9px] font-bold border transition-all ${paymentMethod === m.toLowerCase() ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                      >
                        {m}_METHOD
                      </button>
                    ))}
                 </div>

                 <button 
                  onClick={() => { setPaymentMode("full"); finalizeSale(); }}
                  disabled={cartItems.length === 0}
                  className="w-full h-14 bg-emerald-500 text-slate-950 font-black text-[11px] hover:bg-emerald-400 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:bg-slate-800 disabled:text-slate-600 group"
                 >
                   <CheckCircle2 className="w-4 h-4" />
                   CONFIRM_SALE_TRANSACTION
                   <div className="bg-slate-950/20 px-1.5 py-0.5 rounded text-[8px] ml-auto mr-2 font-mono">[F9]</div>
                 </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col bg-slate-950 p-6 overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-emerald-400 flex items-center gap-3 tracking-[0.2em]">
                  <History className="w-5 h-5" /> TRANSACTION_DEEP_LOG
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <input
                    type="text"
                    placeholder="SCAN_LOGS_BY_ID_OR_NAME..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="bg-slate-900 border border-slate-800 h-10 pl-10 pr-4 text-[10px] w-64 text-emerald-400 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
             </div>

             <div className="flex-1 border border-slate-800 overflow-hidden flex flex-col shadow-[0_0_30px_rgba(0,0,0,0.3)]">
               <div className="overflow-y-auto flex-1 custom-scrollbar">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 sticky top-0 z-20">
                    <tr className="border-b border-slate-800 uppercase text-[9px] text-slate-500 font-bold">
                      <th className="p-4">CODE_REF</th>
                      <th className="p-4">TIME_STAMP</th>
                      <th className="p-4">ENT_CUSTOMER</th>
                      <th className="p-4">TRANS_VAL</th>
                      <th className="p-4">ST_STATUS</th>
                      <th className="p-4 text-right">OPS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900">
                    {filteredHistorySales.map(sale => (
                      <tr key={sale.id} className="hover:bg-slate-900/50 text-[10px] text-slate-300 transition-colors">
                        <td className="p-4 font-bold text-slate-100">{sale.code}</td>
                        <td className="p-4 text-slate-500 tabular-nums">{new Date(sale.date).toLocaleString()}</td>
                        <td className="p-4">{sale.customer?.name}</td>
                        <td className="p-4 text-emerald-400 font-bold tabular-nums">{formatCurrency(sale.total)}</td>
                        <td className="p-4">
                           <span className={`px-2 py-0.5 border text-[9px] font-bold ${sale.paymentStatus === 'paid' ? 'border-emerald-500/30 text-emerald-500' : 'border-rose-500/30 text-rose-500'}`}>
                              {sale.paymentStatus}
                           </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button onClick={() => { setInvoiceSaleData(sale); setShowInvoicePreview(true); }} className="hover:text-emerald-400 transition-colors"><Printer className="w-4 h-4"/></button>
                          <button onClick={() => { showConfirmDialog("WIPE_DATA", "PERMANENT_DELETE_RECORD?", () => deletePinSale(sale.id)); }} className="hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
               </div>
             </div>
          </div>
        )}
      </main>

      {/* SYSTEM OVERLAYS */}
      <NewPinCustomerModal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        onSave={handleSaveNewCustomer}
        initialName={customerSearch}
        onToast={showToast}
      />

       {showInvoicePreview && invoiceSaleData && (
        <InvoicePreviewModal
          isOpen={showInvoicePreview}
          onClose={() => setShowInvoicePreview(false)}
          title={`TERMINAL_OUTPUT: ${invoiceSaleData.code}`}
        >
          <PinReceiptModal sale={invoiceSaleData} onPrintComplete={() => {}} />
        </InvoicePreviewModal>
      )}

      {/* CONFIRMATION_STATION */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="bg-slate-900 border border-slate-700 p-8 max-w-md w-full shadow-[0_0_100px_rgba(244,63,94,0.1)]">
            <div className="flex items-center gap-3 text-rose-500 mb-4">
               <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
               <h3 className="font-black uppercase tracking-[0.3em]">{confirmDialog.title}</h3>
            </div>
            <p className="text-slate-400 text-[11px] mb-8 leading-relaxed font-mono uppercase tracking-widest">{confirmDialog.message}</p>
            <div className="flex justify-end gap-4 font-bold text-[10px]">
              <button onClick={closeConfirmDialog} className="px-6 py-2 border border-slate-800 text-slate-500 hover:text-slate-300">ABORT_MISSION</button>
              <button onClick={() => { confirmDialog.onConfirm(); closeConfirmDialog(); }} className="px-6 py-2 bg-rose-500 text-slate-950 hover:bg-rose-400">EXECUTE_WIPE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PinSalesManager;

