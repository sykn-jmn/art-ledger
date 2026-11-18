import { describe, expect, it } from "vitest";
import {
  calculateIncomeFees,
  DEFAULT_FEE_RULES,
  netFromStoredFees,
} from "@/lib/calculations/fees";

describe("income fee calculations", () => {
  it("calculates VGen + PayPal", () => {
    const result = calculateIncomeFees({
      grossAmount: "1000.00",
      currency: "USD",
      paymentMethod: "vgen_paypal",
    });
    expect(result.fees.find((f) => f.feeType === "vgen")?.amount).toBe("50.00");
    expect(result.fees.find((f) => f.feeType === "paypal")?.amount).toBe("44.30");
    expect(result.netReceived).toBe("905.70");
  });

  it("calculates VGen + Stripe with manual stripe fee", () => {
    const result = calculateIncomeFees({
      grossAmount: "500.00",
      currency: "USD",
      paymentMethod: "vgen_stripe",
      overrides: { stripe: "15.50" },
    });
    expect(result.fees.find((f) => f.feeType === "vgen")?.amount).toBe("25.00");
    expect(result.fees.find((f) => f.feeType === "stripe")?.amount).toBe("15.50");
    expect(result.fees.find((f) => f.feeType === "stripe")?.overridden).toBe(true);
    expect(result.netReceived).toBe("459.50");
  });

  it("calculates PayPal only", () => {
    const result = calculateIncomeFees({
      grossAmount: "200.00",
      currency: "USD",
      paymentMethod: "paypal_only",
    });
    expect(result.fees).toHaveLength(1);
    expect(result.fees[0]?.amount).toBe("9.10");
    expect(result.netReceived).toBe("190.90");
  });

  it("GCash has no default fees", () => {
    const result = calculateIncomeFees({
      grossAmount: "5000.00",
      currency: "PHP",
      paymentMethod: "gcash",
    });
    expect(result.fees).toHaveLength(0);
    expect(result.netReceived).toBe("5000.00");
  });

  it("Bank Transfer has no default fees", () => {
    const result = calculateIncomeFees({
      grossAmount: "10000.00",
      currency: "PHP",
      paymentMethod: "bank_transfer",
    });
    expect(result.netReceived).toBe("10000.00");
  });

  it("Wise requires manual fee", () => {
    const result = calculateIncomeFees({
      grossAmount: "300.00",
      currency: "USD",
      paymentMethod: "wise",
      overrides: { wise: "4.25" },
    });
    expect(result.fees[0]?.calculationMethod).toBe("manual");
    expect(result.netReceived).toBe("295.75");
  });

  it("supports manual overrides for auto fees", () => {
    const result = calculateIncomeFees({
      grossAmount: "1000.00",
      currency: "USD",
      paymentMethod: "vgen_paypal",
      overrides: { vgen: "40.00", paypal: "30.00" },
    });
    expect(result.totalFees).toBe("70.00");
    expect(result.netReceived).toBe("930.00");
  });

  it("preserves historical fees via stored records", () => {
    // Even if rules change, netFromStoredFees uses persisted amounts
    const net = netFromStoredFees("1000.00", [
      { amount: "50.00" },
      { amount: "44.30" },
    ]);
    expect(net).toBe("905.70");
    expect(DEFAULT_FEE_RULES.vgenPercent).toBe("5");
  });
});
