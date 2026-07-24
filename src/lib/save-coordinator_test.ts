import { deepStrictEqual, equal } from "node:assert/strict";

import { SaveCoordinator, type SaveStatus } from "./save-coordinator.ts";

Deno.test("changes during a save trigger exactly one follow-up save", async () => {
  let source = "one";
  let release!: () => void;
  const firstSave = new Promise<void>((resolve) => (release = resolve));
  const inputs: string[] = [];
  const statuses: SaveStatus[] = [];
  const coordinator = new SaveCoordinator({
    snapshot: () => ({ id: "pages/a.md", source }),
    save: async (input) => {
      inputs.push(input.source);
      if (inputs.length === 1) await firstSave;
      return { revision: `r${inputs.length}`, updatedAt: "now" };
    },
    status: (status) => statuses.push(status),
    saved: () => undefined,
    failed: () => undefined,
  });
  coordinator.reset("r0");
  coordinator.changed();
  const flushing = coordinator.flush();
  source = "two";
  coordinator.changed();
  release();
  equal(await flushing, true);
  deepStrictEqual(inputs, ["one", "two"]);
  equal(statuses.at(-1), "saved");
});

Deno.test("errors retain dirty content and conflicts block retries", async () => {
  let calls = 0;
  let errorName = "Error";
  const coordinator = new SaveCoordinator({
    snapshot: () => ({ id: "pages/a.md", source: "local" }),
    save: () => {
      calls++;
      return Promise.reject(
        Object.assign(new Error("no"), { name: errorName }),
      );
    },
    status: () => undefined,
    saved: () => undefined,
    failed: () => undefined,
  });
  coordinator.reset("r0");
  coordinator.changed();
  equal(await coordinator.flush(), false);
  equal(coordinator.dirty, true);

  errorName = "Conflict";
  equal(await coordinator.flush(), false);
  equal(await coordinator.flush(), false);
  equal(calls, 2);
});

Deno.test("pre-save failure prevents writing", async () => {
  let saves = 0;
  const coordinator = new SaveCoordinator({
    prepare: () => {
      throw new Error("whiteboard serialization failed");
    },
    snapshot: () => ({ id: "pages/a.md", source: "local" }),
    save: () => {
      saves++;
      return Promise.resolve({ revision: "r1", updatedAt: "now" });
    },
    status: () => undefined,
    saved: () => undefined,
    failed: () => undefined,
  });
  coordinator.reset("r0");
  coordinator.changed();

  equal(await coordinator.flush(), false);
  equal(saves, 0);
  equal(coordinator.dirty, true);
});
