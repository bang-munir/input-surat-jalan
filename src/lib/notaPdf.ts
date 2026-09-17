import type { jsPDF } from "jspdf";
import type { NotaRecord } from "./notaStorage";

const INK = [26, 42, 74] as [number, number, number];
const BRAND = [47, 82, 143] as [number, number, number];
const LINE = [150, 165, 190] as [number, number, number];
const LIGHT_BG = [238, 243, 249] as [number, number, number];
const RED = [180, 50, 50] as [number, number, number];

function has(v?: string) {
  return Boolean(v && v.trim());
}

function formatRp(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

/** A5 Landscape: 210 × 148.5 mm */
const PW = 210;
const PH = 148.5;
const ML = 10;
const MR = PW - 10;
const CW = MR - ML;

const COL_NO = 8;
const COL_KET = 30;
const COL_QTY = 16;
const COL_HRG = 26;
const COL_TOT = 28;
const COL_NAMA = CW - COL_NO - COL_KET - COL_QTY - COL_HRG - COL_TOT;

const ROW_H = 7;
const TABLE_HEAD_H = 7;

function drawNotaContent(pdf: jsPDF, data: NotaRecord) {
  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.25);
  pdf.rect(4, 4, PW - 8, PH - 8, "D");

  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.text("NOTA", PW / 2, 16, { align: "center" });

  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND);
  pdf.text(`N O   :   ${data.nomor || ""}`, ML + 2, 24);

  if (has(data.tanggal)) {
    pdf.text(`Tanggal  :  ${data.tanggal}`, ML + 2, 29);
  }

  if (has(data.suratJalanNomor)) {
    pdf.text(`Ref. Surat Jalan : ${data.suratJalanNomor}`, MR - 2, 24, { align: "right" });
  }

  pdf.setTextColor(...INK);
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.12);
  pdf.line(ML, 33, MR, 33);

  let ly = 39;
  pdf.setFontSize(8);

  if (has(data.pengirim)) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Pengirim", ML + 2, ly);
    pdf.text(":", ML + 18, ly);
    pdf.setFont("helvetica", "bold");
    const lines = pdf.splitTextToSize(data.pengirim, 70) as string[];
    pdf.text(lines.slice(0, 2), ML + 21, ly);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.1);
    pdf.line(ML + 21, ly + 1.2, ML + 90, ly + 1.2);
    ly += 4 + Math.min(lines.length - 1, 1) * 2.5;
  }

  if (has(data.penerima)) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Kepada", ML + 2, ly);
    pdf.text(":", ML + 18, ly);
    pdf.setFont("helvetica", "bold");
    const lines = pdf.splitTextToSize(data.penerima, 70) as string[];
    pdf.text(lines.slice(0, 2), ML + 21, ly);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.1);
    pdf.line(ML + 21, ly + 1.2, ML + 90, ly + 1.2);
    ly += 4 + Math.min(lines.length - 1, 1) * 2.5;
  }

  const headBottom = ly + 2;
  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.25);
  pdf.line(ML, headBottom, MR, headBottom);

  const safeItems = data.items.length > 0 ? data.items : [];
  const tTop = headBottom + 3;
  const tBody = Math.max(safeItems.length, 1) * ROW_H;

  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.2);
  pdf.setFillColor(...LIGHT_BG);
  pdf.rect(ML, tTop, CW, TABLE_HEAD_H, "FD");
  pdf.rect(ML, tTop + TABLE_HEAD_H, CW, tBody, "D");

  let cx = ML;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...INK);
  pdf.text("No", cx + COL_NO / 2, tTop + 5, { align: "center" });
  cx += COL_NO;
  pdf.text("Deskripsi Barang", cx + 2, tTop + 5);
  cx += COL_NAMA;
  pdf.text("Keterangan", cx + 2, tTop + 5);
  cx += COL_KET;
  pdf.text("Qty", cx + COL_QTY / 2, tTop + 5, { align: "center" });
  cx += COL_QTY;
  pdf.text("Harga", cx + COL_HRG - 2, tTop + 5, { align: "right" });
  cx += COL_HRG;
  pdf.text("Total", cx + COL_TOT - 2, tTop + 5, { align: "right" });

  const vLineX = [
    ML + COL_NO,
    ML + COL_NO + COL_NAMA,
    ML + COL_NO + COL_NAMA + COL_KET,
    ML + COL_NO + COL_NAMA + COL_KET + COL_QTY,
    ML + COL_NO + COL_NAMA + COL_KET + COL_QTY + COL_HRG,
  ];
  for (const vx of vLineX) {
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.12);
    pdf.line(vx, tTop, vx, tTop + TABLE_HEAD_H + tBody);
  }

  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    const rowY = tTop + TABLE_HEAD_H + i * ROW_H;

    if (i > 0) {
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.1);
      pdf.line(ML, rowY, MR, rowY);
    }

    pdf.setTextColor(...INK);
    let rcx = ML;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(String(i + 1), rcx + COL_NO / 2, rowY + 5, { align: "center" });
    rcx += COL_NO;

    const namaMaxW = COL_NAMA - 4;
    const nameLines = pdf.splitTextToSize(item.name || "", namaMaxW) as string[];
    pdf.setFont("helvetica", "bold");
    pdf.text(nameLines.slice(0, 2), rcx + 2, rowY + 4);
    rcx += COL_NAMA;

    if (has(item.description)) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(6.5);
      const ketLines = pdf.splitTextToSize(item.description, COL_KET - 4) as string[];
      pdf.text(ketLines.slice(0, 2), rcx + 2, rowY + 4);
    }
    rcx += COL_KET;

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.text(item.quantity || "", rcx + COL_QTY / 2, rowY + 5, { align: "center" });
    rcx += COL_QTY;

    pdf.text(formatRp(item.price), rcx + COL_HRG - 2, rowY + 5, { align: "right" });
    rcx += COL_HRG;

    pdf.setFont("helvetica", "bold");
    pdf.text(formatRp(item.total), rcx + COL_TOT - 2, rowY + 5, { align: "right" });
  }

  const tableBottom = tTop + TABLE_HEAD_H + tBody;
  let fY = tableBottom + 4;

  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.2);
  pdf.line(ML, fY, MR, fY);

  const col1 = MR - 70;
  const col2 = MR - 2;

  fY += 5;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...INK);
  pdf.text("Subtotal", col1, fY);
  pdf.text(formatRp(data.subtotal), col2, fY, { align: "right" });

  if (data.potong > 0) {
    fY += 5;
    pdf.setTextColor(...RED);
    pdf.text("Potong / DP", col1, fY);
    pdf.text(formatRp(data.potong), col2, fY, { align: "right" });
  }

  fY += 2;
  pdf.setTextColor(...INK);
  pdf.setDrawColor(...INK);
  pdf.setLineWidth(0.18);
  pdf.line(col1 - 5, fY, MR, fY);

  fY += 5;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.text("TOTAL", col1, fY);
  pdf.text(formatRp(data.total), col2, fY, { align: "right" });

  const sTop = fY + 12;
  const leftCx = ML + 38;
  const rightCx = MR - 38;

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND);
  pdf.text("PENERIMA,", leftCx, sTop, { align: "center" });
  pdf.text("HORMAT KAMI,", rightCx, sTop, { align: "center" });

  const sName = sTop + 14;
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  pdf.text("(  ......................................  )", leftCx, sName, {
    align: "center",
  });
  pdf.setFont("helvetica", "bold");
  pdf.text(`(  ${data.pengirim || ".............................."}  )`, rightCx, sName, {
    align: "center",
  });
}

/** PDF A5 Landscape: 210 × 148.5 mm */
export async function buildNotaPdfA5(data: NotaRecord) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [PW, PH],
    compress: true,
  });

  drawNotaContent(pdf, data);

  pdf.setProperties({
    title: `Nota ${data.nomor || ""}`.trim(),
    subject: "Nota Penjualan A5 Landscape",
    creator: "Generator Nota",
  });

  return pdf;
}

/** PDF A4 Portrait: 210 × 297 mm, satu Nota A5 Landscape (210×148.5) di bagian atas. */
export async function buildNotaPdfA4(data: NotaRecord) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  drawNotaContent(pdf, data);

  pdf.setProperties({
    title: `Nota ${data.nomor || ""}`.trim(),
    subject: "Nota Penjualan A4 Portrait",
    creator: "Generator Nota",
  });

  return pdf;
}
