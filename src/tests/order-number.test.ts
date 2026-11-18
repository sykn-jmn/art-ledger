import { describe, expect, it } from "vitest";
import {
  allocateOrderNumbers,
  formatOrderNumber,
  parseOrderNumber,
} from "@/lib/utils/order-number";

describe("order numbering", () => {
  it("formats six-digit numbers", () => {
    expect(formatOrderNumber(63)).toBe("000063");
    expect(formatOrderNumber(1)).toBe("000001");
  });

  it("parses order numbers", () => {
    expect(parseOrderNumber("000063")).toBe(63);
    expect(parseOrderNumber("#64")).toBe(64);
  });

  it("allocates sequential unique numbers from custom start", () => {
    const existing = new Set(["000063", "000064"]);
    const allocated = allocateOrderNumbers(63, 3, existing);
    expect(allocated).toEqual(["000065", "000066", "000067"]);
  });

  it("skips used numbers during bulk allocation", () => {
    const existing = new Set(["000001", "000003"]);
    const allocated = allocateOrderNumbers(1, 3, existing);
    expect(allocated).toEqual(["000002", "000004", "000005"]);
  });
});
