export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function formatDisplayDate(iso: string): string {
  const date = parseISODate(iso);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

export function getQuarter(isoDate: string): 1 | 2 | 3 | 4 {
  const month = parseISODate(isoDate).getMonth() + 1;
  if (month <= 3) return 1;
  if (month <= 6) return 2;
  if (month <= 9) return 3;
  return 4;
}

export function getYear(isoDate: string): number {
  return parseISODate(isoDate).getFullYear();
}

export function getMonthIndex(isoDate: string): number {
  return parseISODate(isoDate).getMonth(); // 0-11
}

export function inYearQuarter(
  isoDate: string,
  year: number,
  quarter: 1 | 2 | 3 | 4 | "all",
): boolean {
  if (getYear(isoDate) !== year) return false;
  if (quarter === "all") return true;
  return getQuarter(isoDate) === quarter;
}

export function monthName(index: number): string {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][index]!;
}

export function quarterMonths(quarter: 1 | 2 | 3 | 4): number[] {
  const start = (quarter - 1) * 3;
  return [start, start + 1, start + 2];
}
