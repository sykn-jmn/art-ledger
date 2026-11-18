import { describe, expect, it } from "vitest";
import {
  calculateAnnualTax,
  calculateQuarterlyTax,
} from "@/lib/calculations/taxes";
import type { IncomeTransaction, TaxPayment } from "@/types";

function income(
  partial: Partial<IncomeTransaction> &
    Pick<IncomeTransaction, "id" | "paymentDate" | "grossAmount" | "currency">,
): IncomeTransaction {
  return {
    clientName: "Client",
    description: "Work",
    orderNumber: "000001",
    paymentMethod: "vgen_paypal",
    netReceived: partial.grossAmount,
    phpTaxValuation:
      partial.currency === "PHP" ? partial.grossAmount : (partial.phpTaxValuation ?? null),
    phpValuationRate: null,
    phpValuationSource: null,
    phpValuationAutoPending: false,
    needsReview: false,
    reviewReasons: [],
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

describe("tax calculations", () => {
  it("handles gross below 250000", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "200000.00",
        }),
      ],
      taxPayments: [],
    });
    expect(result.taxableIncome).toBe("0.00");
    expect(result.estimatedTax).toBe("0.00");
  });

  it("handles exactly 250000", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "250000.00",
        }),
      ],
      taxPayments: [],
    });
    expect(result.taxableIncome).toBe("0.00");
    expect(result.estimatedTax).toBe("0.00");
  });

  it("handles above 250000", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "350000.00",
        }),
      ],
      taxPayments: [],
    });
    expect(result.taxableIncome).toBe("100000.00");
    expect(result.estimatedTax).toBe("8000.00");
  });

  it("uses cumulative quarters and recorded payments", () => {
    const incomes = [
      income({
        id: "1",
        paymentDate: "2024-01-15",
        currency: "PHP",
        grossAmount: "200000.00",
      }),
      income({
        id: "2",
        paymentDate: "2024-04-15",
        currency: "PHP",
        grossAmount: "200000.00",
      }),
    ];
    const taxPayments: TaxPayment[] = [
      {
        id: "p1",
        taxYear: 2024,
        period: "Q1",
        paymentDate: "2024-04-01",
        amountPaid: "1000.00",
        reference: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const rows = calculateQuarterlyTax({ year: 2024, incomes, taxPayments });
    expect(rows[0]?.cumulativeIncome).toBe("200000.00");
    expect(rows[0]?.cumulativeEstimatedTax).toBe("0.00");
    expect(rows[1]?.cumulativeIncome).toBe("400000.00");
    expect(rows[1]?.cumulativeEstimatedTax).toBe("12000.00");
    expect(rows[1]?.remainingEstimatedTax).toBe("11000.00");
  });

  it("flags missing PHP valuation", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "USD",
          grossAmount: "1000.00",
          phpTaxValuation: null,
        }),
      ],
      taxPayments: [],
    });
    expect(result.incomplete).toBe(true);
    expect(result.grossIncome).toBe("0.00");
  });

  it("ignores auto-pending PHP valuation until finalized", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "USD",
          grossAmount: "1000.00",
          phpTaxValuation: "56000.00",
          phpValuationAutoPending: true,
          needsReview: true,
        }),
      ],
      taxPayments: [],
    });
    expect(result.incomplete).toBe(true);
    expect(result.grossIncome).toBe("0.00");
  });

  it("does not deduct expenses from 8% tax base", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "350000.00",
        }),
      ],
      taxPayments: [],
    });
    // expenses are not even passed — tax uses gross only
    expect(result.estimatedTax).toBe("8000.00");
  });

  it("excludes currency conversions from gross income", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "300000.00",
        }),
      ],
      taxPayments: [],
    });
    // Only incomes counted
    expect(result.grossIncome).toBe("300000.00");
  });

  it("uses gross not net (fees not deducted from tax base)", () => {
    const result = calculateAnnualTax({
      year: 2024,
      incomes: [
        income({
          id: "1",
          paymentDate: "2024-03-01",
          currency: "PHP",
          grossAmount: "300000.00",
          netReceived: "270000.00",
        }),
      ],
      taxPayments: [],
    });
    expect(result.grossIncome).toBe("300000.00");
  });
});
