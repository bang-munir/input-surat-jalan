import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// =============================================================================
// MASTER DATA
// =============================================================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: text("nama").notNull(),
    alamat: text("alamat").notNull().default(""),
    telepon: text("telepon").notNull().default(""),
    catatan: text("catatan").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    namaIdx: index("customers_nama_idx").on(t.nama),
  }),
);

export const senders = pgTable(
  "senders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nama: text("nama").notNull(),
    alamat: text("alamat").notNull().default(""),
    telepon: text("telepon").notNull().default(""),
    catatan: text("catatan").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    namaIdx: index("senders_nama_idx").on(t.nama),
  }),
);

// =============================================================================
// SURAT JALAN
// =============================================================================

export const suratJalan = pgTable(
  "surat_jalan",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nomor: text("nomor").notNull(),
    tanggal: text("tanggal").notNull(),
    pengirim: text("pengirim").notNull().default(""),
    teleponPengirim: text("telepon_pengirim").notNull().default(""),
    alamatPengirim: text("alamat_pengirim").notNull().default(""),
    kepada: text("kepada").notNull().default(""),
    telepon: text("telepon").notNull().default(""),
    alamat: text("alamat").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nomorUnique: unique("surat_jalan_nomor_unique").on(t.nomor),
    createdAtIdx: index("surat_jalan_created_at_idx").on(t.createdAt),
  }),
);

export const suratJalanItems = pgTable(
  "surat_jalan_items",
  {
    id: serial("id").primaryKey(),
    suratJalanId: uuid("surat_jalan_id")
      .notNull()
      .references(() => suratJalan.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    quantity: text("quantity").notNull().default(""),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    suratJalanIdIdx: index("surat_jalan_items_sj_id_idx").on(t.suratJalanId),
  }),
);

// =============================================================================
// NOTA
// =============================================================================

export const nota = pgTable(
  "nota",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    nomor: text("nomor").notNull(),
    tanggal: text("tanggal").notNull(),
    suratJalanId: uuid("surat_jalan_id")
      .notNull()
      .references(() => suratJalan.id, {
        onDelete: "restrict",
        onUpdate: "cascade",
      }),
    suratJalanNomor: text("surat_jalan_nomor").notNull(),
    pengirim: text("pengirim").notNull().default(""),
    penerima: text("penerima").notNull().default(""),
    subtotal: integer("subtotal").notNull().default(0),
    potong: integer("potong").notNull().default(0),
    total: integer("total").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nomorUnique: unique("nota_nomor_unique").on(t.nomor),
    createdAtIdx: index("nota_created_at_idx").on(t.createdAt),
  }),
);

export const notaItems = pgTable(
  "nota_items",
  {
    id: serial("id").primaryKey(),
    notaId: uuid("nota_id")
      .notNull()
      .references(() => nota.id, {
        onDelete: "cascade",
        onUpdate: "cascade",
      }),
    quantity: text("quantity").notNull().default(""),
    name: text("name").notNull().default(""),
    description: text("description").notNull().default(""),
    price: integer("price").notNull().default(0),
    total: integer("total").notNull().default(0),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => ({
    notaIdIdx: index("nota_items_nota_id_idx").on(t.notaId),
  }),
);

// =============================================================================
// RELATIONS (untuk Drizzle query builder)
// =============================================================================

export const suratJalanRelations = relations(suratJalan, ({ many }) => ({
  items: many(suratJalanItems),
  notas: many(nota),
}));

export const suratJalanItemsRelations = relations(suratJalanItems, ({ one }) => ({
  suratJalan: one(suratJalan, {
    fields: [suratJalanItems.suratJalanId],
    references: [suratJalan.id],
  }),
}));

export const notaRelations = relations(nota, ({ one, many }) => ({
  suratJalan: one(suratJalan, {
    fields: [nota.suratJalanId],
    references: [suratJalan.id],
  }),
  items: many(notaItems),
}));

export const notaItemsRelations = relations(notaItems, ({ one }) => ({
  nota: one(nota, {
    fields: [notaItems.notaId],
    references: [nota.id],
  }),
}));
