import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  supabase,
  IS_OFFLINE_MODE,
  DEV_AUTH_BYPASS,
} from "../supabaseClient";
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
} from "../types";
import { createMaterialsService } from "../lib/services/MaterialsService";
import { createProductionService } from "../lib/services/ProductionService";
import { createSalesService } from "../lib/services/SalesService";
import { createCustomersService } from "../lib/services/CustomersService";
import { createSuppliersService } from "../lib/services/SuppliersService";
import { createRepairService } from "../lib/services/RepairService";
import { createProductionAdminService } from "../lib/services/ProductionAdminService";
import { createFinanceService } from "../lib/services/FinanceService";

// Export the standalone context so legacy hooks can bridge to it
export const PinStandaloneContext = createContext<PinContextType | null>(null);

export const PinProviderStandalone: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Auth
  const [currentUser, setCurrentUser] = useState<any | null>(null);

  // Core store settings (keep minimal; can be extended later)
  const [storeSettings, setStoreSettings] = useState<any>({
    name: "PinCorp",
    branches: [{ id: "main", name: "Chi nhánh chính" }],
  });

  // Toast shim
  const addToast: PinContextType["addToast"] = (t: any) => {
    try {
      // eslint-disable-next-line no-console
      console[
        t?.type === "error" ? "error" : t?.type === "warn" ? "warn" : "log"
      ]?.(`[${t?.type || "info"}] ${t?.title || ""}: ${t?.message || ""}`);
    } catch {}
  };

  // PIN state
  const [pinMaterials, setPinMaterials] = useState<PinMaterial[]>([]);
  const [pinMaterialHistory, setPinMaterialHistory] = useState<any[]>([]);
  const [pinBOMs, setBoms] = useState<PinBOM[]>([]);
  const [productionOrders, setProductionOrders] = useState<ProductionOrder[]>(
    []
  );
  const [pinProducts, setPinProducts] = useState<PinProduct[]>([]);
  const [pinSales, setPinSales] = useState<PinSale[]>([]);
  const [pinCartItems, setPinCartItems] = useState<PinCartItem[]>([]);
  const [pinCustomers, setPinCustomers] = useState<PinCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [paymentSources, setPaymentSources] = useState<any[]>([
    { id: "cash", name: "Tiền mặt", balance: { main: 0 }, isDefault: true },
    {
      id: "bank",
      name: "Chuyển khoản",
      balance: { main: 0 },
      isDefault: false,
    },
  ]);
  const [cashTransactions, setCashTransactions] = useState<CashTransaction[]>(
    []
  );
  const [fixedAssets, setFixedAssets] = useState<FixedAsset[]>([]);
  const [capitalInvestments, setCapitalInvestments] = useState<
    CapitalInvestment[]
  >([]);
  const [pinRepairOrders, setRepairOrders] = useState<any[]>([]);

  // Simple helpers
  const reloadPinMaterialHistory = async () => {
    if (IS_OFFLINE_MODE || !currentUser) return;
    try {
      const { data, error } = await supabase
        .from("pincorp_stock_history")
        .select("*")
        .order("created_at", { ascending: false });
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
      // Normalize minimal payload (stringify contact if object)
      const payload: any = { ...tx } as any;
      if (payload.contact && typeof payload.contact !== "string") {
        try {
          payload.contact = JSON.stringify(payload.contact);
        } catch {}
      }
      // No created_by for this table in our schema
      delete payload.created_by;

      const { error } = await supabase.from("cashtransactions").upsert(payload);
      if (error) {
        // Retry without category if missing
        if (
          /category/i.test(error.message || "") &&
          /(column|not exist|schema cache)/i.test(error.message || "")
        ) {
          const retryPayload = { ...payload };
          delete (retryPayload as any).category;
          const { error: retryErr } = await supabase
            .from("cashtransactions")
            .upsert(retryPayload);
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
    } catch (e: any) {
      addToast?.({
        title: "Lỗi lưu sổ quỹ",
        message: e?.message || String(e),
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
      if (u)
        setCurrentUser({ id: u.id, name: u.user_metadata?.name || u.email });
      else setCurrentUser(null);
    });
    const { data } = supabase.auth.onAuthStateChange((_e, session) => {
      const u = session?.user;
      if (u)
        setCurrentUser({ id: u.id, name: u.user_metadata?.name || u.email });
      else setCurrentUser(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // Initial fetch for core PIN datasets (finance + BOM + materials/products/orders)
  useEffect(() => {
    const fetchPinFinance = async () => {
      if (IS_OFFLINE_MODE || !currentUser) return;
      try {
        const [fa, ci, ct, bomsRes, matsRes, prodsRes, ordersRes] =
          await Promise.all([
            supabase.from("pincorp_fixed_assets").select("*"),
            supabase.from("pincorp_capital_investments").select("*"),
            supabase
              .from("cashtransactions")
              .select("*")
              .order("date", { ascending: false }),
            supabase.from("pincorp_boms").select("*"),
            supabase.from("pincorp_materials").select("*"),
            supabase.from("pincorp_products").select("*"),
            supabase
              .from("pincorp_productionorders")
              .select("*")
              .order("created_at", { ascending: false }),
          ]);
        if (!fa.error) setFixedAssets((fa.data as any[]) || []);
        if (!ci.error) setCapitalInvestments((ci.data as any[]) || []);
        if (!ct.error) {
          const mapDbCashTxToUi = (row: any): CashTransaction => {
            let contact: any = row?.contact;
            if (typeof contact === "string") {
              try {
                contact = JSON.parse(contact);
              } catch {}
            }
            return {
              id: row.id,
              type: (row.type as CashTransaction["type"]) || "income",
              date: String(
                row.date ||
                  row.created_at ||
                  row.createdat ||
                  new Date().toISOString()
              ),
              amount: Number(row.amount ?? 0),
              contact: contact || { id: "", name: "" },
              notes: row.notes || row.description || "",
              category: row.category || undefined,
              paymentSourceId:
                row.paymentsourceid ||
                row.payment_source_id ||
                row.paymentSourceId ||
                "cash",
              branchId: row.branchid || row.branch_id || row.branchId || "main",
              saleId: row.saleid || row.sale_id || row.saleId || undefined,
              workOrderId:
                row.workorderid ||
                row.work_order_id ||
                row.workOrderId ||
                undefined,
              created_at: row.created_at || row.createdat || undefined,
            } as CashTransaction;
          };
          setCashTransactions(((ct.data as any[]) || []).map(mapDbCashTxToUi));
        }
        if (!bomsRes.error) {
          const mapDbBomToUi = (row: any): PinBOM => ({
            id: row.id,
            productName: row.productname || row.product_name || row.productName,
            productSku: row.productsku || row.product_sku || row.productSku,
            materials: Array.isArray(row.materials) ? row.materials : [],
            notes: row.notes || undefined,
            created_at: row.created_at || row.createdat || undefined,
          });
          setBoms(((bomsRes.data as any[]) || []).map(mapDbBomToUi));
        }
        if (!matsRes.error) {
          const mapDbMatToUi = (row: any) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            unit: row.unit,
            purchasePrice: Number(row.purchaseprice ?? row.purchase_price ?? 0),
            retailPrice:
              Number(
                row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0
              ) || undefined,
            wholesalePrice:
              Number(row.wholesaleprice ?? row.wholesale_price ?? 0) ||
              undefined,
            stock: Number(row.stock ?? 0),
            committedQuantity:
              Number(row.committedquantity ?? row.committed_quantity ?? 0) ||
              undefined,
            supplier: row.supplier || undefined,
            description: row.description || undefined,
            created_at: row.created_at || row.createdat || undefined,
          });
          setPinMaterials(((matsRes.data as any[]) || []).map(mapDbMatToUi));
        }
        if (!prodsRes.error) {
          const mapDbProdToUi = (row: any) => ({
            id: row.id,
            name: row.name,
            sku: row.sku,
            stock: Number(row.stock ?? 0),
            costPrice: Number(row.costprice ?? row.cost_price ?? 0),
            retailPrice: Number(
              row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0
            ),
            wholesalePrice: Number(
              row.wholesaleprice ??
                row.wholesale_price ??
                Math.round(
                  (Number(
                    row.retailprice ?? row.retail_price ?? row.sellingprice ?? 0
                  ) || 0) * 0.9
                )
            ),
            sellingPrice: Number(row.sellingprice ?? 0) || undefined,
            created_at: row.created_at || row.createdat || undefined,
          });
          setPinProducts(((prodsRes.data as any[]) || []).map(mapDbProdToUi));
        }
        if (!ordersRes.error) {
          const mapDbOrderToUi = (row: any): ProductionOrder => ({
            id: row.id,
            creationDate:
              row.creationdate ||
              row.creation_date ||
              row.created_at ||
              new Date().toISOString(),
            bomId: row.bomid || row.bom_id || row.bomId,
            productName: row.productname || row.product_name || row.productName,
            quantityProduced: Number(
              row.quantityproduced ?? row.quantity_produced ?? 0
            ),
            status: (row.status as ProductionOrder["status"]) || "Đang chờ",
            materialsCost: Number(row.materialscost ?? row.materials_cost ?? 0),
            additionalCosts: Array.isArray(row.additionalcosts)
              ? row.additionalcosts
              : [],
            totalCost: Number(row.totalcost ?? row.total_cost ?? 0),
            notes: row.notes || undefined,
            userName: row.username || row.user_name || undefined,
            created_at: row.created_at || row.createdat || undefined,
          });
          setProductionOrders(
            ((ordersRes.data as any[]) || []).map(mapDbOrderToUi)
          );
        }
      } catch (e) {
        // ignore
      }
    };
    fetchPinFinance();
  }, [currentUser]);

  // Build services using this standalone context
  const ctxForServices: any = {
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

  const materialsSvc = useMemo(
    () => createMaterialsService(ctxForServices),
    [ctxForServices]
  );
  const productionSvc = useMemo(
    () => createProductionService(ctxForServices),
    [ctxForServices]
  );
  const salesSvc = useMemo(
    () => createSalesService(ctxForServices),
    [ctxForServices]
  );
  const customersSvc = useMemo(
    () => createCustomersService(ctxForServices),
    [ctxForServices]
  );
  const suppliersSvc = useMemo(
    () => createSuppliersService(ctxForServices),
    [ctxForServices]
  );
  const repairSvc = useMemo(
    () => createRepairService(ctxForServices),
    [ctxForServices]
  );
  const adminSvc = useMemo(
    () => createProductionAdminService(ctxForServices),
    [ctxForServices]
  );
  const financeSvc = useMemo(
    () => createFinanceService(ctxForServices),
    [ctxForServices]
  );

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
    syncProductsFromCompletedOrders:
      productionSvc.syncProductsFromCompletedOrders,
    updatePinProduct: productionSvc.updateProduct,
    removePinProductAndReturnMaterials:
      productionSvc.removeProductAndReturnMaterials,

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
    deletePinRepairOrder: repairSvc.deletePinRepairOrder,

    // Admin
    resetProductionData: adminSvc.resetProductionData,
  } as any;

  return (
    <PinStandaloneContext.Provider value={value}>
      {children}
    </PinStandaloneContext.Provider>
  );
};

export const usePinStandaloneContext = (): PinContextType => {
  const ctx = useContext(PinStandaloneContext);
  if (!ctx) throw new Error("PinProviderStandalone not found");
  return ctx;
};
