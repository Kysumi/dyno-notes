/// <reference lib="deno.ns" />

import { extname, isAbsolute, join, relative, resolve } from "node:path";

import { AppError, Workspace } from "./src/host.ts";
import { base64ToBytes } from "./src/lib/base64.ts";

interface DesktopWindow extends EventTarget {
  close(): void;
  executeJs(script: string): Promise<unknown>;
}

const BrowserWindow = (Deno as unknown as {
  BrowserWindow: new (options?: Record<string, unknown>) => DesktopWindow;
}).BrowserWindow;

const CHANGE_SCRIPT =
  'window.dispatchEvent(new Event("dyno:workspace-change"))';
const WATCHER_ERROR_SCRIPT =
  'window.dispatchEvent(new Event("dyno:watcher-error"))';
const FLUSH_SCRIPT = `
  (async () => {
    try {
      if (globalThis.__dynoFlush) {
        await globalThis.__dynoFlush();
      }
      await fetch('/api/windowReadyToClose', { method: 'POST', body: '[]' });
    } catch (error) {
      console.error("Could not flush the active note", error);
    }
  })();
`;
const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

let startupError: AppError | undefined;
const workspacePromise = Promise.resolve().then(() => Workspace.open()).catch(
  (error) => {
    console.error("Workspace startup failed", error);
    startupError = error instanceof AppError ? error : new AppError(
      "WorkspaceUnavailable",
      "The Dyno Notes workspace could not be opened.",
    );
  },
);

async function requireWorkspace(): Promise<Workspace> {
  const workspace = await workspacePromise;
  if (workspace) return workspace;
  throw startupError!;
}

const win = new BrowserWindow({
  title: "Dyno Notes",
  width: 1280,
  height: 800,
});

type ImportFilePayload = { name: string; bytes: string };

// All renderer <-> host calls go over plain fetch(), not Deno Desktop's
// win.bind() bridge: the bridge's per-window callback registration races the
// webview's own page load and can leave a binding unavailable indefinitely.
const api: Record<string, (...args: never[]) => Promise<unknown>> = {
  workspaceInfo: async () => ({ path: (await requireWorkspace()).path }),
  notesList: async () => (await requireWorkspace()).list(),
  notesRead: async (id: string) => (await requireWorkspace()).read(id),
  notesCreate: async (input: Parameters<Workspace["create"]>[0]) =>
    (await requireWorkspace()).create(input),
  notesSave: async (input: Parameters<Workspace["save"]>[0]) =>
    (await requireWorkspace()).save(input),
  notesDelete: async (id: string) =>
    (await requireWorkspace()).delete(id),
  notesImport: async (files: ImportFilePayload[]) =>
    (await requireWorkspace()).import(
      files.map((file) => ({
        name: file.name,
        bytes: base64ToBytes(file.bytes),
      })),
    ),
  notesBacklinks: async (input: Parameters<Workspace["backlinks"]>[0]) =>
    (await requireWorkspace()).backlinks(input),
  notesSearch: async (query: string) =>
    (await requireWorkspace()).search(query),
  tasksList: async () => (await requireWorkspace()).tasks(),
  windowReadyToClose: async () => {
    allowingClose = true;
    watcher?.close();
    win.close();
    await server.shutdown();
    return true;
  },
};

function json(data: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...init?.headers },
  });
}

async function serveApi(request: Request, name: string): Promise<Response> {
  const handler = api[name];
  if (!handler) {
    return json({ ok: false, message: "Unknown API route." }, { status: 404 });
  }
  try {
    const args = request.method === "POST" ? await request.json() : [];
    const result = await handler(
      ...(Array.isArray(args) ? args : []) as never[],
    );
    return json({ ok: true, result });
  } catch (error) {
    console.error(error);
    const appError = error instanceof AppError
      ? error
      : new AppError("InvalidInput", "The request could not be completed.");
    return json({ ok: false, name: appError.name, message: appError.message }, {
      status: 400,
    });
  }
}

let watcher: Deno.FsWatcher | undefined;
void workspacePromise.then((workspace) => {
  watcher = workspace?.watch(
    () => void win.executeJs(CHANGE_SCRIPT).catch(() => undefined),
    () => void win.executeJs(WATCHER_ERROR_SCRIPT).catch(() => undefined),
  );
});

async function serve(request: Request): Promise<Response> {
  const dist = resolve(Deno.cwd(), "dist");
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (pathname.startsWith("/api/")) {
    return serveApi(request, pathname.slice("/api/".length));
  }
  const requested = pathname === "/" || !extname(pathname)
    ? "index.html"
    : pathname.slice(1);
  const path = resolve(dist, requested);
  const pathFromDist = relative(dist, path);
  if (pathFromDist.startsWith("..") || isAbsolute(pathFromDist)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await Deno.open(path, { read: true });
    if (request.method === "HEAD") file.close();
    return new Response(request.method === "HEAD" ? null : file.readable, {
      headers: {
        "content-type": contentTypes[extname(path)] ??
          "application/octet-stream",
      },
    });
  } catch (error) {
    if (error instanceof Deno.errors.NotFound && requested !== "index.html") {
      try {
        const file = await Deno.open(join(dist, "index.html"), { read: true });
        if (request.method === "HEAD") file.close();
        return new Response(request.method === "HEAD" ? null : file.readable, {
          headers: { "content-type": contentTypes[".html"] },
        });
      } catch {
        // Vite's development middleware handles requests before this fallback.
      }
    }
    return new Response("Not found", { status: 404 });
  }
}

const server = Deno.serve(serve);
let allowingClose = false;
win.addEventListener("close", (event) => {
  if (allowingClose) return;
  event.preventDefault();
  void win.executeJs(FLUSH_SCRIPT).catch((error) => {
    console.error("Failed to execute flush script", error);
  });
});
