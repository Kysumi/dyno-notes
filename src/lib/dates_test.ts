import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { journalTitle, shiftDate, weekDates } from "./dates.ts";

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
