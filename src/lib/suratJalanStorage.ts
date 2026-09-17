import { useCallback, useEffect, useState } from "react";
import {
  fetchSuratJalan,
  addSuratJalan,
  deleteSuratJalan,
  updateSuratJalan,
} from "./suratJalanStorage.server";

export type SuratJalanItem = {
  quantity: string;
  name: string;
  description: string;
};

export type SuratJalanRecord = {
  id: string;
  nomor: string;
  tanggal: string;
  pengirim: string;
  teleponPengirim: string;
  alamatPengirim: string;
  kepada: string;
  telepon: string;
  alamat: string;
  items: SuratJalanItem[];
  createdAt: string;
};

export function useSuratJalanRecords() {
  const [records, setRecords] = useState<SuratJalanRecord[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const data = await fetchSuratJalan();
    setRecords(data as SuratJalanRecord[]);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const addRecord = useCallback(
    async (data: Omit<SuratJalanRecord, "id" | "createdAt">) => {
      const item = await addSuratJalan({ data });
      await load();
      return item as SuratJalanRecord;
    },
    [load],
  );

  const updateRecord = useCallback(
    async (id: string, data: Omit<SuratJalanRecord, "id" | "createdAt" | "nomor">) => {
      await updateSuratJalan({ data: { id, ...data } });
      await load();
    },
    [load],
  );

  const removeRecord = useCallback(
    async (id: string) => {
      await deleteSuratJalan({ data: { id } });
      await load();
    },
    [load],
  );

  const getRecord = useCallback(
    (id: string) => {
      return records.find((r) => r.id === id) || null;
    },
    [records],
  );

  return { records, loaded, addRecord, removeRecord, updateRecord, getRecord };
}
