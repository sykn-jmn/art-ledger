import { beforeEach, describe, expect, it } from "vitest";
import {
  applyRateToIncome,
  calculatePhpValuationFromRate,
  reviewForIncome,
} from "@/lib/calculations/php-valuation";
import { bulkApplyPhpValuation, createIncome } from "@/db/transactions";
import { ensureSettings, getDb, resetDbInstance } from "@/db/database";
import type { IncomeTransaction } from "@/types";

describe("php valuation helpers", () => {
  it("calculates PHP amount from gross × rate", () => {
    expect(
      calculatePhpValuationFromRate({
        grossAmount: "100.00",
        rate: "56.5",
      }),
    ).toEqual({
      phpValuationRate: "56.500000",
      phpTaxValuation: "5650.00",
    });
  });

  it("marks missing foreign valuation for review", () => {
    expect(reviewForIncome("USD", null).needsReview).toBe(true);
    expect(reviewForIncome("USD", "5600.00").needsReview).toBe(false);
    expect(reviewForIncome("PHP", null).needsReview).toBe(false);
  });

  it("applies rate patch onto income", () => {
    const income = {
      id: "1",
      currency: "USD",
      grossAmount: "100.00",
    } as IncomeTransaction;
    const patch = applyRateToIncome(income, { USD: "58.00" });
    expect(patch?.phpTaxValuation).toBe("5800.00");
    expect(patch?.phpValuationRate).toBe("58.000000");
    expect(patch?.needsReview).toBe(false);
    expect(patch?.phpValuationSource).toContain("Bulk update");
  });
});

describe("bulkApplyPhpValuation", () => {
  beforeEach(async () => {
    resetDbInstance();
    const db = getDb();
    await db.delete();
    resetDbInstance();
    await ensureSettings();
  });

  it("updates selected foreign incomes with calculated valuations", async () => {
    const a = await createIncome({
      paymentDate: "2024-05-01",
      clientName: "A",
      description: "Work",
      currency: "USD",
      grossAmount: "100.00",
      paymentMethod: "vgen_paypal",
    });
    const b = await createIncome({
      paymentDate: "2024-05-02",
      clientName: "B",
      description: "Work",
      currency: "USD",
      grossAmount: "50.00",
      paymentMethod: "vgen_paypal",
    });

    expect(a.needsReview).toBe(true);
    expect(a.phpTaxValuation).toBeNull();

    const count = await bulkApplyPhpValuation({
      incomeIds: [a.id, b.id],
      ratesByCurrency: { USD: "56.00" },
    });
    expect(count).toBe(2);

    const db = getDb();
    const a2 = await db.incomes.get(a.id);
    const b2 = await db.incomes.get(b.id);
    expect(a2?.phpTaxValuation).toBe("5600.00");
    expect(b2?.phpTaxValuation).toBe("2800.00");
    expect(a2?.needsReview).toBe(false);
    expect(b2?.needsReview).toBe(false);
  });
});
