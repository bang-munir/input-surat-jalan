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
  const ml = 11;
  const mr = W - 7;
  const y = (v: number) => offsetY + v;

  pdf.setTextColor(...INK);

  // Bingkai dan aksen identitas seperti desain acuan.
  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.28);
  pdf.rect(4, y(3), W - 8, H - 6, "D");
  pdf.setFillColor(242, 125, 35);
  pdf.triangle(8, y(8), 12, y(8), 8.5, y(13.5), "F");
  pdf.setFillColor(...INK);
  pdf.triangle(13, y(8), 17, y(8), 13.5, y(13.5), "F");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(20);
  pdf.text("SURAT JALAN", 20, y(13));

  pdf.setFontSize(8.5);
  pdf.setTextColor(...BRAND);
  pdf.text(`N O  :   ${data.nomor || "-"}`, 22, y(19));
  pdf.setTextColor(...INK);

  const pengirimRows = rows([
    { label: "Nama Pengirim", value: data.pengirim },
    { label: "No. Telp", value: data.teleponPengirim },
    { label: "Alamat", value: data.alamatPengirim },
  ]);

  let py = y(27);
  pdf.setFontSize(7.5);
  for (const r of pengirimRows) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, ml, py);
    pdf.text(":", ml + 26, py);
    const lines = pdf.splitTextToSize(r.value, 55) as string[];
    pdf.setFont("helvetica", "bold");
    pdf.text(lines.slice(0, 2), ml + 29, py);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.12);
    pdf.line(ml + 29, py + 1.4, ml + 84, py + 1.4);
    py += 5 + Math.min(lines.length - 1, 1) * 3;
  }

  const cx = 118;
  pdf.setFontSize(7.5);
  if (has(data.tanggal)) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Tanggal", cx, y(11));
    pdf.text(":", cx + 23, y(11));
    pdf.setFont("helvetica", "bold");
    pdf.text(data.tanggal, cx + 27, y(11));
    pdf.setDrawColor(...LINE);
    pdf.line(cx + 27, y(12.4), cx + 70, y(12.4));
  }

  const rx = 202;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.2);
  pdf.line(rx - 9, y(7), rx - 9, y(34));

  const penerimaRows = rows([
    { label: "Kepada", value: data.kepada },
    { label: "No. Telp", value: data.telepon },
    { label: "Alamat", value: data.alamat },
  ]);

  let ry = y(10);
  for (const r of penerimaRows) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, rx, ry);
    pdf.text(":", rx + 22, ry);
    const lines = pdf.splitTextToSize(r.value, mr - (rx + 26)) as string[];
    pdf.setFont("helvetica", "bold");
    pdf.text(lines.slice(0, 3), rx + 26, ry);
    if (r.label !== "Alamat") {
      pdf.setDrawColor(...LINE);
      pdf.line(rx + 26, ry + 1.4, mr, ry + 1.4);
    }
    ry += 5 + Math.min(lines.length - 1, 2) * 3;
  }

  const headBottom = y(39);
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(ml, headBottom, mr, headBottom);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7.3);
  pdf.text("Kami kirimkan barang-barang tersebut di bawah ini:", ml, y(44));

  const tTop = y(47);
  const tHead = 7;
  const tBody = 16;
  const colW = 52;

  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.25);
  pdf.setFillColor(238, 243, 249);
  pdf.rect(ml, tTop, mr - ml, tHead, "FD");
  pdf.rect(ml, tTop + tHead, mr - ml, tBody, "D");
  pdf.line(ml + colW, tTop, ml + colW, tTop + tHead + tBody);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.2);
  pdf.setTextColor(...INK);
  pdf.text("BANYAKNYA", ml + colW / 2, tTop + 4.8, { align: "center" });
  pdf.text("NAMA BARANG", ml + colW + 5, tTop + 4.8);

  pdf.setFontSize(8.5);
  pdf.text(data.banyaknya || "", ml + colW / 2, tTop + tHead + 7, { align: "center" });
  pdf.setFont("helvetica", "normal");
  const barang = pdf.splitTextToSize(data.namaBarang || "", mr - ml - colW - 10) as string[];
  pdf.text(barang.slice(0, 3), ml + colW + 5, tTop + tHead + 6);

  const sTop = y(75);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(...BRAND);
  pdf.text("PENERIMA,", ml + 55, sTop, { align: "center" });
  pdf.text("HORMAT KAMI,", mr - 55, sTop, { align: "center" });

  const sName = y(88);
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "normal");
  pdf.text("(  ..................................  )", ml + 55, sName, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.text(`(  ${data.pengirim || "................."}  )`, mr - 55, sName, { align: "center" });

  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.2);
  pdf.line(ml, y(92), mr, y(92));

  if (has(data.keterangan)) {
    const kY = y(96);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...BRAND);
    pdf.text("KETERANGAN PENGIRIMAN", ml, kY);
    pdf.setFont("helvetica", "bolditalic");
    pdf.setFontSize(8);
    pdf.setTextColor(...INK);
    pdf.text(`"${data.keterangan}"`, ml, kY + 3.5);
  }

  // Aksen penutup kanan bawah.
  pdf.setFillColor(...INK);
  pdf.triangle(mr - 10, y(94), mr - 4, y(94), mr - 9, y(101), "F");
  pdf.setFillColor(135, 169, 211);
  pdf.triangle(mr - 4, y(94), mr + 2, y(94), mr - 3, y(101), "F");
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

  pdf.setProperties({
    title: `Surat Jalan ${atas.nomor || ""}`.trim(),
    subject: "Surat Jalan A4 landscape, dua lembar",
    creator: "Generator Surat Jalan",
  });

  // garis potong di tengah
  pdf.setDrawColor(140, 150, 170);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(0, 105, 297, 105);
  pdf.setLineDashPattern([], 0);

  return pdf;
}
