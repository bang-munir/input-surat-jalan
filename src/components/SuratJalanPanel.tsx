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
};

function Row({
  label,
  value,
  labelWidth = "22mm",
  bold,
}: {
  label: string;
  value: string;
  labelWidth?: string;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start gap-1 text-[7.5pt] leading-[1.45]">
      <span className="shrink-0 whitespace-nowrap" style={{ width: labelWidth }}>
        {label}
      </span>
      <span className="shrink-0">:</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={`whitespace-pre-line ${bold ? "font-bold" : ""}`}>
          {value || "\u00A0"}
        </span>
        <span className="mt-[0.3mm] w-full border-b border-dotted border-ink/50" />
      </span>
    </div>
  );
}

export function SuratJalanPanel({ data }: { data: PanelData }) {
  return (
    <div className="flex h-full flex-col px-[11mm] py-[10mm] text-ink">
      <div className="text-center">
        <h2 className="inline-block border-b-[1.5px] border-ink pb-[1mm] font-display text-[17pt] font-bold tracking-[0.14em] leading-none">
          SURAT JALAN
        </h2>
        <p className="mt-[1.5mm] text-[6.5pt] tracking-[0.28em]">NO : {data.nomor || "-"}</p>
      </div>

      <div className="mt-[7mm] grid grid-cols-2 gap-x-[8mm] items-start">
        <div className="space-y-[2mm]">
          <Row label="Nama Pengirim" value={data.pengirim} />
          <Row label="No. Telp" value={data.teleponPengirim} />
        </div>
        <div className="space-y-[2mm]">
          <Row label="Tanggal" value={data.tanggal} labelWidth="16mm" />
          <Row label="Kepada" value={data.kepada} labelWidth="16mm" bold />
          <Row label="No. Telp" value={data.telepon} labelWidth="16mm" />
          <Row label="Alamat" value={data.alamat} labelWidth="16mm" />
        </div>
      </div>

      <p className="mt-[6mm] text-[6.5pt] italic">
        Kami kirimkan barang-barang tersebut di bawah ini:
      </p>

      <table className="mt-[1.5mm] w-full table-fixed border-collapse text-[7.5pt]">
        <thead>
          <tr>
            <th className="w-[32mm] border border-ink px-[3mm] py-[1.8mm] text-center text-[6.5pt] font-semibold tracking-[0.12em]">
              BANYAKNYA
            </th>
            <th className="border border-ink px-[3mm] py-[1.8mm] text-left text-[6.5pt] font-semibold tracking-[0.12em]">
              NAMA BARANG
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="h-[38mm] border border-ink px-[3mm] py-[2mm] text-center align-top font-bold">
              {data.banyaknya}
            </td>
            <td className="border border-ink px-[3mm] py-[2mm] align-top">{data.namaBarang}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-[10mm] grid grid-cols-2 text-center text-[6.5pt]">
        <div>
          <p className="tracking-[0.12em] text-brand">PENERIMA,</p>
          <p className="mt-[16mm]">(&nbsp;.................................................&nbsp;)</p>
        </div>
        <div>
          <p className="tracking-[0.12em] text-brand">HORMAT KAMI,</p>
          <p className="mt-[16mm] font-bold">( {data.pengirim || "................."} )</p>
        </div>
      </div>

      <div className="mt-auto border-t border-dotted border-ink/40 pt-[2mm]">
        <p className="text-[6pt] tracking-[0.18em] text-brand">KETERANGAN PENGIRIMAN</p>
        <p className="text-[6.5pt] font-semibold italic">
          {data.keterangan ? `"${data.keterangan}"` : "\u00A0"}
        </p>
      </div>
    </div>
  );
}
