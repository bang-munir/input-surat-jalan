# Rancangan Database — Neon PostgreSQL + Drizzle ORM

> **Status**: DOKUMEN RANCANGAN (belum diimplementasi)
> **Dibuat**: Berdasarkan audit kode `src/lib/` dan `src/routes/`
> **Target**: Neon PostgreSQL serverless

---

## 1. Tujuan Database

Penyimpanan data aplikasi saat ini sepenuhnya menggunakan `window.localStorage` (client-side). Ini memiliki keterbatasan:

- Data hilang jika user membersihkan cache browser
- Tidak bisa diakses dari device lain
- Tidak ada backup
- Tidak ada concurrent access

Migrasi ke **Neon PostgreSQL** akan:

- Menyimpan data secara persisten di server
- Memungkinkan akses dari multi-device
- Mendukung backup otomatis (Neon feature)
- Memungkinkan ekspansi fitur backend di masa depan

ORM yang digunakan: **Drizzle ORM** (ringkas, type-safe, cocok untuk TanStack Start + Nitro).

---

## 2. Tabel

### 2.1. `customers`

Data master pelanggan/penerima. Digunakan untuk auto-fill form Surat Jalan.

| Field        | Tipe          | Nullable | Default             | Keterangan                               |
| ------------ | ------------- | -------- | ------------------- | ---------------------------------------- |
| `id`         | `uuid`        | NOT NULL | `gen_random_uuid()` | Primary key                              |
| `nama`       | `text`        | NOT NULL | -                   | Nama pelanggan                           |
| `alamat`     | `text`        | NOT NULL | `''`                | Alamat (opsional, default empty string)  |
| `telepon`    | `text`        | NOT NULL | `''`                | Telepon (opsional, default empty string) |
| `catatan`    | `text`        | NOT NULL | `''`                | Catatan khusus (opsional)                |
| `created_at` | `timestamptz` | NOT NULL | `now()`             | Waktu pembuatan record                   |

**Sumber kode**: `src/lib/customers.ts:3-9`

```typescript
// Tipe saat ini di aplikasi
type Customer = {
  id: string; // -> uuid
  nama: string; // -> text NOT NULL
  alamat: string; // -> text NOT NULL default ''
  telepon: string; // -> text NOT NULL default ''
  catatan?: string; // -> text NOT NULL default ''
};
```

**Catatan**:

- `alamat`, `telepon`, `catatan` didefinisikan sebagai `string` (bukan `string | null`) di TypeScript, tetapi form membiarkan field kosong. Di database, gunakan `NOT NULL` dengan default `''` agar konsisten.
- `catatan` di TypeScript adalah optional (`?`), tetapi tetap disimpan sebagai string kosong saat tidak diisi.

---

### 2.2. `senders`

Data master pengirim. Digunakan untuk auto-fill bagian "Nama Pengirim" di form Surat Jalan.

| Field        | Tipe          | Nullable | Default             | Keterangan                |
| ------------ | ------------- | -------- | ------------------- | ------------------------- |
| `id`         | `uuid`        | NOT NULL | `gen_random_uuid()` | Primary key               |
| `nama`       | `text`        | NOT NULL | -                   | Nama pengirim             |
| `alamat`     | `text`        | NOT NULL | `''`                | Alamat (opsional)         |
| `telepon`    | `text`        | NOT NULL | `''`                | Telepon (opsional)        |
| `catatan`    | `text`        | NOT NULL | `''`                | Catatan khusus (opsional) |
| `created_at` | `timestamptz` | NOT NULL | `now()`             | Waktu pembuatan record    |

**Sumber kode**: `src/lib/senders.ts:3-9`

Struktur identik dengan `customers`. Keduanya memiliki field yang sama karena keduanya berfungsi sebagai "data kontak" yang diisi ke form surat jalan.

---

### 2.3. `surat_jalan`

Record surat jalan utama. Dibuat saat user klik "Simpan" di halaman input.

| Field              | Tipe          | Nullable | Default             | Keterangan                           |
| ------------------ | ------------- | -------- | ------------------- | ------------------------------------ |
| `id`               | `uuid`        | NOT NULL | `gen_random_uuid()` | Primary key                          |
| `nomor`            | `text`        | NOT NULL | -                   | Nomor bisnis `SJ-XXXX`               |
| `tanggal`          | `text`        | NOT NULL | -                   | Tanggal dalam format Indonesia       |
| `pengirim`         | `text`        | NOT NULL | `''`                | Nama pengirim (snapshot dari master) |
| `telepon_pengirim` | `text`        | NOT NULL | `''`                | Telepon pengirim (snapshot)          |
| `alamat_pengirim`  | `text`        | NOT NULL | `''`                | Alamat pengirim (snapshot)           |
| `kepada`           | `text`        | NOT NULL | `''`                | Nama penerima (snapshot dari master) |
| `telepon`          | `text`        | NOT NULL | `''`                | Telepon penerima (snapshot)          |
| `alamat`           | `text`        | NOT NULL | `''`                | Alamat penerima (snapshot)           |
| `created_at`       | `timestamptz` | NOT NULL | `now()`             | Waktu pembuatan record               |

**Sumber kode**: `src/lib/suratJalanStorage.ts:9-21`

```typescript
// Tipe saat ini di aplikasi
type SuratJalanRecord = {
  id: string; // -> uuid
  nomor: string; // -> text NOT NULL (format SJ-XXXX)
  tanggal: string; // -> text NOT NULL (format "15 September 2026")
  pengirim: string; // -> text NOT NULL
  teleponPengirim: string; // -> text NOT NULL
  alamatPengirim: string; // -> text NOT NULL
  kepada: string; // -> text NOT NULL
  telepon: string; // -> text NOT NULL
  alamat: string; // -> text NOT NULL
  items: SuratJalanItem[]; // -> relasi terpisah (surat_jalan_items)
  createdAt: string; // -> timestamptz
};
```

**Catatan Penting**:

- `tanggal` disimpan sebagai string yang sudah diformat (e.g. `"15 September 2026"`) oleh fungsi `formatTanggal()` di `src/routes/index.tsx:50-55`. Ini BUKAN format ISO date. Keputusan apakah perlu diubah ke `date` type ada di Bagian 12.
- `pengirim`, `telepon_pengirim`, `alamat_pengirim`, `kepada`, `telepon`, `alamat` adalah **snapshot** dari data master saat surat jalan dibuat. Tidak ada FK ke `customers` atau `senders`. Ini disengaja agar data transaksi tidak berubah saat master data diedit.

---

### 2.4. `surat_jalan_items`

Item/barang dalam surat jalan. Disimpan terpisah dari record utama (normalized).

| Field            | Tipe      | Nullable | Default        | Keterangan                       |
| ---------------- | --------- | -------- | -------------- | -------------------------------- |
| `id`             | `serial`  | NOT NULL | auto-increment | Primary key                      |
| `surat_jalan_id` | `uuid`    | NOT NULL | -              | FK -> `surat_jalan.id`           |
| `quantity`       | `text`    | NOT NULL | `''`           | Jumlah barang (e.g. "3 BAL")     |
| `name`           | `text`    | NOT NULL | `''`           | Nama barang                      |
| `description`    | `text`    | NOT NULL | `''`           | Keterangan pengiriman (opsional) |
| `sort_order`     | `integer` | NOT NULL | `0`            | Urutan item                      |

**Sumber kode**: `src/lib/suratJalanStorage.ts:3-7`

```typescript
// Tipe saat ini di aplikasi
type SuratJalanItem = {
  quantity: string; // -> text NOT NULL
  name: string; // -> text NOT NULL
  description: string; // -> text NOT NULL
};
```

**Catatan**:

- `quantity` berupa string (bukan number) karena format input bebas, e.g. `"3 BAL"`, `"10 PCS"`, `"2 BOX"`.
- `sort_order` ditambahkan untuk menjaga urutan item. Di localStorage, urutan dijaga oleh posisi array.
- `id` menggunakan `serial` (bukan uuid) karena ini adalah child record yang tidak perlu di-reference dari luar.

---

### 2.5. `nota`

Record nota. Dibuat berdasarkan Surat Jalan yang sudah ada.

| Field               | Tipe          | Nullable | Default             | Keterangan                          |
| ------------------- | ------------- | -------- | ------------------- | ----------------------------------- |
| `id`                | `uuid`        | NOT NULL | `gen_random_uuid()` | Primary key                         |
| `nomor`             | `text`        | NOT NULL | -                   | Nomor bisnis `NT-XXXX` (unik)       |
| `tanggal`           | `text`        | NOT NULL | -                   | Tanggal dalam format Indonesia      |
| `surat_jalan_id`    | `uuid`        | NOT NULL | -                   | FK -> `surat_jalan.id`              |
| `surat_jalan_nomor` | `text`        | NOT NULL | -                   | Denormalized: nomor surat jalan     |
| `pengirim`          | `text`        | NOT NULL | `''`                | Denormalized dari surat jalan       |
| `penerima`          | `text`        | NOT NULL | `''`                | Denormalized dari surat jalan       |
| `subtotal`          | `integer`     | NOT NULL | `0`                 | Sum total semua item (dalam Rupiah) |
| `potong`            | `integer`     | NOT NULL | `0`                 | Diskon/DP (dalam Rupiah)            |
| `total`             | `integer`     | NOT NULL | `0`                 | `subtotal - potong` (dalam Rupiah)  |
| `created_at`        | `timestamptz` | NOT NULL | `now()`             | Waktu pembuatan record              |

**Sumber kode**: `src/lib/notaStorage.ts:11-24`

```typescript
// Tipe saat ini di aplikasi
type NotaRecord = {
  id: string; // -> uuid
  nomor: string; // -> text NOT NULL (format NT-XXXX)
  tanggal: string; // -> text NOT NULL
  suratJalanId: string; // -> uuid FK
  suratJalanNomor: string; // -> text NOT NULL (denormalized)
  pengirim: string; // -> text NOT NULL (denormalized)
  penerima: string; // -> text NOT NULL (denormalized)
  items: NotaItem[]; // -> relasi terpisah (nota_items)
  subtotal: number; // -> integer NOT NULL
  potong: number; // -> integer NOT NULL
  total: number; // -> integer NOT NULL
  createdAt: string; // -> timestamptz
};
```

**Catatan Penting**:

- `subtotal`, `potong`, `total` menggunakan `integer` (bukan float) karena semua nominal adalah Rupiah tanpa desimal. Di kode, `parseInt()` digunakan saat parsing input (`src/routes/nota.tsx:486`).
- `pengirim` dan `penerima` adalah **snapshot** dari surat jalan, bukan FK ke master data.
- `surat_jalan_nomor` adalah **denormalized** dari `surat_jalan.nomor` untuk kemudahan tampilan di UI.

---

### 2.6. `nota_items`

Item barang dalam nota. Diambil dari surat jalan lalu ditambah harga.

| Field         | Tipe      | Nullable | Default        | Keterangan                    |
| ------------- | --------- | -------- | -------------- | ----------------------------- |
| `id`          | `serial`  | NOT NULL | auto-increment | Primary key                   |
| `nota_id`     | `uuid`    | NOT NULL | -              | FK -> `nota.id`               |
| `quantity`    | `text`    | NOT NULL | `''`           | Qty barang (di-copy dari SJ)  |
| `name`        | `text`    | NOT NULL | `''`           | Nama barang (di-copy dari SJ) |
| `description` | `text`    | NOT NULL | `''`           | Keterangan (di-copy dari SJ)  |
| `price`       | `integer` | NOT NULL | `0`            | Harga satuan (Rp)             |
| `total`       | `integer` | NOT NULL | `0`            | `quantity x price` (Rp)       |
| `sort_order`  | `integer` | NOT NULL | `0`            | Urutan item                   |

**Sumber kode**: `src/lib/notaStorage.ts:3-9`

```typescript
// Tipe saat ini di aplikasi
type NotaItem = {
  quantity: string; // -> text NOT NULL
  name: string; // -> text NOT NULL
  description: string; // -> text NOT NULL
  price: number; // -> integer NOT NULL
  total: number; // -> integer NOT NULL
};
```

**Catatan**:

- Saat Nota dibuat, item di-copy dari Surat Jalan dengan `price: 0` dan `total: 0` (`src/routes/nota.tsx:365-370`). User kemudian mengisi harga secara manual.
- `quantity` tetap berupa string karena format input bebas.

---

## 3. Primary Key

| Tabel               | Primary Key | Alasan                                                                                     |
| ------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| `customers`         | `uuid`      | Record unik, tidak ada nomor bisnis. UUID cocok untuk generasi client-side dan distribusi. |
| `senders`           | `uuid`      | Sama seperti customers.                                                                    |
| `surat_jalan`       | `uuid`      | Record unik. Nomor `SJ-XXXX` adalah nomor bisnis (display), bukan identifier teknis.       |
| `surat_jalan_items` | `serial`    | Child record, tidak perlu di-reference dari luar. `serial` lebih ringkas.                  |
| `nota`              | `uuid`      | Record unik. Nomor `NT-XXXX` adalah nomor bisnis (display).                                |
| `nota_items`        | `serial`    | Child record, tidak perlu di-reference dari luar.                                          |

**Keputusan**:

- Tabel parent (`customers`, `senders`, `surat_jalan`, `nota`) menggunakan **UUID** karena:
  - Konsisten dengan kode saat ini (`crypto.randomUUID()`)
  - Aman untuk generasi client-side (saat migrasi)
  - Tidak membutuhkan sequence central
- Tabel child (`surat_jalan_items`, `nota_items`) menggunakan **serial** karena:
  - Hanya di-reference oleh parent-nya
  - Lebih ringkas

---

## 4. Foreign Key

### 4.1. `surat_jalan_items` -> `surat_jalan`

```
surat_jalan_items.surat_jalan_id -> surat_jalan.id
```

| Aturan    | Nilai     | Alasan                                                                                                     |
| --------- | --------- | ---------------------------------------------------------------------------------------------------------- |
| ON DELETE | `CASCADE` | Jika surat jalan dihapus, item-itemnya juga harus ikut terhapus. Tidak ada gunanya item tanpa surat jalan. |
| ON UPDATE | `CASCADE` | Jika ID surat jalan berubah (sangat jarang), item tetap terkait.                                           |

### 4.2. `nota` -> `surat_jalan`

```
nota.surat_jalan_id -> surat_jalan.id
```

| Aturan    | Nilai      | Alasan                                                                                                                         |
| --------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| ON DELETE | `RESTRICT` | **TIDAK BOLEH** menghapus surat jalan yang sudah mempunyai nota. Ini akan melindungi data nota dari penghapusan tidak sengaja. |
| ON UPDATE | `CASCADE`  | Jika ID surat jalan berubah, nota tetap terkait.                                                                               |

> **PENTING**: `RESTRICT` dipilih karena saat ini kode tidak memiliki fitur cascade delete. Jika user mencoba menghapus surat jalan yang sudah punya nota, database akan menolak dan aplikasi bisa menampilkan pesan error yang sesuai.

### 4.3. `nota_items` -> `nota`

```
nota_items.nota_id -> nota.id
```

| Aturan    | Nilai     | Alasan                                                    |
| --------- | --------- | --------------------------------------------------------- |
| ON DELETE | `CASCADE` | Jika nota dihapus, item-itemnya juga harus ikut terhapus. |
| ON UPDATE | `CASCADE` | Jika ID nota berubah, item tetap terkait.                 |

### 4.4. Relasi Master Data (TIDAK ADA FK)

```
customers --(TIDAK ADA FK)--> surat_jalan
senders   --(TIDAK ADA FK)--> surat_jalan
```

**Alasan**: Saat ini kode **tidak menyimpan reference ID** dari customers atau senders ke surat jalan. Yang disimpan adalah **snapshot nama, alamat, telepon** secara langsung di record surat jalan. Ini adalah desain yang disengaja:

- Nama pelanggan/pengirim di-copy saat surat jalan dibuat
- Jika master data diubah, surat jalan lama tetap memuat data lama
- Tidak ada dependensi teknis antara master data dan transaksi

**Implikasi**: Tidak perlu FK dari `surat_jalan` ke `customers` atau `senders`. Ini bukan bug, tetapi fitur.

---

## 5. Tipe Data

| Field                                  | Tipe PostgreSQL | Alasan                                                                                                                                                                                |
| -------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id` (tabel parent)                    | `uuid`          | Standar untuk primary key distribusi. Didukung native PostgreSQL.                                                                                                                     |
| `id` (tabel child)                     | `serial`        | Auto-increment untuk child record. Ringkas.                                                                                                                                           |
| `nomor` (SJ-XXXX, NT-XXXX)             | `text`          | Nomor bisnis, bukan angka murni. Tidak perlu operasi matematika. Format tetap, tidak berubah.                                                                                         |
| `tanggal`                              | `text`          | **Keputusan perlu persetujuan** - saat ini disimpan sebagai string format Indonesia (`"15 September 2026"`). Lihat Bagian 12.                                                         |
| `nama`, `alamat`, `telepon`, `catatan` | `text`          | Data teks bebas. PostgreSQL `text` tidak memiliki batasan panjang dan lebih fleksibel dari `varchar`.                                                                                 |
| `quantity`                             | `text`          | Format input bebas (`"3 BAL"`, `"10 PCS"`). Bukan angka murni.                                                                                                                        |
| `price`, `subtotal`, `potong`, `total` | `integer`       | **Semua nominal dalam Rupiah tanpa desimal.** Menggunakan `integer` menghindari masalah floating point. Di kode, `parseInt()` digunakan saat parsing (`src/routes/nota.tsx:486,513`). |
| `sort_order`                           | `integer`       | Urutan item. Cukup `integer`.                                                                                                                                                         |
| `created_at`                           | `timestamptz`   | Waktu server saat record dibuat. `timestamptz` otomatis handle timezone.                                                                                                              |

### Catatan Kritis: Nominal Uang

**`integer` dipilih untuk semua field nominal** (price, subtotal, potong, total) karena:

1. Di kode, semua input menggunakan `parseInt()` (`src/routes/nota.tsx:486`):
   ```typescript
   setItemField(index, "price", parseInt(e.target.value, 10) || 0);
   ```
2. Tidak ada fitur desimal/fraction dalam bisnis ini
3. `integer` lebih aman dari `float`/`numeric` untuk kasus ini (tidak ada floating point error)
4. Range `integer` PostgreSQL (2.1 miliar) cukup untuk nominal Rupiah

**JANGAN menggunakan `float` atau `double` untuk uang.**

---

## 6. Index

### 6.1. Index yang Dibutuhkan

| Tabel               | Field            | Jenis Index | Alasan                                                     |
| ------------------- | ---------------- | ----------- | ---------------------------------------------------------- |
| `surat_jalan`       | `nomor`          | `UNIQUE`    | Pencarian berdasarkan nomor surat jalan. Nomor harus unik. |
| `surat_jalan`       | `created_at`     | `INDEX`     | Pengurutan di Laporan (sort by newest).                    |
| `nota`              | `nomor`          | `UNIQUE`    | Pencarian berdasarkan nomor nota. Nomor harus unik.        |
| `nota`              | `created_at`     | `INDEX`     | Pengurutan di halaman Nota (sort by newest).               |
| `surat_jalan_items` | `surat_jalan_id` | `INDEX`     | Load items berdasarkan surat jalan.                        |
| `nota_items`        | `nota_id`        | `INDEX`     | Load items berdasarkan nota.                               |
| `customers`         | `nama`           | `INDEX`     | Pencarian master pelanggan.                                |
| `senders`           | `nama`           | `INDEX`     | Pencarian master pengirim.                                 |

### 6.2. Index yang TIDAK Dibutuhkan

- **Composite index** - Query saat ini sederhana (single column filter). Belum perlu.
- **Full-text search** - Pencarian di Laporan menggunakan `LIKE` (`includes()`), belum perlu full-text index.
- **Index pada `tanggal`** - Pencarian di Laporan tidak filter by tanggal, hanya display. Jika nanti perlu filter by range tanggal, baru tambah index.

---

## 7. Constraint

### 7.1. PRIMARY KEY

Semua tabel memiliki primary key (lihat Bagian 3).

### 7.2. FOREIGN KEY

Semua relasi child->parent memiliki FK (lihat Bagian 4).

### 7.3. UNIQUE

| Tabel         | Field   | Alasan                                      |
| ------------- | ------- | ------------------------------------------- |
| `surat_jalan` | `nomor` | Nomor surat jalan harus unik secara global. |
| `nota`        | `nomor` | Nomor nota harus unik secara global.        |

### 7.4. NOT NULL

Semua field di semua tabel menggunakan `NOT NULL`. Field yang opsional di aplikasi (alamat, telepon, catatan) diberi default `''` (empty string) di database.

**Alasan**:

- Konsisten dengan TypeScript type yang tidak menggunakan `null`
- Menghindari bug null check di aplikasi
- Lebih sederhana dari mixed nullable/not-null

### 7.5. CHECK Constraint

Tidak ada CHECK constraint yang diperlukan saat ini.

- `price >= 0` - **TIDAK diperlukan** karena kode belum mencegah harga negatif. Menambahkan constraint tanpa mengubah UI akan menyebabkan error yang membingungkan.
- `subtotal >= 0` - Sama seperti di atas.

> **Keputusan**: CHECK constraint untuk validasi bisnis (harga >= 0, dll) baru ditambahkan setelah UI juga melakukan validasi yang sama.

---

## 8. Snapshot / Data Historis

### 8.1. Apa yang Disimpan sebagai Snapshot

Berdasarkan kode yang ada, berikut field-field yang merupakan **snapshot** (copy data dari sumber lain):

#### Di `surat_jalan`:

| Field              | Sumber                                | Disengaja? | Alasan                                                                        |
| ------------------ | ------------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| `pengirim`         | `senders.nama` atau input manual      | Ya         | Agar nama pengirim di surat jalan tidak berubah saat master pengirim diubah.  |
| `telepon_pengirim` | `senders.telepon` atau input manual   | Ya         | Sama seperti di atas.                                                         |
| `alamat_pengirim`  | `senders.alamat` atau input manual    | Ya         | Sama seperti di atas.                                                         |
| `kepada`           | `customers.nama` atau input manual    | Ya         | Agar nama penerima di surat jalan tidak berubah saat master pelanggan diubah. |
| `telepon`          | `customers.telepon` atau input manual | Ya         | Sama seperti di atas.                                                         |
| `alamat`           | `customers.alamat` atau input manual  | Ya         | Sama seperti di atas.                                                         |

#### Di `nota`:

| Field               | Sumber                 | Disengaja? | Alasan                                                       |
| ------------------- | ---------------------- | ---------- | ------------------------------------------------------------ |
| `surat_jalan_nomor` | `surat_jalan.nomor`    | Ya         | Denormalized untuk kemudahan tampilan.                       |
| `pengirim`          | `surat_jalan.pengirim` | Ya         | Snapshot dari surat jalan (yang sudah snapshot dari master). |
| `penerima`          | `surat_jalan.kepada`   | Ya         | Snapshot dari surat jalan.                                   |

### 8.2. Apa yang TIDAK Perlu Snapshot

- **Nama barang** di `surat_jalan_items` dan `nota_items` - Saat ini tidak ada "master barang". Nama barang diinput manual di form surat jalan. Jika nanti ada master barang, baru perlu dipertimbangkan.

### 8.3. Implikasi

- Jika nama pelanggan diubah di Master, **surat jalan lama tetap memuat nama lama**. Ini benar dan diinginkan.
- Jika nama pengirim diubah di Master, **surat jalan lama tetap memuat nama lama**. Ini benar dan diinginkan.
- **Tidak ada data yang hilang** saat master data diedit.

---

## 9. Mapping LocalStorage -> Database

### 9.1. `surat-jalan:customers`

| LocalStorage       | Database Tabel | Database Field               |
| ------------------ | -------------- | ---------------------------- |
| `Customer.id`      | `customers`    | `id`                         |
| `Customer.nama`    | `customers`    | `nama`                       |
| `Customer.alamat`  | `customers`    | `alamat`                     |
| `Customer.telepon` | `customers`    | `telepon`                    |
| `Customer.catatan` | `customers`    | `catatan`                    |
| _(tidak ada)_      | `customers`    | `created_at` _(ditambahkan)_ |

### 9.2. `surat-jalan:senders`

| LocalStorage     | Database Tabel | Database Field               |
| ---------------- | -------------- | ---------------------------- |
| `Sender.id`      | `senders`      | `id`                         |
| `Sender.nama`    | `senders`      | `nama`                       |
| `Sender.alamat`  | `senders`      | `alamat`                     |
| `Sender.telepon` | `senders`      | `telepon`                    |
| `Sender.catatan` | `senders`      | `catatan`                    |
| _(tidak ada)_    | `senders`      | `created_at` _(ditambahkan)_ |

### 9.3. `surat-jalan:records`

| LocalStorage                       | Database Tabel      | Database Field     |
| ---------------------------------- | ------------------- | ------------------ |
| `SuratJalanRecord.id`              | `surat_jalan`       | `id`               |
| `SuratJalanRecord.nomor`           | `surat_jalan`       | `nomor`            |
| `SuratJalanRecord.tanggal`         | `surat_jalan`       | `tanggal`          |
| `SuratJalanRecord.pengirim`        | `surat_jalan`       | `pengirim`         |
| `SuratJalanRecord.teleponPengirim` | `surat_jalan`       | `telepon_pengirim` |
| `SuratJalanRecord.alamatPengirim`  | `surat_jalan`       | `alamat_pengirim`  |
| `SuratJalanRecord.kepada`          | `surat_jalan`       | `kepada`           |
| `SuratJalanRecord.telepon`         | `surat_jalan`       | `telepon`          |
| `SuratJalanRecord.alamat`          | `surat_jalan`       | `alamat`           |
| `SuratJalanRecord.createdAt`       | `surat_jalan`       | `created_at`       |
| `SuratJalanRecord.items[0]`        | `surat_jalan_items` | (record terpisah)  |
| `SuratJalanRecord.items[n]`        | `surat_jalan_items` | (record terpisah)  |

**Mapping Items**:

| LocalStorage (item array element) | Database Field                            |
| --------------------------------- | ----------------------------------------- |
| `item.quantity`                   | `surat_jalan_items.quantity`              |
| `item.name`                       | `surat_jalan_items.name`                  |
| `item.description`                | `surat_jalan_items.description`           |
| _(posisi array)_                  | `surat_jalan_items.sort_order`            |
| _(tidak ada)_                     | `surat_jalan_items.id` _(auto)_           |
| _(tidak ada)_                     | `surat_jalan_items.surat_jalan_id` _(FK)_ |

### 9.4. `nota:records`

| LocalStorage                 | Database Tabel | Database Field      |
| ---------------------------- | -------------- | ------------------- |
| `NotaRecord.id`              | `nota`         | `id`                |
| `NotaRecord.nomor`           | `nota`         | `nomor`             |
| `NotaRecord.tanggal`         | `nota`         | `tanggal`           |
| `NotaRecord.suratJalanId`    | `nota`         | `surat_jalan_id`    |
| `NotaRecord.suratJalanNomor` | `nota`         | `surat_jalan_nomor` |
| `NotaRecord.pengirim`        | `nota`         | `pengirim`          |
| `NotaRecord.penerima`        | `nota`         | `penerima`          |
| `NotaRecord.subtotal`        | `nota`         | `subtotal`          |
| `NotaRecord.potong`          | `nota`         | `potong`            |
| `NotaRecord.total`           | `nota`         | `total`             |
| `NotaRecord.createdAt`       | `nota`         | `created_at`        |
| `NotaRecord.items[0]`        | `nota_items`   | (record terpisah)   |
| `NotaRecord.items[n]`        | `nota_items`   | (record terpisah)   |

**Mapping Items**:

| LocalStorage (item array element) | Database Field           |
| --------------------------------- | ------------------------ |
| `item.quantity`                   | `nota_items.quantity`    |
| `item.name`                       | `nota_items.name`        |
| `item.description`                | `nota_items.description` |
| `item.price`                      | `nota_items.price`       |
| `item.total`                      | `nota_items.total`       |
| _(posisi array)_                  | `nota_items.sort_order`  |

---

## 10. Alur Data

### 10.1. Alur Lengkap

```
+-----------------------------------------------------------+
|                     MASTER DATA                           |
|                                                           |
|  /pelanggan                                                |
|  +-- Input nama, alamat, telepon, catatan                 |
|  +-- Simpan ke customers (localStorage -> DB)             |
|  +-- CRUD: add, update, remove                            |
|                                                           |
|  /pelanggan (tab Pengirim)                                 |
|  +-- Input nama, alamat, telepon, catatan                 |
|  +-- Simpan ke senders (localStorage -> DB)               |
|  +-- CRUD: add, update, remove                            |
+-----------------------------------------------------------+
                            |
                            v
+-----------------------------------------------------------+
|                   INPUT SURAT JALAN                       |
|                                                           |
|  / (index)                                                 |
|  +-- Pilih Pelanggan -> auto-fill: kepada, alamat, telp  |
|  +-- Pilih Pengirim  -> auto-fill: pengirim, alamat, telp|
|  +-- Input: nomor (auto SJ-XXXX), tanggal, items         |
|  +-- Preview A4 lanskap (2 surat)                        |
|  +-- [Download PDF] -> generate PDF client-side           |
|  +-- [Simpan] -> simpan ke surat_jalan + surat_jalan_items|
|                  (localStorage -> DB)                      |
+-----------------------------------------------------------+
                            |
                            v
+-----------------------------------------------------------+
|                      LAPORAN                              |
|                                                           |
|  /laporan                                                  |
|  +-- Load semua surat_jalan dari DB                        |
|  +-- Filter: search by nomor, pengirim, kepada, tanggal  |
|  +-- Sort: by created_at DESC (newest first)               |
|  +-- [Lihat Detail] -> tampilkan data + preview           |
|  +-- [Download PDF] -> generate PDF dari data tersimpan   |
|  +-- [Hapus] -> hapus surat_jalan + items (CASCADE)      |
+-----------------------------------------------------------+
                            |
                            v
+-----------------------------------------------------------+
|                       NOTA                                 |
|                                                           |
|  /nota                                                     |
|  +-- [Buat Nota]                                           |
|  |   +-- Pilih Surat Jalan -> load dari DB                |
|  |   +-- Items di-copy dari SJ (price=0, total=0)         |
|  |   +-- User isi: harga per item                         |
|  |   +-- Hitung: subtotal, potong/DP, total               |
|  |   +-- Simpan -> nota + nota_items (localStorage -> DB)  |
|  |                                                        |
|  +-- [Daftar Nota]                                         |
|  |   +-- Load semua nota dari DB                           |
|  |   +-- Sort: by created_at DESC                          |
|  |   +-- Tampilkan: nomor, tanggal, ref SJ, total         |
|  |                                                        |
|  +-- [Detail Nota]                                         |
|  |   +-- Tampilkan semua data nota + items                 |
|  |   +-- [Download PDF A5/A4]                              |
|  |                                                        |
|  +-- [Edit Nota]                                           |
|  |   +-- Edit items (qty, harga)                           |
|  |   +-- Edit potong/DP                                    |
|  |   +-- Simpan perubahan                                  |
|  |                                                        |
|  +-- [Hapus Nota] -> hapus nota + items (CASCADE)          |
+-----------------------------------------------------------+
```

### 10.2. Alur Spesifik: Nota mengambil Referensi Surat Jalan

```
User klik "Buat Nota"
    |
    v
SelectSuratJalan component
    |
    +-- Load semua surat_jalan dari DB (useSuratJalanRecords)
    +-- Tampilkan daftar dengan search filter
    +-- User pilih salah satu
            |
            v
CreateNota component
    |
    +-- Inisialisasi items dari surat_jalan.items
    |   +-- Map: { ...item, price: 0, total: 0 }
    |       (src/routes/nota.tsx:365-370)
    |
    +-- Set tanggal = hari ini
    +-- Set potong = 0
    |
    +-- User isi harga per item
    |   +-- auto-calculate: total = qty x price
    |
    +-- Tampilkan subtotal, potong, total
    |
    +-- [Simpan Nota]
        |
        +-- Data yang disimpan:
        |   +-- suratJalanId = selectedSJ.id (FK)
        |   +-- suratJalanNomor = selectedSJ.nomor (denormalized)
        |   +-- pengirim = selectedSJ.pengirim (snapshot)
        |   +-- penerima = selectedSJ.kepada (snapshot)
        |   +-- items = [...]
        |   +-- subtotal, potong, total
        |   +-- nomor = auto-generate NT-XXXX (uniqueness check)
        |
        +-- Simpan ke nota + nota_items (localStorage -> DB)
```

---

## 11. Migration Plan

### Tahap 3 - Setup Drizzle + Neon Connection

- Install `@neondatabase/serverless`, `drizzle-orm`, `drizzle-kit` (dev)
- Buat `drizzle.config.ts`
- Buat `.env` dengan `DATABASE_URL`
- Buat `.env.example` sebagai template
- Buat `src/lib/db/index.ts` (koneksi ke Neon)
- **JANGAN** membuat schema atau migration di tahap ini

### Tahap 4 - Database Schema + Migration

- Buat `src/lib/db/schema.ts` dengan semua 6 tabel
- Jalankan `drizzle-kit generate` untuk generate SQL migration
- Jalankan `drizzle-kit push` untuk push ke database
- Verifikasi tabel terbuat dengan benar

### Tahap 5 - Server Functions / API Routes

- Buat server functions untuk setiap entitas:
  - `customers`: CRUD (add, update, remove, list)
  - `senders`: CRUD (add, update, remove, list)
  - `surat_jalan`: add, remove, list, get with items
  - `nota`: add, update, remove, list, get with items
- Implementasi uniqueness check untuk nomor Nota (generate + check di DB)
- Implementasi uniqueness check untuk nomor Surat Jalan

### Tahap 6 - Refactor Storage Layer

- Ubah `src/lib/customers.ts` -> fetch dari server function
- Ubah `src/lib/senders.ts` -> fetch dari server function
- Ubah `src/lib/suratJalanStorage.ts` -> fetch dari server function
- Ubah `src/lib/notaStorage.ts` -> fetch dari server function
- Pertahankan hook pattern (`useCustomers`, `useSenders`, dll) agar UI tidak perlu banyak berubah

### Tahap 7 - Data Migration (One-time)

- Buat script untuk import data localStorage yang ada ke database
- Bisa via:
  - Halaman `/admin/migrate` dengan UI upload JSON
  - Atau script Node.js yang dibuat khusus
- Verifikasi data setelah migrasi

### Tahap 8 - Testing & Cleanup

- Test semua CRUD operations
- Test PDF generation (pastikan data dari DB terbaca)
- Test Laporan search/filter
- Test Nota creation dari Surat Jalan
- Test hapus Surat Jalan yang sudah punya Nota (harus ditolak)
- Verify no regression
- Hapus code localStorage yang sudah tidak dipakai

---

## 12. Hal yang Masih Perlu Persetujuan

### 12.1. Tipe Field `tanggal` (KRITIS)

**Saat ini**: `tanggal` disimpan sebagai string format Indonesia, e.g. `"15 September 2026"`.
**Sumber**: `formatTanggal()` di `src/routes/index.tsx:50-55` dan `src/routes/nota.tsx:42-51`.

**Opsi A: Tetap gunakan `text`** (Rekomendasi saat ini)

- Pro: Tidak perlu ubah kode yang ada. PDF, display, semua sudah kerja.
- Kontra: Tidak bisa query by date range. Sorting by tanggal tidak akurat (string sort).
- Cocok jika: Aplikasi hanya menampilkan tanggal, tidak perlu filter/grafik by tanggal.

**Opsi B: Ubah ke `date`**

- Pro: Bisa query by date range. Sorting akurat.
- Kontra: Perlu ubah semua kode yang handle tanggal. Format display harus di-generate saat render.
- Cocok jika: Nanti perlu laporan by periode, grafik by tanggal.

> **Keputusan**: Untuk tahap ini, gunakan **`text`** (Opsi A) agar migrasi lebih mudah. Ubah ke `date` di masa depan jika diperlukan.

### 12.2. Nomor Surat Jalan Unik vs Per-User

**Saat ini**: Nomor `SJ-XXXX` digenerate random dan dicek unik di client-side.
**Pertanyaan**: Apakah nomor harus unik global (across semua user) atau per-device?

> **Keputusan**: Asumsi **unik global** (karena data akan di-sharing). Jika ternyata per-user, perlu tambah field `user_id`.

### 12.3. Multi-User / Authentication

**Saat ini**: Tidak ada login/auth. Semua data di localStorage per-device.

**Pertanyaan**: Apakah di masa depan akan ada multi-user?

- Jika Ya: Perlu tambah tabel `users` dan field `user_id` di semua tabel transaksi.
- Jika Tidak: Cukup single-user setup.

> **Keputusan**: Untuk tahap ini, **single-user** (tanpa auth). Jika nanti perlu multi-user, tambah tabel `users` dan `user_id` di schema baru.

### 12.4. Data yang Sudah Ada di localStorage

**Pertanyaan**: Saat migrasi ke database, apakah perlu import data localStorage yang sudah ada?

> **Keputusan**: Ya, perlu script migrasi (di Tahap 7). Data existing tidak boleh hilang.
