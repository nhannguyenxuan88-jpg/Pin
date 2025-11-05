/**
 * React Query hooks for data fetching and caching
 * These hooks replace direct Supabase calls and provide automatic caching,
 * revalidation, and error handling
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import type {
  User,
  Part,
  Sale,
  WorkOrder,
  CashTransaction,
  Customer,
} from "../types";

// Query keys for consistent cache management
export const queryKeys = {
  users: ["users"] as const,
  user: (id: string) => ["users", id] as const,
  parts: ["parts"] as const,
  part: (id: string) => ["parts", id] as const,
  sales: ["sales"] as const,
  sale: (id: string) => ["sales", id] as const,
  workOrders: ["workOrders"] as const,
  workOrder: (id: string) => ["workOrders", id] as const,
  cashTransactions: ["cashTransactions"] as const,
  customers: ["customers"] as const,
  customer: (id: string) => ["customers", id] as const,
};

/**
 * Hook to fetch all users
 */
export function useUsers(storeId?: string) {
  return useQuery({
    queryKey: storeId ? [...queryKeys.users, storeId] : queryKeys.users,
    queryFn: async () => {
      const query = supabase.from("users").select("*").order("name");

      if (storeId) {
        query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as User[];
    },
  });
}

/**
 * Hook to fetch all parts/products
 */
export function useParts(storeId?: string) {
  return useQuery({
    queryKey: storeId ? [...queryKeys.parts, storeId] : queryKeys.parts,
    queryFn: async () => {
      const query = supabase.from("parts").select("*").order("name");

      if (storeId) {
        query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Part[];
    },
  });
}

/**
 * Hook to fetch all sales
 */
export function useSales(
  storeId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: storeId
      ? [...queryKeys.sales, storeId, startDate, endDate]
      : [...queryKeys.sales, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      if (startDate) {
        query = query.gte("created_at", startDate);
      }

      if (endDate) {
        query = query.lte("created_at", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Sale[];
    },
  });
}

/**
 * Hook to fetch all work orders
 */
export function useWorkOrders(storeId?: string, status?: string) {
  return useQuery({
    queryKey: storeId
      ? [...queryKeys.workOrders, storeId, status]
      : [...queryKeys.workOrders, status],
    queryFn: async () => {
      let query = supabase
        .from("work_orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as WorkOrder[];
    },
  });
}

/**
 * Hook to fetch cash transactions
 */
export function useCashTransactions(
  storeId?: string,
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: storeId
      ? [...queryKeys.cashTransactions, storeId, startDate, endDate]
      : [...queryKeys.cashTransactions, startDate, endDate],
    queryFn: async () => {
      let query = supabase
        .from("cash_transactions")
        .select("*")
        .order("transaction_date", { ascending: false });

      if (storeId) {
        query = query.eq("store_id", storeId);
      }

      if (startDate) {
        query = query.gte("transaction_date", startDate);
      }

      if (endDate) {
        query = query.lte("transaction_date", endDate);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as CashTransaction[];
    },
  });
}

/**
 * Hook to fetch all customers
 */
export function useCustomers(storeId?: string) {
  return useQuery({
    queryKey: storeId ? [...queryKeys.customers, storeId] : queryKeys.customers,
    queryFn: async () => {
      const query = supabase.from("customers").select("*").order("name");

      if (storeId) {
        query.eq("store_id", storeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Customer[];
    },
  });
}

/**
 * Mutation hook for creating/updating a user
 */
export function useUpsertUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (user: Partial<User>) => {
      const { data, error } = await supabase
        .from("users")
        .upsert(user)
        .select()
        .single();

      if (error) throw error;
      return data as User;
    },
    onSuccess: () => {
      // Invalidate and refetch users
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

/**
 * Mutation hook for creating/updating a part
 */
export function useUpsertPart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (part: Partial<Part>) => {
      const { data, error } = await supabase
        .from("parts")
        .upsert(part)
        .select()
        .single();

      if (error) throw error;
      return data as Part;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts });
    },
  });
}

/**
 * Mutation hook for deleting a user
 */
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("users").delete().eq("id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.users });
    },
  });
}

/**
 * Mutation hook for deleting a part
 */
export function useDeletePart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (partId: string) => {
      const { error } = await supabase.from("parts").delete().eq("id", partId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.parts });
    },
  });
}
