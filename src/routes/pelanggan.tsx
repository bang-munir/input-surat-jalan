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

export const Route = createFileRoute("/pelanggan")({
  head: () => ({
    meta: [
      { title: "Master Data Pelanggan | Surat Jalan" },
      {
        name: "description",
        content:
          "Simpan nama, alamat, dan nomor telepon pelanggan tetap agar surat jalan terisi otomatis.",
      },
      { property: "og:title", content: "Master Data Pelanggan" },
      {
        property: "og:description",
        content: "Kelola daftar pelanggan tetap untuk pengisian otomatis surat jalan.",
      },
    ],
  }),
  component: MasterDataPage,
});

const empty = { nama: "", alamat: "", telepon: "", catatan: "" };

function MasterDataPage() {
  const { customers, addCustomer, updateCustomer, removeCustomer } = useCustomers();
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [q, setQ] = useState("");

  const filtered = customers.filter((c) =>
    `${c.nama} ${c.alamat} ${c.telepon}`.toLowerCase().includes(q.toLowerCase()),
  );

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama.trim()) {
      toast.error("Nama pelanggan wajib diisi");
      return;
    }
    if (editing) {
      updateCustomer(editing.id, form);
      toast.success("Data pelanggan diperbarui");
    } else {
      addCustomer(form);
      toast.success("Pelanggan ditambahkan");
    }
    setForm(empty);
    setEditing(null);
  };

  return (
    <div className="min-h-screen bg-background font-sans">
      <AppNav />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
          Master Data Pelanggan
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tersimpan di browser Anda, dipakai untuk isi otomatis surat jalan.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <form
            onSubmit={submit}
            className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <h2 className="truncate font-display text-base font-bold">
                {editing ? "Edit Pelanggan" : "Tambah Pelanggan"}
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
                <Label className="text-xs text-muted-foreground">Nama Perusahaan / Penerima</Label>
                <Input
                  value={form.nama}
                  onChange={(e) => setForm({ ...form, nama: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alamat Lengkap</Label>
                <Textarea
                  rows={3}
                  value={form.alamat}
                  onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">No. Telepon / Kontak</Label>
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
                <Plus className="h-4 w-4" /> {editing ? "Simpan Perubahan" : "Tambah Pelanggan"}
              </Button>
            </div>
          </form>

          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari pelanggan…"
                className="pl-9"
              />
            </div>

            <div className="mt-4 space-y-3">
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Belum ada pelanggan yang cocok.
                </div>
              )}
              {filtered.map((c) => (
                <article
                  key={c.id}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{c.nama}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                      {c.alamat}
                    </p>
                    <p className="mt-1 text-sm text-brand">{c.telepon}</p>
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
                        removeCustomer(c.id);
                        toast.success("Pelanggan dihapus");
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
