import { useCallback, useEffect, useState } from "react";

export type Sender = {
  id: string;
  nama: string;
  alamat: string;
  telepon: string;
  catatan?: string;
};

const KEY = "surat-jalan:senders";

function read(): Sender[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Sender[]) : [];
  } catch {
    return [];
  }
}

export function useSenders() {
  const [senders, setSenders] = useState<Sender[]>([]);

  useEffect(() => setSenders(read()), []);

  const persist = useCallback((next: Sender[]) => {
    setSenders(next);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* penyimpanan browser penuh atau diblokir */
    }
  }, []);

  const addSender = useCallback(
    (data: Omit<Sender, "id">) => {
      const item = { ...data, id: crypto.randomUUID() };
      persist([...read(), item]);
      return item;
    },
    [persist],
  );

  const updateSender = useCallback(
    (id: string, data: Omit<Sender, "id">) =>
      persist(read().map((sender) => (sender.id === id ? { ...data, id } : sender))),
    [persist],
  );

  const removeSender = useCallback(
    (id: string) => persist(read().filter((sender) => sender.id !== id)),
    [persist],
  );

  return { senders, addSender, updateSender, removeSender };
}