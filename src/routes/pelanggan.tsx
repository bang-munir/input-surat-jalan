import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  Truck,
  Users,
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
import { useCustomers, type Customer } from "@/lib/customers";
import { useSenders, type Sender } from "@/lib/senders";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pelanggan")({
  head: () => ({
    meta: [
      { title: "Master Pelanggan & Pengirim | Surat Jalan" },
      {
        name: "description",
        content: "Kelola master pelanggan penerima dan pengirim agar surat jalan terisi otomatis.",
      },
      { property: "og:title", content: "Master Pelanggan & Pengirim" },
      {
        property: "og:description",
        content: "Kelola pelanggan penerima dan pengirim untuk pengisian otomatis surat jalan.",
      },
    ],
  }),
  component: MasterDataPage,
});

type MasterKind = "pelanggan" | "pengirim";
type MasterRecord = Customer | Sender;

const empty = { nama: "", alamat: "", telepon: "", catatan: "" };

const inputStitch =
  "h-11 rounded-lg border-0 bg-[#eff4ff] px-3.5 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";
const textareaStitch =
  "min-h-[96px] resize-none rounded-lg border-0 bg-[#eff4ff] px-3.5 py-3 focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-[#a33900]/40";

const KIND_META: Record<
  MasterKind,
  {
    label: string;
    countLabel: string;
    icon: LucideIcon;
    namaLabel: string;
    addButton: string;
    formTitle: (editing: boolean) => string;
    formSubtitle: (editing: boolean) => string;
    emptyTitle: string;
    emptyHint: string;
    searchEmptyTitle: string;
  }
> = {
  pelanggan: {
    label: "Pelanggan",
    countLabel: "pelanggan",
    icon: Users,
    namaLabel: "Nama Pelanggan / Penerima *",
    addButton: "Tambah Pelanggan",
    formTitle: (editing) => (editing ? "Edit Pelanggan" : "Tambah Pelanggan"),
    formSubtitle: (editing) =>
      editing ? "Perbarui data pelanggan penerima" : "Simpan profil pelanggan penerima",
    emptyTitle: "Belum ada pelanggan terdaftar.",
    emptyHint: 'Klik "Tambah Pelanggan" untuk menambahkan data pertama.',
    searchEmptyTitle: "Tidak ada pelanggan yang cocok.",
  },
  pengirim: {
    label: "Pengirim",
    countLabel: "pengirim",
    icon: Truck,
    namaLabel: "Nama Pengirim *",
    addButton: "Tambah Pengirim",
    formTitle: (editing) => (editing ? "Edit Pengirim" : "Tambah Pengirim"),
    formSubtitle: (editing) => (editing ? "Perbarui data pengirim" : "Simpan profil pengirim"),
    emptyTitle: "Belum ada pengirim terdaftar.",
    emptyHint: 'Klik "Tambah Pengirim" untuk menambahkan data pertama.',
    searchEmptyTitle: "Tidak ada pengirim yang cocok.",
  },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function ActionIconButton({
  label,
  tone = "neutral",
  onClick,
  children,
}: {
  label: string;
  tone?: "neutral" | "danger";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={onClick}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg transition-colors",
            tone === "danger"
              ? "text-[#ba1a1a] hover:bg-[#ffdad6] hover:text-[#93000a]"
              : "text-[#5a4138] hover:bg-[#eef3ff] hover:text-[#0b1c30]",
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function MasterDataPage() {
  const {
    customers,
    loaded: customersLoaded,
    addCustomer,
    updateCustomer,
    removeCustomer,
  } = useCustomers();
  const { senders, loaded: sendersLoaded, addSender, updateSender, removeSender } = useSenders();
  const [kind, setKind] = useState<MasterKind>("pelanggan");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{
    kind: MasterKind;
    record: MasterRecord;
  } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const meta = KIND_META[kind];
  const KindIcon = meta.icon;
  const records = kind === "pelanggan" ? customers : senders;
  const loaded = kind === "pelanggan" ? customersLoaded : sendersLoaded;
  const filtered = records.filter((c) =>
    `${c.nama} ${c.alamat} ${c.telepon}`.toLowerCase().includes(q.toLowerCase()),
  );

  useEffect(() => {
    if (!formOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFormOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [formOpen]);

  const openAdd = () => {
    setEditing(null);
    setForm(empty);
    setFormOpen(true);
  };

  const openEdit = (record: MasterRecord) => {
    setEditing(record);
    setForm({
      nama: record.nama,
      alamat: record.alamat,
      telepon: record.telepon,
      catatan: record.catatan || "",
    });
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(empty);
  };

  const changeKind = (next: MasterKind) => {
    setKind(next);
    setQ("");
    closeForm();
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      toast.error(
        kind === "pelanggan" ? "Nama pelanggan wajib diisi" : "Nama pengirim wajib diisi",
      );
      return;
    }
    if (editing) {
      if (kind === "pelanggan") updateCustomer(editing.id, form);
      else updateSender(editing.id, form);
      toast.success("Data berhasil diperbarui");
    } else {
      if (kind === "pelanggan") addCustomer(form);
      else addSender(form);
      toast.success(kind === "pelanggan" ? "Pelanggan ditambahkan" : "Pengirim ditambahkan");
    }
    closeForm();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      if (deleteTarget.kind === "pelanggan") {
        await removeCustomer(deleteTarget.record.id);
        toast.success("Pelanggan berhasil dihapus");
      } else {
        await removeSender(deleteTarget.record.id);
        toast.success("Pengirim berhasil dihapus");
      }
      setDeleteTarget(null);
    } catch {
      toast.error(
        deleteTarget.kind === "pelanggan"
          ? "Gagal menghapus Pelanggan"
          : "Gagal menghapus Pengirim",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-24 sm:pb-0">
      <AppNav />
      <TooltipProvider delayDuration={150}>
        <main className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-6 lg:px-8 sm:py-8">
          <header className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
              Master Data
            </h1>
            <p className="mt-1.5 text-[13px] text-[#5a4138] sm:text-sm">
              Pelanggan mengisi bagian Kepada, sedangkan pengirim mengisi bagian Nama Pengirim.
            </p>
          </header>

          <div className="mt-5 inline-flex w-full rounded-xl border border-border/70 bg-[#eef3ff] p-1 sm:w-auto">
            {(Object.keys(KIND_META) as MasterKind[]).map((item) => {
              const ItemIcon = KIND_META[item].icon;
              const active = kind === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => changeKind(item)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold transition-colors sm:flex-none sm:text-sm",
                    active
                      ? "bg-white text-[#a33900] shadow-sm"
                      : "text-[#5a4138] hover:text-[#0b1c30]",
                  )}
                >
                  <ItemIcon className="h-4 w-4 shrink-0" />
                  {KIND_META[item].label}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5a4138]" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={`Cari nama, alamat, atau telepon ${meta.countLabel}…`}
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

            <div className="flex items-center justify-between gap-3 sm:justify-end">
              <p className="hidden text-[13px] text-[#5a4138] sm:block">
                <span className="font-semibold text-[#0b1c30]">{filtered.length}</span>{" "}
                {meta.countLabel}
              </p>
              <Button
                type="button"
                onClick={openAdd}
                className="h-11 w-full shrink-0 rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000] sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                {meta.addButton}
              </Button>
            </div>
          </div>

          {!loaded && (
            <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center text-sm text-[#5a4138]">
              Memuat data…
            </div>
          )}

          {loaded && filtered.length === 0 && (
            <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-white/60 p-10 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#eef3ff] text-[#a33900]">
                {q ? <Search className="h-5 w-5" /> : <KindIcon className="h-5 w-5" />}
              </div>
              <p className="mt-3 text-sm font-semibold text-[#0b1c30]">
                {q ? meta.searchEmptyTitle : meta.emptyTitle}
              </p>
              <p className="mt-1 text-[13px] text-[#5a4138]">
                {q ? "Coba ganti kata kunci pencarian Anda." : meta.emptyHint}
              </p>
            </div>
          )}

          {loaded && filtered.length > 0 && (
            <div className="mt-6">
              <div className="hidden overflow-hidden rounded-2xl border border-border/70 bg-white shadow-sm md:block">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border/70 bg-[#f2f6ff] text-[12px] font-semibold tracking-wide text-[#5a4138]">
                      <th className="px-4 py-3">Nama</th>
                      <th className="px-4 py-3">No. Telepon</th>
                      <th className="px-4 py-3">Alamat</th>
                      <th className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {filtered.map((c) => (
                      <tr key={c.id} className="align-top hover:bg-[#f7f9ff]">
                        <td className="px-4 py-3">
                          <p className="max-w-[260px] truncate font-medium text-[#0b1c30]">
                            {c.nama}
                          </p>
                          {c.catatan && (
                            <p className="mt-0.5 max-w-[260px] truncate text-[12px] italic text-[#5a4138]">
                              {c.catatan}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[13px] text-[#5a4138]">{c.telepon || "—"}</td>
                        <td className="px-4 py-3">
                          <p className="max-w-[320px] truncate text-[13px] text-[#5a4138]">
                            {c.alamat || "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionIconButton label="Edit" onClick={() => openEdit(c)}>
                              <Pencil className="h-4 w-4" />
                            </ActionIconButton>
                            <ActionIconButton
                              label="Hapus"
                              tone="danger"
                              onClick={() => setDeleteTarget({ kind, record: c })}
                            >
                              <Trash2 className="h-4 w-4" />
                            </ActionIconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-3 md:hidden">
                {filtered.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-2xl border border-border/70 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e5eeff] text-[14px] font-bold text-[#a33900]">
                        {initials(c.nama)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-bold tracking-tight text-[#0b1c30]">
                          {c.nama}
                        </p>
                        {c.catatan && (
                          <p className="mt-0.5 truncate text-[12px] italic text-[#5a4138]">
                            {c.catatan}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 rounded-xl bg-[#f2f6ff] p-3">
                      {c.telepon && (
                        <p className="flex items-start gap-1.5 text-[13px] font-medium text-[#0b1c30]">
                          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#a33900]" />
                          <span className="min-w-0 truncate">{c.telepon}</span>
                        </p>
                      )}
                      <p className="flex items-start gap-1.5 text-[13px] text-[#5a4138]">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5a4138]" />
                        <span className="min-w-0 whitespace-pre-line">
                          {c.alamat || "Alamat belum diisi."}
                        </span>
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#eef3ff] px-2 text-[13px] font-semibold text-[#0b1c30] transition-colors hover:bg-[#e5eeff]"
                      >
                        <Pencil className="h-4 w-4 shrink-0" />
                        <span className="truncate">Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget({ kind, record: c })}
                        className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-[#ffdad6] px-2 text-[13px] font-semibold text-[#ba1a1a] transition-colors hover:bg-[#ffc9c3]"
                      >
                        <Trash2 className="h-4 w-4 shrink-0" />
                        <span className="truncate">Hapus</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {formOpen && (
            <div
              className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4"
              onClick={closeForm}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-label={meta.formTitle(Boolean(editing))}
                onClick={(e) => e.stopPropagation()}
                className="flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl"
              >
                <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[#d3e4fe] sm:hidden" />

                <div className="flex items-center justify-between gap-2 border-b border-border/70 px-4 py-3 sm:px-6">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#e5eeff] text-[#a33900]">
                      <KindIcon className="h-[18px] w-[18px]" />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-[15px] font-bold tracking-tight text-[#0b1c30]">
                        {meta.formTitle(Boolean(editing))}
                      </h2>
                      <p className="truncate text-[12px] text-[#5a4138]">
                        {meta.formSubtitle(Boolean(editing))}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-label="Tutup"
                    onClick={closeForm}
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#eef3ff] text-[#5a4138] transition-colors hover:bg-[#e5eeff] hover:text-[#0b1c30]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
                  <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold text-[#0b1c30]">
                        {meta.namaLabel}
                      </Label>
                      <Input
                        autoFocus
                        value={form.nama}
                        placeholder="Nama perusahaan, instansi, atau perorangan"
                        onChange={(e) => setForm({ ...form, nama: e.target.value })}
                        className={inputStitch}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold text-[#0b1c30]">
                        Alamat (opsional)
                      </Label>
                      <Textarea
                        rows={3}
                        value={form.alamat}
                        placeholder="Alamat lengkap"
                        onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                        className={textareaStitch}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold text-[#0b1c30]">
                        No. Telepon (opsional)
                      </Label>
                      <Input
                        value={form.telepon}
                        placeholder="08xx-xxxx-xxxx"
                        onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                        className={inputStitch}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-semibold text-[#0b1c30]">
                        Catatan Khusus
                      </Label>
                      <Input
                        value={form.catatan}
                        placeholder="Catatan tambahan (opsional)"
                        onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                        className={inputStitch}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)] sm:flex-row sm:justify-end sm:px-6 sm:pb-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={closeForm}
                      className="h-11 w-full rounded-lg border-0 bg-[#e5eeff] text-[#0b1c30] hover:bg-[#d8e6ff] sm:w-auto"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      className="h-11 w-full rounded-lg bg-[#a33900] text-white shadow-sm hover:bg-[#8a3000] sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      {editing ? "Simpan Perubahan" : meta.addButton}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <Dialog
            open={!!deleteTarget}
            onOpenChange={(open) => {
              if (!open) setDeleteTarget(null);
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Hapus {deleteTarget?.kind === "pelanggan" ? "Pelanggan" : "Pengirim"}
                </DialogTitle>
                <DialogDescription>
                  Apakah Anda yakin ingin menghapus{" "}
                  {deleteTarget?.kind === "pelanggan" ? "Pelanggan" : "Pengirim"}{" "}
                  <span className="font-bold">{deleteTarget?.record.nama}</span>? Tindakan ini tidak
                  dapat dibatalkan.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleteBusy}
                >
                  Batal
                </Button>
                <Button variant="destructive" onClick={handleDelete} disabled={deleteBusy}>
                  {deleteBusy ? "Menghapus…" : "Hapus"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </main>
      </TooltipProvider>
    </div>
  );
}
