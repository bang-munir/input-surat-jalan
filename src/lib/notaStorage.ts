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
  suratJalanId: string | null;
  suratJalanNomor: string;
  pengirim: string;
  penerima: string;
  alamat: string;
  telepon: string;
  items: NotaItem[];
  subtotal: number;
  potong: number;
  total: number;
  /**
   * Kolom milik Nota sendiri (`nota.show_signature`), bukan turunan Surat Jalan.
   * Hanya dibaca saat membuat PDF dan di-/off-kan lewat switch di form Nota.
   */
  showSignature: boolean;
  createdAt: string;
};

/** Field Nota yang boleh dikirim form create/update. */
export type NotaEditableFields = Omit<NotaRecord, "id" | "nomor" | "createdAt">;

const notaQueryKey = ["nota"] as const;
const STALE_TIME = 60_000;

export type SuratJalanSearchRecord = {
  nomor: string;
  pengirim: string;
  kepada: string;
  tanggal: string;
  invoiceNumber?: string | null;
};

/**
 * Pencarian pada layar pilih Surat Jalan untuk Nota. `invoiceNumber` ikut
 * dicari supaya user dapat mengetik nomor PO (PO-4827) dan tetap menemukan
 * Surat Jalan yang lahir dari PO tersebut.
 */
export function matchesSuratJalanSearch(sj: SuratJalanSearchRecord, query: string): boolean {
  const haystack = `${sj.nomor} ${sj.pengirim} ${sj.kepada} ${sj.tanggal} ${sj.invoiceNumber ?? ""}`;
  return haystack.toLowerCase().includes(query.toLowerCase());
}

/** Pesan toast untuk kegagalan addNota. `code` menyeberangi transport server fn. */
export function notaCreateErrorMessage(error: unknown): string {
  const failure = (typeof error === "object" && error !== null ? error : {}) as {
    code?: unknown;
    message?: unknown;
  };
  const code = typeof failure.code === "string" ? failure.code : "";
  const message = typeof failure.message === "string" ? failure.message : "";

  if (code === "SJ_HAS_NOTA" || message.includes("sudah memiliki Nota")) {
    return "Surat Jalan ini sudah punya Nota. Satu Surat Jalan hanya boleh menghasilkan satu Nota.";
  }
  if (code === "SJ_NOT_FOUND") {
    return "Surat Jalan tidak ditemukan. Muat ulang halaman lalu pilih Surat Jalan lain.";
  }
  if (code === "SJ_REQUIRED") {
    return "Pilih Surat Jalan dulu sebelum menyimpan Nota.";
  }
  return "Gagal membuat Nota";
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
    mutationFn: (data: NotaEditableFields) => addNota({ data }),
    onSuccess: (record) => {
      queryClient.setQueryData<NotaRecord[]>(notaQueryKey, (current) => [
        ...(current ?? []),
        record as unknown as NotaRecord,
      ]);
      queryClient.invalidateQueries({ queryKey: notaQueryKey, refetchType: "all" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: NotaEditableFields }) =>
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
    (data: NotaEditableFields) => addMutation.mutateAsync(data),
    [addMutation],
  );
  const updateRecord = useCallback(
    (id: string, data: NotaEditableFields) => updateMutation.mutateAsync({ id, data }),
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
