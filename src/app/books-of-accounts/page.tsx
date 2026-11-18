"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useDb } from "@/components/providers/DbProvider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { generateJournals } from "@/lib/calculations/journals";
import { exportJournalsXlsx } from "@/lib/exports/excel";
import { formatDisplayDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

type Tab = "CRJ" | "CDJ" | "GL";

export default function BooksOfAccountsPage() {
  const { ready, settings, incomes, expenses, conversions, fees } = useDb();
  const [tab, setTab] = useState<Tab>("CRJ");
  const [glAccount, setGlAccount] = useState<string>("all");
  const [exportOpen, setExportOpen] = useState(false);

  const year = settings?.selectedYear ?? new Date().getFullYear();
  const quarter = settings?.selectedQuarter ?? "all";

  const journals = useMemo(
    () =>
      generateJournals({
        incomes,
        expenses,
        conversions,
        fees,
        year,
        quarter,
      }),
    [incomes, expenses, conversions, fees, year, quarter],
  );

  const glFiltered =
    glAccount === "all"
      ? journals.gl
      : journals.gl.filter((e) => e.account === glAccount);

  const glAccounts = Array.from(new Set(journals.gl.map((e) => e.account))).sort();

  const doExport = async (sheets: ("CRJ" | "CDJ" | "GL")[]) => {
    await exportJournalsXlsx({
      crj: journals.crj,
      cdj: journals.cdj,
      gl: journals.gl,
      year,
      quarter: String(quarter),
      sheets,
    });
    setExportOpen(false);
  };

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="flex flex-col gap-4 print:gap-2">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 no-print">
        <div>
          <div className="text-[11px] uppercase tracking-wider text-outline">
            Workspace · Financial Registry
          </div>
          <h1 className="text-[24px] font-bold tracking-tight mt-1">
            Books of Accounts
          </h1>
          <p className="text-[12px] text-on-surface-variant">
            Generated from recorded transactions — not separately editable copies.
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <div className="relative">
            <Button
              variant="secondary"
              className="inline-flex items-center gap-1"
              onClick={() => setExportOpen((v) => !v)}
            >
              <Download size={14} /> Export Excel
            </Button>
            {exportOpen ? (
              <div className="absolute right-0 mt-1 w-44 bg-surface-container-lowest rounded shadow-lg border border-outline-variant/30 py-1 z-20">
                {(
                  [
                    ["CRJ", ["CRJ"]],
                    ["CDJ", ["CDJ"]],
                    ["GL", ["GL"]],
                    ["All worksheets", ["CRJ", "CDJ", "GL"]],
                  ] as const
                ).map(([label, sheets]) => (
                  <button
                    key={label}
                    type="button"
                    className="w-full text-left px-3 py-1.5 text-[12px] hover:bg-surface-container-low"
                    onClick={() => doExport([...sheets])}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <Button
            variant="secondary"
            className="inline-flex items-center gap-1"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-outline-variant/40 no-print">
        <div className="flex items-center gap-1" role="tablist">
          {(
            [
              ["CRJ", "Cash Receipts Journal (CRJ)", journals.crj.length],
              ["CDJ", "Cash Disbursements Journal (CDJ)", journals.cdj.length],
              ["GL", "General Ledger (GL)", journals.gl.length],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`flex items-center gap-2 px-3 py-2.5 text-[15px] border-b-2 transition-colors ${
                tab === key
                  ? "border-primary text-primary font-semibold"
                  : "border-transparent text-on-surface-variant"
              }`}
              onClick={() => setTab(key)}
            >
              <span>{label}</span>
              <span className="px-1.5 rounded bg-surface-container font-mono text-[11px]">
                {count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-on-surface-variant pb-2">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              journals.flags.length ? "bg-error" : "bg-emerald-500"
            }`}
          />
          <span>
            {journals.flags.length
              ? `${journals.flags.length} item(s) need mapping or PHP valuation`
              : "Mapped entries ready for selected period"}
          </span>
        </div>
      </div>

      {journals.flags.length > 0 ? (
        <div className="rounded bg-error-container/40 px-3 py-2 text-[12px] text-error no-print">
          {journals.flags.slice(0, 5).map((f) => (
            <div key={`${f.sourceId}-${f.flag}`}>{f.message}</div>
          ))}
        </div>
      ) : null}

      {tab === "CRJ" ? (
        <Card className="overflow-hidden border border-outline-variant/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[900px]">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase tracking-wider text-on-surface-variant">
                  <th className="px-3 py-2" colSpan={3}>
                    General Information
                  </th>
                  <th className="px-3 py-2 text-center" colSpan={3}>
                    Credit Accounts
                  </th>
                  <th className="px-3 py-2 text-right text-primary">Debit</th>
                </tr>
                <tr className="text-[11px] uppercase text-outline border-b border-outline-variant/30">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2">O.R. No.</th>
                  <th className="px-3 py-2 text-right">Service Revenue</th>
                  <th className="px-3 py-2 text-center">Other Account</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right text-primary">Cash</th>
                </tr>
              </thead>
              <tbody>
                {journals.crj.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-on-surface-variant">
                      No receipts in this period.
                    </td>
                  </tr>
                ) : (
                  journals.crj.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-outline-variant/15 font-mono text-[12px]"
                    >
                      <td className="px-3 py-2.5 text-outline">
                        {formatDisplayDate(e.date)}
                      </td>
                      <td className="px-3 py-2.5 font-sans text-[13px]">
                        {e.particulars}
                        {e.flags.length ? (
                          <Badge tone="warn">{e.flags[0]}</Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone="primary">#{e.orNumber}</Badge>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {e.serviceRevenue
                          ? formatMoney(e.serviceRevenue, "PHP")
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-outline">
                        {e.otherAccount ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right text-outline">
                        {e.otherAmount ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-primary">
                        {e.cash ? formatMoney(e.cash, "PHP") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "CDJ" ? (
        <Card className="overflow-hidden border border-outline-variant/30">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1200px]">
              <thead>
                <tr className="text-[11px] uppercase text-outline bg-surface-container-low">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Particulars</th>
                  <th className="px-3 py-2">OR No.</th>
                  <th className="px-3 py-2 text-right">Cash</th>
                  <th className="px-3 py-2">Other Account</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">PayPal Fee</th>
                  <th className="px-3 py-2 text-right">VGen Fee</th>
                  <th className="px-3 py-2 text-right">Rev Share</th>
                  <th className="px-3 py-2 text-right">Withdrawals</th>
                  <th className="px-3 py-2 text-right">Tools</th>
                </tr>
              </thead>
              <tbody>
                {journals.cdj.map((e) => (
                  <tr
                    key={e.id}
                    className="border-t border-outline-variant/15 font-mono text-[12px]"
                  >
                    <td className="px-3 py-2">{formatDisplayDate(e.date)}</td>
                    <td className="px-3 py-2 font-sans text-[13px]">
                      {e.particulars}
                      {e.flags.length ? (
                        <Badge tone="warn">{e.flags.join(", ")}</Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">{e.orNumber ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{e.cash ?? "—"}</td>
                    <td className="px-3 py-2">{e.otherAccount ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{e.otherAmount ?? "—"}</td>
                    <td className="px-3 py-2 text-right">{e.paypalFee ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      {e.vgenPartnerFee ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.monthlyRevenueShare ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {e.withdrawals ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{e.toolsBrush ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {tab === "GL" ? (
        <div className="flex flex-col gap-3">
          <div className="no-print">
            <label className="text-[11px] uppercase text-outline mr-2">
              Account
            </label>
            <select
              className="h-8 px-2 rounded bg-surface-container-low"
              value={glAccount}
              onChange={(e) => setGlAccount(e.target.value)}
            >
              <option value="all">All accounts</option>
              {glAccounts.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <Card className="overflow-hidden border border-outline-variant/30">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[800px]">
                <thead>
                  <tr className="text-[11px] uppercase text-outline bg-surface-container-low">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Particulars</th>
                    <th className="px-3 py-2">Journal Ref</th>
                    <th className="px-3 py-2">Account</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {glFiltered.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-outline-variant/15 font-mono text-[12px]"
                    >
                      <td className="px-3 py-2">{formatDisplayDate(e.date)}</td>
                      <td className="px-3 py-2 font-sans">{e.particulars}</td>
                      <td className="px-3 py-2">{e.journalRef}</td>
                      <td className="px-3 py-2">{e.account}</td>
                      <td className="px-3 py-2 text-right">
                        {e.debit !== "0.00" ? e.debit : ""}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {e.credit !== "0.00" ? e.credit : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
