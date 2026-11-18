import type { CurrencyCode, IncomeTransaction } from "@/types";
import { fetchPhpRateFromFrankfurter } from "@/lib/fx/frankfurter";
import { money } from "@/lib/utils/money";

export const AUTO_VALUATION_REVIEW_REASON =
  "Auto-calculated PHP valuation pending finalization";

export const MISSING_VALUATION_REVIEW_REASON =
  "Missing PHP tax-reporting valuation";

export interface ResolvedPhpValuation {
  phpTaxValuation: string | null;
  phpValuationRate: string | null;
  phpValuationSource: string | null;
  phpValuationAutoPending: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  autoFilled: boolean;
}

/**
 * Resolve PHP tax valuation for foreign income.
 * User-provided amounts are accepted immediately.
 * Blank valuations are auto-filled via Frankfurter and stay pending review.
 */
export async function resolvePhpValuation(params: {
  currency: CurrencyCode;
  grossAmount: string;
  paymentDate: string;
  phpTaxValuation?: string | null;
  phpValuationRate?: string | null;
  phpValuationSource?: string | null;
  /** Preserve pending state when re-saving unchanged auto values. */
  existing?: Pick<
    IncomeTransaction,
    | "phpTaxValuation"
    | "phpValuationRate"
    | "phpValuationSource"
    | "phpValuationAutoPending"
  > | null;
  fetchImpl?: typeof fetch;
}): Promise<ResolvedPhpValuation> {
  if (params.currency === "PHP") {
    return {
      phpTaxValuation: money(params.grossAmount),
      phpValuationRate: null,
      phpValuationSource: null,
      phpValuationAutoPending: false,
      needsReview: false,
      reviewReasons: [],
      autoFilled: false,
    };
  }

  const provided = params.phpTaxValuation?.trim() || "";

  if (provided) {
    const rate = params.phpValuationRate?.trim() || "";
    const source = params.phpValuationSource?.trim() || "";
    const existing = params.existing;
    const unchangedAuto =
      Boolean(existing?.phpValuationAutoPending) &&
      money(provided) === money(existing?.phpTaxValuation ?? "") &&
      (rate
        ? money(rate, 6) === money(existing?.phpValuationRate ?? "", 6)
        : !existing?.phpValuationRate) &&
      (source || null) === (existing?.phpValuationSource ?? null);

    if (unchangedAuto) {
      return {
        phpTaxValuation: money(provided),
        phpValuationRate: existing?.phpValuationRate ?? (rate ? money(rate, 6) : null),
        phpValuationSource: existing?.phpValuationSource ?? (source || null),
        phpValuationAutoPending: true,
        needsReview: true,
        reviewReasons: [AUTO_VALUATION_REVIEW_REASON],
        autoFilled: false,
      };
    }

    return {
      phpTaxValuation: money(provided),
      phpValuationRate: rate ? money(rate, 6) : null,
      phpValuationSource: source || null,
      phpValuationAutoPending: false,
      needsReview: false,
      reviewReasons: [],
      autoFilled: false,
    };
  }

  try {
    const fx = await fetchPhpRateFromFrankfurter({
      fromCurrency: params.currency,
      amount: params.grossAmount,
      onDate: params.paymentDate,
      fetchImpl: params.fetchImpl,
    });
    return {
      phpTaxValuation: fx.phpAmount,
      phpValuationRate: fx.rate,
      phpValuationSource: fx.sourceLabel,
      phpValuationAutoPending: true,
      needsReview: true,
      reviewReasons: [AUTO_VALUATION_REVIEW_REASON],
      autoFilled: true,
    };
  } catch {
    return {
      phpTaxValuation: null,
      phpValuationRate: null,
      phpValuationSource: null,
      phpValuationAutoPending: false,
      needsReview: true,
      reviewReasons: [MISSING_VALUATION_REVIEW_REASON],
      autoFilled: false,
    };
  }
}

/** Auto valuations are stored but not used in tax/journals until finalized. */
export function isPhpValuationPending(income: IncomeTransaction): boolean {
  return Boolean(income.phpValuationAutoPending && income.needsReview);
}
