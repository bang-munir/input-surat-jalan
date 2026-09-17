import { useCallback, useEffect, useState } from "react";
import { fetchSenders, addSender, updateSender, deleteSender } from "./senders.server";

export type Sender = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

export function useSenders() {
  const [senders, setSenders] = useState<Sender[]>([]);

  const load = useCallback(async () => {
    const data = await fetchSenders();
    setSenders(data);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (data: Omit<Sender, "id">) => {
      await addSender({ data });
      await load();
    },
    [load],
  );

  const update = useCallback(
    async (id: string, data: Omit<Sender, "id">) => {
      await updateSender({ data: { id, ...data } });
      await load();
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteSender({ data: { id } });
      await load();
    },
    [load],
  );

  return { senders, addSender: add, updateSender: update, removeSender: remove };
}
