import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { senders } from "./db/schema";
import { eq } from "drizzle-orm";

export const fetchSenders = createServerFn({ method: "GET" }).handler(async () => {
  return await db.select().from(senders).orderBy(senders.nama);
});

export const addSender = createServerFn({ method: "POST" })
  .validator((data: { nama: string; alamat: string; telepon: string; catatan?: string }) => data)
  .handler(async ({ data }) => {
    const [inserted] = await db.insert(senders).values(data).returning();
    return inserted;
  });

export const updateSender = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; nama: string; alamat: string; telepon: string; catatan?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    await db.update(senders).set(rest).where(eq(senders.id, id));
  });

export const deleteSender = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(senders).where(eq(senders.id, data.id));
  });
