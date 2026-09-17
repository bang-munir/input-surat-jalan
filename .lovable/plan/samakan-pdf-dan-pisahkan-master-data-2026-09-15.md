# Samakan PDF dan Pisahkan Master Data

## Hasil yang akan dibuat

- PDF tetap A4 lanskap, satu halaman, berisi dua surat jalan yang tersusun atas–bawah.
- Tata letak setiap surat mengikuti gambar acuan: aksen logo, judul besar, nomor, pengirim, tanggal, penerima, tabel, tanda tangan, dan keterangan.
- Master Data dipisahkan menjadi **Pelanggan/Penerima** dan **Pengirim**.
- Pilihan pelanggan mengisi bagian **Kepada**; pilihan pengirim mengisi bagian **Nama Pengirim**.
- Nomor telepon dan alamat tetap opsional serta tidak muncul pada surat/PDF saat kosong.
- Data master pelanggan yang sudah tersimpan tetap dipertahankan.

## Langkah implementasi

1. Perluas penyimpanan master agar memiliki daftar pelanggan dan daftar pengirim terpisah, tanpa menghapus data pelanggan lama.
2. Ubah halaman Master Data agar pengguna dapat menambah, mengedit, mencari, dan menghapus kedua jenis data.
3. Sambungkan pilihan master yang sesuai pada Surat Atas dan Surat Bawah.
4. Sesuaikan pratinjau dan pembuat PDF vektor agar lebih dekat dengan gambar acuan.
5. Uji PDF hasil unduhan: ukuran A4 lanskap, satu halaman, dua surat, field kosong hilang, dan teks tetap tajam.

## Detail teknis

- Tetap memakai struktur aplikasi dan penyimpanan browser yang sudah ada.
- PDF dibuat dengan teks dan garis vektor, bukan tangkapan layar.
- Cetak menggunakan ukuran `297mm × 210mm` dengan dua area `297mm × 105mm`.
