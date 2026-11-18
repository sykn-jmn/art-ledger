"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { useDb } from "@/components/providers/DbProvider";
import { Button, Card, Field, Input, Select } from "@/components/ui/primitives";
import { SectionHeading } from "@/components/ui/SectionHeading";
import {
  calculateAnnualTax,
  calculateMonthlyIncome,
  calculateQuarterlyTax,
  formatPhp,
} from "@/lib/calculations/taxes";
import { calculateRevenueShare } from "@/lib/calculations/revenue-share";
import { exportTaxSummaryXlsx } from "@/lib/exports/excel";
import { createTaxPayment, deleteTaxPayment } from "@/db/transactions";
import { todayISO } from "@/lib/utils/dates";

export default function TaxSummaryPage() {
  const { ready, settings, incomes, expenses, taxPayments } = useDb();
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payPeriod, setPayPeriod] = useState<"Q1" | "Q2" | "Q3" | "Q4" | "annual">(
    "Q1",
  );

  const year = settings?.selectedYear ?? new Date().getFullYear();
  const percent = settings?.revenueSharePercent ?? "10";
  const deduction = settings?.taxDeductionAmount ?? "250000";
  const rate = settings?.taxRatePercent ?? "8";

  const annual = useMemo(
    () =>
      calculateAnnualTax({
        incomes,
        taxPayments,
        year,
        deduction,
        ratePercent: rate,
      }),
    [incomes, taxPayments, year, deduction, rate],
  );

  const monthly = useMemo(
    () =>
      calculateMonthlyIncome({
        incomes,
        year,
        revenueSharePercent: percent,
      }),
    [incomes, year, percent],
  );

  const quarterly = useMemo(
    () =>
      calculateQuarterlyTax({
        incomes,
        taxPayments,
        year,
        deduction,
        ratePercent: rate,
      }),
    [incomes, taxPayments, year, deduction, rate],
  );

  const revenueShare = useMemo(
    () =>
      calculateRevenueShare({
        incomes,
        expenses,
        year,
        percent,
      }),
    [incomes, expenses, year, percent],
  );

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex flex-col gap-1">
          <SectionHeading
            as="h1"
            className="text-[24px] font-bold tracking-tight"
            info="Planning view of gross income, taxable income, estimated tax, payments, monthly income, quarterly progress, and revenue-share tracking for the selected year. Figures use your Settings assumptions and are not an official BIR return."
          >
            Tax Summary
          </SectionHeading>
          <p className="text-[13px] text-on-surface-variant">
            Your income and estimated tax for the selected year. Not an official
            BIR return.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            className="inline-flex items-center gap-1"
            onClick={() =>
              exportTaxSummaryXlsx({
                year,
                annual,
                monthly,
                quarterly,
                revenueShare,
              })
            }
          >
            <Download size={14} /> Export
          </Button>
          <Button
            variant="secondary"
            className="inline-flex items-center gap-1"
            onClick={() => window.print()}
          >
            <Printer size={14} /> Print
          </Button>
        </div>
      </div>

      {annual.incomplete ? (
        <div className="rounded bg-error-container/50 px-3 py-2 text-[12px] text-error">
          Estimates incomplete: {annual.missingValuationCount} foreign income
          transaction(s) missing PHP tax valuation.{" "}
          <Link href="/transactions/?needsReview=1" className="underline font-medium">
            Review transactions
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {(
          [
            ["Gross Income", annual.grossIncome, `${year} year-to-date`],
            [
              "Taxable Income",
              annual.taxableIncome,
              `After ₱${Number(deduction).toLocaleString()} deduction`,
            ],
            ["Estimated Tax", annual.estimatedTax, `Calculated at ${rate}%`],
            [
              "Remaining Tax",
              annual.remainingTax,
              `After ${formatPhp(annual.taxPaid)} recorded payments`,
            ],
          ] as const
        ).map(([label, value, hint]) => (
          <Card key={label} className="p-5">
            <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
              {label}
            </div>
            <div
              className={`font-mono text-[24px] font-bold tracking-tight mt-1 ${
                label.includes("Tax") ? "text-primary" : ""
              }`}
            >
              {formatPhp(value)}
            </div>
            <div className="text-[12px] text-on-surface-variant mt-1">{hint}</div>
          </Card>
        ))}
      </div>

      <div className="p-2 rounded bg-surface-container-low text-center font-mono text-[12px] text-on-surface-variant">
        (Gross Income − ₱{Number(deduction).toLocaleString()}) × {rate}% =
        Estimated Tax
      </div>

      <Card className="overflow-hidden no-print">
        <button
          type="button"
          className="w-full px-5 py-3 flex items-center justify-between hover:bg-surface-container-low/40 text-left"
          onClick={() => setShowBreakdown((v) => !v)}
        >
          <span className="font-semibold text-[15px]">How is my tax calculated?</span>
          <span className="text-primary text-[12px]">
            {showBreakdown ? "Hide" : "Show breakdown"}
          </span>
        </button>
        {showBreakdown ? (
          <div className="px-5 pb-5 max-w-md font-mono text-[12px] space-y-1">
            <div className="flex justify-between">
              <span>Gross Income</span>
              <span>{formatPhp(annual.grossIncome)}</span>
            </div>
            <div className="flex justify-between text-secondary">
              <span>Less: deduction</span>
              <span>−{formatPhp(deduction)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Taxable Income</span>
              <span>{formatPhp(annual.taxableIncome)}</span>
            </div>
            <div className="flex justify-between text-primary">
              <span>Estimated Tax</span>
              <span>{formatPhp(annual.estimatedTax)}</span>
            </div>
          </div>
        ) : null}
      </Card>

      <section className="flex flex-col gap-2">
        <SectionHeading info="Month-by-month gross income in PHP for the selected tax year, plus the calculated revenue-share amount from your settings percentage. Foreign income without a PHP valuation is marked incomplete and can understate totals.">
          Monthly Income
        </SectionHeading>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase text-outline">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Gross Income</th>
                  <th className="px-4 py-2 text-right">Calculated Revenue Share</th>
                </tr>
              </thead>
              <tbody>
                {monthly.map((m) => (
                  <tr
                    key={m.monthIndex}
                    className="border-t border-outline-variant/20 font-mono text-[12px]"
                  >
                    <td className="px-4 py-2 font-sans">
                      {m.monthName}
                      {m.hasMissingValuation ? (
                        <span className="ml-2 text-error text-[10px]">incomplete</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(m.grossIncomePhp)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(m.calculatedShare)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading info="Groups income into Q1–Q4 and tracks cumulative estimated tax against payments you have recorded for each quarter. Use Remaining to see how much estimated tax is still unpaid for planning purposes.">
          Quarterly Tax Summary
        </SectionHeading>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase text-outline">
                  <th className="px-4 py-2">Quarter</th>
                  <th className="px-4 py-2 text-right">Gross Income</th>
                  <th className="px-4 py-2 text-right">Cumulative Income</th>
                  <th className="px-4 py-2 text-right">Cumulative Est. Tax</th>
                  <th className="px-4 py-2 text-right">Tax Paid</th>
                  <th className="px-4 py-2 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {quarterly.map((q) => (
                  <tr
                    key={q.quarter}
                    className="border-t border-outline-variant/20 font-mono text-[12px]"
                  >
                    <td className="px-4 py-2 font-sans">Q{q.quarter}</td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(q.grossIncome)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(q.cumulativeIncome)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(q.cumulativeEstimatedTax)}
                    </td>
                    <td className="px-4 py-2 text-right">{formatPhp(q.taxPaid)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-primary">
                      {formatPhp(q.remainingEstimatedTax)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="flex flex-col gap-2 no-print">
        <SectionHeading info="Log BIR tax payments you have already made for a quarter or the annual return. Recorded amounts reduce Remaining Tax on the summary cards and appear in the quarterly table. This does not file anything with the BIR.">
          Record Tax Payment
        </SectionHeading>
        <Card className="p-4 flex flex-wrap gap-3 items-end">
          <Field label="Period">
            <Select
              value={payPeriod}
              onChange={(e) =>
                setPayPeriod(e.target.value as typeof payPeriod)
              }
            >
              <option value="Q1">Q1</option>
              <option value="Q2">Q2</option>
              <option value="Q3">Q3</option>
              <option value="Q4">Q4</option>
              <option value="annual">Annual</option>
            </Select>
          </Field>
          <Field label="Amount (PHP)">
            <Input
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Button
            onClick={async () => {
              if (!payAmount) return;
              await createTaxPayment({
                taxYear: year,
                period: payPeriod,
                paymentDate: todayISO(),
                amountPaid: payAmount,
                reference: null,
              });
              setPayAmount("");
            }}
          >
            Add payment
          </Button>
        </Card>
        <ul className="text-[12px] space-y-1">
          {taxPayments
            .filter((p) => p.taxYear === year)
            .map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between bg-surface-container-low rounded px-3 py-2"
              >
                <span>
                  {p.period} · {formatPhp(p.amountPaid)} · {p.paymentDate}
                </span>
                <button
                  type="button"
                  className="text-error"
                  onClick={() => deleteTaxPayment(p.id)}
                >
                  Remove
                </button>
              </li>
            ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionHeading info={`Compares the calculated ${percent}% partner share of each month’s gross income against revenue-share expenses you actually recorded. Calculated share is informational only — it does not create a payment or change balances. Only recorded revenue-share expenses affect Currency Balances and the Cash Disbursements Journal.`}>
          Revenue Sharing ({percent}%)
        </SectionHeading>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[700px]">
              <thead>
                <tr className="bg-surface-container-low text-[11px] uppercase text-outline">
                  <th className="px-4 py-2">Month</th>
                  <th className="px-4 py-2 text-right">Monthly Gross</th>
                  <th className="px-4 py-2 text-right">Calculated Share</th>
                  <th className="px-4 py-2 text-right">Actual Paid</th>
                  <th className="px-4 py-2 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {revenueShare.map((r) => (
                  <tr
                    key={r.monthIndex}
                    className="border-t border-outline-variant/20 font-mono text-[12px]"
                  >
                    <td className="px-4 py-2 font-sans">{r.monthName}</td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(r.monthlyGross)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(r.calculatedShare)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(r.actualPaid)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {formatPhp(r.outstanding)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}
