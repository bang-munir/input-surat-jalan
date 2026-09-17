import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Copy, RefreshCw, Check, AlertTriangle, AlertCircle, Database } from "lucide-react";
import { migrateToNeon } from "@/lib/migrateToNeon";

export const Route = createFileRoute("/audit-localstorage")({
  head: () => ({
    meta: [
      { title: "Audit localStorage - Read Only" },
      {
        name: "description",
        content:
          "Halaman audit read-only untuk memeriksa data localStorage sebelum migrasi ke Neon.",
      },
    ],
  }),
  component: AuditLocalStoragePage,
});

const KEYS = {
  customers: "surat-jalan:customers",
  senders: "surat-jalan:senders",
  suratJalan: "surat-jalan:records",
  nota: "nota:records",
} as const;

type AuditReport = ReturnType<typeof runAudit>;

function read(key: string): Record<string, unknown>[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isUUIDv4(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
  );
}

function isISODate(s: unknown): s is string {
  if (typeof s !== "string") return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function countDupes(arr: unknown[]): { value: unknown; count: number }[] {
  const seen = new Map<unknown, number>();
  for (const v of arr) {
    seen.set(v, (seen.get(v) || 0) + 1);
  }
  const dupes: { value: unknown; count: number }[] = [];
  for (const [k, c] of seen) {
    if (c > 1) dupes.push({ value: k, count: c });
  }
  return dupes;
}

function runAudit() {
  const customers = read(KEYS.customers);
  const senders = read(KEYS.senders);
  const sjRecords = read(KEYS.suratJalan);
  const notaRecords = read(KEYS.nota);

  // 1. Ringkasan Jumlah
  const ringkasan = {
    pelanggan: customers.length,
    pengirim: senders.length,
    surat_jalan: sjRecords.length,
    item_surat_jalan: sjRecords.reduce(
      (n, r) => n + (Array.isArray(r.items) ? r.items.length : 0),
      0,
    ),
    nota: notaRecords.length,
    item_nota: notaRecords.reduce((n, r) => n + (Array.isArray(r.items) ? r.items.length : 0), 0),
  };

  // 2. Cek ID
  function auditIDs(label: string, records: Record<string, unknown>[]) {
    const ids = records.map((r) => r.id);
    const empty = ids.filter((id) => !id || id === "");
    const validUUID = ids.filter(isUUIDv4);
    const invalidUUID = ids.filter((id) => id && !isUUIDv4(id));
    const dupes = countDupes(ids);
    return {
      label,
      total: ids.length,
      kosong: empty.length,
      uuid_valid: validUUID.length,
      uuid_invalid: invalidUUID.length,
      contoh_invalid: invalidUUID.slice(0, 3),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  }

  const idPelanggan = auditIDs("Pelanggan", customers);
  const idPengirim = auditIDs("Pengirim", senders);
  const idSuratJalan = auditIDs("Surat Jalan", sjRecords);
  const idNota = auditIDs("Nota", notaRecords);

  // 3. Cek Nomor Surat Jalan
  const nomorSJResult = (() => {
    const nomors = sjRecords.map((r) => r.nomor);
    const empty = nomors.filter((n) => !n || n === "");
    const validFormat = nomors.filter((n) => /^SJ-\d{4}$/.test(n as string));
    const invalidFormat = nomors.filter((n) => n && !/^SJ-\d{4}$/.test(n as string));
    const dupes = countDupes(nomors);
    return {
      total: nomors.length,
      kosong: empty.length,
      format_valid: validFormat.length,
      format_invalid: invalidFormat.length,
      contoh_invalid: invalidFormat.slice(0, 5),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  })();

  // 4. Cek Nomor Nota
  const nomorNotaResult = (() => {
    const nomors = notaRecords.map((r) => r.nomor);
    const empty = nomors.filter((n) => !n || n === "");
    const validFormat = nomors.filter((n) => /^NT-\d{4}$/.test(n as string));
    const invalidFormat = nomors.filter((n) => n && !/^NT-\d{4}$/.test(n as string));
    const dupes = countDupes(nomors);
    return {
      total: nomors.length,
      kosong: empty.length,
      format_valid: validFormat.length,
      format_invalid: invalidFormat.length,
      contoh_invalid: invalidFormat.slice(0, 5),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  })();

  // 5. Cek Relasi Nota -> Surat Jalan
  const relasiNotaSJ = (() => {
    const sjIDSet = new Set(sjRecords.map((r) => r.id));
    let valid = 0;
    let orphan = 0;
    let kosong = 0;
    const orphanDetails: { nomorNota: string; suratJalanId: unknown; suratJalanNomor: unknown }[] =
      [];

    for (const n of notaRecords) {
      const refId = n.suratJalanId;
      if (!refId || refId === "") {
        kosong++;
      } else if (sjIDSet.has(refId)) {
        valid++;
      } else {
        orphan++;
        orphanDetails.push({
          nomorNota: (n.nomor as string) || "(kosong)",
          suratJalanId: refId,
          suratJalanNomor: n.suratJalanNomor || "(tidak ada)",
        });
      }
    }

    return {
      nota_total: notaRecords.length,
      surat_jalan_total: sjRecords.length,
      referensi_valid: valid,
      surat_jalan_id_kosong: kosong,
      orphan_tidak_menemukan_sj: orphan,
      orphan_detail: orphanDetails,
    };
  })();

  // 6. Cek Items Surat Jalan
  const itemsSuratJalan = (() => {
    let totalItems = 0;
    let sjTanpaItem = 0;
    let itemTanpaNama = 0;
    let itemQtyKosong = 0;
    let itemDescKosong = 0;

    for (const r of sjRecords) {
      const items = Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) sjTanpaItem++;
      for (const it of items) {
        totalItems++;
        if (
          !(it as Record<string, unknown>).name ||
          ((it as Record<string, unknown>).name as string).trim() === ""
        )
          itemTanpaNama++;
        if (
          !(it as Record<string, unknown>).quantity ||
          ((it as Record<string, unknown>).quantity as string).trim() === ""
        )
          itemQtyKosong++;
        if (
          !(it as Record<string, unknown>).description ||
          ((it as Record<string, unknown>).description as string).trim() === ""
        )
          itemDescKosong++;
      }
    }

    return {
      surat_jalan_total: sjRecords.length,
      item_total: totalItems,
      surat_jalan_tanpa_item: sjTanpaItem,
      item_tanpa_nama: itemTanpaNama,
      item_quantity_kosong: itemQtyKosong,
      item_description_kosong: itemDescKosong,
    };
  })();

  // 7. Cek Items Nota
  const itemsNota = (() => {
    let totalItems = 0;
    let notaTanpaItem = 0;
    let itemTanpaNama = 0;
    let itemQtyKosong = 0;
    let itemPriceKosong = 0;
    let itemTotalKosong = 0;

    for (const r of notaRecords) {
      const items = Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) notaTanpaItem++;
      for (const it of items) {
        totalItems++;
        const item = it as Record<string, unknown>;
        if (!item.name || (item.name as string).trim() === "") itemTanpaNama++;
        if (!item.quantity || (item.quantity as string).trim() === "") itemQtyKosong++;
        if (item.price === undefined || item.price === null || item.price === "") itemPriceKosong++;
        if (item.total === undefined || item.total === null || item.total === "") itemTotalKosong++;
      }
    }

    return {
      nota_total: notaRecords.length,
      item_total: totalItems,
      nota_tanpa_item: notaTanpaItem,
      item_tanpa_nama: itemTanpaNama,
      item_quantity_kosong: itemQtyKosong,
      item_price_kosong: itemPriceKosong,
      item_total_kosong: itemTotalKosong,
    };
  })();

  // 8. Cek Nilai Uang
  const nilaiUang = (() => {
    let subtotalIssues = 0;
    let potongIssues = 0;
    let totalIssues = 0;
    let priceIssues = 0;
    let itemTotalIssues = 0;
    let subtotalMismatch = 0;
    let grandTotalMismatch = 0;
    const negativeValues: { record: unknown; field: string; value: unknown }[] = [];

    for (const n of notaRecords) {
      if (typeof n.subtotal !== "number" || Number.isNaN(n.subtotal)) subtotalIssues++;
      if (typeof n.potong !== "number" || Number.isNaN(n.potong)) potongIssues++;
      if (typeof n.total !== "number" || Number.isNaN(n.total)) totalIssues++;
      if (typeof n.subtotal === "number" && n.subtotal < 0)
        negativeValues.push({ record: n.nomor, field: "subtotal", value: n.subtotal });
      if (typeof n.potong === "number" && n.potong < 0)
        negativeValues.push({ record: n.nomor, field: "potong", value: n.potong });
      if (typeof n.total === "number" && n.total < 0)
        negativeValues.push({ record: n.nomor, field: "total", value: n.total });

      const items = Array.isArray(n.items) ? n.items : [];
      for (const it of items) {
        const item = it as Record<string, unknown>;
        if (typeof item.price !== "number" || Number.isNaN(item.price)) priceIssues++;
        if (typeof item.total !== "number" || Number.isNaN(item.total)) itemTotalIssues++;
        if (typeof item.price === "number" && item.price < 0)
          negativeValues.push({ record: n.nomor, field: "item.price", value: item.price });
        if (typeof item.total === "number" && item.total < 0)
          negativeValues.push({ record: n.nomor, field: "item.total", value: item.total });
      }

      const computedSubtotal = items.reduce(
        (s, it) =>
          s +
          (typeof (it as Record<string, unknown>).total === "number"
            ? ((it as Record<string, unknown>).total as number)
            : 0),
        0,
      );
      if (items.length > 0 && n.subtotal !== computedSubtotal) subtotalMismatch++;
      if (items.length > 0 && n.total !== (n.subtotal as number) - (n.potong as number))
        grandTotalMismatch++;
    }

    return {
      nota_total: notaRecords.length,
      subtotal_bukan_number: subtotalIssues,
      potong_bukan_number: potongIssues,
      total_bukan_number: totalIssues,
      item_price_bukan_number: priceIssues,
      item_total_bukan_number: itemTotalIssues,
      subtotal_berbeda_dari_sum_item: subtotalMismatch,
      total_bukan_subtotal_minus_potong: grandTotalMismatch,
      nilai_negatif: negativeValues,
    };
  })();

  // 9. Cek Data Master
  function auditMaster(label: string, records: Record<string, unknown>[]) {
    let namaKosong = 0;
    const idDupes = countDupes(records.map((r) => r.id));
    let catatanUndefined = 0;
    let alamatUndefined = 0;
    let teleponUndefined = 0;

    for (const r of records) {
      if (!r.nama || (r.nama as string).trim() === "") namaKosong++;
      if (r.catatan === undefined || r.catatan === null) catatanUndefined++;
      if (r.alamat === undefined || r.alamat === null) alamatUndefined++;
      if (r.telepon === undefined || r.telepon === null) teleponUndefined++;
    }

    return {
      label,
      total: records.length,
      nama_kosong: namaKosong,
      id_duplikat: idDupes.length,
      id_duplikat_detail: idDupes,
      catatan_undefined_null: catatanUndefined,
      alamat_undefined_null: alamatUndefined,
      telepon_undefined_null: teleponUndefined,
    };
  }

  const masterPelanggan = auditMaster("Pelanggan", customers);
  const masterPengirim = auditMaster("Pengirim", senders);

  // 10. Cek Tanggal & CreatedAt
  function auditDates(label: string, records: Record<string, unknown>[]) {
    let tanggalInvalid = 0;
    const tanggalFormat: Record<string, number> = {};
    let createdInvalid = 0;
    const createdFormats: string[] = [];

    for (const r of records) {
      if (r.tanggal) {
        if (isISODate(r.tanggal)) {
          tanggalFormat["ISO_valid"] = (tanggalFormat["ISO_valid"] || 0) + 1;
        } else if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(r.tanggal as string)) {
          tanggalFormat["format_indonesia"] = (tanggalFormat["format_indonesia"] || 0) + 1;
        } else {
          tanggalFormat["lainnya"] = (tanggalFormat["lainnya"] || 0) + 1;
          tanggalInvalid++;
        }
      }

      if (r.createdAt) {
        if (isISODate(r.createdAt)) {
          createdFormats.push("ISO");
        } else if (/^\d{4}-\d{2}-\d{2}T/.test(r.createdAt as string)) {
          createdFormats.push("ISO-prefix");
        } else {
          createdFormats.push("other:" + typeof r.createdAt);
          createdInvalid++;
        }
      }
    }

    const createdUnique = [...new Set(createdFormats)];

    return {
      label,
      total: records.length,
      tanggal_invalid: tanggalInvalid,
      tanggal_format: tanggalFormat,
      created_at_invalid: createdInvalid,
      created_at_format_unik: createdUnique,
    };
  }

  const tanggalSuratJalan = auditDates("Surat Jalan", sjRecords);
  const tanggalNota = auditDates("Nota", notaRecords);

  // 11. Cek Konsistensi
  const konsistensi = (() => {
    const sjIDSet = new Set(sjRecords.map((r) => r.id));
    let sjWithItems = 0;
    let sjWithoutItems = 0;
    let notaWithValidRef = 0;
    let notaWithInvalidRef = 0;

    for (const r of sjRecords) {
      if (Array.isArray(r.items) && r.items.length > 0) sjWithItems++;
      else sjWithoutItems++;
    }

    for (const n of notaRecords) {
      if (n.suratJalanId && sjIDSet.has(n.suratJalanId)) notaWithValidRef++;
      else notaWithInvalidRef++;
    }

    return {
      surat_jalan_total: sjRecords.length,
      surat_jalan_dengan_item: sjWithItems,
      surat_jalan_tanpa_item: sjWithoutItems,
      nota_total: notaRecords.length,
      nota_referensi_sj_valid: notaWithValidRef,
      nota_referensi_sj_tidak_valid: notaWithInvalidRef,
    };
  })();

  return {
    timestamp: new Date().toISOString(),
    ringkasan,
    idPelanggan,
    idPengirim,
    idSuratJalan,
    idNota,
    nomorSuratJalan: nomorSJResult,
    nomorNota: nomorNotaResult,
    relasiNotaSuratJalan: relasiNotaSJ,
    itemsSuratJalan,
    itemsNota,
    nilaiUang,
    masterPelanggan,
    masterPengirim,
    tanggalSuratJalan,
    tanggalNota,
    konsistensi,
  };
}

function formatNumber(n: number): string {
  return n.toLocaleString("id-ID");
}

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <h2 className="mt-6 mb-3 flex items-center gap-2 border-b pb-2 text-lg font-bold text-foreground">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
        {number}
      </span>
      {title}
    </h2>
  );
}

function InfoRow({
  label,
  value,
  warn,
}: {
  label: string;
  value: string | number;
  warn?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium ${warn ? "text-red-600" : "text-foreground"}`}>
        {typeof value === "number" ? formatNumber(value) : value || "-"}
      </span>
    </div>
  );
}

function DupesList({
  dupes,
  labelKey,
}: {
  dupes: { value: unknown; count: number }[];
  labelKey: string;
}) {
  if (dupes.length === 0)
    return <p className="text-sm text-muted-foreground">Tidak ada duplikat.</p>;
  return (
    <div className="mt-1 space-y-1">
      {dupes.map((d, i) => (
        <div
          key={`${labelKey}-${i}`}
          className="flex items-center gap-2 rounded bg-red-50 px-3 py-1.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-400"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-mono font-medium">{String(d.value)}</span>
            <span className="ml-1.5 text-red-500">({d.count}x)</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function AuditCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground shadow-sm">{children}</div>
  );
}

type MigrationReport = Awaited<ReturnType<typeof migrateToNeon>>;

function AuditLocalStoragePage() {
  const [mounted, setMounted] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [migrating, setMigrating] = useState(false);
  const [migrationReport, setMigrationReport] = useState<MigrationReport | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const run = useCallback(() => {
    const result = runAudit();
    setReport(result);
  }, []);

  useEffect(() => {
    setMounted(true);
    run();
  }, [run]);

  const handleRefresh = useCallback(() => {
    run();
  }, [run]);

  const handleCopy = useCallback(() => {
    if (!report) return;
    const text = formatReportAsText(report);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    });
  }, [report]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleMigrate = useCallback(async () => {
    if (!report) return;
    setShowConfirm(false);
    setMigrating(true);
    setMigrationReport(null);

    try {
      const payload = {
        customers: read(KEYS.customers),
        senders: read(KEYS.senders),
        suratJalan: read(KEYS.suratJalan),
        nota: read(KEYS.nota),
      };

      const result = await migrateToNeon({ data: payload });
      setMigrationReport(result);
    } catch (e) {
      setMigrationReport({
        success: false,
        customers: { inserted: 0, skipped: 0, conflicts: 0, errors: 0, details: [] },
        senders: { inserted: 0, skipped: 0, conflicts: 0, errors: 0, details: [] },
        suratJalan: { inserted: 0, skipped: 0, conflicts: 0, errors: 0, details: [] },
        suratJalanItems: { inserted: 0, skipped: 0, conflicts: 0, errors: 0 },
        nota: { inserted: 0, skipped: 0, conflicts: 0, errors: 0, details: [] },
        notaItems: { inserted: 0, skipped: 0, conflicts: 0, errors: 0 },
        conflictDetails: [],
        errorDetails: [`Gagal menghubungi server: ${e instanceof Error ? e.message : String(e)}`],
      });
    } finally {
      setMigrating(false);
    }
  }, [report]);

  if (!mounted || !report) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground">Memuat audit...</p>
      </div>
    );
  }

  const r = report;
  const hasIssues =
    r.idPelanggan.duplikat > 0 ||
    r.idPengirim.duplikat > 0 ||
    r.idSuratJalan.duplikat > 0 ||
    r.idNota.duplikat > 0 ||
    r.nomorSuratJalan.duplikat > 0 ||
    r.nomorNota.duplikat > 0 ||
    r.nomorSuratJalan.kosong > 0 ||
    r.nomorNota.kosong > 0 ||
    r.relasiNotaSuratJalan.orphan_tidak_menemukan_sj > 0 ||
    r.nilaiUang.subtotal_berbeda_dari_sum_item > 0 ||
    r.nilaiUang.total_bukan_subtotal_minus_potong > 0 ||
    r.nilaiUang.nilai_negatif.length > 0 ||
    r.itemsSuratJalan.item_tanpa_nama > 0 ||
    r.itemsNota.item_tanpa_nama > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit localStorage</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Read-only &middot; Tidak mengubah data apapun &middot;{" "}
              {new Date(r.timestamp).toLocaleString("id-ID")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Audit
            </button>
            <button
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Tersalin!" : "Salin Hasil Audit"}
            </button>
          </div>
        </div>

        {/* Warning banner if issues found */}
        {hasIssues && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Ditemukan masalah data. Scroll ke bawah untuk melihat detail lengkap.</span>
          </div>
        )}

        {/* 1. Ringkasan */}
        <AuditCard>
          <SectionTitle number={1} title="Ringkasan Jumlah" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <InfoRow label="Pelanggan" value={r.ringkasan.pelanggan} />
            <InfoRow label="Pengirim" value={r.ringkasan.pengirim} />
            <InfoRow label="Surat Jalan" value={r.ringkasan.surat_jalan} />
            <InfoRow label="Item Surat Jalan" value={r.ringkasan.item_surat_jalan} />
            <InfoRow label="Nota" value={r.ringkasan.nota} />
            <InfoRow label="Item Nota" value={r.ringkasan.item_nota} />
          </div>
        </AuditCard>

        {/* 2. Cek ID */}
        <AuditCard>
          <SectionTitle number={2} title="Cek ID" />
          {[r.idPelanggan, r.idPengirim, r.idSuratJalan, r.idNota].map((idCheck) => (
            <div key={idCheck.label} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">{idCheck.label}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
                <InfoRow label="Total" value={idCheck.total} />
                <InfoRow label="Kosong" value={idCheck.kosong} warn={idCheck.kosong > 0} />
                <InfoRow label="UUID valid" value={idCheck.uuid_valid} />
                <InfoRow
                  label="UUID invalid"
                  value={idCheck.uuid_invalid}
                  warn={idCheck.uuid_invalid > 0}
                />
              </div>
              {idCheck.duplikat > 0 && (
                <div className="mt-1.5">
                  <p className="mb-1 text-xs font-medium text-red-600">
                    Duplikat ID: {idCheck.duplikat}
                  </p>
                  <DupesList dupes={idCheck.duplikat_detail} labelKey={idCheck.label} />
                </div>
              )}
              {idCheck.contoh_invalid.length > 0 && (
                <div className="mt-1.5">
                  <p className="mb-1 text-xs font-medium text-amber-600">Contoh invalid:</p>
                  {idCheck.contoh_invalid.map((ex, i) => (
                    <code
                      key={i}
                      className="block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                    >
                      {String(ex)}
                    </code>
                  ))}
                </div>
              )}
            </div>
          ))}
        </AuditCard>

        {/* 3. Nomor Surat Jalan */}
        <AuditCard>
          <SectionTitle number={3} title="Nomor Surat Jalan" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
            <InfoRow label="Total" value={r.nomorSuratJalan.total} />
            <InfoRow
              label="Kosong"
              value={r.nomorSuratJalan.kosong}
              warn={r.nomorSuratJalan.kosong > 0}
            />
            <InfoRow label="Format valid (SJ-XXXX)" value={r.nomorSuratJalan.format_valid} />
            <InfoRow
              label="Format invalid"
              value={r.nomorSuratJalan.format_invalid}
              warn={r.nomorSuratJalan.format_invalid > 0}
            />
          </div>
          {r.nomorSuratJalan.duplikat > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-red-600">
                Duplikat: {r.nomorSuratJalan.duplikat}
              </p>
              <DupesList dupes={r.nomorSuratJalan.duplikat_detail} labelKey="sj-nomor" />
            </div>
          )}
          {r.nomorSuratJalan.contoh_invalid.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-amber-600">Contoh invalid:</p>
              {r.nomorSuratJalan.contoh_invalid.map((ex, i) => (
                <code
                  key={i}
                  className="block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                >
                  {String(ex)}
                </code>
              ))}
            </div>
          )}
        </AuditCard>

        {/* 4. Nomor Nota */}
        <AuditCard>
          <SectionTitle number={4} title="Nomor Nota" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
            <InfoRow label="Total" value={r.nomorNota.total} />
            <InfoRow label="Kosong" value={r.nomorNota.kosong} warn={r.nomorNota.kosong > 0} />
            <InfoRow label="Format valid (NT-XXXX)" value={r.nomorNota.format_valid} />
            <InfoRow
              label="Format invalid"
              value={r.nomorNota.format_invalid}
              warn={r.nomorNota.format_invalid > 0}
            />
          </div>
          {r.nomorNota.duplikat > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-red-600">
                Duplikat: {r.nomorNota.duplikat}
              </p>
              <DupesList dupes={r.nomorNota.duplikat_detail} labelKey="nota-nomor" />
            </div>
          )}
          {r.nomorNota.contoh_invalid.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs font-medium text-amber-600">Contoh invalid:</p>
              {r.nomorNota.contoh_invalid.map((ex, i) => (
                <code
                  key={i}
                  className="block rounded bg-amber-50 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                >
                  {String(ex)}
                </code>
              ))}
            </div>
          )}
        </AuditCard>

        {/* 5. Relasi Nota -> Surat Jalan */}
        <AuditCard>
          <SectionTitle number={5} title="Relasi Nota → Surat Jalan" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
            <InfoRow label="Nota total" value={r.relasiNotaSuratJalan.nota_total} />
            <InfoRow label="Surat Jalan total" value={r.relasiNotaSuratJalan.surat_jalan_total} />
            <InfoRow label="Referensi valid" value={r.relasiNotaSuratJalan.referensi_valid} />
            <InfoRow
              label="SJ ID kosong"
              value={r.relasiNotaSuratJalan.surat_jalan_id_kosong}
              warn={r.relasiNotaSuratJalan.surat_jalan_id_kosong > 0}
            />
            <InfoRow
              label="Orphan (SJ tidak ditemukan)"
              value={r.relasiNotaSuratJalan.orphan_tidak_menemukan_sj}
              warn={r.relasiNotaSuratJalan.orphan_tidak_menemukan_sj > 0}
            />
          </div>
          {r.relasiNotaSuratJalan.orphan_detail.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-red-600">Detail Orphan:</p>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Nomor Nota</th>
                      <th className="px-3 py-1.5 font-medium">suratJalanId</th>
                      <th className="px-3 py-1.5 font-medium">Nomor SJ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.relasiNotaSuratJalan.orphan_detail.map((o, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{o.nomorNota}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">{String(o.suratJalanId)}</td>
                        <td className="px-3 py-1.5 font-mono">{String(o.suratJalanNomor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AuditCard>

        {/* 6. Items Surat Jalan */}
        <AuditCard>
          <SectionTitle number={6} title="Items Surat Jalan" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
            <InfoRow label="Surat Jalan total" value={r.itemsSuratJalan.surat_jalan_total} />
            <InfoRow label="Item total" value={r.itemsSuratJalan.item_total} />
            <InfoRow
              label="SJ tanpa item"
              value={r.itemsSuratJalan.surat_jalan_tanpa_item}
              warn={r.itemsSuratJalan.surat_jalan_tanpa_item > 0}
            />
            <InfoRow
              label="Item tanpa nama"
              value={r.itemsSuratJalan.item_tanpa_nama}
              warn={r.itemsSuratJalan.item_tanpa_nama > 0}
            />
            <InfoRow
              label="Item quantity kosong"
              value={r.itemsSuratJalan.item_quantity_kosong}
              warn={r.itemsSuratJalan.item_quantity_kosong > 0}
            />
            <InfoRow
              label="Item description kosong"
              value={r.itemsSuratJalan.item_description_kosong}
              warn={r.itemsSuratJalan.item_description_kosong > 0}
            />
          </div>
        </AuditCard>

        {/* 7. Items Nota */}
        <AuditCard>
          <SectionTitle number={7} title="Items Nota" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
            <InfoRow label="Nota total" value={r.itemsNota.nota_total} />
            <InfoRow label="Item total" value={r.itemsNota.item_total} />
            <InfoRow
              label="Nota tanpa item"
              value={r.itemsNota.nota_tanpa_item}
              warn={r.itemsNota.nota_tanpa_item > 0}
            />
            <InfoRow
              label="Item tanpa nama"
              value={r.itemsNota.item_tanpa_nama}
              warn={r.itemsNota.item_tanpa_nama > 0}
            />
            <InfoRow
              label="Item quantity kosong"
              value={r.itemsNota.item_quantity_kosong}
              warn={r.itemsNota.item_quantity_kosong > 0}
            />
            <InfoRow
              label="Item price kosong"
              value={r.itemsNota.item_price_kosong}
              warn={r.itemsNota.item_price_kosong > 0}
            />
            <InfoRow
              label="Item total kosong"
              value={r.itemsNota.item_total_kosong}
              warn={r.itemsNota.item_total_kosong > 0}
            />
          </div>
        </AuditCard>

        {/* 8. Nilai Uang */}
        <AuditCard>
          <SectionTitle number={8} title="Nilai Uang (Nota)" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
            <InfoRow label="Nota total" value={r.nilaiUang.nota_total} />
            <InfoRow
              label="Subtotal bukan number"
              value={r.nilaiUang.subtotal_bukan_number}
              warn={r.nilaiUang.subtotal_bukan_number > 0}
            />
            <InfoRow
              label="Potong bukan number"
              value={r.nilaiUang.potong_bukan_number}
              warn={r.nilaiUang.potong_bukan_number > 0}
            />
            <InfoRow
              label="Total bukan number"
              value={r.nilaiUang.total_bukan_number}
              warn={r.nilaiUang.total_bukan_number > 0}
            />
            <InfoRow
              label="Item price bukan number"
              value={r.nilaiUang.item_price_bukan_number}
              warn={r.nilaiUang.item_price_bukan_number > 0}
            />
            <InfoRow
              label="Item total bukan number"
              value={r.nilaiUang.item_total_bukan_number}
              warn={r.nilaiUang.item_total_bukan_number > 0}
            />
            <InfoRow
              label="Subtotal ≠ sum items"
              value={r.nilaiUang.subtotal_berbeda_dari_sum_item}
              warn={r.nilaiUang.subtotal_berbeda_dari_sum_item > 0}
            />
            <InfoRow
              label="Total ≠ subtotal - potong"
              value={r.nilaiUang.total_bukan_subtotal_minus_potong}
              warn={r.nilaiUang.total_bukan_subtotal_minus_potong > 0}
            />
          </div>
          {r.nilaiUang.nilai_negatif.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-medium text-red-600">Nilai negatif ditemukan:</p>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">
                    <tr>
                      <th className="px-3 py-1.5 font-medium">Nomor</th>
                      <th className="px-3 py-1.5 font-medium">Field</th>
                      <th className="px-3 py-1.5 font-medium">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.nilaiUang.nilai_negatif.map((n, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-1.5 font-mono">{String(n.record)}</td>
                        <td className="px-3 py-1.5">{n.field}</td>
                        <td className="px-3 py-1.5 font-mono">{String(n.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </AuditCard>

        {/* 9. Data Master */}
        <AuditCard>
          <SectionTitle number={9} title="Data Master" />
          {[r.masterPelanggan, r.masterPengirim].map((master) => (
            <div key={master.label} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">{master.label}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-4">
                <InfoRow label="Total" value={master.total} />
                <InfoRow
                  label="Nama kosong"
                  value={master.nama_kosong}
                  warn={master.nama_kosong > 0}
                />
                <InfoRow
                  label="ID duplikat"
                  value={master.id_duplikat}
                  warn={master.id_duplikat > 0}
                />
                <InfoRow label="Catatan undefined" value={master.catatan_undefined_null} />
                <InfoRow label="Alamat undefined" value={master.alamat_undefined_null} />
                <InfoRow label="Telepon undefined" value={master.telepon_undefined_null} />
              </div>
              {master.id_duplikat > 0 && (
                <div className="mt-1.5">
                  <DupesList dupes={master.id_duplikat_detail} labelKey={master.label} />
                </div>
              )}
            </div>
          ))}
        </AuditCard>

        {/* 10. Tanggal & CreatedAt */}
        <AuditCard>
          <SectionTitle number={10} title="Tanggal & CreatedAt" />
          {[r.tanggalSuratJalan, r.tanggalNota].map((t) => (
            <div key={t.label} className="mb-4 last:mb-0">
              <h3 className="mb-1.5 text-sm font-semibold text-foreground">{t.label}</h3>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
                <InfoRow label="Total" value={t.total} />
                <InfoRow
                  label="Tanggal invalid"
                  value={t.tanggal_invalid}
                  warn={t.tanggal_invalid > 0}
                />
                <InfoRow
                  label="createdAt invalid"
                  value={t.created_at_invalid}
                  warn={t.created_at_invalid > 0}
                />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                Format tanggal:{" "}
                {Object.entries(t.tanggal_format)
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(", ") || "-"}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Format createdAt unik: {t.created_at_format_unik.join(", ") || "-"}
              </div>
            </div>
          ))}
        </AuditCard>

        {/* 11. Konsistensi */}
        <AuditCard>
          <SectionTitle number={11} title="Konsistensi" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-sm sm:grid-cols-3">
            <InfoRow label="Surat Jalan total" value={r.konsistensi.surat_jalan_total} />
            <InfoRow label="SJ dengan item" value={r.konsistensi.surat_jalan_dengan_item} />
            <InfoRow
              label="SJ tanpa item"
              value={r.konsistensi.surat_jalan_tanpa_item}
              warn={r.konsistensi.surat_jalan_tanpa_item > 0}
            />
            <InfoRow label="Nota total" value={r.konsistensi.nota_total} />
            <InfoRow label="Nota ref SJ valid" value={r.konsistensi.nota_referensi_sj_valid} />
            <InfoRow
              label="Nota ref SJ tidak valid"
              value={r.konsistensi.nota_referensi_sj_tidak_valid}
              warn={r.konsistensi.nota_referensi_sj_tidak_valid > 0}
            />
          </div>
        </AuditCard>

        {/* Footer */}
        <div className="mt-8 mb-6 text-center text-xs text-muted-foreground">
          Audit read-only &middot; Tidak menulis/menghapus data apapun &middot; Tidak melakukan
          request ke server
        </div>

        {/* Migration Section */}
        <AuditCard>
          <SectionTitle number={12} title="Migrasi ke Neon" />
          <p className="mb-3 text-sm text-muted-foreground">
            Salin data localStorage ke database Neon. Data localStorage tidak akan dihapus.
          </p>

          {/* Status */}
          <div className="mb-4 flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-foreground">Status:</span>
            {migrationReport ? (
              <span
                className={
                  migrationReport.success
                    ? "text-green-600 dark:text-green-400"
                    : "text-amber-600 dark:text-amber-400"
                }
              >
                {migrationReport.success ? "Berhasil dimigrasikan" : "Selesai dengan masalah"}
              </span>
            ) : (
              <span className="text-muted-foreground">Belum dimigrasikan</span>
            )}
          </div>

          {/* Confirm Dialog */}
          {showConfirm && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm dark:border-yellow-800 dark:bg-yellow-950">
              <p className="mb-3 text-yellow-800 dark:text-yellow-300">
                Data localStorage akan disalin ke database Neon. Data localStorage tidak akan
                dihapus.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleMigrate}
                  disabled={migrating}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                >
                  {migrating ? "Migrasi..." : "Ya, Migrasikan"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  disabled={migrating}
                  className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Migration Button */}
          {!showConfirm && !migrating && (
            <button
              onClick={() => setShowConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Database className="h-4 w-4" />
              Migrasikan ke Neon
            </button>
          )}

          {/* Loading */}
          {migrating && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Sedang memigrasikan data ke Neon...
            </div>
          )}

          {/* Migration Results */}
          {migrationReport && !migrating && (
            <div className="mt-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Ringkasan Migrasi</h3>
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                {[
                  { label: "Pelanggan", data: migrationReport.customers },
                  { label: "Pengirim", data: migrationReport.senders },
                  { label: "Surat Jalan", data: migrationReport.suratJalan },
                  { label: "Nota", data: migrationReport.nota },
                ].map((item) => (
                  <div key={item.label} className="rounded border p-2">
                    <p className="mb-1 font-medium text-foreground">{item.label}</p>
                    <p className="text-green-600 dark:text-green-400">
                      Inserted: {item.data.inserted}
                    </p>
                    <p className="text-muted-foreground">Skipped: {item.data.skipped}</p>
                    <p
                      className={
                        item.data.conflicts > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-muted-foreground"
                      }
                    >
                      Conflicts: {item.data.conflicts}
                    </p>
                    <p
                      className={
                        item.data.errors > 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted-foreground"
                      }
                    >
                      Errors: {item.data.errors}
                    </p>
                  </div>
                ))}
                <div className="rounded border p-2">
                  <p className="mb-1 font-medium text-foreground">Item Surat Jalan</p>
                  <p className="text-green-600 dark:text-green-400">
                    Inserted: {migrationReport.suratJalanItems.inserted}
                  </p>
                  <p className="text-muted-foreground">
                    Skipped: {migrationReport.suratJalanItems.skipped}
                  </p>
                  <p
                    className={
                      migrationReport.suratJalanItems.conflicts > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }
                  >
                    Conflicts: {migrationReport.suratJalanItems.conflicts}
                  </p>
                  <p
                    className={
                      migrationReport.suratJalanItems.errors > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }
                  >
                    Errors: {migrationReport.suratJalanItems.errors}
                  </p>
                </div>
                <div className="rounded border p-2">
                  <p className="mb-1 font-medium text-foreground">Item Nota</p>
                  <p className="text-green-600 dark:text-green-400">
                    Inserted: {migrationReport.notaItems.inserted}
                  </p>
                  <p className="text-muted-foreground">
                    Skipped: {migrationReport.notaItems.skipped}
                  </p>
                  <p
                    className={
                      migrationReport.notaItems.conflicts > 0
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-muted-foreground"
                    }
                  >
                    Conflicts: {migrationReport.notaItems.conflicts}
                  </p>
                  <p
                    className={
                      migrationReport.notaItems.errors > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-muted-foreground"
                    }
                  >
                    Errors: {migrationReport.notaItems.errors}
                  </p>
                </div>
              </div>

              {/* Conflict Details */}
              {migrationReport.conflictDetails.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-amber-600">
                    Konflik ({migrationReport.conflictDetails.length}):
                  </p>
                  <div className="space-y-1">
                    {migrationReport.conflictDetails.map((msg, i) => (
                      <div
                        key={i}
                        className="rounded bg-amber-50 px-3 py-1.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error Details */}
              {migrationReport.errorDetails.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-red-600">
                    Error ({migrationReport.errorDetails.length}):
                  </p>
                  <div className="space-y-1">
                    {migrationReport.errorDetails.map((msg, i) => (
                      <div
                        key={i}
                        className="rounded bg-red-50 px-3 py-1.5 text-xs text-red-700 dark:bg-red-950 dark:text-red-400"
                      >
                        {msg}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </AuditCard>
      </div>
    </div>
  );
}

function formatReportAsText(r: AuditReport): string {
  const lines: string[] = [];
  const hr = "=".repeat(60);
  const hr2 = "-".repeat(60);

  lines.push(hr);
  lines.push("  AUDIT READ-ONLY — localStorage Data");
  lines.push(hr);
  lines.push(`Timestamp: ${r.timestamp}`);
  lines.push(`READ-ONLY: Script ini TIDAK mengubah data apapun.`);
  lines.push("");

  // 1. Ringkasan
  lines.push(hr2);
  lines.push("  1. RINGKASAN JUMLAH");
  lines.push(hr2);
  lines.push(`  Pelanggan:              ${r.ringkasan.pelanggan}`);
  lines.push(`  Pengirim:               ${r.ringkasan.pengirim}`);
  lines.push(`  Surat Jalan:            ${r.ringkasan.surat_jalan}`);
  lines.push(`  Item Surat Jalan:       ${r.ringkasan.item_surat_jalan}`);
  lines.push(`  Nota:                   ${r.ringkasan.nota}`);
  lines.push(`  Item Nota:              ${r.ringkasan.item_nota}`);
  lines.push("");

  // 2. Cek ID
  lines.push(hr2);
  lines.push("  2. CEK ID");
  lines.push(hr2);
  for (const idCheck of [r.idPelanggan, r.idPengirim, r.idSuratJalan, r.idNota]) {
    lines.push(`  ${idCheck.label}:`);
    lines.push(
      `    Total: ${idCheck.total}, Kosong: ${idCheck.kosong}, UUID valid: ${idCheck.uuid_valid}, UUID invalid: ${idCheck.uuid_invalid}`,
    );
    if (idCheck.duplikat > 0) {
      lines.push(`    ⚠ Duplikat: ${idCheck.duplikat}`);
      for (const d of idCheck.duplikat_detail) {
        lines.push(`      - ${String(d.value)} (${d.count}x)`);
      }
    }
  }
  lines.push("");

  // 3. Nomor SJ
  lines.push(hr2);
  lines.push("  3. NOMOR SURAT JALAN");
  lines.push(hr2);
  lines.push(
    `  Total: ${r.nomorSuratJalan.total}, Kosong: ${r.nomorSuratJalan.kosong}, Format valid: ${r.nomorSuratJalan.format_valid}, Format invalid: ${r.nomorSuratJalan.format_invalid}`,
  );
  if (r.nomorSuratJalan.duplikat > 0) {
    lines.push(`  ⚠ Duplikat: ${r.nomorSuratJalan.duplikat}`);
    for (const d of r.nomorSuratJalan.duplikat_detail) {
      lines.push(`    - ${String(d.value)} (${d.count}x)`);
    }
  }
  lines.push("");

  // 4. Nomor Nota
  lines.push(hr2);
  lines.push("  4. NOMOR NOTA");
  lines.push(hr2);
  lines.push(
    `  Total: ${r.nomorNota.total}, Kosong: ${r.nomorNota.kosong}, Format valid: ${r.nomorNota.format_valid}, Format invalid: ${r.nomorNota.format_invalid}`,
  );
  if (r.nomorNota.duplikat > 0) {
    lines.push(`  ⚠ Duplikat: ${r.nomorNota.duplikat}`);
    for (const d of r.nomorNota.duplikat_detail) {
      lines.push(`    - ${String(d.value)} (${d.count}x)`);
    }
  }
  lines.push("");

  // 5. Relasi
  lines.push(hr2);
  lines.push("  5. RELASI NOTA → SURAT JALAN");
  lines.push(hr2);
  lines.push(`  Nota total: ${r.relasiNotaSuratJalan.nota_total}`);
  lines.push(`  SJ total: ${r.relasiNotaSuratJalan.surat_jalan_total}`);
  lines.push(`  Referensi valid: ${r.relasiNotaSuratJalan.referensi_valid}`);
  lines.push(`  SJ ID kosong: ${r.relasiNotaSuratJalan.surat_jalan_id_kosong}`);
  lines.push(`  Orphan (SJ tidak ditemukan): ${r.relasiNotaSuratJalan.orphan_tidak_menemukan_sj}`);
  if (r.relasiNotaSuratJalan.orphan_detail.length > 0) {
    for (const o of r.relasiNotaSuratJalan.orphan_detail) {
      lines.push(
        `    ⚠ Nota ${o.nomorNota} → SJ ID ${String(o.suratJalanId)} (${String(o.suratJalanNomor)})`,
      );
    }
  }
  lines.push("");

  // 6. Items SJ
  lines.push(hr2);
  lines.push("  6. ITEMS SURAT JALAN");
  lines.push(hr2);
  lines.push(`  SJ total: ${r.itemsSuratJalan.surat_jalan_total}`);
  lines.push(`  Item total: ${r.itemsSuratJalan.item_total}`);
  lines.push(`  SJ tanpa item: ${r.itemsSuratJalan.surat_jalan_tanpa_item}`);
  lines.push(`  Item tanpa nama: ${r.itemsSuratJalan.item_tanpa_nama}`);
  lines.push(`  Item quantity kosong: ${r.itemsSuratJalan.item_quantity_kosong}`);
  lines.push(`  Item description kosong: ${r.itemsSuratJalan.item_description_kosong}`);
  lines.push("");

  // 7. Items Nota
  lines.push(hr2);
  lines.push("  7. ITEMS NOTA");
  lines.push(hr2);
  lines.push(`  Nota total: ${r.itemsNota.nota_total}`);
  lines.push(`  Item total: ${r.itemsNota.item_total}`);
  lines.push(`  Nota tanpa item: ${r.itemsNota.nota_tanpa_item}`);
  lines.push(`  Item tanpa nama: ${r.itemsNota.item_tanpa_nama}`);
  lines.push(`  Item quantity kosong: ${r.itemsNota.item_quantity_kosong}`);
  lines.push(`  Item price kosong: ${r.itemsNota.item_price_kosong}`);
  lines.push(`  Item total kosong: ${r.itemsNota.item_total_kosong}`);
  lines.push("");

  // 8. Nilai Uang
  lines.push(hr2);
  lines.push("  8. NILAI UANG");
  lines.push(hr2);
  lines.push(`  Nota total: ${r.nilaiUang.nota_total}`);
  lines.push(`  Subtotal bukan number: ${r.nilaiUang.subtotal_bukan_number}`);
  lines.push(`  Potong bukan number: ${r.nilaiUang.potong_bukan_number}`);
  lines.push(`  Total bukan number: ${r.nilaiUang.total_bukan_number}`);
  lines.push(`  Item price bukan number: ${r.nilaiUang.item_price_bukan_number}`);
  lines.push(`  Item total bukan number: ${r.nilaiUang.item_total_bukan_number}`);
  lines.push(`  Subtotal ≠ sum items: ${r.nilaiUang.subtotal_berbeda_dari_sum_item}`);
  lines.push(`  Total ≠ subtotal - potong: ${r.nilaiUang.total_bukan_subtotal_minus_potong}`);
  if (r.nilaiUang.nilai_negatif.length > 0) {
    for (const n of r.nilaiUang.nilai_negatif) {
      lines.push(`    ⚠ ${String(n.record)}.${n.field} = ${String(n.value)}`);
    }
  }
  lines.push("");

  // 9. Data Master
  lines.push(hr2);
  lines.push("  9. DATA MASTER");
  lines.push(hr2);
  for (const master of [r.masterPelanggan, r.masterPengirim]) {
    lines.push(`  ${master.label}:`);
    lines.push(
      `    Total: ${master.total}, Nama kosong: ${master.nama_kosong}, ID duplikat: ${master.id_duplikat}`,
    );
  }
  lines.push("");

  // 10. Tanggal
  lines.push(hr2);
  lines.push("  10. TANGGAL & CREATED_AT");
  lines.push(hr2);
  for (const t of [r.tanggalSuratJalan, r.tanggalNota]) {
    lines.push(`  ${t.label}:`);
    lines.push(
      `    Tanggal invalid: ${t.tanggal_invalid}, createdAt invalid: ${t.created_at_invalid}`,
    );
    lines.push(
      `    Format tanggal: ${
        Object.entries(t.tanggal_format)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ") || "-"
      }`,
    );
    lines.push(`    Format createdAt: ${t.created_at_format_unik.join(", ") || "-"}`);
  }
  lines.push("");

  // 11. Konsistensi
  lines.push(hr2);
  lines.push("  11. KONSISTENSI");
  lines.push(hr2);
  lines.push(`  SJ total: ${r.konsistensi.surat_jalan_total}`);
  lines.push(`  SJ dengan item: ${r.konsistensi.surat_jalan_dengan_item}`);
  lines.push(`  SJ tanpa item: ${r.konsistensi.surat_jalan_tanpa_item}`);
  lines.push(`  Nota total: ${r.konsistensi.nota_total}`);
  lines.push(`  Nota ref SJ valid: ${r.konsistensi.nota_referensi_sj_valid}`);
  lines.push(`  Nota ref SJ tidak valid: ${r.konsistensi.nota_referensi_sj_tidak_valid}`);
  lines.push("");
  lines.push(hr);
  lines.push("  READ-ONLY: Tidak ada data yang diubah.");
  lines.push(hr);

  return lines.join("\n");
}
