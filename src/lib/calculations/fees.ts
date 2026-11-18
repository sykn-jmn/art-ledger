import type {
  CurrencyCode,
  FeeRecord,
  FeeRuleConfig,
  FeeType,
  PaymentMethod,
} from "@/types";
import { add, money, percentOf, sub } from "@/lib/utils/money";

export interface CalculatedFee {
  feeType: FeeType;
  amount: string;
  currency: CurrencyCode;
  calculationMethod: "auto" | "manual";
  estimated: boolean;
  overridden: boolean;
}

export interface FeeBreakdownResult {
  fees: CalculatedFee[];
  totalFees: string;
  netReceived: string;
}

export const DEFAULT_FEE_RULES: FeeRuleConfig = {
  vgenPercent: "5",
  paypalPercent: "4.4",
  paypalFixed: "0.30",
  paypalFixedCurrency: "USD",
};

export function calculateVgenFee(
  gross: string,
  rules: FeeRuleConfig = DEFAULT_FEE_RULES,
): string {
  return percentOf(gross, rules.vgenPercent);
}

export function calculatePaypalFee(
  gross: string,
  currency: CurrencyCode,
  rules: FeeRuleConfig = DEFAULT_FEE_RULES,
): string {
  const percentPart = percentOf(gross, rules.paypalPercent);
  if (currency === rules.paypalFixedCurrency) {
    return add(percentPart, rules.paypalFixed);
  }
  // Fixed fee only applies in the configured currency (USD by default)
  return percentPart;
}

/**
 * Calculate fees for an income payment method.
 * Manual methods return empty auto fees (caller supplies overrides).
 */
export function calculateIncomeFees(params: {
  grossAmount: string;
  currency: CurrencyCode;
  paymentMethod: PaymentMethod;
  rules?: FeeRuleConfig;
  overrides?: Partial<Record<FeeType, string>>;
}): FeeBreakdownResult {
  const rules = params.rules ?? DEFAULT_FEE_RULES;
  const overrides = params.overrides ?? {};
  const fees: CalculatedFee[] = [];

  const pushFee = (
    feeType: FeeType,
    autoAmount: string | null,
    currency: CurrencyCode,
  ) => {
    if (overrides[feeType] !== undefined) {
      fees.push({
        feeType,
        amount: money(overrides[feeType]!),
        currency,
        calculationMethod: "manual",
        estimated: false,
        overridden: true,
      });
      return;
    }
    if (autoAmount === null) {
      // Manual-input fee with no value yet
      fees.push({
        feeType,
        amount: "0.00",
        currency,
        calculationMethod: "manual",
        estimated: true,
        overridden: false,
      });
      return;
    }
    fees.push({
      feeType,
      amount: money(autoAmount),
      currency,
      calculationMethod: "auto",
      estimated: true,
      overridden: false,
    });
  };

  switch (params.paymentMethod) {
    case "vgen_paypal":
      pushFee("vgen", calculateVgenFee(params.grossAmount, rules), params.currency);
      pushFee(
        "paypal",
        calculatePaypalFee(params.grossAmount, params.currency, rules),
        params.currency,
      );
      break;
    case "vgen_stripe":
      pushFee("vgen", calculateVgenFee(params.grossAmount, rules), params.currency);
      pushFee("stripe", null, params.currency);
      break;
    case "paypal_only":
      pushFee(
        "paypal",
        calculatePaypalFee(params.grossAmount, params.currency, rules),
        params.currency,
      );
      break;
    case "wise":
      pushFee("wise", null, params.currency);
      break;
    case "gcash":
    case "bank_transfer":
      // No default fees; allow optional override via "other"
      if (overrides.other !== undefined) {
        pushFee("other", null, params.currency);
      }
      break;
  }

  const totalFees = fees.reduce((sum, f) => add(sum, f.amount), "0.00");
  const netReceived = sub(params.grossAmount, totalFees);

  return { fees, totalFees, netReceived };
}

/** Preserve historical fees — do not recalculate from current rules. */
export function netFromStoredFees(
  grossAmount: string,
  fees: Pick<FeeRecord, "amount">[],
): string {
  const total = fees.reduce((sum, f) => add(sum, f.amount), "0.00");
  return sub(grossAmount, total);
}
