import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, FileText, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { useNotaRecords, type NotaRecord, type NotaItem } from "@/lib/notaStorage";
import { buildNotaPdfA5, buildNotaPdfA4 } from "@/lib/notaPdf";
import { useSuratJalanRecords, type SuratJalanRecord } from "@/lib/suratJalanStorage";

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

function NotaPage() {
  const { records: sjRecords } = useSuratJalanRecords();
  const { records: notas, loaded, addRecord, updateRecord, removeRecord } = useNotaRecords();

  const [view, setView] = useState<View>("list");
  const [selected, setSelected] = useState<NotaRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NotaRecord | null>(null);

  const sorted = useMemo(
    () =>
      [...notas].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notas],
  );

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
    <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Nota</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kelola nota berdasarkan Surat Jalan yang sudah tersimpan.
            </p>
          </div>
          <Button onClick={() => setView("create")}>
            <Plus className="h-4 w-4" /> Buat Nota
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {!loaded && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Memuat data…
            </div>
          )}
          {loaded && sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-16 text-center">
              <p className="text-lg font-medium text-muted-foreground">Belum ada Nota.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Nota yang dibuat akan muncul di sini.
              </p>
            </div>
          )}
          {sorted.map((n) => (
            <article
              key={n.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-0">
                <h3 className="truncate font-display font-bold text-brand">{n.nomor}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{n.tanggal}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ref: {n.suratJalanNomor}</p>
                <div className="mt-2 space-y-0.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Pengirim: </span>
                    <span className="font-medium">{n.pengirim || "-"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Penerima: </span>
                    <span className="font-medium">{n.penerima || "-"}</span>
                  </p>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{n.items.length} barang</span>
                  <span className="font-medium text-foreground">
                    Total: {formatRupiah(n.total)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelected(n);
                    setView("detail");
                  }}
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setSelected(n);
                    setView("edit");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(n)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </article>
          ))}
        </div>

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
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Kembali
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Pilih Surat Jalan
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pilih Surat Jalan yang akan dijadikan Nota.
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari Surat Jalan…"
          className="pl-9"
        />
      </div>

      <div className="mt-4 space-y-3">
        {sorted.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {sjRecords.length === 0
              ? "Belum ada Surat Jalan yang tersimpan."
              : "Tidak ada Surat Jalan yang cocok."}
          </div>
        )}
        {sorted.map((sj) => (
          <article
            key={sj.id}
            className="cursor-pointer rounded-2xl border border-border bg-card p-4 shadow-sm transition-colors hover:bg-accent/50"
            onClick={() => onSelect(sj)}
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="min-w-0">
                <h3 className="truncate font-display font-bold text-brand">{sj.nomor}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{sj.tanggal}</p>
                <div className="mt-2 space-y-0.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Pengirim: </span>
                    <span className="font-medium">{sj.pengirim || "-"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Penerima: </span>
                    <span className="font-medium">{sj.kepada || "-"}</span>
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  {sj.items.map((item, i) => (
                    <p key={i} className="text-xs">
                      <span className="font-semibold">{item.quantity || "-"}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span>{item.name || "-"}</span>
                    </p>
                  ))}
                </div>
              </div>
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
            </div>
          </article>
        ))}
      </div>
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
          setTanggal(todayISO());
          setPotong(0);
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

  const subtotal = computeTotals(items);
  const total = subtotal - potong;

  return (
    <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setStep("select")}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Buat Nota
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Berdasarkan Surat Jalan {selectedSJ?.nomor}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold">Data Nota</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Referensi Surat Jalan</Label>
                <Input value={selectedSJ?.nomor || ""} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal</Label>
                <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pengirim</Label>
                <Input value={selectedSJ?.pengirim || ""} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Penerima</Label>
                <Input value={selectedSJ?.kepada || ""} readOnly className="bg-muted/50" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">Daftar Barang</Label>
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Barang {index + 1}
                    </span>
                    <span className="text-xs font-bold text-brand">{formatRupiah(item.total)}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        value={item.quantity}
                        onChange={(e) => setItemField(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nama Barang</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => setItemField(index, "name", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Keterangan</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => setItemField(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.price || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setItemField(index, "price", parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Catatan (opsional)</Label>
              <Textarea rows={2} />
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground whitespace-nowrap">Potong / DP</span>
                <Input
                  type="number"
                  min={0}
                  className="w-40 text-right"
                  value={potong || ""}
                  placeholder="0"
                  onChange={(e) => setPotong(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(total)}</span>
              </div>
            </div>

            <Button
              className="w-full"
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

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-3">Ringkasan Surat Jalan</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Nomor: </span>
                <span className="font-medium">{selectedSJ?.nomor}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Tanggal: </span>
                <span className="font-medium">{selectedSJ?.tanggal}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Pengirim: </span>
                <span className="font-medium">{selectedSJ?.pengirim || "-"}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Penerima: </span>
                <span className="font-medium">{selectedSJ?.kepada || "-"}</span>
              </p>
            </div>
            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Barang:</p>
              {selectedSJ?.items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-2 text-xs">
                  <p>
                    <span className="font-semibold">{item.quantity || "-"}</span>
                    <span className="text-muted-foreground"> — </span>
                    <span>{item.name || "-"}</span>
                  </p>
                  {item.description && (
                    <p className="mt-0.5 italic text-muted-foreground">{item.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
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
      pdf.save(`Nota-${record.nomor}-${suffix}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error(format === "a5" ? "Gagal membuat PDF A5" : "Gagal membuat PDF A4");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button size="sm" onClick={() => handleDownloadPdf("a5")} disabled={generating !== null}>
            <Download className="h-4 w-4" />{" "}
            {generating === "a5" ? "Memproses…" : "PDF A5 Landscape"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleDownloadPdf("a4")}
            disabled={generating !== null}
          >
            <Download className="h-4 w-4" />{" "}
            {generating === "a4" ? "Memproses…" : "PDF A4 Portrait"}
          </Button>
        </div>

        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Detail Nota — {record.nomor}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{record.tanggal}</p>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold">Informasi Nota</h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">No. Nota: </span>
                <span className="font-bold text-brand">{record.nomor}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Tanggal: </span>
                <span className="font-medium">{record.tanggal}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Ref Surat Jalan: </span>
                <span className="font-medium">{record.suratJalanNomor}</span>
              </p>
            </div>

            <h2 className="font-display text-base font-bold pt-2 border-t border-border">
              Pengirim
            </h2>
            <p className="text-sm font-medium">{record.pengirim || "-"}</p>

            <h2 className="font-display text-base font-bold pt-2 border-t border-border">
              Penerima
            </h2>
            <p className="text-sm font-medium">{record.penerima || "-"}</p>

            <h2 className="font-display text-base font-bold pt-2 border-t border-border">
              Daftar Barang
            </h2>
            <div className="space-y-2">
              {record.items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p>
                        <span className="font-semibold">{item.quantity || "-"}</span>
                        <span className="text-muted-foreground"> — </span>
                        <span>{item.name || "-"}</span>
                      </p>
                      {item.description && (
                        <p className="mt-1 text-xs italic text-muted-foreground">
                          {item.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs">
                      <p>{formatRupiah(item.price)}</p>
                      <p className="font-bold">{formatRupiah(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-3">Ringkasan</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatRupiah(record.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potong / DP</span>
                <span className="font-medium">{formatRupiah(record.potong)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(record.total)}</span>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 text-center text-xs text-muted-foreground">
              <div>
                <p className="font-bold tracking-[0.14em] text-brand">PENERIMA,</p>
                <p className="mt-8">(&nbsp;..................................&nbsp;)</p>
              </div>
              <div>
                <p className="font-bold tracking-[0.14em] text-brand">HORMAT KAMI,</p>
                <p className="mt-8 font-medium">( {record.pengirim || "................."} )</p>
              </div>
            </div>
          </div>
        </div>
      </main>
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

  const subtotal = computeTotals(items);
  const total = subtotal - potong;

  return (
    <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" /> Kembali
          </Button>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Edit Nota — {record.nomor}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Ref: {record.suratJalanNomor}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold">Data Nota</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Referensi Surat Jalan</Label>
                <Input value={record.suratJalanNomor} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Tanggal</Label>
                <Input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Pengirim</Label>
                <Input value={record.pengirim} readOnly className="bg-muted/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Penerima</Label>
                <Input value={record.penerima} readOnly className="bg-muted/50" />
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-xs font-medium text-muted-foreground">Daftar Barang</Label>
              {items.map((item, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">
                      Barang {index + 1}
                    </span>
                    <span className="text-xs font-bold text-brand">{formatRupiah(item.total)}</span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[80px_1fr]">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Qty</Label>
                      <Input
                        value={item.quantity}
                        onChange={(e) => setItemField(index, "quantity", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Nama Barang</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => setItemField(index, "name", e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_140px]">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Keterangan</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => setItemField(index, "description", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Harga (Rp)</Label>
                      <Input
                        type="number"
                        min={0}
                        value={item.price || ""}
                        placeholder="0"
                        onChange={(e) =>
                          setItemField(index, "price", parseInt(e.target.value, 10) || 0)
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground whitespace-nowrap">Potong / DP</span>
                <Input
                  type="number"
                  min={0}
                  className="w-40 text-right"
                  value={potong || ""}
                  placeholder="0"
                  onChange={(e) => setPotong(parseInt(e.target.value, 10) || 0)}
                />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(total)}</span>
              </div>
            </div>

            <Button
              className="w-full"
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

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-base font-bold mb-3">Ringkasan Nota</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatRupiah(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Potong / DP</span>
                <span className="font-medium">{formatRupiah(potong)}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="text-brand">{formatRupiah(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
