import { createServerFn } from "@tanstack/react-start";
import { count, eq } from "drizzle-orm";
import { db } from "./db";
import { customers, senders, suratJalan, suratJalanItems, nota, notaItems } from "./db/schema";

// =============================================================================
// TYPES
// =============================================================================

interface MigrationCustomer {
  id: string;
  nama: string;
  alamat?: string;
  telepon?: string;
  catatan?: string;
  createdAt?: string;
}

interface MigrationSender {
  id: string;
  nama: string;
  alamat?: string;
  telepon?: string;
  catatan?: string;
  createdAt?: string;
}

interface MigrationSuratJalanItem {
  quantity: string;
  name: string;
  description: string;
}

interface MigrationSuratJalan {
  id: string;
  nomor: string;
  tanggal: string;
  pengirim?: string;
  teleponPengirim?: string;
  alamatPengirim?: string;
  kepada?: string;
  telepon?: string;
  alamat?: string;
  items?: MigrationSuratJalanItem[];
  createdAt?: string;
}

interface MigrationNotaItem {
  quantity: string;
  name: string;
  description?: string;
  price: number;
  total: number;
}

interface MigrationNota {
  id: string;
  nomor: string;
  tanggal: string;
  suratJalanId: string;
  suratJalanNomor?: string;
  pengirim?: string;
  penerima?: string;
  items?: MigrationNotaItem[];
  subtotal: number;
  potong: number;
  total: number;
  createdAt?: string;
}

interface MigrationPayload {
  customers: MigrationCustomer[];
  senders: MigrationSender[];
  suratJalan: MigrationSuratJalan[];
  nota: MigrationNota[];
}

interface CategoryReport {
  inserted: number;
  skipped: number;
  conflicts: number;
  errors: number;
  details: string[];
}

interface MigrationReport {
  success: boolean;
  customers: CategoryReport;
  senders: CategoryReport;
  suratJalan: CategoryReport;
  suratJalanItems: { inserted: number; skipped: number; conflicts: number; errors: number };
  nota: CategoryReport;
  notaItems: { inserted: number; skipped: number; conflicts: number; errors: number };
  conflictDetails: string[];
  errorDetails: string[];
}

// =============================================================================
// HELPERS
// =============================================================================

function isUUIDv4(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  );
}

function parseCreatedAt(val: unknown): Date | null {
  if (!val || typeof val !== "string") return null;
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function emptyReport(): CategoryReport {
  return { inserted: 0, skipped: 0, conflicts: 0, errors: 0, details: [] };
}

function normItemSJ(it: MigrationSuratJalanItem) {
  return {
    name: (it.name || "").trim(),
    quantity: (it.quantity || "").trim(),
    description: (it.description || "").trim(),
  };
}

function normItemNota(it: MigrationNotaItem) {
  return {
    name: (it.name || "").trim(),
    quantity: (it.quantity || "").trim(),
    description: (it.description || "").trim(),
    price: it.price,
    total: it.total,
  };
}

// =============================================================================
// MIGRATION SERVER FUNCTION
//
// PERILAKU:
// - Seluruh migrasi berjalan dalam SATU database transaction.
// - Jika terjadi error database (constraint violation, connection error, dll),
//   seluruh perubahan di-ROLLBACK. Tidak ada data yang setengah masuk.
// - Conflict (data berbeda untuk ID/nomor yang sama) BUKAN error database.
//   Conflict dicatat di report dan TIDAK menyebabkan rollback.
//   Conflict = "data ini tidak kami proses karena sudah berbeda".
// - Setelah transaction commit, report dikembalikan ke client.
// =============================================================================

export const migrateToNeon = createServerFn({ method: "POST" })
  .validator((data: MigrationPayload) => data)
  .handler(async ({ data }) => {
    const report: MigrationReport = {
      success: true,
      customers: emptyReport(),
      senders: emptyReport(),
      suratJalan: emptyReport(),
      suratJalanItems: { inserted: 0, skipped: 0, conflicts: 0, errors: 0 },
      nota: emptyReport(),
      notaItems: { inserted: 0, skipped: 0, conflicts: 0, errors: 0 },
      conflictDetails: [],
      errorDetails: [],
    };

    try {
      await db.transaction(async (tx) => {
        // =================================================================
        // 1. CUSTOMERS
        // =================================================================
        for (const c of data.customers) {
          if (!c.id || !isUUIDv4(c.id)) {
            report.customers.errors++;
            report.customers.details.push(`Invalid ID: ${c.id || "(empty)"}`);
            continue;
          }

          const existing = await tx.select().from(customers).where(eq(customers.id, c.id)).limit(1);

          if (existing.length > 0) {
            const ex = existing[0];
            if (
              ex.nama === c.nama &&
              (ex.alamat || "") === (c.alamat || "") &&
              (ex.telepon || "") === (c.telepon || "") &&
              (ex.catatan || "") === (c.catatan || "")
            ) {
              report.customers.skipped++;
            } else {
              report.customers.conflicts++;
              report.conflictDetails.push(
                `Customer ${c.id} (nama: "${c.nama}"): data berbeda di Neon`,
              );
            }
          } else {
            await tx.insert(customers).values({
              id: c.id,
              nama: c.nama,
              alamat: c.alamat || "",
              telepon: c.telepon || "",
              catatan: c.catatan || "",
              createdAt: parseCreatedAt(c.createdAt) || new Date(),
            });
            report.customers.inserted++;
          }
        }

        // =================================================================
        // 2. SENDERS
        // =================================================================
        for (const s of data.senders) {
          if (!s.id || !isUUIDv4(s.id)) {
            report.senders.errors++;
            report.senders.details.push(`Invalid ID: ${s.id || "(empty)"}`);
            continue;
          }

          const existing = await tx.select().from(senders).where(eq(senders.id, s.id)).limit(1);

          if (existing.length > 0) {
            const ex = existing[0];
            if (
              ex.nama === s.nama &&
              (ex.alamat || "") === (s.alamat || "") &&
              (ex.telepon || "") === (s.telepon || "") &&
              (ex.catatan || "") === (s.catatan || "")
            ) {
              report.senders.skipped++;
            } else {
              report.senders.conflicts++;
              report.conflictDetails.push(
                `Sender ${s.id} (nama: "${s.nama}"): data berbeda di Neon`,
              );
            }
          } else {
            await tx.insert(senders).values({
              id: s.id,
              nama: s.nama,
              alamat: s.alamat || "",
              telepon: s.telepon || "",
              catatan: s.catatan || "",
              createdAt: parseCreatedAt(s.createdAt) || new Date(),
            });
            report.senders.inserted++;
          }
        }

        // =================================================================
        // 3 & 4. SURAT JALAN + ITEMS
        // =================================================================
        for (const sj of data.suratJalan) {
          if (!sj.id || !isUUIDv4(sj.id)) {
            report.suratJalan.errors++;
            report.suratJalan.details.push(`Invalid ID: ${sj.id || "(empty)"}`);
            continue;
          }
          if (!sj.nomor || !/^SJ-\d{4}$/.test(sj.nomor)) {
            report.suratJalan.errors++;
            report.suratJalan.details.push(`Invalid nomor: ${sj.nomor || "(empty)"}`);
            continue;
          }

          // -- Check parent by ID --
          const existingById = await tx
            .select()
            .from(suratJalan)
            .where(eq(suratJalan.id, sj.id))
            .limit(1);

          if (existingById.length > 0) {
            const ex = existingById[0];
            if (
              ex.nomor === sj.nomor &&
              ex.tanggal === sj.tanggal &&
              (ex.pengirim || "") === (sj.pengirim || "") &&
              (ex.kepada || "") === (sj.kepada || "")
            ) {
              // Parent sama → cek child idempotency
              report.suratJalan.skipped++;
              await checkAndReportSJItems(tx, sj, report);
            } else {
              report.suratJalan.conflicts++;
              report.conflictDetails.push(
                `SuratJalan ${sj.id} (nomor: "${sj.nomor}"): data berbeda di Neon`,
              );
            }
            continue;
          }

          // -- Check parent by nomor (unique constraint) --
          const existingByNomor = await tx
            .select()
            .from(suratJalan)
            .where(eq(suratJalan.nomor, sj.nomor))
            .limit(1);

          if (existingByNomor.length > 0) {
            report.suratJalan.conflicts++;
            report.conflictDetails.push(
              `SuratJalan nomor "${sj.nomor}" sudah ada di Neon dengan ID berbeda`,
            );
            continue;
          }

          // -- Insert parent + items --
          await tx.insert(suratJalan).values({
            id: sj.id,
            nomor: sj.nomor,
            tanggal: sj.tanggal,
            pengirim: sj.pengirim || "",
            teleponPengirim: sj.teleponPengirim || "",
            alamatPengirim: sj.alamatPengirim || "",
            kepada: sj.kepada || "",
            telepon: sj.telepon || "",
            alamat: sj.alamat || "",
            createdAt: parseCreatedAt(sj.createdAt) || new Date(),
          });

          const items = Array.isArray(sj.items) ? sj.items : [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const n = normItemSJ(it);
            await tx.insert(suratJalanItems).values({
              suratJalanId: sj.id,
              quantity: n.quantity,
              name: n.name,
              description: n.description,
              sortOrder: i,
            });
            report.suratJalanItems.inserted++;
          }
          report.suratJalan.inserted++;
        }

        // =================================================================
        // 5 & 6. NOTA + ITEMS
        // =================================================================
        for (const n of data.nota) {
          if (!n.id || !isUUIDv4(n.id)) {
            report.nota.errors++;
            report.nota.details.push(`Invalid ID: ${n.id || "(empty)"}`);
            continue;
          }
          if (!n.nomor || !/^NT-\d{4}$/.test(n.nomor)) {
            report.nota.errors++;
            report.nota.details.push(`Invalid nomor: ${n.nomor || "(empty)"}`);
            continue;
          }
          if (!n.suratJalanId || !isUUIDv4(n.suratJalanId)) {
            report.nota.errors++;
            report.nota.details.push(
              `Nota ${n.nomor}: suratJalanId invalid (${n.suratJalanId || "(empty)"})`,
            );
            continue;
          }

          // -- Verify FK: Surat Jalan must exist --
          const sjExists = await tx
            .select({ id: suratJalan.id })
            .from(suratJalan)
            .where(eq(suratJalan.id, n.suratJalanId))
            .limit(1);

          if (sjExists.length === 0) {
            report.nota.errors++;
            report.nota.details.push(
              `Nota ${n.nomor}: suratJalanId ${n.suratJalanId} tidak ditemukan`,
            );
            continue;
          }

          // -- Check parent by ID --
          const existingById = await tx.select().from(nota).where(eq(nota.id, n.id)).limit(1);

          if (existingById.length > 0) {
            const ex = existingById[0];
            if (
              ex.nomor === n.nomor &&
              ex.suratJalanId === n.suratJalanId &&
              ex.subtotal === n.subtotal &&
              ex.potong === n.potong &&
              ex.total === n.total
            ) {
              // Parent sama → cek child idempotency
              report.nota.skipped++;
              await checkAndReportNotaItems(tx, n, report);
            } else {
              report.nota.conflicts++;
              report.conflictDetails.push(
                `Nota ${n.id} (nomor: "${n.nomor}"): data berbeda di Neon`,
              );
            }
            continue;
          }

          // -- Check parent by nomor (unique constraint) --
          const existingByNomor = await tx
            .select()
            .from(nota)
            .where(eq(nota.nomor, n.nomor))
            .limit(1);

          if (existingByNomor.length > 0) {
            report.nota.conflicts++;
            report.conflictDetails.push(
              `Nota nomor "${n.nomor}" sudah ada di Neon dengan ID berbeda`,
            );
            continue;
          }

          // -- Insert parent + items --
          await tx.insert(nota).values({
            id: n.id,
            nomor: n.nomor,
            tanggal: n.tanggal,
            suratJalanId: n.suratJalanId,
            suratJalanNomor: n.suratJalanNomor || "",
            pengirim: n.pengirim || "",
            penerima: n.penerima || "",
            subtotal: n.subtotal,
            potong: n.potong,
            total: n.total,
            createdAt: parseCreatedAt(n.createdAt) || new Date(),
          });

          const items = Array.isArray(n.items) ? n.items : [];
          for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const ni = normItemNota(it);
            await tx.insert(notaItems).values({
              notaId: n.id,
              quantity: ni.quantity,
              name: ni.name,
              description: ni.description,
              price: ni.price,
              total: ni.total,
              sortOrder: i,
            });
            report.notaItems.inserted++;
          }
          report.nota.inserted++;
        }
      });
    } catch (e) {
      // Database error atau fatal error → transaction di-rollback oleh Drizzle.
      // Seluruh perubahan yang belum commit hilang.
      report.success = false;
      report.errorDetails.push(`Fatal: ${e instanceof Error ? e.message : String(e)}`);
    }

    // success = false jika ada conflict atau error
    if (report.conflictDetails.length > 0 || report.errorDetails.length > 0) {
      report.success = false;
    }

    return report;
  });

// =============================================================================
// CHILD IDEMPOTENCY HELPERS
//
// Menggunakan kombinasi (sortOrder + name + quantity + description [+ price + total])
// sebagai comparison key karena child menggunakan serial ID yang tidak stabil.
//
// Perbandingan dilakukan per parent (scoped by foreign key).
// =============================================================================

async function checkAndReportSJItems(
  tx: Parameters<Parameters<Parameters<typeof db.transaction>[0]>[0]>[0],
  sj: MigrationSuratJalan,
  report: MigrationReport,
) {
  const incomingItems = Array.isArray(sj.items) ? sj.items : [];

  const existingItems = await tx
    .select()
    .from(suratJalanItems)
    .where(eq(suratJalanItems.suratJalanId, sj.id))
    .orderBy(suratJalanItems.sortOrder);

  if (existingItems.length === 0 && incomingItems.length === 0) {
    return;
  }

  if (existingItems.length === 0 && incomingItems.length > 0) {
    // Item belum ada di Neon → INSERT
    for (let i = 0; i < incomingItems.length; i++) {
      const it = incomingItems[i];
      const n = normItemSJ(it);
      await tx.insert(suratJalanItems).values({
        suratJalanId: sj.id,
        quantity: n.quantity,
        name: n.name,
        description: n.description,
        sortOrder: i,
      });
      report.suratJalanItems.inserted++;
    }
    return;
  }

  if (existingItems.length > 0 && incomingItems.length === 0) {
    return;
  }

  // Keduanya ada → BANDINGKAN
  if (existingItems.length !== incomingItems.length) {
    report.suratJalanItems.conflicts++;
    report.conflictDetails.push(
      `SuratJalan ${sj.nomor} sudah memiliki ${existingItems.length} items di Neon tetapi localStorage memiliki ${incomingItems.length} items`,
    );
    return;
  }

  // Jumlah sama → bandingkan isi per item berdasarkan sortOrder
  for (let i = 0; i < incomingItems.length; i++) {
    const incoming = normItemSJ(incomingItems[i]);
    const existing = existingItems[i];

    if (
      existing.name !== incoming.name ||
      existing.quantity !== incoming.quantity ||
      existing.description !== incoming.description
    ) {
      report.suratJalanItems.conflicts++;
      report.conflictDetails.push(
        `SuratJalan ${sj.nomor} item #${i + 1} (sort_order ${existing.sortOrder}): ` +
          `Neon="${existing.name}" / "${existing.quantity}" / "${existing.description}" ` +
          `vs localStorage="${incoming.name}" / "${incoming.quantity}" / "${incoming.description}"`,
      );
      return;
    }
  }

  // Semua item sama → SKIP
  report.suratJalanItems.skipped += existingItems.length;
}

async function checkAndReportNotaItems(
  tx: Parameters<Parameters<Parameters<typeof db.transaction>[0]>[0]>[0],
  n: MigrationNota,
  report: MigrationReport,
) {
  const incomingItems = Array.isArray(n.items) ? n.items : [];

  const existingItems = await tx
    .select()
    .from(notaItems)
    .where(eq(notaItems.notaId, n.id))
    .orderBy(notaItems.sortOrder);

  if (existingItems.length === 0 && incomingItems.length === 0) {
    return;
  }

  if (existingItems.length === 0 && incomingItems.length > 0) {
    // Item belum ada di Neon → INSERT
    for (let i = 0; i < incomingItems.length; i++) {
      const it = incomingItems[i];
      const ni = normItemNota(it);
      await tx.insert(notaItems).values({
        notaId: n.id,
        quantity: ni.quantity,
        name: ni.name,
        description: ni.description,
        price: ni.price,
        total: ni.total,
        sortOrder: i,
      });
      report.notaItems.inserted++;
    }
    return;
  }

  if (existingItems.length > 0 && incomingItems.length === 0) {
    return;
  }

  // Keduanya ada → BANDINGKAN
  if (existingItems.length !== incomingItems.length) {
    report.notaItems.conflicts++;
    report.conflictDetails.push(
      `Nota ${n.nomor} sudah memiliki ${existingItems.length} items di Neon tetapi localStorage memiliki ${incomingItems.length} items`,
    );
    return;
  }

  // Jumlah sama → bandingkan isi per item berdasarkan sortOrder
  for (let i = 0; i < incomingItems.length; i++) {
    const incoming = normItemNota(incomingItems[i]);
    const existing = existingItems[i];

    if (
      existing.name !== incoming.name ||
      existing.quantity !== incoming.quantity ||
      existing.description !== incoming.description ||
      existing.price !== incoming.price ||
      existing.total !== incoming.total
    ) {
      report.notaItems.conflicts++;
      report.conflictDetails.push(
        `Nota ${n.nomor} item #${i + 1} (sort_order ${existing.sortOrder}): ` +
          `Neon="${existing.name}" / "${existing.quantity}" / ${existing.price} / ${existing.total} ` +
          `vs localStorage="${incoming.name}" / "${incoming.quantity}" / ${incoming.price} / ${incoming.total}`,
      );
      return;
    }
  }

  // Semua item sama → SKIP
  report.notaItems.skipped += existingItems.length;
}
