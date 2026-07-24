import {
  ArrowLeft,
  Check,
  Download,
  FileText,
  Loader2,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Sun,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

import { useNavigation, useNotes } from "@/components/notes-provider.tsx";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
import { Input } from "@/components/ui/input.tsx";
import { ScrollArea } from "@/components/ui/scroll-area.tsx";
import { Separator } from "@/components/ui/separator.tsx";
import type { AppearanceSettings, ColorScheme } from "@/lib/appearance.ts";
import { colorways } from "@/lib/appearance.ts";
import { cn } from "@/lib/utils.ts";

type SettingsSection = "appearance" | "import" | "trash";

const deletedAtFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short",
});

const schemes: Array<{
  id: ColorScheme;
  name: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    id: "system",
    name: "System",
    description: "Follow this device",
    icon: Monitor,
  },
  { id: "light", name: "Light", description: "Bright and clear", icon: Sun },
  { id: "dark", name: "Dark", description: "Easy on the eyes", icon: Moon },
];

const previewColors = {
  spruce: "bg-emerald-800",
  ink: "bg-blue-700",
  aubergine: "bg-violet-700",
  clay: "bg-orange-700",
  graphite: "bg-stone-700",
} as const;

function AppearancePreview({ settings }: { settings: AppearanceSettings }) {
  const dark =
    settings.scheme === "dark" ||
    (settings.scheme === "system" &&
      matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border shadow-sm",
        dark
          ? "border-stone-700 bg-stone-950 text-stone-100"
          : "border-stone-200 bg-stone-50 text-stone-900",
      )}
      aria-label="Appearance preview"
    >
      <div
        className={cn(
          "flex h-9 items-center gap-2 border-b px-3",
          dark ? "border-stone-700" : "border-stone-200",
        )}
      >
        <span
          className={cn("size-4 rounded", previewColors[settings.colorway])}
        />
        <span className="text-[10px] font-semibold">Dyno Notes</span>
      </div>
      <div className="grid grid-cols-[4.5rem_1fr]">
        <div
          className={cn(
            "space-y-2 border-r p-2",
            dark
              ? "border-stone-700 bg-stone-900"
              : "border-stone-200 bg-stone-100",
          )}
        >
          <span
            className={cn(
              "block h-2 w-10 rounded-full",
              previewColors[settings.colorway],
            )}
          />
          <span
            className={cn(
              "block h-1.5 w-12 rounded-full",
              dark ? "bg-stone-700" : "bg-stone-300",
            )}
          />
          <span
            className={cn(
              "block h-1.5 w-8 rounded-full",
              dark ? "bg-stone-700" : "bg-stone-300",
            )}
          />
        </div>
        <div className="space-y-3 p-4">
          <span
            className={cn(
              "block h-2 w-16 rounded-full",
              previewColors[settings.colorway],
            )}
          />
          <span
            className={cn(
              "block h-3 w-28 rounded-full",
              dark ? "bg-stone-200" : "bg-stone-800",
            )}
          />
          <div
            className={cn(
              "space-y-1.5 rounded-lg border p-3",
              dark
                ? "border-stone-700 bg-stone-900"
                : "border-stone-200 bg-white",
            )}
          >
            <span
              className={cn(
                "block h-1.5 w-full rounded-full",
                dark ? "bg-stone-700" : "bg-stone-200",
              )}
            />
            <span
              className={cn(
                "block h-1.5 w-4/5 rounded-full",
                dark ? "bg-stone-700" : "bg-stone-200",
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppearanceSettingsPanel({
  saveStatus,
  settings,
  onChange,
  onSave,
}: {
  saveStatus: "idle" | "saved" | "error";
  settings: AppearanceSettings;
  onChange(settings: AppearanceSettings): void;
  onSave(): void;
}) {
  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-10">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
          <Palette className="size-4" /> Personalise
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Appearance
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Set the light level and the ink color used across your workspace.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-6">
          <Card className="gap-5 shadow-none">
            <CardHeader>
              <CardTitle>Color scheme</CardTitle>
              <CardDescription>
                Choose a light level or follow your device.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-3">
              {schemes.map(({ id, name, description, icon: Icon }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  aria-pressed={settings.scheme === id}
                  className={cn(
                    "h-auto items-start justify-start gap-3 whitespace-normal p-3 text-left",
                    settings.scheme === id &&
                      "border-primary bg-primary/5 ring-2 ring-primary/20",
                  )}
                  onClick={() => onChange({ ...settings, scheme: id })}
                >
                  <Icon className="mt-0.5 size-4" />
                  <span>
                    <span className="block font-medium">{name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">
                      {description}
                    </span>
                  </span>
                </Button>
              ))}
            </CardContent>
          </Card>

          <Card className="gap-5 shadow-none">
            <CardHeader>
              <CardTitle>Colorway</CardTitle>
              <CardDescription>
                Pick the accent used for actions, links, and focus.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {colorways.map(({ id, name, swatch }) => (
                <Button
                  key={id}
                  type="button"
                  variant="outline"
                  aria-pressed={settings.colorway === id}
                  className={cn(
                    "h-11 justify-start px-3",
                    settings.colorway === id &&
                      "border-primary bg-primary/5 ring-2 ring-primary/20",
                  )}
                  onClick={() => onChange({ ...settings, colorway: id })}
                >
                  <span
                    className={cn(
                      "size-5 rounded-full ring-1 ring-black/10",
                      swatch,
                    )}
                  />
                  <span>{name}</span>
                  {settings.colorway === id ? (
                    <Check className="ml-auto" />
                  ) : null}
                </Button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3 lg:sticky lg:top-6">
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Preview
          </p>
          <AppearancePreview settings={settings} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t pt-6">
        <span
          className={cn(
            "text-sm",
            saveStatus === "error"
              ? "text-destructive"
              : "text-muted-foreground",
          )}
          role="status"
        >
          {saveStatus === "saved"
            ? "Settings saved"
            : saveStatus === "error"
              ? "Settings could not be saved"
              : null}
        </span>
        <Button onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}

function ImportSettingsPanel() {
  const { importFiles } = useNavigation();
  const [files, setFiles] = useState<File[]>([]);
  const [failures, setFailures] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  const runImport = async () => {
    setImporting(true);
    const nextFailures = await importFiles(files);
    setFailures(nextFailures);
    setImporting(false);
    if (!nextFailures.length) setFiles([]);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-10">
      <div>
        <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
          <Download className="size-4" /> Bring your notes
        </p>
        <h1 className="font-serif text-3xl font-semibold tracking-tight">
          Import
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Copy Markdown files into the managed pages folder. Your source files
          stay untouched.
        </p>
      </div>
      <Card className="shadow-none">
        <CardHeader>
          <CardTitle>Markdown files</CardTitle>
          <CardDescription>
            Select one or more .md files to add to Dyno Notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".md,text/markdown"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
          />
          {failures.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-destructive">
              {failures.map((failure) => (
                <li key={failure}>{failure}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex justify-end">
            <Button
              disabled={!files.length || importing}
              onClick={() => void runImport()}
            >
              {importing ? "Importing…" : `Import ${files.length || ""}`.trim()}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function TrashSettingsPanel() {
  const {
    trash,
    trashError,
    trashLoading,
    refreshTrash,
    restoreTrash,
    deleteTrash,
  } = useNotes();
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    void refreshTrash();
  }, [refreshTrash]);

  const restore = async (id: string) => {
    setWorkingId(id);
    await restoreTrash(id);
    setWorkingId(null);
  };

  const remove = async (id: string) => {
    setDeleteId(null);
    setWorkingId(id);
    await deleteTrash(id);
    setWorkingId(null);
  };

  const deleteEntry = trash.find((entry) => entry.id === deleteId);

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6 sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
            <Trash2 className="size-4" /> Recover notes
          </p>
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            Trash
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            Restore notes to their original path or permanently remove them.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={trashLoading}
          onClick={() => void refreshTrash()}
        >
          <RefreshCw className={cn(trashLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {trashError ? (
        <Card className="border-destructive/40 shadow-none" role="alert">
          <CardHeader>
            <CardTitle>Trash action failed</CardTitle>
            <CardDescription>{trashError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshTrash()}
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {trashLoading && !trash.length ? (
        <div
          className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" /> Loading Trash…
        </div>
      ) : trashError && !trash.length ? null : !trash.length ? (
        <Card className="shadow-none">
          <CardContent className="flex flex-col items-center py-14 text-center">
            <Trash2 className="mb-4 size-8 text-muted-foreground" />
            <p className="font-medium">Trash is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Notes moved to Trash will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="gap-0 py-0 shadow-none">
          <ul>
            {trash.map((entry, index) => (
              <li key={entry.id}>
                <div className="flex items-center gap-4 px-4 py-4">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {entry.title}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {entry.originalId}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Deleted{" "}
                      {deletedAtFormatter.format(new Date(entry.deletedAt))}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={workingId === entry.id}
                      onClick={() => void restore(entry.id)}
                    >
                      {workingId === entry.id ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <RotateCcw />
                      )}
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      disabled={workingId === entry.id}
                      aria-label={`Permanently delete ${entry.title}`}
                      title="Permanently delete"
                      onClick={() => setDeleteId(entry.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                {index < trash.length - 1 ? <Separator /> : null}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <AlertDialog
        open={Boolean(deleteEntry)}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently delete this note?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteEntry
                ? `${deleteEntry.title} will be removed from Trash. This action cannot be undone.`
                : "This note will be removed from Trash."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (deleteEntry) void remove(deleteEntry.id);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function SettingsPage({
  appearance,
  onClose,
  onSave,
}: {
  appearance: AppearanceSettings;
  onClose(): void;
  onSave(settings: AppearanceSettings): boolean;
}) {
  const [section, setSection] = useState<SettingsSection>("appearance");
  const [draft, setDraft] = useState(appearance);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  const change = (settings: AppearanceSettings) => {
    setDraft(settings);
    setSaveStatus("idle");
  };

  const save = () => setSaveStatus(onSave(draft) ? "saved" : "error");

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
          Settings
        </span>
      </header>
      <div className="grid min-h-0 grid-cols-[9.5rem_minmax(0,1fr)] sm:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-r bg-muted/40 p-2 sm:p-4">
          <nav className="grid gap-1" aria-label="Settings">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start",
                section === "appearance" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setSection("appearance")}
            >
              <Palette /> Appearance
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start",
                section === "import" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setSection("import")}
            >
              <Download /> Import
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "justify-start",
                section === "trash" && "bg-accent text-accent-foreground",
              )}
              onClick={() => setSection("trash")}
            >
              <Trash2 /> Trash
            </Button>
          </nav>
          <Separator className="my-4" />
          <p className="hidden px-2 text-xs leading-5 text-muted-foreground sm:block">
            Settings are stored on this device.
          </p>
        </aside>
        <ScrollArea className="min-h-0">
          {section === "appearance" ? (
            <AppearanceSettingsPanel
              settings={draft}
              saveStatus={saveStatus}
              onChange={change}
              onSave={save}
            />
          ) : section === "import" ? (
            <ImportSettingsPanel />
          ) : (
            <TrashSettingsPanel />
          )}
        </ScrollArea>
      </div>
    </main>
  );
}
