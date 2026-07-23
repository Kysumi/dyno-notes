import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  FileText,
  Search,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useNavigation } from "@/components/notes-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command.tsx";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip.tsx";
import type { SearchResult } from "@/lib/contracts.ts";
import {
  dateValue,
  journalDateFromId,
  journalTitle,
  shiftDate,
  weekDates,
} from "@/lib/dates.ts";
import { desktop } from "@/lib/desktop.ts";

const weekdayFormat = new Intl.DateTimeFormat("en-NZ", { weekday: "short" });
const compactDateFormat = new Intl.DateTimeFormat("en-NZ", {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function displayDate(value: string): Date {
  return new Date(`${value}T12:00:00`);
}

function focusEditor(): void {
  requestAnimationFrame(() =>
    document
      .querySelector<HTMLElement>(
        '[aria-label="Note body"], [aria-label="Markdown source"]',
      )
      ?.focus(),
  );
}

function CommandPalette({ compact = false }: { compact?: boolean }) {
  const { notes, openNote, createPage } = useNavigation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const title = query.trim();
  const pages: SearchResult[] = title
    ? results
    : notes
        .filter((note) => note.kind === "page")
        .map((note) => ({ id: note.id, title: note.title, excerpt: "" }));

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (
        ["k", "p"].includes(event.key.toLowerCase()) &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!title) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void desktop
        .notesSearch(title)
        .then((found) => {
          if (!cancelled) setResults(found);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [title]);

  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={
          compact
            ? "h-8 w-8 justify-center bg-background/70 text-muted-foreground shadow-xs [-webkit-app-region:no-drag]"
            : "h-8 w-8 justify-center bg-background/70 text-xs font-normal text-muted-foreground shadow-xs sm:w-full sm:justify-between [-webkit-app-region:no-drag]"
        }
        aria-label="Search or create a page"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Search />
          <span className={compact ? "sr-only" : "hidden sm:inline"}>
            Search or create a page
          </span>
        </span>
        {compact ? null : (
          <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:block">
            ⌘K / ⌘P
          </kbd>
        )}
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        title="Search or create a page"
        description="Search your notes or create a page from the entered title."
        className="border-primary/20 shadow-2xl sm:max-w-xl"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages or type a new title…"
          maxLength={200}
        />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty>No pages found.</CommandEmpty>
          {pages.length ? (
            <CommandGroup heading={title ? "Search results" : "Pages"}>
              {pages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={page.id}
                  keywords={[page.title, page.excerpt]}
                  onSelect={() => {
                    void openNote(page.id).then((opened) => {
                      if (opened) close();
                    });
                  }}
                >
                  <FileText />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {page.title}
                    </span>
                    {page.excerpt ? (
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {page.excerpt}
                      </span>
                    ) : null}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {title ? (
            <CommandGroup heading="Create">
              <CommandItem
                value={`Create new page ${title}`}
                onSelect={() => {
                  void createPage(title).then((created) => {
                    if (created) close();
                  });
                }}
              >
                <FilePlus2 className="text-primary" />
                <span className="min-w-0 truncate">
                  Create <strong className="font-medium">“{title}”</strong>
                </span>
                <CommandShortcut>↵</CommandShortcut>
              </CommandItem>
            </CommandGroup>
          ) : null}
        </CommandList>
        <div className="flex items-center justify-end gap-3 border-t bg-muted/40 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </CommandDialog>
    </>
  );
}

function JournalCalendar({ date }: { date: string }) {
  const { notes, openJournal } = useNavigation();
  const today = dateValue();

  const open = async (value: string) => {
    if (!(await openJournal(value))) return;
    focusEditor();
  };

  return (
    <nav
      aria-label="Journal dates"
      className="flex min-w-0 items-center justify-center gap-1 [-webkit-app-region:no-drag]"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous week"
            onClick={() => void open(shiftDate(date, -7))}
          >
            <ChevronLeft />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Previous week</TooltipContent>
      </Tooltip>

      <span className="min-w-24 text-center text-xs font-medium md:hidden">
        {compactDateFormat.format(displayDate(date))}
      </span>
      <div className="hidden min-w-0 flex-1 grid-cols-7 gap-1 md:grid">
        {weekDates(date).map((value) => {
          const selected = value === date;
          const hasEntry = notes.some(
            (note) => note.id === `journals/${value}.md`,
          );
          return (
            <Button
              key={value}
              type="button"
              variant="ghost"
              className={
                selected
                  ? "h-10 min-w-0 flex-col gap-0 rounded-lg bg-primary px-1 text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
                  : value === today
                    ? "h-10 min-w-0 flex-col gap-0 rounded-lg px-1 text-primary ring-1 ring-primary/40"
                    : "h-10 min-w-0 flex-col gap-0 rounded-lg px-1 text-muted-foreground"
              }
              aria-label={`${journalTitle(value)}${
                hasEntry ? ", has journal entry" : ""
              }`}
              aria-current={selected ? "date" : undefined}
              onClick={() => void open(value)}
            >
              <span className="text-[9px] leading-none font-semibold tracking-wider uppercase">
                {weekdayFormat.format(displayDate(value))}
              </span>
              <span className="font-serif text-base leading-5">
                {Number(value.slice(-2))}
              </span>
              <span
                aria-hidden="true"
                className={
                  hasEntry
                    ? "size-1.5 rounded-full bg-blue-500 ring-1 ring-white"
                    : "size-1.5"
                }
              />
            </Button>
          );
        })}
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next week"
            onClick={() => void open(shiftDate(date, 7))}
          >
            <ChevronRight />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Next week</TooltipContent>
      </Tooltip>
    </nav>
  );
}

export function AppHeader() {
  const { canGoBack, canGoForward, goBack, goForward, noteId, workspacePath } =
    useNavigation();
  const journalDate = journalDateFromId(noteId ?? "");

  return (
    <header className="col-span-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b bg-background/95 px-3 [-webkit-app-region:drag] sm:gap-4 lg:grid-cols-[1fr_minmax(26rem,38rem)_1fr]">
      <div className="flex min-w-0 items-center gap-2 [-webkit-app-region:no-drag]">
        <span className="grid size-7 place-items-center rounded-lg bg-primary font-serif text-base font-bold text-primary-foreground">
          D
        </span>
        <span className="hidden font-semibold tracking-tight sm:inline">
          Dyno Notes
        </span>
        <div
          className={
            journalDate
              ? "ml-1 hidden items-center sm:flex"
              : "ml-1 flex items-center"
          }
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Go back"
                disabled={!canGoBack}
                onClick={() => void goBack()}
              >
                <ArrowLeft />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Back</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Go forward"
                disabled={!canGoForward}
                onClick={() => void goForward()}
              >
                <ArrowRight />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Forward</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {journalDate ? (
        <JournalCalendar date={journalDate} />
      ) : (
        <CommandPalette />
      )}

      {journalDate ? (
        <div className="flex items-center justify-end gap-2 [-webkit-app-region:no-drag]">
          <CommandPalette compact />
        </div>
      ) : (
        <p
          className="truncate text-right font-mono text-[10px] text-muted-foreground"
          title={workspacePath}
        >
          {workspacePath}
        </p>
      )}
    </header>
  );
}
