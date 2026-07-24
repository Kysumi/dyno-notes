export function dateValue(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function localDate(value: string): Date {
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

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isValidCalendarDate(
  year: number,
  month: number,
  day: number,
): boolean {
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export const DEADLINE_SOON_WINDOW_MS = 24 * 60 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const TIME = /^(\d{1,2}):(\d{2})$/;

/**
 * Accepts "YYYY-MM-DD" or "DD/MM/YYYY", with an optional "HH:mm" time, and
 * returns a canonical "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm" string, or null if
 * either part is not a real calendar date/time.
 */
export function parseDeadlineInput(
  rawDate: string,
  rawTime?: string,
): string | null {
  const iso = ISO_DATE.exec(rawDate);
  const slash = SLASH_DATE.exec(rawDate);
  let year: number;
  let month: number;
  let day: number;
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (slash) {
    [day, month, year] = [Number(slash[1]), Number(slash[2]), Number(slash[3])];
  } else {
    return null;
  }
  if (!isValidCalendarDate(year, month, day)) return null;

  const datePart = `${year}-${pad(month)}-${pad(day)}`;
  const time = rawTime ? TIME.exec(rawTime) : null;
  if (!time) return datePart;
  const hour = Number(time[1]);
  const minute = Number(time[2]);
  if (hour > 23 || minute > 59) return datePart;
  return `${datePart}T${pad(hour)}:${pad(minute)}`;
}

/** The instant a deadline is due: end of day for a date-only deadline. */
export function deadlineTimestamp(value: string): number {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  if (!timePart) return new Date(year, month - 1, day, 23, 59, 59, 999).getTime();
  const [hour, minute] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function formatDeadline(value: string): string {
  const [datePart, timePart] = value.split("T");
  const date = localDate(datePart);
  const dateLabel = new Intl.DateTimeFormat("en-NZ", {
    dateStyle: "medium",
  }).format(date);
  if (!timePart) return dateLabel;
  const [hour, minute] = timePart.split(":").map(Number);
  date.setHours(hour, minute);
  const timeLabel = new Intl.DateTimeFormat("en-NZ", {
    timeStyle: "short",
  }).format(date);
  return `${dateLabel}, ${timeLabel}`;
}
