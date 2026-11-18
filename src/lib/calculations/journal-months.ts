import { getMonthIndex, getYear, monthName } from "@/lib/utils/dates";
import { add } from "@/lib/utils/money";

export interface MonthSection<T extends { date: string }> {
  key: string;
  year: number;
  monthIndex: number;
  label: string;
  entries: T[];
}

/** Group journal entries into calendar-month sections (chronological). */
export function groupByMonthSections<T extends { date: string }>(
  entries: T[],
): MonthSection<T>[] {
  const map = new Map<string, MonthSection<T>>();

  for (const entry of entries) {
    const year = getYear(entry.date);
    const monthIndex = getMonthIndex(entry.date);
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    let section = map.get(key);
    if (!section) {
      section = {
        key,
        year,
        monthIndex,
        label: `${monthName(monthIndex)} ${year}`,
        entries: [],
      };
      map.set(key, section);
    }
    section.entries.push(entry);
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.monthIndex - b.monthIndex;
  });
}

/** Sum nullable money strings, treating null/empty as zero. */
export function sumMoneyFields(
  values: Array<string | null | undefined>,
): string {
  return values.reduce<string>((sum, v) => {
    if (v == null || v === "" || v === "—") return sum;
    return add(sum, v);
  }, "0.00");
}
