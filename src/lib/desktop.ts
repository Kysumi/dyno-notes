import type { DesktopBindings } from "./contracts.ts";

function host(): DesktopBindings {
  const desktopBindings =
    (globalThis as typeof globalThis & { bindings?: DesktopBindings }).bindings;
  if (!desktopBindings) {
    const error = new Error("Run `deno task desktop:dev` to use Dyno Notes.");
    error.name = "DesktopUnavailable";
    throw error;
  }
  return desktopBindings;
}

async function call<TResult>(
  operation: () => Promise<TResult>,
): Promise<TResult> {
  try {
    return await operation();
  } catch (value) {
    if (value instanceof Error) throw value;
    const source = value as { name?: unknown; message?: unknown };
    const error = new Error(
      typeof source?.message === "string"
        ? source.message
        : "The request could not be completed.",
    );
    if (typeof source?.name === "string") error.name = source.name;
    throw error;
  }
}

export const desktop: DesktopBindings = {
  workspaceInfo: () => call(() => host().workspaceInfo()),
  notesList: () => call(() => host().notesList()),
  notesRead: (id) => call(() => host().notesRead(id)),
  notesCreate: (input) => call(() => host().notesCreate(input)),
  notesSave: (input) => call(() => host().notesSave(input)),
  notesImport: (files) => call(() => host().notesImport(files)),
  notesBacklinks: (input) => call(() => host().notesBacklinks(input)),
  notesSearch: (query) => call(() => host().notesSearch(query)),
};
