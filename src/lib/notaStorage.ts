import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const notaQueryKey = ["nota"] as const;
const STALE_TIME = 60_000;

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
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: notaQueryKey,
    queryFn: async () => (await fetchNota()) as unknown as NotaRecord[],
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => {
      const current = queryClient.getQueryData<NotaRecord[]>(notaQueryKey) ?? [];
      const nomor = generateNomor(current);
      return addNota({ data: { ...data, nomor } });
    },
    onSuccess: (record) => {
      queryClient.setQueryData<NotaRecord[]>(notaQueryKey, (current) => [
        ...(current ?? []),
        record as unknown as NotaRecord,
      ]);
      queryClient.invalidateQueries({ queryKey: notaQueryKey, refetchType: "all" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: Omit<NotaRecord, "id" | "nomor" | "createdAt"> }) =>
      updateNota({ data: { id: vars.id, ...vars.data } }),
    onSuccess: (_result, vars) => {
      queryClient.setQueryData<NotaRecord[]>(notaQueryKey, (current) =>
        (current ?? []).map((r) => (r.id === vars.id ? { ...r, ...vars.data } : r)),
      );
      queryClient.invalidateQueries({ queryKey: notaQueryKey, refetchType: "all" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteNota({ data: { id } }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<NotaRecord[]>(notaQueryKey, (current) =>
        (current ?? []).filter((r) => r.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: notaQueryKey, refetchType: "all" });
    },
  });

  const records = useMemo(() => query.data ?? [], [query.data]);
  const loaded = query.isSuccess;

  const addRecord = useCallback(
    (data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => addMutation.mutateAsync(data),
    [addMutation],
  );
  const updateRecord = useCallback(
    (id: string, data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) =>
      updateMutation.mutateAsync({ id, data }),
    [updateMutation],
  );
  const removeRecord = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );
  const getRecord = useCallback(
    (id: string) => records.find((r) => r.id === id) ?? null,
    [records],
  );

  return { records, loaded, addRecord, updateRecord, removeRecord, getRecord };
}
