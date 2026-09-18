import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Calendar,
  Download,
  Edit,
  Eye,
  Filter,
  Loader2,
  Plus,
  Search,
  Trash2,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { MasterAutocomplete } from "@/components/MasterAutocomplete";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useSuratJalanRecords,
  type SuratJalanRecord,
  type SuratJalanItem,
} from "@/lib/suratJalanStorage";
import { useCustomers } from "@/lib/customers";
import { useSenders } from "@/lib/senders";
import { fetchNotaNumbersBySuratJalan } from "@/lib/notaStorage.server";
import { buildSuratJalanPdf, type SlipData } from "@/lib/suratJalanPdf";
import { downloadPdf as saveGeneratedPdf } from "@/lib/pdfDownload";
import { cn } from "@/lib/utils";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const ID_MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

type DateFilter = {
  from: string;
  to: string;
  quick: "all" | "today" | "thisMonth" | "lastMonth";
};

const EMPTY_FILTER: DateFilter = { from: "", to: "", quick: "all" };

function parseTanggalToYMD(tanggal: string): string | null {
  if (!tanggal) return null;
  const iso = tanggal.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const parts = tanggal.split(" ");
  if (parts.length === 3) {
    const [, monthName, yearStr] = parts;
    const monthNum = ID_MONTHS[(monthName ?? "").toLowerCase()];
    const year = Number(yearStr);
    if (monthNum && year >= 2000 && year <= 2100) {
      return `${year}-${String(monthNum).padStart(2, "0")}`;
    }
  }
  return null;
}

function getJakartaNow() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: JAKARTA_TIME_ZONE }));
}

function applyDateFilter(
  tanggal: string,
  from: string,
  to: string,
  quick: DateFilter["quick"],
): boolean {
  if (quick === "all" && !from && !to) return true;
  const ymd = parseTanggalToYMD(tanggal);
  if (!ymd) return true;
  const now = getJakartaNow();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (quick === "today") {
    const todayYMD = now.toISOString().slice(0, 10);
    return ymd === todayYMD;
  }
  if (quick === "thisMonth") {
    return (
      ymd >= `${currentYear}-${String(currentMonth).padStart(2, "0")}` &&
      ymd <
        `${currentMonth === 12 ? currentYear + 1 : currentYear}-${String(currentMonth === 12 ? 1 : currentMonth + 1).padStart(2, "0")}`
    );
  }
  if (quick === "lastMonth") {
    const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const lastYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return (
      ymd >= `${lastYear}-${String(lastMonth).padStart(2, "0")}` &&
      ymd < `${currentYear}-${String(currentMonth).padStart(2, "0")}`
    );
  }
  if (from && to) return ymd >= from && ymd <= to;
  if (from) return ymd >= from;
  if (to) return ymd <= to;
  return true;
}

export const Route = createFileRoute("/laporan")({
  head: () => ({
    meta: [
      { title: "Laporan Surat Jalan" },
      {
        name: "description",
        content: "Daftar surat jalan yang sudah tersimpan.",
      },
    ],
  }),
  component: LaporanPage,
});

const editInput =
  "h-11 rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";

function summarizeItems(items?: SuratJalanItem[]) {
  const parts = (items ?? [])
    .filter((i) => Boolean((i.quantity ?? "").trim() || (i.name ?? "").trim()))
    .map((i) => `${i.quantity ?? ""} ${i.name ?? ""}`.trim());
  return parts.length ? parts.join(" • ") : "—";
}

function toSlipData(record: SuratJalanRecord): SlipData {
  return {
    nomor: record.nomor,
    tanggal: record.tanggal,
    pengirim: record.pengirim,
    teleponPengirim: record.teleponPengirim,
    alamatPengirim: record.alamatPengirim,
    kepada: record.kepada,
    telepon: record.telepon,
    alamat: record.alamat,
    items: record.items,
  };
}

function RowActionButton({
  label,
  tone = "neutral",
  onClick,
  disabled,
  children,
}: {
  label: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          title={label}
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg transition-colors",
            tone === "danger"
              ? "text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a]"
              : "text-[#5a4138] hover:bg-[#eef3ff] hover:text-[#0b1c30]",
            disabled && "cursor-not-allowed opacity-40",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MobileActionButton({
  label,
  tone = "neutral",
  onClick,
  disabled,
  children,
}: {
  label: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold transition-colors",
        tone === "danger"
          ? "bg-[#ffdad6] text-[#ba1a1a] hover:opacity-90"
          : "bg-[#eef3ff] text-[#0b1c30] hover:bg-[#e5eeff]",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
      <h3 className="text-sm font-bold tracking-tight text-[#0b1c30]">{children}</h3>
    </div>
  );
}

function LaporanPage() {
  const { records, loaded, removeRecord, updateRecord } = useSuratJalanRecords();
  const { customers, loaded: customersLoaded } = useCustomers();
  const { senders, loaded: sendersLoaded } = useSenders();
  const hasData = records.length > 0 || loaded;
  const [q, setQ] = useState("");
  const [df, setDf] = useState<DateFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<SuratJalanRecord | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Omit<SuratJalanRecord, "id" | "createdAt" | "nomor">>({
    tanggal: "",
    pengirim: "",
    teleponPengirim: "",
    alamatPengirim: "",
    kepada: "",
    telepon: "",
    alamat: "",
    items: [],
  });
  const [busy, setBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SuratJalanRecord | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isFilterActive = df.quick !== "all" || Boolean(df.from) || Boolean(df.to);

  const sorted = useMemo(() => {
    const textMatch = records.filter((r) =>
      `${r.nomor} ${r.pengirim} ${r.kepada} ${r.tanggal}`.toLowerCase().includes(q.toLowerCase()),
    );
    return textMatch
      .filter((r) => applyDateFilter(r.tanggal, df.from, df.to, df.quick))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [records, q, df]);

  const handleStartEdit = (record: SuratJalanRecord) => {
    setEditingId(record.id);
    setEditForm({
      tanggal: record.tanggal || "",
      pengirim: record.pengirim || "",
      teleponPengirim: record.teleponPengirim || "",
      alamatPengirim: record.alamatPengirim || "",
      kepada: record.kepada || "",
      telepon: record.telepon || "",
      alamat: record.alamat || "",
      items: record.items
        ? record.items.map((item) => ({
            quantity: item.quantity || "",
            name: item.name || "",
            description: item.description || "",
          }))
        : [],
    });
  };

  const closeEdit = () => setEditingId(null);

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);
    try {
      await updateRecord(editingId, editForm);
      toast.success("Surat Jalan diperbarui");
      closeEdit();
    } catch {
      let nomorNota: string[] = [];
      try {
        nomorNota = await fetchNotaNumbersBySuratJalan({ data: deleteTarget.id });
      } catch {
        // abaikan — fallback ke pesan generik
      }
      if (nomorNota.length === 1) {
        toast.error(
          `Surat Jalan ${deleteTarget.nomor} masih digunakan oleh Nota ${nomorNota[0]}. Hapus Nota tersebut terlebih dahulu.`,
        );
      } else if (nomorNota.length > 1) {
        toast.error(
          `Surat Jalan ${deleteTarget.nomor} masih digunakan oleh Nota ${nomorNota.join(", ")}. Hapus Nota tersebut terlebih dahulu.`,
        );
      } else {
        toast.error("Gagal menghapus Surat Jalan");
      }
      // Tutup dialog otomatis di semua jalur gagal agar user tidak perlu menekan Batal
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleItemChange = (index: number, field: keyof SuratJalanItem, value: string) => {
    setEditForm((prev) => {
      const updatedItems = [...prev.items];
      updatedItems[index] = { ...updatedItems[index], [field]: value };
      return { ...prev, items: updatedItems };
    });
  };

  const handleAddItem = () => {
    setEditForm((prev) => ({
      ...prev,
      items: [...prev.items, { quantity: "", name: "", description: "" }],
    }));
  };

  const handleRemoveItem = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const downloadPdf = async (record: SuratJalanRecord) => {
    setBusy(true);
    try {
      const pdf = await buildSuratJalanPdf(toSlipData(record), null);
      await saveGeneratedPdf(pdf, `Surat-Jalan-${record.nomor || "tanpa-nomor"}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    if (!detail) return;
    setPreviewBusy(true);
    try {
      const pdf = await buildSuratJalanPdf(toSlipData(detail), null);
      setPreviewUrl(URL.createObjectURL(pdf.output("blob")));
      setPreviewOpen(true);
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => setPreviewOpen(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeRecord(deleteTarget.id);
      toast.success("Surat Jalan berhasil dihapus");
      setDeleteTarget(null);
    } catch {
      // FK RESTRICT dari tabel nota: cari nomor Nota terkait untuk pesan yang informatif
      const blocked = await fetchNotaNumbersBySuratJalan({
        data: { suratJalanId: deleteTarget.id },
      });
      if (blocked.length === 1) {
        toast.error(
          `Surat Jalan ${deleteTarget.nomor} masih digunakan oleh Nota ${blocked[0]}. Hapus Nota tersebut terlebih dahulu.`,
        );
      } else if (blocked.length > 1) {
        toast.error(
          `Surat Jalan ${deleteTarget.nomor} masih digunakan oleh Nota: ${blocked.join(", ")}. Hapus Nota tersebut terlebih dahulu.`,
        );
      } else {
        toast.error("Gagal menghapus Surat Jalan");
      }
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  };

  if (detail) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] font-sans pb-24 sm:pb-0">
        <AppNav />
        <TooltipProvider delayDuration={150}>
          <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                onClick={() => setDetail(null)}
                className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
              >
                <ArrowLeft className="h-4 w-4" /> Kembali
              </Button>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => downloadPdf(detail)}
                  disabled={busy}
                  className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busy ? "Membuat PDF…" : "Download PDF"}
                </Button>
                <Button
                  onClick={openPreview}
                  disabled={previewBusy}
                  className="h-11 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                >
                  {previewBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                  {previewBusy ? "Membuat PDF…" : "Lihat PDF"}
                </Button>
              </div>
            </div>

            <div className="mt-5 sm:mt-6">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Surat Jalan{" "}
                <span className="font-mono text-2xl font-bold text-[#a33900] sm:text-3xl">
                  {detail.nomor}
                </span>
              </h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">{detail.tanggal}</p>
            </div>

            <div className="mt-6 space-y-4">
              <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[#0b1c30]">
                  <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
                  Data Pengirim
                </h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div>
                    <dt className="text-[12px] text-[#5a4138]">Nama</dt>
                    <dd className="mt-0.5 font-medium text-[#0b1c30]">{detail.pengirim || "-"}</dd>
                  </div>
                  {detail.teleponPengirim && (
                    <div>
                      <dt className="text-[12px] text-[#5a4138]">No. Telp</dt>
                      <dd className="mt-0.5 font-medium text-[#0b1c30]">
                        {detail.teleponPengirim}
                      </dd>
                    </div>
                  )}
                  {detail.alamatPengirim && (
                    <div>
                      <dt className="text-[12px] text-[#5a4138]">Alamat</dt>
                      <dd className="mt-0.5 font-medium text-[#0b1c30]">{detail.alamatPengirim}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[#0b1c30]">
                  <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
                  Data Penerima
                </h2>
                <dl className="mt-3 space-y-2.5 text-sm">
                  <div>
                    <dt className="text-[12px] text-[#5a4138]">Kepada</dt>
                    <dd className="mt-0.5 font-medium text-[#0b1c30]">{detail.kepada || "-"}</dd>
                  </div>
                  {detail.telepon && (
                    <div>
                      <dt className="text-[12px] text-[#5a4138]">No. Telp</dt>
                      <dd className="mt-0.5 font-medium text-[#0b1c30]">{detail.telepon}</dd>
                    </div>
                  )}
                  {detail.alamat && (
                    <div>
                      <dt className="text-[12px] text-[#5a4138]">Alamat</dt>
                      <dd className="mt-0.5 font-medium text-[#0b1c30]">{detail.alamat}</dd>
                    </div>
                  )}
                </dl>
              </section>

              <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
                <h2 className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-[#0b1c30]">
                  <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
                  Barang
                </h2>
                <div className="mt-3 space-y-2">
                  {detail.items.map((item, i) => (
                    <div key={i} className="rounded-xl bg-[#eff4ff] p-3 text-sm">
                      <p className="text-[#0b1c30]">
                        <span className="font-semibold">{item.quantity || "-"}</span>
                        <span className="text-[#5a4138]"> — </span>
                        <span>{item.name || "-"}</span>
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs italic text-[#5a4138]">{item.description}</p>
                      )}
                    </div>
                  ))}
                  {detail.items.length === 0 && (
                    <p className="rounded-xl bg-[#eff4ff] p-3 text-sm text-[#5a4138]">-</p>
                  )}
                </div>
              </section>
            </div>
          </main>

          <Dialog
            open={previewOpen}
            onOpenChange={(open) => {
              if (!open) closePreview();
            }}
          >
            <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:h-[88vh]">
              <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 text-left sm:px-6">
                <DialogTitle className="text-[15px] font-bold tracking-tight text-[#0b1c30]">
                  Pratinjau PDF — {detail.nomor}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Pratinjau PDF Surat Jalan {detail.nomor}.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 bg-[#eef3ff]">
                {previewUrl && (
                  <object
                    title={`Pratinjau PDF Surat Jalan ${detail.nomor}`}
                    data={previewUrl}
                    type="application/pdf"
                    className="h-full w-full"
                  >
                    <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center">
                      <p className="text-[13px] text-[#5a4138]">
                        Pratinjau PDF tidak dapat ditampilkan di browser ini.
                      </p>
                      <a
                        href={previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-11 items-center rounded-lg bg-[#a33900] px-4 text-[13px] font-semibold text-white hover:bg-[#8a3000]"
                      >
                        Buka PDF
                      </a>
                    </div>
                  </object>
                )}
              </div>
              <DialogFooter className="shrink-0 gap-2 border-t border-border/70 px-4 py-3 sm:justify-end sm:space-x-0 sm:px-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={closePreview}
                  className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
                >
                  Tutup
                </Button>
                <Button
                  type="button"
                  onClick={() => downloadPdf(detail)}
                  disabled={busy}
                  className="h-11 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busy ? "Membuat PDF…" : "Download"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-24 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-6 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Laporan
              </h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
                Riwayat Surat Jalan yang telah diterbitkan.
              </p>
            </div>
          </div>

          <div className="mb-4 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a4138]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari no. surat, pengirim, atau penerima…"
                className="h-11 rounded-xl border-0 bg-white pl-10 pr-10 text-sm shadow-sm placeholder:text-[#5a4138]/70 focus-visible:ring-1 focus-visible:ring-[#a33900]/40"
              />
              {q && (
                <button
                  type="button"
                  aria-label="Hapus pencarian"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-[#5a4138] hover:bg-[#eef3ff] hover:text-[#0b1c30]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isFilterActive && (
                <button
                  type="button"
                  onClick={() => setDf(EMPTY_FILTER)}
                  className="flex h-9 shrink-0 items-center gap-1 rounded-lg bg-[#ffdad6] px-3 text-[13px] font-semibold text-[#ba1a1a] hover:bg-[#ffc9c3]"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => setFilterOpen(true)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold transition-colors",
                  isFilterActive
                    ? "bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                    : "bg-white text-[#5a4138] shadow-sm hover:bg-[#eef3ff] hover:text-[#0b1c30]",
                )}
              >
                <Filter className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          </div>

          {isFilterActive && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[12px] text-[#5a4138] sm:text-[13px]">
              <Calendar className="h-3.5 w-3.5 text-[#a33900]" />
              {df.quick === "today" && <span>Hari Ini</span>}
              {df.quick === "thisMonth" && <span>Bulan Ini</span>}
              {df.quick === "lastMonth" && <span>Bulan Lalu</span>}
              {df.quick === "all" && df.from && df.to && (
                <span>
                  {df.from} — {df.to}
                </span>
              )}
              {df.quick === "all" && df.from && !df.to && <span>Dari {df.from}</span>}
              {df.quick === "all" && !df.from && df.to && <span>Sampai {df.to}</span>}
              <span className="text-[#5a4138]/60">·</span>
              <span>{sorted.length} dokumen</span>
            </div>
          )}

          {filterOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={() => setFilterOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label="Filter Tanggal"
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-md sm:rounded-2xl"
              >
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[#d3e4fe] sm:hidden" />
                <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 sm:px-5">
                  <h2 className="text-[15px] font-bold tracking-tight text-[#0b1c30]">
                    Filter Tanggal
                  </h2>
                  <button
                    type="button"
                    aria-label="Tutup"
                    onClick={() => setFilterOpen(false)}
                    className="grid h-8 w-8 place-items-center rounded-full bg-[#eef3ff] text-[#5a4138] hover:bg-[#e5eeff] hover:text-[#0b1c30]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-semibold text-[#5a4138]">Dari</Label>
                      <input
                        type="date"
                        value={df.from}
                        onChange={(e) => setDf({ ...df, from: e.target.value, quick: "all" })}
                        className="h-11 w-full rounded-lg border-0 bg-[#eff4ff] px-3 text-[15px] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[12px] font-semibold text-[#5a4138]">Sampai</Label>
                      <input
                        type="date"
                        value={df.to}
                        onChange={(e) => setDf({ ...df, to: e.target.value, quick: "all" })}
                        className="h-11 w-full rounded-lg border-0 bg-[#eff4ff] px-3 text-[15px] focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        ["all", "Semua"],
                        ["today", "Hari Ini"],
                        ["thisMonth", "Bulan Ini"],
                        ["lastMonth", "Bulan Lalu"],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          setDf(key === "all" ? EMPTY_FILTER : { from: "", to: "", quick: key });
                        }}
                        className={cn(
                          "min-h-[36px] rounded-full px-3 text-[13px] font-semibold transition-colors",
                          df.quick === key
                            ? "bg-[#a33900] text-white shadow-sm"
                            : "bg-[#eff4ff] text-[#5a4138] hover:bg-[#e5eeff] hover:text-[#0b1c30]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 border-t border-border/70 px-4 py-3 sm:px-5">
                  <button
                    type="button"
                    onClick={() => {
                      setDf(EMPTY_FILTER);
                      setFilterOpen(false);
                    }}
                    className="h-11 flex-1 rounded-lg bg-[#e5eeff] text-[13px] font-semibold text-[#0b1c30] transition-colors hover:bg-[#d8e6ff]"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterOpen(false)}
                    className="h-11 flex-1 rounded-lg bg-[#a33900] text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#8a3000]"
                  >
                    Terapkan
                  </button>
                </div>
              </div>
            </div>
          )}

          {editingId && (
            <div className="mb-6 rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <h2 className="text-[15px] font-bold tracking-tight text-[#0b1c30]">
                Edit Surat Jalan
              </h2>
              <form className="mt-4 space-y-5" onSubmit={saveEdit}>
                <section className="space-y-3">
                  <SectionLabel>Kelengkapan Surat</SectionLabel>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="sm:max-w-xs">
                      <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                        Tanggal
                      </label>
                      <Input
                        type="date"
                        value={editForm.tanggal}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))
                        }
                        required
                        className={editInput}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <SectionLabel>Pelanggan / Penerima</SectionLabel>
                  <div>
                    <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                      Kepada
                    </label>
                    <MasterAutocomplete
                      items={customers}
                      loading={!customersLoaded}
                      value={editForm.kepada}
                      placeholder={
                        customers.length
                          ? "Pilih atau ketik nama pelanggan"
                          : "Belum ada master pelanggan"
                      }
                      emptyLabel={
                        customers.length
                          ? "Tidak ada pelanggan yang cocok."
                          : "Belum ada master pelanggan."
                      }
                      required
                      onInputChange={(v) => setEditForm((prev) => ({ ...prev, kepada: v }))}
                      onSelect={(c) =>
                        setEditForm((prev) => ({
                          ...prev,
                          kepada: c.nama,
                          alamat: c.alamat || "",
                          telepon: c.telepon || "",
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                        No. Telp Penerima
                      </label>
                      <Input
                        type="text"
                        value={editForm.telepon}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, telepon: e.target.value }))
                        }
                        className={editInput}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                        Alamat Penerima
                      </label>
                      <Input
                        type="text"
                        value={editForm.alamat}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, alamat: e.target.value }))
                        }
                        className={editInput}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <SectionLabel>Pengirim</SectionLabel>
                  <div>
                    <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                      Pengirim
                    </label>
                    <MasterAutocomplete
                      items={senders}
                      loading={!sendersLoaded}
                      value={editForm.pengirim}
                      placeholder={
                        senders.length
                          ? "Pilih atau ketik nama pengirim"
                          : "Belum ada master pengirim"
                      }
                      emptyLabel={
                        senders.length
                          ? "Tidak ada pengirim yang cocok."
                          : "Belum ada master pengirim."
                      }
                      required
                      onInputChange={(v) => setEditForm((prev) => ({ ...prev, pengirim: v }))}
                      onSelect={(s) =>
                        setEditForm((prev) => ({
                          ...prev,
                          pengirim: s.nama,
                          alamatPengirim: s.alamat || "",
                          teleponPengirim: s.telepon || "",
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="min-w-0">
                      <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                        No. Telp Pengirim
                      </label>
                      <Input
                        type="text"
                        value={editForm.teleponPengirim}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, teleponPengirim: e.target.value }))
                        }
                        className={editInput}
                      />
                    </div>
                    <div className="min-w-0">
                      <label className="mb-1 block text-[13px] font-semibold text-[#0b1c30]">
                        Alamat Pengirim
                      </label>
                      <Input
                        type="text"
                        value={editForm.alamatPengirim}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, alamatPengirim: e.target.value }))
                        }
                        className={editInput}
                      />
                    </div>
                  </div>
                </section>

                <section className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <SectionLabel>Daftar Barang</SectionLabel>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddItem}
                      className="h-10 shrink-0 rounded-lg border-0 bg-[#dce9ff] text-[#a33900] hover:bg-[#cbdffd]"
                    >
                      <Plus className="h-4 w-4 mr-1" /> Tambah Barang
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {editForm.items.map((item, i) => (
                      <div
                        key={i}
                        className="flex flex-col gap-3 rounded-xl bg-[#eff4ff] p-3 sm:flex-row sm:items-center sm:gap-2"
                      >
                        <div className="w-full sm:w-28">
                          <Input
                            type="text"
                            placeholder="Jumlah"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
                            className={editInput}
                          />
                        </div>
                        <div className="w-full sm:flex-1">
                          <Input
                            type="text"
                            placeholder="Nama Barang"
                            value={item.name}
                            onChange={(e) => handleItemChange(i, "name", e.target.value)}
                            className={editInput}
                          />
                        </div>
                        <div className="w-full sm:flex-1">
                          <Input
                            type="text"
                            placeholder="Keterangan"
                            value={item.description}
                            onChange={(e) => handleItemChange(i, "description", e.target.value)}
                            className={editInput}
                          />
                        </div>
                        {editForm.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveItem(i)}
                            className="h-10 w-10 shrink-0 rounded-lg text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </section>

                <div className="flex flex-wrap gap-2 border-t border-border/70 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={closeEdit}
                    className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    type="submit"
                    disabled={busy}
                    className="h-11 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                  >
                    {busy ? "Menyimpan…" : "Simpan Perubahan"}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {!hasData && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center text-sm text-[#5a4138]">
              Memuat data…
            </div>
          )}

          {hasData && records.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] text-[#a33900]">
                <BarChart3 className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b1c30]">
                Belum ada surat jalan yang tersimpan.
              </p>
              <p className="mt-1 text-[13px] text-[#5a4138]">Buat Surat Jalan baru untuk mulai.</p>
            </div>
          )}

          {hasData && records.length > 0 && sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] text-[#a33900]">
                {q || isFilterActive ? (
                  <Search className="h-5 w-5" />
                ) : (
                  <BarChart3 className="h-5 w-5" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b1c30]">
                {q || isFilterActive
                  ? "Tidak ada surat jalan yang cocok."
                  : "Belum ada surat jalan yang tersimpan."}
              </p>
              <p className="mt-1 text-[13px] text-[#5a4138]">
                {q || isFilterActive
                  ? "Coba ganti kata kunci atau filter pencarian Anda."
                  : "Buat Surat Jalan baru untuk mulai."}
              </p>
            </div>
          )}

          {hasData && sorted.length > 0 && (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-[#f2f6ff] text-[12px] font-semibold tracking-wide text-[#5a4138]">
                      <th className="px-4 py-3">No. Surat</th>
                      <th className="px-4 py-3">Pengirim</th>
                      <th className="px-4 py-3">Penerima</th>
                      <th className="px-4 py-3">Barang</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sorted.map((r) => (
                      <tr key={r.id} className="align-top hover:bg-[#f7f9ff]">
                        <td className="px-4 py-3">
                          <p className="font-mono text-[13px] font-bold text-[#0b1c30]">
                            {r.nomor}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[#5a4138]">{r.tanggal}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-medium text-[#0b1c30]">
                            {r.pengirim || "-"}
                          </p>
                          {r.alamatPengirim && (
                            <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-[#5a4138]">
                              {r.alamatPengirim}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-medium text-[#0b1c30]">
                            {r.kepada || "-"}
                          </p>
                          {r.alamat && (
                            <p className="mt-0.5 max-w-[220px] truncate text-[12px] text-[#5a4138]">
                              {r.alamat}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="line-clamp-2 max-w-[260px] text-[12px] leading-5 text-[#0b1c30]">
                            {summarizeItems(r.items)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <RowActionButton label="Lihat detail" onClick={() => setDetail(r)}>
                              <Eye className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton label="Edit" onClick={() => handleStartEdit(r)}>
                              <Edit className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton
                              label="Download PDF"
                              onClick={() => downloadPdf(r)}
                              disabled={busy}
                            >
                              {busy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                            </RowActionButton>
                            <RowActionButton
                              label="Hapus"
                              tone="danger"
                              onClick={() => setDeleteTarget(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </RowActionButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {sorted.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e5eeff] text-[#a33900]">
                        <Truck className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[13px] font-bold text-[#0b1c30]">
                          {r.nomor}
                        </p>
                        <p className="text-[12px] text-[#5a4138]">{r.tanggal}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-[#f2f6ff] p-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                          Pengirim
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                          {r.pengirim || "-"}
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                          Penerima
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                          {r.kepada || "-"}
                        </p>
                      </div>
                      <div className="col-span-2 min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                          Barang
                        </p>
                        <p className="line-clamp-2 mt-0.5 text-[13px] leading-5 text-[#0b1c30]">
                          {summarizeItems(r.items)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <MobileActionButton label="Lihat" onClick={() => setDetail(r)}>
                        <Eye className="h-4 w-4 shrink-0" />
                        <span className="truncate">Lihat</span>
                      </MobileActionButton>
                      <MobileActionButton label="Ubah" onClick={() => handleStartEdit(r)}>
                        <Edit className="h-4 w-4 shrink-0" />
                        <span className="truncate">Ubah</span>
                      </MobileActionButton>
                      <MobileActionButton
                        label="PDF"
                        onClick={() => downloadPdf(r)}
                        disabled={busy}
                      >
                        {busy ? (
                          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">PDF</span>
                      </MobileActionButton>
                      <MobileActionButton
                        label="Hapus"
                        tone="danger"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">Hapus</span>
                      </MobileActionButton>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <Dialog
            open={!!deleteTarget}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Hapus Surat Jalan</DialogTitle>
                <DialogDescription>
                  Apakah Anda yakin ingin menghapus Surat Jalan{" "}
                  <span className="font-bold">{deleteTarget?.nomor}</span>? Tindakan ini tidak dapat
                  dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={busy}>
                  Batal
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={busy}>
                  {busy ? "Menghapus…" : "Hapus"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </TooltipProvider>
    </div>
  );
}
