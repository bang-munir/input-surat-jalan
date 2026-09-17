import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { suratJalan, suratJalanItems } from "./db/schema";
import { eq, asc } from "drizzle-orm";

export const fetchSuratJalan = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.query.suratJalan.findMany({
    with: { items: true },
    orderBy: [asc(suratJalan.createdAt)],
  });
  return result.map((sj) => ({
    ...sj,
    items: sj.items.sort((a, b) => a.sortOrder - b.sortOrder),
    createdAt: sj.createdAt.toISOString(),
  }));
});

export const addSuratJalan = createServerFn({ method: "POST" })
  .validator(
    (data: {
      nomor: string;
      tanggal: string;
      pengirim: string;
      teleponPengirim: string;
      alamatPengirim: string;
      kepada: string;
      telepon: string;
      alamat: string;
      items: { quantity: string; name: string; description: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    return await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(suratJalan)
        .values({
          nomor: data.nomor,
          tanggal: data.tanggal,
          pengirim: data.pengirim,
          teleponPengirim: data.teleponPengirim,
          alamatPengirim: data.alamatPengirim,
          kepada: data.kepada,
          telepon: data.telepon,
          alamat: data.alamat,
        })
        .returning();

      for (let i = 0; i < data.items.length; i++) {
        await tx.insert(suratJalanItems).values({
          suratJalanId: inserted.id,
          ...data.items[i],
          sortOrder: i,
        });
      }
      return { ...inserted, items: data.items, createdAt: inserted.createdAt.toISOString() };
    });
  });

export const deleteSuratJalan = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(suratJalan).where(eq(suratJalan.id, data.id));
  });

export const updateSuratJalan = createServerFn({ method: "POST" })
  .validator(
    (data: {
      id: string;
      tanggal: string;
      pengirim: string;
      teleponPengirim: string;
      alamatPengirim: string;
      kepada: string;
      telepon: string;
      alamat: string;
      items: { quantity: string; name: string; description: string }[];
    }) => data,
  )
  .handler(async ({ data }) => {
    return await db.transaction(async (tx) => {
      await tx
        .update(suratJalan)
        .set({
          tanggal: data.tanggal,
          pengirim: data.pengirim,
          teleponPengirim: data.teleponPengirim,
          alamatPengirim: data.alamatPengirim,
          kepada: data.kepada,
          telepon: data.telepon,
          alamat: data.alamat,
        })
        .where(eq(suratJalan.id, data.id));

      await tx.delete(suratJalanItems).where(eq(suratJalanItems.suratJalanId, data.id));

      for (let i = 0; i < data.items.length; i++) {
        await tx.insert(suratJalanItems).values({
          suratJalanId: data.id,
          ...data.items[i],
          sortOrder: i,
        });
      }
    });
  });
