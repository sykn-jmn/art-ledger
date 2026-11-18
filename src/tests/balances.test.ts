import { describe, expect, it } from "vitest";
import {
  checkConversionBalance,
  computeBalances,
} from "@/lib/calculations/balances";
import type {
  CurrencyConversion,
  ExpenseTransaction,
  IncomeTransaction,
  OpeningBalance,
} from "@/types";

const opening = (currency: "USD" | "PHP", amount: string): OpeningBalance => ({
  id: `ob-${currency}`,
  currency,
  amount,
  effectiveDate: "2024-01-01",
  accountLocation: null,
  createdAt: "",
  updatedAt: "",
});

const income = (
  id: string,
  net: string,
  currency: "USD" | "PHP" = "USD",
): IncomeTransaction => ({
  id,
  paymentDate: "2024-02-01",
  clientName: "A",
  description: "B",
  orderNumber: "000001",
  currency,
  grossAmount: net,
  paymentMethod: "gcash",
  netReceived: net,
  phpTaxValuation: currency === "PHP" ? net : null,
  phpValuationRate: null,
  phpValuationSource: null,
  phpValuationAutoPending: false,
  needsReview: false,
  reviewReasons: [],
  createdAt: "",
  updatedAt: "",
});

const expense = (
  id: string,
  amount: string,
  currency: "USD" | "PHP" = "USD",
): ExpenseTransaction => ({
  id,
  paymentDate: "2024-02-10",
  payee: "Store",
  description: "Tools",
  category: "tools_brushes",
  currency,
  amount,
  paymentMethod: "bank_transfer",
  referenceNumber: null,
  createdAt: "",
  updatedAt: "",
});

const conversion = (
  partial: Partial<CurrencyConversion> &
    Pick<
      CurrencyConversion,
      | "id"
      | "sourceAmount"
      | "destinationAmount"
      | "sourceCurrency"
      | "destinationCurrency"
    >,
): CurrencyConversion => ({
  conversionDate: "2024-03-01",
  exchangeRate: "56",
  conversionFee: "0",
  conversionFeeCurrency: "USD",
  feeTreatment: "from_source",
  referenceNumber: null,
  needsReview: false,
  reviewReasons: [],
  createdAt: "",
  updatedAt: "",
  ...partial,
});

describe("currency balances", () => {
  it("includes opening balances and net income inflows", () => {
    const balances = computeBalances({
      openings: [opening("USD", "100.00")],
      incomes: [income("i1", "200.00")],
      expenses: [],
      conversions: [],
    });
    const usd = balances.find((b) => b.currency === "USD");
    expect(usd?.available).toBe("300.00");
  });

  it("supports combined balances from multiple incomes then conversion", () => {
    const balances = computeBalances({
      openings: [],
      incomes: [income("i1", "100.00"), income("i2", "150.00")],
      expenses: [],
      conversions: [
        conversion({
          id: "c1",
          sourceCurrency: "USD",
          sourceAmount: "200.00",
          destinationCurrency: "PHP",
          destinationAmount: "11200.00",
        }),
      ],
    });
    expect(balances.find((b) => b.currency === "USD")?.available).toBe("50.00");
    expect(balances.find((b) => b.currency === "PHP")?.available).toBe(
      "11200.00",
    );
  });

  it("warns on insufficient balance", () => {
    const check = checkConversionBalance({
      openings: [],
      incomes: [income("i1", "50.00")],
      expenses: [],
      conversions: [],
      sourceCurrency: "USD",
      sourceAmount: "80.00",
      conversionFee: "0",
      conversionFeeCurrency: "USD",
      feeTreatment: "from_source",
    });
    expect(check.sufficient).toBe(false);
  });

  it("does not double-count fees already in net received", () => {
    // Gross 100, net 90 — balance uses net only
    const balances = computeBalances({
      openings: [],
      incomes: [income("i1", "90.00")],
      expenses: [],
      conversions: [],
    });
    expect(balances.find((b) => b.currency === "USD")?.inflows).toBe("90.00");
  });

  it("applies source-side conversion fee to outflow", () => {
    const balances = computeBalances({
      openings: [opening("USD", "100.00")],
      incomes: [],
      expenses: [],
      conversions: [
        conversion({
          id: "c1",
          sourceCurrency: "USD",
          sourceAmount: "50.00",
          destinationCurrency: "PHP",
          destinationAmount: "2800.00",
          conversionFee: "2.00",
          conversionFeeCurrency: "USD",
          feeTreatment: "from_source",
        }),
      ],
    });
    expect(balances.find((b) => b.currency === "USD")?.available).toBe("48.00");
  });

  it("excludes internal transfers from expense outflows", () => {
    const balances = computeBalances({
      openings: [opening("USD", "100.00")],
      incomes: [],
      expenses: [
        {
          ...expense("e1", "25.00"),
          category: "internal_transfer",
        },
      ],
      conversions: [],
    });
    expect(balances.find((b) => b.currency === "USD")?.available).toBe("100.00");
  });
});
