import { strictEqual } from "node:assert/strict";

import { viewSummary } from "./page-view.tsx";

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
