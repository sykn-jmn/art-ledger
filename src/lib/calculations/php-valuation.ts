import type { CurrencyCode, IncomeTransaction } from "@/types";
import { money, mul } from "@/lib/utils/money";

export const MISSING_VALUATION_REVIEW_REASON =
  "Missing PHP tax-reporting valuation";

/** PHP tax valuation = gross × user-provided foreign→PHP rate. */
export function calculatePhpValuationFromRate(params: {
  grossAmount: string;
  rate: string;
}): { phpTaxValuation: string; phpValuationRate: string } {
  const phpValuationRate = money(params.rate, 6);
  return {
    phpValuationRate,
    phpTaxValuation: money(mul(params.grossAmount, phpValuationRate)),
  };
}

export function reviewForIncome(
  currency: CurrencyCode,
  phpTaxValuation?: string | null,
): { needsReview: boolean; reviewReasons: string[] } {
  if (currency === "PHP") return { needsReview: false, reviewReasons: [] };
  if (!phpTaxValuation || phpTaxValuation.trim() === "") {
    return {
      needsReview: true,
      reviewReasons: [MISSING_VALUATION_REVIEW_REASON],
    };
  }
  return { needsReview: false, reviewReasons: [] };
}

export function valuationSourceForBulkRate(rate: string): string {
  return `Bulk update · user rate ${money(rate, 6)}`;
}

export type BulkRateMap = Partial<Record<CurrencyCode, string>>;

export function applyRateToIncome(
  income: IncomeTransaction,
  ratesByCurrency: BulkRateMap,
): Pick<
  IncomeTransaction,
  | "phpTaxValuation"
  | "phpValuationRate"
  | "phpValuationSource"
  | "needsReview"
  | "reviewReasons"
> | null {
  if (income.currency === "PHP") return null;
  const rate = ratesByCurrency[income.currency]?.trim();
  if (!rate || Number.isNaN(Number(rate)) || Number(rate) <= 0) {
    throw new Error(`Enter a valid ${income.currency}→PHP exchange rate`);
  }
  const { phpTaxValuation, phpValuationRate } = calculatePhpValuationFromRate({
    grossAmount: income.grossAmount,
    rate,
  });
  return {
    phpTaxValuation,
    phpValuationRate,
    phpValuationSource: valuationSourceForBulkRate(rate),
    needsReview: false,
    reviewReasons: [],
  };
}
