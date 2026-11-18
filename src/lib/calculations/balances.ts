import type {
  CurrencyCode,
  CurrencyConversion,
  ExpenseTransaction,
  IncomeTransaction,
  OpeningBalance,
} from "@/types";
import { add, cmp, money, sub } from "@/lib/utils/money";
import {
  conversionDestinationInflow,
  conversionSourceOutflow,
} from "@/lib/calculations/currency";

export interface CurrencyBalance {
  currency: CurrencyCode;
  opening: string;
  inflows: string;
  outflows: string;
  available: string;
}

export function computeBalances(params: {
  openings: OpeningBalance[];
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  conversions: CurrencyConversion[];
}): CurrencyBalance[] {
  const map = new Map<
    CurrencyCode,
    { opening: string; inflows: string; outflows: string }
  >();

  const ensure = (c: CurrencyCode) => {
    if (!map.has(c)) {
      map.set(c, { opening: "0.00", inflows: "0.00", outflows: "0.00" });
    }
    return map.get(c)!;
  };

  for (const ob of params.openings) {
    const row = ensure(ob.currency);
    row.opening = add(row.opening, ob.amount);
  }

  for (const income of params.incomes) {
    const row = ensure(income.currency);
    // Net received already deducts provider fees — do not double-count fees.
    row.inflows = add(row.inflows, income.netReceived);
  }

  for (const expense of params.expenses) {
    if (expense.category === "internal_transfer") continue;
    const row = ensure(expense.currency);
    row.outflows = add(row.outflows, expense.amount);
  }

  for (const conv of params.conversions) {
    const src = ensure(conv.sourceCurrency);
    const dest = ensure(conv.destinationCurrency);
    const sourceOut = conversionSourceOutflow(conv);
    const destIn = conversionDestinationInflow(conv);
    src.outflows = add(src.outflows, sourceOut);
    dest.inflows = add(dest.inflows, destIn);

    // Separate fees reduce the fee currency balance
    if (conv.feeTreatment === "separate") {
      const feeRow = ensure(conv.conversionFeeCurrency);
      feeRow.outflows = add(feeRow.outflows, conv.conversionFee);
    } else if (
      conv.feeTreatment === "from_destination" &&
      conv.conversionFeeCurrency === conv.destinationCurrency
    ) {
      // destinationAmount is assumed net; fee already excluded from inflow
    } else if (
      conv.feeTreatment === "from_source" &&
      conv.conversionFeeCurrency === conv.sourceCurrency &&
      cmp(conv.conversionFee, 0) > 0
    ) {
      // sourceOutflow already includes fee via conversionSourceOutflow
    }
  }

  return Array.from(map.entries())
    .map(([currency, row]) => {
      const available = money(add(row.opening, sub(row.inflows, row.outflows)));
      return {
        currency,
        opening: money(row.opening),
        inflows: money(row.inflows),
        outflows: money(row.outflows),
        available,
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function checkConversionBalance(params: {
  openings: OpeningBalance[];
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  conversions: CurrencyConversion[];
  sourceCurrency: CurrencyCode;
  sourceAmount: string;
  conversionFee: string;
  conversionFeeCurrency: CurrencyCode;
  feeTreatment: CurrencyConversion["feeTreatment"];
  excludeConversionId?: string;
}): { sufficient: boolean; available: string; required: string } {
  const filtered = params.conversions.filter(
    (c) => c.id !== params.excludeConversionId,
  );
  const balances = computeBalances({
    openings: params.openings,
    incomes: params.incomes,
    expenses: params.expenses,
    conversions: filtered,
  });
  const row = balances.find((b) => b.currency === params.sourceCurrency);
  const available = row?.available ?? "0.00";

  let required = params.sourceAmount;
  if (
    (params.feeTreatment === "from_source" || params.feeTreatment === "separate") &&
    params.conversionFeeCurrency === params.sourceCurrency
  ) {
    required = add(params.sourceAmount, params.conversionFee);
  }

  return {
    sufficient: cmp(available, required) >= 0,
    available,
    required,
  };
}
