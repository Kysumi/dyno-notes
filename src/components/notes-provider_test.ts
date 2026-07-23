import { deepStrictEqual, strictEqual } from "node:assert/strict";

import { pushNavigationHistory } from "./notes-provider.tsx";

Deno.test("navigation history ignores duplicates and drops the forward branch", () => {
  const first = pushNavigationHistory({ entries: [], index: -1 }, {
    id: "pages/one.md",
  });
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
