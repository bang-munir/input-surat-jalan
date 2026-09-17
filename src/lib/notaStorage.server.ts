import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { nota, notaItems } from "./db/schema";
import { eq, asc } from "drizzle-orm";

// Fetch all Nota records with items
export const fetchNota = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.query.nota.findMany({
    with: { items: true },
    orderBy: [asc(nota.createdAt)],
  });
  return result.map((n) => ({
    ...n,
    items: n.items.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: n.createdAt.toISOString(),
  }));
});

// Add a new Nota (client supplies nomor)
export const addNota = createServerFn({ method: "POST" })
  .validator(
    (data: {
      nomor: string;
      tanggal: string;
      suratJalanId: string;
      suratJalanNomor: string;
      pengirim: string;
      penerima: string;
      items: { quantity: string; name: string; description: string; price: number; total: number }[];
      subtotal: number;
      potong: number;
      total: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(nota)
        .values({
          nomor: data.nomor,
          tanggal: data.tanggal,
          suratJalanId: data.suratJalanId,
          suratJalanNomor: data.suratJalanNomor,
          pengirim: data.pengirim,
          penerima: data.penerima,
          subtotal: data.subtotal,
          potong: data.potong,
          total: data.total,
        })
        .returning();

      for (let i = 0; i < data.items.length; i++) {
        const it = data.items[i];
        await tx.insert(notaItems).values({
          notaId: inserted.id,
          quantity: it.quantity,
          name: it.name,
          description: it.description,
          price: it.price,
          total: it.total,
          sortOrder: i,
        });
      }

      return { ...inserted, items: data.items, createdAt: inserted.createdAt.toISOString() };
    });
  });

// Update existing Nota (atomic)
export const updateNota = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      tanggal: string;
      pengirim: string;
      penerima: string;
      items: { quantity: string; name: string; description: string; price: number; total: number }[];
      subtotal: number;
      potong: number;
      total: number;
    }) => data,
  )
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      await tx
        .update(nota)
        .set({
          tanggal: data.tanggal,
          pengirim: data.pengirim,
          penerima: data.penerima,
          subtotal: data.subtotal,
          potong: data.potong,
          total: data.total,
        })
        .where(eq(nota.id, data.id));

      // Replace items atomically
      await tx.delete(notaItems).where(eq(notaItems.notaId, data.id));
      for (let i = 0; i < data.items.length; i++) {
        const it = data.items[i];
        await tx.insert(notaItems).values({
          notaId: data.id,
          quantity: it.quantity,
          name: it.name,
          description: it.description,
          price: it.price,
          total: it.total,
          sortOrder: i,
        });
      }
    });
  });

// Delete Nota
export const deleteNota = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(nota).where(eq(nota.id, data.id));
  });
