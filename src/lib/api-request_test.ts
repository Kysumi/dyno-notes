import { equal } from "node:assert/strict";

import { rejectInvalidApiRequest } from "./api-request.ts";

function request(
  method = "POST",
  headers: HeadersInit = { "content-type": "application/json" },
): Request {
  return new Request("http://127.0.0.1:8000/api/test", { method, headers });
}

Deno.test("API request guard accepts same-origin JSON POST", () => {
  equal(
    rejectInvalidApiRequest(
      request("POST", {
        "content-type": "application/json; charset=utf-8",
        origin: "http://127.0.0.1:8000",
        "sec-fetch-site": "same-origin",
      }),
    ),
    null,
  );
});

Deno.test("API request guard rejects unsafe methods and browser origins", async (t) => {
  await t.step("method", () => {
    const response = rejectInvalidApiRequest(request("GET"))!;
    equal(response.status, 405);
    equal(response.headers.get("allow"), "POST");
  });
  await t.step("content type", () => {
    equal(
      rejectInvalidApiRequest(request("POST", { "content-type": "text/plain" }))
        ?.status,
      415,
    );
  });
  await t.step("origin", () => {
    equal(
      rejectInvalidApiRequest(
        request("POST", {
          "content-type": "application/json",
          origin: "http://example.com",
        }),
      )?.status,
      403,
    );
  });
  await t.step("fetch site", () => {
    equal(
      rejectInvalidApiRequest(
        request("POST", {
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      )?.status,
      403,
    );
  });
});
