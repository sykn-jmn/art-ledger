export type CurrencyCode = "USD" | "PHP" | "EUR" | "JPY" | "GBP" | "CAD" | "AUD" | "SGD";

export type PaymentMethod =
  | "vgen_paypal"
  | "vgen_stripe"
  | "paypal_only"
  | "gcash"
  | "bank_transfer"
  | "wise";

export type ExpenseCategory =
  | "tools_brushes"
  | "software"
  | "other_business"
  | "monthly_revenue_share"
  | "owners_drawings"
  | "other_disbursements"
  | "internal_transfer";

export type FeeType = "vgen" | "paypal" | "stripe" | "wise" | "other" | "conversion";

export type FeeTreatment = "from_source" | "from_destination" | "separate";

export type TransactionType = "income" | "expense" | "conversion";

export type MoneyString = string; // decimal string, e.g. "1200.00"

export interface FeeRecord {
  id: string;
  transactionId: string;
  transactionType: TransactionType;
  feeType: FeeType;
  amount: MoneyString;
  currency: CurrencyCode;
  calculationMethod: "auto" | "manual";
  estimated: boolean;
  overridden: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IncomeTransaction {
  id: string;
  paymentDate: string; // YYYY-MM-DD
  clientName: string;
  description: string;
  orderNumber: string; // e.g. "000063"
  currency: CurrencyCode;
  grossAmount: MoneyString;
  paymentMethod: PaymentMethod;
  netReceived: MoneyString;
  phpTaxValuation: MoneyString | null;
  phpValuationRate: MoneyString | null;
  phpValuationSource: string | null;
  /** True when PHP valuation was auto-filled and not yet finalized. */
  phpValuationAutoPending: boolean;
  needsReview: boolean;
  reviewReasons: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseTransaction {
  id: string;
  paymentDate: string;
  payee: string;
  description: string;
  category: ExpenseCategory;
  currency: CurrencyCode;
  amount: MoneyString;
  paymentMethod: PaymentMethod | "other";
  referenceNumber: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CurrencyConversion {
  id: string;
  conversionDate: string;
  sourceCurrency: CurrencyCode;
  sourceAmount: MoneyString;
  destinationCurrency: CurrencyCode;
  destinationAmount: MoneyString;
  exchangeRate: MoneyString;
  conversionFee: MoneyString;
  conversionFeeCurrency: CurrencyCode;
  feeTreatment: FeeTreatment;
  referenceNumber: string | null;
  needsReview: boolean;
  reviewReasons: string[];
  createdAt: string;
  updatedAt: string;
}

export interface TaxPayment {
  id: string;
  taxYear: number;
  period: "Q1" | "Q2" | "Q3" | "Q4" | "annual";
  paymentDate: string;
  amountPaid: MoneyString; // PHP
  reference: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningBalance {
  id: string;
  currency: CurrencyCode;
  amount: MoneyString;
  effectiveDate: string;
  accountLocation: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FeeRuleConfig {
  vgenPercent: MoneyString; // "5"
  paypalPercent: MoneyString; // "4.4"
  paypalFixed: MoneyString; // "0.30"
  paypalFixedCurrency: CurrencyCode;
}

export interface AppSettings {
  id: "settings";
  startingOrderNumber: number;
  nextOrderNumber: number;
  defaultCurrency: CurrencyCode;
  feeRules: FeeRuleConfig;
  revenueSharePercent: MoneyString; // "10"
  taxDeductionAmount: MoneyString; // "250000"
  taxRatePercent: MoneyString; // "8"
  selectedYear: number;
  selectedQuarter: 1 | 2 | 3 | 4 | "all";
  createdAt: string;
  updatedAt: string;
}

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  settings: AppSettings;
  incomes: IncomeTransaction[];
  expenses: ExpenseTransaction[];
  conversions: CurrencyConversion[];
  fees: FeeRecord[];
  taxPayments: TaxPayment[];
  openingBalances: OpeningBalance[];
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  vgen_paypal: "VGen + PayPal",
  vgen_stripe: "VGen + Stripe",
  paypal_only: "PayPal Only",
  gcash: "GCash",
  bank_transfer: "Bank Transfer",
  wise: "Wise",
};

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  tools_brushes: "Tools & Brushes",
  software: "Software",
  other_business: "Other Business Expenses",
  monthly_revenue_share: "Monthly Revenue Share",
  owners_drawings: "Owner's Drawings / Withdrawals",
  other_disbursements: "Other Disbursements",
  internal_transfer: "Internal Transfer",
};

export const OPERATING_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  "tools_brushes",
  "software",
  "other_business",
];

export const CURRENCIES: CurrencyCode[] = [
  "USD",
  "PHP",
  "EUR",
  "JPY",
  "GBP",
  "CAD",
  "AUD",
  "SGD",
];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  USD: "$",
  PHP: "₱",
  EUR: "€",
  JPY: "¥",
  GBP: "£",
  CAD: "C$",
  AUD: "A$",
  SGD: "S$",
};
