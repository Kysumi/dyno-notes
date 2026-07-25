import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleHelp,
  FilePlus2,
  FileText,
  ListTodo,
  Search,
  Settings,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useWorkspace } from "@/components/notes-provider.tsx";
import { TabsStrip } from "@/components/tabs-strip.tsx";
import {
  useActiveTabNavigation,
  useTabs,
} from "@/components/tabs-provider.tsx";
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
import { dateValue } from "@/lib/dates.ts";
import { desktop } from "@/lib/desktop.ts";

function CommandPalette({
  onOpenHelp,
  onOpenSettings,
}: {
  onOpenHelp(): Promise<boolean>;
  onOpenSettings(): Promise<boolean>;
}) {
  const { notes, createPage } = useWorkspace();
  const { openNewTab } = useTabs();
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
        className="h-8 w-8 justify-center bg-background/70 text-xs font-normal text-muted-foreground shadow-xs sm:w-full sm:justify-between [-webkit-app-region:no-drag]"
        aria-label="Open command palette"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Search />
          <span className="hidden sm:inline">
            Search pages or run a command
          </span>
        </span>
        <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:block">
          ⌘K / ⌘P
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        title="Command palette"
        description="Navigate Dyno Notes, search your notes, or create a page from the entered title."
        className="border-primary/20 shadow-2xl sm:max-w-xl"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages, run a command, or type a title…"
          maxLength={200}
        />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty>No pages or commands found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            <CommandItem
              value="Today"
              keywords={["journal", "daily note"]}
              onSelect={() => {
                openNewTab({ noteId: `journals/${dateValue()}.md` });
                close();
              }}
            >
              <CalendarDays />
              Today
            </CommandItem>
            <CommandItem
              value="Open tasks"
              keywords={["todo", "view"]}
              onSelect={() => {
                openNewTab({ pageViewId: "open-tasks" });
                close();
              }}
            >
              <ListTodo />
              Open tasks
            </CommandItem>
            <CommandItem
              value="Settings"
              keywords={["preferences", "appearance"]}
              onSelect={() => {
                void onOpenSettings().then((opened) => {
                  if (opened) close();
                });
              }}
            >
              <Settings />
              Settings
            </CommandItem>
            <CommandItem
              value="Help"
              keywords={["guide", "documentation"]}
              onSelect={() => {
                void onOpenHelp().then((opened) => {
                  if (opened) close();
                });
              }}
            >
              <CircleHelp />
              Help
            </CommandItem>
          </CommandGroup>
          {pages.length ? (
            <CommandGroup heading={title ? "Search results" : "Pages"}>
              {pages.map((page) => (
                <CommandItem
                  key={page.id}
                  value={page.id}
                  keywords={[page.title, page.excerpt]}
                  onSelect={() => {
                    openNewTab({ noteId: page.id });
                    close();
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
                  void createPage(title).then((file) => {
                    if (!file) return;
                    openNewTab({ noteId: file.id });
                    close();
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

export function AppHeader({
  onOpenHelp,
  onOpenSettings,
}: {
  onOpenHelp(): Promise<boolean>;
  onOpenSettings(): Promise<boolean>;
}) {
  const { canGoBack, canGoForward, goBack, goForward } =
    useActiveTabNavigation();

  return (
    <header className="col-span-full flex flex-col border-b bg-background/95 [-webkit-app-region:drag]">
      <TabsStrip />
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-1.5 [-webkit-app-region:drag] sm:gap-4 lg:grid-cols-[1fr_minmax(26rem,38rem)_1fr]">
        <div className="flex min-w-0 items-center gap-2 [-webkit-app-region:no-drag]">
          <span className="grid size-7 place-items-center rounded-lg bg-foreground font-serif text-base font-bold text-background">
            D
          </span>
          <span className="hidden font-semibold tracking-tight sm:inline">
            Dyno Notes
          </span>
          <div className="ml-1 flex items-center">
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

        <CommandPalette
          onOpenHelp={onOpenHelp}
          onOpenSettings={onOpenSettings}
        />
        <div />
      </div>
    </header>
  );
}
