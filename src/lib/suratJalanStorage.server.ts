import { createServerFn } from "@tanstack/react-start";
import { db } from "./db";
import { suratJalan, suratJalanItems } from "./db/schema";
import { eq, asc, sql } from "drizzle-orm";

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

// =============================================================================
// GENERATOR NOMOR SURAT JALAN (server authoritative)
// =============================================================================
//
// Rangkaian nomor turunan PO. PO-4827 tidak pernah berubah; SJ dan NT
// memakai base yang sama dengan suffix genap:
//   kiriman 1 -> SJ-4827
//   kiriman 2 -> SJ-4827-2
//   kiriman 3 -> SJ-4827-4
// NT (T7) akan memakai suffix ganjil berikutnya (-3, -5, dst), sehingga
// penyimpanan SJ yang sekarang sudah menyisakan ruang untuk aturan itu.

/** Nomor induk yang memakai aturan ber-suffix. Legacy INV-xxxxxx tidak masuk. */
const PO_BASE_PATTERN = /^PO-(\d{4})$/;
/** Format SJ sah untuk base PO: "SJ-4827" atau "SJ-4827-<suffix genap>". */
const SJ_WITH_BASE_PATTERN = /^SJ-(\d{4})(?:-(\d+))?$/;
/** Batas percobaan untuk jalur nomor acak (SJ manual / PO legacy). */
const RANDOM_ATTEMPT_LIMIT = 10;
/** Batas percobaan untuk jalur PO, hanya kalah dari tabrakan antar order. */
const PO_ATTEMPT_LIMIT = 100;
/** Nilai suffix tertinggi bila belum ada satu pun nomor untuk base tersebut. */
const EMPTY_SUFFIX_MAX = -2;

/** Base 4 digit dari PO-4827 -> "4827". Bukan format itu -> null (jalur acak). */
export function parsePoBase(invoiceNumber?: string | null): string | null {
  return PO_BASE_PATTERN.exec((invoiceNumber ?? "").trim())?.[1] ?? null;
}

/** Suffix SJ yang sah untuk satu base: tanpa suffix = 0, selain itu harus genap > 0. */
export function suffixesForBase(nomors: readonly string[], base: string): number[] {
  const suffixes: number[] = [];
  for (const nomor of nomors) {
    const match = SJ_WITH_BASE_PATTERN.exec(nomor.trim());
    if (!match || match[1] !== base) continue;

    const raw = match[2];
    if (raw === undefined) {
      suffixes.push(0);
      continue;
    }
    // Tanpa nol di depan: "SJ-4827-01" / "-002" bukan format yang sah.
    if (!/^[1-9]\d*$/.test(raw)) continue;

    const suffix = Number(raw);
    if (suffix % 2 !== 0) continue;
    suffixes.push(suffix);
  }
  return suffixes;
}

/** Nomor acak 4 digit untuk jalur tanpa PO. Kolom nomor punya unique constraint. */
export function randomSuratJalanNumber(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(1000 + ((buffer[0] ?? 0) % 9000));
}

export type SuratJalanNomorChoice = {
  nomor: string;
  /** Suffix yang dipilih pada jalur PO; null pada jalur nomor acak. */
  suffix: number | null;
  /** Base PO yang dipakai; null pada jalur nomor acak. */
  base: string | null;
};

/**
 * Menentukan nomor berikutnya dari snapshot `existing` (nomor-nomor yang sudah
 * ada untuk PO tersebut). `minSuffix` menaikkan kandidat bila suffix lebih
 * rendah sudah pernah ditolak unique constraint, jadi tabrakan tetap berjalan
 * berurutan (…-4, -6, -8) dan tidak pernah loncat ke angka acak.
 */
export function pickSuratJalanNomor(args: {
  invoiceNumber?: string | null;
  existing: readonly string[];
  minSuffix: number;
}): SuratJalanNomorChoice {
  const base = parsePoBase(args.invoiceNumber);
  if (base === null) {
    return { nomor: `SJ-${randomSuratJalanNumber()}`, suffix: null, base: null };
  }

  const used = suffixesForBase(args.existing, base);
  const highest = used.length > 0 ? Math.max(...used) : EMPTY_SUFFIX_MAX;
  const suffix = Math.max(highest + 2, args.minSuffix);

  return { nomor: suffix === 0 ? `SJ-${base}` : `SJ-${base}-${suffix}`, suffix, base };
}

/** Hanya unique violation (23505) yang berarti tabrakan nomor. */
export function isUniqueViolation(error: unknown): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;
  while (current !== null && typeof current === "object" && !visited.has(current)) {
    visited.add(current);
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

export type SuratJalanAttemptContext = {
  /** Suffix terendah yang masih boleh dicoba; dinaikkan tiap kali tabrakan. */
  minSuffix: number;
  /** Suffix yang sedang dicoba; diisi pemanggil sebelum INSERT. */
  triedSuffix: number | null;
};

/**
 * Menjalankan percobaan INSERT sampai nomor bebas tabrakan. Error non-unique
 * langsung diteruskan tanpa retry. Karena tiap percobaan satu transaksi penuh,
 * kegagalan berarti transaksi rollback dan advisory lock ikut dilepas.
 */
export async function assignSuratJalanNomor<T>(opts: {
  maxAttempts: number;
  attempt: (ctx: SuratJalanAttemptContext) => Promise<T>;
}): Promise<T> {
  const ctx: SuratJalanAttemptContext = { minSuffix: 0, triedSuffix: null };
  let lastCollision: unknown = null;

  for (let tries = 0; tries < opts.maxAttempts; tries++) {
    ctx.triedSuffix = null;
    try {
      return await opts.attempt(ctx);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastCollision = error;
      ctx.minSuffix = (ctx.triedSuffix ?? EMPTY_SUFFIX_MAX) + 2;
    }
  }

  throw lastCollision;
}

function fnv1a(text: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < text.length; i++) {
    hash = Math.imul(hash ^ text.charCodeAt(i), 0x01000193);
  }
  return hash | 0;
}

/**
 * Advisory lock level transaksi yang kuncinya diturunkan dari order_id.
 * Dipakai supaya dua request untuk PO yang sama membaca kandidat secara
 * berurutan, bukan membaca hasil yang sama lalu menghasilkan nomor kembar.
 */
export function orderLockQuery(orderId: string) {
  const key1 = fnv1a(orderId, 0x811c9dc5);
  const key2 = fnv1a(orderId, 0x01000193);
  return sql`select pg_advisory_xact_lock(${key1}::int, ${key2}::int)`;
}

export type SuratJalanInput = {
  tanggal: string;
  pengirim: string;
  teleponPengirim: string;
  alamatPengirim: string;
  kepada: string;
  telepon: string;
  alamat: string;
  orderId?: string | null;
  invoiceNumber?: string | null;
  items: { quantity: string; name: string; description: string }[];
};

/**
 * Payload resmi addSuratJalan. `nomor` dari client dibuang di sini — nomor
 * selalu dihasilkan server dari order_id / invoice_number.
 */
export function sanitizeSuratJalanInput(data: SuratJalanInput) {
  return {
    tanggal: data.tanggal,
    pengirim: data.pengirim,
    teleponPengirim: data.teleponPengirim,
    alamatPengirim: data.alamatPengirim,
    kepada: data.kepada,
    telepon: data.telepon,
    alamat: data.alamat,
    orderId: data.orderId ?? null,
    invoiceNumber: data.invoiceNumber ?? null,
    items: data.items.map((item) => ({
      quantity: item.quantity,
      name: item.name,
      description: item.description,
    })),
  };
}

export const addSuratJalan = createServerFn({ method: "POST" })
  .validator(sanitizeSuratJalanInput)
  .handler(async ({ data }) => {
    const base = parsePoBase(data.invoiceNumber);
    const maxAttempts = base === null ? RANDOM_ATTEMPT_LIMIT : PO_ATTEMPT_LIMIT;

    return await assignSuratJalanNomor({
      maxAttempts,
      attempt: async (ctx) =>
        await db.transaction(async (tx) => {
          if (data.orderId) {
            await tx.execute(orderLockQuery(data.orderId));
          }

          const existing: string[] = [];
          if (base !== null) {
            if (data.orderId) {
              const rows = await tx
                .select({ nomor: suratJalan.nomor })
                .from(suratJalan)
                .where(eq(suratJalan.orderId, data.orderId));
              existing.push(...rows.map((row) => row.nomor));
            } else if (data.invoiceNumber) {
              const rows = await tx
                .select({ nomor: suratJalan.nomor })
                .from(suratJalan)
                .where(eq(suratJalan.invoiceNumber, data.invoiceNumber));
              existing.push(...rows.map((row) => row.nomor));
            }
          }

          const { nomor, suffix } = pickSuratJalanNomor({
            invoiceNumber: data.invoiceNumber,
            existing,
            minSuffix: ctx.minSuffix,
          });
          ctx.triedSuffix = suffix;

          const [inserted] = await tx
            .insert(suratJalan)
            .values({
              nomor,
              tanggal: data.tanggal,
              pengirim: data.pengirim,
              teleponPengirim: data.teleponPengirim,
              alamatPengirim: data.alamatPengirim,
              kepada: data.kepada,
              telepon: data.telepon,
              alamat: data.alamat,
              orderId: data.orderId,
              invoiceNumber: data.invoiceNumber,
            })
            .returning();
          if (!inserted) {
            throw new Error("Insert Surat Jalan tidak mengembalikan baris.");
          }

          for (let i = 0; i < data.items.length; i++) {
            await tx.insert(suratJalanItems).values({
              suratJalanId: inserted.id,
              ...data.items[i],
              sortOrder: i,
            });
          }
          return { ...inserted, items: data.items, createdAt: inserted.createdAt.toISOString() };
        }),
    });
  });

export const deleteSuratJalan = createServerFn({ method: "POST" })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      await tx.delete(suratJalanItems).where(eq(suratJalanItems.suratJalanId, data.id));
      await tx.delete(suratJalan).where(eq(suratJalan.id, data.id));
    });
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
      // order_id / invoice_number sengaja tidak ada di .set(): form edit di
      // /laporan tidak mengirim referensi PO, jadi kolomnya harus tetap utuh.
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
