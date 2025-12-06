import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase, IS_OFFLINE_MODE, DEV_AUTH_BYPASS } from "../supabaseClient";
import type { PinContextType } from "./types";
import type {
  CashTransaction,
  FixedAsset,
  CapitalInvestment,
  PinMaterial,
  PinBOM,
  ProductionOrder,
  PinProduct,
  PinSale,
  PinCustomer,
  Supplier,
  PinCartItem,
  PinRepairOrder,
  ToastItem,
  PinMaterialHistory,
} from "../types";
import { createMaterialsService } from "../lib/services/MaterialsService";
import { createProductionService } from "../lib/services/ProductionService";
import { createSalesService } from "../lib/services/SalesService";
import { createCustomersService } from "../lib/services/CustomersService";
import { createSuppliersService } from "../lib/services/SuppliersService";
import { createRepairService } from "../lib/services/RepairService";
import { createProductionAdminService } from "../lib/services/ProductionAdminService";
import { createFinanceService } from "../lib/services/FinanceService";

interface CurrentUser {
  id: string;
  name: string;
}

interface PaymentSource {
  id: string;
  name: string;
  balance: { main: number };
  isDefault: boolean;
}

interface StoreSettings {
  name: string;
  branches: { id: string; name: string }[];
}

// Generic database row type for raw Supabase responses
interface DBRow {
  id: string;
  created_at?: string;
  [key: string]: unknown;
}

// Export the standalone context so legacy hooks can bridge to it
export const PinStandaloneContext = createContext<PinContextType | null>(null);

export const PinProviderStandalone: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Auth
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Core store settings (keep minimal; can be extended later)
  const [storeSettings] = useState<StoreSettings>({
    name: "PinCorp",
    branches: [{ id: "main", name: "Chi nhánh chính" }],
  });

  // Toast shim
  const addToast: PinContextType["addToast"] = (t: ToastItem) => {
    try {
      // eslint-disable-next-line no-console
      console[t?.type === "error" ? "error" : t?.type === "warn" ? "warn" : "log"]?.(
        `[${t?.type || "info"}] ${t?.title || ""}: ${t?.message || ""}`
      );
    } catch {}
  };

  // PIN state
  const [pinMaterials, setPinMaterials] = useState<PinMaterial[]>([]);
  const [pinMaterialHistory, setPinMaterialHistory] = useState<PinMaterialHistory[]>([]);
  const [pinBOMs, setBoms] = useState<PinBOM[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>([]);
  const [pinProducts, setPinProducts] = useState<PinProduct[]>([]);
  const [pinSales, setPinSales] = useState<PinSale[]>([]);
  const [pinCartItems, setPinCartItems] = useState<PinCartItem[]>([]);
  const [pinCustomers, setPinCustomers] = useState<PinCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentSources, setPaymentSources] = useState<PaymentSource[]>([
    { id: "cash", name: "Tiền mặt", balance: { main: 0 }, isDefault: true },
    {
      id: "bank",
      name: "Chuyển khoản",
      balance: { main: 0 },
      isDefault: false,
    },
  ]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>([]);
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [capitalInvestments, setCapitalInvestments] = useState<CapitalInvestment[]>([]);
  const [pinRepairOrders, setRepairOrders] = useState<PinRepairOrder[]>([]);

  // Simple helpers
  const reloadPinMaterialHistory = async () => {
    if (IS_OFFLINE_MODE || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from("pin_material_history")
        .select("*")
        .order("import_date", { ascending: false });
      if (!error) setPinMaterialHistory(data || []);
    } catch {}
  };

  // Basic cash transaction upsert (tagged for PIN)
  const addCashTransaction: PinContextType["addCashTransaction"] = async (
    item: CashTransaction
  ) => {
    const tx: CashTransaction = {
      ...item,
      notes: `${item.notes ? item.notes + " " : ""}#app:pincorp`,
    };

    if (IS_OFFLINE_MODE || !currentUser) {
      setCashTransactions((prev) => {
        const idx = prev.findIndex((i) => i.id === tx.id);
        if (idx > -1) {
          const next = [...prev];
          next[idx] = tx;
          return next;
        }
        return [tx, ...prev];
      });
      return;
    }

    try {
      // Build snake_case payload for DB
      let contactTxt: string | null = null;
      try {
        contactTxt = tx.contact ? JSON.stringify(tx.contact) : null;
      } catch {
        contactTxt = null;
      }
      interface DBCashTxPayload {
        id: string;
        type: string;
        date: string;
        amount: number;
        contact: string | null;
        notes: string | null;
        category?: string | null;
        payment_source_id: string | null;
        branch_id: string | null;
        sale_id: string | null | undefined;
        work_order_id: string | null | undefined;
        created_at: string;
      }
      const payload: DBCashTxPayload = {
        id: tx.id,
        type: tx.type,
        date: tx.date,
        amount: tx.amount,
        contact: contactTxt,
        notes: tx.notes ?? null,
        category: tx.category ?? null,
        payment_source_id: tx.paymentSourceId ?? null,
        branch_id: tx.branchId ?? null,
        sale_id: tx.saleId ?? null,
        work_order_id: tx.workOrderId ?? null,
        created_at: tx.created_at ?? new Date().toISOString(),
      };

      const { error } = await supabase.from("cashtransactions").upsert(payload);
      if (error) {
        // Retry without category if missing
        if (
          /category/i.test(error.message || "") &&
          /(column|not exist|schema cache)/i.test(error.message || "")
        ) {
          const retryPayload: Omit<DBCashTxPayload, "category"> = { ...payload };
          delete (retryPayload as DBCashTxPayload).category;
          const { error: retryErr } = await supabase.from("cashtransactions").upsert(retryPayload);
          if (!retryErr) {
            setCashTransactions((prev) => {
              const idx = prev.findIndex((i) => i.id === tx.id);
              if (idx > -1) {
                const next = [...prev];
                next[idx] = tx;
                return next;
              }
              return [tx, ...prev];
            });
            addToast?.({
              title: "Thiếu cột category",
              message: "Đã lưu sau khi bỏ category",
              type: "warn",
            });
            return;
          }
        }
        addToast?.({
          title: "Lỗi lưu sổ quỹ",
          message: error.message || String(error),
          type: "error",
        });
        return;
      }
      setCashTransactions((prev) => {
        const idx = prev.findIndex((i) => i.id === tx.id);
        if (idx > -1) return prev.map((i) => (i.id === tx.id ? tx : i));
        return [tx, ...prev];
      });
    } catch (e: unknown) {
      addToast?.({
        title: "Lỗi lưu sổ quỹ",
        message: e instanceof Error ? e.message : String(e),
        type: "error",
      });
    }
  };

  // Auth bootstrap
  useEffect(() => {
    if (IS_OFFLINE_MODE || DEV_AUTH_BYPASS) {
      setCurrentUser({
        id: DEV_AUTH_BYPASS ? "dev-bypass-user" : "offline-user",
        name: "Offline User",
      });
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user;
      if (u) setCurrentUser({ id: u.id, name: u.user_metadata?.name || u.email });
      else setCurrentUser(null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (u) setCurrentUser({ id: u.id, name: u.user_metadata?.name || u.email });
      else setCurrentUser(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Initial fetch for core PIN datasets (finance + BOM + materials/products/orders)
  useEffect(() => {
    const fetchPinFinance = async () => {
      if (IS_OFFLINE_MODE || !currentUser) return;
      try {
        const [
          fa,
          ci,
          ct,
          bomsRes,
          matsRes,
          prodsRes,
          ordersRes,
          repairsRes,
          salesRes,
          customersRes,
          suppliersRes,
        ] = await Promise.all([
          supabase.from("pin_fixed_assets").select("*"),
          supabase.from("pin_capital_investments").select("*"),
          supabase.from("cashtransactions").select("*").order("date", { ascending: false }),
          supabase.from("pin_boms").select("*"),
          supabase.from("pin_materials").select("*"),
          supabase.from("pin_products").select("*"),
          supabase
            .from("pin_production_orders")
            .select("*")
            .order("created_at", { ascending: false }),
          supabase
            .from("pin_repair_orders")
            .select("*")
            .order("creation_date", { ascending: false }),
          supabase.from("pin_sales").select("*").order("date", { ascending: false }),
          supabase.from("pin_customers").select("*"),
          supabase.from("pin_suppliers").select("*"),
        ]);
        if (!fa.error) {
          const mapDbAssetToUi = (row: DBRow): FixedAsset => ({
            id: row.id as string,
            name: row.name as string,
            category: (row.category as FixedAsset["category"]) || "equipment",
            description: (row.description || undefined) as string | undefined,
            purchaseDate: (row.purchasedate ||
              row.purchase_date ||
              row.purchaseDate ||
              new Date().toISOString()) as string,
            purchasePrice: Number(row.purchaseprice ?? row.purchase_price ?? 0),
            currentValue: Number(
              row.currentvalue ?? row.current_value ?? row.purchaseprice ?? row.purchase_price ?? 0
            ),
            depreciationMethod: (row.depreciationmethod ||
              row.depreciation_method ||
              "straight_line") as FixedAsset["depreciationMethod"],
            usefulLife: Number(row.usefullife ?? row.useful_life ?? 5),
            salvageValue: Number(row.salvagevalue ?? row.salvage_value ?? 0),
            accumulatedDepreciation: Number(
              row.accumulateddepreciation ?? row.accumulated_depreciation ?? 0
            ),
            location: (row.location || undefined) as string | undefined,
            status: (row.status as FixedAsset["status"]) || "active",
            branchId: (row.branchid || row.branch_id || undefined) as string | undefined,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setFixedAssets(((fa.data as DBRow[]) || []).map(mapDbAssetToUi));
        }
        if (!ci.error) {
          const mapDbInvestToUi = (row: DBRow): CapitalInvestment => ({
            id: row.id as string,
            date: (row.date || row.created_at || new Date().toISOString()) as string,
            amount: Number(row.amount ?? 0),
            description: (row.description || "") as string,
            source: (row.source as CapitalInvestment["source"]) || "Vốn chủ sở hữu",
            interestRate: row.interestrate ?? row.interest_rate ?? undefined,
            branchId: (row.branchid || row.branch_id || "main") as string,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setCapitalInvestments(((ci.data as DBRow[]) || []).map(mapDbInvestToUi));
        }
        if (!ct.error) {
          const mapDbCashTxToUi = (row: DBRow): CashTransaction => {
            let contact: Record<string, unknown> | null = null;
            const rawContact = row?.contact;
            if (typeof rawContact === "string") {
              try {
                contact = JSON.parse(rawContact);
              } catch {
                contact = null;
              }
            } else if (typeof rawContact === "object") {
              contact = rawContact as Record<string, unknown>;
            }
            return {
              id: row.id as string,
              type: (row.type as CashTransaction["type"]) || "income",
              date: String(row.date || row.created_at || row.createdat || new Date().toISOString()),
              amount: Number(row.amount ?? 0),
              contact: (contact as CashTransaction["contact"]) || { id: "", name: "" },
              notes: (row.notes || row.description || "") as string,
              category: (row.category || undefined) as string | undefined,
              paymentSourceId: (row.paymentsourceid ||
                row.payment_source_id ||
                row.paymentSourceId ||
                "cash") as string,
              branchId: (row.branchid || row.branch_id || row.branchId || "main") as string,
              saleId: (row.saleid || row.sale_id || row.saleId || undefined) as string | undefined,
              workOrderId: (row.workorderid ||
                row.work_order_id ||
                row.workOrderId ||
                undefined) as string | undefined,
              created_at: (row.created_at || row.createdat || undefined) as string | undefined,
            } as CashTransaction;
          };
          setCashTransactions(((ct.data as DBRow[]) || []).map(mapDbCashTxToUi));
        }
        if (!bomsRes.error) {
          const mapDbBomToUi = (row: DBRow): PinBOM => ({
            id: row.id as string,
            productName: (row.productname || row.product_name || row.productName) as string,
            productSku: (row.productsku || row.product_sku || row.productSku) as string,
            materials: Array.isArray(row.materials) ? row.materials : [],
            notes: (row.notes || undefined) as string | undefined,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setBoms(((bomsRes.data as DBRow[]) || []).map(mapDbBomToUi));
        }
        if (!matsRes.error) {
          const mapDbMatToUi = (row: DBRow): PinMaterial => ({
            id: row.id as string,
            name: row.name as string,
            sku: row.sku as string,
            unit: row.unit as string,
            purchasePrice: Number(row.purchaseprice ?? row.purchase_price ?? 0),
            retailPrice:
              Number(row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0) || undefined,
            wholesalePrice: Number(row.wholesaleprice ?? row.wholesale_price ?? 0) || undefined,
            stock: Number(row.stock ?? 0),
            committedQuantity:
              Number(row.committedquantity ?? row.committed_quantity ?? 0) || undefined,
            supplier: (row.supplier || undefined) as string | undefined,
            description: (row.description || undefined) as string | undefined,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setPinMaterials(((matsRes.data as DBRow[]) || []).map(mapDbMatToUi));
        }
        if (!prodsRes.error) {
          const mapDbProdToUi = (row: DBRow): PinProduct => ({
            id: row.id as string,
            name: row.name as string,
            sku: row.sku as string,
            stock: Number(row.stock ?? 0),
            costPrice: Number(row.costprice ?? row.cost_price ?? 0),
            retailPrice: Number(row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0),
            wholesalePrice: Number(
              row.wholesaleprice ??
                row.wholesale_price ??
                Math.round(
                  (Number(row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0) || 0) * 0.9
                )
            ),
            sellingPrice: Number(row.sellingprice ?? 0) || undefined,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setPinProducts(((prodsRes.data as DBRow[]) || []).map(mapDbProdToUi));
        }
        if (!ordersRes.error) {
          const mapDbOrderToUi = (row: DBRow): ProductionOrder => ({
            id: row.id as string,
            creationDate: (row.creationdate ||
              row.creation_date ||
              row.created_at ||
              new Date().toISOString()) as string,
            bomId: (row.bomid || row.bom_id || row.bomId) as string,
            productName: (row.productname || row.product_name || row.productName) as string,
            quantityProduced: Number(row.quantityproduced ?? row.quantity_produced ?? 0),
            status: (row.status as ProductionOrder["status"]) || "Đang chờ",
            materialsCost: Number(row.materialscost ?? row.materials_cost ?? 0),
            additionalCosts: Array.isArray(row.additionalcosts) ? row.additionalcosts : [],
            totalCost: Number(row.totalcost ?? row.total_cost ?? 0),
            notes: (row.notes || undefined) as string | undefined,
            userName: (row.username || row.user_name || undefined) as string | undefined,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setProductionOrders(((ordersRes.data as DBRow[]) || []).map(mapDbOrderToUi));
        }

        // Repair orders initial load
        if (!repairsRes.error) {
          const mapDbRepairToUi = (row: DBRow): PinRepairOrder => ({
            id: row.id as string,
            creationDate: (row.creationdate ||
              row.creation_date ||
              row.created_at ||
              new Date().toISOString()) as string,
            customerName: (row.customername ||
              row.customer_name ||
              row.customerName ||
              "") as string,
            customerPhone: (row.customerphone ||
              row.customer_phone ||
              row.customerPhone ||
              "") as string,
            deviceName: (row.devicename || row.device_name || row.deviceName || "") as string,
            issueDescription: (row.issuedescription ||
              row.issue_description ||
              row.issueDescription ||
              "") as string,
            technicianName: (row.technicianname ||
              row.technician_name ||
              row.technicianName ||
              "") as string,
            status: row.status as string,
            materialsUsed: (() => {
              // Parse materials_used if it's a JSON string
              const materialsData = row.materials_used || row.materialsused;
              if (Array.isArray(materialsData)) {
                return materialsData;
              }
              if (typeof materialsData === "string") {
                try {
                  const parsed = JSON.parse(materialsData);
                  return Array.isArray(parsed) ? parsed : [];
                } catch {
                  return [];
                }
              }
              return [];
            })(),
            laborCost: Number(row.labor_cost ?? row.laborcost ?? 0),
            total: Number(row.total ?? 0),
            notes: (row.notes || "") as string,
            paymentStatus: (row.payment_status || row.paymentstatus || "unpaid") as string,
            partialPaymentAmount: (row.partial_payment_amount ??
              row.partialpaymentamount ??
              undefined) as number | undefined,
            depositAmount: (row.deposit_amount ?? row.depositamount ?? undefined) as
              | number
              | undefined,
            paymentMethod: (row.payment_method || row.paymentmethod || undefined) as
              | string
              | undefined,
            paymentDate: (row.payment_date || row.paymentdate || undefined) as string | undefined,
            dueDate: (row.due_date || row.duedate || undefined) as string | undefined,
            cashTransactionId: (row.cash_transaction_id || row.cashtransactionid || undefined) as
              | string
              | undefined,
          });
          setRepairOrders(((repairsRes.data as DBRow[]) || []).map(mapDbRepairToUi));
        }

        // Sales initial load (for Reports)
        if (!salesRes.error) {
          const mapDbSaleToUi = (row: DBRow): PinSale => {
            let items: unknown[] = [];
            const rawItems = row.items;
            if (typeof rawItems === "string") {
              try {
                items = JSON.parse(rawItems);
              } catch {
                items = [];
              }
            } else if (Array.isArray(rawItems)) {
              items = rawItems;
            }
            let customer: Record<string, unknown> | null = null;
            const rawCustomer = row.customer;
            if (typeof rawCustomer === "string") {
              try {
                customer = JSON.parse(rawCustomer);
              } catch {
                customer = null;
              }
            } else if (typeof rawCustomer === "object") {
              customer = rawCustomer as Record<string, unknown>;
            }
            return {
              id: row.id as string,
              code: row.code as string | undefined,
              date: String(row.date || row.created_at || new Date().toISOString()),
              items: Array.isArray(items) ? items : [],
              subtotal: Number(row.subtotal ?? 0),
              discount: Number(row.discount ?? 0),
              total: Number(row.total ?? 0),
              customer: (customer || { name: "Khách lẻ" }) as PinSale["customer"],
              paymentMethod: (row.payment_method || row.paymentMethod || "cash") as string,
              userId: (row.user_id || row.userid || row.userId || "") as string,
              userName: (row.user_name || row.username || row.userName || "") as string,
              created_at: (row.created_at || row.createdat || undefined) as string | undefined,
              paymentStatus: (row.payment_status || row.paymentstatus || undefined) as
                | string
                | undefined,
              paidAmount: (row.paid_amount ?? row.paidamount ?? undefined) as number | undefined,
              dueDate: (row.due_date || row.duedate || undefined) as string | undefined,
            };
          };
          setPinSales(((salesRes.data as DBRow[]) || []).map(mapDbSaleToUi));
        }

        // Map customers
        if (!customersRes.error) {
          const mapDbCustomerToUi = (row: DBRow): PinCustomer => ({
            id: row.id as string,
            name: (row.name || "") as string,
            phone: (row.phone || "") as string,
            address: (row.address || "") as string,
            email: (row.email || "") as string,
            notes: (row.notes || "") as string,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setPinCustomers(((customersRes.data as DBRow[]) || []).map(mapDbCustomerToUi));
        }

        // Map suppliers
        if (!suppliersRes.error) {
          const mapDbSupplierToUi = (row: DBRow): Supplier => ({
            id: row.id as string,
            name: (row.name || "") as string,
            phone: (row.phone || "") as string,
            address: (row.address || "") as string,
            email: (row.email || "") as string,
            notes: (row.notes || "") as string,
            created_at: (row.created_at || row.createdat || undefined) as string | undefined,
          });
          setSuppliers(((suppliersRes.data as DBRow[]) || []).map(mapDbSupplierToUi));
        }
      } catch (_e) {
        // ignore
      }
    };
    fetchPinFinance();
  }, [currentUser]);

  // Build services using this standalone context - use PinContextType for type safety
  const ctxForServices: PinContextType = {
    currentUser,
    addToast,
    pinMaterials,
    setPinMaterials,
    pinMaterialHistory,
    setPinMaterialHistory,
    reloadPinMaterialHistory,
    pinBOMs,
    setBoms,
    productionOrders,
    setProductionOrders,
    pinProducts,
    setPinProducts,
    pinSales,
    setPinSales,
    pinCartItems,
    setPinCartItems,
    pinCustomers,
    setPinCustomers,
    suppliers,
    setSuppliers,
    paymentSources,
    setPaymentSources,
    cashTransactions,
    setCashTransactions,
    addCashTransaction,
    pinRepairOrders,
    setRepairOrders,
    fixedAssets,
    setFixedAssets,
    capitalInvestments,
    setCapitalInvestments,
  };

  const materialsSvc = useMemo(() => createMaterialsService(ctxForServices), [ctxForServices]);
  const productionSvc = useMemo(() => createProductionService(ctxForServices), [ctxForServices]);
  const salesSvc = useMemo(() => createSalesService(ctxForServices), [ctxForServices]);
  const customersSvc = useMemo(() => createCustomersService(ctxForServices), [ctxForServices]);
  const suppliersSvc = useMemo(() => createSuppliersService(ctxForServices), [ctxForServices]);
  const repairSvc = useMemo(() => createRepairService(ctxForServices), [ctxForServices]);
  const adminSvc = useMemo(() => createProductionAdminService(ctxForServices), [ctxForServices]);
  const financeSvc = useMemo(() => createFinanceService(ctxForServices), [ctxForServices]);

  const value: PinContextType = {
    // auth & settings
    currentUser,
    storeSettings,
    addToast,

    // finance state
    fixedAssets,
    setFixedAssets,
    capitalInvestments,

    // PIN domain states
    pinMaterials,
    setPinMaterials,
    pinMaterialHistory,
    setPinMaterialHistory,
    reloadPinMaterialHistory,
    pinBOMs,
    setBoms,
    productionOrders,
    setProductionOrders,
    pinProducts,
    setPinProducts,
    pinSales,
    setPinSales,
    pinCartItems,
    setPinCartItems,
    pinCustomers,
    setPinCustomers,
    suppliers,
    setSuppliers,
    paymentSources,
    setPaymentSources,
    setCapitalInvestments,
    cashTransactions,
    setCashTransactions,
    addCashTransaction,
    pinRepairOrders,
    setRepairOrders,

    // services mapping
    upsertPinMaterial: materialsSvc.upsertMaterial,
    deletePinMaterial: materialsSvc.deleteMaterial,
    upsertPinBOM: productionSvc.upsertBOM,
    deletePinBOM: productionSvc.deleteBOM,
    addProductionOrder: productionSvc.addOrder,
    updateProductionOrderStatus: productionSvc.updateOrderStatus,
    completeProductionOrder: productionSvc.completeOrder,
    syncProductsFromCompletedOrders: productionSvc.syncProductsFromCompletedOrders,
    updatePinProduct: productionSvc.updateProduct,
    removePinProductAndReturnMaterials: productionSvc.removeProductAndReturnMaterials,

    handlePinSale: salesSvc.handlePinSale,
    deletePinSale: salesSvc.deletePinSale,
    updatePinSale: salesSvc.updatePinSale,

    upsertPinCustomer: customersSvc.upsertPinCustomer,
    upsertSupplier: suppliersSvc.upsertSupplier,

    // Finance
    upsertPinFixedAsset: financeSvc.upsertPinFixedAsset,
    deletePinFixedAsset: financeSvc.deletePinFixedAsset,
    deletePinCapitalInvestment: financeSvc.deletePinCapitalInvestment,
    upsertPinCapitalInvestment: financeSvc.upsertPinCapitalInvestment,
    deleteCashTransactions: financeSvc.deleteCashTransactions,

    // Repair
    upsertPinRepairOrder: repairSvc.upsertPinRepairOrder,
    deletePinRepairOrder: repairSvc.deleteRepairOrder,

    // Admin
    resetProductionData: adminSvc.resetProductionData,
  } as PinContextType;

  return <PinStandaloneContext.Provider value={value}>{children}</PinStandaloneContext.Provider>;
};

export const usePinStandaloneContext = (): PinContextType => {
  const ctx = useContext(PinStandaloneContext);
  if (!ctx) throw new Error("PinProviderStandalone not found");
  return ctx;
};
