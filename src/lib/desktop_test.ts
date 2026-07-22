import { deepStrictEqual, equal, rejects } from "node:assert/strict";

import { desktop } from "./desktop.ts";

async function withFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response,
  run: () => Promise<void>,
): Promise<void> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    Promise.resolve(handler(input, init))) as typeof fetch;
  try {
    await run();
  } finally {
    globalThis.fetch = original;
  }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.test("desktop posts to the matching /api/<name> route and returns the result", () =>
  withFetch(
    (input, init) => {
      equal(String(input), "/api/notesList");
      equal(init?.method, "POST");
      deepStrictEqual(JSON.parse(String(init?.body)), []);
      return json({ ok: true, result: [] });
    },
    async () => {
      deepStrictEqual(await desktop.notesList(), []);
    },
  ));

Deno.test("desktop forwards call arguments as a JSON array body", () =>
  withFetch(
    (input, init) => {
      equal(String(input), "/api/notesRead");
      deepStrictEqual(JSON.parse(String(init?.body)), ["pages/a.md"]);
      return json({ ok: true, result: { id: "pages/a.md" } });
    },
    async () => {
      deepStrictEqual(await desktop.notesRead("pages/a.md"), {
        id: "pages/a.md",
      });
    },
  ));

Deno.test("desktop raises a named error when the API reports failure", () =>
  withFetch(
    () => json({ ok: false, name: "NotFound", message: "gone" }, 400),
    async () => {
      await rejects(() => desktop.notesRead("pages/a.md"), (error: unknown) => {
        equal((error as Error).name, "NotFound");
        equal((error as Error).message, "gone");
        return true;
      });
    },
  ));

Deno.test("desktop raises DesktopUnavailable when the server can't be reached", () =>
  withFetch(
    () => {
      throw new TypeError("network error");
    },
    async () => {
      await rejects(() => desktop.notesList(), (error: unknown) => {
        equal((error as Error).name, "DesktopUnavailable");
        return true;
      });
    },
  ));
