import type { DesktopBindings } from "./contracts.ts";
import { bytesToBase64 } from "./base64.ts";

interface ApiEnvelope<TResult> {
  ok: boolean;
  result?: TResult;
  name?: string;
  message?: string;
}

async function call<TResult>(name: string, args: unknown[]): Promise<TResult> {
  let response: Response;
  try {
    response = await fetch(`/api/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(args),
    });
  } catch {
    const error = new Error("Dyno Notes could not reach its local server.");
    error.name = "DesktopUnavailable";
    throw error;
  }
  const payload = (await response.json()) as ApiEnvelope<TResult>;
  if (!payload.ok) {
    const error = new Error(
      payload.message ?? "The request could not be completed.",
    );
    if (payload.name) error.name = payload.name;
    throw error;
  }
  return payload.result as TResult;
}

export const desktop: DesktopBindings = {
  workspaceInfo: () => call("workspaceInfo", []),
  notesList: () => call("notesList", []),
  notesRead: (id) => call("notesRead", [id]),
  notesCreate: (input) => call("notesCreate", [input]),
  notesSave: (input) => call("notesSave", [input]),
  notesTrash: (id) => call("notesTrash", [id]),
  trashList: () => call("trashList", []),
  trashRestore: (id) => call("trashRestore", [id]),
  trashDelete: (id) => call("trashDelete", [id]),
  notesImport: (files) =>
    call("notesImport", [
      files.map((file) => ({
        name: file.name,
        bytes: bytesToBase64(file.bytes),
      })),
    ]),
  notesBacklinks: (input) => call("notesBacklinks", [input]),
  notesSearch: (query) => call("notesSearch", [query]),
  tasksList: () => call("tasksList", []),
};
