import { type Editor, Extension } from "@tiptap/core";
import {
  EditorContent,
  ReactRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import DragHandle from "@tiptap/extension-drag-handle-react";
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Bold,
  Braces,
  CalendarClock,
  Code,
  Copy,
  GripVertical,
  Heading2,
  Heading3,
  ImageIcon,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Presentation,
  Quote,
  Strikethrough,
  Trash2,
} from "lucide-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { useEditorRuntime, useNotes } from "@/components/notes-provider.tsx";
import { SearchableSelect } from "@/components/searchable-select.tsx";
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
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card.tsx";
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
import { Separator } from "@/components/ui/separator.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { NoteSummary } from "@/lib/contracts.ts";
import { dateValue, localDate, parseDeadlineInput } from "@/lib/dates.ts";
import {
  editorExtensions,
  ensureCurrentBlockId,
} from "@/lib/editor-extensions.ts";
import {
  DEADLINE_MARKER,
  normalizeSearchText,
  noteTarget,
  parseWikiTarget,
} from "@/lib/markdown-scanner.ts";
import "./note-editor.css";

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick(): void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="icon-sm"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function setUrl(editor: Editor, reportError: (message: string | null) => void) {
  const current = editor.getAttributes("link").href as string | undefined;
  const value = globalThis.prompt("Link URL", current ?? "https://");
  if (value === null) return;
  if (!value.trim()) {
    editor.chain().focus().unsetLink().run();
    return;
  }
  try {
    const url = new URL(value);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) {
      throw new Error();
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.href })
      .run();
  } catch {
    reportError("Use an http, https, or mailto link.");
  }
}

function setWikiStates(
  root: HTMLDivElement | null,
  notes: NoteSummary[],
  noteId: string | null,
): void {
  if (!root) return;
  for (const link of root.querySelectorAll<HTMLElement>(
    "a[data-wiki-target]",
  )) {
    const parsed = parseWikiTarget(link.dataset.wikiTarget ?? "");
    const exact =
      !parsed.target ||
      notes.some((summary) => noteTarget(summary.id) === parsed.target);
    const matches = notes.filter(
      (summary) =>
        normalizeSearchText(summary.title) ===
        normalizeSearchText(parsed.target),
    ).length;
    link.dataset.wikiState =
      (exact && Boolean(noteId)) || matches === 1
        ? "resolved"
        : matches > 1
          ? "ambiguous"
          : "unresolved";
  }
}

type WikiLinkPickerProps = {
  notes: NoteSummary[];
  onSelect(note: NoteSummary): void;
  onClose(): void;
};

function WikiLinkPicker({ notes, onSelect, onClose }: WikiLinkPickerProps) {
  return (
    <SearchableSelect
      options={notes.map((note) => ({ value: note.id, label: note.title }))}
      value={null}
      onValueChange={(id) => {
        const note = notes.find((candidate) => candidate.id === id);
        if (note) onSelect(note);
      }}
      open
      onOpenChange={(open, reason) => {
        if (!open && reason === "escape-key") onClose();
      }}
      placeholder="Search pages…"
      emptyMessage="No pages found."
      className="w-72 bg-popover shadow-lg"
      aria-label="Search pages to link"
    />
  );
}

function wikiLinkSuggestion(getNotes: () => NoteSummary[]) {
  return Extension.create({
    name: "wikiLinkSuggestion",

    addProseMirrorPlugins() {
      return [
        Suggestion<NoteSummary, NoteSummary>({
          editor: this.editor,
          char: "[[",
          allowedPrefixes: null,
          decorationClass: "wiki-link-query",
          decorationContent: "]]",
          dismissOnOutsideClick: false,
          command: ({ editor, range, props }) => {
            editor
              .chain()
              .focus()
              .insertContentAt(range, {
                type: "wikiLink",
                attrs: {
                  target: noteTarget(props.id),
                  label: props.title,
                },
              })
              .run();
          },
          render: () => {
            let component: ReactRenderer<unknown, WikiLinkPickerProps> | null =
              null;
            let unmount: (() => void) | null = null;
            let stopFocusListener: (() => void) | null = null;
            const pickerProps = (
              props: SuggestionProps<NoteSummary, NoteSummary>,
            ): WikiLinkPickerProps => ({
              notes: getNotes(),
              onSelect: props.command,
              onClose: () => {
                exitSuggestion(props.editor.view);
                props.editor
                  .chain()
                  .focus()
                  .insertContentAt(props.range, "[[]]")
                  .setTextSelection(props.range.from + 2)
                  .run();
              },
            });

            return {
              onStart: (props) => {
                component = new ReactRenderer<unknown, WikiLinkPickerProps>(
                  WikiLinkPicker,
                  {
                    editor: props.editor,
                    props: pickerProps(props),
                    className: "z-50",
                  },
                );
                unmount = props.mount(component.element);
                const focusPicker = () =>
                  component?.element
                    .querySelector<HTMLInputElement>("input")
                    ?.focus();
                props.editor.view.dom.addEventListener("keyup", focusPicker, {
                  once: true,
                });
                stopFocusListener = () =>
                  props.editor.view.dom.removeEventListener(
                    "keyup",
                    focusPicker,
                  );
              },
              onUpdate: (props) => component?.updateProps(pickerProps(props)),
              onExit: () => {
                stopFocusListener?.();
                unmount?.();
                component?.destroy();
                stopFocusListener = null;
                unmount = null;
                component = null;
              },
            };
          },
        }),
      ];
    },
  });
}

function currentTaskItem(
  editor: Editor,
): { pos: number; node: ProseMirrorNode } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === "taskItem") {
      return { pos: $from.before(depth), node: $from.node(depth) };
    }
  }
  return null;
}

function taskItemParagraph(node: ProseMirrorNode): ProseMirrorNode | null {
  const paragraph = node.firstChild;
  return paragraph?.type.name === "paragraph" ? paragraph : null;
}

function taskItemDeadline(node: ProseMirrorNode): string | null {
  const paragraph = taskItemParagraph(node);
  if (!paragraph) return null;
  const match = paragraph.textContent.match(DEADLINE_MARKER);
  return match ? parseDeadlineInput(match[1], match[2]) : null;
}

function deadlineMarkerRange(
  paragraph: ProseMirrorNode,
  contentStart: number,
): { from: number; to: number } | null {
  let range: { from: number; to: number } | null = null;
  paragraph.forEach((child, offset) => {
    if (range || !child.isText || !child.text) return;
    const match = child.text.match(DEADLINE_MARKER);
    if (match?.index !== undefined) {
      range = {
        from: contentStart + offset + match.index,
        to: contentStart + offset + match.index + match[0].length,
      };
    }
  });
  return range;
}

function setTaskDeadline(editor: Editor, value: string | null): void {
  const current = currentTaskItem(editor);
  const paragraph = current && taskItemParagraph(current.node);
  if (!current || !paragraph) return;
  const contentStart = current.pos + 2;
  const range = deadlineMarkerRange(paragraph, contentStart);
  const text = value ? `due:: ${value}` : null;
  const tr = editor.state.tr;
  if (range) {
    if (text) {
      tr.insertText(text, range.from, range.to);
    } else {
      const leadingSpace =
        range.from > contentStart &&
        tr.doc.textBetween(range.from - 1, range.from) === " ";
      tr.delete(leadingSpace ? range.from - 1 : range.from, range.to);
    }
  } else if (text) {
    tr.insertText(
      paragraph.content.size ? ` ${text}` : text,
      contentStart + paragraph.content.size,
    );
  } else {
    return;
  }
  editor.view.dispatch(tr);
  editor.commands.focus();
}

function DeadlinePicker({
  editor,
  reportError,
}: {
  editor: Editor;
  reportError: (message: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("");

  const apply = (nextDate: Date | undefined, nextTime: string) => {
    setTaskDeadline(
      editor,
      nextDate
        ? `${dateValue(nextDate)}${nextTime ? `T${nextTime}` : ""}`
        : null,
    );
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          const current = currentTaskItem(editor);
          if (!current) {
            reportError("Place the cursor in a task to set its deadline.");
            return;
          }
          reportError(null);
          const [datePart, timePart] = (
            taskItemDeadline(current.node) ?? ""
          ).split("T");
          setDate(datePart ? localDate(datePart) : undefined);
          setTime(timePart ?? "");
        }
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <ToolbarButton label="Set deadline" onClick={() => undefined}>
          <CalendarClock />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          defaultMonth={date}
          selected={date}
          onSelect={(next) => {
            setDate(next);
            apply(next, time);
          }}
        />
        <div className="flex items-center gap-2 border-t p-3">
          <Input
            type="time"
            value={time}
            onChange={(event) => {
              setTime(event.target.value);
              apply(date, event.target.value);
            }}
            aria-label="Deadline time"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setDate(undefined);
              setTime("");
              setTaskDeadline(editor, null);
              setOpen(false);
            }}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const { draft, noteId, reportError } = useEditorRuntime();
  const imageInput = useRef<HTMLInputElement>(null);
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      bullet: editor.isActive("bulletList"),
      ordered: editor.isActive("orderedList"),
      task: editor.isActive("taskList"),
      quote: editor.isActive("blockquote"),
      code: editor.isActive("codeBlock"),
      paragraph: editor.isActive("paragraph"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
    }),
  });

  const heading = (level: 2 | 3) =>
    editor.chain().focus().toggleHeading({ level }).run();

  const insertImage = (file: File) => {
    if (!file.type.startsWith("image/")) {
      reportError("Choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reportError("The image could not be read.");
        return;
      }
      editor
        .chain()
        .focus()
        .setImage({ src: reader.result, alt: file.name })
        .run();
      reportError(null);
    });
    reader.addEventListener("error", () =>
      reportError("The image could not be read."),
    );
    reader.readAsDataURL(file);
  };

  const copyBlockLink = async () => {
    if (!noteId) return;
    const blockId = ensureCurrentBlockId(editor);
    if (!blockId) {
      reportError(
        "Place the cursor in a paragraph, heading, list item, quote, or code block first.",
      );
      return;
    }
    const label =
      editor.state.selection.$from.parent.textContent.trim().slice(0, 80) ||
      draft().title;
    try {
      await navigator.clipboard.writeText(
        `[[${noteTarget(noteId)}#^${blockId}|${label}]]`,
      );
      reportError(null);
    } catch {
      reportError("The block link could not be copied to the clipboard.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5">
      <ToolbarButton
        label="Paragraph"
        active={state.paragraph}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        <Pilcrow />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={state.h2}
        onClick={() => heading(2)}
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={state.h3}
        onClick={() => heading(3)}
      >
        <Heading3 />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Bold"
        active={state.bold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={state.italic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={state.strike}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <ToolbarButton
        label="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code />
      </ToolbarButton>
      <ToolbarButton
        label="URL link"
        onClick={() => setUrl(editor, reportError)}
      >
        <Link />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Bullet list"
        active={state.bullet}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={state.ordered}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarButton
        label="Task list"
        active={state.task}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListChecks />
      </ToolbarButton>
      <DeadlinePicker editor={editor} reportError={reportError} />
      <ToolbarButton
        label="Blockquote"
        active={state.quote}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote />
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={state.code}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Braces />
      </ToolbarButton>
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Insert Whiteboard"
        onClick={() => editor.chain().focus().insertTldraw().run()}
      >
        <Presentation />
      </ToolbarButton>
      <ToolbarButton
        label="Insert image"
        onClick={() => imageInput.current?.click()}
      >
        <ImageIcon />
      </ToolbarButton>
      <Input
        ref={imageInput}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) insertImage(file);
        }}
      />
      <div className="ml-auto">
        <ToolbarButton
          label="Copy block link"
          onClick={() => void copyBlockLink()}
        >
          <Copy />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ConflictDialogs() {
  const { conflict, keepMine, useDisk } = useNotes();
  const [open, setOpen] = useState(false);
  const [comparison, setComparison] = useState(false);

  useEffect(() => {
    if (conflict) setOpen(true);
  }, [conflict]);

  return (
    <>
      <AlertDialog open={open && Boolean(conflict)} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>This note changed on disk</AlertDialogTitle>
            <AlertDialogDescription>
              Your edits are safe. Choose which version should become the
              Markdown file.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Decide later</AlertDialogCancel>
            <Button variant="outline" onClick={() => setComparison(true)}>
              Compare source
            </Button>
            <AlertDialogAction variant="outline" onClick={useDisk}>
              Use disk
            </AlertDialogAction>
            <AlertDialogAction onClick={() => void keepMine()}>
              Keep mine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={comparison && Boolean(conflict)}
        onOpenChange={setComparison}
      >
        <DialogContent className="sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Source comparison</DialogTitle>
            <DialogDescription>
              Local edits are on the left; the current disk file is on the
              right.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <Textarea
              readOnly
              value={conflict?.localSource ?? ""}
              className="min-h-96 resize-none font-mono text-xs"
              aria-label="Local source"
            />
            <Textarea
              readOnly
              value={conflict?.disk.source ?? ""}
              className="min-h-96 resize-none font-mono text-xs"
              aria-label="Disk source"
            />
          </div>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DeleteDialog() {
  const { note, deleteNote } = useNotes();
  const [open, setOpen] = useState(false);

  if (!note) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
        aria-label="Move note to Trash"
        title="Move to Trash"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move this note to Trash?</AlertDialogTitle>
            <AlertDialogDescription>
              You can restore it from Settings → Trash until you permanently
              delete it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => void deleteNote(note.id)}
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const WysiwygEditor = memo(function WysiwygEditor() {
  const {
    draft,
    noteId,
    changeContent,
    followWikiLink,
    focusRequest,
    notes,
    reportError,
  } = useEditorRuntime();
  const wrapper = useRef<HTMLDivElement>(null);
  const notesRef = useRef(notes);
  notesRef.current = notes;
  const suggestion = useMemo(
    () => wikiLinkSuggestion(() => notesRef.current),
    [],
  );
  const editor = useEditor({
    extensions: [...editorExtensions(), suggestion],
    content: draft().content,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    onUpdate: ({ editor }) => {
      changeContent(editor.getJSON());
      queueMicrotask(() => setWikiStates(wrapper.current, notes, noteId));
    },
    editorProps: {
      attributes: {
        class: "tiptap",
        "aria-label": "Note body",
      },
    },
  });

  useEffect(() => {
    if (!editor || !focusRequest || !wrapper.current) return;
    const element = wrapper.current.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(focusRequest.blockId)}"]`,
    );
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    try {
      editor.commands.focus(editor.view.posAtDOM(element, 0) + 1);
    } catch {
      element.focus();
    }
  }, [editor, focusRequest]);

  useEffect(() => {
    setWikiStates(wrapper.current, notes, noteId);
  }, [notes, noteId]);

  if (!editor) return null;

  const handleLinkClick = (event: {
    target: EventTarget | null;
    preventDefault(): void;
    stopPropagation(): void;
  }) => {
    const wikiLink = (event.target as HTMLElement).closest<HTMLElement>(
      "a[data-wiki-target]",
    );
    if (wikiLink) {
      event.preventDefault();
      event.stopPropagation();
      if (wikiLink.dataset.wikiState !== "resolved") {
        reportError(
          `This page link is ${wikiLink.dataset.wikiState ?? "unresolved"}.`,
        );
        return;
      }
      void followWikiLink(wikiLink.dataset.wikiTarget ?? "");
      return;
    }

    const normalLink = (event.target as HTMLElement).closest<HTMLAnchorElement>(
      "a[href]",
    );
    if (normalLink && !normalLink.hasAttribute("data-wiki-target")) {
      event.preventDefault();
      event.stopPropagation();
      window.open(normalLink.href, "_blank");
      return;
    }
  };

  return (
    <div
      ref={wrapper}
      onClickCapture={handleLinkClick}
      onKeyDownCapture={(event) => {
        if (event.key === "Enter") handleLinkClick(event);
      }}
      className="tiptap-editor group/editor relative"
    >
      <EditorToolbar editor={editor} />
      <div className="relative">
        <DragHandle editor={editor}>
          <div className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground/50 hover:bg-muted hover:text-foreground cursor-grab active:cursor-grabbing opacity-0 transition-opacity group-hover/editor:opacity-100">
            <GripVertical className="h-4 w-4" />
          </div>
        </DragHandle>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
});

const statusLabel = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved",
  conflict: "Conflict",
  error: "Error",
};

export function NoteEditor() {
  const {
    note,
    draft,
    status,
    loading,
    error,
    resetKey,
    changeTitle,
    changeSource,
    setMode,
    convertSource,
    retry,
  } = useNotes();

  if (loading) {
    return (
      <main className="grid min-w-0 place-items-center bg-background">
        <p className="text-sm text-muted-foreground">Opening your workspace…</p>
      </main>
    );
  }

  if (!note) {
    return (
      <main className="grid min-w-0 place-items-center bg-background p-6">
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>Dyno Notes could not start</CardTitle>
            <CardDescription>
              {error ?? "The workspace is unavailable."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={retry}>Retry</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-w-0 overflow-y-auto bg-background">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl space-y-3 px-6 py-3 sm:px-10">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant={draft.mode === "wysiwyg" ? "secondary" : "ghost"}
                onClick={() => setMode("wysiwyg")}
              >
                WYSIWYG
              </Button>
              <Button
                size="xs"
                variant={draft.mode === "source" ? "secondary" : "ghost"}
                onClick={() => setMode("source")}
              >
                Source
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  status === "conflict" || status === "error"
                    ? "destructive"
                    : "outline"
                }
              >
                {statusLabel[status]}
              </Badge>
              <DeleteDialog />
            </div>
          </div>
          {draft.mode === "wysiwyg" ? (
            <Input
              value={draft.title}
              onChange={(event) => changeTitle(event.target.value)}
              aria-label="Note title"
            />
          ) : null}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-6 pt-4 pb-24 sm:px-10">
        {error ? (
          <Card className="mb-4 gap-0 border-amber-300 bg-amber-50 py-3 shadow-none">
            <CardContent className="text-sm text-amber-950">
              {error}
            </CardContent>
          </Card>
        ) : null}

        {draft.mode === "wysiwyg" ? (
          <WysiwygEditor key={resetKey} />
        ) : (
          <div className="space-y-3">
            {draft.unsupportedReasons.length ? (
              <Card className="gap-3 border-amber-300 bg-amber-50 py-4 shadow-none">
                <CardContent className="space-y-3 text-sm text-amber-950">
                  <p>
                    Source mode is protecting{" "}
                    {draft.unsupportedReasons.join(", ")} from a lossy WYSIWYG
                    save.
                  </p>
                  <Button size="sm" variant="outline" onClick={convertSource}>
                    Convert to supported Markdown
                  </Button>
                </CardContent>
              </Card>
            ) : null}
            <Textarea
              value={draft.source}
              onChange={(event) => changeSource(event.target.value)}
              aria-label="Markdown source"
              spellCheck={false}
              className="min-h-[36rem] resize-y font-mono text-sm leading-6"
            />
          </div>
        )}
      </div>
      <ConflictDialogs />
    </main>
  );
}
