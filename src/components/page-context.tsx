import type { JSONContent } from "@tiptap/core";
import { ChevronRight, FileText, Link } from "lucide-react";

import { useNotes } from "@/components/notes-provider.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { scanMarkdown } from "@/lib/markdown-scanner.ts";

function text(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(text).join(" ");
}

function visit(node: JSONContent, callback: (node: JSONContent) => void): void {
  callback(node);
  for (const child of node.content ?? []) visit(child, callback);
}

export function PageContext() {
  const { note, notes, draft, backlinks, openNote } = useNotes();
  if (!note) {
    return <aside className="hidden border-l bg-muted/30 xl:block" />;
  }

  const headings: Array<{ title: string; level: number }> = [];
  let words = 0;
  let links = 0;
  if (draft.mode === "source") {
    const scanned = scanMarkdown(draft.source);
    words = scanned.wordCount;
    links = scanned.links.length;
  } else {
    visit(draft.content, (node) => {
      if (node.type === "heading") {
        headings.push({
          title: text(node),
          level: Number(node.attrs?.level ?? 2),
        });
      }
      if (node.type === "text") {
        words += node.text?.trim().split(/\s+/u).filter(Boolean).length ?? 0;
      }
      if (node.type === "wikiLink") links++;
    });
  }
  const summary = notes.find((candidate) => candidate.id === note.id);

  return (
    <aside className="hidden min-h-0 border-l bg-muted/30 xl:block">
      <ScrollArea className="h-full [&_[data-slot=scroll-area-viewport]>div]:!block">
        <div className="space-y-6 p-4">
          <section className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Outline
            </p>
            <nav className="grid" aria-label="Page outline">
              {headings.length
                ? headings.map((heading, index) => (
                  <Button
                    key={`${heading.title}-${index}`}
                    variant="ghost"
                    size="sm"
                    className={heading.level > 2
                      ? "min-w-0 w-full justify-start pl-6 font-normal"
                      : "min-w-0 w-full justify-start font-normal"}
                    onClick={() =>
                      document.querySelectorAll<HTMLElement>(
                        ".tiptap h2, .tiptap h3, .tiptap h4, .tiptap h5, .tiptap h6",
                      )[index]
                        ?.scrollIntoView({ block: "center" })}
                  >
                    <ChevronRight />{" "}
                    <span className="min-w-0 flex-1 truncate text-left">
                      {heading.title}
                    </span>
                  </Button>
                ))
                : (
                  <p className="px-2 text-xs text-muted-foreground">
                    No headings
                  </p>
                )}
            </nav>
          </section>

          <Separator />

          <section className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              <span>Linked references</span>
              <Badge variant="secondary" className="px-1.5 text-[10px]">
                {backlinks.length}
              </Badge>
            </div>
            {backlinks.length
              ? backlinks.map((backlink, index) => (
                <Card
                  key={`${backlink.sourceId}-${index}`}
                  className="gap-0 py-0 shadow-none"
                >
                  <Button
                    variant="ghost"
                    className="h-auto w-full justify-start whitespace-normal p-0 text-left"
                    onClick={() =>
                      void openNote(
                        backlink.sourceId,
                        backlink.sourceBlockId ?? undefined,
                      )}
                  >
                    <CardContent className="w-full space-y-1.5 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        {backlink.targetBlockId ? <Link /> : <FileText />}{" "}
                        {backlink.sourceTitle}
                      </div>
                      <p className="font-serif text-xs leading-5 text-muted-foreground">
                        {backlink.excerpt}
                      </p>
                    </CardContent>
                  </Button>
                </Card>
              ))
              : <p className="text-xs text-muted-foreground">No backlinks</p>}
          </section>

          <Separator />

          <section className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Page
            </p>
            <dl className="grid gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">Path</dt>
                <dd className="break-all font-mono">{note.id}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Modified</dt>
                <dd>
                  {summary ? new Date(summary.updatedAt).toLocaleString() : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Words</dt>
                <dd>{words}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Outgoing links</dt>
                <dd>{links}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Backlinks</dt>
                <dd>{backlinks.length}</dd>
              </div>
            </dl>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
