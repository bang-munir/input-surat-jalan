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
    <div className="flex items-start gap-1 text-[8pt] leading-[1.4]">
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
    <div className="flex h-full flex-col px-[12mm] py-[7mm] text-ink">
      <div className="grid grid-cols-[1fr_0.9fr_1fr] gap-[6mm]">
        {/* Kiri: judul + pengirim */}
        <div className="min-w-0">
          <h2 className="font-display text-[19pt] font-bold leading-none tracking-tight">
            SURAT JALAN
          </h2>
          <p className="mt-[1.5mm] text-[8pt] tracking-[0.18em] text-brand">
            NO : {data.nomor || "-"}
          </p>
          <div className="mt-[5mm] space-y-[1.5mm]">
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
        <div className="min-w-0 space-y-[1.5mm] border-l border-border pl-[6mm] pt-[2mm]">
          {has(data.kepada) && <Row label="Kepada" value={data.kepada} labelWidth="18mm" bold />}
          {has(data.telepon) && <Row label="No. Telp" value={data.telepon} labelWidth="18mm" bold />}
          {has(data.alamat) && <Row label="Alamat" value={data.alamat} labelWidth="18mm" />}
        </div>
      </div>

      <div className="mt-[4mm] border-t border-ink/25 pt-[2.5mm]">
        <p className="text-[7.5pt] italic">Kami kirimkan barang-barang tersebut di bawah ini:</p>
      </div>

      <table className="mt-[1.5mm] w-full table-fixed border-collapse text-[8pt]">
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
            <td className="h-[13mm] border border-brand px-[3mm] py-[1.5mm] text-center align-top font-bold">
              {data.banyaknya}
            </td>
            <td className="border border-brand px-[3mm] py-[1.5mm] align-top">
              {data.namaBarang}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[6mm] grid grid-cols-2 text-center text-[7pt]">
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">PENERIMA,</p>
          <p className="mt-[15mm] text-[8pt]">(&nbsp;..................................&nbsp;)</p>
        </div>
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">HORMAT KAMI,</p>
          <p className="mt-[15mm] text-[8pt] font-bold">
            ( {data.pengirim || "................."} )
          </p>
        </div>
      </div>

      {has(data.keterangan) && (
        <div className="mt-auto">
          <p className="text-[6.5pt] font-bold tracking-[0.16em] text-brand">
            KETERANGAN PENGIRIMAN
          </p>
          <p className="text-[8pt] font-bold italic">"{data.keterangan}"</p>
        </div>
      )}
    </div>
  );
}
