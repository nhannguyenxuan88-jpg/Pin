import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../supabaseClient";
import type { AuditLog, AuditStats } from "../../types";

/**
 * Hook to fetch audit logs with filtering
 * @param filters - Optional filters for table, operation, user, date range
 * @param limit - Maximum number of logs to fetch (default: 100)
 */
export function useAuditLogs(
  filters?: {
    table_name?: string;
    operation?: string;
    user_id?: string;
    start_date?: string;
    end_date?: string;
    search?: string;
  },
  limit: number = 100
) {
  return useQuery({
    queryKey: ["audit-logs", filters, limit],
    queryFn: async () => {
      let query = supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      // Apply filters
      if (filters?.table_name) {
        query = query.eq("table_name", filters.table_name);
      }
      if (filters?.operation) {
        query = query.eq("operation", filters.operation);
      }
      if (filters?.user_id) {
        query = query.eq("user_id", filters.user_id);
      }
      if (filters?.start_date) {
        query = query.gte("created_at", filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte("created_at", filters.end_date);
      }
      if (filters?.search) {
        query = query.or(
          `record_id.ilike.%${filters.search}%,user_email.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching audit logs:", error);
        throw error;
      }

      return (data || []) as AuditLog[];
    },
    staleTime: 1000 * 60, // 1 minute - logs are relatively static
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch audit trail for a specific record
 * @param tableName - Name of the table
 * @param recordId - ID of the record
 */
export function useAuditTrail(tableName?: string, recordId?: string) {
  return useQuery({
    queryKey: ["audit-trail", tableName, recordId],
    queryFn: async () => {
      if (!tableName || !recordId) {
        return [];
      }

      const { data, error } = await supabase.rpc("get_audit_trail", {
        p_table_name: tableName,
        p_record_id: recordId,
      });

      if (error) {
        console.error("Error fetching audit trail:", error);
        throw error;
      }

      return data || [];
    },
    enabled: !!tableName && !!recordId,
    staleTime: 1000 * 60, // 1 minute
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to fetch recent activity
 * @param hours - Number of hours to look back (default: 24)
 * @param limit - Maximum number of activities (default: 50)
 */
export function useRecentActivity(hours: number = 24, limit: number = 50) {
  return useQuery({
    queryKey: ["recent-activity", hours, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_recent_activity", {
        p_hours: hours,
        p_limit: limit,
      });

      if (error) {
        console.error("Error fetching recent activity:", error);
        throw error;
      }

      return data || [];
    },
    staleTime: 1000 * 30, // 30 seconds - recent activity should refresh more often
    gcTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60, // Auto-refresh every minute
  });
}

/**
 * Hook to fetch audit statistics
 * @param startDate - Start date for statistics (optional)
 * @param endDate - End date for statistics (optional)
 */
export function useAuditStats(startDate?: string, endDate?: string) {
  return useQuery({
    queryKey: ["audit-stats", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_audit_stats", {
        p_start_date: startDate || null,
        p_end_date: endDate || null,
      });

      if (error) {
        console.error("Error fetching audit stats:", error);
        throw error;
      }

      return (data || []) as AuditStats[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes - stats don't change frequently
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Helper function to get human-readable table name
 */
export function getTableDisplayName(tableName: string): string {
  const tableNames: Record<string, string> = {
    motocare_customers: "Khách hàng",
    motocare_sales: "Bán hàng",
    motocare_workorders: "Lệnh sửa chữa",
    motocare_parts: "Phụ tùng",
    cashtransactions: "Giao dịch tiền",
    profiles: "Người dùng",
    pincorp_materials: "Nguyên liệu",
    pincorp_productionbatches: "Đợt sản xuất",
    pincorp_products: "Sản phẩm",
    pincorp_variants: "Biến thể",
    pincorp_repairs: "Sửa chữa",
  };
  return tableNames[tableName] || tableName;
}

/**
 * Helper function to get operation display name with color
 */
export function getOperationDisplay(operation: string): {
  label: string;
  color: string;
  icon: string;
} {
  const operations: Record<
    string,
    { label: string; color: string; icon: string }
  > = {
    INSERT: { label: "Thêm mới", color: "green", icon: "plus" },
    UPDATE: { label: "Cập nhật", color: "blue", icon: "edit" },
    DELETE: { label: "Xóa", color: "red", icon: "trash" },
  };
  return (
    operations[operation] || {
      label: operation,
      color: "gray",
      icon: "question",
    }
  );
}

/**
 * Helper function to format changed fields for display
 */
export function formatChangedFields(
  changedFields: string[] | null | undefined
): string {
  if (!changedFields || changedFields.length === 0) {
    return "Không có thay đổi";
  }

  const fieldNames: Record<string, string> = {
    name: "Tên",
    phone: "Điện thoại",
    email: "Email",
    address: "Địa chỉ",
    status: "Trạng thái",
    total: "Tổng tiền",
    paid: "Đã thanh toán",
    date: "Ngày",
    items: "Sản phẩm",
    stock: "Tồn kho",
    price: "Giá",
    sellingPrice: "Giá bán",
    description: "Mô tả",
    notes: "Ghi chú",
  };

  return changedFields.map((field) => fieldNames[field] || field).join(", ");
}

/**
 * Helper function to get diff between old and new data
 */
export function getDiff(
  oldData: Record<string, any> | null | undefined,
  newData: Record<string, any> | null | undefined,
  changedFields: string[] | null | undefined
): Array<{
  field: string;
  displayName: string;
  oldValue: any;
  newValue: any;
}> {
  if (!changedFields || changedFields.length === 0) {
    return [];
  }

  const fieldNames: Record<string, string> = {
    name: "Tên",
    phone: "Điện thoại",
    email: "Email",
    address: "Địa chỉ",
    status: "Trạng thái",
    total: "Tổng tiền",
    paid: "Đã thanh toán",
    date: "Ngày",
    items: "Sản phẩm",
    stock: "Tồn kho",
    price: "Giá",
    sellingPrice: "Giá bán",
    description: "Mô tả",
    notes: "Ghi chú",
  };

  return changedFields.map((field) => ({
    field,
    displayName: fieldNames[field] || field,
    oldValue: oldData?.[field],
    newValue: newData?.[field],
  }));
}
