import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSenders, addSender, updateSender, deleteSender } from "./senders.server";

export type Sender = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

const sendersQueryKey = ["senders"] as const;
const STALE_TIME = 10 * 60_000;

export function useSenders() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: sendersQueryKey,
    queryFn: () => fetchSenders() as unknown as Promise<Sender[]>,
    staleTime: STALE_TIME,
    placeholderData: (previous) => previous ?? undefined,
  });

  const addMutation = useMutation({
    mutationFn: (data: Omit<Sender, "id">) => addSender({ data }),
    onSuccess: (record) => {
      queryClient.setQueryData<Sender[]>(sendersQueryKey, (current) => [
        ...(current ?? []),
        record as unknown as Sender,
      ]);
      queryClient.invalidateQueries({ queryKey: sendersQueryKey, refetchType: "all" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; data: Omit<Sender, "id"> }) =>
      updateSender({ data: { id: vars.id, ...vars.data } }),
    onSuccess: (_result, vars) => {
      queryClient.setQueryData<Sender[]>(sendersQueryKey, (current) =>
        (current ?? []).map((s) => (s.id === vars.id ? { ...s, ...vars.data } : s)),
      );
      queryClient.invalidateQueries({ queryKey: sendersQueryKey, refetchType: "all" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSender({ data: { id } }),
    onSuccess: (_result, id) => {
      queryClient.setQueryData<Sender[]>(sendersQueryKey, (current) =>
        (current ?? []).filter((s) => s.id !== id),
      );
      queryClient.invalidateQueries({ queryKey: sendersQueryKey, refetchType: "all" });
    },
  });

  const senders = query.data ?? [];
  const loaded = query.isSuccess;

  const addSenderCb = useCallback(
    (data: Omit<Sender, "id">) => addMutation.mutateAsync(data),
    [addMutation],
  );
  const updateSenderCb = useCallback(
    (id: string, data: Omit<Sender, "id">) => updateMutation.mutateAsync({ id, data }),
    [updateMutation],
  );
  const removeSenderCb = useCallback(
    (id: string) => deleteMutation.mutateAsync(id),
    [deleteMutation],
  );

  return {
    senders,
    loaded,
    addSender: addSenderCb,
    updateSender: updateSenderCb,
    removeSender: removeSenderCb,
  };
}
