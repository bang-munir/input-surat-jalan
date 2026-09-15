import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Users } from "lucide-react";

export function AppNav() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/", label: "Generator", icon: FileText },
    { to: "/pelanggan", label: "Master Data", icon: Users },
  ];

  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 sm:flex sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-paper">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-bold tracking-[0.18em]">SURAT JALAN</p>
            <p className="truncate text-xs text-muted-foreground">A4 Lanskap · 2 x A5</p>
          </div>
        </div>
        <nav className="flex shrink-0 gap-1 rounded-xl bg-paper-tint p-1">
          {items.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                path === to
                  ? "bg-ink text-paper"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
