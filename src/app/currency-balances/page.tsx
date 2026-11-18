"use client";

import { useMemo } from "react";
import { useDb } from "@/components/providers/DbProvider";
import { Card } from "@/components/ui/primitives";
import { computeBalances } from "@/lib/calculations/balances";
import { formatDisplayDate } from "@/lib/utils/dates";
import { formatMoney } from "@/lib/utils/money";

export default function CurrencyBalancesPage() {
  const { ready, incomes, expenses, conversions, openingBalances } = useDb();

  const balances = useMemo(
    () =>
      computeBalances({
        openings: openingBalances,
        incomes,
        expenses,
        conversions,
      }),
    [openingBalances, incomes, expenses, conversions],
  );

  if (!ready) return <p>Loading…</p>;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-tight">Currency Balances</h1>
        <p className="text-[13px] text-on-surface-variant">
          Derived from opening balances, net income, disbursements, and conversions.
          Provider fees already deducted from income are not double-counted.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {balances.length === 0 ? (
          <Card className="p-5 text-on-surface-variant">
            No balances yet. Record opening balances or transactions.
          </Card>
        ) : (
          balances.map((b) => (
            <Card key={b.currency} className="p-5">
              <div className="text-[11px] uppercase tracking-wider text-outline font-semibold">
                {b.currency}
              </div>
              <div className="font-mono text-[28px] font-bold mt-1">
                {formatMoney(b.available, b.currency)}
              </div>
              <dl className="mt-3 space-y-1 text-[12px] font-mono text-on-surface-variant">
                <div className="flex justify-between">
                  <dt>Opening</dt>
                  <dd>{formatMoney(b.opening, b.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Inflows</dt>
                  <dd>{formatMoney(b.inflows, b.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Outflows</dt>
                  <dd>{formatMoney(b.outflows, b.currency)}</dd>
                </div>
              </dl>
            </Card>
          ))
        )}
      </div>

      <section>
        <h2 className="text-[18px] font-semibold mb-2">Conversion history</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low text-[11px] uppercase text-outline">
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">From</th>
                <th className="px-4 py-2">To</th>
                <th className="px-4 py-2 text-right">Rate</th>
                <th className="px-4 py-2 text-right">Fee</th>
              </tr>
            </thead>
            <tbody>
              {conversions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-on-surface-variant"
                  >
                    No conversions recorded.
                  </td>
                </tr>
              ) : (
                conversions.map((c) => (
                  <tr
                    key={c.id}
                    className="border-t border-outline-variant/20 font-mono text-[12px]"
                  >
                    <td className="px-4 py-2">
                      {formatDisplayDate(c.conversionDate)}
                    </td>
                    <td className="px-4 py-2">
                      {formatMoney(c.sourceAmount, c.sourceCurrency)}
                    </td>
                    <td className="px-4 py-2">
                      {formatMoney(c.destinationAmount, c.destinationCurrency)}
                    </td>
                    <td className="px-4 py-2 text-right">{c.exchangeRate}</td>
                    <td className="px-4 py-2 text-right">
                      {formatMoney(c.conversionFee, c.conversionFeeCurrency)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
