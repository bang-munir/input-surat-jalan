import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { Copy, Download, Printer } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { SheetPreview } from "@/components/SheetPreview";
import { SuratJalanPanel, type PanelData } from "@/components/SuratJalanPanel";
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Generator Surat Jalan A4 Lanskap (2x A5)" },
      {
        name: "description",
        content:
          "Buat, cetak, dan unduh surat jalan PNG format A4 lanskap berisi dua lembar A5 dengan master data pelanggan.",
      },
      { property: "og:title", content: "Generator Surat Jalan A4 Lanskap" },
      {
        property: "og:description",
        content: "Isi otomatis dari master data pelanggan, cetak atau unduh PNG siap potong.",
      },
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

const basePanel: PanelData = {
  nomor: "",
  tanggal: "",
  kepada: "",
  alamat: "",
  telepon: "",
  banyaknya: "",
  namaBarang: "",
  keterangan: "",
  pengirim: "",
  teleponPengirim: "",
};

function GeneratorPage() {
  const { customers } = useCustomers();
  const [left, setLeft] = useState<PanelData>(basePanel);
  const [right, setRight] = useState<PanelData>(basePanel);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");

  useEffect(() => {
    const today = todayISO();
    setLeft((prev) => ({ ...prev, nomor: generateNomor(), tanggal: today }));
    setRight((prev) => ({ ...prev, nomor: generateNomor(), tanggal: today }));
  }, []);

  const renderLeft = useMemo(
    () => ({ ...left, tanggal: formatTanggal(left.tanggal) }),
    [left],
  );
  const renderRight = useMemo(
    () => ({ ...right, tanggal: formatTanggal(right.tanggal) }),
    [right],
  );

  const downloadPng = async () => {
    const node = sheetRef.current;
    if (!node) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(node, {
        pixelRatio: 3,
        backgroundColor: "#ffffff",
        width: node.offsetWidth,
        height: node.offsetHeight,
        style: { transform: "none", margin: "0" },
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `surat-jalan-${left.nomor || "tanpa-nomor"}.png`;
      a.click();
      toast.success("Gambar PNG berhasil diunduh");
    } catch {
      toast.error("Gagal membuat gambar PNG");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <AppNav />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="no-print mb-8 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Generator Surat Jalan
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Satu halaman A4 lanskap berisi dua lembar A5 siap potong.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak / PDF
            </Button>
            <Button onClick={downloadPng} disabled={busy}>
              <Download className="h-4 w-4" /> {busy ? "Memproses…" : "Unduh PNG"}
            </Button>
          </div>
        </div>

        <div className="no-print grid gap-6 lg:grid-cols-2">
          <PanelForm
            title="Sisi Kiri"
            data={left}
            onChange={setLeft}
            customers={customers}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setRight({ ...left })}
                className="shrink-0"
              >
                <Copy className="h-3.5 w-3.5" /> Salin ke kanan
              </Button>
            }
          />
          <PanelForm
            title="Sisi Kanan"
            data={right}
            onChange={setRight}
            customers={customers}
          />
        </div>

        <section className="mt-10">
          <div className="no-print mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:flex sm:justify-between">
            <h2 className="truncate font-display text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              PRATINJAU A4 {orientation === "landscape" ? "LANSKAP" : "POTRET"}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <Label className="text-xs text-muted-foreground">Orientasi</Label>
              <Select
                value={orientation}
                onValueChange={(v) => setOrientation(v as "landscape" | "portrait")}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Lanskap</SelectItem>
                  <SelectItem value="portrait">Potret</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl bg-paper-tint p-2 sm:p-4">
            <SheetPreview sheetRef={sheetRef} orientation={orientation}>
              <SuratJalanPanel data={renderLeft} />
              <SuratJalanPanel data={renderRight} />
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
  action,
}: {
  title: string;
  data: PanelData;
  onChange: (d: PanelData) => void;
  customers: ReturnType<typeof useCustomers>["customers"];
  action?: React.ReactNode;
}) {
  const set = (k: keyof PanelData) => (v: string) => onChange({ ...data, [k]: v });

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <h3 className="truncate font-display text-base font-bold tracking-wide">{title}</h3>
        {action}
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Pilih dari Master Pelanggan">
          <Select
            value=""
            onValueChange={(id) => {
              const c = customers.find((x) => x.id === id);
              if (c)
                onChange({
                  ...data,
                  kepada: c.nama,
                  alamat: c.alamat,
                  telepon: c.telepon,
                  keterangan: c.catatan || data.keterangan,
                });
            }}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  customers.length ? "Cari & pilih pelanggan…" : "Belum ada data pelanggan"
                }
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

        <Field label="Kepada">
          <Input value={data.kepada} onChange={(e) => set("kepada")(e.target.value)} />
        </Field>
        <Field label="Alamat">
          <Textarea
            rows={2}
            value={data.alamat}
            onChange={(e) => set("alamat")(e.target.value)}
          />
        </Field>
        <Field label="No. Telp Penerima">
          <Input value={data.telepon} onChange={(e) => set("telepon")(e.target.value)} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[100px_minmax(0,1fr)]">
          <Field label="Banyaknya">
            <Input
              value={data.banyaknya}
              placeholder="10 IKAT"
              onChange={(e) => set("banyaknya")(e.target.value)}
            />
          </Field>
          <Field label="Nama Barang">
            <Input
              value={data.namaBarang}
              onChange={(e) => set("namaBarang")(e.target.value)}
            />
          </Field>
        </div>

        <Field label="Keterangan Pengiriman (opsional)">
          <Input
            value={data.keterangan}
            placeholder="1 ikat isi 5 = (50 Pcs)"
            onChange={(e) => set("keterangan")(e.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nama Pengirim">
            <Input value={data.pengirim} onChange={(e) => set("pengirim")(e.target.value)} />
          </Field>
          <Field label="No. Telp Pengirim">
            <Input
              value={data.teleponPengirim}
              onChange={(e) => set("teleponPengirim")(e.target.value)}
            />
          </Field>
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
