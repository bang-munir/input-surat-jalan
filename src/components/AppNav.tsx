import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, BarChart3, Receipt, Package, Users } from "lucide-react";

export function AppNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });

  const items = [
    { to: "/", label: "Dashboard", icon: FileText },
    { to: "/surat-jalan", label: "Surat Jalan", icon: Package },
    { to: "/laporan", label: "Laporan", icon: BarChart3 },
    { to: "/nota", label: "Nota", icon: Receipt },
    { to: "/pelanggan", label: "Master Data", icon: Users },
  ];

  const navLinks = items.map(({ to, label, icon: Icon }) => (
    <Link
      key={to}
      to={to}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] font-medium transition-colors sm:flex-row sm:flex-none sm:gap-2 sm:rounded-lg sm:px-3 sm:py-1.5 sm:text-sm ${
        path === to ? "text-ink" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-5 w-5 shrink-0 sm:h-4 sm:w-4" />
      <span className="leading-none">{label}</span>
    </Link>
  ));

  return (
    <>
      {/* Desktop: top bar */}
      <header className="no-print safe-top sticky top-0 z-30 hidden border-b border-border/70 bg-background/85 backdrop-blur sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-paper">
              <FileText className="h-4 w-4" />
            </div>
            <p className="truncate font-display text-sm font-bold tracking-[0.18em]">INPUT SURAT</p>
          </div>
          <nav className="flex shrink-0 gap-1 rounded-xl bg-paper-tint p-1">{navLinks}</nav>
        </div>
      </header>

      {/* Mobile: bottom bar */}
      <nav className="no-print safe-bottom fixed bottom-0 inset-x-0 z-40 border-t border-border/70 bg-background/90 backdrop-blur sm:hidden">
        <div className="flex items-stretch justify-around px-1 pt-1 pb-[env(safe-area-inset-bottom,0px)]">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors ${
                path === to ? "text-ink" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="leading-none">{label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </>
  );
}