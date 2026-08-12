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

function DottedValue({ value }: { value: string }) {
  return (
    <span className="flex min-w-0 flex-1 items-end gap-1">
      <span className="whitespace-pre-line font-semibold leading-snug">{value || "\u00A0"}</span>
      <span className="mb-[1px] min-w-4 flex-1 border-b border-dotted border-ink/60" />
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-[9pt]">
      <span className="w-[22mm] shrink-0">{label}</span>
      <span className="shrink-0">:</span>
      <DottedValue value={value} />
    </div>
  );
}

export function SuratJalanPanel({ data }: { data: PanelData }) {
  return (
    <div className="flex h-full flex-col justify-between px-[10mm] py-[9mm] text-ink">
      <div>
        <div className="text-center">
          <h2 className="font-display text-[22pt] font-bold tracking-[0.18em] leading-none">
            SURAT JALAN
          </h2>
          <p className="mt-[2mm] text-[8pt] tracking-[0.3em]">NO : {data.nomor || "-"}</p>
        </div>

        <div className="mt-[6mm] flex justify-end">
          <div className="w-[70mm] space-y-[1.5mm]">
            <Row label="Tanggal" value={data.tanggal} />
            <Row label="Kepada" value={data.kepada} />
            <Row label="No. Telp" value={data.telepon} />
            <Row label="Alamat" value={data.alamat} />
          </div>
        </div>

        <p className="mt-[5mm] text-[8.5pt] italic">
          Kami kirimkan barang-barang tersebut di bawah ini:
        </p>

        <table className="mt-[2mm] w-full border-collapse text-[9pt]">
          <thead>
            <tr>
              <th className="w-[30mm] border border-ink bg-paper-tint px-2 py-[1.5mm] text-[8pt] font-semibold tracking-wider">
                BANYAKNYA
              </th>
              <th className="border border-ink bg-paper-tint px-2 py-[1.5mm] text-[8pt] font-semibold tracking-wider">
                NAMA BARANG
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="h-[28mm] border border-ink px-2 py-[1.5mm] text-center align-top font-semibold">
                {data.banyaknya}
              </td>
              <td className="border border-ink px-2 py-[1.5mm] align-top font-semibold">
                {data.namaBarang}
              </td>
            </tr>
          </tbody>
        </table>

        {data.keterangan ? (
          <div className="mt-[3mm] text-[8pt]">
            <p className="tracking-[0.15em] text-brand">KETERANGAN PENGIRIMAN</p>
            <p className="italic font-semibold">&ldquo;{data.keterangan}&rdquo;</p>
          </div>
        ) : null}
      </div>

      <div className="mt-[4mm] flex items-end justify-between text-[8.5pt]">
        <div className="w-[45mm]">
          <p className="text-brand">PENERIMA,</p>
          <p className="mt-[14mm] border-b border-dotted border-ink/60" />
          <p className="mt-[1mm]">(&nbsp;.................................&nbsp;)</p>
        </div>
        <div className="w-[55mm] text-right">
          <p className="text-brand">HORMAT KAMI,</p>
          <div className="mt-[3mm] space-y-[1mm] text-left">
            <Row label="Nama Pengirim" value={data.pengirim} />
            <Row label="No. Telp" value={data.teleponPengirim} />
          </div>
          <p className="mt-[3mm] font-semibold">( {data.pengirim || "..........."} )</p>
        </div>
      </div>
    </div>
  );
}
