import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCustomers, addCustomer, updateCustomer, deleteCustomer } from "./customers.server";

export type Customer = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

const customersQueryKey = ["customers"] as const;
const STALE_TIME = 10 * 60_000;

export function useCustomers() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: customersQueryKey,
    queryFn: () => fetchCustomers() as unknown as Promise<Customer[]>,
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Customer, "id">) => addCustomer({ data }),
    onSuccess: (record) => {
      queryClient.setQueryData<Customer[]>(customersQueryKey, (current) => [
        ...(current ?? []),
        record as unknown as Customer,
      ]);
      queryClient.invalidateQueries({ queryKey: customersQueryKey, refetchType: "all" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: Omit<Customer, "id"> }) =>
      updateCustomer({ data: { id: vars.id, ...vars.data } }),
    onSuccess: (_result, vars) => {
      queryClient.setQueryData<Customer[]>(customersQueryKey, (current) =>
        (current ?? []).map((c) => (c.id === vars.id ? { ...c, ...vars.data } : c)),
      );
      queryClient.invalidateQueries({ queryKey: customersQueryKey, refetchType: "all" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCustomer({ data: { id } }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Customer[]>(customersQueryKey, (current) =>
        (current ?? []).filter((c) => c.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: customersQueryKey, refetchType: "all" });
    },
  });

  const customers = query.data ?? [];
  const loaded = query.isSuccess;

  const addCustomerCb = useCallback(
    (data: Omit<Customer, "id">) => addMutation.mutateAsync(data),
    [addMutation],
  );
  const updateCustomerCb = useCallback(
    (id: string, data: Omit<Customer, "id">) => updateMutation.mutateAsync({ id, data }),
    [updateMutation],
  );
  const removeCustomerCb = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  return {
    customers,
    loaded,
    addCustomer: addCustomerCb,
    updateCustomer: updateCustomerCb,
    removeCustomer: removeCustomerCb,
  };
}
