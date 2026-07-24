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
import { toast } from "sonner";

import { useTabs } from "@/components/tabs-provider.tsx";
import type {
  Backlink,
  NoteFile,
  NoteId,
  NoteSummary,
  TrashEntry,
} from "@/lib/contracts.ts";
import { dateValue, journalDateFromId, journalTitle } from "@/lib/dates.ts";
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

export interface PageViewFilters {
  query: string;
  hasOpenTasks: boolean;
  dueSoon: boolean;
  tag: string | null;
  attributeKey: string | null;
  showAs?: "pages" | "tasks";
}

export interface PageViewDefinition {
  id: string;
  name: string;
  filters: PageViewFilters;
  custom: boolean;
}

const EMPTY_PAGE_VIEW_FILTERS: PageViewFilters = {
  query: "",
  hasOpenTasks: false,
  dueSoon: false,
  tag: null,
  attributeKey: null,
  showAs: "pages",
};

const OPEN_TASKS_VIEW: PageViewDefinition = {
  id: "open-tasks",
  name: "Open tasks",
  filters: {
    ...EMPTY_PAGE_VIEW_FILTERS,
    hasOpenTasks: true,
    showAs: "tasks",
  },
  custom: false,
};
const PAGE_VIEWS_KEY = "dyno.pageViews.v1";

function storedPageViews(): PageViewDefinition[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(PAGE_VIEWS_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return stored.flatMap((view): PageViewDefinition[] => {
      const filters = view?.filters;
      if (
        typeof view?.id !== "string" ||
        !view.id ||
        view.id.length > 100 ||
        typeof view?.name !== "string" ||
        !view.name.trim() ||
        view.name.length > 80 ||
        typeof filters?.query !== "string" ||
        filters.query.length > 200 ||
        typeof filters?.hasOpenTasks !== "boolean" ||
        typeof filters?.dueSoon !== "boolean" ||
        !(filters?.tag === null || typeof filters?.tag === "string") ||
        !(
          filters?.attributeKey === null ||
          typeof filters?.attributeKey === "string"
        )
      )
        return [];
      return [
        {
          id: view.id,
          name: view.name.trim(),
          filters: {
            query: filters.query,
            hasOpenTasks: filters.hasOpenTasks,
            tag: filters.tag,
            attributeKey: filters.attributeKey,
            showAs: filters.showAs === "tasks" ? "tasks" : "pages",
          },
          custom: true,
        },
      ];
    });
  } catch {
    return [];
  }
}

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

interface WorkspaceContextValue {
  workspacePath: string;
  notes: NoteSummary[];
  updateNoteSummary(
    id: NoteId,
    kind: NoteFile["kind"],
    title: string,
    source: string,
    updatedAt: string,
  ): void;
  trash: TrashEntry[];
  trashLoading: boolean;
  trashError: string | null;
  refreshTrash(): Promise<boolean>;
  restoreTrash(id: string): Promise<boolean>;
  deleteTrash(id: string): Promise<boolean>;
  deleteNote(id: NoteId): Promise<boolean>;
  pageViews: PageViewDefinition[];
  createPageView(name: string, filters?: PageViewFilters): string;
  updatePageView(id: string, filters: PageViewFilters): void;
  deletePageView(id: string): void;
  createPage(title: string): Promise<NoteFile | null>;
  importFiles(files: File[]): Promise<string[]>;
}

interface NotesContextValue {
  notes: NoteSummary[];
  note: NoteFile | null;
  draft: Draft;
  status: SaveStatus;
  loading: boolean;
  error: string | null;
  conflict: NoteConflict | null;
  backlinks: Backlink[];
  resetKey: number;
  changeTitle(title: string): void;
  changeSource(source: string): void;
  setMode(mode: EditorMode): boolean;
  convertSource(): void;
  openNote(id: NoteId, blockId?: string): Promise<boolean>;
  deleteNote(id: NoteId): Promise<boolean>;
  saveNow(): Promise<boolean>;
  keepMine(): Promise<void>;
  useDisk(): void;
  retry(): void;
  reportError(message: string | null): void;
}

interface NavigationContextValue {
  notes: NoteSummary[];
  noteId: NoteId | null;
  activePageView: PageViewDefinition | null;
  canGoBack: boolean;
  canGoForward: boolean;
  goBack(): Promise<boolean>;
  goForward(): Promise<boolean>;
  openNote(id: NoteId, blockId?: string): Promise<boolean>;
  openPageView(id: string): Promise<boolean>;
  createPageView(name: string, filters?: PageViewFilters): string;
  updatePageView(id: string, filters: PageViewFilters): void;
  openJournal(date: string): Promise<boolean>;
  createPage(title: string): Promise<boolean>;
}

interface EditorRuntimeContextValue {
  notes: NoteSummary[];
  noteId: NoteId | null;
  focusRequest: { blockId: string; nonce: number } | null;
  draft(): Draft;
  changeContent(content: JSONContent): void;
  registerBeforeSave(callback: () => void): () => void;
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

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
const NotesContext = createContext<NotesContextValue | null>(null);
const NavigationContext = createContext<NavigationContextValue | null>(null);
const EditorRuntimeContext = createContext<EditorRuntimeContextValue | null>(
  null,
);

interface NavigationHistory {
  entries: Array<{ id: NoteId; blockId?: string }>;
  index: number;
}

export function pushNavigationHistory(
  history: NavigationHistory,
  entry: NavigationHistory["entries"][number],
): NavigationHistory {
  if (history.entries[history.index]?.id === entry.id) return history;
  const entries = [...history.entries.slice(0, history.index + 1), entry];
  return { entries, index: entries.length - 1 };
}

export function removeNavigationHistory(
  history: NavigationHistory,
  id: NoteId,
  replacement: NavigationHistory["entries"][number],
): NavigationHistory {
  const entries = history.entries.filter((entry) => entry.id !== id);
  const index =
    history.entries
      .slice(0, history.index + 1)
      .filter((entry) => entry.id !== id).length - 1;
  return pushNavigationHistory({ entries, index }, replacement);
}

export function updatePageViewFilters(
  views: PageViewDefinition[],
  id: string,
  filters: PageViewFilters,
): PageViewDefinition[] {
  return views.map((view) =>
    view.id === id ? { ...view, filters: { ...filters } } : view,
  );
}

function fallbackNote(remaining: NoteSummary[]): NoteSummary | undefined {
  const recent = remaining.toSorted((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return recent.find((summary) => summary.kind === "page") ?? recent[0];
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

function emptyJournal(date: string): NoteFile {
  const title = journalTitle(date);
  return {
    id: `journals/${date}.md`,
    kind: "journal",
    title,
    source: `# ${title}\n`,
    revision: "",
    eol: "\n",
  };
}

async function readNote(id: NoteId): Promise<NoteFile> {
  try {
    return await desktop.notesRead(id);
  } catch (error) {
    const date = journalDateFromId(id);
    if ((error as Error)?.name !== "NotFound" || !date) throw error;
    return emptyJournal(date);
  }
}

interface NoteRemovedDetail {
  id: NoteId;
  remainingNotes: NoteSummary[];
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspacePath, setWorkspacePath] = useState("");
  const [notes, setNotes] = useState<NoteSummary[]>([]);
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [trashLoading, setTrashLoading] = useState(false);
  const [trashError, setTrashError] = useState<string | null>(null);
  const [customPageViews, setCustomPageViews] = useState(storedPageViews);

  const notesRef = useRef(notes);
  notesRef.current = notes;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [info, summaries] = await Promise.all([
          desktop.workspaceInfo(),
          desktop.notesList(),
        ]);
        if (cancelled) return;
        setWorkspacePath(info.path);
        setNotes(summaries);
      } catch (failure) {
        if (!cancelled) {
          toast.error("The workspace could not be loaded.", {
            description: message(failure),
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateNoteSummary = useCallback(
    (
      id: NoteId,
      kind: NoteFile["kind"],
      title: string,
      source: string,
      updatedAt: string,
    ) => {
      setNotes((current) => {
        const scanned = scanMarkdown(source);
        const summary: NoteSummary = {
          id,
          kind,
          title,
          updatedAt,
          wordCount: scanned.wordCount,
          tags: scanned.tags,
          attributes: scanned.attributes,
          openTasks: scanned.tasks.filter((t) => !t.checked).length,
          completedTasks: scanned.tasks.filter((t) => t.checked).length,
        };
        return current.some((note) => note.id === id)
          ? current.map((note) => (note.id === id ? summary : note))
          : [...current, summary];
      });
    },
    [],
  );

  const refreshNotes = useCallback(async () => {
    try {
      setNotes(await desktop.notesList());
    } catch (failure) {
      toast.error("The notes list could not refresh.", {
        description: message(failure),
      });
    }
  }, []);

  useEffect(() => {
    const changed = () => void refreshNotes();
    const focused = () => void refreshNotes();
    const watcherFailed = () =>
      toast.error("Live file watching stopped.", {
        description: "Dyno Notes will refresh when the window regains focus.",
      });
    globalThis.addEventListener("dyno:workspace-change", changed);
    globalThis.addEventListener("dyno:watcher-error", watcherFailed);
    globalThis.addEventListener("focus", focused);
    return () => {
      globalThis.removeEventListener("dyno:workspace-change", changed);
      globalThis.removeEventListener("dyno:watcher-error", watcherFailed);
      globalThis.removeEventListener("focus", focused);
    };
  }, [refreshNotes]);

  useEffect(() => {
    try {
      localStorage.setItem(PAGE_VIEWS_KEY, JSON.stringify(customPageViews));
    } catch {
      // The views still work for this session if browser storage is unavailable.
    }
  }, [customPageViews]);

  const refreshTrash = useCallback(async () => {
    setTrashLoading(true);
    setTrashError(null);
    try {
      setTrash(await desktop.trashList());
      return true;
    } catch (failure) {
      setTrashError(message(failure));
      return false;
    } finally {
      setTrashLoading(false);
    }
  }, []);

  const restoreTrash = useCallback(async (id: string) => {
    setTrashError(null);
    try {
      const restored = await desktop.trashRestore(id);
      setTrash((current) => current.filter((entry) => entry.id !== id));
      // ponytail: a failed list refresh here is best-effort, not surfaced.
      setNotes(await desktop.notesList().catch(() => notesRef.current));
      toast.success("Note restored", { description: restored.title });
      return true;
    } catch (failure) {
      const errorMessage = message(failure);
      setTrashError(errorMessage);
      toast.error("Note could not be restored", {
        description: errorMessage,
      });
      return false;
    }
  }, []);

  const deleteTrash = useCallback(async (id: string) => {
    setTrashError(null);
    try {
      await desktop.trashDelete(id);
      setTrash((current) => current.filter((entry) => entry.id !== id));
      toast.success("Note permanently deleted");
      return true;
    } catch (failure) {
      const errorMessage = message(failure);
      setTrashError(errorMessage);
      toast.error("Note could not be deleted", { description: errorMessage });
      return false;
    }
  }, []);

  const deleteNote = useCallback(
    async (id: NoteId) => {
      try {
        const entry = await desktop.notesTrash(id);
        const remainingNotes = await desktop
          .notesList()
          .catch(() => notesRef.current.filter((summary) => summary.id !== id));
        setNotes(remainingNotes);
        setTrash((current) => [
          entry,
          ...current.filter((item) => item.id !== entry.id),
        ]);
        globalThis.dispatchEvent(
          new CustomEvent<NoteRemovedDetail>("dyno:note-removed", {
            detail: { id, remainingNotes },
          }),
        );
        toast.success("Moved to Trash", {
          description: entry.title,
          action: { label: "Undo", onClick: () => void restoreTrash(entry.id) },
        });
        return true;
      } catch (failure) {
        toast.error("Note could not be deleted", {
          description: message(failure),
        });
        return false;
      }
    },
    [restoreTrash],
  );

  const createPageView = useCallback(
    (name: string, filters = EMPTY_PAGE_VIEW_FILTERS) => {
      const id = crypto.randomUUID();
      const view: PageViewDefinition = {
        id,
        name: name.trim().slice(0, 80),
        filters: { ...filters },
        custom: true,
      };
      setCustomPageViews((current) => [...current, view]);
      return id;
    },
    [],
  );

  const updatePageView = useCallback((id: string, filters: PageViewFilters) => {
    setCustomPageViews((current) =>
      updatePageViewFilters(current, id, filters),
    );
  }, []);

  const deletePageView = useCallback((id: string) => {
    setCustomPageViews((current) => current.filter((view) => view.id !== id));
  }, []);

  const createPage = useCallback(async (title: string) => {
    try {
      const file = await desktop.notesCreate({ kind: "page", title });
      setNotes(await desktop.notesList());
      return file;
    } catch (failure) {
      toast.error("Page could not be created", {
        description: message(failure),
      });
      return null;
    }
  }, []);

  const importFiles = useCallback(async (files: File[]) => {
    const failures: string[] = [];
    for (const file of files) {
      try {
        await desktop.notesImport([
          {
            name: file.name,
            bytes: new Uint8Array(await file.arrayBuffer()),
          },
        ]);
      } catch (failure) {
        failures.push(`${file.name}: ${message(failure)}`);
      }
    }
    setNotes(await desktop.notesList());
    return failures;
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      workspacePath,
      notes,
      updateNoteSummary,
      trash,
      trashLoading,
      trashError,
      refreshTrash,
      restoreTrash,
      deleteTrash,
      deleteNote,
      pageViews: [OPEN_TASKS_VIEW, ...customPageViews],
      createPageView,
      updatePageView,
      deletePageView,
      createPage,
      importFiles,
    }),
    [
      workspacePath,
      notes,
      updateNoteSummary,
      trash,
      trashLoading,
      trashError,
      refreshTrash,
      restoreTrash,
      deleteTrash,
      deleteNote,
      customPageViews,
      createPageView,
      updatePageView,
      deletePageView,
      createPage,
      importFiles,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider.");
  }
  return context;
}

export function TabProvider({
  tabId,
  initialNoteId,
  initialPageViewId,
  children,
}: {
  tabId: string;
  initialNoteId?: NoteId;
  initialPageViewId?: string;
  children: ReactNode;
}) {
  const workspace = useWorkspace();
  const { publishTabInfo, removeTabInfo } = useTabs();

  const [note, setNote] = useState<NoteFile | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<NoteConflict | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [resetKey, setResetKey] = useState(0);
  const [focusRequest, setFocusRequest] = useState<{
    blockId: string;
    nonce: number;
  } | null>(null);
  const [changeTick, setChangeTick] = useState(0);
  const [retryTick, setRetryTick] = useState(0);
  const [navigationHistory, setNavigationHistory] = useState<NavigationHistory>(
    { entries: [], index: -1 },
  );
  const [activePageViewId, setActivePageViewId] = useState<string | null>(null);

  const draftRef = useRef(draft);
  const noteRef = useRef(note);
  const activeIdRef = useRef<NoteId | null>(null);
  const beforeSaveCallbacksRef = useRef(new Set<() => void>());
  const coordinatorRef = useRef<SaveCoordinator | null>(null);
  const navigationHistoryRef = useRef(navigationHistory);
  const initialNoteIdRef = useRef(initialNoteId);
  const initialPageViewIdRef = useRef(initialPageViewId);

  if (!coordinatorRef.current) {
    coordinatorRef.current = new SaveCoordinator({
      prepare: () => {
        for (const callback of beforeSaveCallbacksRef.current) callback();
      },
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
        workspace.updateNoteSummary(
          snapshot.id,
          updated.kind,
          updated.title,
          snapshot.source,
          result.updatedAt,
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
    void desktop
      .notesBacklinks({ noteId: file.id })
      .then(setBacklinks)
      .catch((failure) => setError(message(failure)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const id = initialNoteIdRef.current ?? `journals/${dateValue()}.md`;
        const file = await readNote(id);
        if (cancelled) return;
        applyFile(file);
        if (initialPageViewIdRef.current) {
          setActivePageViewId(initialPageViewIdRef.current);
        }
        const initialHistory = { entries: [{ id: file.id }], index: 0 };
        navigationHistoryRef.current = initialHistory;
        setNavigationHistory(initialHistory);
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

  const refresh = useCallback(async () => {
    const id = activeIdRef.current;
    if (!id || !noteRef.current) return;
    try {
      if (
        !noteRef.current.revision &&
        !workspace.notes.some((summary) => summary.id === id)
      )
        return;
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
  }, [applyFile, workspace.notes]);

  useEffect(() => {
    const changed = () => void refresh();
    const focused = () => void refresh();
    globalThis.addEventListener("dyno:workspace-change", changed);
    globalThis.addEventListener("focus", focused);
    return () => {
      globalThis.removeEventListener("dyno:workspace-change", changed);
      globalThis.removeEventListener("focus", focused);
    };
  }, [refresh]);

  useEffect(() => {
    const onRemoved = (event: Event) => {
      const { id, remainingNotes } = (event as CustomEvent<NoteRemovedDetail>)
        .detail;
      if (noteRef.current?.id !== id) return;
      void (async () => {
        const fallback = fallbackNote(remainingNotes);
        const fallbackFile = fallback
          ? await readNote(fallback.id).catch(() => emptyJournal(dateValue()))
          : emptyJournal(dateValue());
        applyFile(fallbackFile);
        setActivePageViewId(null);
        const nextHistory = removeNavigationHistory(
          navigationHistoryRef.current,
          id,
          { id: fallbackFile.id },
        );
        navigationHistoryRef.current = nextHistory;
        setNavigationHistory(nextHistory);
      })();
    };
    globalThis.addEventListener("dyno:note-removed", onRemoved);
    return () => globalThis.removeEventListener("dyno:note-removed", onRemoved);
  }, [applyFile]);

  const saveNow = useCallback(() => coordinatorRef.current!.flush(), []);

  const registerBeforeSave = useCallback((callback: () => void) => {
    beforeSaveCallbacksRef.current.add(callback);
    return () => beforeSaveCallbacksRef.current.delete(callback);
  }, []);

  useEffect(() => {
    if (!changeTick) return;
    const timer = setTimeout(() => void saveNow(), 750);
    return () => clearTimeout(timer);
  }, [changeTick, saveNow]);

  const updateDraft = useCallback((changes: Partial<Draft>) => {
    const next = { ...draftRef.current, ...changes };
    draftRef.current = next;
    setDraft(next);
    coordinatorRef.current!.changed();
    setChangeTick((value) => value + 1);
    setError(null);
  }, []);

  const recordNavigation = useCallback((id: NoteId, blockId?: string) => {
    const next = pushNavigationHistory(navigationHistoryRef.current, {
      id,
      blockId,
    });
    if (next === navigationHistoryRef.current) return;
    navigationHistoryRef.current = next;
    setNavigationHistory(next);
  }, []);

  const openNote = useCallback(
    async (id: NoteId, blockId?: string) => {
      if (id === activeIdRef.current) {
        setActivePageViewId(null);
        if (blockId) {
          setFocusRequest((current) => ({
            blockId,
            nonce: (current?.nonce ?? 0) + 1,
          }));
        }
        return true;
      }
      if (!(await saveNow())) return false;
      try {
        const file = await readNote(id);
        applyFile(file, blockId);
        setActivePageViewId(null);
        recordNavigation(file.id, blockId);
        return true;
      } catch (failure) {
        setError(message(failure));
        return false;
      }
    },
    [applyFile, recordNavigation, saveNow],
  );

  const openPageView = useCallback(
    async (id: string) => {
      if (!(await saveNow())) return false;
      if (!workspace.pageViews.some((view) => view.id === id)) return false;
      setActivePageViewId(id);
      return true;
    },
    [workspace.pageViews, saveNow],
  );

  const moveHistory = useCallback(
    async (offset: -1 | 1) => {
      if (activePageViewId && offset === -1) {
        setActivePageViewId(null);
        return true;
      }
      const targetIndex = navigationHistoryRef.current.index + offset;
      const target = navigationHistoryRef.current.entries[targetIndex];
      if (!target || !(await saveNow())) return false;
      try {
        applyFile(await readNote(target.id), target.blockId);
        const next = { ...navigationHistoryRef.current, index: targetIndex };
        navigationHistoryRef.current = next;
        setNavigationHistory(next);
        return true;
      } catch (failure) {
        setError(message(failure));
        return false;
      }
    },
    [activePageViewId, applyFile, saveNow],
  );

  const followWikiLink = useCallback(
    async (rawTarget: string) => {
      const parsed = parseWikiTarget(rawTarget);
      let id = activeIdRef.current;
      if (parsed.target) {
        const exact = workspace.notes.find(
          (summary) => noteTarget(summary.id) === parsed.target,
        );
        const titleMatches = workspace.notes.filter(
          (summary) =>
            normalizeSearchText(summary.title) ===
            normalizeSearchText(parsed.target),
        );
        id =
          exact?.id ?? (titleMatches.length === 1 ? titleMatches[0].id : null);
      }
      if (!id) {
        setError("That page link is unresolved or ambiguous.");
        return false;
      }
      return await openNote(id, parsed.blockId ?? undefined);
    },
    [workspace.notes, openNote],
  );

  const createPage = useCallback(
    async (title: string) => {
      if (!(await saveNow())) return false;
      const file = await workspace.createPage(title);
      if (!file) return false;
      applyFile(file);
      setActivePageViewId(null);
      recordNavigation(file.id);
      return true;
    },
    [applyFile, recordNavigation, saveNow, workspace],
  );

  const openJournal = useCallback(
    async (date: string) => await openNote(`journals/${date}.md`),
    [openNote],
  );

  const deleteNote = useCallback(
    async (id: NoteId) => {
      if (!(await saveNow())) return false;
      return await workspace.deleteNote(id);
    },
    [saveNow, workspace],
  );

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

  const value = useMemo<NotesContextValue>(
    () => ({
      notes: workspace.notes,
      note,
      draft,
      status,
      loading,
      error,
      conflict,
      backlinks,
      resetKey,
      changeTitle: (title) => updateDraft({ title }),
      changeSource: (source) => updateDraft({ source }),
      setMode,
      convertSource,
      openNote,
      deleteNote,
      saveNow,
      keepMine,
      useDisk,
      retry: () => setRetryTick((value) => value + 1),
      reportError: setError,
    }),
    [
      workspace.notes,
      note,
      draft,
      status,
      loading,
      error,
      conflict,
      backlinks,
      resetKey,
      setMode,
      convertSource,
      openNote,
      deleteNote,
      saveNow,
      keepMine,
      useDisk,
      updateDraft,
    ],
  );

  const activePageView =
    workspace.pageViews.find((view) => view.id === activePageViewId) ?? null;

  const navigation = useMemo<NavigationContextValue>(
    () => ({
      notes: workspace.notes,
      noteId: activePageViewId ? null : (note?.id ?? null),
      activePageView,
      canGoBack: Boolean(activePageViewId) || navigationHistory.index > 0,
      canGoForward:
        !activePageViewId &&
        navigationHistory.index < navigationHistory.entries.length - 1,
      goBack: () => moveHistory(-1),
      goForward: () => moveHistory(1),
      openNote,
      openPageView,
      createPageView: workspace.createPageView,
      updatePageView: workspace.updatePageView,
      openJournal,
      createPage,
    }),
    [
      workspace.notes,
      workspace.createPageView,
      workspace.updatePageView,
      note?.id,
      activePageViewId,
      activePageView,
      navigationHistory,
      moveHistory,
      openNote,
      openPageView,
      openJournal,
      createPage,
    ],
  );

  const editorRuntime = useMemo<EditorRuntimeContextValue>(
    () => ({
      notes: workspace.notes,
      noteId: note?.id ?? null,
      focusRequest,
      draft: () => draftRef.current,
      changeContent: (content) => updateDraft({ content }),
      registerBeforeSave,
      followWikiLink,
      reportError: setError,
    }),
    [
      workspace.notes,
      note?.id,
      focusRequest,
      updateDraft,
      registerBeforeSave,
      followWikiLink,
    ],
  );

  const title = activePageView
    ? activePageView.name
    : draft.title.trim() || "New Tab";

  useEffect(() => {
    publishTabInfo(tabId, { ...navigation, title, status, saveNow });
    return () => removeTabInfo(tabId);
  }, [
    tabId,
    navigation,
    title,
    status,
    saveNow,
    publishTabInfo,
    removeTabInfo,
  ]);

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
  if (!context) throw new Error("useNotes must be used inside TabProvider.");
  return context;
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used inside TabProvider.");
  }
  return context;
}

export function useEditorRuntime(): EditorRuntimeContextValue {
  const context = useContext(EditorRuntimeContext);
  if (!context) {
    throw new Error("useEditorRuntime must be used inside TabProvider.");
  }
  return context;
}
