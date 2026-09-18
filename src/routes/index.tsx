import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  ArrowRight,
  CalendarDays,
  FilePlus2,
  FileText,
  Package,
  Receipt,
  ReceiptText,
  Truck,
  UserPlus,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { useSuratJalanRecords } from "@/lib/suratJalanStorage";
import { useNotaRecords } from "@/lib/notaStorage";

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

const INDONESIAN_MONTHS: Record<string, number> = {
  januari: 1,
  februari: 2,
  maret: 3,
  april: 4,
  mei: 5,
  juni: 6,
  juli: 7,
  agustus: 8,
  september: 9,
  oktober: 10,
  november: 11,
  desember: 12,
};

type YearMonth = { year: number; month: number };

function getJakartaYearMonth(): YearMonth {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JAKARTA_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { year, month };
}

function parseCalendarYearMonth(value: string): YearMonth | null {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return null;

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})(?:-\d{2})?/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    return month >= 1 && month <= 12 ? { year, month } : null;
  }

  const localizedMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (localizedMatch) {
    const [, , monthName, yearText] = localizedMatch;
    const month = INDONESIAN_MONTHS[(monthName ?? "").toLowerCase()];
    const year = Number(yearText);
    if (month !== undefined) return { year, month };
  }

  return null;
}

function formatRupiah(n: number): string {
  return "Rp " + n.toLocaleString("id-ID");
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard - INPUT SURAT" },
      { name: "description", content: "Dashboard aplikasi INPUT SURAT" },
    ],
  }),
  component: DashboardPage,
});

function MetricCard({
  label,
  value,
  valueSuffix,
  description,
  iconBg,
  iconColor,
  icon: Icon,
  valueClassName = "text-[22px] sm:text-[28px]",
}: {
  label: string;
  value: string;
  valueSuffix?: string;
  description: string;
  iconBg: string;
  iconColor: string;
  icon: LucideIcon;
  valueClassName?: string;
}) {
  return (
    <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
      <div className="flex items-center justify-between">
        <span className="text-[13px] sm:text-sm font-medium text-[#5a4138]">{label}</span>
        <div
          className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${iconBg} flex items-center justify-center`}
        >
          <Icon className={`h-[18px] w-[18px] sm:h-5 sm:w-5 ${iconColor}`} />
        </div>
      </div>
      <div className="mt-2 sm:mt-3 space-y-1">
        <div className={`${valueClassName} font-bold text-[#0b1c30] tracking-tight leading-none`}>
          {value}
          {valueSuffix && (
            <span className="text-[14px] sm:text-base font-normal text-[#5a4138] ml-1">
              {valueSuffix}
            </span>
          )}
        </div>
        <div className="text-[12px] sm:text-[13px] text-[#5a4138] truncate">{description}</div>
      </div>
    </div>
  );
}

function QuickAction({
  to,
  label,
  subtitle,
  icon: Icon,
  variant = "secondary",
}: {
  to: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  variant?: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <Link
      to={to}
      className={`w-full min-h-[50px] sm:min-h-[56px] p-3 sm:p-3.5 rounded-xl shadow-sm flex items-center gap-2.5 text-left transition-all hover:-translate-y-0.5 active:scale-[0.98] ${
        isPrimary
          ? "bg-[#a33900] text-white hover:bg-[#8a3000]"
          : "bg-white text-[#0b1c30] hover:bg-gray-50"
      }`}
    >
      <div
        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isPrimary ? "bg-white/15" : "bg-[#e5eeff]"
        }`}
      >
        <Icon
          className={`h-5 w-5 sm:h-[22px] sm:w-[22px] ${isPrimary ? "text-white" : "text-[#a33900]"}`}
        />
      </div>
      <div className="min-w-0">
        <div
          className={`text-[14px] sm:text-[15px] font-bold leading-tight truncate ${isPrimary ? "text-white" : ""}`}
        >
          {label}
        </div>
        <div
          className={`text-[12px] sm:text-[13px] truncate ${isPrimary ? "text-white/80" : "text-[#5a4138]"}`}
        >
          {subtitle}
        </div>
      </div>
    </Link>
  );
}

function ActivityItem({
  docNumber,
  companyName,
  icon: Icon,
  iconBg,
  iconColor,
}: {
  docNumber: string;
  companyName: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
}) {
  return (
    <div className="p-3 rounded-lg bg-white hover:bg-gray-50 transition-colors flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-lg ${iconBg} flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div className="min-w-0">
          <div className="font-mono text-[13px] font-semibold text-[#0b1c30] truncate">
            {docNumber}
          </div>
          <div className="text-[13px] text-[#0b1c30] font-medium truncate">{companyName}</div>
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { records: sjRecords } = useSuratJalanRecords();
  const { records: notaRecords } = useNotaRecords();

  const totalSj = sjRecords.length;
  const totalNota = notaRecords.length;
  const totalBarang = notaRecords.reduce(
    (sum, r) => sum + r.items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0),
    0,
  );
  const totalRpNota = notaRecords.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  const { year: currentYear, month: currentMonth } = getJakartaYearMonth();
  const periodeLabel = new Intl.DateTimeFormat("id-ID", {
    timeZone: JAKARTA_TIME_ZONE,
    month: "long",
    year: "numeric",
  }).format(new Date());

  const monthNotaRecords = useMemo(
    () =>
      notaRecords.filter((r) => {
        const transaction = parseCalendarYearMonth(r.tanggal);
        return (
          transaction !== null &&
          transaction.year === currentYear &&
          transaction.month === currentMonth
        );
      }),
    [notaRecords, currentYear, currentMonth],
  );
  const monthNotaCount = monthNotaRecords.length;
  const monthBarang = monthNotaRecords.reduce(
    (sum, r) => sum + r.items.reduce((s, i) => s + (parseInt(i.quantity) || 0), 0),
    0,
  );
  const monthRpNota = monthNotaRecords.reduce((sum, r) => sum + (Number(r.total) || 0), 0);

  const recentActivity = [
    ...sjRecords.map((r) => ({
      key: `sj-${r.id}`,
      docNumber: r.nomor,
      companyName: r.kepada,
      createdAt: r.createdAt,
      icon: FileText,
      iconBg: "bg-[#ffdbca]",
      iconColor: "text-[#a33900]",
    })),
    ...notaRecords.map((r) => ({
      key: `nt-${r.id}`,
      docNumber: r.nomor,
      companyName: r.penerima,
      createdAt: r.createdAt,
      icon: Receipt,
      iconBg: "bg-[#dae2fd]",
      iconColor: "text-[#565e74]",
    })),
  ]
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-[#f8f9ff] font-sans pb-20 sm:pb-0">
      <AppNav />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8 space-y-5 sm:space-y-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-[#0b1c30] sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-[13px] sm:text-sm text-[#5a4138]">
            Ringkasan surat jalan, nota, dan master data
          </p>
        </header>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total Surat Jalan"
            value={totalSj.toLocaleString("id-ID") || "0"}
            description="Dokumen dibuat"
            iconBg="bg-[#ffdbca]"
            iconColor="text-[#a33900]"
            icon={FileText}
          />
          <MetricCard
            label="Total Nota"
            value={totalNota.toLocaleString("id-ID") || "0"}
            description="Nota tercatat"
            iconBg="bg-[#dce9ff]"
            iconColor="text-[#565e74]"
            icon={ReceiptText}
          />
          <MetricCard
            label="Total Barang"
            value={totalBarang.toLocaleString("id-ID") || "0"}
            valueSuffix="Pcs"
            description="Muatan terkirim"
            iconBg="bg-[#dae2fd]"
            iconColor="text-[#565e74]"
            icon={Package}
          />
          <MetricCard
            label="Total Rp Nota"
            value={formatRupiah(totalRpNota)}
            description="Nilai seluruh nota"
            iconBg="bg-[#dce9ff]"
            iconColor="text-[#565e74]"
            icon={Users}
            valueClassName="whitespace-nowrap text-[clamp(14px,4.4vw,22px)] sm:text-[28px]"
          />
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <h2 className="text-[14px] sm:text-[15px] font-bold text-[#0b1c30] tracking-tight flex items-center gap-1.5">
              <Zap className="h-[18px] w-[18px] shrink-0 text-[#a33900] sm:h-5 sm:w-5" />
              Aksi Cepat
            </h2>
            <span className="text-[12px] sm:text-[13px] text-[#5a4138]">Prioritas Input</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            <QuickAction
              to="/surat-jalan"
              label="Surat Jalan"
              subtitle="Buat Faktur/SJ Baru"
              icon={FilePlus2}
              variant="primary"
            />
            <QuickAction
              to="/nota"
              label="Buat Nota"
              subtitle="Tagihan & Tanda Terima"
              icon={Receipt}
            />
            <QuickAction
              to="/pelanggan"
              label="Pelanggan"
              subtitle="Kelola data pelanggan"
              icon={UserPlus}
            />
            <QuickAction
              to="/pelanggan"
              label="Pengirim"
              subtitle="Kelola data pengirim"
              icon={Truck}
            />
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#0b1c30] tracking-tight flex items-center gap-1.5">
                <CalendarDays className="h-[18px] w-[18px] shrink-0 text-[#a33900] sm:h-5 sm:w-5" />
                Laporan Bulan Ini
              </h2>
              <p className="text-[12px] sm:text-[13px] text-[#5a4138]">Periode {periodeLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
            <MetricCard
              label="Total Nota Bulan Ini"
              value={monthNotaCount.toLocaleString("id-ID") || "0"}
              description="Nota bulan berjalan"
              iconBg="bg-[#dce9ff]"
              iconColor="text-[#565e74]"
              icon={ReceiptText}
            />
            <MetricCard
              label="Total Barang Bulan Ini"
              value={monthBarang.toLocaleString("id-ID") || "0"}
              valueSuffix="Pcs"
              description="Muatan bulan berjalan"
              iconBg="bg-[#dae2fd]"
              iconColor="text-[#565e74]"
              icon={Package}
            />
            <MetricCard
              label="Total Rp Nota Bulan Ini"
              value={formatRupiah(monthRpNota)}
              description="Nilai nota bulan berjalan"
              iconBg="bg-[#ffdbca]"
              iconColor="text-[#a33900]"
              icon={Wallet}
            />
            {monthNotaCount === 0 && (
              <div className="rounded-xl bg-white p-4 text-center text-[13px] text-[#5a4138] shadow-sm sm:col-span-3">
                Belum ada transaksi pada bulan ini.
              </div>
            )}
          </div>
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <div>
              <h2 className="text-[14px] sm:text-[15px] font-bold text-[#0b1c30] tracking-tight">
                Aktivitas Dokumen Terbaru
              </h2>
              <p className="text-[12px] sm:text-[13px] text-[#5a4138]">
                Surat jalan dan nota yang baru dibuat
              </p>
            </div>
            <Link
              to="/laporan"
              className="text-[13px] font-semibold text-[#a33900] hover:underline flex items-center gap-0.5 py-1"
            >
              Lihat Semua
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-xl shadow-sm overflow-hidden p-1.5 sm:p-2 bg-[#f0f4ff] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-1.5">
            {recentActivity.length > 0 ? (
              recentActivity.map((item) => (
                <ActivityItem
                  key={item.key}
                  docNumber={item.docNumber}
                  companyName={item.companyName}
                  icon={item.icon}
                  iconBg={item.iconBg}
                  iconColor={item.iconColor}
                />
              ))
            ) : (
              <div className="sm:col-span-2 p-4 rounded-lg bg-white text-center text-[13px] text-[#5a4138]">
                Belum ada dokumen tercatat.
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
