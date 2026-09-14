import type { jsPDF } from "jspdf";

export type SlipData = {
  nomor: string;
  tanggal: string; // sudah diformat, mis. "15 September 2026"
  pengirim: string;
  teleponPengirim: string;
  alamatPengirim: string;
  kepada: string;
  telepon: string;
  alamat: string;
  banyaknya: string;
  namaBarang: string;
  keterangan: string;
};

const INK = [26, 42, 74] as [number, number, number];
const BRAND = [47, 82, 143] as [number, number, number];
const LINE = [150, 165, 190] as [number, number, number];

function has(v?: string) {
  return Boolean(v && v.trim());
}

/** Baris "Label : Nilai" yang otomatis hilang bila nilai kosong. */
type FieldRow = { label: string; value: string };

function rows(list: FieldRow[]) {
  return list.filter((r) => has(r.value));
}

/**
 * Menggambar satu surat jalan lanskap (297mm x 105mm) pada posisi offsetY.
 * Semua teks digambar sebagai teks vektor agar tajam saat dicetak.
 */
export function drawSlip(pdf: jsPDF, data: SlipData, offsetY: number) {
  const W = 297;
  const H = 105;
  const ml = 12;
  const mr = W - 12;
  const y = (v: number) => offsetY + v;

  pdf.setTextColor(...INK);

  // ---- Judul ----
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(19);
  pdf.text("SURAT JALAN", ml, y(13));

  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...BRAND);
  pdf.text(`NO :  ${data.nomor || "-"}`, ml + 1, y(19));
  pdf.setTextColor(...INK);

  // ---- Blok pengirim (kiri) ----
  const pengirimRows = rows([
    { label: "Nama Pengirim", value: data.pengirim },
    { label: "No. Telp", value: data.teleponPengirim },
    { label: "Alamat", value: data.alamatPengirim },
  ]);

  let py = y(27);
  pdf.setFontSize(8.5);
  for (const r of pengirimRows) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, ml, py);
    pdf.text(":", ml + 27, py);
    const lines = pdf.splitTextToSize(r.value, 55) as string[];
    pdf.setFont("helvetica", "bold");
    pdf.text(lines, ml + 30, py);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.15);
    pdf.line(ml + 30, py + 1.4 + (lines.length - 1) * 4, ml + 92, py + 1.4 + (lines.length - 1) * 4);
    py += 5.5 + (lines.length - 1) * 4;
  }

  // ---- Tanggal (tengah) ----
  const cx = 105;
  pdf.setFontSize(8.5);
  if (has(data.tanggal)) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Tanggal", cx, y(13));
    pdf.text(":", cx + 20, y(13));
    pdf.setFont("helvetica", "bold");
    pdf.text(data.tanggal, cx + 23, y(13));
    pdf.setDrawColor(...LINE);
    pdf.line(cx + 23, y(14.4), cx + 75, y(14.4));
  }

  // ---- Blok penerima (kanan) ----
  const rx = 196;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.2);
  pdf.line(rx - 8, y(8), rx - 8, y(36));

  const penerimaRows = rows([
    { label: "Kepada", value: data.kepada },
    { label: "No. Telp", value: data.telepon },
    { label: "Alamat", value: data.alamat },
  ]);

  let ry = y(13);
  for (const r of penerimaRows) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, rx, ry);
    pdf.text(":", rx + 20, ry);
    const lines = pdf.splitTextToSize(r.value, mr - (rx + 23)) as string[];
    pdf.setFont("helvetica", "bold");
    pdf.text(lines, rx + 23, ry);
    ry += 5.5 + (lines.length - 1) * 4;
  }

  // ---- Garis pemisah ----
  const headBottom = Math.max(py, ry, y(38));
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(ml, headBottom, mr, headBottom);

  // ---- Tabel barang ----
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(8);
  pdf.text("Kami kirimkan barang-barang tersebut di bawah ini:", ml, headBottom + 5);

  const tTop = headBottom + 8;
  const tHead = 7;
  const tBody = 13;
  const colW = 48;

  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.25);
  pdf.setFillColor(238, 242, 248);
  pdf.rect(ml, tTop, mr - ml, tHead, "FD");
  pdf.rect(ml, tTop + tHead, mr - ml, tBody, "D");
  pdf.line(ml + colW, tTop, ml + colW, tTop + tHead + tBody);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...INK);
  pdf.text("BANYAKNYA", ml + colW / 2, tTop + 4.8, { align: "center" });
  pdf.text("NAMA BARANG", ml + colW + 5, tTop + 4.8);

  pdf.setFontSize(9);
  pdf.text(data.banyaknya || "", ml + colW / 2, tTop + tHead + 6, { align: "center" });
  pdf.setFont("helvetica", "normal");
  const barang = pdf.splitTextToSize(data.namaBarang || "", mr - ml - colW - 10) as string[];
  pdf.text(barang.slice(0, 3), ml + colW + 5, tTop + tHead + 6);

  // ---- Area tanda tangan (ruang lebar) ----
  const sTop = tTop + tHead + tBody + 7;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...BRAND);
  pdf.text("PENERIMA,", ml + 55, sTop, { align: "center" });
  pdf.text("HORMAT KAMI,", mr - 55, sTop, { align: "center" });

  const sName = sTop + 17; // ruang tanda tangan ~17mm
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "normal");
  pdf.text("(  ..................................  )", ml + 55, sName, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.text(`(  ${data.pengirim || "................."}  )`, mr - 55, sName, { align: "center" });

  // ---- Keterangan pengiriman ----
  if (has(data.keterangan)) {
    const kY = y(H - 8);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...BRAND);
    pdf.text("KETERANGAN PENGIRIMAN", ml, kY);
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(8);
    pdf.setTextColor(...INK);
    pdf.text(`"${data.keterangan}"`, ml, kY + 4.5);
  }

  // ---- Bingkai surat ----
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.rect(6, y(4), W - 12, H - 8, "D");
}

/** Membuat PDF A4 lanskap satu halaman berisi dua surat jalan lanskap. */
export async function buildSuratJalanPdf(atas: SlipData, bawah: SlipData | null) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  drawSlip(pdf, atas, 0);
  if (bawah) drawSlip(pdf, bawah, 105);

  // garis potong di tengah
  pdf.setDrawColor(140, 150, 170);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(0, 105, 297, 105);
  pdf.setLineDashPattern([], 0);

  return pdf;
}
