import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AppNav } from "@/components/AppNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCustomers, type Customer } from "@/lib/customers";
import { useSenders, type Sender } from "@/lib/senders";

export const Route = createFileRoute("/pelanggan")({
  head: () => ({
    meta: [
      { title: "Master Pelanggan & Pengirim | Surat Jalan" },
      {
        name: "description",
        content:
          "Kelola master pelanggan penerima dan pengirim agar surat jalan terisi otomatis.",
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

function MasterDataPage() {
  const { customers, addCustomer, updateCustomer, removeCustomer } = useCustomers();
  const { senders, addSender, updateSender, removeSender } = useSenders();
  const [kind, setKind] = useState<MasterKind>("pelanggan");
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<MasterRecord | null>(null);
  const [q, setQ] = useState("");

  const records = kind === "pelanggan" ? customers : senders;
  const filtered = records.filter((c) =>
    `${c.nama} ${c.alamat} ${c.telepon}`.toLowerCase().includes(q.toLowerCase()),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      toast.error(kind === "pelanggan" ? "Nama pelanggan wajib diisi" : "Nama pengirim wajib diisi");
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
    setForm(empty);
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Master Pelanggan & Pengirim
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pelanggan mengisi bagian Kepada, sedangkan pengirim mengisi bagian Nama Pengirim.
        </p>

        <div className="mt-6 inline-flex rounded-lg border border-border bg-muted p-1">
          {(["pelanggan", "pengirim"] as MasterKind[]).map((item) => (
            <Button
              key={item}
              type="button"
              size="sm"
              variant={kind === item ? "default" : "ghost"}
              onClick={() => {
                setKind(item);
                setEditing(null);
                setForm(empty);
                setQ("");
              }}
            >
              {item === "pelanggan" ? "Pelanggan / Penerima" : "Pengirim"}
            </Button>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={submit}
            className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate font-display text-base font-bold">
                 {editing
                   ? `Edit ${kind === "pelanggan" ? "Pelanggan" : "Pengirim"}`
                   : `Tambah ${kind === "pelanggan" ? "Pelanggan" : "Pengirim"}`}
              </h2>
              {editing && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(null);
                    setForm(empty);
                  }}
                >
                  <X className="h-4 w-4" /> Batal
                </Button>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div className="space-y-1.5">
                 <Label className="text-xs text-muted-foreground">
                   {kind === "pelanggan" ? "Nama Pelanggan / Penerima *" : "Nama Pengirim *"}
                 </Label>
                <Input
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                 <Label className="text-xs text-muted-foreground">Alamat (opsional)</Label>
                <Textarea
                  rows={3}
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                 <Label className="text-xs text-muted-foreground">No. Telepon (opsional)</Label>
                <Input
                  value={form.telepon}
                  onChange={(e) => setForm({ ...form, telepon: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Catatan Khusus</Label>
                <Input
                  value={form.catatan}
                  onChange={(e) => setForm({ ...form, catatan: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                 <Plus className="h-4 w-4" /> {editing ? "Simpan Perubahan" : `Tambah ${kind === "pelanggan" ? "Pelanggan" : "Pengirim"}`}
              </Button>
            </div>
          </form>

          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                 placeholder={`Cari ${kind}…`}
                className="pl-9"
              />
            </div>

            <div className="mt-4 space-y-3">
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                   Belum ada {kind} yang cocok.
                </div>
              )}
              {filtered.map((c) => (
                <article
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.nama}</h3>
                    {c.alamat && (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {c.alamat}
                      </p>
                    )}
                    {c.telepon && <p className="mt-1 text-sm text-brand">{c.telepon}</p>}
                    {c.catatan && (
                      <p className="mt-1 text-xs italic text-muted-foreground">{c.catatan}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setEditing(c);
                        setForm({
                          nama: c.nama,
                          alamat: c.alamat,
                          telepon: c.telepon,
                          catatan: c.catatan || "",
                        });
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                         if (kind === "pelanggan") removeCustomer(c.id);
                         else removeSender(c.id);
                         toast.success("Data dihapus");
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
