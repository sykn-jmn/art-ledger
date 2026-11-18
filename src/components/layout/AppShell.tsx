"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Calculator,
  Grid2x2,
  Menu,
  Receipt,
  Settings,
  Wallet,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useDb } from "@/components/providers/DbProvider";
import { Button, Select } from "@/components/ui/primitives";
import { saveSettings } from "@/db/transactions";

const NAV = [
  { href: "/", label: "Dashboard", icon: Grid2x2 },
  { href: "/transactions/", label: "Transactions", icon: Receipt },
  { href: "/currency-balances/", label: "Currency Balances", icon: Wallet },
  { href: "/books-of-accounts/", label: "Books of Accounts", icon: BookOpen },
  { href: "/tax-summary/", label: "Tax Summary", icon: Calculator },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { settings, ready } = useDb();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname?.startsWith(href.replace(/\/$/, "")) ?? false;
  };

  const year = settings?.selectedYear ?? new Date().getFullYear();
  const quarter = settings?.selectedQuarter ?? "all";

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 h-14 z-50 bg-surface-container-lowest/95 backdrop-blur flex items-center justify-between px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded hover:bg-surface-container"
          >
            <Menu size={18} />
          </button>
          <span className="font-semibold tracking-tight">ArtLedger</span>
          <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-[10px] font-semibold text-primary">
            PH
          </span>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 h-full w-60 bg-surface-container-lowest z-50 flex flex-col justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-transform lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col">
          <div className="h-14 px-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-semibold tracking-tight text-[15px]">
                ArtLedger
              </span>
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high font-mono text-[10px] font-semibold text-primary">
                PH
              </span>
            </div>
            <button
              type="button"
              className="lg:hidden p-1 rounded hover:bg-surface-container"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-6 pt-3 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
              Workspace
            </span>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded transition-colors text-[13px] ${
                    active
                      ? "bg-surface-container text-primary font-semibold"
                      : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                  }`}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="px-6 pt-5 pb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-outline">
              System
            </span>
          </div>
          <nav className="flex flex-col gap-0.5 px-3">
            <Link
              href="/settings/"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2 rounded transition-colors text-[13px] ${
                isActive("/settings/")
                  ? "bg-surface-container text-primary font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              }`}
            >
              <Settings size={18} />
              <span>Settings</span>
            </Link>
          </nav>
        </div>

        <div className="p-3 m-3 rounded bg-surface-container-low">
          <div className="flex items-center justify-between pb-1">
            <span className="text-[11px] font-semibold text-on-surface">
              Local browser storage
            </span>
            <span className="h-2 w-2 rounded-full bg-secondary" />
          </div>
          <p className="font-mono text-[11px] text-on-surface-variant">
            8% self-employed estimate
          </p>
          <p className="font-mono text-[10px] text-outline mt-0.5">
            Data stays on this device
          </p>
        </div>
      </aside>

      {mobileOpen ? (
        <button
          type="button"
          className="lg:hidden fixed inset-0 z-40 bg-inverse-surface/40"
          aria-label="Close overlay"
          onClick={() => setMobileOpen(false)}
        />
      ) : null}

      <div className="lg:pl-60">
        <header className="fixed top-14 lg:top-0 left-0 lg:left-60 right-0 h-14 bg-surface-container-lowest/90 backdrop-blur-xl z-40 px-4 lg:px-6 flex items-center justify-between shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
          <div className="hidden md:flex items-center gap-2 text-outline text-[12px]">
            <span>Freelance bookkeeping</span>
            <span>·</span>
            <span className="text-on-surface-variant">Quarterly workflow</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex items-center gap-1.5">
              <Select
                aria-label="Tax year"
                value={year}
                disabled={!ready || !settings}
                onChange={async (e) => {
                  await saveSettings({
                    selectedYear: Number(e.target.value),
                  });
                }}
                className="h-8 w-[5.5rem]"
              >
                {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - 4 + i).map(
                  (y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ),
                )}
              </Select>
              <Select
                aria-label="Quarter"
                value={String(quarter)}
                disabled={!ready || !settings}
                onChange={async (e) => {
                  const v = e.target.value;
                  await saveSettings({
                    selectedQuarter:
                      v === "all" ? "all" : (Number(v) as 1 | 2 | 3 | 4),
                  });
                }}
                className="h-8 w-[5.5rem]"
              >
                <option value="all">All</option>
                <option value="1">Q1</option>
                <option value="2">Q2</option>
                <option value="3">Q3</option>
                <option value="4">Q4</option>
              </Select>
            </div>
            <Link href="/transactions/?new=income">
              <Button className="h-8 flex items-center gap-1">
                Record Entry
              </Button>
            </Link>
          </div>
        </header>

        <main className="w-full pt-28 lg:pt-14 bg-surface min-h-screen">
          <div className="px-4 lg:px-6 py-5 max-w-[1560px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
