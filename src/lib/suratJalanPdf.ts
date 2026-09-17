import type { jsPDF } from "jspdf";

export type SlipItem = {
  quantity: string;
  name: string;
  description: string;
};

export type SlipData = {
  nomor: string;
  tanggal: string; // sudah diformat, mis. "15 September 2026"
  pengirim: string;
  teleponPengirim: string;
  alamatPengirim: string;
  kepada: string;
  telepon: string;
  alamat: string;
  items: SlipItem[];
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
 * Menggambar satu surat jalan A5 lanskap (210mm x 148.5mm) pada posisi offsetY.
 * Semua teks digambar sebagai teks vektor agar tajam saat dicetak.
 */
export function drawSlip(pdf: jsPDF, data: SlipData, offsetY: number) {
  const W = 210;
  const H = 148.5;
  const ml = 10;
  const mr = W - 5;
  const topPad = 4;
  const y = (v: number) => offsetY + topPad + v;

  pdf.setTextColor(...INK);

  // Bingkai identitas seperti desain acuan.
  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.28);
  pdf.rect(3, y(5), W - 6, H - 10, "D");

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("SURAT JALAN", 19, y(15));

  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND);
  pdf.text(`N O  :   ${data.nomor || "-"}`, 21, y(21));
  pdf.setTextColor(...INK);

  const pengirimRows = rows([
    { label: "Nama Pengirim", value: data.pengirim },
    { label: "No. Telp", value: data.teleponPengirim },
    { label: "Alamat", value: data.alamatPengirim },
  ]);

  const penerimaRows = rows([
    { label: "Kepada", value: data.kepada },
    { label: "No. Telp", value: data.telepon },
    { label: "Alamat", value: data.alamat },
  ]);

  const rx = 145;
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "normal");

  const lineStep = (pdf.getFontSize() * pdf.getLineHeightFactor()) / pdf.internal.scaleFactor;

  const plan = (list: FieldRow[], startY: number, wrapWidth: number) => {
    let rowY = startY;
    const planned = list.map((r) => {
      const lines = pdf.splitTextToSize(r.value, wrapWidth) as string[];
      const row = { label: r.label, lines, baseline: rowY };
      rowY += 4.5 + (lines.length - 1) * 2.5;
      return row;
    });
    const last = planned[planned.length - 1];
    const bottom = last ? last.baseline + (last.lines.length - 1) * lineStep : startY;
    return { planned, bottom };
  };

  const pengirim = plan(pengirimRows, y(28), 40);
  const penerima = plan(penerimaRows, y(12), mr - (rx + 24));

  for (const r of pengirim.planned) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, ml, r.baseline);
    pdf.text(":", ml + 24, r.baseline);
    pdf.setFont("helvetica", "bold");
    pdf.text(r.lines, ml + 27, r.baseline);
    pdf.setDrawColor(...LINE);
    pdf.setLineWidth(0.12);
    pdf.line(ml + 27, r.baseline + 1.4, ml + 67, r.baseline + 1.4);
  }

  const cx = 90;
  pdf.setFontSize(7);
  if (has(data.tanggal)) {
    pdf.setFont("helvetica", "normal");
    pdf.text("Tanggal", cx, y(13));
    pdf.text(":", cx + 20, y(13));
    pdf.setFont("helvetica", "bold");
    pdf.text(data.tanggal, cx + 24, y(13));
    pdf.setDrawColor(...LINE);
    pdf.line(cx + 24, y(14.4), cx + 44, y(14.4));
  }

  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.2);
  pdf.line(rx - 7, y(9), rx - 7, Math.max(y(35), penerima.bottom));

  for (const r of penerima.planned) {
    pdf.setFont("helvetica", "normal");
    pdf.text(r.label, rx, r.baseline);
    pdf.text(":", rx + 20, r.baseline);
    pdf.setFont("helvetica", "bold");
    pdf.text(r.lines, rx + 24, r.baseline);
    if (r.label !== "Alamat") {
      pdf.setDrawColor(...LINE);
      pdf.line(rx + 24, r.baseline + 1.4, mr, r.baseline + 1.4);
    }
  }

  const shift = Math.max(0, Math.max(pengirim.bottom, penerima.bottom) + 0.7 - y(39));
  const headBottom = y(39) + shift;
  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.3);
  pdf.line(ml, headBottom, mr, headBottom);

  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(7);
  pdf.text("Kami kirimkan barang-barang tersebut di bawah ini:", ml, headBottom + 5);

  const safeItems =
    data.items.length > 0 ? data.items : [{ quantity: "", name: "", description: "" }];
  const tTop = y(47) + shift;
  const tHead = 7;
  const rowH = 9;
  const tBody = safeItems.length * rowH;
  const colW = 42;

  pdf.setDrawColor(...BRAND);
  pdf.setLineWidth(0.25);
  pdf.setFillColor(238, 243, 249);
  pdf.rect(ml, tTop, mr - ml, tHead, "FD");
  pdf.rect(ml, tTop + tHead, mr - ml, tBody, "D");
  pdf.line(ml + colW, tTop, ml + colW, tTop + tHead + tBody);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...INK);
  pdf.text("BANYAKNYA", ml + colW / 2, tTop + 4.8, { align: "center" });
  pdf.text("NAMA BARANG", ml + colW + 5, tTop + 4.8);

  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    const rowY = tTop + tHead + i * rowH;
    if (i > 0) {
      pdf.setDrawColor(...LINE);
      pdf.setLineWidth(0.15);
      pdf.line(ml, rowY, mr, rowY);
    }
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text(item.quantity || "", ml + colW / 2, rowY + 5, { align: "center" });
    pdf.setFont("helvetica", "normal");
    const barangLines = pdf.splitTextToSize(item.name || "", mr - ml - colW - 10) as string[];
    pdf.text(barangLines.slice(0, 2), ml + colW + 5, rowY + 4);
    if (has(item.description)) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(6.5);
      const descLines = pdf.splitTextToSize(item.description, mr - ml - colW - 10) as string[];
      pdf.text(descLines.slice(0, 1), ml + colW + 5, rowY + 7.5);
    }
  }

  const sTop = y(100) + shift;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(...BRAND);
  pdf.text("PENERIMA,", ml + 50, sTop, { align: "center" });
  pdf.text("HORMAT KAMI,", mr - 50, sTop, { align: "center" });

  const sName = y(112) + shift;
  pdf.setTextColor(...INK);
  pdf.setFont("helvetica", "normal");
  pdf.text("(  ..................................  )", ml + 50, sName, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.text(`(  ${data.pengirim || "................."}  )`, mr - 50, sName, { align: "center" });

  pdf.setDrawColor(...LINE);
  pdf.setLineWidth(0.2);
  pdf.line(ml, y(118) + shift, mr, y(118) + shift);

  const itemsWithDesc = safeItems.filter((item) => has(item.description));
  if (itemsWithDesc.length > 0) {
    const kY = y(122) + shift;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(6);
    pdf.setTextColor(...BRAND);
    pdf.text("KETERANGAN PENGIRIMAN", ml, kY);
    let descY = kY + 3.5;
    for (const item of itemsWithDesc) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(...INK);
      const itemName = item.name || "-";
      pdf.text(itemName, ml, descY);
      pdf.setFont("helvetica", "bolditalic");
      pdf.setFontSize(7.5);
      pdf.text(' "' + item.description + '"', ml + pdf.getTextWidth(itemName) + 1, descY);
      descY += 4;
    }
  }
}

/** Membuat PDF A4 potret satu halaman berisi dua surat jalan A5 lanskap. */
export async function buildSuratJalanPdf(atas: SlipData, bawah: SlipData | null) {
  const { jsPDF: JsPDF } = await import("jspdf");
  const pdf = new JsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  drawSlip(pdf, atas, 0);
  if (bawah) drawSlip(pdf, bawah, 148.5);

  pdf.setProperties({
    title: `Surat Jalan ${atas.nomor || ""}`.trim(),
    subject: "Surat Jalan A4 potret, dua lembar A5 lanskap",
    creator: "Generator Surat Jalan",
  });

  // garis potong di tengah (antara A5 atas dan A5 bawah)
  pdf.setDrawColor(140, 150, 170);
  pdf.setLineWidth(0.2);
  pdf.setLineDashPattern([2, 2], 0);
  pdf.line(0, 148.5, 210, 148.5);
  pdf.setLineDashPattern([], 0);

  return pdf;
}
