import { useCallback, useEffect, useState } from "react";

export type Customer = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

const KEY = "surat-jalan:customers";

function read(): Customer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Customer[]) : [];
  } catch {
    return [];
  }
}

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setCustomers(read());
    setLoaded(true);
  }, []);

  const persist = useCallback((next: Customer[]) => {
    setCustomers(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage penuh / diblokir */
    }
  }, []);

  const addCustomer = useCallback(
    (data: Omit<Customer, "id">) => {
      const item: Customer = { ...data, id: crypto.randomUUID() };
      persist([...read(), item]);
      return item;
    },
    [persist],
  );

  const updateCustomer = useCallback(
    (id: string, data: Omit<Customer, "id">) => {
      persist(read().map((c) => (c.id === id ? { ...data, id } : c)));
    },
    [persist],
  );

  const removeCustomer = useCallback(
    (id: string) => {
      persist(read().filter((c) => c.id !== id));
    },
    [persist],
  );

  return { customers, loaded, addCustomer, updateCustomer, removeCustomer };
}
