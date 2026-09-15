export type PanelData = {
  nomor: string;
  tanggal: string;
  kepada: string;
  alamat: string;
  telepon: string;
  banyaknya: string;
  namaBarang: string;
  keterangan: string;
  pengirim: string;
  teleponPengirim: string;
  alamatPengirim: string;
};

function has(v?: string) {
  return Boolean(v && v.trim());
}

function Row({
  label,
  value,
  labelWidth = "24mm",
  bold,
}: {
  label: string;
  value: string;
  labelWidth?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start gap-1 text-[7.5pt] leading-[1.35]">
      <span className="shrink-0 whitespace-nowrap" style={{ width: labelWidth }}>
        {label}
      </span>
      <span className="shrink-0">:</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`whitespace-pre-line ${bold ? "font-bold" : ""}`}>{value}</span>
      </span>
    </div>
  );
}

/** Satu surat jalan lanskap (297mm x 105mm). */
export function SuratJalanPanel({ data }: { data: PanelData }) {
  return (
    <div className="relative flex h-full flex-col border border-brand px-[7.5mm] py-[4.5mm] text-ink">
      <div className="grid grid-cols-[1.15fr_0.9fr_1.05fr] gap-[6mm]">
        {/* Kiri: judul + pengirim */}
        <div className="min-w-0">
          <div className="flex items-center gap-[3mm]">
            <span className="flex gap-[1mm]" aria-hidden="true">
              <span className="block h-[5mm] w-[2.5mm] skew-x-[-28deg] bg-chart-1" />
              <span className="block h-[5mm] w-[2.5mm] skew-x-[-28deg] bg-ink" />
            </span>
            <h2 className="font-display text-[18pt] font-bold leading-none">SURAT JALAN</h2>
          </div>
          <p className="ml-[14mm] mt-[1mm] text-[7.5pt] font-bold tracking-[0.22em] text-brand">
            NO : {data.nomor || "-"}
          </p>
          <div className="mt-[4mm] space-y-[1.2mm]">
            {has(data.pengirim) && (
              <Row label="Nama Pengirim" value={data.pengirim} bold />
            )}
            {has(data.teleponPengirim) && (
              <Row label="No. Telp" value={data.teleponPengirim} bold />
            )}
            {has(data.alamatPengirim) && (
              <Row label="Alamat" value={data.alamatPengirim} />
            )}
          </div>
        </div>

        {/* Tengah: tanggal */}
        <div className="min-w-0 pt-[2mm]">
          {has(data.tanggal) && <Row label="Tanggal" value={data.tanggal} labelWidth="18mm" bold />}
        </div>

        {/* Kanan: penerima */}
        <div className="min-w-0 space-y-[1.2mm] border-l border-brand/50 pl-[6mm] pt-[2mm]">
          {has(data.kepada) && <Row label="Kepada" value={data.kepada} labelWidth="18mm" bold />}
          {has(data.telepon) && <Row label="No. Telp" value={data.telepon} labelWidth="18mm" bold />}
          {has(data.alamat) && <Row label="Alamat" value={data.alamat} labelWidth="18mm" />}
        </div>
      </div>

      <div className="mt-[3mm] border-t border-brand/45 pt-[2mm]">
        <p className="text-[7.5pt] italic">Kami kirimkan barang-barang tersebut di bawah ini:</p>
      </div>

      <table className="mt-[1.2mm] w-full table-fixed border-collapse text-[7.5pt]">
        <thead>
          <tr>
            <th className="w-[48mm] border border-brand bg-brand-soft px-[3mm] py-[1.5mm] text-center text-[7pt] font-bold tracking-[0.14em]">
              BANYAKNYA
            </th>
            <th className="border border-brand bg-brand-soft px-[3mm] py-[1.5mm] text-left text-[7pt] font-bold tracking-[0.14em]">
              NAMA BARANG
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="h-[15mm] border border-brand px-[3mm] py-[2.5mm] text-center align-top font-bold">
              {data.banyaknya}
            </td>
            <td className="border border-brand px-[3mm] py-[1.5mm] align-top">
              {data.namaBarang}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[4mm] grid grid-cols-2 text-center text-[6.5pt]">
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">PENERIMA,</p>
          <p className="mt-[10mm] text-[7.5pt]">(&nbsp;..................................&nbsp;)</p>
        </div>
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">HORMAT KAMI,</p>
          <p className="mt-[10mm] text-[7.5pt] font-bold">
            ( {data.pengirim || "................."} )
          </p>
        </div>
      </div>

      {has(data.keterangan) && (
        <div className="mt-auto border-t border-brand/35 pt-[1mm]">
          <p className="text-[6.5pt] font-bold tracking-[0.16em] text-brand">
            KETERANGAN PENGIRIMAN
          </p>
          <p className="text-[8pt] font-bold italic">"{data.keterangan}"</p>
        </div>
      )}
    </div>
  );
}
