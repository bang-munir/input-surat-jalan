import { useCallback, useEffect, useState } from "react";
import { fetchNota, addNota, updateNota, deleteNota } from "./notaStorage.server";

export type NotaItem = {
  quantity: string;
  name: string;
  description: string;
  price: number;
  total: number;
};

export type NotaRecord = {
  id: string;
  nomor: string;
  tanggal: string;
  suratJalanId: string;
  suratJalanNomor: string;
  pengirim: string;
  penerima: string;
  items: NotaItem[];
  subtotal: number;
  potong: number;
  total: number;
  createdAt: string;
};

function generateNomor(records: NotaRecord[]): string {
  const used = new Set(records.map((r) => r.nomor));
  let nomor: string;
  do {
    const n = Math.floor(Math.random() * 10000);
    nomor = `NT-${String(n).padStart(4, "0")}`;
  } while (used.has(nomor));
  return nomor;
}

export function useNotaRecords() {
  const [records, setRecords] = useState<NotaRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchNota();
    setRecords(data as NotaRecord[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRecord = useCallback(
    async (data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => {
      const nomor = generateNomor(records);
      const inserted = await addNota({ data: { ...data, nomor } });
      // Optimistically update state without full reload
      setRecords((prev) => [...prev, inserted as NotaRecord]);
    },
    [records, setRecords],
  );

  const updateRecord = useCallback(
    async (id: string, data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => {
      await updateNota({ data: { id, ...data } });
      await load();
    },
    [load],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      await deleteNota({ data: { id } });
      await load();
    },
    [load],
  );

  const getRecord = useCallback((id: string) => {
    return records.find((r) => r.id === id) || null;
  }, [records]);

  return { records, loaded, addRecord, updateRecord, removeRecord, getRecord };
}
