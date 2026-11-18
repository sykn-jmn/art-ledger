import type { CurrencyConversion, FeeTreatment } from "@/types";
import { add, div, money, mul, sub } from "@/lib/utils/money";

/**
 * Effective rate from recorded amounts, accounting for fee treatment.
 * rate ≈ destination / source (adjusted for fees taken from either side).
 */
export function calculateEffectiveRate(params: {
  sourceAmount: string;
  destinationAmount: string;
  conversionFee: string;
  feeTreatment: FeeTreatment;
  feeCurrencyIsSource: boolean;
}): string {
  const { sourceAmount, destinationAmount, conversionFee, feeTreatment } = params;

  let effectiveSource = sourceAmount;
  let effectiveDest = destinationAmount;

  if (feeTreatment === "from_source" && params.feeCurrencyIsSource) {
    // Fee already removed from what left the source wallet — recorded source is what left
    effectiveSource = sourceAmount;
  } else if (feeTreatment === "from_destination" && !params.feeCurrencyIsSource) {
    // Destination is net after fee; gross destination ≈ dest + fee
    effectiveDest = add(destinationAmount, conversionFee);
  }

  return div(effectiveDest, effectiveSource, 8);
}

export function applyManualRate(params: {
  sourceAmount: string;
  rate: string;
  conversionFee: string;
  feeTreatment: FeeTreatment;
  feeInDestination: boolean;
}): string {
  let dest = mul(params.sourceAmount, params.rate);
  if (params.feeTreatment === "from_destination" && params.feeInDestination) {
    dest = sub(dest, params.conversionFee);
  }
  return money(dest);
}

export function conversionSourceOutflow(c: CurrencyConversion): string {
  // Source balance always decreases by sourceAmount.
  // If fee is in source currency and treated as from_source, include fee.
  if (
    c.feeTreatment === "from_source" &&
    c.conversionFeeCurrency === c.sourceCurrency
  ) {
    return add(c.sourceAmount, c.conversionFee);
  }
  if (
    c.feeTreatment === "separate" &&
    c.conversionFeeCurrency === c.sourceCurrency
  ) {
    return add(c.sourceAmount, c.conversionFee);
  }
  return c.sourceAmount;
}

export function conversionDestinationInflow(c: CurrencyConversion): string {
  // Destination increases by destinationAmount (already net of dest-side fees if recorded that way).
  if (
    c.feeTreatment === "separate" &&
    c.conversionFeeCurrency === c.destinationCurrency
  ) {
    return sub(c.destinationAmount, "0"); // fee paid separately from destination
  }
  return c.destinationAmount;
}

export function conversionFeeOutflow(
  c: CurrencyConversion,
): { currency: string; amount: string } | null {
  if (c.feeTreatment === "from_source" || c.feeTreatment === "from_destination") {
    // Fee already reflected in source/dest amounts for balance purposes when treated as included.
    // Still track fee currency separately if "separate".
    if (c.feeTreatment === "from_source") return null;
    if (c.feeTreatment === "from_destination") return null;
  }
  return { currency: c.conversionFeeCurrency, amount: c.conversionFee };
}
