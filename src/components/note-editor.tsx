import { type Editor, Extension } from "@tiptap/core";
import {
  EditorContent,
  ReactRenderer,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import Suggestion, {
  exitSuggestion,
  type SuggestionProps,
} from "@tiptap/suggestion";
import {
  Bold,
  Braces,
  Code,
  Copy,
  Heading2,
  Heading3,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Pilcrow,
  Quote,
  Strikethrough,
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
import { Separator } from "@/components/ui/separator.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import type { NoteSummary } from "@/lib/contracts.ts";
import {
  editorExtensions,
  ensureCurrentBlockId,
} from "@/lib/editor-extensions.ts";
import {
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
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.href })
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
  for (
    const link of root.querySelectorAll<HTMLElement>("a[data-wiki-target]")
  ) {
    const parsed = parseWikiTarget(link.dataset.wikiTarget ?? "");
    const exact = !parsed.target ||
      notes.some((summary) => noteTarget(summary.id) === parsed.target);
    const matches = notes.filter((summary) =>
      normalizeSearchText(summary.title) === normalizeSearchText(parsed.target)
    ).length;
    link.dataset.wikiState = (exact && Boolean(noteId)) || matches === 1
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
  const selected = useRef(false);

  return (
    <SearchableSelect
      options={notes.map((note) => ({ value: note.id, label: note.title }))}
      value={null}
      onValueChange={(id) => {
        const note = notes.find((candidate) => candidate.id === id);
        if (note) {
          selected.current = true;
          onSelect(note);
        }
      }}
      open
      onOpenChange={(open) => {
        if (!open && !selected.current) onClose();
      }}
      autoFocus
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
      return [Suggestion<NoteSummary, NoteSummary>({
        editor: this.editor,
        char: "[[",
        allowedPrefixes: null,
        decorationClass: "wiki-link-query",
        decorationContent: "]]",
        dismissOnOutsideClick: false,
        command: ({ editor, range, props }) => {
          editor.chain().focus().insertContentAt(range, {
            type: "wikiLink",
            attrs: {
              target: noteTarget(props.id),
              label: props.title,
            },
          }).run();
        },
        render: () => {
          let component: ReactRenderer<unknown, WikiLinkPickerProps> | null =
            null;
          let unmount: (() => void) | null = null;
          const pickerProps = (
            props: SuggestionProps<NoteSummary, NoteSummary>,
          ): WikiLinkPickerProps => ({
            notes: getNotes(),
            onSelect: props.command,
            onClose: () => {
              exitSuggestion(props.editor.view);
              props.editor.chain().focus().insertContentAt(
                props.range,
                "[[]]",
              ).setTextSelection(props.range.from + 2).run();
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
            },
            onUpdate: (props) => component?.updateProps(pickerProps(props)),
            onExit: () => {
              unmount?.();
              component?.destroy();
              unmount = null;
              component = null;
            },
          };
        },
      })];
    },
  });
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const { draft, noteId, reportError } = useEditorRuntime();
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
    <div className="flex flex-wrap items-center gap-0.5 border-b bg-stone-50/70 p-1.5">
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

  const openWikiLink = (event: {
    target: EventTarget | null;
    preventDefault(): void;
  }) => {
    const link = (event.target as HTMLElement).closest<HTMLElement>(
      "a[data-wiki-target]",
    );
    if (!link) return;
    event.preventDefault();
    if (link.dataset.wikiState !== "resolved") {
      reportError(
        `This page link is ${link.dataset.wikiState ?? "unresolved"}.`,
      );
      return;
    }
    void followWikiLink(link.dataset.wikiTarget ?? "");
  };

  return (
    <div
      ref={wrapper}
      onClick={openWikiLink}
      onKeyDown={(event) => {
        if (event.key === "Enter") openWikiLink(event);
      }}
      className="tiptap-editor"
    >
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
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
      <main className="grid min-w-0 place-items-center bg-white">
        <p className="text-sm text-muted-foreground">Opening your workspace…</p>
      </main>
    );
  }

  if (!note) {
    return (
      <main className="grid min-w-0 place-items-center bg-white p-6">
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
    <main className="min-w-0 overflow-y-auto bg-stone-50/40">
      <div className="mx-auto w-full max-w-3xl px-6 pt-10 pb-24 sm:px-10 sm:pt-14">
        <div className="mb-3 flex items-center justify-between gap-3">
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
          <Badge
            variant={status === "conflict" || status === "error"
              ? "destructive"
              : "outline"}
          >
            {statusLabel[status]}
          </Badge>
        </div>

        {error
          ? (
            <Card className="mb-4 gap-0 border-amber-300 bg-amber-50 py-3 shadow-none">
              <CardContent className="text-sm text-amber-950">
                {error}
              </CardContent>
            </Card>
          )
          : null}

        {draft.mode === "wysiwyg"
          ? (
            <>
              <Input
                value={draft.title}
                onChange={(event) => changeTitle(event.target.value)}
                aria-label="Note title"
                className="h-auto rounded-none border-0 px-0 py-2 font-serif text-4xl font-semibold leading-tight tracking-[-0.025em] text-stone-950 shadow-none focus-visible:ring-0 sm:text-5xl"
              />
              <WysiwygEditor key={resetKey} />
            </>
          )
          : (
            <div className="space-y-3">
              {draft.unsupportedReasons.length
                ? (
                  <Card className="gap-3 border-amber-300 bg-amber-50 py-4 shadow-none">
                    <CardContent className="space-y-3 text-sm text-amber-950">
                      <p>
                        Source mode is protecting{" "}
                        {draft.unsupportedReasons.join(", ")}{" "}
                        from a lossy WYSIWYG save.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={convertSource}
                      >
                        Convert to supported Markdown
                      </Button>
                    </CardContent>
                  </Card>
                )
                : null}
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
