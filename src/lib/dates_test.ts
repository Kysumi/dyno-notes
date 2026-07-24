import { deepStrictEqual, strictEqual } from "node:assert/strict";

import {
  deadlineTimestamp,
  formatDeadline,
  journalTitle,
  parseDeadlineInput,
  shiftDate,
  weekDates,
} from "./dates.ts";

Deno.test("journal dates stay local across weeks and month boundaries", () => {
  deepStrictEqual(weekDates("2026-07-23"), [
    "2026-07-20",
    "2026-07-21",
    "2026-07-22",
    "2026-07-23",
    "2026-07-24",
    "2026-07-25",
    "2026-07-26",
  ]);
  strictEqual(shiftDate("2026-07-30", 7), "2026-08-06");
  strictEqual(journalTitle("2026-07-23"), "Thursday, 23 July 2026");
});

Deno.test("parseDeadlineInput accepts ISO and DD/MM/YYYY dates with a time", () => {
  strictEqual(parseDeadlineInput("2026-07-24"), "2026-07-24");
  strictEqual(parseDeadlineInput("24/07/2026"), "2026-07-24");
  strictEqual(parseDeadlineInput("24/07/2026", "14:30"), "2026-07-24T14:30");
  strictEqual(parseDeadlineInput("24/07/2026", "9:05"), "2026-07-24T09:05");
});

Deno.test("parseDeadlineInput rejects impossible dates and times", () => {
  strictEqual(parseDeadlineInput("2026-02-30"), null);
  strictEqual(parseDeadlineInput("31/04/2026"), null);
  strictEqual(parseDeadlineInput("2026-07-24", "25:00"), "2026-07-24");
});

Deno.test("deadlineTimestamp treats a date-only deadline as due at end of day", () => {
  const dateOnly = new Date(deadlineTimestamp("2026-07-24"));
  strictEqual(dateOnly.getHours(), 23);
  strictEqual(dateOnly.getMinutes(), 59);

  const withTime = new Date(deadlineTimestamp("2026-07-24T09:30"));
  strictEqual(withTime.getHours(), 9);
  strictEqual(withTime.getMinutes(), 30);
});

Deno.test("formatDeadline renders a date, or a date and time", () => {
  strictEqual(formatDeadline("2026-07-24"), "24 Jul 2026");
  strictEqual(formatDeadline("2026-07-24T09:30"), "24 Jul 2026, 9:30 am");
});
