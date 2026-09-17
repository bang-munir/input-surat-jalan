CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"alamat" text DEFAULT '' NOT NULL,
	"telepon" text DEFAULT '' NOT NULL,
	"catatan" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nota" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text NOT NULL,
	"tanggal" text NOT NULL,
	"surat_jalan_id" uuid NOT NULL,
	"surat_jalan_nomor" text NOT NULL,
	"pengirim" text DEFAULT '' NOT NULL,
	"penerima" text DEFAULT '' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"potong" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nota_nomor_unique" UNIQUE("nomor")
);
--> statement-breakpoint
CREATE TABLE "nota_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"nota_id" uuid NOT NULL,
	"quantity" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "senders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nama" text NOT NULL,
	"alamat" text DEFAULT '' NOT NULL,
	"telepon" text DEFAULT '' NOT NULL,
	"catatan" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surat_jalan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nomor" text NOT NULL,
	"tanggal" text NOT NULL,
	"pengirim" text DEFAULT '' NOT NULL,
	"telepon_pengirim" text DEFAULT '' NOT NULL,
	"alamat_pengirim" text DEFAULT '' NOT NULL,
	"kepada" text DEFAULT '' NOT NULL,
	"telepon" text DEFAULT '' NOT NULL,
	"alamat" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "surat_jalan_nomor_unique" UNIQUE("nomor")
);
--> statement-breakpoint
CREATE TABLE "surat_jalan_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"surat_jalan_id" uuid NOT NULL,
	"quantity" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nota" ADD CONSTRAINT "nota_surat_jalan_id_surat_jalan_id_fk" FOREIGN KEY ("surat_jalan_id") REFERENCES "public"."surat_jalan"("id") ON DELETE restrict ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "nota_items" ADD CONSTRAINT "nota_items_nota_id_nota_id_fk" FOREIGN KEY ("nota_id") REFERENCES "public"."nota"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "surat_jalan_items" ADD CONSTRAINT "surat_jalan_items_surat_jalan_id_surat_jalan_id_fk" FOREIGN KEY ("surat_jalan_id") REFERENCES "public"."surat_jalan"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "customers_nama_idx" ON "customers" USING btree ("nama");--> statement-breakpoint
CREATE INDEX "nota_created_at_idx" ON "nota" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "nota_items_nota_id_idx" ON "nota_items" USING btree ("nota_id");--> statement-breakpoint
CREATE INDEX "senders_nama_idx" ON "senders" USING btree ("nama");--> statement-breakpoint
CREATE INDEX "surat_jalan_created_at_idx" ON "surat_jalan" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "surat_jalan_items_sj_id_idx" ON "surat_jalan_items" USING btree ("surat_jalan_id");