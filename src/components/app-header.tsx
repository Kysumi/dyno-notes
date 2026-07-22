import {
  ArrowLeft,
  ArrowRight,
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
import { desktop } from "@/lib/desktop.ts";

function CommandPalette() {
  const { notes, openNote, createPage } = useNavigation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const title = query.trim();
  const pages: SearchResult[] = title ? results : notes
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
      void desktop.notesSearch(title).then((found) => {
        if (!cancelled) setResults(found);
      }).catch(() => {
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
        className="h-8 w-8 justify-center bg-white/70 text-xs font-normal text-muted-foreground shadow-xs sm:w-full sm:justify-between [-webkit-app-region:no-drag]"
        aria-label="Search or create a page"
        onClick={() => setOpen(true)}
      >
        <span className="flex items-center gap-2">
          <Search />
          <span className="hidden sm:inline">Search or create a page</span>
        </span>
        <kbd className="hidden rounded border bg-stone-100 px-1.5 py-0.5 font-mono text-[10px] sm:block">
          ⌘K / ⌘P
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery("");
        }}
        title="Search or create a page"
        description="Search your notes or create a page from the entered title."
        className="border-emerald-950/20 shadow-2xl sm:max-w-xl"
      >
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search pages or type a new title…"
          maxLength={200}
        />
        <CommandList className="max-h-[min(24rem,60vh)]">
          <CommandEmpty>No pages found.</CommandEmpty>
          {pages.length
            ? (
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
                      {page.excerpt
                        ? (
                          <span className="block truncate text-xs font-normal text-muted-foreground">
                            {page.excerpt}
                          </span>
                        )
                        : null}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )
            : null}
          {title
            ? (
              <CommandGroup heading="Create">
                <CommandItem
                  value={`Create new page ${title}`}
                  onSelect={() => {
                    void createPage(title).then((created) => {
                      if (created) close();
                    });
                  }}
                >
                  <FilePlus2 className="text-emerald-800" />
                  <span className="min-w-0 truncate">
                    Create <strong className="font-medium">“{title}”</strong>
                  </span>
                  <CommandShortcut>↵</CommandShortcut>
                </CommandItem>
              </CommandGroup>
            )
            : null}
        </CommandList>
        <div className="flex items-center justify-end gap-3 border-t bg-stone-50 px-3 py-2 font-mono text-[10px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </CommandDialog>
    </>
  );
}

export function AppHeader() {
  const {
    canGoBack,
    canGoForward,
    goBack,
    goForward,
    workspacePath,
  } = useNavigation();

  return (
    <header className="col-span-full grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 border-b bg-stone-50/95 px-3 [-webkit-app-region:drag] sm:grid-cols-[1fr_minmax(16rem,34rem)_1fr]">
      <div className="flex items-center gap-2 [-webkit-app-region:no-drag]">
        <span className="grid size-7 place-items-center rounded-lg bg-emerald-900 font-serif text-base font-bold text-stone-50">
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

      <CommandPalette />

      <p
        className="truncate text-right font-mono text-[10px] text-muted-foreground"
        title={workspacePath}
      >
        {workspacePath}
      </p>
    </header>
  );
}
