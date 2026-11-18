import { describe, expect, it } from "vitest";
import { calculateRevenueShare } from "@/lib/calculations/revenue-share";
import type { ExpenseTransaction, IncomeTransaction } from "@/types";

describe("revenue sharing", () => {
  const incomes: IncomeTransaction[] = [
    {
      id: "1",
      paymentDate: "2024-01-10",
      clientName: "A",
      description: "Art",
      orderNumber: "000001",
      currency: "PHP",
      grossAmount: "100000.00",
      paymentMethod: "gcash",
      netReceived: "100000.00",
      phpTaxValuation: "100000.00",
      phpValuationRate: null,
      phpValuationSource: null,
      phpValuationAutoPending: false,
      needsReview: false,
      reviewReasons: [],
      createdAt: "",
      updatedAt: "",
    },
  ];

  it("calculates default 10%", () => {
    const rows = calculateRevenueShare({
      incomes,
      expenses: [],
      year: 2024,
      percent: "10",
    });
    expect(rows[0]?.calculatedShare).toBe("10000.00");
    expect(rows[0]?.actualPaid).toBe("0.00");
    expect(rows[0]?.outstanding).toBe("10000.00");
  });

  it("supports configurable percentage", () => {
    const rows = calculateRevenueShare({
      incomes,
      expenses: [],
      year: 2024,
      percent: "15",
    });
    expect(rows[0]?.calculatedShare).toBe("15000.00");
  });

  it("tracks partial and full payments without creating duplicates", () => {
    const expenses: ExpenseTransaction[] = [
      {
        id: "e1",
        paymentDate: "2024-01-31",
        payee: "Partner",
        description: "Jan share",
        category: "monthly_revenue_share",
        currency: "PHP",
        amount: "4000.00",
        paymentMethod: "bank_transfer",
        referenceNumber: null,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const partial = calculateRevenueShare({
      incomes,
      expenses,
      year: 2024,
      percent: "10",
    });
    expect(partial[0]?.outstanding).toBe("6000.00");

    expenses.push({
      ...expenses[0]!,
      id: "e2",
      amount: "6000.00",
    });
    const full = calculateRevenueShare({
      incomes,
      expenses,
      year: 2024,
      percent: "10",
    });
    expect(full[0]?.outstanding).toBe("0.00");
    expect(full[0]?.actualPaid).toBe("10000.00");
  });
});
