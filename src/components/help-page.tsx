import { ArrowLeft, ListChecks } from "lucide-react";
import type { ReactNode } from "react";

import { useWorkspace } from "@/components/notes-provider.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";

function HelpSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="font-serif text-2xl font-semibold tracking-tight">
        {title}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
        {description}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function HelpRow({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 py-5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="space-y-2 text-sm leading-6 text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

function Syntax({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
      {children}
    </code>
  );
}

export function HelpPage({ onClose }: { onClose(): void }) {
  const { workspacePath } = useWorkspace();

  return (
    <main className="grid h-screen grid-rows-[3.5rem_minmax(0,1fr)] overflow-hidden bg-background text-foreground">
      <header className="flex items-center border-b bg-background/95 px-3 [-webkit-app-region:drag]">
        <Button
          variant="ghost"
          size="sm"
          className="[-webkit-app-region:no-drag]"
          onClick={onClose}
        >
          <ArrowLeft /> Back to notes
        </Button>
        <span className="ml-auto pr-2 font-serif text-sm font-semibold">
          Help
        </span>
      </header>

      <ScrollArea className="min-h-0">
        <div className="mx-auto grid max-w-5xl items-start gap-10 p-6 sm:p-10 lg:grid-cols-[10rem_minmax(0,1fr)]">
          <aside className="hidden lg:sticky lg:top-10 lg:block">
            <p className="px-3 pb-2 text-xs font-semibold text-muted-foreground">
              On this page
            </p>
            <nav className="grid gap-1" aria-label="Help sections">
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-start"
              >
                <a href="#notes">Notes</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-start"
              >
                <a href="#organize">Organize</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-start"
              >
                <a href="#tasks">Tasks and views</a>
              </Button>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="justify-start"
              >
                <a href="#files">Files and saving</a>
              </Button>
            </nav>
          </aside>

          <article className="min-w-0">
            <header>
              <p className="font-mono text-xs font-medium text-primary">Help</p>
              <h1 className="mt-2 font-serif text-3xl font-semibold tracking-tight sm:text-4xl">
                Organize notes and tasks
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use journals for daily notes, pages for longer-lived topics, and
                views to collect tasks from across both.
              </p>
            </header>

            <Card className="mt-8 gap-0 py-0 shadow-none">
              <CardContent className="grid p-0 sm:grid-cols-2">
                {[
                  ["Search", "⌘/Ctrl K or P"],
                  ["Task", "- [ ] Follow up"],
                  ["Page link", "[["],
                  ["Tag / attribute", "#work · status:: active"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 border-b px-4 py-3 odd:sm:border-r last:sm:border-b-0 nth-last-2:sm:border-b-0"
                  >
                    <span className="text-xs text-muted-foreground">
                      {label}
                    </span>
                    <code className="font-mono text-xs">{value}</code>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Separator className="my-10" />

            <div className="space-y-12">
              <HelpSection
                id="notes"
                title="Notes"
                description="Capture the day in a journal or create a page when a topic needs a permanent home."
              >
                <HelpRow title="Daily journals">
                  <p>
                    Open <strong className="text-foreground">Today</strong> from
                    the sidebar. Use the journal ribbon or right-side calendar
                    to move between dates. A dot marks a date with an existing
                    entry.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Pages">
                  <p>
                    Choose <strong className="text-foreground">New page</strong>
                    , or type a new title into global search. Pages are listed
                    by most recently edited.
                  </p>
                  <p>
                    Changing a page title does not change its file path, so
                    existing links keep working.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Editing">
                  <p>
                    Use headings, lists, task lists, quotes, code, links, and
                    whiteboards from the toolbar. Drag a block by its handle to
                    reorder it.
                  </p>
                  <p>
                    Headings appear in the right-side{" "}
                    <strong className="text-foreground">Outline</strong>. Select
                    one to jump to it.
                  </p>
                </HelpRow>
              </HelpSection>

              <HelpSection
                id="organize"
                title="Organize"
                description="Connect related notes and add lightweight metadata for filtering."
              >
                <HelpRow title="Page links">
                  <p>
                    Type <Syntax>[[</Syntax> to search for a page and insert a
                    link. Select the link to open it. Dyno identifies links that
                    are missing or match more than one page.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Block links">
                  <p>
                    Place the cursor in a paragraph, heading, list item, task,
                    quote, or code block, then choose{" "}
                    <strong className="text-foreground">Copy block link</strong>{" "}
                    in the toolbar. Paste it into another note to link directly
                    to that block.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Backlinks">
                  <p>
                    <strong className="text-foreground">
                      Linked references
                    </strong>{" "}
                    in the right panel shows every note that links to the
                    current page or block, with a short excerpt.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Tags and attributes">
                  <p>
                    Add a tag such as <Syntax>#work</Syntax> anywhere in a note.
                    Add an attribute on its own line, such as{" "}
                    <Syntax>status:: active</Syntax>.
                  </p>
                  <p>
                    Tags and attributes apply to the whole note. Views can
                    filter by an exact tag or by the presence of an attribute.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Find a note">
                  <p>
                    Press <Syntax>⌘/Ctrl K</Syntax> or <Syntax>⌘/Ctrl P</Syntax>{" "}
                    to search titles and note content. Results include a
                    matching excerpt. Use Back and Forward in the header to
                    retrace your navigation.
                  </p>
                </HelpRow>
              </HelpSection>

              <HelpSection
                id="tasks"
                title="Tasks and views"
                description="Keep tasks beside their notes, then use views to see them together."
              >
                <Card className="mb-6 gap-4 border-primary/25 bg-primary/5 shadow-none">
                  <CardContent className="flex gap-4">
                    <ListChecks className="mt-0.5 size-5 shrink-0 text-primary" />
                    <div>
                      <h3 className="font-semibold">See all open tasks</h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        Select <strong>Open tasks</strong> under Views.
                        Unchecked tasks are grouped by their source page.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <HelpRow title="Create a task">
                  <p>
                    Use the Task list toolbar button, or enter{" "}
                    <Syntax>- [ ] Follow up</Syntax> in Markdown mode. Select
                    its checkbox when it is complete.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Set a deadline">
                  <p>
                    Select the calendar icon in the toolbar while your cursor is
                    on a task to pick a date and, optionally, a time. Or type it
                    directly: <Syntax>due:: 2026-08-01</Syntax> or{" "}
                    <Syntax>due:: 24/07/2026 14:30</Syntax> in Markdown mode.
                  </p>
                  <p>
                    It appears as a Deadline column in Tasks views, and you get
                    a desktop notification once it is due within a day or
                    overdue.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Filter">
                  <p>
                    Filter a view by page title, tag, attribute, or whether the
                    note has open tasks. Filters combine, and Reset clears them.
                  </p>
                  <p>
                    A view filters notes first. In{" "}
                    <strong className="text-foreground">Tasks</strong> mode it
                    then lists tasks from those matching notes.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Pages or tasks">
                  <p>
                    Switch between{" "}
                    <strong className="text-foreground">Pages</strong> and{" "}
                    <strong className="text-foreground">Tasks</strong>. Use
                    column headings with a sort icon to change the order.
                  </p>
                  <p>
                    To include completed tasks, choose Tasks and turn off{" "}
                    <strong className="text-foreground">Has Open Tasks</strong>.
                    Sort by Status to group checked and unchecked items.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Create a view">
                  <p>
                    Choose the <strong className="text-foreground">+</strong>{" "}
                    beside Views, name the view, then set its filters and
                    display mode. Changes save automatically on this device. Use
                    the trash button beside a custom view to remove it.
                  </p>
                  <p>
                    To copy the built-in Open tasks view, adjust it and choose{" "}
                    <strong className="text-foreground">Save as view</strong>.
                  </p>
                </HelpRow>
              </HelpSection>

              <HelpSection
                id="files"
                title="Files and saving"
                description="Notes are Markdown files in Dyno's local workspace."
              >
                <HelpRow title="Workspace">
                  <code className="block break-all font-mono text-xs text-foreground">
                    {workspacePath}
                  </code>
                </HelpRow>
                <Separator />
                <HelpRow title="Autosave">
                  <p>
                    Changes save automatically. The badge above the editor shows
                    Saved, Saving, Unsaved, Conflict, or Error.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Markdown mode">
                  <p>
                    Switch between Write and Markdown above the title. Markdown
                    that the visual editor cannot safely preserve opens in
                    Markdown mode; convert it only if you accept Dyno's
                    supported format.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Import">
                  <p>
                    Open Settings → Import to copy existing <Syntax>.md</Syntax>{" "}
                    files into Dyno. The original files are not changed.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="Trash">
                  <p>
                    Moving a note to Trash keeps it in the workspace Trash. Use
                    the Undo action immediately, or open Settings → Trash to
                    restore it later.
                  </p>
                  <p>
                    Restore returns the note to its original path. If another
                    file already exists there, Dyno leaves the note in Trash
                    instead of overwriting either file.
                  </p>
                  <p>
                    Permanently deleting a note from Trash cannot be undone.
                  </p>
                </HelpRow>
                <Separator />
                <HelpRow title="External changes">
                  <p>
                    Dyno notices edits made outside the app. If your local edits
                    conflict with the file on disk, compare both versions and
                    choose Keep mine or Use disk.
                  </p>
                </HelpRow>
              </HelpSection>
            </div>
          </article>
        </div>
      </ScrollArea>
    </main>
  );
}
