import { createServerFn } from "@tanstack/react-start";
import { setResponseStatus } from "@tanstack/react-start/server";
import { db } from "./db";
import { nota, notaItems, suratJalan } from "./db/schema";
import { eq, asc, sql } from "drizzle-orm";

// Fetch all Nota records with items
export const fetchNota = createServerFn({ method: "GET" }).handler(async () => {
  const result = await db.query.nota.findMany({
    with: { items: true },
    orderBy: [asc(nota.createdAt)],
  });
  return result.map((n) => ({
    ...n,
    items: n.items.sort((a, b) => a.sortOrder - b.sortOrder),
    alamat: "",
    telepon: "",
    createdAt: n.createdAt.toISOString(),
  }));
});

// Nomor-nomor Nota yang mereferensikan sebuah Surat Jalan (dipakai untuk
// menampilkan pesan error yang informatif saat hapus diblokir FK RESTRICT).
export const fetchNotaNumbersBySuratJalan = createServerFn({ method: "GET" })
  .validator((data: { suratJalanId: string }) => data)
  .handler(async ({ data }) => {
    const rows = await db.query.nota.findMany({
      columns: { nomor: true },
      where: eq(nota.suratJalanId, data.suratJalanId),
      orderBy: [asc(nota.nomor)],
    });
    return rows.map((r) => r.nomor);
  });

// =============================================================================
// GENERATOR NOMOR NOTA (server authoritative)
// =============================================================================
//
// Nota mengikuti rangkaian Surat Jalan yang dihasilkan T6, dengan suffix
// ganjil berikutnya:
//   SJ-4827   -> NT-4827
//   SJ-4827-2 -> NT-4827-3
//   SJ-4827-4 -> NT-4827-5
// Surat Jalan legacy/manual/tanpa PO (SJ-7315, INV-290029) tidak masuk
// rangkaian dan memakai nomor acak 4 digit UNIQUE.

/** Nomor induk yang memakai aturan ber-suffix. Legacy INV-xxxxxx tidak masuk. */
const PO_BASE_PATTERN = /^PO-(\d{4})$/;
/** Format SJ sah untuk base PO: "SJ-4827" atau "SJ-4827-<suffix genap>". */
const SJ_WITH_BASE_PATTERN = /^SJ-(\d{4})(?:-(\d+))?$/;
/** Total percobaan INSERT per Nota. Tabrakan jatuh ke nomor acak, bukan suffix berikutnya. */
const RANDOM_ATTEMPT_LIMIT = 10;

export type NotaErrorCode = "SJ_REQUIRED" | "SJ_NOT_FOUND" | "SJ_HAS_NOTA";

/** Error sah untuk pembuatan Nota; `statusCode` dipakai sebagai jawaban 400/404/409. */
export class NotaCreateError extends Error {
  readonly code: NotaErrorCode;
  readonly statusCode: number;
  constructor(code: NotaErrorCode, statusCode: number, message: string) {
    super(message);
    this.name = "NotaCreateError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function throwNota(error: NotaCreateError): never {
  setResponseStatus(error.statusCode);
  throw error;
}

export type NotaSourceSj = {
  nomor: string;
  invoiceNumber?: string | null;
};

/**
 * Rangkaian hanya untuk Surat Jalan yang lahir dari PO berformat PO-XXXX dan
 * nomornya sendiri memakai base PO yang sama. Selain itu (legacy INV-xxxxxx,
 * invoice kosong, nomor SJ yang tidak sejajar dengan PO) hasilnya null dan
 * pemanggil jatuh ke jalur nomor acak.
 */
export function parseNotaSequence(sj: NotaSourceSj): { base: string; sjSuffix: number } | null {
  const poBase = PO_BASE_PATTERN.exec((sj.invoiceNumber ?? "").trim())?.[1];
  if (poBase === undefined) return null;

  const match = SJ_WITH_BASE_PATTERN.exec((sj.nomor ?? "").trim());
  if (!match) return null;
  const base = match[1];
  if (base === undefined || base !== poBase) return null;

  const raw = match[2];
  if (raw === undefined) return { base, sjSuffix: 0 };
  // Tanpa nol di depan: "SJ-4827-01" / "-002" bukan format yang sah.
  if (!/^[1-9]\d*$/.test(raw)) return null;

  const suffix = Number(raw);
  if (suffix % 2 !== 0) return null;
  return { base, sjSuffix: suffix };
}

/** Nomor acak 4 digit. Kolom nomor punya unique constraint, jadi tabrakan dicoba ulang. */
export function randomNotaNumber(): string {
  const buffer = new Uint32Array(1);
  crypto.getRandomValues(buffer);
  return String(1000 + ((buffer[0] ?? 0) % 9000));
}

export type NotaNomorChoice = {
  nomor: string;
  mode: "sequence" | "random";
};

/** Kandidat nomor Nota dari Surat Jalan yang dipilih client. */
export function pickNotaNomor(sj: NotaSourceSj): NotaNomorChoice {
  const sequence = parseNotaSequence(sj);
  if (sequence === null) {
    return { nomor: `NT-${randomNotaNumber()}`, mode: "random" };
  }
  const nomor =
    sequence.sjSuffix === 0
      ? `NT-${sequence.base}`
      : `NT-${sequence.base}-${sequence.sjSuffix + 1}`;
  return { nomor, mode: "sequence" };
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

export type NotaAttemptContext = {
  /** Diaktifkan setelah tabrakan pertama: kandidat berikutnya selalu acak. */
  forceRandom: boolean;
};

/**
 * Menjalankan percobaan INSERT sampai nomor bebas tabrakan. Tabrakan pada
 * kandidat rangkaian tidak dinaikkan suffix-nya (harus tetap cocok dengan SJ),
 * melainkan jatuh ke nomor acak. Error non-unique langsung diteruskan.
 */
export async function assignNotaNomor<T>(opts: {
  maxAttempts: number;
  attempt: (ctx: NotaAttemptContext) => Promise<T>;
}): Promise<T> {
  const ctx: NotaAttemptContext = { forceRandom: false };
  let lastCollision: unknown = null;

  for (let tries = 0; tries < opts.maxAttempts; tries++) {
    try {
      return await opts.attempt(ctx);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      lastCollision = error;
      ctx.forceRandom = true;
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
 * Advisory lock level transaksi dengan kunci diturunkan dari surat_jalan_id.
 * Satu Surat Jalan hanya boleh masuk satu per satu, sehingga pemeriksaan
 * "sudah punya Nota?" dan INSERT tidak bisa dilompati oleh request paralel.
 */
export function suratJalanLockQuery(suratJalanId: string) {
  const key1 = fnv1a(suratJalanId, 0x811c9dc5);
  const key2 = fnv1a(suratJalanId, 0x01000193);
  return sql`select pg_advisory_xact_lock(${key1}::int, ${key2}::int)`;
}

export type NotaInput = {
  tanggal: string;
  suratJalanId: string | null;
  /** Hanya untuk kompatibilitas payload lama; selalu diganti dari baris SJ. */
  suratJalanNomor?: string;
  pengirim: string;
  penerima: string;
  alamat?: string;
  telepon?: string;
  items: { quantity: string; name: string; description: string; price: number; total: number }[];
  subtotal: number;
  potong: number;
  total: number;
  /** Pilihan tanda tangan dari form Nota. Absent = default true. */
  showSignature?: boolean;
};

/**
 * Payload resmi addNota. `nomor` tidak pernah masuk dan `suratJalanNomor`
 * dari client dibuang — keduanya diambil server dari baris Surat Jalan.
 */
export function sanitizeNotaInput(data: NotaInput) {
  const suratJalanId = (data.suratJalanId ?? "").trim();
  if (!suratJalanId) {
    throw new NotaCreateError(
      "SJ_REQUIRED",
      400,
      "Surat Jalan wajib dipilih sebelum menyimpan Nota.",
    );
  }

  return {
    tanggal: data.tanggal,
    suratJalanId,
    pengirim: data.pengirim,
    penerima: data.penerima,
    alamat: data.alamat ?? "",
    telepon: data.telepon ?? "",
    items: data.items.map((item) => ({
      quantity: item.quantity,
      name: item.name,
      description: item.description,
      price: item.price,
      total: item.total,
    })),
    subtotal: data.subtotal,
    potong: data.potong,
    total: data.total,
    showSignature: data.showSignature,
  };
}

// Add a new Nota (nomor ditentukan server dari Surat Jalan terkait)
export const addNota = createServerFn({ method: "POST" })
  .validator((data: NotaInput) => {
    try {
      return sanitizeNotaInput(data);
    } catch (error) {
      if (error instanceof NotaCreateError) throwNota(error);
      throw error;
    }
  })
  .handler(async ({ data }) => {
    return await assignNotaNomor({
      maxAttempts: RANDOM_ATTEMPT_LIMIT,
      attempt: async (ctx) =>
        await db.transaction(async (tx) => {
          await tx.execute(suratJalanLockQuery(data.suratJalanId));

          const sjRows = await tx
            .select({
              id: suratJalan.id,
              nomor: suratJalan.nomor,
              invoiceNumber: suratJalan.invoiceNumber,
            })
            .from(suratJalan)
            .where(eq(suratJalan.id, data.suratJalanId))
            .limit(1);
          const sj = sjRows[0];
          if (!sj) {
            throwNota(
              new NotaCreateError(
                "SJ_NOT_FOUND",
                404,
                `Surat Jalan ${data.suratJalanId} tidak ditemukan.`,
              ),
            );
          }

          // 1 Surat Jalan = 1 Nota. Dibaca di bawah advisory lock yang sama,
          // jadi dua request paralel tidak bisa lolos bersamaan.
          const takenRows = await tx
            .select({ nomor: nota.nomor })
            .from(nota)
            .where(eq(nota.suratJalanId, sj.id))
            .limit(1);
          const taken = takenRows[0];
          if (taken) {
            throwNota(
              new NotaCreateError(
                "SJ_HAS_NOTA",
                409,
                `Surat Jalan ${sj.nomor} sudah memiliki Nota ${taken.nomor}.`,
              ),
            );
          }

          const choice = ctx.forceRandom
            ? { nomor: `NT-${randomNotaNumber()}`, mode: "random" as const }
            : pickNotaNomor(sj);

          const [inserted] = await tx
            .insert(nota)
            .values({
              nomor: choice.nomor,
              tanggal: data.tanggal,
              suratJalanId: sj.id,
              suratJalanNomor: sj.nomor,
              pengirim: data.pengirim,
              penerima: data.penerima,
              subtotal: data.subtotal,
              potong: data.potong,
              total: data.total,
              showSignature: data.showSignature ?? true,
            })
            .returning();
          if (!inserted) {
            throw new Error("Insert Nota tidak mengembalikan baris.");
          }

          for (const [i, item] of data.items.entries()) {
            await tx.insert(notaItems).values({
              notaId: inserted.id,
              quantity: item.quantity,
              name: item.name,
              description: item.description,
              price: item.price,
              total: item.total,
              sortOrder: i,
            });
          }

          return {
            ...inserted,
            items: data.items,
            alamat: data.alamat,
            telepon: data.telepon,
            createdAt: inserted.createdAt.toISOString(),
          };
        }),
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
      alamat?: string;
      telepon?: string;
      items: {
        quantity: string;
        name: string;
        description: string;
        price: number;
        total: number;
      }[];
      subtotal: number;
      potong: number;
      total: number;
      showSignature?: boolean;
    }) => data,
  )
  .handler(async ({ data }) => {
    await db.transaction(async (tx) => {
      // surat_jalan_id / surat_jalan_nomor sengaja tidak ada di .set():
      // Nota selalu terikat pada Surat Jalan yang sama sejak pembuatan.
      await tx
        .update(nota)
        .set({
          tanggal: data.tanggal,
          pengirim: data.pengirim,
          penerima: data.penerima,
          subtotal: data.subtotal,
          potong: data.potong,
          total: data.total,
          showSignature: data.showSignature ?? true,
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
