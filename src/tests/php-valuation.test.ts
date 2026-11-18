import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AUTO_VALUATION_REVIEW_REASON,
  resolvePhpValuation,
} from "@/lib/calculations/php-valuation";
import { finalizeIncomeValuation, createIncome } from "@/db/transactions";
import { ensureSettings, getDb, resetDbInstance } from "@/db/database";

function mockFrankfurter(rate = 56) {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({
      amount: 1,
      base: "USD",
      date: "2024-05-01",
      rates: { PHP: rate },
    }),
  })) as unknown as typeof fetch;
}

describe("resolvePhpValuation", () => {
  it("accepts manual valuation immediately", async () => {
    const result = await resolvePhpValuation({
      currency: "USD",
      grossAmount: "100.00",
      paymentDate: "2024-05-01",
      phpTaxValuation: "5600.00",
      phpValuationSource: "BSP manual",
      fetchImpl: mockFrankfurter(),
    });
    expect(result.phpTaxValuation).toBe("5600.00");
    expect(result.phpValuationAutoPending).toBe(false);
    expect(result.needsReview).toBe(false);
    expect(result.autoFilled).toBe(false);
  });

  it("auto-fills from Frankfurter and keeps needs review", async () => {
    const result = await resolvePhpValuation({
      currency: "USD",
      grossAmount: "100.00",
      paymentDate: "2024-05-01",
      fetchImpl: mockFrankfurter(56.123456),
    });
    expect(result.phpTaxValuation).toBe("5612.35");
    expect(result.phpValuationRate).toBe("56.123456");
    expect(result.phpValuationSource?.startsWith("Based on Exchange Rate on ")).toBe(
      true,
    );
    expect(result.phpValuationAutoPending).toBe(true);
    expect(result.needsReview).toBe(true);
    expect(result.reviewReasons).toContain(AUTO_VALUATION_REVIEW_REASON);
    expect(result.autoFilled).toBe(true);
  });

  it("keeps pending when re-saving unchanged auto values", async () => {
    const existing = {
      phpTaxValuation: "5600.00",
      phpValuationRate: "56.000000",
      phpValuationSource: "Based on Exchange Rate on May 1, 2024 at 10:00 AM",
      phpValuationAutoPending: true,
    };
    const result = await resolvePhpValuation({
      currency: "USD",
      grossAmount: "100.00",
      paymentDate: "2024-05-01",
      phpTaxValuation: "5600.00",
      phpValuationRate: "56.000000",
      phpValuationSource: existing.phpValuationSource,
      existing,
      fetchImpl: mockFrankfurter(),
    });
    expect(result.phpValuationAutoPending).toBe(true);
    expect(result.needsReview).toBe(true);
  });
});

describe("finalizeIncomeValuation", () => {
  beforeEach(async () => {
    resetDbInstance();
    const db = getDb();
    await db.delete();
    resetDbInstance();
    await ensureSettings();
    vi.stubGlobal("fetch", mockFrankfurter(56));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("clears needs review and includes valuation permanently", async () => {
    const created = await createIncome({
      paymentDate: "2024-05-01",
      clientName: "Studio",
      description: "Portrait",
      currency: "USD",
      grossAmount: "100.00",
      paymentMethod: "vgen_paypal",
    });

    expect(created.phpValuationAutoPending).toBe(true);
    expect(created.needsReview).toBe(true);
    expect(created.phpTaxValuation).toBe("5600.00");

    const finalized = await finalizeIncomeValuation(created.id);
    expect(finalized.needsReview).toBe(false);
    expect(finalized.phpValuationAutoPending).toBe(false);
    expect(finalized.phpTaxValuation).toBe("5600.00");
    expect(finalized.reviewReasons).toEqual([]);
  });
});
