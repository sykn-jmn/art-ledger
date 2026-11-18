export function formatOrderNumber(n: number): string {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error("Order number must be a non-negative finite number");
  }
  return String(Math.trunc(n)).padStart(6, "0");
}

export function parseOrderNumber(value: string): number {
  const cleaned = value.trim().replace(/^#/, "");
  const n = Number.parseInt(cleaned, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid order number: ${value}`);
  }
  return n;
}

export function allocateOrderNumbers(
  start: number,
  count: number,
  existing: Set<string>,
): string[] {
  const allocated: string[] = [];
  let cursor = start;
  while (allocated.length < count) {
    const candidate = formatOrderNumber(cursor);
    if (!existing.has(candidate)) {
      allocated.push(candidate);
    }
    cursor += 1;
    if (cursor > start + count + existing.size + 100000) {
      throw new Error("Unable to allocate unique order numbers");
    }
  }
  return allocated;
}
