"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useDb } from "@/components/providers/DbProvider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/SectionHeading";
import type { CdjEntry, CrjEntry, GlEntry } from "@/lib/calculations/journals";
import { generateJournals } from "@/lib/calculations/journals";
import {
  groupByMonthSections,
  sumMoneyFields,
} from "@/lib/calculations/journal-months";
import { exportJournalsXlsx } from "@/lib/exports/excel";
import { formatDisplayDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

type Tab = "CRJ" | "CDJ" | "GL";

function formatAmountOrDash(value: string | null | undefined): string {
  if (value == null || value === "" || value === "—") return "—";
  return value;
}

function CrjMonthSection({
  label,
  entries,
}: {
  label: string;
  entries: CrjEntry[];
}) {
  const serviceTotal = sumMoneyFields(entries.map((e) => e.serviceRevenue));
  const otherTotal = sumMoneyFields(entries.map((e) => e.otherAmount));
  const cashTotal = sumMoneyFields(entries.map((e) => e.cash));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-semibold tracking-tight">{label}</h3>
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
              {entries.map((e) => (
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
                    {formatAmountOrDash(e.otherAmount)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-primary">
                    {e.cash ? formatMoney(e.cash, "PHP") : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-outline-variant/40 bg-surface-container-low/60 font-mono text-[12px]">
                <td
                  className="px-3 py-2.5 text-right uppercase tracking-wider text-outline font-sans text-[11px] font-semibold"
                  colSpan={3}
                >
                  {label} totals
                </td>
                <td className="px-3 py-2.5 text-right font-semibold">
                  {formatMoney(serviceTotal, "PHP")}
                </td>
                <td className="px-3 py-2.5 text-center text-outline">—</td>
                <td className="px-3 py-2.5 text-right text-outline">
                  {otherTotal === "0.00" ? "—" : otherTotal}
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-primary">
                  {formatMoney(cashTotal, "PHP")}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function CdjMonthSection({
  label,
  entries,
}: {
  label: string;
  entries: CdjEntry[];
}) {
  const cashTotal = sumMoneyFields(entries.map((e) => e.cash));
  const otherTotal = sumMoneyFields(entries.map((e) => e.otherAmount));
  const paypalTotal = sumMoneyFields(entries.map((e) => e.paypalFee));
  const vgenTotal = sumMoneyFields(entries.map((e) => e.vgenPartnerFee));
  const revShareTotal = sumMoneyFields(
    entries.map((e) => e.monthlyRevenueShare),
  );
  const withdrawalsTotal = sumMoneyFields(entries.map((e) => e.withdrawals));
  const toolsTotal = sumMoneyFields(entries.map((e) => e.toolsBrush));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-semibold tracking-tight">{label}</h3>
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
              {entries.map((e) => (
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
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.cash)}
                  </td>
                  <td className="px-3 py-2">{e.otherAccount ?? "—"}</td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.otherAmount)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.paypalFee)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.vgenPartnerFee)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.monthlyRevenueShare)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.withdrawals)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {formatAmountOrDash(e.toolsBrush)}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-outline-variant/40 bg-surface-container-low/60 font-mono text-[12px]">
                <td
                  className="px-3 py-2 text-right uppercase tracking-wider text-outline font-sans text-[11px] font-semibold"
                  colSpan={3}
                >
                  {label} totals
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {cashTotal === "0.00" ? "—" : cashTotal}
                </td>
                <td className="px-3 py-2 text-outline">—</td>
                <td className="px-3 py-2 text-right">
                  {otherTotal === "0.00" ? "—" : otherTotal}
                </td>
                <td className="px-3 py-2 text-right">
                  {paypalTotal === "0.00" ? "—" : paypalTotal}
                </td>
                <td className="px-3 py-2 text-right">
                  {vgenTotal === "0.00" ? "—" : vgenTotal}
                </td>
                <td className="px-3 py-2 text-right">
                  {revShareTotal === "0.00" ? "—" : revShareTotal}
                </td>
                <td className="px-3 py-2 text-right">
                  {withdrawalsTotal === "0.00" ? "—" : withdrawalsTotal}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {toolsTotal === "0.00" ? "—" : toolsTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function GlMonthSection({
  label,
  entries,
}: {
  label: string;
  entries: GlEntry[];
}) {
  const debitTotal = sumMoneyFields(entries.map((e) => e.debit));
  const creditTotal = sumMoneyFields(entries.map((e) => e.credit));

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-[14px] font-semibold tracking-tight">{label}</h3>
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
              {entries.map((e) => (
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
              <tr className="border-t border-outline-variant/40 bg-surface-container-low/60 font-mono text-[12px]">
                <td
                  className="px-3 py-2 text-right uppercase tracking-wider text-outline font-sans text-[11px] font-semibold"
                  colSpan={4}
                >
                  {label} totals
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {debitTotal === "0.00" ? "—" : debitTotal}
                </td>
                <td className="px-3 py-2 text-right font-semibold">
                  {creditTotal === "0.00" ? "—" : creditTotal}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

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

  const crjSections = useMemo(
    () => groupByMonthSections(journals.crj),
    [journals.crj],
  );
  const cdjSections = useMemo(
    () => groupByMonthSections(journals.cdj),
    [journals.cdj],
  );
  const glSections = useMemo(
    () => groupByMonthSections(glFiltered),
    [glFiltered],
  );

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
          <div className="mt-1">
            <SectionHeading
              as="h1"
              className="text-[24px] font-bold tracking-tight"
              info="Auto-generated Cash Receipts Journal (CRJ), Cash Disbursements Journal (CDJ), and General Ledger (GL) from your recorded transactions for the selected year/quarter. Entries are grouped by month with section totals. These are derived views for bookkeeping reference — edit source transactions to change entries, not the journals themselves."
            >
              Books of Accounts
            </SectionHeading>
          </div>
          <p className="text-[12px] text-on-surface-variant mt-1">
            Generated from recorded transactions — grouped by month with
            section totals.
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
        <div className="flex flex-col gap-4">
          <SectionHeading
            className="text-[15px] font-semibold"
            info="Cash Receipts Journal lists money received — typically service revenue and related cash debit — mapped from income transactions for the selected period. Entries are grouped by calendar month with section totals. Incomplete PHP valuations appear as flags."
          >
            Cash Receipts Journal (CRJ)
          </SectionHeading>
          {crjSections.length === 0 ? (
            <Card className="px-3 py-8 text-center text-on-surface-variant border border-outline-variant/30">
              No receipts in this period.
            </Card>
          ) : (
            crjSections.map((section) => (
              <CrjMonthSection
                key={section.key}
                label={section.label}
                entries={section.entries}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "CDJ" ? (
        <div className="flex flex-col gap-4">
          <SectionHeading
            className="text-[15px] font-semibold"
            info="Cash Disbursements Journal lists money going out — expenses, platform fees, recorded revenue share, withdrawals, and tools — mapped from expense and fee records for the selected period. Entries are grouped by calendar month with section totals."
          >
            Cash Disbursements Journal (CDJ)
          </SectionHeading>
          {cdjSections.length === 0 ? (
            <Card className="px-3 py-8 text-center text-on-surface-variant border border-outline-variant/30">
              No disbursements in this period.
            </Card>
          ) : (
            cdjSections.map((section) => (
              <CdjMonthSection
                key={section.key}
                label={section.label}
                entries={section.entries}
              />
            ))
          )}
        </div>
      ) : null}

      {tab === "GL" ? (
        <div className="flex flex-col gap-4">
          <SectionHeading
            className="text-[15px] font-semibold"
            info="General Ledger posts debit and credit lines derived from the CRJ and CDJ for each account. Filter by account to review activity; amounts stay linked to the underlying transactions. Entries are grouped by calendar month with section totals."
          >
            General Ledger (GL)
          </SectionHeading>
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
          {glSections.length === 0 ? (
            <Card className="px-3 py-8 text-center text-on-surface-variant border border-outline-variant/30">
              No ledger entries in this period.
            </Card>
          ) : (
            glSections.map((section) => (
              <GlMonthSection
                key={section.key}
                label={section.label}
                entries={section.entries}
              />
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
