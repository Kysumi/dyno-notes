import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
  win32,
} from "node:path";

import type {
  Backlink,
  NoteFile,
  NoteId,
  NoteKind,
  NoteSummary,
  SearchResult,
} from "./lib/contracts.ts";
import {
  type IndexedMarkdown,
  normalizeSearchText,
  noteTarget,
  scanMarkdown,
} from "./lib/markdown-scanner.ts";

const MAX_BYTES = 10 * 1024 * 1024;
const TEMP_PREFIX = ".dyno-";
const TEMP_SUFFIX = ".tmp";
const decoder = new TextDecoder("utf-8", { fatal: true });
const encoder = new TextEncoder();

type ErrorName =
  | "InvalidNoteId"
  | "InvalidInput"
  | "NotFound"
  | "Conflict"
  | "TooLarge"
  | "InvalidEncoding"
  | "UnsupportedMarkdown"
  | "WorkspaceUnavailable";

export class AppError extends Error {
  constructor(name: ErrorName, message: string) {
    super(message);
    this.name = name;
  }
}

interface IndexedNote {
  summary: NoteSummary;
  markdown: IndexedMarkdown;
}

interface Writer {
  write(bytes: Uint8Array): Promise<number>;
}

function isMissing(error: unknown): boolean {
  return error instanceof Deno.errors.NotFound;
}

function ensureContained(parent: string, child: string): void {
  const path = relative(parent, child);
  if (
    path === "" ||
    (!path.startsWith(`..${sep}`) && path !== ".." && !isAbsolute(path))
  ) {
    return;
  }
  throw new AppError("InvalidNoteId", "The note ID is outside the workspace.");
}

function noteKind(id: NoteId): NoteKind {
  return id.startsWith("journals/") ? "journal" : "page";
}

function indexedTitle(id: NoteId, markdown: IndexedMarkdown): string {
  return markdown.hasTitle ? markdown.title : basename(id).slice(0, -3);
}

function detectEol(source: string): "\n" | "\r\n" {
  return source.includes("\r\n") ? "\r\n" : "\n";
}

function normalizedSource(source: string, eol: "\n" | "\r\n"): string {
  const lf = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n").replace(
    /\n+$/u,
    "",
  );
  return `${lf}\n`.replaceAll("\n", eol);
}

function validateTitle(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("InvalidInput", "A title is required.");
  }
  const title = value.trim();
  if (!title || /[\r\n]/u.test(title)) {
    throw new AppError("InvalidInput", "Enter a single-line title.");
  }
  if ([...title].length > 200) {
    throw new AppError(
      "InvalidInput",
      "Titles must be 200 characters or fewer.",
    );
  }
  return title;
}

export function slugify(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(bytes)),
  );
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function writeAll(
  writer: Writer,
  bytes: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < bytes.length) {
    const written = await writer.write(bytes.subarray(offset));
    if (written <= 0) throw new Error("Failed to finish writing the note.");
    offset += written;
  }
}

function strictText(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_BYTES) {
    throw new AppError("TooLarge", "Notes must be smaller than 10 MiB.");
  }
  try {
    return decoder.decode(bytes);
  } catch {
    throw new AppError("InvalidEncoding", "The file is not valid UTF-8 text.");
  }
}

function validateSource(value: unknown): string {
  if (typeof value !== "string") {
    throw new AppError("InvalidInput", "Note contents must be text.");
  }
  if (encoder.encode(value).byteLength > MAX_BYTES) {
    throw new AppError("TooLarge", "Notes must be smaller than 10 MiB.");
  }
  return value;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  return new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isManagedId(id: string): boolean {
  return /^(?:pages|journals)\/(?!.*(?:^|\/)\.{1,2}(?:\/|$))[^\0\\]+\.md$/iu
    .test(id) &&
    !id.split("/").some((part) => part.startsWith("."));
}

function bodyExcerpt(text: string, query: string): string {
  if (!text) return "";
  const index = normalizeSearchText(text).indexOf(query);
  if (index < 0) return text.length <= 160 ? text : `${text.slice(0, 157)}…`;
  const start = Math.max(0, index - 60);
  const excerpt = text.slice(start, start + 160).trim();
  return `${start ? "…" : ""}${excerpt}${start + 160 < text.length ? "…" : ""}`;
}

export class Workspace {
  readonly path: string;
  readonly #notes = new Map<NoteId, IndexedNote>();
  readonly #backlinks = new Map<string, Backlink[]>();
  readonly #rootReal: string;
  #writeQueue: Promise<void> = Promise.resolve();

  private constructor(path: string, rootReal: string) {
    this.path = path;
    this.#rootReal = rootReal;
  }

  static async open(path?: string): Promise<Workspace> {
    let root = path;
    if (!root) {
      const home = Deno.env.get("HOME") ?? Deno.env.get("USERPROFILE");
      if (!home) {
        throw new AppError(
          "WorkspaceUnavailable",
          "The operating-system home directory could not be resolved.",
        );
      }
      root = join(home, "Dyno Notes");
    }

    try {
      await Deno.mkdir(join(root, "pages"), { recursive: true });
      await Deno.mkdir(join(root, "journals"), { recursive: true });
      const workspace = new Workspace(root, await Deno.realPath(root));
      await workspace.#assertManagedDirectories();
      await workspace.cleanupTemporaryFiles();
      await workspace.rebuildIndex();
      return workspace;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(
        "WorkspaceUnavailable",
        "The Dyno Notes workspace could not be opened.",
      );
    }
  }

  async #assertManagedDirectories(): Promise<void> {
    for (const name of ["pages", "journals"]) {
      const info = await Deno.lstat(join(this.path, name));
      if (info.isSymlink || !info.isDirectory) {
        throw new AppError(
          "WorkspaceUnavailable",
          `The workspace ${name} directory is not safe to use.`,
        );
      }
    }
  }

  #validateId(id: unknown): asserts id is NoteId {
    if (
      typeof id !== "string" || !id || id.includes("\0") || id.includes("\\") ||
      isAbsolute(id) || win32.isAbsolute(id) || !isManagedId(id) ||
      id.split("/").some((part) => part === "." || part === "..")
    ) {
      throw new AppError("InvalidNoteId", "The note ID is invalid.");
    }
  }

  async #resolveId(id: unknown, mustExist = true): Promise<string> {
    this.#validateId(id);
    const target = resolve(this.#rootReal, id);
    ensureContained(this.#rootReal, target);

    let current = this.path;
    const parts = id.split("/").slice(0, -1);
    for (const part of parts) {
      current = join(current, part);
      const info = await Deno.lstat(current).catch((error) => {
        if (isMissing(error)) {
          throw new AppError(
            "NotFound",
            "The note directory no longer exists.",
          );
        }
        throw error;
      });
      if (info.isSymlink || !info.isDirectory) {
        throw new AppError(
          "InvalidNoteId",
          "Symlink note directories are not allowed.",
        );
      }
    }

    const parentReal = await Deno.realPath(dirname(target));
    ensureContained(this.#rootReal, parentReal);

    try {
      const info = await Deno.lstat(target);
      if (info.isSymlink || !info.isFile) {
        throw new AppError(
          "InvalidNoteId",
          "Only regular Markdown files can be opened.",
        );
      }
    } catch (error) {
      if (!mustExist && isMissing(error)) return target;
      if (isMissing(error)) {
        throw new AppError("NotFound", "The note no longer exists.");
      }
      throw error;
    }

    return target;
  }

  async #walk(
    directory: string,
    prefix: string,
    output: NoteId[],
  ): Promise<void> {
    for await (const entry of Deno.readDir(directory)) {
      if (entry.name.startsWith(".")) continue;
      const path = join(directory, entry.name);
      const id = `${prefix}/${entry.name}`;
      if (entry.isSymlink) continue;
      if (entry.isDirectory) await this.#walk(path, id, output);
      else if (entry.isFile && entry.name.toLocaleLowerCase().endsWith(".md")) {
        output.push(id);
      }
    }
  }

  async #ids(): Promise<NoteId[]> {
    const ids: NoteId[] = [];
    await this.#walk(join(this.path, "pages"), "pages", ids);
    await this.#walk(join(this.path, "journals"), "journals", ids);
    return ids;
  }

  async #summary(id: NoteId, source: string): Promise<NoteSummary> {
    const markdown = scanMarkdown(source);
    const stat = await Deno.stat(await this.#resolveId(id));
    return {
      id,
      kind: noteKind(id),
      title: indexedTitle(id, markdown),
      updatedAt: (stat.mtime ?? new Date(0)).toISOString(),
      wordCount: markdown.wordCount,
    };
  }

  async read(id: NoteId): Promise<NoteFile> {
    const bytes = await Deno.readFile(await this.#resolveId(id));
    const source = strictText(bytes);
    return {
      id,
      kind: noteKind(id),
      title: indexedTitle(id, scanMarkdown(source)),
      source,
      revision: await hashBytes(bytes),
      eol: detectEol(source),
    };
  }

  list(): NoteSummary[] {
    return Array.from(this.#notes.values(), ({ summary }) => summary);
  }

  async create(
    input: { kind: NoteKind; title: string; date?: string },
  ): Promise<NoteFile> {
    if (!input || (input.kind !== "page" && input.kind !== "journal")) {
      throw new AppError("InvalidInput", "Choose a valid note type.");
    }

    const title = validateTitle(input.title);
    let id: NoteId;
    if (input.kind === "journal") {
      if (!validDate(input.date)) {
        throw new AppError(
          "InvalidInput",
          "Journal dates must use YYYY-MM-DD.",
        );
      }
      id = `journals/${input.date}.md`;
      try {
        return await this.read(id);
      } catch (error) {
        if (!(error instanceof AppError) || error.name !== "NotFound") {
          throw error;
        }
      }
    } else {
      const slug = slugify(title);
      id = `pages/${slug}.md`;
      let suffix = 2;
      while (true) {
        try {
          await Deno.lstat(resolve(this.path, id));
          id = `pages/${slug}-${suffix++}.md`;
        } catch (error) {
          if (isMissing(error)) break;
          throw error;
        }
      }
    }

    const target = await this.#resolveId(id, false);
    const file = await Deno.open(target, { write: true, createNew: true });
    try {
      await writeAll(file, encoder.encode(`# ${title}\n`));
      await file.sync();
    } finally {
      file.close();
    }
    await this.reindex(id);
    return await this.read(id);
  }

  save(
    input: { id: NoteId; source: string; expectedRevision: string },
  ): Promise<{ revision: string; updatedAt: string }> {
    const operation = this.#writeQueue.then(() => this.#save(input));
    this.#writeQueue = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async #save(
    input: { id: NoteId; source: string; expectedRevision: string },
  ): Promise<{ revision: string; updatedAt: string }> {
    if (!input || typeof input.expectedRevision !== "string") {
      throw new AppError("InvalidInput", "A note revision is required.");
    }
    const source = validateSource(input.source);
    const target = await this.#resolveId(input.id);
    const currentBytes = await Deno.readFile(target);
    if (await hashBytes(currentBytes) !== input.expectedRevision) {
      throw new AppError(
        "Conflict",
        "The note changed on disk. Choose which version to keep.",
      );
    }

    const eol = detectEol(strictText(currentBytes));
    const bytes = encoder.encode(normalizedSource(source, eol));
    const temp = join(
      dirname(target),
      `${TEMP_PREFIX}${crypto.randomUUID()}${TEMP_SUFFIX}`,
    );
    try {
      const file = await Deno.open(temp, { write: true, createNew: true });
      try {
        await writeAll(file, bytes);
        await file.sync();
      } finally {
        file.close();
      }

      if (
        await hashBytes(await Deno.readFile(target)) !== input.expectedRevision
      ) {
        throw new AppError(
          "Conflict",
          "The note changed on disk. Choose which version to keep.",
        );
      }
      await Deno.rename(temp, target);
    } finally {
      await Deno.remove(temp).catch((error) => {
        if (!isMissing(error)) throw error;
      });
    }

    await this.reindex(input.id);
    const stat = await Deno.stat(target);
    return {
      revision: await hashBytes(bytes),
      updatedAt: (stat.mtime ?? new Date()).toISOString(),
    };
  }

  async import(
    files: Array<{ name: string; bytes: Uint8Array }>,
  ): Promise<NoteSummary[]> {
    if (!Array.isArray(files)) {
      throw new AppError("InvalidInput", "Choose Markdown files to import.");
    }
    const imported: NoteSummary[] = [];

    for (const input of files) {
      if (
        !input || typeof input.name !== "string" ||
        !(input.bytes instanceof Uint8Array)
      ) {
        throw new AppError("InvalidInput", "The imported file is invalid.");
      }
      const source = strictText(input.bytes);
      const original = basename(input.name.replaceAll("\\", "/"));
      if (!original.toLocaleLowerCase().endsWith(".md")) {
        throw new AppError(
          "InvalidInput",
          "Only Markdown files can be imported.",
        );
      }
      const stem = original.slice(0, -3);
      const slug = slugify(stem);
      let id = `pages/${slug}.md`;
      let suffix = 2;
      while (true) {
        try {
          const file = await Deno.open(await this.#resolveId(id, false), {
            write: true,
            createNew: true,
          });
          try {
            await writeAll(file, input.bytes);
            await file.sync();
          } finally {
            file.close();
          }
          break;
        } catch (error) {
          if (error instanceof Deno.errors.AlreadyExists) {
            id = `pages/${slug}-${suffix++}.md`;
            continue;
          }
          throw error;
        }
      }
      await this.reindex(id);
      imported.push(await this.#summary(id, source));
    }

    return imported;
  }

  async rebuildIndex(): Promise<void> {
    this.#notes.clear();
    for (const id of await this.#ids()) {
      try {
        const source = strictText(
          await Deno.readFile(await this.#resolveId(id)),
        );
        this.#notes.set(id, {
          summary: await this.#summary(id, source),
          markdown: scanMarkdown(source),
        });
      } catch (error) {
        console.error(`Failed to index ${id}`, error);
      }
    }
    this.#rebuildBacklinks();
  }

  async reindex(id: NoteId): Promise<void> {
    this.#validateId(id);
    try {
      const source = strictText(await Deno.readFile(await this.#resolveId(id)));
      this.#notes.set(id, {
        summary: await this.#summary(id, source),
        markdown: scanMarkdown(source),
      });
    } catch (error) {
      this.#notes.delete(id);
      if (!(error instanceof AppError) || error.name !== "NotFound") {
        console.error(`Failed to index ${id}`, error);
      }
    }
    this.#rebuildBacklinks();
  }

  #resolveTarget(sourceId: NoteId, rawTarget: string): NoteId | null {
    if (!rawTarget) return sourceId;
    const target = rawTarget.normalize("NFC").replace(/\.md$/iu, "");
    const exact = Array.from(this.#notes.keys()).find((id) =>
      noteTarget(id).normalize("NFC") === target
    );
    if (exact) return exact;

    const normalizedTitle = normalizeSearchText(target);
    const matches = Array.from(this.#notes.entries())
      .filter(([, note]) =>
        normalizeSearchText(note.summary.title) === normalizedTitle
      )
      .map(([id]) => id);
    return matches.length === 1 ? matches[0] : null;
  }

  #rebuildBacklinks(): void {
    this.#backlinks.clear();
    for (const [sourceId, note] of this.#notes) {
      for (const link of note.markdown.links) {
        const targetId = this.#resolveTarget(sourceId, link.target);
        if (!targetId) continue;
        const backlink: Backlink = {
          sourceId,
          sourceTitle: note.summary.title,
          sourceBlockId: link.sourceBlockId,
          targetBlockId: link.targetBlockId,
          excerpt: link.excerpt,
        };
        const noteLinks = this.#backlinks.get(targetId) ?? [];
        noteLinks.push(backlink);
        this.#backlinks.set(targetId, noteLinks);
        if (link.targetBlockId) {
          const key = `${targetId}#^${link.targetBlockId}`;
          const blockLinks = this.#backlinks.get(key) ?? [];
          blockLinks.push(backlink);
          this.#backlinks.set(key, blockLinks);
        }
      }
    }
  }

  backlinks(input: { noteId: NoteId; blockId?: string }): Backlink[] {
    this.#validateId(input?.noteId);
    if (input.blockId !== undefined && !/^[0-9a-f]{12}$/u.test(input.blockId)) {
      throw new AppError("InvalidInput", "The block ID is invalid.");
    }
    return this.#backlinks.get(
      input.blockId ? `${input.noteId}#^${input.blockId}` : input.noteId,
    ) ?? [];
  }

  search(query: string): SearchResult[] {
    if (typeof query !== "string" || !query.trim()) return [];
    const normalizedQuery = normalizeSearchText(query.trim());
    return Array.from(this.#notes.values())
      .map(({ summary, markdown }) => {
        const title = normalizeSearchText(summary.title);
        const body = normalizeSearchText(markdown.searchText);
        const rank = title === normalizedQuery
          ? 0
          : title.startsWith(normalizedQuery)
          ? 1
          : title.includes(normalizedQuery)
          ? 2
          : body.includes(normalizedQuery)
          ? 3
          : -1;
        return { summary, markdown, rank };
      })
      .filter((result) => result.rank >= 0)
      .sort((a, b) =>
        a.rank - b.rank || a.summary.title.localeCompare(b.summary.title)
      )
      .slice(0, 20)
      .map(({ summary, markdown }) => ({
        id: summary.id,
        title: summary.title,
        excerpt: bodyExcerpt(markdown.searchText, normalizedQuery),
      }));
  }

  async cleanupTemporaryFiles(now = Date.now()): Promise<void> {
    const removeStale = async (directory: string): Promise<void> => {
      for await (const entry of Deno.readDir(directory)) {
        if (entry.isSymlink) continue;
        const path = join(directory, entry.name);
        if (entry.isDirectory) await removeStale(path);
        else if (
          entry.isFile && entry.name.startsWith(TEMP_PREFIX) &&
          entry.name.endsWith(TEMP_SUFFIX)
        ) {
          const stat = await Deno.stat(path);
          if (now - (stat.mtime?.getTime() ?? now) > 24 * 60 * 60 * 1000) {
            await Deno.remove(path);
          }
        }
      }
    };
    await removeStale(join(this.path, "pages"));
    await removeStale(join(this.path, "journals"));
  }

  watch(
    onChange: () => void,
    onError: () => void = () => undefined,
  ): Deno.FsWatcher {
    const watcher = Deno.watchFs(this.path, { recursive: true });
    void (async () => {
      const pending = new Set<NoteId>();
      let timer: ReturnType<typeof setTimeout> | undefined;
      const flush = async () => {
        timer = undefined;
        const ids = Array.from(pending);
        pending.clear();
        for (const id of ids) await this.reindex(id);
        if (ids.length) onChange();
      };

      try {
        for await (const event of watcher) {
          if (event.flag === "rescan") {
            pending.clear();
            await this.rebuildIndex();
            onChange();
            continue;
          }
          for (const path of event.paths) {
            const id = relative(this.path, path).split(sep).join("/");
            if (isManagedId(id)) pending.add(id);
          }
          if (timer !== undefined) clearTimeout(timer);
          timer = setTimeout(() => void flush(), 150);
        }
      } catch (error) {
        if (!(error instanceof Deno.errors.BadResource)) {
          console.error("Workspace watcher failed", error);
          onError();
        }
      }
    })();
    return watcher;
  }
}
