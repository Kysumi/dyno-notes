export function dateValue(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localDate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 12);
}

export function shiftDate(value: string, days: number): string {
  const date = localDate(value);
  date.setDate(date.getDate() + days);
  return dateValue(date);
}

export function weekDates(value: string): string[] {
  const date = localDate(value);
  const monday = shiftDate(value, -((date.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, index) => shiftDate(monday, index));
}

export function journalTitle(value: string): string {
  return new Intl.DateTimeFormat("en-NZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(localDate(value));
}

export function journalDateFromId(id: string): string | null {
  return /^journals\/(\d{4}-\d{2}-\d{2})\.md$/u.exec(id)?.[1] ?? null;
}
