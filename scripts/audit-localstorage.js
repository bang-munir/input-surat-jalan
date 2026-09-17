// =============================================================================
// AUDIT READ-ONLY — localStorage Data Audit
// =============================================================================
// CARA PAKAI:
//   1. Buka aplikasi di browser (localhost atau produksi)
//   2. Buka DevTools (F12) -> tab Console
//   3. Salin seluruh script ini, paste ke Console, tekan Enter
//   4. Baca hasilnya di Console
//
// AMAN:
//   - HANYA membaca localStorage (getItem)
//   - TIDAK pernah menulis/menghapus localStorage
//   - TIDAK melakukan request ke server/database
//   - Bisa dijalankan berulang kali tanpa efek samping
// =============================================================================

(() => {
  "use strict";

  const KEYS = {
    customers: "surat-jalan:customers",
    senders: "surat-jalan:senders",
    suratJalan: "surat-jalan:records",
    nota: "nota:records",
  };

  // ---- Helper: read only, never write ----
  function read(key) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function isUUIDv4(s) {
    return (
      typeof s === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s)
    );
  }

  function isISODate(s) {
    if (typeof s !== "string") return false;
    const d = new Date(s);
    return !Number.isNaN(d.getTime());
  }

  function countDupes(arr) {
    const seen = new Map();
    for (const v of arr) {
      seen.set(v, (seen.get(v) || 0) + 1);
    }
    const dupes = [];
    for (const [k, c] of seen) {
      if (c > 1) dupes.push({ value: k, count: c });
    }
    return dupes;
  }

  // ---- Read data ----
  const customers = read(KEYS.customers);
  const senders = read(KEYS.senders);
  const sjRecords = read(KEYS.suratJalan);
  const notaRecords = read(KEYS.nota);

  // ---- Build report ----
  const report = {};

  // ==========================
  // 1. RINGKASAN JUMLAH
  // ==========================
  report.ringkasan = {
    pelanggan: customers.length,
    pengirim: senders.length,
    surat_jalan: sjRecords.length,
    item_surat_jalan: sjRecords.reduce(
      (n, r) => n + (Array.isArray(r.items) ? r.items.length : 0),
      0,
    ),
    nota: notaRecords.length,
    item_nota: notaRecords.reduce((n, r) => n + (Array.isArray(r.items) ? r.items.length : 0), 0),
  };

  // ==========================
  // 2. CEK ID
  // ==========================
  function auditIDs(label, records) {
    const ids = records.map((r) => r.id);
    const empty = ids.filter((id) => !id || id === "");
    const validUUID = ids.filter(isUUIDv4);
    const invalidUUID = ids.filter((id) => id && !isUUIDv4(id));
    const dupes = countDupes(ids);
    return {
      total: ids.length,
      kosong: empty.length,
      uuid_valid: validUUID.length,
      uuid_invalid: invalidUUID.length,
      contoh_invalid: invalidUUID.slice(0, 3),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  }

  report.id_pelanggan = auditIDs("Pelanggan", customers);
  report.id_pengirim = auditIDs("Pengirim", senders);
  report.id_surat_jalan = auditIDs("Surat Jalan", sjRecords);
  report.id_nota = auditIDs("Nota", notaRecords);

  // ==========================
  // 3. CEK NOMOR SURAT JALAN
  // ==========================
  {
    const nomors = sjRecords.map((r) => r.nomor);
    const empty = nomors.filter((n) => !n || n === "");
    const validFormat = nomors.filter((n) => /^SJ-\d{4}$/.test(n));
    const invalidFormat = nomors.filter((n) => n && !/^SJ-\d{4}$/.test(n));
    const dupes = countDupes(nomors);

    report.nomor_surat_jalan = {
      total: nomors.length,
      kosong: empty.length,
      "format_valid_SJ-XXXX": validFormat.length,
      format_invalid: invalidFormat.length,
      contoh_invalid: invalidFormat.slice(0, 5),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  }

  // ==========================
  // 4. CEK NOMOR NOTA
  // ==========================
  {
    const nomors = notaRecords.map((r) => r.nomor);
    const empty = nomors.filter((n) => !n || n === "");
    const validFormat = nomors.filter((n) => /^NT-\d{4}$/.test(n));
    const invalidFormat = nomors.filter((n) => n && !/^NT-\d{4}$/.test(n));
    const dupes = countDupes(nomors);

    report.nomor_nota = {
      total: nomors.length,
      kosong: empty.length,
      "format_valid_NT-XXXX": validFormat.length,
      format_invalid: invalidFormat.length,
      contoh_invalid: invalidFormat.slice(0, 5),
      duplikat: dupes.length,
      duplikat_detail: dupes,
    };
  }

  // ==========================
  // 5. CEK RELASI NOTA → SURAT JALAN
  // ==========================
  {
    const sjIDSet = new Set(sjRecords.map((r) => r.id));
    let valid = 0;
    let orphan = 0;
    let kosong = 0;
    const orphanDetails = [];

    for (const n of notaRecords) {
      const refId = n.suratJalanId;
      if (!refId || refId === "") {
        kosong++;
      } else if (sjIDSet.has(refId)) {
        valid++;
      } else {
        orphan++;
        orphanDetails.push({
          nomorNota: n.nomor || "(kosong)",
          suratJalanId: refId,
          suratJalanNomor: n.suratJalanNomor || "(tidak ada)",
        });
      }
    }

    report.relasi_nota_sj = {
      nota_total: notaRecords.length,
      surat_jalan_total: sjRecords.length,
      referensi_valid: valid,
      surat_jalan_id_kosong: kosong,
      orphan_tidak_menemukan_sj: orphan,
      orphan_detail: orphanDetails,
    };
  }

  // ==========================
  // 6. CEK ITEMS SURAT JALAN
  // ==========================
  {
    let totalItems = 0;
    let sjTanpaItem = 0;
    let itemTanpaNama = 0;
    let itemQtyKosong = 0;
    let itemDescKosong = 0;

    for (const r of sjRecords) {
      const items = Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) {
        sjTanpaItem++;
      }
      for (const it of items) {
        totalItems++;
        if (!it.name || it.name.trim() === "") itemTanpaNama++;
        if (!it.quantity || it.quantity.trim() === "") itemQtyKosong++;
        if (!it.description || it.description.trim() === "") itemDescKosong++;
      }
    }

    report.items_surat_jalan = {
      surat_jalan_total: sjRecords.length,
      item_total: totalItems,
      surat_jalan_tanpa_item: sjTanpaItem,
      item_tanpa_nama: itemTanpaNama,
      item_quantity_kosong: itemQtyKosong,
      item_description_kosong: itemDescKosong,
    };
  }

  // ==========================
  // 7. CEK ITEMS NOTA
  // ==========================
  {
    let totalItems = 0;
    let notaTanpaItem = 0;
    let itemTanpaNama = 0;
    let itemQtyKosong = 0;
    let itemPriceKosong = 0;
    let itemTotalKosong = 0;

    for (const r of notaRecords) {
      const items = Array.isArray(r.items) ? r.items : [];
      if (items.length === 0) {
        notaTanpaItem++;
      }
      for (const it of items) {
        totalItems++;
        if (!it.name || it.name.trim() === "") itemTanpaNama++;
        if (!it.quantity || it.quantity.trim() === "") itemQtyKosong++;
        if (it.price === undefined || it.price === null || it.price === "") itemPriceKosong++;
        if (it.total === undefined || it.total === null || it.total === "") itemTotalKosong++;
      }
    }

    report.items_nota = {
      nota_total: notaRecords.length,
      item_total: totalItems,
      nota_tanpa_item: notaTanpaItem,
      item_tanpa_nama: itemTanpaNama,
      item_quantity_kosong: itemQtyKosong,
      item_price_kosong: itemPriceKosong,
      item_total_kosong: itemTotalKosong,
    };
  }

  // ==========================
  // 8. CEK NILAI UANG
  // ==========================
  {
    let subtotalIssues = 0;
    let potongIssues = 0;
    let totalIssues = 0;
    let priceIssues = 0;
    let itemTotalIssues = 0;
    let subtotalMismatch = 0;
    let grandTotalMismatch = 0;
    let negativeValues = [];

    for (const n of notaRecords) {
      // Check parent fields
      if (typeof n.subtotal !== "number" || Number.isNaN(n.subtotal)) subtotalIssues++;
      if (typeof n.potong !== "number" || Number.isNaN(n.potong)) potongIssues++;
      if (typeof n.total !== "number" || Number.isNaN(n.total)) totalIssues++;
      if (n.subtotal < 0)
        negativeValues.push({ record: n.nomor, field: "subtotal", value: n.subtotal });
      if (n.potong < 0) negativeValues.push({ record: n.nomor, field: "potong", value: n.potong });
      if (n.total < 0) negativeValues.push({ record: n.nomor, field: "total", value: n.total });

      // Check item fields
      const items = Array.isArray(n.items) ? n.items : [];
      for (const it of items) {
        if (typeof it.price !== "number" || Number.isNaN(it.price)) priceIssues++;
        if (typeof it.total !== "number" || Number.isNaN(it.total)) itemTotalIssues++;
        if (it.price < 0)
          negativeValues.push({ record: n.nomor, field: "item.price", value: it.price });
        if (it.total < 0)
          negativeValues.push({ record: n.nomor, field: "item.total", value: it.total });
      }

      // Check subtotal consistency
      const computedSubtotal = items.reduce(
        (s, it) => s + (typeof it.total === "number" ? it.total : 0),
        0,
      );
      if (items.length > 0 && n.subtotal !== computedSubtotal) subtotalMismatch++;

      // Check total = subtotal - potong
      if (items.length > 0 && n.total !== n.subtotal - n.potong) grandTotalMismatch++;
    }

    report.nilai_uang = {
      nota_total: notaRecords.length,
      subtotal_bukan_number: subtotalIssues,
      potong_bukan_number: potongIssues,
      total_bukan_number: totalIssues,
      item_price_bukan_number: priceIssues,
      item_total_bukan_number: itemTotalIssues,
      subtotal_berbeda_dari_sum_item: subtotalMismatch,
      total_bukan_subtotal_minus_potong: grandTotalMismatch,
      nilai_negatif: negativeValues,
    };
  }

  // ==========================
  // 9. CEK DATA MASTER
  // ==========================
  {
    function auditMaster(label, records) {
      let namaKosong = 0;
      let idDupes = countDupes(records.map((r) => r.id));
      let catatanUndefined = 0;
      let alamatUndefined = 0;
      let teleponUndefined = 0;

      for (const r of records) {
        if (!r.nama || r.nama.trim() === "") namaKosong++;
        if (r.catatan === undefined || r.catatan === null) catatanUndefined++;
        if (r.alamat === undefined || r.alamat === null) alamatUndefined++;
        if (r.telepon === undefined || r.telepon === null) teleponUndefined++;
      }

      return {
        total: records.length,
        nama_kosong: namaKosong,
        id_duplikat: idDupes.length,
        id_duplikat_detail: idDupes,
        catatan_undefined_null: catatanUndefined,
        alamat_undefined_null: alamatUndefined,
        telepon_undefined_null: teleponUndefined,
      };
    }

    report.master_pelanggan = auditMaster("Pelanggan", customers);
    report.master_pengirim = auditMaster("Pengirim", senders);
  }

  // ==========================
  // 10. CEK TANGGAL & CREATED_AT
  // ==========================
  {
    function auditDates(label, records) {
      let tanggalInvalid = 0;
      let tanggalFormat = {};
      let createdInvalid = 0;
      let createdFormats = [];

      for (const r of records) {
        // tanggal field
        if (r.tanggal) {
          if (isISODate(r.tanggal)) {
            tanggalFormat["ISO_valid"] = (tanggalFormat["ISO_valid"] || 0) + 1;
          } else if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(r.tanggal)) {
            tanggalFormat["format_indonesia"] = (tanggalFormat["format_indonesia"] || 0) + 1;
          } else {
            tanggalFormat["lainnya"] = (tanggalFormat["lainnya"] || 0) + 1;
            tanggalInvalid++;
          }
        }

        // createdAt field
        if (r.createdAt) {
          if (isISODate(r.createdAt)) {
            createdFormats.push("ISO");
          } else if (/^\d{4}-\d{2}-\d{2}T/.test(r.createdAt)) {
            createdFormats.push("ISO-prefix");
          } else {
            createdFormats.push("other:" + typeof r.createdAt);
            createdInvalid++;
          }
        }
      }

      const createdUnique = [...new Set(createdFormats)];

      return {
        total: records.length,
        tanggal_invalid: tanggalInvalid,
        tanggal_format: tanggalFormat,
        created_at_invalid: createdInvalid,
        created_at_format_unik: createdUnique,
      };
    }

    report.tanggal_surat_jalan = auditDates("Surat Jalan", sjRecords);
    report.tanggal_nota = auditDates("Nota", notaRecords);
  }

  // ==========================
  // 11. CEK KONSISTENSI
  // ==========================
  {
    const sjIDSet = new Set(sjRecords.map((r) => r.id));
    let sjWithItems = 0;
    let sjWithoutItems = 0;
    let notaWithValidRef = 0;
    let notaWithInvalidRef = 0;

    for (const r of sjRecords) {
      if (Array.isArray(r.items) && r.items.length > 0) sjWithItems++;
      else sjWithoutItems++;
    }

    for (const n of notaRecords) {
      if (n.suratJalanId && sjIDSet.has(n.suratJalanId)) notaWithValidRef++;
      else notaWithInvalidRef++;
    }

    report.konsistensi = {
      surat_jalan_total: sjRecords.length,
      surat_jalan_dengan_item: sjWithItems,
      surat_jalan_tanpa_item: sjWithoutItems,
      nota_total: notaRecords.length,
      nota_referensi_sj_valid: notaWithValidRef,
      nota_referensi_sj_tidak_valid: notaWithInvalidRef,
    };
  }

  // ==========================
  // OUTPUT
  // ==========================
  console.log(
    "%c╔══════════════════════════════════════════════════╗",
    "color: #22c55e; font-weight: bold",
  );
  console.log(
    "%c║   AUDIT READ-ONLY — localStorage Data           ║",
    "color: #22c55e; font-weight: bold",
  );
  console.log(
    "%c╚══════════════════════════════════════════════════╝",
    "color: #22c55e; font-weight: bold",
  );
  console.log("");
  console.log(
    "%c[READ-ONLY] Script ini TIDAK mengubah data apapun.",
    "color: #3b82f6; font-style: italic",
  );
  console.log("");

  // Ringkasan
  console.log("%c━━━ 1. RINGKASAN JUMLAH ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.ringkasan);

  // ID
  console.log("%c━━━ 2. CEK ID ━━━", "color: #f59e0b; font-weight: bold");
  console.log("%cPelanggan:", "font-weight: bold", report.id_pelanggan);
  console.log("%cPengirim:", "font-weight: bold", report.id_pengirim);
  console.log("%cSurat Jalan:", "font-weight: bold", report.id_surat_jalan);
  console.log("%cNota:", "font-weight: bold", report.id_nota);

  // Nomor SJ
  console.log("%c━━━ 3. NOMOR SURAT JALAN ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.nomor_surat_jalan);

  // Nomor Nota
  console.log("%c━━━ 4. NOMOR NOTA ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.nomor_nota);

  // Relasi
  console.log("%c━━━ 5. RELASI NOTA → SURAT JALAN ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.relasi_nota_sj);
  if (report.relasi_nota_sj.orphan_detail.length > 0) {
    console.warn("%c⚠ Orphan Nota ditemukan:", "color: #ef4444; font-weight: bold");
    console.table(report.relasi_nota_sj.orphan_detail);
  }

  // Items SJ
  console.log("%c━━━ 6. ITEMS SURAT JALAN ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.items_surat_jalan);

  // Items Nota
  console.log("%c━━━ 7. ITEMS NOTA ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.items_nota);

  // Nilai uang
  console.log("%c━━━ 8. NILAI UANG ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.nilai_uang);
  if (report.nilai_uang.nilai_negatif.length > 0) {
    console.warn("%c⚠ Nilai negatif ditemukan:", "color: #ef4444; font-weight: bold");
    console.table(report.nilai_uang.nilai_negatif);
  }

  // Master
  console.log("%c━━━ 9. DATA MASTER ━━━", "color: #f59e0b; font-weight: bold");
  console.log("%cPelanggan:", "font-weight: bold");
  console.table(report.master_pelanggan);
  console.log("%cPengirim:", "font-weight: bold");
  console.table(report.master_pengirim);

  // Tanggal
  console.log("%c━━━ 10. TANGGAL & CREATED_AT ━━━", "color: #f59e0b; font-weight: bold");
  console.log("%cSurat Jalan:", "font-weight: bold");
  console.table(report.tanggal_surat_jalan);
  console.log("%cNota:", "font-weight: bold");
  console.table(report.tanggal_nota);

  // Konsistensi
  console.log("%c━━━ 11. KONSISTENSI ━━━", "color: #f59e0b; font-weight: bold");
  console.table(report.konsistensi);

  // Full report object (untuk inspection)
  console.log("%c━━━ FULL REPORT (copy via copy(report)) ━━━", "color: #f59e0b; font-weight: bold");
  console.log(
    "Ketik %creport%c di Console untuk inspect objek lengkap.",
    "color: #3b82f6; font-weight: bold",
    "color: inherit",
  );

  // Expose ke window untuk inspect
  window.__auditReport = report;
  console.log("%c✓ Report tersimpan di window.__auditReport", "color: #22c55e");
})();
