import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { ArrowUpDown, BookmarkPlus, ListFilter, RotateCcw } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import {
  type TaskViewDefinition,
  type TaskViewFilters,
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
import type { NoteSummary, TaskRecord } from "@/lib/contracts.ts";
import { desktop } from "@/lib/desktop.ts";

const statusOptions = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
  { value: "all", label: "Any status" },
] as const;
const dateFormatter = new Intl.DateTimeFormat("en-NZ", { dateStyle: "medium" });

function SortableHeader({
  column,
  children,
}: {
  column: Column<TaskRecord>;
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

function columns(
  openTask: (task: TaskRecord) => void,
): ColumnDef<TaskRecord>[] {
  return [
    {
      accessorKey: "checked",
      header: ({ column }) => (
        <SortableHeader column={column}>Status</SortableHeader>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => (
        <Badge variant={row.original.checked ? "secondary" : "outline"}>
          {row.original.checked ? "Done" : "Open"}
        </Badge>
      ),
    },
    {
      accessorKey: "text",
      header: ({ column }) => (
        <SortableHeader column={column}>Task</SortableHeader>
      ),
      cell: ({ row }) => (
        <Button
          variant="link"
          className="h-auto max-w-[38rem] justify-start whitespace-normal p-0 text-left font-medium text-foreground"
          onClick={() => openTask(row.original)}
        >
          {row.original.text}
        </Button>
      ),
    },
    {
      accessorKey: "noteId",
      header: ({ column }) => (
        <SortableHeader column={column}>Source</SortableHeader>
      ),
      filterFn: (row, id, value) => row.getValue(id) === value,
      cell: ({ row }) => (
        <span className="block max-w-52 truncate" title={row.original.noteId}>
          {row.original.noteTitle}
        </span>
      ),
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

function filterState(filters: TaskViewFilters): ColumnFiltersState {
  return [
    ...(filters.query ? [{ id: "text", value: filters.query }] : []),
    ...(filters.sourceId ? [{ id: "noteId", value: filters.sourceId }] : []),
    ...(filters.status === "all"
      ? []
      : [{ id: "checked", value: filters.status === "done" }]),
  ];
}

function queryLabel(filters: TaskViewFilters, notes: NoteSummary[]): string {
  const parts = filters.status === "all" ? [] : [`status = ${filters.status}`];
  if (filters.sourceId) {
    const source = notes.find((note) => note.id === filters.sourceId);
    parts.push(`source = “${source?.title ?? filters.sourceId}”`);
  }
  if (filters.query) parts.push(`task contains “${filters.query}”`);
  return parts.length ? `WHERE ${parts.join("  ·  ")}` : "ALL TASKS";
}

function SaveViewDialog({ filters }: { filters: TaskViewFilters }) {
  const { createTaskView } = useNavigation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    createTaskView(name, filters);
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
            <DialogTitle>Save task view</DialogTitle>
            <DialogDescription>
              Save these filters so the same task list stays in the sidebar.
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
            <Button type="submit" disabled={!name.trim()}>Save view</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function TaskView({ view }: { view: TaskViewDefinition }) {
  const { notes, openNote } = useNavigation();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [filters, setFilters] = useState<TaskViewFilters>(() => ({
    ...view.filters,
  }));
  const [sorting, setSorting] = useState<SortingState>([
    { id: "updatedAt", desc: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void desktop.tasksList().then((next) => {
      if (!cancelled) {
        setTasks(next);
        setError(null);
      }
    }).catch((failure) => {
      if (!cancelled) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Tasks could not be loaded.",
        );
      }
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [notes]);

  const tableColumns = useMemo(
    () =>
      columns((task) => void openNote(task.noteId, task.blockId ?? undefined)),
    [openNote],
  );
  const columnFilters = useMemo(() => filterState(filters), [filters]);
  const table = useReactTable({
    data: tasks,
    columns: tableColumns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const rows = table.getRowModel().rows;
  const sourceOptions = useMemo(
    () =>
      Array.from(new Map(tasks.map((task) => [task.noteId, {
        value: task.noteId,
        label: task.noteTitle,
      }])).values()).sort((a, b) => a.label.localeCompare(b.label)),
    [tasks],
  );

  return (
    <main className="min-h-0 overflow-auto bg-background xl:col-span-2">
      <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-5 p-5 sm:p-8">
        <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold tracking-[0.14em] text-primary uppercase">
              <ListFilter className="size-3.5" /> Task view
            </div>
            <h1 className="font-serif text-3xl font-semibold tracking-tight">
              {view.name}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Reading Markdown tasks…"
                : `${rows.length} of ${tasks.length} tasks`}
            </p>
          </div>
          <SaveViewDialog filters={filters} />
        </header>

        <section aria-label="View filters" className="space-y-3">
          <p className="overflow-hidden rounded-md border border-primary/15 bg-primary px-3 py-2 font-mono text-xs text-primary-foreground">
            {queryLabel(filters, notes)}
          </p>
          <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_10rem_minmax(12rem,16rem)_auto]">
            <Input
              value={filters.query}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  query: event.target.value,
                }))}
              placeholder="Filter task text…"
              aria-label="Filter task text"
              maxLength={200}
            />
            <SearchableSelect
              options={statusOptions}
              value={filters.status}
              onValueChange={(status) =>
                status && setFilters((current) => ({
                  ...current,
                  status: status as TaskViewFilters["status"],
                }))}
              placeholder="Status"
              aria-label="Filter by task status"
            />
            <SearchableSelect
              options={sourceOptions}
              value={filters.sourceId}
              onValueChange={(sourceId) =>
                setFilters((current) => ({
                  ...current,
                  sourceId,
                }))}
              placeholder="Any source"
              emptyMessage="No task sources found."
              clearable
              aria-label="Filter by source note"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({ query: "", status: "all", sourceId: null })}
            >
              <RotateCcw /> Reset
            </Button>
          </div>
        </section>

        <div className="overflow-hidden rounded-lg border bg-background shadow-xs">
          <Table>
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder ? null : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {rows.length
                ? rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="first:w-24 last:w-32">
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
                : (
                  <TableRow>
                    <TableCell
                      colSpan={tableColumns.length}
                      className="h-32 text-center text-muted-foreground"
                    >
                      {loading
                        ? "Reading Markdown tasks…"
                        : error ?? (tasks.length
                          ? "No tasks match this view."
                          : "Add a Markdown checkbox task to see it here.")}
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
