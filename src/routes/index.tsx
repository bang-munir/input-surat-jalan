import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Printer, Plus, Trash2, Save } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { SheetPreview } from "@/components/SheetPreview";
import { SuratJalanPanel, type PanelData, type PanelItem } from "@/components/SuratJalanPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCustomers } from "@/lib/customers";
import { useSenders } from "@/lib/senders";
import { useSuratJalanRecords } from "@/lib/suratJalanStorage";
import { buildSuratJalanPdf, type SlipData } from "@/lib/suratJalanPdf";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Generator Surat Jalan A4 Lanskap 2 Surat" },
      {
        name: "description",
        content:
          "Buat surat jalan profesional: satu halaman A4 lanskap berisi dua surat jalan lanskap, siap cetak dan unduh PDF.",
      },
      { property: "og:title", content: "Generator Surat Jalan A4 Lanskap" },
      {
        property: "og:description",
        content: "Dua surat jalan lanskap dalam satu halaman A4, unduh PDF tajam siap cetak.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GeneratorPage,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatTanggal(iso: string) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function generateNomor() {
  const digits = Math.floor(1000 + Math.random() * 9000).toString();
  return `SJ-${digits}`;
}

const emptyItem: PanelItem = { quantity: "", name: "", description: "" };

const basePanel: PanelData = {
  nomor: "",
  tanggal: "",
  kepada: "",
  alamat: "",
  telepon: "",
  items: [{ ...emptyItem }],
  pengirim: "",
  teleponPengirim: "",
  alamatPengirim: "",
};

/** Surat dianggap kosong bila tidak ada isi selain nomor & tanggal otomatis. */
function isEmptySlip(d: PanelData) {
  const hasItems = d.items.some((item) => item.name.trim() || item.quantity.trim());
  return ![d.kepada, d.pengirim, d.alamat, d.telepon].some((v) => v.trim()) && !hasItems;
}

function GeneratorPage() {
  const { customers } = useCustomers();
  const { senders } = useSenders();
  const { addRecord } = useSuratJalanRecords();
  const [atas, setAtas] = useState<PanelData>(basePanel);
  const [bawah, setBawah] = useState<PanelData>(basePanel);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const today = todayISO();
    setAtas((prev) => ({ ...prev, nomor: generateNomor(), tanggal: today }));
    setBawah((prev) => ({ ...prev, nomor: generateNomor(), tanggal: today }));
  }, []);

  const renderAtas = useMemo(() => ({ ...atas, tanggal: formatTanggal(atas.tanggal) }), [atas]);
  const renderBawah = useMemo(() => ({ ...bawah, tanggal: formatTanggal(bawah.tanggal) }), [bawah]);

  const bawahKosong = isEmptySlip(bawah);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const pdf = await buildSuratJalanPdf(
        renderAtas as SlipData,
        bawahKosong ? null : (renderBawah as SlipData),
      );
      pdf.save(`surat-jalan-${atas.nomor || "tanpa-nomor"}.pdf`);
      toast.success("PDF A4 lanskap berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setBusy(false);
    }
  };

  const saveSuratJalan = () => {
    if (isEmptySlip(atas) && bawahKosong) {
      toast.error("Tidak ada data surat jalan yang tersimpan");
      return;
    }
    if (!isEmptySlip(atas)) {
      addRecord({
        nomor: atas.nomor,
        tanggal: formatTanggal(atas.tanggal),
        pengirim: atas.pengirim,
        teleponPengirim: atas.teleponPengirim,
        alamatPengirim: atas.alamatPengirim,
        kepada: atas.kepada,
        telepon: atas.telepon,
        alamat: atas.alamat,
        items: atas.items,
      });
    }
    if (!bawahKosong) {
      addRecord({
        nomor: bawah.nomor,
        tanggal: formatTanggal(bawah.tanggal),
        pengirim: bawah.pengirim,
        teleponPengirim: bawah.teleponPengirim,
        alamatPengirim: bawah.alamatPengirim,
        kepada: bawah.kepada,
        telepon: bawah.telepon,
        alamat: bawah.alamat,
        items: bawah.items,
      });
    }
    toast.success("Surat jalan berhasil disimpan");
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans pb-20 sm:pb-0">
      <AppNav />

      <main className="mx-auto max-w-7xl px-3 py-6 sm:px-4 sm:py-8">
        <div className="no-print mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl md:text-3xl">
              Generator Surat Jalan
            </h1>
            <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
              Satu halaman A4 lanskap berisi dua surat jalan lanskap, siap potong.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex sm:shrink-0 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="justify-center"
            >
              <Printer className="h-4 w-4" /> <span className="ml-1 hidden xs:inline">Cetak</span>
            </Button>
            <Button variant="outline" size="sm" onClick={saveSuratJalan} className="justify-center">
              <Save className="h-4 w-4" /> <span className="ml-1 hidden xs:inline">Simpan</span>
            </Button>
            <Button size="sm" onClick={downloadPdf} disabled={busy} className="justify-center">
              <Download className="h-4 w-4" />{" "}
              <span className="ml-1">{busy ? "…" : "Download"}</span>
            </Button>
          </div>
        </div>

        <div className="no-print grid gap-4 sm:gap-6 lg:grid-cols-2">
          <PanelForm
            title="Surat Atas"
            data={atas}
            onChange={setAtas}
            customers={customers}
            senders={senders}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setBawah({ ...atas, nomor: bawah.nomor })}
                className="shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Salin ke bawah
              </Button>
            }
          />
          <PanelForm
            title="Surat Bawah"
            data={bawah}
            onChange={setBawah}
            customers={customers}
            senders={senders}
          />
        </div>

        <section className="mt-8 sm:mt-10">
          <div className="no-print mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
            <h2 className="font-display text-xs font-semibold tracking-[0.2em] text-muted-foreground sm:text-sm">
              PRATINJAU A4 LANSKAP
            </h2>
            {bawahKosong && (
              <p className="text-xs text-muted-foreground">
                Surat bawah kosong — tidak akan ikut dicetak di PDF.
              </p>
            )}
          </div>
          <div className="overflow-x-auto rounded-2xl bg-paper-tint p-2 sm:p-4">
            <SheetPreview sheetRef={sheetRef}>
              <SuratJalanPanel data={renderAtas} />
              <SuratJalanPanel data={renderBawah} />
            </SheetPreview>
          </div>
        </section>
      </main>
    </div>
  );
}

function PanelForm({
  title,
  data,
  onChange,
  customers,
  senders,
  action,
}: {
  title: string;
  data: PanelData;
  onChange: (d: PanelData) => void;
  customers: ReturnType<typeof useCustomers>["customers"];
  senders: ReturnType<typeof useSenders>["senders"];
  action?: React.ReactNode;
}) {
  const set = (k: keyof PanelData) => (v: string) => onChange({ ...data, [k]: v });

  const setItem = (index: number, field: keyof PanelItem, value: string) => {
    const items = [...data.items];
    items[index] = { ...items[index], [field]: value };
    onChange({ ...data, items });
  };

  const addItem = () => {
    onChange({ ...data, items: [...data.items, { ...emptyItem }] });
  };

  const removeItem = (index: number) => {
    if (data.items.length <= 1) return;
    const items = data.items.filter((_, i) => i !== index);
    onChange({ ...data, items });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate font-display text-base font-bold tracking-wide">{title}</h3>
        {action}
      </div>

      <div className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Pilih Pelanggan / Penerima">
            <Select
              value=""
              onValueChange={(id) => {
                const c = customers.find((x) => x.id === id);
                if (c)
                  onChange({
                    ...data,
                    kepada: c.nama,
                    alamat: c.alamat || "",
                    telepon: c.telepon || "",
                  });
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={customers.length ? "Pilih penerima…" : "Belum ada master"}
                />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Pilih Pengirim">
            <Select
              value=""
              onValueChange={(id) => {
                const c = senders.find((x) => x.id === id);
                if (c)
                  onChange({
                    ...data,
                    pengirim: c.nama,
                    alamatPengirim: c.alamat || "",
                    teleponPengirim: c.telepon || "",
                  });
              }}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={senders.length ? "Pilih pengirim…" : "Belum ada pengirim"}
                />
              </SelectTrigger>
              <SelectContent>
                {senders.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Surat Jalan (otomatis)">
            <Input value={data.nomor} readOnly tabIndex={-1} className="bg-muted/50" />
          </Field>
          <Field label="Tanggal">
            <Input
              type="date"
              value={data.tanggal}
              onChange={(e) => set("tanggal")(e.target.value)}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Pengirim">
            <Input value={data.pengirim} onChange={(e) => set("pengirim")(e.target.value)} />
          </Field>
          <Field label="No. Telp Pengirim (opsional)">
            <Input
              value={data.teleponPengirim}
              onChange={(e) => set("teleponPengirim")(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Alamat Pengirim (opsional)">
          <Textarea
            rows={2}
            value={data.alamatPengirim}
            onChange={(e) => set("alamatPengirim")(e.target.value)}
          />
        </Field>

        <Field label="Kepada">
          <Input value={data.kepada} onChange={(e) => set("kepada")(e.target.value)} />
        </Field>
        <Field label="No. Telp Penerima (opsional)">
          <Input value={data.telepon} onChange={(e) => set("telepon")(e.target.value)} />
        </Field>
        <Field label="Alamat Penerima (opsional)">
          <Textarea rows={2} value={data.alamat} onChange={(e) => set("alamat")(e.target.value)} />
        </Field>

        <div className="space-y-3">
          <Label className="text-xs font-medium text-muted-foreground">Barang</Label>
          {data.items.map((item, index) => (
            <div key={index} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Barang {index + 1}
                </span>
                {data.items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-destructive hover:text-destructive"
                    onClick={() => removeItem(index)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-[110px_minmax(0,1fr)]">
                <Field label="Banyaknya">
                  <Input
                    value={item.quantity}
                    placeholder="3 BAL"
                    onChange={(e) => setItem(index, "quantity", e.target.value)}
                  />
                </Field>
                <Field label="Nama Barang">
                  <Input
                    value={item.name}
                    onChange={(e) => setItem(index, "name", e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Keterangan Pengiriman (opsional)">
                <Input
                  value={item.description}
                  placeholder="1 BAL isi 40pcs"
                  onChange={(e) => setItem(index, "description", e.target.value)}
                />
              </Field>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={addItem}>
            <Plus className="h-4 w-4" /> Tambah Barang
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
