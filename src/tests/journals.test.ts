import { describe, expect, it } from "vitest";
import { generateJournals } from "@/lib/calculations/journals";
import type { ExpenseTransaction, FeeRecord, IncomeTransaction } from "@/types";

describe("journal generation", () => {
  const income: IncomeTransaction = {
    id: "inc1",
    paymentDate: "2024-07-04",
    clientName: "Nocturne",
    description: "Key Visual",
    orderNumber: "000058",
    currency: "PHP",
    grossAmount: "49657.00",
    paymentMethod: "bank_transfer",
    netReceived: "49657.00",
    phpTaxValuation: "49657.00",
    phpValuationRate: null,
    phpValuationSource: null,
    phpValuationAutoPending: false,
    needsReview: false,
    reviewReasons: [],
    createdAt: "",
    updatedAt: "",
  };

  const fees: FeeRecord[] = [
    {
      id: "f1",
      transactionId: "inc1",
      transactionType: "income",
      feeType: "paypal",
      amount: "10.00",
      currency: "PHP",
      calculationMethod: "manual",
      estimated: false,
      overridden: true,
      createdAt: "",
      updatedAt: "",
    },
  ];

  const expense: ExpenseTransaction = {
    id: "exp1",
    paymentDate: "2024-07-20",
    payee: "Art Store",
    description: "Brushes",
    category: "tools_brushes",
    currency: "PHP",
    amount: "1500.00",
    paymentMethod: "gcash",
    referenceNumber: "R-1",
    createdAt: "",
    updatedAt: "",
  };

  it("builds CRJ with service revenue and cash", () => {
    const j = generateJournals({
      incomes: [income],
      expenses: [],
      conversions: [],
      fees: [],
      year: 2024,
      quarter: 3,
    });
    expect(j.crj).toHaveLength(1);
    expect(j.crj[0]?.serviceRevenue).toBe("49657.00");
    expect(j.crj[0]?.cash).toBe("49657.00");
  });

  it("categorizes CDJ tools and fee columns", () => {
    const j = generateJournals({
      incomes: [income],
      expenses: [expense],
      conversions: [],
      fees,
      year: 2024,
      quarter: 3,
    });
    const tools = j.cdj.find((e) => e.sourceId === "exp1");
    expect(tools?.toolsBrush).toBe("1500.00");
    const feeRow = j.cdj.find((e) => e.sourceType === "income_fees");
    expect(feeRow?.paypalFee).toBe("10.00");
  });

  it("links GL entries to source transactions with debit/credit pairs", () => {
    const j = generateJournals({
      incomes: [income],
      expenses: [expense],
      conversions: [],
      fees: [],
      year: 2024,
      quarter: 3,
    });
    const revenue = j.gl.filter((e) => e.sourceId === "inc1");
    expect(revenue.some((e) => e.account === "Service Revenue" && e.credit === "49657.00")).toBe(
      true,
    );
    expect(revenue.some((e) => e.account === "Cash" && e.debit === "49657.00")).toBe(
      true,
    );
  });

  it("flags missing PHP valuation instead of inventing amounts", () => {
    const foreign: IncomeTransaction = {
      ...income,
      id: "inc2",
      currency: "USD",
      grossAmount: "100.00",
      netReceived: "90.00",
      phpTaxValuation: null,
      needsReview: true,
    };
    const j = generateJournals({
      incomes: [foreign],
      expenses: [],
      conversions: [],
      fees: [],
      year: 2024,
      quarter: 3,
    });
    expect(j.crj[0]?.flags).toContain("missing_php_valuation");
    expect(j.crj[0]?.cash).toBeNull();
  });

  it("flags unmapped conversions", () => {
    const j = generateJournals({
      incomes: [],
      expenses: [],
      conversions: [
        {
          id: "c1",
          conversionDate: "2024-08-01",
          sourceCurrency: "USD",
          sourceAmount: "50.00",
          destinationCurrency: "PHP",
          destinationAmount: "2800.00",
          exchangeRate: "56",
          conversionFee: "0",
          conversionFeeCurrency: "USD",
          feeTreatment: "from_source",
          referenceNumber: null,
          needsReview: false,
          reviewReasons: [],
          createdAt: "",
          updatedAt: "",
        },
      ],
      fees: [],
      year: 2024,
      quarter: 3,
    });
    expect(j.flags.some((f) => f.flag === "unmapped_conversion")).toBe(true);
  });
});
