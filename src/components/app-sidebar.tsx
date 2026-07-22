import { Calendar, FileText, Plus, Settings } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${
    String(date.getMonth() + 1).padStart(2, "0")
  }-${String(date.getDate()).padStart(2, "0")}`;
}

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
        className="w-full justify-start bg-emerald-900 shadow-none hover:bg-emerald-800"
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

function ImportDialog() {
  const { importFiles } = useNavigation();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const runImport = async () => {
    setImporting(true);
    const nextFailures = await importFiles(files);
    setFailures(nextFailures);
    setImporting(false);
    if (!nextFailures.length) {
      setFiles([]);
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="ghost"
        size="sm"
        className="w-full justify-start text-stone-700"
        onClick={() => setOpen(true)}
      >
        <Settings /> Settings & import
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import Markdown</DialogTitle>
          <DialogDescription>
            Files are copied into the managed pages folder. Their source remains
            plain Markdown.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".md,text/markdown"
          multiple
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
        {failures.length
          ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {failures.map((failure) => <li key={failure}>{failure}</li>)}
            </ul>
          )
          : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={!files.length || importing}
            onClick={() => void runImport()}
          >
            {importing ? "Importing…" : `Import ${files.length || ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AppSidebar() {
  const { notes, noteId, openNote } = useNavigation();
  const journalId = `journals/${localDate()}.md`;
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
      className={noteId === id
        ? "w-full justify-start bg-stone-200 text-emerald-950 hover:bg-stone-200"
        : "w-full justify-start font-normal text-stone-700"}
      onClick={() => void openNote(id)}
    >
      {icon === "journal"
        ? <Calendar />
        : icon === "page"
        ? <FileText />
        : null}
      <span className="truncate">{title}</span>
    </Button>
  );

  return (
    <aside className="hidden min-h-0 border-r bg-stone-100/80 md:flex md:flex-col">
      <div className="p-3">
        <NewPageDialog />
      </div>
      <ScrollArea className="min-h-0 flex-1 px-2">
        <nav className="grid gap-0.5" aria-label="Notes">
          {noteButton(journalId, "Today", "journal")}
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
        <ImportDialog />
      </div>
    </aside>
  );
}
