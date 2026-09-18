import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronsUpDown,
  Download,
  Eye,
  FileText,
  Loader2,
  Package,
  Plus,
  Save,
  Trash2,
  Truck,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import type { PanelData, PanelItem } from "@/components/SuratJalanPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
import { Popover, PopoverContent, PopoverAnchor } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useCustomers } from "@/lib/customers";
import { useSenders } from "@/lib/senders";
import { useSuratJalanRecords } from "@/lib/suratJalanStorage";
import { buildSuratJalanPdf, type SlipData } from "@/lib/suratJalanPdf";
import { downloadPdf as saveGeneratedPdf } from "@/lib/pdfDownload";

export const Route = createFileRoute("/surat-jalan")({
  head: () => ({
    meta: [
      { title: "Surat Jalan - INPUT SURAT" },
      {
        name: "description",
        content: "Buat surat jalan profesional, siap cetak dan unduh PDF.",
      },
    ],
  }),
  component: GeneratorPage,
});

const inputStitch =
  "h-11 rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";
const textareaStitch =
  "resize-none rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";

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

type MasterListItem = { id: string; nama: string; alamat: string; telepon: string };

function MasterAutocomplete({
  items,
  loading,
  value,
  placeholder,
  emptyLabel,
  onInputChange,
  onSelect,
}: {
  items: MasterListItem[];
  loading: boolean;
  value: string;
  placeholder: string;
  emptyLabel: string;
  onInputChange: (value: string) => void;
  onSelect: (item: MasterListItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const query = value.trim().toLocaleLowerCase("id-ID");
  const filtered = useMemo(() => {
    if (!query) return items;
    return items.filter((i) => i.nama.toLocaleLowerCase("id-ID").includes(query));
  }, [items, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className="relative">
          <Input
            value={value}
            type="text"
            autoComplete="off"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            placeholder={placeholder}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              onInputChange(e.target.value);
              setOpen(true);
            }}
            className={cn(inputStitch, "pr-9")}
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={4}
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-1.5rem)] p-0"
      >
        <Command shouldFilter={false}>
          <CommandList>
            {loading ? (
              <div className="space-y-1.5 p-3">
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-full" />
                <Skeleton className="h-7 w-2/3" />
              </div>
            ) : (
              <>
                <CommandEmpty>{emptyLabel}</CommandEmpty>
                <CommandGroup>
                  {filtered.map((item) => {
                    const isSelected = value.trim() === item.nama;
                    return (
                      <CommandItem
                        key={item.id}
                        value={item.nama}
                        onSelect={() => {
                          onSelect(item);
                          setOpen(false);
                        }}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{item.nama}</span>
                          {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        </span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function SectionHeader({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-4 w-1.5 shrink-0 rounded-full bg-[#a33900]" />
      <Icon className="h-4 w-4 shrink-0 text-[#a33900]" />
      <h3 className="text-sm font-bold tracking-tight text-[#0b1c30]">{children}</h3>
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

function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  minRows = 3,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  return (
    <Textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(textareaStitch, "overflow-hidden")}
    />
  );
}

function GeneratorPage() {
  const navigate = useNavigate();
  const { customers, loaded: customersLoaded } = useCustomers();
  const { senders, loaded: sendersLoaded } = useSenders();
  const { addRecord } = useSuratJalanRecords();
  const [form, setForm] = useState<PanelData>(basePanel);
  const [busy, setBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setForm((prev) => ({ ...prev, nomor: generateNomor(), tanggal: todayISO() }));
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const renderSlip = useMemo(() => ({ ...form, tanggal: formatTanggal(form.tanggal) }), [form]);

  const formKosong = isEmptySlip(form);

  const buildPdf = () => buildSuratJalanPdf(renderSlip as SlipData, renderSlip as SlipData);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const pdf = await buildPdf();
      await saveGeneratedPdf(pdf, `Surat-Jalan-${form.nomor || "tanpa-nomor"}.pdf`);
      toast.success("PDF A4 lanskap berhasil diunduh");
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setBusy(false);
    }
  };

  const openPreview = async () => {
    if (formKosong) {
      toast.error("Lengkapi data surat jalan terlebih dahulu");
      return;
    }
    setPreviewBusy(true);
    try {
      const pdf = await buildPdf();
      setPreviewUrl(URL.createObjectURL(pdf.output("blob")));
      setPreviewOpen(true);
    } catch {
      toast.error("Gagal membuat PDF");
    } finally {
      setPreviewBusy(false);
    }
  };

  const closePreview = () => {
    setPreviewOpen(false);
  };

  const persistSuratJalan = async () => {
    await addRecord({
      nomor: form.nomor,
      tanggal: formatTanggal(form.tanggal),
      pengirim: form.pengirim,
      teleponPengirim: form.teleponPengirim,
      alamatPengirim: form.alamatPengirim,
      kepada: form.kepada,
      telepon: form.telepon,
      alamat: form.alamat,
      items: form.items,
    });
  };

  const resetForm = () => {
    const today = todayISO();
    setForm({ ...basePanel, nomor: generateNomor(), tanggal: today, items: [{ ...emptyItem }] });
  };

  const confirmSave = async () => {
    if (saving) return;
    if (formKosong) {
      toast.error("Tidak ada data surat jalan yang tersimpan");
      return;
    }
    setSaving(true);
    try {
      await persistSuratJalan();
      toast.success("Surat jalan berhasil disimpan");
      setPreviewOpen(false);
      resetForm();
      await navigate({ to: "/laporan" });
    } catch {
      toast.error("Gagal menyimpan surat jalan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <div className="no-print mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div className="min-w-0 pb-1">
              <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
                Buat Surat Jalan Baru
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
                <span>Lihat PDF</span>
              </Button>
            </div>
          </div>

          <PanelForm
            data={form}
            onChange={setForm}
            customers={customers}
            customersLoaded={customersLoaded}
            senders={senders}
            sendersLoaded={sendersLoaded}
          />

          <Dialog
            open={previewOpen}
            onOpenChange={(open) => {
              if (!open) closePreview();
            }}
          >
            <DialogContent className="flex h-[92vh] w-[96vw] max-w-[1100px] flex-col gap-0 overflow-hidden p-0 sm:h-[88vh]">
              <DialogHeader className="shrink-0 border-b border-border/70 px-4 py-3 text-left sm:px-6">
                <DialogTitle className="text-[15px] font-bold tracking-tight text-[#0b1c30]">
                  Pratinjau PDF Surat Jalan
                </DialogTitle>
                <DialogDescription className="sr-only">
                  Pratinjau PDF Surat Jalan sebelum menyimpan.
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 bg-[#eef3ff]">
                {previewUrl && (
                  <object
                    title="Pratinjau PDF Surat Jalan"
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
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={downloadPdf}
                  disabled={busy}
                  className="h-11 rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff]"
                >
                  {busy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {busy ? "Membuat PDF…" : "Download"}
                </Button>
                <Button
                  type="button"
                  onClick={confirmSave}
                  disabled={saving}
                  className="h-11 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000]"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </TooltipProvider>
    </div>
  );
}

function PanelForm({
  data,
  onChange,
  customers,
  customersLoaded,
  senders,
  sendersLoaded,
}: {
  data: PanelData;
  onChange: (d: PanelData) => void;
  customers: ReturnType<typeof useCustomers>["customers"];
  customersLoaded: boolean;
  senders: ReturnType<typeof useSenders>["senders"];
  sendersLoaded: boolean;
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
    <Card className="mx-auto h-fit w-full max-w-6xl overflow-hidden rounded-2xl border-border/70 shadow-sm">
      <CardContent className="space-y-6 px-4 py-5 sm:px-6">
        <section className="space-y-3.5">
          <SectionHeader icon={FileText}>Kelengkapan Surat</SectionHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. Surat Jalan (otomatis)">
              <div className="relative min-w-0">
                <Input
                  value={data.nomor}
                  readOnly
                  tabIndex={-1}
                  className={cn(inputStitch, "pr-20 font-mono font-semibold")}
                />
                <Badge
                  variant="secondary"
                  className="pointer-events-none absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border-0 bg-[#e5eeff] text-[#5a4138]"
                >
                  Otomatis
                </Badge>
              </div>
            </Field>
            <Field label="Tanggal">
              <Input
                type="date"
                value={data.tanggal}
                onChange={(e) => set("tanggal")(e.target.value)}
                className={inputStitch}
              />
            </Field>
          </div>
        </section>

        <Separator />

        <section className="space-y-3.5">
          <SectionHeader icon={User}>Pelanggan / Penerima</SectionHeader>
          <Field label="Kepada">
            <MasterAutocomplete
              items={customers}
              loading={!customersLoaded}
              value={data.kepada}
              placeholder={
                customers.length ? "Pilih atau ketik nama pelanggan" : "Belum ada master pelanggan"
              }
              emptyLabel={
                customers.length ? "Tidak ada pelanggan yang cocok." : "Belum ada master pelanggan."
              }
              onInputChange={set("kepada")}
              onSelect={(c) =>
                onChange({
                  ...data,
                  kepada: c.nama,
                  alamat: c.alamat || "",
                  telepon: c.telepon || "",
                })
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. Telp Penerima (opsional)">
              <Input
                value={data.telepon}
                placeholder="08xx…"
                onChange={(e) => set("telepon")(e.target.value)}
                className={inputStitch}
              />
            </Field>
            <Field label="Alamat Penerima (opsional)">
              <AutoGrowTextarea
                value={data.alamat}
                onChange={set("alamat")}
                placeholder="Alamat lengkap penerima"
              />
            </Field>
          </div>
        </section>

        <Separator />

        <section className="space-y-3.5">
          <SectionHeader icon={Truck}>Pengirim</SectionHeader>
          <Field label="Pengirim">
            <MasterAutocomplete
              items={senders}
              loading={!sendersLoaded}
              value={data.pengirim}
              placeholder={
                senders.length ? "Pilih atau ketik nama pengirim" : "Belum ada master pengirim"
              }
              emptyLabel={
                senders.length ? "Tidak ada pengirim yang cocok." : "Belum ada master pengirim."
              }
              onInputChange={set("pengirim")}
              onSelect={(s) =>
                onChange({
                  ...data,
                  pengirim: s.nama,
                  alamatPengirim: s.alamat || "",
                  teleponPengirim: s.telepon || "",
                })
              }
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="No. Telp Pengirim (opsional)">
              <Input
                value={data.teleponPengirim}
                placeholder="08xx…"
                onChange={(e) => set("teleponPengirim")(e.target.value)}
                className={inputStitch}
              />
            </Field>
            <Field label="Alamat Pengirim (opsional)">
              <AutoGrowTextarea
                value={data.alamatPengirim}
                onChange={set("alamatPengirim")}
                placeholder="Alamat lengkap pengirim"
              />
            </Field>
          </div>
        </section>

        <Separator />

        <section className="space-y-3.5">
          <SectionHeader icon={Package}>Daftar Barang</SectionHeader>
          <div className="space-y-2.5">
            {data.items.map((item, index) => (
              <Card key={index} className="rounded-xl border-0 bg-[#eff4ff] shadow-none">
                <CardContent className="space-y-3 p-3.5 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <span className="rounded-md bg-[#dce9ff] px-2 py-0.5 text-xs font-bold text-[#3f465c]">
                        #{String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-bold tracking-tight text-[#0b1c30]">
                        Barang {index + 1}
                      </span>
                    </span>
                    {data.items.length > 1 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg p-0 text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a]"
                            onClick={() => removeItem(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Hapus barang ini</TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[130px_minmax(0,1fr)]">
                    <Field label="Banyaknya">
                      <Input
                        value={item.quantity}
                        placeholder="3 BAL"
                        onChange={(e) => setItem(index, "quantity", e.target.value)}
                        className={inputStitch}
                      />
                    </Field>
                    <Field label="Nama Barang">
                      <Input
                        value={item.name}
                        placeholder="Nama barang"
                        onChange={(e) => setItem(index, "name", e.target.value)}
                        className={inputStitch}
                      />
                    </Field>
                  </div>
                  <Field label="Keterangan Pengiriman (opsional)">
                    <Input
                      value={item.description}
                      placeholder="1 BAL isi 40pcs"
                      onChange={(e) => setItem(index, "description", e.target.value)}
                      className={inputStitch}
                    />
                  </Field>
                </CardContent>
              </Card>
            ))}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="secondary"
                className="h-11 w-full rounded-lg border-0 bg-[#dce9ff] text-[#a33900] hover:bg-[#cbdffd]"
                onClick={addItem}
              >
                <Plus className="h-4 w-4" /> Tambah Barang
              </Button>
            </TooltipTrigger>
            <TooltipContent>Tambah baris barang baru</TooltipContent>
          </Tooltip>
        </section>
      </CardContent>
    </Card>
  );
}
