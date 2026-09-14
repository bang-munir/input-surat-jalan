import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  alamatPengirim: "",
};

/** Surat dianggap kosong bila tidak ada isi selain nomor & tanggal otomatis. */
function isEmptySlip(d: PanelData) {
  return ![d.kepada, d.pengirim, d.namaBarang, d.banyaknya, d.alamat, d.telepon].some((v) =>
    v.trim(),
  );
}

function GeneratorPage() {
  const { customers } = useCustomers();
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

  return (
    <div className="min-h-screen overflow-x-hidden bg-background font-sans">
      <AppNav />

      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="no-print mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Generator Surat Jalan
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Satu halaman A4 lanskap berisi dua surat jalan lanskap, siap potong.
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Cetak
            </Button>
            <Button onClick={downloadPdf} disabled={busy}>
              <Download className="h-4 w-4" /> {busy ? "Memproses…" : "Download PDF"}
            </Button>
          </div>
        </div>

        <div className="no-print grid gap-6 lg:grid-cols-2">
          <PanelForm
            title="Surat Atas"
            data={atas}
            onChange={setAtas}
            customers={customers}
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
          <PanelForm title="Surat Bawah" data={bawah} onChange={setBawah} customers={customers} />
        </div>

        <section className="mt-10">
          <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-sm font-semibold tracking-[0.2em] text-muted-foreground">
              PRATINJAU A4 LANSKAP
            </h2>
            {bawahKosong && (
              <p className="text-xs text-muted-foreground">
                Surat bawah kosong — tidak akan ikut dicetak di PDF.
              </p>
            )}
          </div>
          <div className="max-w-full overflow-x-auto rounded-2xl bg-paper-tint p-2 sm:p-4">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ambil data Penerima dari Master">
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
          <Field label="Ambil data Pengirim dari Master">
            <Select
              value=""
              onValueChange={(id) => {
                const c = customers.find((x) => x.id === id);
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
                  placeholder={customers.length ? "Pilih pengirim…" : "Belum ada master"}
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

        <div className="grid gap-4 sm:grid-cols-[110px_minmax(0,1fr)]">
          <Field label="Banyaknya">
            <Input
              value={data.banyaknya}
              placeholder="3 BAL"
              onChange={(e) => set("banyaknya")(e.target.value)}
            />
          </Field>
          <Field label="Nama Barang">
            <Input value={data.namaBarang} onChange={(e) => set("namaBarang")(e.target.value)} />
          </Field>
        </div>

        <Field label="Keterangan Pengiriman (opsional)">
          <Input
            value={data.keterangan}
            placeholder="1 BAL isi 40pcs"
            onChange={(e) => set("keterangan")(e.target.value)}
          />
        </Field>
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
