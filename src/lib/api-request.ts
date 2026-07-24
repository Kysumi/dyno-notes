function jsonError(message: string, init: ResponseInit): Response {
  return new Response(JSON.stringify({ ok: false, message }), {
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

export function rejectInvalidApiRequest(request: Request): Response | null {
  if (request.method !== "POST") {
    return jsonError("API requests must use POST.", {
      status: 405,
      headers: { allow: "POST" },
    });
  }

  if (
    request.headers
      .get("content-type")
      ?.split(";", 1)[0]
      .trim()
      .toLocaleLowerCase() !== "application/json"
  ) {
    return jsonError("API requests must contain JSON.", { status: 415 });
  }

  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return jsonError("Cross-origin API requests are not allowed.", {
      status: 403,
    });
  }

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") {
    return jsonError("Cross-site API requests are not allowed.", {
      status: 403,
    });
  }

  return null;
}
