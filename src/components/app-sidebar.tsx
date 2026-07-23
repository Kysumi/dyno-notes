import {
  Calendar,
  CircleHelp,
  FileText,
  ListTodo,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { type FormEvent, useState } from "react";

import { useNavigation } from "@/components/notes-provider.tsx";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import { dateValue } from "@/lib/dates.ts";

function NewPageDialog() {
  const { createPage } = useNavigation();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (await createPage(title)) {
      setTitle("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        size="sm"
        className="w-full justify-start shadow-none"
        onClick={() => setOpen(true)}
      >
        <Plus /> New page
      </Button>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New page</DialogTitle>
            <DialogDescription>
              The title becomes the first H1; its file path stays stable
              afterward.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Page title"
            aria-label="Page title"
            maxLength={200}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create page</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AppSidebar({
  onOpenHelp,
  onOpenSettings,
}: {
  onOpenHelp(): void;
  onOpenSettings(): void;
}) {
  const {
    notes,
    noteId,
    pageViews,
    activePageView,
    openNote,
    openPageView,
    deletePageView,
  } = useNavigation();
  const journalId = `journals/${dateValue()}.md`;
  const journals = notes
    .filter((summary) => summary.kind === "journal")
    .sort((a, b) => b.id.localeCompare(a.id));
  const pages = notes
    .filter((summary) => summary.kind === "page")
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const noteButton = (id: string, title: string, icon?: "journal" | "page") => (
    <Button
      key={id}
      variant="ghost"
      size="sm"
      className={
        noteId === id
          ? "w-full justify-start bg-accent text-accent-foreground hover:bg-accent"
          : "w-full justify-start font-normal text-muted-foreground"
      }
      onClick={() => void openNote(id)}
    >
      {icon === "journal" ? (
        <Calendar />
      ) : icon === "page" ? (
        <FileText />
      ) : null}
      <span className="truncate">{title}</span>
    </Button>
  );

  return (
    <aside className="hidden min-h-0 border-r bg-muted/50 md:flex md:flex-col">
      <div className="p-3">
        <NewPageDialog />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="grid gap-0.5" aria-label="Workspace">
          {noteButton(journalId, "Today", "journal")}
          <div className="flex items-center justify-between px-2 pt-5 pb-1">
            <p className="text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
              Views
            </p>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground hover:bg-transparent hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  <span className="sr-only">How to create a view</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="right" className="text-sm w-64 space-y-2">
                <p>
                  To create a new view, use the <strong>global search</strong>{" "}
                  to filter pages, then click <strong>Save as view</strong>.
                </p>
              </PopoverContent>
            </Popover>
          </div>
          {pageViews.map((view) => (
            <div key={view.id} className="flex min-w-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={
                  activePageView?.id === view.id
                    ? "min-w-0 flex-1 justify-start bg-accent text-accent-foreground hover:bg-accent"
                    : "min-w-0 flex-1 justify-start font-normal text-muted-foreground"
                }
                onClick={() => void openPageView(view.id)}
              >
                <ListTodo />
                <span className="truncate">{view.name}</span>
              </Button>
              {view.custom ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${view.name}`}
                  onClick={() => deletePageView(view.id)}
                >
                  <Trash2 />
                </Button>
              ) : null}
            </div>
          ))}
          <p className="px-2 pt-5 pb-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Journals
          </p>
          {journals.map((summary) => noteButton(summary.id, summary.title))}
          <p className="px-2 pt-5 pb-1 text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Pages
          </p>
          {pages.map((summary) => noteButton(summary.id, summary.title))}
        </nav>
      </ScrollArea>
      <div className="p-2">
        <Separator className="mb-2" />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onOpenHelp}
        >
          <CircleHelp /> Help
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground"
          onClick={onOpenSettings}
        >
          <Settings /> Settings
        </Button>
      </div>
    </aside>
  );
}
