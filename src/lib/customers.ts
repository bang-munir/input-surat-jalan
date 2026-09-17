import { useCallback, useEffect, useState } from "react";
import { fetchCustomers, addCustomer, updateCustomer, deleteCustomer } from "./customers.server";

export type Customer = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchCustomers();
    setCustomers(data);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (data: Omit<Customer, "id">) => {
      await addCustomer({ data });
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (id: string, data: Omit<Customer, "id">) => {
      await updateCustomer({ data: { id, ...data } });
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteCustomer({ data: { id } });
      await load();
    },
    [load],
  );

  return { customers, loaded, addCustomer: add, updateCustomer: update, removeCustomer: remove };
}
