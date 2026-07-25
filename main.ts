/// <reference lib="deno.ns" />

import { existsSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

import { AppError, resolveHomeDir, Workspace } from "./src/host.ts";
import { rejectInvalidApiRequest } from "./src/lib/api-request.ts";
import { base64ToBytes } from "./src/lib/base64.ts";
import { deadlineTimestamp, formatDeadline } from "./src/lib/dates.ts";

interface DesktopWindow extends EventTarget {
  close(): void;
  focus(): void;
  executeJs(script: string): Promise<unknown>;
}

const BrowserWindow = (
  Deno as unknown as {
    BrowserWindow: new (options?: Record<string, unknown>) => DesktopWindow;
  }
).BrowserWindow;

const CHANGE_SCRIPT =
  'window.dispatchEvent(new Event("dyno:workspace-change"))';
const WATCHER_ERROR_SCRIPT =
  'window.dispatchEvent(new Event("dyno:watcher-error"))';
const FLUSH_SCRIPT = `
  (async () => {
    try {
      if (globalThis.__dynoFlush && !await globalThis.__dynoFlush()) return;
      await fetch('/api/windowReadyToClose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '[]',
      });
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

interface AppConfig {
  notesPath: string;
}

function appConfigPath(): string {
  return join(resolveHomeDir(), ".dyno-notes.json");
}

function readAppConfig(): AppConfig | null {
  try {
    const parsed = JSON.parse(Deno.readTextFileSync(appConfigPath()));
    return typeof parsed?.notesPath === "string" && parsed.notesPath
      ? { notesPath: parsed.notesPath }
      : null;
  } catch {
    return null;
  }
}

function writeAppConfig(config: AppConfig): void {
  Deno.writeTextFileSync(appConfigPath(), JSON.stringify(config));
}

function expandNotesPath(input: string): string {
  const trimmed = input.trim();
  if (trimmed === "~") return resolveHomeDir();
  if (trimmed.startsWith("~/")) {
    return join(resolveHomeDir(), trimmed.slice(2));
  }
  return trimmed;
}

let startupError: AppError | undefined;
let resolveWorkspacePromise: ((workspace: Workspace) => void) | undefined;

let appConfig = readAppConfig();
let workspacePromise: Promise<Workspace | undefined> = appConfig
  ? Workspace.open(appConfig.notesPath).catch((error) => {
      console.error("Workspace startup failed", error);
      startupError =
        error instanceof AppError
          ? error
          : new AppError(
              "WorkspaceUnavailable",
              "The Dyno Notes workspace could not be opened.",
            );
      return undefined;
    })
  : new Promise<Workspace>((resolve) => {
      resolveWorkspacePromise = resolve;
    });

async function requireWorkspace(): Promise<Workspace> {
  const workspace = await workspacePromise;
  if (workspace) return workspace;
  throw startupError!;
}

function activateWorkspace(workspace: Workspace): void {
  const resolvePendingWorkspace = resolveWorkspacePromise;
  resolveWorkspacePromise = undefined;
  workspacePromise = Promise.resolve(workspace);
  notifiedTasks.clear();
  if (resolvePendingWorkspace) resolvePendingWorkspace(workspace);
  else watchWorkspace(workspace);
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
  notesTrash: async (id: string) => (await requireWorkspace()).trash(id),
  trashList: async () => (await requireWorkspace()).listTrash(),
  trashRestore: async (id: string) => (await requireWorkspace()).restore(id),
  trashDelete: async (id: string) => (await requireWorkspace()).deleteTrash(id),
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
  settingsGet: async () => (await requireWorkspace()).readSettings(),
  settingsSave: async (input: Parameters<Workspace["saveSettings"]>[0]) =>
    (await requireWorkspace()).saveSettings(input),
  appConfigGet: async () => ({
    notesPath: appConfig?.notesPath ?? null,
    suggestedPath: join(resolveHomeDir(), "Dyno Notes"),
  }),
  appConfigSet: async (input?: {
    notesPath?: unknown;
    moveNotes?: unknown;
  }) => {
    if (typeof input?.notesPath !== "string") {
      throw new AppError("InvalidInput", "Choose a folder for your notes.");
    }
    if (input.moveNotes !== undefined && typeof input.moveNotes !== "boolean") {
      throw new AppError("InvalidInput", "The move option is invalid.");
    }
    const expanded = expandNotesPath(input.notesPath);
    if (!expanded) {
      throw new AppError("InvalidInput", "Choose a folder for your notes.");
    }
    if (!isAbsolute(expanded)) {
      throw new AppError(
        "InvalidInput",
        "Enter an absolute folder path (e.g. /Users/you/Notes).",
      );
    }

    const currentWorkspace = appConfig ? await requireWorkspace() : undefined;
    if (
      currentWorkspace &&
      resolve(currentWorkspace.path) === resolve(expanded)
    ) {
      return { notesPath: currentWorkspace.path, oldPathRetained: null };
    }
    if (input.moveNotes && !currentWorkspace) {
      throw new AppError(
        "InvalidInput",
        "There are no existing notes to move.",
      );
    }

    const workspace = input.moveNotes
      ? await currentWorkspace!.copyTo(expanded)
      : await Workspace.open(expanded);
    try {
      writeAppConfig({ notesPath: workspace.path });
    } catch (error) {
      if (input.moveNotes) {
        await Deno.remove(workspace.path, { recursive: true }).catch(
          () => undefined,
        );
      }
      throw error;
    }
    appConfig = { notesPath: workspace.path };
    activateWorkspace(workspace);

    let oldPathRetained: string | null = null;
    if (input.moveNotes && currentWorkspace) {
      try {
        await Deno.remove(currentWorkspace.path, { recursive: true });
      } catch {
        oldPathRetained = currentWorkspace.path;
      }
    }
    return { notesPath: workspace.path, oldPathRetained };
  },
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
  const rejection = rejectInvalidApiRequest(request);
  if (rejection) return rejection;

  const handler = api[name];
  if (!handler) {
    return json({ ok: false, message: "Unknown API route." }, { status: 404 });
  }
  try {
    const args = await request.json();
    const result = await handler(
      ...((Array.isArray(args) ? args : []) as never[]),
    );
    return json({ ok: true, result });
  } catch (error) {
    console.error(error);
    const appError =
      error instanceof AppError
        ? error
        : new AppError("InvalidInput", "The request could not be completed.");
    return json(
      { ok: false, name: appError.name, message: appError.message },
      {
        status: 400,
      },
    );
  }
}

// ponytail: checked on save and every 30 minutes; add snooze/config knobs
// when someone actually wants them.
const notifiedTasks = new Set<string>();

async function ensureNotificationPermission(): Promise<boolean> {
  if (Notification.permission === "denied") return false;
  if (Notification.permission === "granted") return true;
  return (await Notification.requestPermission()) === "granted";
}

async function checkTaskDeadlines(): Promise<void> {
  const workspace = await workspacePromise;
  if (!workspace) return;
  const { dueSoonHours, notificationsEnabled } = await workspace.readSettings();
  if (!notificationsEnabled || !(await ensureNotificationPermission())) return;
  const windowMs = dueSoonHours * 60 * 60 * 1000;
  const now = Date.now();
  for (const task of workspace.tasks()) {
    if (task.checked || !task.deadline || notifiedTasks.has(task.id)) continue;
    const due = deadlineTimestamp(task.deadline);
    if (due - now > windowMs) continue;
    notifiedTasks.add(task.id);
    const notification = new Notification(
      due < now ? "Task overdue" : "Task due soon",
      {
        body: `${task.text} — ${task.noteTitle} (${formatDeadline(task.deadline)})`,
        tag: task.id,
      },
    );
    notification.addEventListener("click", () => win.focus());
  }
}

let watcher: Deno.FsWatcher | undefined;
function watchWorkspace(workspace: Workspace): void {
  watcher?.close();
  watcher = workspace.watch(
    () => {
      void win.executeJs(CHANGE_SCRIPT).catch(() => undefined);
      void checkTaskDeadlines();
    },
    () => void win.executeJs(WATCHER_ERROR_SCRIPT).catch(() => undefined),
  );
  void checkTaskDeadlines();
}

void workspacePromise.then((workspace) => {
  if (workspace) watchWorkspace(workspace);
});
setInterval(() => void checkTaskDeadlines(), 30 * 60 * 1000);

// `deno desktop` compiles main.ts into a bundle run from a cache dir, so
// import.meta.dirname points at the embedded dist/ when built with
// `--include dist`. In `--hmr` dev mode nothing is embedded, so fall back to
// the real dist/ on disk next to the source.
const embeddedDist = resolve(import.meta.dirname!, "dist");
const dist = existsSync(embeddedDist)
  ? embeddedDist
  : resolve(Deno.cwd(), "dist");

async function serve(request: Request): Promise<Response> {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(request.url).pathname);
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (pathname.startsWith("/api/")) {
    return serveApi(request, pathname.slice("/api/".length));
  }
  const requested =
    pathname === "/" || !extname(pathname) ? "index.html" : pathname.slice(1);
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
        "content-type":
          contentTypes[extname(path)] ?? "application/octet-stream",
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

const server = Deno.serve({ hostname: "127.0.0.1", port: 8000 }, serve);
let allowingClose = false;
win.addEventListener("close", (event) => {
  if (allowingClose) return;
  event.preventDefault();
  void win.executeJs(FLUSH_SCRIPT).catch((error) => {
    console.error("Failed to execute flush script", error);
  });
});
