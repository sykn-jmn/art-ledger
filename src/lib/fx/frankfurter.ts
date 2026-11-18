import type { CurrencyCode } from "@/types";
import { money } from "@/lib/utils/money";

const FRANKFURTER_BASE = "https://api.frankfurter.dev/v1";

export interface FrankfurterLatestRate {
  rate: string;
  rateDate: string; // YYYY-MM-DD from API
}

/**
 * Suggest the latest PHP exchange rate from Frankfurter (ECB).
 * Suggestion only — the user provides the final rate for bulk valuation.
 */
export async function fetchLatestPhpRate(params: {
  fromCurrency: CurrencyCode;
  fetchImpl?: typeof fetch;
}): Promise<FrankfurterLatestRate> {
  const { fromCurrency } = params;
  const fetchFn = params.fetchImpl ?? fetch;

  if (fromCurrency === "PHP") {
    return { rate: "1.000000", rateDate: new Date().toISOString().slice(0, 10) };
  }

  const url = `${FRANKFURTER_BASE}/latest?amount=1&from=${encodeURIComponent(fromCurrency)}&to=PHP`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(
      `Could not fetch suggested ${fromCurrency}→PHP rate (${res.status}).`,
    );
  }

  const data = (await res.json()) as {
    date: string;
    rates: Record<string, number>;
  };

  const rawRate = data.rates?.PHP;
  if (rawRate == null || Number.isNaN(Number(rawRate))) {
    throw new Error(
      `Frankfurter did not return a PHP rate for ${fromCurrency}.`,
    );
  }

  return {
    rate: money(rawRate, 6),
    rateDate: data.date,
  };
}
