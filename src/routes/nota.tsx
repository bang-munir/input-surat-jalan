import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Calculator,
  Calendar,
  ChevronRight,
  Download,
  Eye,
  FileText,
  Filter,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Truck,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useNotaRecords, type NotaRecord, type NotaItem } from "@/lib/notaStorage";
import { buildNotaPdfA5, buildNotaPdfA4 } from "@/lib/notaPdf";
import { downloadPdf as saveGeneratedPdf } from "@/lib/pdfDownload";
import {
  useSuratJalanRecords,
  type SuratJalanItem,
  type SuratJalanRecord,
} from "@/lib/suratJalanStorage";
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

export const Route = createFileRoute("/nota")({
  head: () => ({
    meta: [
      { title: "Nota" },
      {
        name: "description",
        content: "Kelola nota berdasarkan Surat Jalan yang sudah tersimpan.",
      },
    ],
  }),
  component: NotaPage,
});

type View = "list" | "create" | "detail" | "edit";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

function parseQuantity(qty: string): number {
  const n = parseFloat(qty.replace(/[^0-9.,]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function computeTotals(items: NotaItem[]) {
  let subtotal = 0;
  for (const it of items) {
    subtotal += it.total;
  }
  return subtotal;
}

function formatPotong(digits: string): string {
  const clean = digits.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  if (clean === "") return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function caretInFormattedText(formatted: string, digitsBeforeCaret: number): number {
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    const ch = formatted.charAt(i);
    if (ch >= "0" && ch <= "9") seen++;
    if (seen === digitsBeforeCaret) return i + 1;
  }
  return formatted.length;
}

const inputStitch =
  "h-11 rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";

function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
      <Icon className="h-4 w-4 shrink-0 text-[#a33900]" />
      <h2 className="text-sm font-bold tracking-tight text-[#0b1c30]">{children}</h2>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 space-y-1.5", className)}>
      <Label className="text-[13px] font-semibold text-[#0b1c30]">{label}</Label>
      {children}
    </div>
  );
}

function RowActionButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          className={cn(
            "grid h-9 w-9 place-items-center rounded-lg transition-colors",
            tone === "danger"
              ? "text-[#ba1a1a] hover:bg-[#ffdad6]"
              : "text-[#5a4138] hover:bg-[#e5eeff] hover:text-[#a33900]",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">{label}</TooltipContent>
    </Tooltip>
  );
}

function MobileActionButton({
  label,
  onClick,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  tone?: "neutral" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold active:scale-[0.98]",
        tone === "danger"
          ? "bg-[#ffdad6] text-[#93000a] hover:bg-[#ffd0cc]"
          : "bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]",
      )}
    >
      {children}
    </button>
  );
}

function NotaPage() {
  const { records: sjRecords } = useSuratJalanRecords();
  const { records: notas, loaded, addRecord, updateRecord, removeRecord } = useNotaRecords();

  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<NotaRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotaRecord | null>(null);
  const [q, setQ] = useState("");
  const [df, setDf] = useState<DateFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);

  const isFilterActive = df.quick !== "all" || Boolean(df.from) || Boolean(df.to);

  const sorted = useMemo(() => {
    const textMatch = notas.filter((r) =>
      `${r.nomor} ${r.pengirim} ${r.penerima} ${r.tanggal}`.toLowerCase().includes(q.toLowerCase()),
    );
    return textMatch
      .filter((r) => applyDateFilter(r.tanggal, df.from, df.to, df.quick))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [notas, q, df]);

  if (view === "create") {
    return (
      <CreateNota
        sjRecords={sjRecords}
        onBack={() => setView("list")}
        onSave={async (data) => {
          try {
            await addRecord(data);
            toast.success("Nota berhasil dibuat");
            setView("list");
          } catch (err) {
            console.error(err);
            toast.error("Gagal membuat Nota");
          }
        }}
      />
    );
  }

  if (view === "detail" && selected) {
    return (
      <DetailNota
        record={selected}
        onBack={() => {
          setView("list");
          setSelected(null);
        }}
        onEdit={() => setView("edit")}
      />
    );
  }

  if (view === "edit" && selected) {
    return (
      <EditNota
        record={selected}
        sjRecords={sjRecords}
        onBack={() => setView("detail")}
        onSave={(data) => {
          updateRecord(selected.id, data);
          toast.success("Nota berhasil diperbarui");
          setSelected({ ...selected, ...data });
          setView("detail");
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">Nota</h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
                Kelola nota berdasarkan Surat Jalan yang sudah tersimpan.
              </p>
            </div>
            <Button
              onClick={() => setView("create")}
              className="h-11 shrink-0 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
            >
              <Plus className="h-4 w-4" /> Buat Nota
            </Button>
          </div>

          <div className="mb-4 flex flex-col gap-2.5 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a4138]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari no. nota, pengirim, atau penerima…"
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
              <span>{sorted.length} nota</span>
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

          {!loaded && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center text-sm text-[#5a4138]">
              Memuat data…
            </div>
          )}

          {loaded && notas.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] text-[#a33900]">
                <FileText className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b1c30]">Belum ada Nota.</p>
              <p className="mt-1 text-[13px] text-[#5a4138]">
                Nota yang dibuat akan muncul di sini.
              </p>
            </div>
          )}

          {loaded && notas.length > 0 && sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] text-[#a33900]">
                {q || isFilterActive ? (
                  <Search className="h-5 w-5" />
                ) : (
                  <FileText className="h-5 w-5" />
                )}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b1c30]">
                {q || isFilterActive ? "Tidak ada nota yang cocok." : "Belum ada Nota."}
              </p>
              <p className="mt-1 text-[13px] text-[#5a4138]">
                {q || isFilterActive
                  ? "Coba ganti kata kunci atau filter pencarian Anda."
                  : "Nota yang dibuat akan muncul di sini."}
              </p>
            </div>
          )}

          {loaded && sorted.length > 0 && (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-[#f2f6ff] text-[12px] font-semibold tracking-wide text-[#5a4138]">
                      <th className="px-4 py-3">No. Nota</th>
                      <th className="px-4 py-3">Surat Jalan</th>
                      <th className="px-4 py-3">Pengirim</th>
                      <th className="px-4 py-3">Penerima</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {sorted.map((n) => (
                      <tr key={n.id} className="align-top hover:bg-[#f7f9ff]">
                        <td className="px-4 py-3">
                          <p className="font-mono text-[13px] font-bold text-[#0b1c30]">
                            {n.nomor}
                          </p>
                          <p className="mt-0.5 text-[12px] text-[#5a4138]">{n.tanggal}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-[13px] font-medium text-[#a33900]">
                            {n.suratJalanNomor}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[200px] truncate font-medium text-[#0b1c30]">
                            {n.pengirim || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[200px] truncate font-medium text-[#0b1c30]">
                            {n.penerima || "-"}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-semibold text-[#0b1c30]">{formatRupiah(n.total)}</p>
                          <p className="mt-0.5 text-[12px] text-[#5a4138]">
                            {n.items.length} barang
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <RowActionButton
                              label="Lihat detail"
                              onClick={() => {
                                setSelected(n);
                                setView("detail");
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton
                              label="Edit"
                              onClick={() => {
                                setSelected(n);
                                setView("edit");
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </RowActionButton>
                            <RowActionButton
                              label="Hapus"
                              tone="danger"
                              onClick={() => setDeleteTarget(n)}
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
                {sorted.map((n) => (
                  <article
                    key={n.id}
                    className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e5eeff] text-[#a33900]">
                        <FileText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-[13px] font-bold text-[#0b1c30]">
                          {n.nomor}
                        </p>
                        <p className="text-[12px] text-[#5a4138]">
                          {n.tanggal} • Ref {n.suratJalanNomor}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="min-w-0 rounded-xl bg-[#f2f6ff] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                          Pengirim
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                          {n.pengirim || "-"}
                        </p>
                      </div>
                      <div className="min-w-0 rounded-xl bg-[#f2f6ff] p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                          Penerima
                        </p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                          {n.penerima || "-"}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between rounded-xl bg-[#f2f6ff] px-3 py-2.5">
                      <span className="text-[12px] font-semibold text-[#5a4138]">
                        Total · {n.items.length} barang
                      </span>
                      <span className="text-[14px] font-bold text-[#0b1c30]">
                        {formatRupiah(n.total)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <MobileActionButton
                        label="Lihat"
                        onClick={() => {
                          setSelected(n);
                          setView("detail");
                        }}
                      >
                        <Eye className="h-4 w-4 shrink-0" />
                        <span className="truncate">Lihat</span>
                      </MobileActionButton>
                      <MobileActionButton
                        label="Ubah"
                        onClick={() => {
                          setSelected(n);
                          setView("edit");
                        }}
                      >
                        <Pencil className="h-4 w-4 shrink-0" />
                        <span className="truncate">Ubah</span>
                      </MobileActionButton>
                      <MobileActionButton
                        label="Hapus"
                        tone="danger"
                        onClick={() => setDeleteTarget(n)}
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
                <DialogTitle>Hapus Nota</DialogTitle>
                <DialogDescription>
                  Apakah Anda yakin ingin menghapus Nota{" "}
                  <span className="font-bold">{deleteTarget?.nomor}</span>? Tindakan ini tidak dapat
                  dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                  Batal
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (deleteTarget) {
                      removeRecord(deleteTarget.id);
                      toast.success("Nota berhasil dihapus");
                      setDeleteTarget(null);
                    }
                  }}
                >
                  Hapus
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </TooltipProvider>
    </div>
  );
}

function SelectSuratJalan({
  sjRecords,
  onSelect,
  onBack,
}: {
  sjRecords: SuratJalanRecord[];
  onSelect: (sj: SuratJalanRecord) => void;
  onBack: () => void;
}) {
  const [q, setQ] = useState("");

  const filtered = sjRecords.filter((r) =>
    `${r.nomor} ${r.pengirim} ${r.kepada} ${r.tanggal}`.toLowerCase().includes(q.toLowerCase()),
  );

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-6 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Pilih Surat Jalan
              </h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
                Pilih Surat Jalan yang akan dijadikan Nota.
              </p>
            </div>
          </div>

          <div className="relative mb-4 sm:mb-6">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a4138]" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari Surat Jalan…"
              className="h-11 rounded-xl border-0 bg-white pl-10 pr-10 text-sm shadow-sm placeholder:text-[#5a4138]/70 focus-visible:ring-1 focus-visible:ring-[#a33900]/40"
            />
            {q && (
              <button
                type="button"
                aria-label="Bersihkan pencarian"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#5a4138] hover:bg-[#e5eeff]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-3">
            {sorted.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center text-sm text-[#5a4138]">
                {sjRecords.length === 0
                  ? "Belum ada Surat Jalan yang tersimpan."
                  : "Tidak ada Surat Jalan yang cocok."}
              </div>
            )}
            {sorted.map((sj) => (
              <button
                key={sj.id}
                type="button"
                onClick={() => onSelect(sj)}
                className="w-full rounded-2xl border border-border/70 bg-white p-4 text-left shadow-sm transition-colors hover:bg-[#f7f9ff] sm:p-5"
              >
                <div className="flex items-start gap-2.5">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e5eeff] text-[#a33900]">
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[13px] font-bold text-[#0b1c30]">
                      {sj.nomor}
                    </p>
                    <p className="text-[12px] text-[#5a4138]">{sj.tanggal}</p>
                  </div>
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#a33900]" />
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                      Pengirim
                    </p>
                    <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                      {sj.pengirim || "-"}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                      Penerima
                    </p>
                    <p className="mt-0.5 truncate text-[13px] font-medium text-[#0b1c30]">
                      {sj.kepada || "-"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-[#f2f6ff] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                    Daftar Barang
                  </p>
                  <div className="mt-1.5 space-y-1">
                    {sj.items.map((item, i) => (
                      <p key={i} className="text-[13px]">
                        <span className="font-semibold text-[#0b1c30]">{item.quantity || "-"}</span>
                        <span className="text-[#5a4138]"> — </span>
                        <span className="text-[#0b1c30]">{item.name || "-"}</span>
                      </p>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </main>
      </TooltipProvider>
    </div>
  );
}

function CreateNota({
  sjRecords,
  onBack,
  onSave,
}: {
  sjRecords: SuratJalanRecord[];
  onBack: () => void;
  onSave: (data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => void;
}) {
  const [step, setStep] = useState<"select" | "form">("select");
  const [selectedSJ, setSelectedSJ] = useState<SuratJalanRecord | null>(null);
  const [tanggal, setTanggal] = useState(todayISO());
  const [items, setItems] = useState<NotaItem[]>([]);
  const [potong, setPotong] = useState(0);
  const [potongText, setPotongText] = useState("");
  const [priceTexts, setPriceTexts] = useState<string[]>([]);

  if (step === "select") {
    return (
      <SelectSuratJalan
        sjRecords={sjRecords}
        onBack={onBack}
        onSelect={(sj) => {
          setSelectedSJ(sj);
          setItems(
            sj.items.map((it) => ({
              ...it,
              price: 0,
              total: 0,
            })),
          );
          setPriceTexts(sj.items.map(() => ""));
          setTanggal(todayISO());
          setPotong(0);
          setPotongText("");
          setStep("form");
        }}
      />
    );
  }

  const setItemField = (index: number, field: keyof NotaItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      if (field === "price" || field === "quantity") {
        const qty = parseQuantity(field === "quantity" ? String(value) : updated.quantity);
        const price = typeof updated.price === "number" ? updated.price : 0;
        updated.total = qty * price;
      }
      next[index] = updated;
      return next;
    });
  };

  const handlePotongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digits = el.value.replace(/\D/g, "");
    const formatted = formatPotong(digits);
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, "").length;
    setPotongText(formatted);
    setPotong(parseInt(digits, 10) || 0);
    requestAnimationFrame(() => {
      try {
        let seen = 0;
        let nextCaret = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
          const ch = formatted.charAt(i);
          if (ch >= "0" && ch <= "9") seen++;
          if (seen === digitsBeforeCaret) {
            nextCaret = i + 1;
            break;
          }
        }
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    });
  };

  const handlePriceChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digits = el.value.replace(/\D/g, "");
    const formatted = formatPotong(digits);
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, "").length;
    setPriceTexts((prev) => {
      const next = [...prev];
      next[index] = formatted;
      return next;
    });
    setItemField(index, "price", parseInt(digits, 10) || 0);
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(
          caretInFormattedText(formatted, digitsBeforeCaret),
          caretInFormattedText(formatted, digitsBeforeCaret),
        );
      } catch {
        // ignore
      }
    });
  };

  const subtotal = computeTotals(items);
  const total = subtotal - potong;

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-6 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => setStep("select")}
              className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Buat Nota
              </h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
                Berdasarkan Surat Jalan {selectedSJ?.nomor}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <section className="space-y-3.5">
                <SectionHeader icon={FileText}>Data Nota</SectionHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Referensi Surat Jalan">
                    <Input
                      value={selectedSJ?.nomor || ""}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                  <Field label="Tanggal">
                    <Input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={inputStitch}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Pengirim">
                    <Input
                      value={selectedSJ?.pengirim || ""}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                  <Field label="Penerima">
                    <Input
                      value={selectedSJ?.kepada || ""}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                </div>
              </section>

              <div className="h-px w-full bg-border/70" />

              <section className="space-y-3.5">
                <SectionHeader icon={Package}>Daftar Barang</SectionHeader>
                {items.map((item, index) => (
                  <div key={index} className="rounded-xl bg-[#eff4ff] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="rounded-md bg-[#dce9ff] px-2 py-0.5 text-xs font-bold text-[#3f465c]">
                          #{String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-bold tracking-tight text-[#0b1c30]">
                          Barang {index + 1}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-[#a33900]">
                        {formatRupiah(item.total)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                      <Field label="Qty">
                        <Input
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => setItemField(index, "quantity", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                      <Field label="Nama Barang">
                        <Input
                          value={item.name}
                          onChange={(e) => setItemField(index, "name", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <Field label="Keterangan">
                        <Input
                          value={item.description}
                          onChange={(e) => setItemField(index, "description", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                      <Field label="Harga (Rp)">
                        <Input
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          value={priceTexts[index] ?? ""}
                          placeholder="0"
                          onChange={(e) => handlePriceChange(index, e)}
                          className={inputStitch}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </section>

              <div className="h-px w-full bg-border/70" />

              <section className="space-y-3">
                <SectionHeader icon={User}>Catatan</SectionHeader>
                <Textarea
                  rows={2}
                  className="resize-none rounded-lg border-0 bg-[#eff4ff] px-3.5 py-3 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40"
                />
              </section>

              <section className="space-y-3 rounded-xl bg-[#f2f6ff] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-[#0b1c30]">
                    Kalkulasi Pembayaran
                  </h3>
                  <span className="text-[12px] text-[#5a4138]">Rupiah (Rp)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#5a4138]">Subtotal Barang</span>
                  <span className="font-semibold text-[#0b1c30]">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="whitespace-nowrap text-[#5a4138]">Potong / DP</span>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 w-36 rounded-lg border-0 bg-white px-3 text-right shadow-sm focus-visible:ring-1 focus-visible:ring-[#a33900]/40 sm:w-44"
                    value={potongText}
                    placeholder="0"
                    onChange={handlePotongChange}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#a33900]/10 p-3.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#a33900]">
                      Total Nota
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#5a4138]">Subtotal − Potong / DP</p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-right text-base font-bold tracking-tight text-[#a33900] sm:text-xl">
                    {formatRupiah(total)}
                  </p>
                </div>
              </section>

              <Button
                className="h-11 w-full rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                onClick={() => {
                  if (!selectedSJ) return;
                  onSave({
                    tanggal: formatTanggal(tanggal),
                    suratJalanId: selectedSJ.id,
                    suratJalanNomor: selectedSJ.nomor,
                    pengirim: selectedSJ.pengirim,
                    penerima: selectedSJ.kepada,
                    items,
                    subtotal,
                    potong,
                    total,
                  });
                }}
              >
                Simpan Nota
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader icon={Truck}>Ringkasan Surat Jalan</SectionHeader>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-[#5a4138]">Nomor</span>
                  <span className="font-mono font-semibold text-[#0b1c30]">
                    {selectedSJ?.nomor}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#5a4138]">Tanggal</span>
                  <span className="font-medium text-[#0b1c30]">{selectedSJ?.tanggal}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#5a4138]">Pengirim</span>
                  <span className="font-medium text-[#0b1c30]">{selectedSJ?.pengirim || "-"}</span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-[#5a4138]">Penerima</span>
                  <span className="font-medium text-[#0b1c30]">{selectedSJ?.kepada || "-"}</span>
                </div>
              </div>
              <div className="mt-5">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#5a4138]">
                  Barang
                </p>
                <div className="mt-2 space-y-2">
                  {selectedSJ?.items.map((item, i) => (
                    <div key={i} className="rounded-lg bg-[#f2f6ff] p-2.5 text-[13px]">
                      <p className="text-[#0b1c30]">
                        <span className="font-semibold">{item.quantity || "-"}</span>
                        <span className="text-[#5a4138]"> — </span>
                        <span>{item.name || "-"}</span>
                      </p>
                      {item.description && (
                        <p className="mt-0.5 text-xs italic text-[#5a4138]">{item.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </main>
      </TooltipProvider>
    </div>
  );
}

function DetailNota({
  record,
  onBack,
  onEdit,
}: {
  record: NotaRecord;
  onBack: () => void;
  onEdit: () => void;
}) {
  const [generating, setGenerating] = useState<"a5" | "a4" | null>(null);

  const handleDownloadPdf = async (format: "a5" | "a4") => {
    setGenerating(format);
    try {
      const pdf = format === "a5" ? await buildNotaPdfA5(record) : await buildNotaPdfA4(record);
      const suffix = format === "a5" ? "A5" : "A4";
      await saveGeneratedPdf(pdf, `Nota-${record.nomor}-${suffix}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error(format === "a5" ? "Gagal membuat PDF A5" : "Gagal membuat PDF A4");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-5 flex items-center justify-between gap-2 sm:mb-8">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-11 shrink-0 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff] sm:h-10"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                variant="outline"
                onClick={onEdit}
                className="h-10 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
              >
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button
                onClick={() => handleDownloadPdf("a5")}
                disabled={generating !== null}
                className="h-10 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
              >
                {generating === "a5" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{" "}
                {generating === "a5" ? "Memproses…" : "Download A5"}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf("a4")}
                disabled={generating !== null}
                className="h-10 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
              >
                {generating === "a4" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}{" "}
                {generating === "a4" ? "Memproses…" : "Download A4"}
              </Button>
            </div>
          </div>

          <div className="mb-5 flex flex-col gap-2.5 sm:hidden">
            <Button
              variant="outline"
              onClick={onEdit}
              className="h-11 w-full rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                onClick={() => handleDownloadPdf("a5")}
                disabled={generating !== null}
                className="h-11 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
              >
                {generating === "a5" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}{" "}
                <span className="truncate">
                  {generating === "a5" ? "Memproses…" : "Download A5"}
                </span>
              </Button>
              <Button
                variant="outline"
                onClick={() => handleDownloadPdf("a4")}
                disabled={generating !== null}
                className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
              >
                {generating === "a4" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 shrink-0" />
                )}{" "}
                <span className="truncate">
                  {generating === "a4" ? "Memproses…" : "Download A4"}
                </span>
              </Button>
            </div>
          </div>

          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
              Detail Nota <span className="font-mono text-[#a33900]">{record.nomor}</span>
            </h1>
            <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
              {record.tanggal} • Ref Surat Jalan {record.suratJalanNomor}
            </p>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 lg:items-start">
            <div className="space-y-4">
              <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
                <SectionHeader icon={FileText}>Informasi Nota</SectionHeader>
                <dl className="mt-4 space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a4138]">No. Nota</dt>
                    <dd className="font-mono font-bold text-[#0b1c30]">{record.nomor}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a4138]">Tanggal</dt>
                    <dd className="font-medium text-[#0b1c30]">{record.tanggal}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-[#5a4138]">Ref Surat Jalan</dt>
                    <dd className="font-medium text-[#0b1c30]">{record.suratJalanNomor}</dd>
                  </div>
                </dl>
                <div className="mt-5 grid gap-4 border-t border-border/70 pt-4 sm:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[#a33900]" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                        Pengirim
                      </p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#0b1c30]">
                      {record.pengirim || "-"}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-[#a33900]" />
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#5a4138]">
                        Penerima
                      </p>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#0b1c30]">
                      {record.penerima || "-"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
                <SectionHeader icon={Package}>Daftar Barang</SectionHeader>
                <div className="mt-4 space-y-2.5">
                  {record.items.map((item, i) => (
                    <div key={i} className="rounded-xl bg-[#eff4ff] p-3 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium text-[#0b1c30]">
                            <span className="font-bold">{item.quantity || "-"}</span>
                            <span className="text-[#5a4138]"> — </span>
                            <span>{item.name || "-"}</span>
                          </p>
                          {item.description && (
                            <p className="mt-1 text-xs italic text-[#5a4138]">{item.description}</p>
                          )}
                        </div>
                        <div className="shrink-0 text-right text-xs">
                          <p className="text-[#5a4138]">{formatRupiah(item.price)}</p>
                          <p className="mt-0.5 font-bold text-[#0b1c30]">
                            {formatRupiah(item.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-5">
              <SectionHeader icon={Calculator}>Ringkasan</SectionHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5a4138]">Subtotal</span>
                  <span className="font-semibold text-[#0b1c30]">
                    {formatRupiah(record.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5a4138]">Potong / DP</span>
                  <span className="font-semibold text-[#0b1c30]">
                    {formatRupiah(record.potong)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#a33900]/10 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#a33900]">
                    Total
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-base font-bold tracking-tight text-[#a33900] sm:text-lg">
                    {formatRupiah(record.total)}
                  </span>
                </div>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4 text-center text-xs text-[#5a4138]">
                <div>
                  <p className="font-bold tracking-[0.14em] text-[#a33900]">PENERIMA,</p>
                  <p className="mt-8">(&nbsp;..................................&nbsp;)</p>
                </div>
                <div>
                  <p className="font-bold tracking-[0.14em] text-[#a33900]">HORMAT KAMI,</p>
                  <p className="mt-8 font-medium">( {record.pengirim || "................."} )</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </TooltipProvider>
    </div>
  );
}

function EditNota({
  record,
  sjRecords,
  onBack,
  onSave,
}: {
  record: NotaRecord;
  sjRecords: SuratJalanRecord[];
  onBack: () => void;
  onSave: (data: Omit<NotaRecord, "id" | "nomor" | "createdAt">) => void;
}) {
  const [tanggal, setTanggal] = useState(() => {
    const d = new Date(record.tanggal);
    if (Number.isNaN(d.getTime())) return todayISO();
    return d.toISOString().slice(0, 10);
  });
  const [items, setItems] = useState<NotaItem[]>(record.items.map((it) => ({ ...it })));
  const [potong, setPotong] = useState(record.potong);
  const [potongText, setPotongText] = useState(formatPotong(String(record.potong)));
  const [priceTexts, setPriceTexts] = useState<string[]>(() =>
    record.items.map((it) => (it.price ? formatPotong(String(it.price)) : "")),
  );

  const setItemField = (index: number, field: keyof NotaItem, value: string | number) => {
    setItems((prev) => {
      const next = [...prev];
      const updated = { ...next[index], [field]: value };
      if (field === "price" || field === "quantity") {
        const qty = parseQuantity(field === "quantity" ? String(value) : updated.quantity);
        const price = typeof updated.price === "number" ? updated.price : 0;
        updated.total = qty * price;
      }
      next[index] = updated;
      return next;
    });
  };

  const handlePotongChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digits = el.value.replace(/\D/g, "");
    const formatted = formatPotong(digits);
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, "").length;
    setPotongText(formatted);
    setPotong(parseInt(digits, 10) || 0);
    requestAnimationFrame(() => {
      try {
        let seen = 0;
        let nextCaret = formatted.length;
        for (let i = 0; i < formatted.length; i++) {
          const ch = formatted.charAt(i);
          if (ch >= "0" && ch <= "9") seen++;
          if (seen === digitsBeforeCaret) {
            nextCaret = i + 1;
            break;
          }
        }
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    });
  };

  const handlePriceChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const caret = el.selectionStart ?? el.value.length;
    const digits = el.value.replace(/\D/g, "");
    const formatted = formatPotong(digits);
    const digitsBeforeCaret = el.value.slice(0, caret).replace(/\D/g, "").length;
    setPriceTexts((prev) => {
      const next = [...prev];
      next[index] = formatted;
      return next;
    });
    setItemField(index, "price", parseInt(digits, 10) || 0);
    requestAnimationFrame(() => {
      try {
        const nextCaret = caretInFormattedText(formatted, digitsBeforeCaret);
        el.setSelectionRange(nextCaret, nextCaret);
      } catch {
        // ignore
      }
    });
  };

  const subtotal = computeTotals(items);
  const total = subtotal - potong;

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="mb-6 flex items-center gap-3">
            <Button
              variant="outline"
              onClick={onBack}
              className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
            >
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Edit Nota — <span className="font-mono text-[#a33900]">{record.nomor}</span>
              </h1>
              <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
                Ref Surat Jalan: {record.suratJalanNomor}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            <div className="space-y-4 rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <section className="space-y-3.5">
                <SectionHeader icon={FileText}>Data Nota</SectionHeader>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Referensi Surat Jalan">
                    <Input
                      value={record.suratJalanNomor}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                  <Field label="Tanggal">
                    <Input
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className={inputStitch}
                    />
                  </Field>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Pengirim">
                    <Input
                      value={record.pengirim}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                  <Field label="Penerima">
                    <Input
                      value={record.penerima}
                      readOnly
                      className={cn(inputStitch, "bg-[#eef3ff] text-[#5a4138]")}
                    />
                  </Field>
                </div>
              </section>

              <div className="h-px w-full bg-border/70" />

              <section className="space-y-3.5">
                <SectionHeader icon={Package}>Daftar Barang</SectionHeader>
                {items.map((item, index) => (
                  <div key={index} className="rounded-xl bg-[#eff4ff] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2">
                        <span className="rounded-md bg-[#dce9ff] px-2 py-0.5 text-xs font-bold text-[#3f465c]">
                          #{String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="text-sm font-bold tracking-tight text-[#0b1c30]">
                          Barang {index + 1}
                        </span>
                      </span>
                      <span className="text-xs font-bold text-[#a33900]">
                        {formatRupiah(item.total)}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                      <Field label="Qty">
                        <Input
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(e) => setItemField(index, "quantity", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                      <Field label="Nama Barang">
                        <Input
                          value={item.name}
                          onChange={(e) => setItemField(index, "name", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                    </div>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px]">
                      <Field label="Keterangan">
                        <Input
                          value={item.description}
                          onChange={(e) => setItemField(index, "description", e.target.value)}
                          className={inputStitch}
                        />
                      </Field>
                      <Field label="Harga (Rp)">
                        <Input
                          inputMode="numeric"
                          autoComplete="off"
                          spellCheck={false}
                          value={priceTexts[index] ?? ""}
                          placeholder="0"
                          onChange={(e) => handlePriceChange(index, e)}
                          className={inputStitch}
                        />
                      </Field>
                    </div>
                  </div>
                ))}
              </section>

              <section className="space-y-3 rounded-xl bg-[#f2f6ff] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold tracking-tight text-[#0b1c30]">
                    Kalkulasi Pembayaran
                  </h3>
                  <span className="text-[12px] text-[#5a4138]">Rupiah (Rp)</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#5a4138]">Subtotal Barang</span>
                  <span className="font-semibold text-[#0b1c30]">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="whitespace-nowrap text-[#5a4138]">Potong / DP</span>
                  <Input
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-11 w-36 rounded-lg border-0 bg-white px-3 text-right shadow-sm focus-visible:ring-1 focus-visible:ring-[#a33900]/40 sm:w-44"
                    value={potongText}
                    placeholder="0"
                    onChange={handlePotongChange}
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#a33900]/10 p-3.5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#a33900]">
                      Total Nota
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#5a4138]">Subtotal − Potong / DP</p>
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-right text-base font-bold tracking-tight text-[#a33900] sm:text-xl">
                    {formatRupiah(total)}
                  </p>
                </div>
              </section>

              <Button
                className="h-11 w-full rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                onClick={() => {
                  onSave({
                    tanggal: formatTanggal(tanggal),
                    suratJalanId: record.suratJalanId,
                    suratJalanNomor: record.suratJalanNomor,
                    pengirim: record.pengirim,
                    penerima: record.penerima,
                    items,
                    subtotal,
                    potong,
                    total,
                  });
                }}
              >
                Simpan Perubahan
              </Button>
            </div>

            <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm sm:p-6">
              <SectionHeader icon={Calculator}>Ringkasan Nota</SectionHeader>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#5a4138]">Subtotal</span>
                  <span className="font-semibold text-[#0b1c30]">{formatRupiah(subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#5a4138]">Potong / DP</span>
                  <span className="font-semibold text-[#0b1c30]">{formatRupiah(potong)}</span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-[#a33900]/10 p-3.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#a33900]">
                    Total
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-right text-base font-bold tracking-tight text-[#a33900] sm:text-lg">
                    {formatRupiah(total)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </TooltipProvider>
    </div>
  );
}
