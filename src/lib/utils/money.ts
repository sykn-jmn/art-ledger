import Decimal from "decimal.js";

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | number | Decimal;

export function d(value: MoneyInput = 0): Decimal {
  if (value instanceof Decimal) return value;
  if (value === "" || value === null || value === undefined) return new Decimal(0);
  return new Decimal(value);
}

export function money(value: MoneyInput, decimals = 2): string {
  return d(value).toFixed(decimals);
}

export function add(...values: MoneyInput[]): string {
  return money(values.reduce<Decimal>((sum, v) => sum.plus(d(v)), new Decimal(0)));
}

export function sub(a: MoneyInput, b: MoneyInput): string {
  return money(d(a).minus(d(b)));
}

export function mul(a: MoneyInput, b: MoneyInput, decimals = 2): string {
  return money(d(a).times(d(b)), decimals);
}

export function div(a: MoneyInput, b: MoneyInput, decimals = 6): string {
  const denom = d(b);
  if (denom.isZero()) return money(0, decimals);
  return money(d(a).div(denom), decimals);
}

export function percentOf(amount: MoneyInput, percent: MoneyInput): string {
  return money(d(amount).times(d(percent)).div(100));
}

export function max0(value: MoneyInput): string {
  const n = d(value);
  return money(n.isNegative() ? 0 : n);
}

export function cmp(a: MoneyInput, b: MoneyInput): number {
  return d(a).cmp(d(b));
}

export function isPositive(value: MoneyInput): boolean {
  return d(value).gt(0);
}

export function formatMoney(
  value: MoneyInput,
  currency: string,
  options?: { showCurrency?: boolean; decimals?: number },
): string {
  const decimals = options?.decimals ?? (currency === "JPY" ? 0 : 2);
  const amount = d(value).toNumber().toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (options?.showCurrency === false) return amount;
  const symbols: Record<string, string> = {
    USD: "$",
    PHP: "₱",
    EUR: "€",
    JPY: "¥",
    GBP: "£",
    CAD: "C$",
    AUD: "A$",
    SGD: "S$",
  };
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${amount}`;
}

export { Decimal };
