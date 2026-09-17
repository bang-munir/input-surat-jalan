import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Search, Trash2, Eye, Download, ArrowLeft, Edit, Plus } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { SuratJalanPanel, type PanelData } from "@/components/SuratJalanPanel";
import { SheetPreview } from "@/components/SheetPreview";
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
import { useSuratJalanRecords, type SuratJalanRecord, type SuratJalanItem } from "@/lib/suratJalanStorage";
import { fetchNotaNumbersBySuratJalan } from "@/lib/notaStorage.server";
import { buildSuratJalanPdf, type SlipData } from "@/lib/suratJalanPdf";

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

function LaporanPage() {
  const { records, loaded, removeRecord, updateRecord } = useSuratJalanRecords();
  const [q, setQ] = useState("");
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

  const filtered = records.filter((r) =>
    `${r.nomor} ${r.pengirim} ${r.kepada} ${r.tanggal}`.toLowerCase().includes(q.toLowerCase()),
  );

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

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
      const slipData: SlipData = {
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
      const pdf = await buildSuratJalanPdf(slipData, null);
      pdf.save(`surat-jalan-${record.nomor || "tanpa-nomor"}.pdf`);
      toast.success("PDF berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeRecord(deleteTarget.id);
      toast.success("Surat Jalan berhasil dihapus");
      setDeleteTarget(null);
    } catch {
      // FK RESTRICT dari tabel nota: cari nomor Nota terkait untuk pesan yang informatif
      const blocked = await fetchNotaNumbersBySuratJalan({ data: { suratJalanId: deleteTarget.id } });
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
    const panelData: PanelData = {
      nomor: detail.nomor,
      tanggal: detail.tanggal,
      pengirim: detail.pengirim,
      teleponPengirim: detail.teleponPengirim,
      alamatPengirim: detail.alamatPengirim,
      kepada: detail.kepada,
      telepon: detail.telepon,
      alamat: detail.alamat,
      items: detail.items,
    };

    return (
      <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
        <AppNav />
        <main className="mx-auto max-w-7xl px-4 py-8">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setDetail(null)}>
              <ArrowLeft className="h-4 w-4" /> Kembali
            </Button>
            <Button variant="outline" size="sm" onClick={() => downloadPdf(detail)} disabled={busy}>
              <Download className="h-4 w-4" /> {busy ? "Memproses…" : "Download PDF"}
            </Button>
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Detail Surat Jalan — {detail.nomor}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{detail.tanggal}</p>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h2 className="font-display text-base font-bold">Data Pengirim</h2>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Nama: </span>
                  <span className="font-medium">{detail.pengirim || "-"}</span>
                </p>
                {detail.teleponPengirim && (
                  <p>
                    <span className="text-muted-foreground">Telp: </span>
                    <span className="font-medium">{detail.teleponPengirim}</span>
                  </p>
                )}
                {detail.alamatPengirim && (
                  <p>
                    <span className="text-muted-foreground">Alamat: </span>
                    <span className="font-medium">{detail.alamatPengirim}</span>
                  </p>
                )}
              </div>

              <h2 className="font-display text-base font-bold pt-2 border-t border-border">
                Data Penerima
              </h2>
              <div className="space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Kepada: </span>
                  <span className="font-medium">{detail.kepada || "-"}</span>
                </p>
                {detail.telepon && (
                  <p>
                    <span className="text-muted-foreground">Telp: </span>
                    <span className="font-medium">{detail.telepon}</span>
                  </p>
                )}
                {detail.alamat && (
                  <p>
                    <span className="text-muted-foreground">Alamat: </span>
                    <span className="font-medium">{detail.alamat}</span>
                  </p>
                )}
              </div>

              <h2 className="font-display text-base font-bold pt-2 border-t border-border">
                Barang
              </h2>
              <div className="space-y-2">
                {detail.items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
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
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-base font-bold mb-3">Pratinjau</h2>
              <div className="max-w-full overflow-x-auto rounded-2xl bg-paper-tint p-2 sm:p-4">
                <SheetPreview sheetRef={{ current: null }}>
                  <SuratJalanPanel data={panelData} />
                </SheetPreview>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-sans pb-20 sm:pb-0">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Laporan Surat Jalan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Daftar surat jalan yang sudah tersimpan.
        </p>

        <div className="mt-6 relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari surat jalan…"
            className="pl-9"
          />
        </div>

        {editingId && (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-bold mb-4">Edit Surat Jalan</h2>
            <form className="space-y-4" onSubmit={saveEdit}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Tanggal</label>
                  <Input
                    type="date"
                    value={editForm.tanggal}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, tanggal: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Nama Pengirim</label>
                  <Input
                    type="text"
                    value={editForm.pengirim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, pengirim: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">No. Telp Pengirim</label>
                  <Input
                    type="text"
                    value={editForm.teleponPengirim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, teleponPengirim: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Alamat Pengirim</label>
                  <Input
                    type="text"
                    value={editForm.alamatPengirim}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, alamatPengirim: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Kepada</label>
                  <Input
                    type="text"
                    value={editForm.kepada}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, kepada: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">No. Telp Penerima</label>
                  <Input
                    type="text"
                    value={editForm.telepon}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, telepon: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm text-muted-foreground mb-1">Alamat Penerima</label>
                  <Input
                    type="text"
                    value={editForm.alamat}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, alamat: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-foreground">Barang</label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddItem}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Tambah Barang
                  </Button>
                </div>
                <div className="space-y-3">
                  {editForm.items.map((item, i) => (
                    <div key={i} className="flex flex-col sm:flex-row items-start sm:items-center gap-2 rounded-lg border border-border p-3">
                      <div className="w-full sm:w-28">
                        <Input
                          type="text"
                          placeholder="Jumlah"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(i, "quantity", e.target.value)}
                        />
                      </div>
                      <div className="w-full sm:flex-1">
                        <Input
                          type="text"
                          placeholder="Nama Barang"
                          value={item.name}
                          onChange={(e) => handleItemChange(i, "name", e.target.value)}
                        />
                      </div>
                      <div className="w-full sm:flex-1">
                        <Input
                          type="text"
                          placeholder="Keterangan"
                          value={item.description}
                          onChange={(e) => handleItemChange(i, "description", e.target.value)}
                        />
                      </div>
                      {editForm.items.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveItem(i)}
                          className="text-destructive shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={closeEdit}
                >
                  Batal
                </Button>
                <Button
                  size="sm"
                  type="submit"
                  disabled={busy}
                >
                  {busy ? "Menyimpan…" : "Simpan Perubahan"}
                </Button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {!loaded && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              Memuat data…
            </div>
          )}
          {loaded && sorted.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
              {records.length === 0
                ? "Belum ada surat jalan yang tersimpan."
                : "Tidak ada surat jalan yang cocok."}
            </div>
          )}
          {sorted.map((r) => (
            <article
              key={r.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="min-w-0">
                <h3 className="truncate font-display font-bold text-brand">{r.nomor}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">{r.tanggal}</p>
                <div className="mt-2 space-y-0.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Pengirim: </span>
                    <span className="font-medium">{r.pengirim || "-"}</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Penerima: </span>
                    <span className="font-medium">{r.kepada || "-"}</span>
                  </p>
                </div>
                <div className="mt-2 space-y-1">
                  {r.items.map((item, i) => (
                    <p key={i} className="text-xs">
                      <span className="font-semibold">{item.quantity || "-"}</span>
                      <span className="text-muted-foreground"> — </span>
                      <span>{item.name || "-"}</span>
                      {item.description && (
                        <span className="italic text-muted-foreground"> ({item.description})</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => setDetail(r)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleStartEdit(r)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => downloadPdf(r)} disabled={busy}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(r)}
                >
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
    </div>
  );
}
