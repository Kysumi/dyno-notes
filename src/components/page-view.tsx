import {
  type Column,
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, BookmarkPlus, ListFilter, RotateCcw } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  type PageViewDefinition,
  type PageViewFilters,
  useNavigation,
} from "@/components/notes-provider.tsx";
import { SearchableSelect } from "@/components/searchable-select.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.tsx";
import { Input } from "@/components/ui/input.tsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table.tsx";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group.tsx";
import { DEFAULT_APP_SETTINGS } from "@/lib/contracts.ts";
import type {
  ContentBlockType,
  NoteSummary,
  TaskRecord,
} from "@/lib/contracts.ts";
import { deadlineTimestamp, formatDeadline } from "@/lib/dates.ts";
import { desktop } from "@/lib/desktop.ts";

const dateFormatter = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" });
const BLOCK_TYPE_OPTIONS: ReadonlyArray<{
  value: ContentBlockType;
  label: string;
}> = [
  { value: "tldraw", label: "Drawing" },
  { value: "image", label: "Image" },
  { value: "codeBlock", label: "Code block" },
  { value: "blockquote", label: "Quote" },
  { value: "taskItem", label: "Task" },
];

function SortableHeader<T>({
  column,
  children,
}: {
  column: Column<T, unknown>;
  children: string;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3"
      aria-label={`Sort by ${children}`}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {children}
      <ArrowUpDown />
    </Button>
  );
}

function columns(openNote: (id: string) => void): ColumnDef<NoteSummary>[] {
  return [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <SortableHeader column={column}>Page</SortableHeader>
      ),
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto max-w-[20rem] justify-start whitespace-normal p-0 text-left font-medium text-foreground"
          onClick={() => openNote(row.original.id)}
        >
          {row.original.title}
        </Button>
      ),
    },
    {
      accessorKey: "kind",
      header: ({ column }) => (
        <SortableHeader column={column}>Type</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="capitalize">{row.original.kind}</span>
      ),
    },
    {
      id: "tags",
      accessorFn: (row) => row.tags?.join(", ") ?? "",
      header: "Tags",
      cell: ({ row }) => {
        const tags = row.original.tags || [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px]">
                #{tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <Badge variant="outline" className="text-[10px]">
                +{tags.length - 3}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "tasks",
      accessorFn: (row) => row.openTasks,
      header: ({ column }) => (
        <SortableHeader column={column}>Tasks</SortableHeader>
      ),
      cell: ({ row }) => {
        const open = row.original.openTasks || 0;
        const completed = row.original.completedTasks || 0;
        const total = open + completed;
        if (total === 0)
          return <span className="text-muted-foreground">-</span>;
        return (
          <Badge
            variant={open > 0 ? "default" : "outline"}
            className="text-[10px]"
          >
            {completed}/{total}
          </Badge>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <SortableHeader column={column}>Updated</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {dateFormatter.format(new Date(row.original.updatedAt))}
        </span>
      ),
    },
  ];
}

function taskColumns(
  openNote: (id: string, blockId?: string) => void,
): ColumnDef<TaskRecord>[] {
  return [
    {
      accessorKey: "noteTitle",
      header: ({ column }) => (
        <SortableHeader
          column={column as unknown as Column<TaskRecord, unknown>}
        >
          Page
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto max-w-[20rem] justify-start whitespace-normal p-0 text-left font-medium text-foreground"
          onClick={() =>
            openNote(row.original.noteId, row.original.blockId ?? undefined)
          }
        >
          {row.original.noteTitle}
        </Button>
      ),
    },
    {
      accessorKey: "text",
      header: "Task",
      cell: ({ row }) => (
        <Button
          variant="link"
          className={
            row.original.checked
              ? "h-auto justify-start whitespace-normal p-0 text-left font-normal text-muted-foreground line-through"
              : "h-auto justify-start whitespace-normal p-0 text-left font-normal text-foreground"
          }
          onClick={() =>
            openNote(row.original.noteId, row.original.blockId ?? undefined)
          }
        >
          {row.original.text}
        </Button>
      ),
    },
    {
      accessorKey: "checked",
      header: ({ column }) => (
        <SortableHeader
          column={column as unknown as Column<TaskRecord, unknown>}
        >
          Status
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="capitalize">
          {row.original.checked ? "Completed" : "Open"}
        </span>
      ),
    },
    {
      id: "deadline",
      accessorFn: (row) =>
        row.deadline ? deadlineTimestamp(row.deadline) : Infinity,
      header: ({ column }) => (
        <SortableHeader
          column={column as unknown as Column<TaskRecord, unknown>}
        >
          Deadline
        </SortableHeader>
      ),
      cell: ({ row }) => {
        const deadline = row.original.deadline;
        if (!deadline) return <span className="text-muted-foreground">-</span>;
        const overdue =
          !row.original.checked && deadlineTimestamp(deadline) < Date.now();
        return (
          <Badge
            variant={overdue ? "destructive" : "outline"}
            className="text-[10px]"
          >
            {formatDeadline(deadline)}
          </Badge>
        );
      },
    },
    {
      accessorKey: "updatedAt",
      header: ({ column }) => (
        <SortableHeader
          column={column as unknown as Column<TaskRecord, unknown>}
        >
          Updated
        </SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {dateFormatter.format(new Date(row.original.updatedAt))}
        </span>
      ),
    },
  ];
}

export function viewSummary(
  showAs: PageViewFilters["showAs"],
  filteredNoteCount: number,
  totalNoteCount: number,
  tasks: Pick<TaskRecord, "noteId">[],
): string {
  if (showAs === "tasks") {
    const pageCount = new Set(tasks.map((task) => task.noteId)).size;
    return `${tasks.length} ${tasks.length === 1 ? "task" : "tasks"} across ${pageCount} ${pageCount === 1 ? "page" : "pages"}.`;
  }
  return `${filteredNoteCount} of ${totalNoteCount} ${
    totalNoteCount === 1 ? "page" : "pages"
  }.`;
}

function queryLabel(filters: PageViewFilters): string {
  const parts: string[] = [];
  if (filters.hasOpenTasks) parts.push(`has open tasks`);
  if (filters.dueSoon) parts.push(`due soon`);
  if (filters.overdue) parts.push(`overdue`);
  if (filters.tag) parts.push(`tag = #${filters.tag}`);
  if (filters.attributeKey)
    parts.push(`has attribute = ${filters.attributeKey}`);
  if (filters.blockType) {
    const label = BLOCK_TYPE_OPTIONS.find(
      (option) => option.value === filters.blockType,
    )?.label;
    if (label) parts.push(`block type = ${label}`);
  }
  if (filters.query) parts.push(`title contains “${filters.query}”`);
  const type = filters.showAs === "tasks" ? "TASKS" : "PAGES";
  return parts.length
    ? `WHERE ${parts.join("  ·  ")} (${type})`
    : `ALL ${type}`;
}

function SaveViewDialog({ filters }: { filters: PageViewFilters }) {
  const { createPageView } = useNavigation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createPageView(name, filters);
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setName("");
      }}
    >
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <BookmarkPlus /> Save as view
      </Button>
      <DialogContent>
        <form className="space-y-4" onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Save page view</DialogTitle>
            <DialogDescription>
              Save these filters so the same page list stays in the sidebar.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="View name"
            aria-label="View name"
            maxLength={80}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              Save view
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function taskMatchesDeadlineFilters(
  task: Pick<TaskRecord, "checked" | "deadline">,
  filters: Pick<PageViewFilters, "dueSoon" | "overdue">,
  now: number,
  dueSoonBefore: number,
): boolean {
  if (!filters.dueSoon && !filters.overdue) return true;
  if (task.checked || !task.deadline) return false;
  const deadline = deadlineTimestamp(task.deadline);
  return (
    (!filters.dueSoon || deadline <= dueSoonBefore) &&
    (!filters.overdue || deadline < now)
  );
}

export function noteMatchesFilters(
  note: NoteSummary,
  filters: PageViewFilters,
): boolean {
  return !(
    (filters.hasOpenTasks && note.openTasks === 0) ||
    (filters.tag && !note.tags.includes(filters.tag)) ||
    (filters.attributeKey && !(filters.attributeKey in note.attributes)) ||
    (filters.blockType && !note.blockTypes.includes(filters.blockType)) ||
    (filters.query &&
      !note.title.toLowerCase().includes(filters.query.toLowerCase()))
  );
}

export function PageView({ view }: { view: PageViewDefinition }) {
  const { notes, openNote, updatePageView } = useNavigation();
  const [draftFilters, setDraftFilters] = useState<PageViewFilters>(() => ({
    ...view.filters,
  }));
  const filters = view.custom ? view.filters : draftFilters;
  const changeFilters = (
    update: (current: PageViewFilters) => PageViewFilters,
  ) => {
    const next = update(filters);
    if (view.custom) updatePageView(view.id, next);
    else setDraftFilters(next);
  };
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [allTasks, setAllTasks] = useState<TaskRecord[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [tasksError, setTasksError] = useState(false);
  const [taskRetry, setTaskRetry] = useState(0);
  const [dueSoonHours, setDueSoonHours] = useState(
    DEFAULT_APP_SETTINGS.dueSoonHours,
  );

  useEffect(() => {
    let cancelled = false;
    setTasksLoading(true);
    setTasksError(false);
    void desktop
      .tasksList()
      .then((tasks) => {
        if (!cancelled) setAllTasks(tasks);
      })
      .catch(() => {
        if (!cancelled) setTasksError(true);
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [notes, taskRetry]);

  useEffect(() => {
    let cancelled = false;
    void desktop
      .settingsGet()
      .then((settings) => {
        if (!cancelled) setDueSoonHours(settings.dueSoonHours);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredNotes = useMemo(
    () => notes.filter((note) => noteMatchesFilters(note, filters)),
    [notes, filters],
  );

  const filteredTasks = useMemo(() => {
    if (filters.showAs !== "tasks") return [];
    const noteIds = new Set(filteredNotes.map((n) => n.id));
    const now = Date.now();
    const dueSoonBefore = now + dueSoonHours * 60 * 60 * 1000;
    return allTasks.filter(
      (task) =>
        noteIds.has(task.noteId) &&
        (!filters.hasOpenTasks || !task.checked) &&
        taskMatchesDeadlineFilters(
          task,
          { dueSoon: filters.dueSoon, overdue: filters.overdue },
          now,
          dueSoonBefore,
        ),
    );
  }, [
    allTasks,
    filteredNotes,
    filters.showAs,
    filters.hasOpenTasks,
    filters.dueSoon,
    filters.overdue,
    dueSoonHours,
  ]);

  const activeColumns = useMemo(
    () =>
      filters.showAs === "tasks"
        ? taskColumns((id, blockId) => void openNote(id, blockId))
        : columns((id) => void openNote(id)),
    [openNote, filters.showAs],
  );

  const activeData = filters.showAs === "tasks" ? filteredTasks : filteredNotes;
  const grouping = useMemo(
    () => (filters.showAs === "tasks" ? ["noteTitle"] : []),
    [filters.showAs],
  );

  const table = useReactTable<NoteSummary | TaskRecord>({
    data: activeData,
    columns: activeColumns as ColumnDef<NoteSummary | TaskRecord>[],
    state: {
      sorting,
      grouping,
      expanded: true,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });
  const rows = table.getRowModel().rows;

  const tagOptions = useMemo(() => {
    const allTags = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => allTags.add(t)));
    return Array.from(allTags)
      .sort()
      .map((t) => ({ value: t, label: `#${t}` }));
  }, [notes]);

  const attributeOptions = useMemo(() => {
    const allAttrs = new Set<string>();
    notes.forEach(
      (n) =>
        n.attributes &&
        Object.keys(n.attributes).forEach((k) => allAttrs.add(k)),
    );
    return Array.from(allAttrs)
      .sort()
      .map((a) => ({ value: a, label: a }));
  }, [notes]);

  return (
    <main className="min-h-0 overflow-auto bg-background xl:col-span-2">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-5 sm:p-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              <ListFilter className="size-3.5" /> Page view
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {view.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {viewSummary(
                filters.showAs,
                filteredNotes.length,
                notes.length,
                filteredTasks,
              )}
            </p>
          </div>
          {view.custom ? null : <SaveViewDialog filters={filters} />}
        </header>

        <section aria-label="View filters" className="space-y-3">
          <p className="overflow-hidden rounded-md border border-primary/15 bg-primary px-3 py-2 font-mono text-xs text-primary-foreground">
            {queryLabel(filters)}
          </p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_auto_auto_auto_minmax(10rem,12rem)_minmax(10rem,12rem)_minmax(10rem,12rem)_auto]">
            <Input
              value={filters.query}
              onChange={(event) =>
                changeFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))
              }
              placeholder="Filter page title…"
              aria-label="Filter page title"
              maxLength={200}
            />
            <Button
              variant={filters.hasOpenTasks ? "default" : "outline"}
              aria-pressed={filters.hasOpenTasks}
              onClick={() =>
                changeFilters((curr) => ({
                  ...curr,
                  hasOpenTasks: !curr.hasOpenTasks,
                }))
              }
            >
              Has Open Tasks
            </Button>
            <Button
              variant={filters.dueSoon ? "default" : "outline"}
              aria-pressed={filters.dueSoon}
              onClick={() =>
                changeFilters((curr) => ({
                  ...curr,
                  dueSoon: !curr.dueSoon,
                }))
              }
            >
              Due Soon
            </Button>
            <Button
              variant={filters.overdue ? "default" : "outline"}
              aria-pressed={filters.overdue}
              onClick={() =>
                changeFilters((current) => ({
                  ...current,
                  overdue: !current.overdue,
                }))
              }
            >
              Overdue
            </Button>
            <SearchableSelect
              options={tagOptions}
              value={filters.tag}
              onValueChange={(tag) =>
                changeFilters((current) => ({
                  ...current,
                  tag,
                }))
              }
              placeholder="Any tag"
              emptyMessage="No tags found."
              clearable
              aria-label="Filter by tag"
            />
            <SearchableSelect
              options={attributeOptions}
              value={filters.attributeKey}
              onValueChange={(attributeKey) =>
                changeFilters((current) => ({
                  ...current,
                  attributeKey,
                }))
              }
              placeholder="Any attribute"
              emptyMessage="No attributes found."
              clearable
              aria-label="Filter by attribute"
            />
            <SearchableSelect
              options={BLOCK_TYPE_OPTIONS}
              value={filters.blockType}
              onValueChange={(blockType) =>
                changeFilters((current) => ({
                  ...current,
                  blockType: blockType as ContentBlockType | null,
                }))
              }
              placeholder="Any block type"
              emptyMessage="No block types found."
              clearable
              aria-label="Filter by block type"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                changeFilters(() => ({
                  query: "",
                  hasOpenTasks: false,
                  dueSoon: false,
                  overdue: false,
                  tag: null,
                  attributeKey: null,
                  blockType: null,
                  showAs: "pages",
                }))
              }
            >
              <RotateCcw /> Reset
            </Button>
          </div>
        </section>

        <ToggleGroup
          type="single"
          value={filters.showAs ?? "pages"}
          onValueChange={(showAs) => {
            if (showAs !== "pages" && showAs !== "tasks") return;
            changeFilters((current) => ({
              ...current,
              showAs,
            }));
          }}
          variant="outline"
          size="sm"
          aria-label="Show view as"
        >
          <ToggleGroupItem
            value="pages"
            className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            Pages
          </ToggleGroupItem>
          <ToggleGroupItem
            value="tasks"
            className="px-4 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            Tasks
          </ToggleGroupItem>
        </ToggleGroup>

        {filters.showAs === "tasks" && tasksError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
          >
            <span>Tasks could not be loaded.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTaskRetry((value) => value + 1)}
            >
              <RotateCcw /> Retry
            </Button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-lg border bg-background shadow-xs">
          <Table>
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length ? (
                rows.map((row) => (
                  <TableRow
                    key={row.id}
                    className={row.depth > 0 ? "bg-muted/10" : ""}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="first:w-24 last:w-32">
                        {cell.getIsGrouped() ? (
                          <div className="flex items-center font-bold">
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({row.subRows.length})
                            </span>
                          </div>
                        ) : cell.getIsAggregated() ? null : cell.getIsPlaceholder() ? null : (
                          flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={activeColumns.length}
                    className="h-32 text-center text-muted-foreground"
                  >
                    {filters.showAs === "tasks"
                      ? tasksError
                        ? "Tasks unavailable."
                        : tasksLoading
                          ? "Loading tasks…"
                          : "No tasks match this view."
                      : "No pages match this view."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </main>
  );
}
