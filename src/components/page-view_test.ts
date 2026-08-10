import { strictEqual } from "node:assert/strict";

import type { NoteSummary } from "../lib/contracts.ts";
import type { PageViewFilters } from "./notes-provider.tsx";
import {
  noteMatchesFilters,
  taskMatchesDeadlineFilters,
  viewSummary,
} from "./page-view.tsx";

Deno.test("view summaries report page and task counts", () => {
  strictEqual(viewSummary("pages", 1, 1, []), "1 of 1 page.");
  strictEqual(
    viewSummary("tasks", 2, 3, [
      { noteId: "pages/one.md" },
      { noteId: "pages/one.md" },
    ]),
    "2 tasks across 1 page.",
  );
  strictEqual(
    viewSummary("tasks", 1, 3, [{ noteId: "pages/one.md" }]),
    "1 task across 1 page.",
  );
});

Deno.test("overdue filters exclude upcoming and completed tasks", () => {
  const now = new Date(2026, 6, 25, 12).getTime();
  const filters = { dueSoon: false, overdue: true };
  const matches = (checked: boolean, deadline: string) =>
    taskMatchesDeadlineFilters({ checked, deadline }, filters, now, now);
  strictEqual(matches(false, "2026-07-25T11:59"), true);
  strictEqual(matches(false, "2026-07-25T12:01"), false);
  strictEqual(matches(true, "2026-07-25T11:59"), false);
});

Deno.test("block type filtering combines with existing note filters", () => {
  const filters: PageViewFilters = {
    query: "sketch",
    hasOpenTasks: false,
    dueSoon: false,
    overdue: false,
    tag: "project",
    attributeKey: null,
    blockType: "tldraw",
    showAs: "pages",
  };
  const note = (overrides: Partial<NoteSummary> = {}): NoteSummary => ({
    id: "pages/sketch.md",
    kind: "page",
    title: "Sketch",
    updatedAt: "2026-08-10T00:00:00.000Z",
    wordCount: 1,
    tags: ["project"],
    attributes: {},
    blockTypes: ["tldraw"],
    openTasks: 0,
    completedTasks: 0,
    ...overrides,
  });

  strictEqual(noteMatchesFilters(note(), filters), true);
  strictEqual(
    noteMatchesFilters(note({ blockTypes: ["codeBlock"] }), filters),
    false,
  );
  strictEqual(noteMatchesFilters(note({ tags: [] }), filters), false);
});
