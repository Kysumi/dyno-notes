/// <reference lib="deno.ns" />

import { extname, isAbsolute, join, relative, resolve } from "node:path";

import { AppError, Workspace } from "./src/host.ts";
import type { DesktopBindings } from "./src/lib/contracts.ts";

interface DesktopWindow extends EventTarget {
  bind<K extends keyof DesktopBindings>(
    name: K,
    handler: (
      ...args: Parameters<DesktopBindings[K]>
    ) => ReturnType<DesktopBindings[K]>,
  ): void;
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
const FLUSH_SCRIPT = "globalThis.__dynoFlush ? globalThis.__dynoFlush() : true";
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

function safe<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult | Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return async (...args) => {
    try {
      return await handler(...args);
    } catch (error) {
      console.error(error);
      if (error instanceof AppError) throw error;
      throw new AppError("InvalidInput", "The request could not be completed.");
    }
  };
}

const win = new BrowserWindow({
  title: "Dyno Notes",
  width: 1280,
  height: 800,
});
win.bind(
  "workspaceInfo",
  safe(async () => ({ path: (await requireWorkspace()).path })),
);
win.bind("notesList", safe(async () => (await requireWorkspace()).list()));
win.bind("notesRead", safe(async (id) => (await requireWorkspace()).read(id)));
win.bind(
  "notesCreate",
  safe(async (input) => (await requireWorkspace()).create(input)),
);
win.bind(
  "notesSave",
  safe(async (input) => (await requireWorkspace()).save(input)),
);
win.bind(
  "notesImport",
  safe(async (files) => (await requireWorkspace()).import(files)),
);
win.bind(
  "notesBacklinks",
  safe(async (input) => (await requireWorkspace()).backlinks(input)),
);
win.bind(
  "notesSearch",
  safe(async (query) => (await requireWorkspace()).search(query)),
);

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
  void (async () => {
    try {
      if (await win.executeJs(FLUSH_SCRIPT) !== true) return;
    } catch (error) {
      console.error("Could not flush the active note", error);
      return;
    }
    allowingClose = true;
    watcher?.close();
    win.close();
    await server.shutdown();
  })();
});
