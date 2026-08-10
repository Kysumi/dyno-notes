import { deepStrictEqual, strictEqual } from "node:assert/strict";

import {
  pushNavigationHistory,
  removeNavigationHistory,
  updatePageViewFilters,
} from "./notes-provider.tsx";

Deno.test("navigation history ignores duplicates and drops the forward branch", () => {
  const first = pushNavigationHistory(
    { entries: [], index: -1 },
    {
      id: "pages/one.md",
    },
  );
  strictEqual(pushNavigationHistory(first, { id: "pages/one.md" }), first);

  const second = pushNavigationHistory(first, { id: "pages/two.md" });
  deepStrictEqual(
    pushNavigationHistory({ ...second, index: 0 }, { id: "pages/three.md" }),
    {
      entries: [{ id: "pages/one.md" }, { id: "pages/three.md" }],
      index: 1,
    },
  );
});

Deno.test("removing a note from history records its fallback", () => {
  deepStrictEqual(
    removeNavigationHistory(
      {
        entries: [
          { id: "pages/one.md" },
          { id: "pages/deleted.md" },
          { id: "pages/future.md" },
        ],
        index: 1,
      },
      "pages/deleted.md",
      { id: "pages/fallback.md" },
    ),
    {
      entries: [{ id: "pages/one.md" }, { id: "pages/fallback.md" }],
      index: 1,
    },
  );
});

Deno.test("view filter changes update only the selected custom view", () => {
  const original = [
    {
      id: "one",
      name: "One",
      filters: {
        query: "",
        hasOpenTasks: false,
        dueSoon: false,
        overdue: false,
        tag: null,
        attributeKey: null,
        blockType: null,
        showAs: "pages" as const,
      },
      custom: true,
    },
    {
      id: "two",
      name: "Two",
      filters: {
        query: "",
        hasOpenTasks: false,
        dueSoon: false,
        overdue: false,
        tag: null,
        attributeKey: null,
        blockType: null,
        showAs: "pages" as const,
      },
      custom: true,
    },
  ];
  const updated = updatePageViewFilters(original, "one", {
    ...original[0].filters,
    tag: "project",
    blockType: "tldraw",
  });

  strictEqual(updated[0].filters.tag, "project");
  strictEqual(updated[0].filters.blockType, "tldraw");
  strictEqual(updated[1], original[1]);
});
