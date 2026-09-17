import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { customers } from "./db/schema";
import { eq } from "drizzle-orm";

export const fetchCustomers = createServerFn({ method: "GET" }).handler(async () => {
  return await db.select().from(customers).orderBy(customers.nama);
});

export const addCustomer = createServerFn({ method: "POST" })
  .validator((data: { nama: string; alamat: string; telepon: string; catatan?: string }) => data)
  .handler(async ({ data }) => {
    const [inserted] = await db.insert(customers).values(data).returning();
    return inserted;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .validator(
    (data: { id: string; nama: string; alamat: string; telepon: string; catatan?: string }) => data,
  )
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    await db.update(customers).set(rest).where(eq(customers.id, id));
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.delete(customers).where(eq(customers.id, data.id));
  });
