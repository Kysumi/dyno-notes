import type { JSONContent } from "@tiptap/core";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  Backlink,
  NoteFile,
  NoteId,
  NoteSummary,
} from "@/lib/contracts.ts";
import { desktop } from "@/lib/desktop.ts";
import { parseMarkdown, serializeMarkdown } from "@/lib/markdown-codec.ts";
import {
  normalizeSearchText,
  noteTarget,
  parseWikiTarget,
  scanMarkdown,
} from "@/lib/markdown-scanner.ts";
import { SaveCoordinator, type SaveStatus } from "@/lib/save-coordinator.ts";

type EditorMode = "wysiwyg" | "source";

export interface Draft {
  title: string;
  content: JSONContent;
  source: string;
  mode: EditorMode;
  unsupportedReasons: string[];
}

export interface NoteConflict {
  disk: NoteFile;
  localSource: string;
}

interface NotesContextValue {
  workspacePath: string;
  notes: NoteSummary[];
  note: NoteFile | null;
  draft: Draft;
  status: SaveStatus;
  loading: boolean;
  error: string | null;
  conflict: NoteConflict | null;
  backlinks: Backlink[];
  resetKey: number;
  focusRequest: { blockId: string; nonce: number } | null;
  changeTitle(title: string): void;
  changeContent(content: JSONContent): void;
  changeSource(source: string): void;
  setMode(mode: EditorMode): boolean;
  convertSource(): void;
  openNote(id: NoteId, blockId?: string): Promise<boolean>;
  followWikiLink(rawTarget: string): Promise<boolean>;
  createPage(title: string): Promise<boolean>;
  importFiles(files: File[]): Promise<string[]>;
  saveNow(): Promise<boolean>;
  keepMine(): Promise<void>;
  useDisk(): void;
  retry(): void;
  reportError(message: string | null): void;
}

interface NavigationContextValue {
  workspacePath: string;
  notes: NoteSummary[];
  noteId: NoteId | null;
  openNote(id: NoteId, blockId?: string): Promise<boolean>;
  createPage(title: string): Promise<boolean>;
  importFiles(files: File[]): Promise<string[]>;
}

interface EditorRuntimeContextValue {
  notes: NoteSummary[];
  noteId: NoteId | null;
  focusRequest: { blockId: string; nonce: number } | null;
  draft(): Draft;
  changeContent(content: JSONContent): void;
  followWikiLink(rawTarget: string): Promise<boolean>;
  reportError(message: string | null): void;
}

const emptyDraft: Draft = {
  title: "",
  content: { type: "doc", content: [{ type: "paragraph" }] },
  source: "",
  mode: "wysiwyg",
  unsupportedReasons: [],
};

const NotesContext = createContext<NotesContextValue | null>(null);
const NavigationContext = createContext<NavigationContextValue | null>(null);
const EditorRuntimeContext = createContext<EditorRuntimeContextValue | null>(
  null,
);

function today(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sourceForDraft(draft: Draft): string {
  return draft.mode === "source"
    ? draft.source
    : serializeMarkdown(draft.title, draft.content);
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "The request could not be completed.";
}

export function NotesProvider({ children }: { children: ReactNode }) {
  const [workspacePath, setWorkspacePath] = useState("");
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [note, setNote] = useState<NoteFile | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<NoteConflict | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [focusRequest, setFocusRequest] = useState<
    {
      blockId: string;
      nonce: number;
    } | null
  >(null);
  const [changeTick, setChangeTick] = useState(0);
  const [retryTick, setRetryTick] = useState(0);

  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const activeIdRef = useRef<NoteId | null>(null);
  const coordinatorRef = useRef<SaveCoordinator | null>(null);

  if (!coordinatorRef.current) {
    coordinatorRef.current = new SaveCoordinator({
      snapshot: () => ({
        id: activeIdRef.current ?? "",
        source: sourceForDraft(draftRef.current),
      }),
      save: (input) => desktop.notesSave(input),
      status: setStatus,
      saved: (result, snapshot) => {
        if (!noteRef.current || noteRef.current.id !== snapshot.id) return;
        const updated = {
          ...noteRef.current,
          revision: result.revision,
          source: snapshot.source,
          title: draftRef.current.title,
        };
        noteRef.current = updated;
        setNote(updated);
        setNotes((current) =>
          current.map((summary) =>
            summary.id === snapshot.id
              ? {
                ...summary,
                title: draftRef.current.title,
                updatedAt: result.updatedAt,
                wordCount: scanMarkdown(snapshot.source).wordCount,
              }
              : summary
          )
        );
        void desktop.notesBacklinks({ noteId: snapshot.id }).then(setBacklinks);
      },
      failed: async (failure, snapshot) => {
        setError(message(failure));
        if ((failure as { name?: unknown })?.name !== "Conflict") return;
        try {
          const disk = await desktop.notesRead(snapshot.id);
          setConflict({ disk, localSource: snapshot.source });
        } catch (readError) {
          setError(message(readError));
        }
      },
    });
  }

  const applyFile = useCallback((file: NoteFile, blockId?: string) => {
    const parsed = parseMarkdown(file.source);
    const nextDraft: Draft = {
      title: parsed.title,
      content: parsed.content,
      source: file.source,
      mode: parsed.supported ? "wysiwyg" : "source",
      unsupportedReasons: parsed.unsupportedReasons,
    };
    draftRef.current = nextDraft;
    noteRef.current = file;
    activeIdRef.current = file.id;
    setDraft(nextDraft);
    setNote(file);
    setConflict(null);
    setError(null);
    setResetKey((value) => value + 1);
    coordinatorRef.current!.reset(file.revision);
    if (blockId) {
      setFocusRequest((current) => ({
        blockId,
        nonce: (current?.nonce ?? 0) + 1,
      }));
    } else {
      setFocusRequest(null);
    }
    void desktop.notesBacklinks({ noteId: file.id }).then(setBacklinks).catch((
      failure,
    ) => setError(message(failure)));
  }, []);

  const refresh = useCallback(async () => {
    try {
      setNotes(await desktop.notesList());
      const id = activeIdRef.current;
      if (!id || !noteRef.current) return;
      const disk = await desktop.notesRead(id);
      if (disk.revision === noteRef.current.revision) return;
      if (coordinatorRef.current!.dirty) {
        setConflict({ disk, localSource: sourceForDraft(draftRef.current) });
        coordinatorRef.current!.block();
      } else {
        applyFile(disk);
      }
    } catch (failure) {
      setError(
        (failure as { name?: unknown })?.name === "NotFound"
          ? "The active file was removed. Your editor content is still available."
          : message(failure),
      );
    }
  }, [applyFile]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [info, summaries] = await Promise.all([
          desktop.workspaceInfo(),
          desktop.notesList(),
        ]);
        const date = today();
        const journalId = `journals/${date}.md`;
        const file = summaries.some((summary) => summary.id === journalId)
          ? await desktop.notesRead(journalId)
          : await desktop.notesCreate({
            kind: "journal",
            date,
            title: new Intl.DateTimeFormat("en-NZ", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date()),
          });
        if (cancelled) return;
        setWorkspacePath(info.path);
        setNotes(await desktop.notesList());
        applyFile(file);
      } catch (failure) {
        if (!cancelled) setError(message(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyFile, retryTick]);

  useEffect(() => {
    const changed = () => void refresh();
    const focused = () => void refresh();
    const watcherFailed = () =>
      setError(
        "Live file watching stopped. Dyno Notes will refresh when the window regains focus.",
      );
    globalThis.addEventListener("dyno:workspace-change", changed);
    globalThis.addEventListener("dyno:watcher-error", watcherFailed);
    globalThis.addEventListener("focus", focused);
    return () => {
      globalThis.removeEventListener("dyno:workspace-change", changed);
      globalThis.removeEventListener("dyno:watcher-error", watcherFailed);
      globalThis.removeEventListener("focus", focused);
    };
  }, [refresh]);

  const saveNow = useCallback(() => coordinatorRef.current!.flush(), []);

  useEffect(() => {
    if (!changeTick) return;
    const timer = setTimeout(() => void saveNow(), 750);
    return () => clearTimeout(timer);
  }, [changeTick, saveNow]);

  useEffect(() => {
    globalThis.__dynoFlush = saveNow;
    return () => {
      delete globalThis.__dynoFlush;
    };
  }, [saveNow]);

  const updateDraft = useCallback((changes: Partial<Draft>) => {
    const next = { ...draftRef.current, ...changes };
    draftRef.current = next;
    setDraft(next);
    coordinatorRef.current!.changed();
    setChangeTick((value) => value + 1);
    setError(null);
  }, []);

  const openNote = useCallback(async (id: NoteId, blockId?: string) => {
    if (id === activeIdRef.current) {
      if (blockId) {
        setFocusRequest((current) => ({
          blockId,
          nonce: (current?.nonce ?? 0) + 1,
        }));
      }
      return true;
    }
    if (!await saveNow()) return false;
    try {
      applyFile(await desktop.notesRead(id), blockId);
      return true;
    } catch (failure) {
      setError(message(failure));
      return false;
    }
  }, [applyFile, saveNow]);

  const followWikiLink = useCallback(async (rawTarget: string) => {
    const parsed = parseWikiTarget(rawTarget);
    let id = activeIdRef.current;
    if (parsed.target) {
      const exact = notes.find((summary) =>
        noteTarget(summary.id) === parsed.target
      );
      const titleMatches = notes.filter((summary) =>
        normalizeSearchText(summary.title) ===
          normalizeSearchText(parsed.target)
      );
      id = exact?.id ?? (titleMatches.length === 1 ? titleMatches[0].id : null);
    }
    if (!id) {
      setError("That page link is unresolved or ambiguous.");
      return false;
    }
    return await openNote(id, parsed.blockId ?? undefined);
  }, [notes, openNote]);

  const createPage = useCallback(async (title: string) => {
    if (!await saveNow()) return false;
    try {
      const file = await desktop.notesCreate({ kind: "page", title });
      setNotes(await desktop.notesList());
      applyFile(file);
      return true;
    } catch (failure) {
      setError(message(failure));
      return false;
    }
  }, [applyFile, saveNow]);

  const importFiles = useCallback(async (files: File[]) => {
    const failures: string[] = [];
    let firstId: NoteId | null = null;
    for (const file of files) {
      try {
        const imported = await desktop.notesImport([{
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer()),
        }]);
        firstId ??= imported[0]?.id ?? null;
      } catch (failure) {
        failures.push(`${file.name}: ${message(failure)}`);
      }
    }
    setNotes(await desktop.notesList());
    if (firstId) await openNote(firstId);
    return failures;
  }, [openNote]);

  const setMode = useCallback((mode: EditorMode) => {
    if (mode === draftRef.current.mode) return true;
    if (mode === "source") {
      const next = {
        ...draftRef.current,
        mode,
        source: serializeMarkdown(
          draftRef.current.title,
          draftRef.current.content,
        ),
      };
      draftRef.current = next;
      setDraft(next);
      return true;
    }
    const parsed = parseMarkdown(draftRef.current.source);
    if (!parsed.supported) {
      const next = {
        ...draftRef.current,
        unsupportedReasons: parsed.unsupportedReasons,
      };
      draftRef.current = next;
      setDraft(next);
      return false;
    }
    const next = {
      ...draftRef.current,
      title: parsed.title,
      content: parsed.content,
      mode,
      unsupportedReasons: [],
    };
    draftRef.current = next;
    setDraft(next);
    setResetKey((value) => value + 1);
    return true;
  }, []);

  const convertSource = useCallback(() => {
    const parsed = parseMarkdown(draftRef.current.source);
    updateDraft({
      title: parsed.title,
      content: parsed.content,
      mode: "wysiwyg",
      unsupportedReasons: [],
    });
    setResetKey((value) => value + 1);
  }, [updateDraft]);

  const keepMine = useCallback(async () => {
    if (!conflict) return;
    setConflict(null);
    setError(null);
    await coordinatorRef.current!.retryAgainst(conflict.disk.revision);
  }, [conflict]);

  const useDisk = useCallback(() => {
    if (conflict) applyFile(conflict.disk);
  }, [applyFile, conflict]);

  const value = useMemo<NotesContextValue>(() => ({
    workspacePath,
    notes,
    note,
    draft,
    status,
    loading,
    error,
    conflict,
    backlinks,
    resetKey,
    focusRequest,
    changeTitle: (title) => updateDraft({ title }),
    changeContent: (content) => updateDraft({ content }),
    changeSource: (source) => updateDraft({ source }),
    setMode,
    convertSource,
    openNote,
    followWikiLink,
    createPage,
    importFiles,
    saveNow,
    keepMine,
    useDisk,
    retry: () => setRetryTick((value) => value + 1),
    reportError: setError,
  }), [
    workspacePath,
    notes,
    note,
    draft,
    status,
    loading,
    error,
    conflict,
    backlinks,
    resetKey,
    focusRequest,
    setMode,
    convertSource,
    openNote,
    followWikiLink,
    createPage,
    importFiles,
    saveNow,
    keepMine,
    useDisk,
    updateDraft,
  ]);

  const navigation = useMemo<NavigationContextValue>(() => ({
    workspacePath,
    notes,
    noteId: note?.id ?? null,
    openNote,
    createPage,
    importFiles,
  }), [workspacePath, notes, note?.id, openNote, createPage, importFiles]);

  const editorRuntime = useMemo<EditorRuntimeContextValue>(() => ({
    notes,
    noteId: note?.id ?? null,
    focusRequest,
    draft: () => draftRef.current,
    changeContent: (content) => updateDraft({ content }),
    followWikiLink,
    reportError: setError,
  }), [notes, note?.id, focusRequest, updateDraft, followWikiLink]);

  return (
    <NavigationContext.Provider value={navigation}>
      <EditorRuntimeContext.Provider value={editorRuntime}>
        <NotesContext.Provider value={value}>{children}</NotesContext.Provider>
      </EditorRuntimeContext.Provider>
    </NavigationContext.Provider>
  );
}

export function useNotes(): NotesContextValue {
  const context = useContext(NotesContext);
  if (!context) throw new Error("useNotes must be used inside NotesProvider.");
  return context;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used inside NotesProvider.");
  }
  return context;
}

export function useEditorRuntime(): EditorRuntimeContextValue {
  const context = useContext(EditorRuntimeContext);
  if (!context) {
    throw new Error("useEditorRuntime must be used inside NotesProvider.");
  }
  return context;
}
