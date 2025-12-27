/**
 * Purchase Order Service - Quản lý đơn đặt hàng NCC
 */
import { supabase } from "../../supabaseClient";
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from "../../types";

// Generate PO code: PO-YYYYMMDD-XXX
function generatePOCode(): string {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
    const randomNum = Math.floor(Math.random() * 900) + 100;
    return `PO-${dateStr}-${randomNum}`;
}

// DB row to UI mapping
interface DBPurchaseOrder {
    id: string;
    code: string;
    supplier_id?: string;
    supplier_name: string;
    status: PurchaseOrderStatus;
    total_amount: number;
    paid_amount: number;
    notes?: string;
    expected_date?: string;
    received_date?: string;
    created_by?: string;
    created_at?: string;
    updated_at?: string;
}

interface DBPurchaseOrderItem {
    id: string;
    purchase_order_id: string;
    material_id: string;
    material_name: string;
    material_sku?: string;
    quantity: number;
    unit?: string;
    unit_price: number;
    total_price: number;
    received_quantity: number;
    created_at?: string;
}

function mapDbToOrder(row: DBPurchaseOrder, items: PurchaseOrderItem[] = []): PurchaseOrder {
    return {
        id: row.id,
        code: row.code,
        supplierId: row.supplier_id,
        supplierName: row.supplier_name,
        status: row.status,
        totalAmount: Number(row.total_amount || 0),
        paidAmount: Number(row.paid_amount || 0),
        notes: row.notes,
        expectedDate: row.expected_date,
        receivedDate: row.received_date,
        items,
        createdBy: row.created_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function mapDbToItem(row: DBPurchaseOrderItem): PurchaseOrderItem {
    return {
        id: row.id,
        purchaseOrderId: row.purchase_order_id,
        materialId: row.material_id,
        materialName: row.material_name,
        materialSku: row.material_sku,
        quantity: row.quantity,
        unit: row.unit,
        unitPrice: Number(row.unit_price || 0),
        totalPrice: Number(row.total_price || 0),
        receivedQuantity: row.received_quantity || 0,
        created_at: row.created_at,
    };
}

export const PurchaseOrderService = {
    /**
     * Lấy danh sách đơn đặt hàng
     */
    async getOrders(status?: PurchaseOrderStatus): Promise<PurchaseOrder[]> {
        let query = supabase
            .from("pin_purchase_orders")
            .select("*")
            .order("created_at", { ascending: false });

        if (status) {
            query = query.eq("status", status);
        }

        const { data: orders, error } = await query;
        if (error) {
            console.error("Error fetching purchase orders:", error);
            return [];
        }

        // Fetch items for each order
        const orderIds = (orders || []).map((o: DBPurchaseOrder) => o.id);
        const { data: items } = await supabase
            .from("pin_purchase_order_items")
            .select("*")
            .in("purchase_order_id", orderIds);

        const itemsByOrder = (items || []).reduce((acc: Record<string, PurchaseOrderItem[]>, item: DBPurchaseOrderItem) => {
            const orderId = item.purchase_order_id;
            if (!acc[orderId]) acc[orderId] = [];
            acc[orderId].push(mapDbToItem(item));
            return acc;
        }, {});

        return (orders || []).map((o: DBPurchaseOrder) => mapDbToOrder(o, itemsByOrder[o.id] || []));
    },

    /**
     * Lấy 1 đơn theo ID
     */
    async getOrderById(id: string): Promise<PurchaseOrder | null> {
        const { data: order, error } = await supabase
            .from("pin_purchase_orders")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !order) return null;

        const { data: items } = await supabase
            .from("pin_purchase_order_items")
            .select("*")
            .eq("purchase_order_id", id);

        return mapDbToOrder(order as DBPurchaseOrder, (items || []).map((i: DBPurchaseOrderItem) => mapDbToItem(i)));
    },

    /**
     * Tạo đơn đặt hàng mới
     */
    async createOrder(order: Omit<PurchaseOrder, "id" | "code" | "created_at">): Promise<PurchaseOrder | null> {
        const id = crypto.randomUUID();
        const code = generatePOCode();

        const totalAmount = order.items.reduce((sum, item) => sum + item.totalPrice, 0);

        const { error: orderError } = await supabase.from("pin_purchase_orders").insert({
            id,
            code,
            supplier_id: order.supplierId,
            supplier_name: order.supplierName,
            status: order.status || "draft",
            total_amount: totalAmount,
            paid_amount: order.paidAmount || 0,
            notes: order.notes,
            expected_date: order.expectedDate,
            created_by: order.createdBy,
        });

        if (orderError) {
            console.error("Error creating purchase order:", orderError);
            return null;
        }

        // Insert items
        if (order.items.length > 0) {
            const itemsToInsert = order.items.map((item) => ({
                id: crypto.randomUUID(),
                purchase_order_id: id,
                material_id: item.materialId,
                material_name: item.materialName,
                material_sku: item.materialSku,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unitPrice,
                total_price: item.quantity * item.unitPrice,
                received_quantity: 0,
            }));

            const { error: itemsError } = await supabase
                .from("pin_purchase_order_items")
                .insert(itemsToInsert);

            if (itemsError) {
                console.error("Error creating purchase order items:", itemsError);
            }
        }

        return this.getOrderById(id);
    },

    /**
     * Cập nhật đơn đặt hàng
     */
    async updateOrder(id: string, updates: Partial<PurchaseOrder>): Promise<boolean> {
        const payload: Partial<DBPurchaseOrder> = {};

        if (updates.supplierId !== undefined) payload.supplier_id = updates.supplierId;
        if (updates.supplierName !== undefined) payload.supplier_name = updates.supplierName;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.totalAmount !== undefined) payload.total_amount = updates.totalAmount;
        if (updates.paidAmount !== undefined) payload.paid_amount = updates.paidAmount;
        if (updates.notes !== undefined) payload.notes = updates.notes;
        if (updates.expectedDate !== undefined) payload.expected_date = updates.expectedDate;
        if (updates.receivedDate !== undefined) payload.received_date = updates.receivedDate;
        payload.updated_at = new Date().toISOString();

        const { error } = await supabase
            .from("pin_purchase_orders")
            .update(payload)
            .eq("id", id);

        if (error) {
            console.error("Error updating purchase order:", error);
            return false;
        }

        // Update items if provided
        if (updates.items) {
            // Delete existing items
            await supabase.from("pin_purchase_order_items").delete().eq("purchase_order_id", id);

            // Insert new items
            const itemsToInsert = updates.items.map((item) => ({
                id: item.id || crypto.randomUUID(),
                purchase_order_id: id,
                material_id: item.materialId,
                material_name: item.materialName,
                material_sku: item.materialSku,
                quantity: item.quantity,
                unit: item.unit,
                unit_price: item.unitPrice,
                total_price: item.quantity * item.unitPrice,
                received_quantity: item.receivedQuantity || 0,
            }));

            if (itemsToInsert.length > 0) {
                await supabase.from("pin_purchase_order_items").insert(itemsToInsert);
            }

            // Update total
            const newTotal = updates.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
            await supabase.from("pin_purchase_orders").update({ total_amount: newTotal }).eq("id", id);
        }

        return true;
    },

    /**
     * Xóa đơn đặt hàng (chỉ nháp)
     */
    async deleteOrder(id: string): Promise<boolean> {
        // Check status first
        const { data: order } = await supabase
            .from("pin_purchase_orders")
            .select("status")
            .eq("id", id)
            .single();

        if (order?.status !== "draft" && order?.status !== "cancelled") {
            console.error("Can only delete draft or cancelled orders");
            return false;
        }

        const { error } = await supabase.from("pin_purchase_orders").delete().eq("id", id);
        return !error;
    },

    /**
     * Xác nhận đơn (chuyển từ draft -> confirmed)
     */
    async confirmOrder(id: string): Promise<boolean> {
        return this.updateOrder(id, { status: "confirmed" });
    },

    /**
     * Nhận hàng (có thể nhận 1 phần hoặc toàn bộ)
     */
    async receiveOrder(
        id: string,
        receivedItems: { itemId: string; quantity: number }[]
    ): Promise<boolean> {
        // Update received quantities for each item
        for (const received of receivedItems) {
            const { error } = await supabase
                .from("pin_purchase_order_items")
                .update({ received_quantity: received.quantity })
                .eq("id", received.itemId);

            if (error) {
                console.error("Error updating received quantity:", error);
            }
        }

        // Check if all items fully received
        const { data: items } = await supabase
            .from("pin_purchase_order_items")
            .select("quantity, received_quantity")
            .eq("purchase_order_id", id);

        const allReceived = (items || []).every(
            (item: { quantity: number; received_quantity: number }) =>
                item.received_quantity >= item.quantity
        );
        const someReceived = (items || []).some(
            (item: { quantity: number; received_quantity: number }) =>
                item.received_quantity > 0
        );

        let newStatus: PurchaseOrderStatus = "confirmed";
        if (allReceived) {
            newStatus = "received";
        } else if (someReceived) {
            newStatus = "partial";
        }

        return this.updateOrder(id, {
            status: newStatus,
            receivedDate: allReceived ? new Date().toISOString().slice(0, 10) : undefined
        });
    },

    /**
     * Hủy đơn
     */
    async cancelOrder(id: string): Promise<boolean> {
        return this.updateOrder(id, { status: "cancelled" });
    },
};

export default PurchaseOrderService;
