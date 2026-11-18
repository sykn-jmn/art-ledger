import type { CurrencyCode } from "@/types";
import { money, mul } from "@/lib/utils/money";

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

export interface FrankfurterRateResult {
  rate: string;
  rateDate: string; // YYYY-MM-DD from API
  fetchedAt: Date;
  phpAmount: string;
  sourceLabel: string;
}

function formatExchangeSourceLabel(when: Date): string {
  const formatted = when.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `Based on Exchange Rate on ${formatted}`;
}

/**
 * Fetch PHP exchange rate from Frankfurter (ECB) for a payment date.
 * Weekends/holidays resolve to the previous available business day.
 */
export async function fetchPhpRateFromFrankfurter(params: {
  fromCurrency: CurrencyCode;
  amount: string;
  onDate: string; // YYYY-MM-DD
  fetchImpl?: typeof fetch;
}): Promise<FrankfurterRateResult> {
  const { fromCurrency, amount, onDate } = params;
  const fetchFn = params.fetchImpl ?? fetch;

  if (fromCurrency === "PHP") {
    const fetchedAt = new Date();
    return {
      rate: "1.000000",
      rateDate: onDate,
      fetchedAt,
      phpAmount: money(amount),
      sourceLabel: formatExchangeSourceLabel(fetchedAt),
    };
  }

  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const pathDate = onDate > todayIso ? "latest" : onDate;
  const url = `${FRANKFURTER_BASE}/${pathDate}?amount=1&from=${encodeURIComponent(fromCurrency)}&to=PHP`;

  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(
      `Could not fetch ${fromCurrency}→PHP rate (${res.status}). Enter PHP tax valuation manually.`,
    );
  }

  const data = (await res.json()) as {
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
  };

  const rawRate = data.rates?.PHP;
  if (rawRate == null || Number.isNaN(Number(rawRate))) {
    throw new Error(
      `Frankfurter did not return a PHP rate for ${fromCurrency}. Enter PHP tax valuation manually.`,
    );
  }

  const fetchedAt = new Date();
  const rate = money(rawRate, 6);
  return {
    rate,
    rateDate: data.date,
    fetchedAt,
    phpAmount: money(mul(amount, rate)),
    sourceLabel: formatExchangeSourceLabel(fetchedAt),
  };
}

export { formatExchangeSourceLabel };
