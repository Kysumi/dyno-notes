import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useNavigation } from "@/components/notes-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card } from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import type { SearchResult } from "@/lib/contracts.ts";
import { desktop } from "@/lib/desktop.ts";

export function AppHeader() {
  const { openNote, workspacePath } = useNavigation();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void desktop.notesSearch(query).then((found) => {
        if (!cancelled) setResults(found);
      }).catch(() => {
        if (!cancelled) setResults([]);
      });
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const close = () => {
    setQuery("");
    setResults([]);
    document.querySelector<HTMLElement>("[contenteditable=true]")?.focus();
  };

  return (
    <header className="col-span-full grid grid-cols-[1fr_auto] items-center gap-4 border-b bg-stone-50/95 px-3 [-webkit-app-region:drag] sm:grid-cols-[1fr_minmax(16rem,34rem)_1fr]">
      <div className="flex items-center gap-2">
        <span className="grid size-7 place-items-center rounded-lg bg-emerald-900 font-serif text-base font-bold text-stone-50">
          D
        </span>
        <span className="hidden font-semibold tracking-tight sm:inline">
          Dyno Notes
        </span>
      </div>

      <div className="relative hidden sm:block [-webkit-app-region:no-drag]">
        <Search className="pointer-events-none absolute top-2 left-3 z-10 size-4 text-muted-foreground" />
        <Input
          ref={input}
          aria-label="Search notes"
          placeholder="Search notes…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
          className="h-8 bg-white/70 pl-9 text-xs shadow-xs"
        />
        {query.trim()
          ? (
            <Card className="absolute top-10 z-50 max-h-80 w-full gap-0 overflow-y-auto py-1 shadow-lg">
              {results.length
                ? results.map((result) => (
                  <Button
                    key={result.id}
                    variant="ghost"
                    className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                    onClick={() => {
                      void openNote(result.id).then((opened) => {
                        if (opened) close();
                      });
                    }}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">
                        {result.title}
                      </span>
                      <span className="block truncate text-xs font-normal text-muted-foreground">
                        {result.excerpt}
                      </span>
                    </span>
                  </Button>
                ))
                : (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    No matching notes
                  </p>
                )}
            </Card>
          )
          : null}
      </div>

      <p
        className="truncate text-right font-mono text-[10px] text-muted-foreground"
        title={workspacePath}
      >
        {workspacePath}
      </p>
    </header>
  );
}
