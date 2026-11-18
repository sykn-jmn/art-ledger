"use client";

import Link from "next/link";
import { AlertTriangle, Plus } from "lucide-react";
import { useDb } from "@/components/providers/DbProvider";
import { Badge, Button, Card } from "@/components/ui/primitives";
import { calculateAnnualTax } from "@/lib/calculations/taxes";
import { formatMoney } from "@/lib/utils/money";
import { getYear, inYearQuarter } from "@/lib/utils/dates";

export default function DashboardPage() {
  const { ready, settings, incomes, expenses, conversions } = useDb();
  const year = settings?.selectedYear ?? new Date().getFullYear();
  const quarter = settings?.selectedQuarter ?? "all";

  const scopedIncomes = incomes.filter((i) =>
    inYearQuarter(i.paymentDate, year, quarter),
  );
  const scopedExpenses = expenses.filter((e) =>
    inYearQuarter(e.paymentDate, year, quarter),
  );
  const scopedConversions = conversions.filter((c) =>
    inYearQuarter(c.conversionDate, year, quarter),
  );
  const count =
    scopedIncomes.length + scopedExpenses.length + scopedConversions.length;

  const tax = calculateAnnualTax({
    incomes: incomes.filter((i) => getYear(i.paymentDate) === year),
    taxPayments: [],
    year,
    deduction: settings?.taxDeductionAmount,
    ratePercent: settings?.taxRatePercent,
  });

  const needsReview = incomes.filter(
    (i) => i.needsReview && getYear(i.paymentDate) === year,
  );

  if (!ready) {
    return <p className="text-on-surface-variant">Loading local ledger…</p>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-on-surface-variant">
            {year}
            {quarter === "all" ? "" : ` Q${quarter}`} · enter transactions, then
            review books and tax.
          </p>
        </div>
        <Link href="/transactions/?new=income">
          <Button className="inline-flex items-center gap-1">
            <Plus size={14} /> Add Transaction
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
            Transactions
          </div>
          <div className="font-mono text-[24px] font-bold mt-1">{count}</div>
          <div className="text-[12px] text-on-surface-variant mt-1">
            In selected period
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
            Gross Income (PHP)
          </div>
          <div className="font-mono text-[24px] font-bold mt-1">
            {formatMoney(tax.grossIncome, "PHP")}
          </div>
          <div className="text-[12px] text-on-surface-variant mt-1">
            Tax year {year}
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
            Estimated Tax
          </div>
          <div className="font-mono text-[24px] font-bold mt-1 text-primary">
            {formatMoney(tax.estimatedTax, "PHP")}
          </div>
          <div className="text-[12px] text-on-surface-variant mt-1">
            8% option estimate
          </div>
        </Card>
        <Card className="p-5">
          <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
            Needs Review
          </div>
          <div className="font-mono text-[24px] font-bold mt-1 flex items-center gap-2">
            {needsReview.length}
            {needsReview.length > 0 ? (
              <AlertTriangle size={16} className="text-error" />
            ) : null}
          </div>
          <div className="text-[12px] text-on-surface-variant mt-1">
            Missing PHP valuations
          </div>
        </Card>
      </div>

      {needsReview.length > 0 ? (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-[15px]">Transactions needing review</h2>
            <Link href="/transactions/?needsReview=1" className="text-primary text-[12px]">
              Open list
            </Link>
          </div>
          <ul className="flex flex-col gap-1">
            {needsReview.slice(0, 5).map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between text-[13px] py-1 border-b border-outline-variant/20 last:border-0"
              >
                <span>
                  #{i.orderNumber} · {i.clientName}
                </span>
                <Badge tone="warn">Missing PHP valuation</Badge>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
