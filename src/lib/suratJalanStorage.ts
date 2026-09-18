import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

const suratJalanQueryKey = ["surat-jalan"] as const;
const STALE_TIME = 30_000;

export function useSuratJalanRecords() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: suratJalanQueryKey,
    queryFn: async () => (await fetchSuratJalan()) as unknown as SuratJalanRecord[],
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<SuratJalanRecord, "id" | "createdAt">) => addSuratJalan({ data }),
    onSuccess: (record) => {
      queryClient.setQueryData<SuratJalanRecord[]>(suratJalanQueryKey, (current) => [
        ...(current ?? []),
        record as unknown as SuratJalanRecord,
      ]);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: {
      id: string;
      data: Omit<SuratJalanRecord, "id" | "createdAt" | "nomor">;
    }) => updateSuratJalan({ data: { id: vars.id, ...vars.data } }),
    onSuccess: (_result, vars) => {
      queryClient.setQueryData<SuratJalanRecord[]>(suratJalanQueryKey, (current) =>
        (current ?? []).map((r) => (r.id === vars.id ? { ...r, ...vars.data } : r)),
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSuratJalan({ data: { id } }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<SuratJalanRecord[]>(suratJalanQueryKey, (current) =>
        (current ?? []).filter((r) => r.id !== id),
      );
    },
  });

  const records = useMemo(() => query.data ?? [], [query.data]);
  const loaded = query.isSuccess;

  const addRecord = useCallback(
    (data: Omit<SuratJalanRecord, "id" | "createdAt">) => addMutation.mutateAsync(data),
    [addMutation],
  );
  const updateRecord = useCallback(
    (id: string, data: Omit<SuratJalanRecord, "id" | "createdAt" | "nomor">) =>
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

  return { records, loaded, addRecord, removeRecord, updateRecord, getRecord };
}
