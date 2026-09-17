export type PanelItem = {
  quantity: string;
  name: string;
  description: string;
};

export type PanelData = {
  nomor: string;
  tanggal: string;
  kepada: string;
  alamat: string;
  telepon: string;
  items: PanelItem[];
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

/** Satu surat jalan A5 lanskap (210mm x 148.5mm). */
export function SuratJalanPanel({ data }: { data: PanelData }) {
  return (
    <div className="relative flex h-full flex-col border-[1.5pt] border-brand px-[7mm] py-[7mm] text-ink">
      <div className="grid grid-cols-[1.1fr_0.8fr_1.1fr] gap-[5mm]">
        {/* Kiri: judul + pengirim */}
        <div className="min-w-0">
          <div className="flex items-center gap-[2.5mm]">
            <h2 className="font-display text-[15pt] font-bold leading-none">SURAT JALAN</h2>
          </div>
          <p className="ml-[12mm] mt-[1mm] text-[7pt] font-bold tracking-[0.22em] text-brand">
            NO : {data.nomor || "-"}
          </p>
          <div className="mt-[3mm] space-y-[1mm]">
            {has(data.pengirim) && <Row label="Nama Pengirim" value={data.pengirim} bold />}
            {has(data.teleponPengirim) && (
              <Row label="No. Telp" value={data.teleponPengirim} bold />
            )}
            {has(data.alamatPengirim) && <Row label="Alamat" value={data.alamatPengirim} />}
          </div>
        </div>

        {/* Tengah: tanggal */}
        <div className="min-w-0 pt-[2mm]">
          {has(data.tanggal) && <Row label="Tanggal" value={data.tanggal} labelWidth="16mm" bold />}
        </div>

        {/* Kanan: penerima */}
        <div className="min-w-0 space-y-[1mm] border-l border-brand/50 pl-[5mm] pt-[2mm]">
          {has(data.kepada) && <Row label="Kepada" value={data.kepada} labelWidth="16mm" bold />}
          {has(data.telepon) && (
            <Row label="No. Telp" value={data.telepon} labelWidth="16mm" bold />
          )}
          {has(data.alamat) && <Row label="Alamat" value={data.alamat} labelWidth="16mm" />}
        </div>
      </div>

      <div className="mt-[2.5mm] border-t border-brand/45 pt-[1.5mm]">
        <p className="text-[7pt] italic">Kami kirimkan barang-barang tersebut di bawah ini:</p>
      </div>

      <table className="mt-[1mm] w-full table-fixed border-collapse text-[7pt]">
        <thead>
          <tr>
            <th className="w-[40mm] border border-brand bg-brand-soft px-[2.5mm] py-[1.2mm] text-center text-[6.5pt] font-bold tracking-[0.14em]">
              BANYAKNYA
            </th>
            <th className="border border-brand bg-brand-soft px-[2.5mm] py-[1.2mm] text-left text-[6.5pt] font-bold tracking-[0.14em]">
              NAMA BARANG
            </th>
          </tr>
        </thead>
        <tbody>
          {(data.items.length > 0 ? data.items : [{ quantity: "", name: "", description: "" }]).map(
            (item, i) => (
              <tr key={i}>
                <td className="h-[10mm] border border-brand px-[2.5mm] py-[2mm] text-center align-top font-bold">
                  {item.quantity}
                </td>
                <td className="border border-brand px-[2.5mm] py-[1.2mm] align-top">
                  <span>{item.name}</span>
                  {has(item.description) && (
                    <span className="block text-[6pt] italic text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </td>
              </tr>
            ),
          )}
        </tbody>
      </table>

      <div className="mt-[3mm] grid grid-cols-2 text-center text-[6pt]">
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">PENERIMA,</p>
          <p className="mt-[8mm] text-[7pt]">(&nbsp;..................................&nbsp;)</p>
        </div>
        <div>
          <p className="font-bold tracking-[0.14em] text-brand">HORMAT KAMI,</p>
          <p className="mt-[8mm] text-[7pt] font-bold">
            ( {data.pengirim || "................."} )
          </p>
        </div>
      </div>

      {data.items.some((item) => has(item.description)) && (
        <div className="mt-auto border-t border-brand/35 pt-[1mm]">
          <p className="text-[6pt] font-bold tracking-[0.16em] text-brand">KETERANGAN PENGIRIMAN</p>
          <div className="mt-[0.5mm] space-y-[0.5mm]">
            {data.items
              .filter((item) => has(item.description))
              .map((item, i) => (
                <p key={i} className="text-[6.5pt]">
                  <span className="font-bold">{item.name}</span>
                  <span className="italic"> &quot;{item.description}&quot;</span>
                </p>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
