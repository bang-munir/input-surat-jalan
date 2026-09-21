import { useQuery } from "@tanstack/react-query";
import {
  fetchBukuPoOrders,
  fetchBukuPoOrderDetail,
  fetchBukuPoCustomers,
  type NormalizedBukuPoOrder,
  type NormalizedBukuPoOrderDetail,
  type NormalizedBukuPoCustomer,
} from "./bukuPo.server";

const bukuPoQueryKey = ["buku-po-orders"] as const;
const STALE_TIME = 5 * 60_000;

export function useBukuPoOrders() {
  const query = useQuery({
    queryKey: bukuPoQueryKey,
    queryFn: async () =>
      (await fetchBukuPoOrders()) as unknown as NormalizedBukuPoOrder[],
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  return {
    orders: (query.data ?? []) as NormalizedBukuPoOrder[],
    loaded: query.isSuccess,
    loading: query.isLoading,
    error: query.isError ? query.error : null,
  };
}

export function useBukuPoOrderDetail(id: string | null) {
  const query = useQuery({
    queryKey: [...bukuPoQueryKey, id],
    queryFn: async () =>
      (await fetchBukuPoOrderDetail({ data: { id: id! } })) as unknown as NormalizedBukuPoOrderDetail,
    enabled: Boolean(id),
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  return {
    order: (query.data ?? null) as NormalizedBukuPoOrderDetail | null,
    loaded: query.isSuccess,
    loading: query.isLoading,
    error: query.isError ? query.error : null,
  };
}

const bukuPoCustomerQueryKey = ["buku-po-customers"] as const;

export function useBukuPoCustomers() {
  const query = useQuery({
    queryKey: bukuPoCustomerQueryKey,
    queryFn: async () =>
      (await fetchBukuPoCustomers()) as unknown as NormalizedBukuPoCustomer[],
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  return {
    customers: (query.data ?? []) as NormalizedBukuPoCustomer[],
    loaded: query.isSuccess,
    loading: query.isLoading,
    error: query.isError ? query.error : null,
  };
}

export type { NormalizedBukuPoOrder, NormalizedBukuPoOrderDetail, NormalizedBukuPoCustomer };
