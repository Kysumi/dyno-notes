import {
  type Editor,
  Extension,
  mergeAttributes,
  Node,
  nodeInputRule,
} from "@tiptap/core";
import { Markdown } from "@tiptap/markdown";
import { ReactNodeViewRenderer } from "@tiptap/react";
import Image from "@tiptap/extension-image";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import StarterKit from "@tiptap/starter-kit";

import { TldrawNodeView } from "@/components/tldraw-node-view.tsx";
import { type Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

import { WIKI_LINK_SOURCE } from "./markdown-scanner.ts";

const targetableBlocks = [
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "codeBlock",
];

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    wikiLink: {
      insertWikiLink: (attributes: {
        target: string;
        label?: string;
      }) => ReturnType;
    };
    blockIdentity: {
      ensureBlockId: () => ReturnType;
    };
    tldraw: {
      insertTldraw: () => ReturnType;
    };
  }
}

export const WikiLink = Node.create({
  name: "wikiLink",
  priority: 1_100,
  inline: true,
  group: "inline",
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      target: { default: "" },
      label: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: "a[data-wiki-target]",
        getAttrs: (element) => ({
          target: (element as HTMLElement).dataset.wikiTarget ?? "",
          label: element.textContent,
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const target = String(node.attrs.target ?? "");
    const label = String(node.attrs.label || target || "Untitled");
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        href: "#",
        "data-wiki-target": target,
        title: target,
      }),
      label,
    ];
  },

  renderText({ node }) {
    return String(node.attrs.label || node.attrs.target || "");
  },

  markdownTokenizer: {
    name: "wikiLink",
    level: "inline",
    start: (source) => source.indexOf("[["),
    tokenize: (source) => {
      const match = new RegExp(`^${WIKI_LINK_SOURCE}`).exec(source);
      if (!match) return undefined;
      return {
        type: "wikiLink",
        raw: match[0],
        target: match[1].trim(),
        label: match[2]?.trim() || null,
      };
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode("wikiLink", {
      target: token.target,
      label: token.label || null,
    }),

  renderMarkdown: (node) => {
    const target = String(node.attrs?.target ?? "");
    const label = node.attrs?.label ? `|${node.attrs.label}` : "";
    return `[[${target}${label}]]`;
  },

  addInputRules() {
    return [
      nodeInputRule({
        find: new RegExp(`${WIKI_LINK_SOURCE}$`),
        type: this.type,
        getAttributes: (match) => ({
          target: match[1].trim(),
          label: match[2]?.trim() || null,
        }),
      }),
    ];
  },
});

export const TldrawExtension = Node.create({
  name: "tldraw",
  priority: 1100,
  group: "block",
  atom: true,

  addAttributes() {
    return {
      source: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "tldraw" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["tldraw", mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TldrawNodeView);
  },

  addCommands() {
    return {
      insertTldraw:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { source: null },
          }),
    };
  },

  markdownTokenizer: {
    name: "tldraw",
    level: "block",
    start: (source) => source.indexOf("```tldraw"),
    tokenize: (source) => {
      const match = /^```tldraw\r?\n([\s\S]*?)\r?\n```/.exec(source);
      if (!match) return undefined;
      return {
        type: "tldraw",
        raw: match[0],
        source: match[1],
      };
    },
  },

  parseMarkdown: (token, helpers) =>
    helpers.createNode("tldraw", {
      source: token.source,
    }),

  renderMarkdown: (node) => {
    return `\`\`\`tldraw\n${node.attrs?.source || ""}\n\`\`\`\n`;
  },
});

export const BlockIdentity = Extension.create({
  name: "blockIdentity",

  addGlobalAttributes() {
    return [
      {
        types: targetableBlocks,
        attributes: {
          blockId: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-block-id"),
            renderHTML: (attributes) =>
              attributes.blockId ? { "data-block-id": attributes.blockId } : {},
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      ensureBlockId: () => () => Boolean(ensureCurrentBlockId(this.editor)),
    };
  },
});

export const TagHighlight = Extension.create({
  name: "tagHighlight",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("tagHighlight"),
        state: {
          init(_, { doc }) {
            return getTagDecorations(doc);
          },
          apply(tr, oldState) {
            return tr.docChanged ? getTagDecorations(tr.doc) : oldState;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});

function getTagDecorations(doc: ProseMirrorNode) {
  const decorations: Decoration[] = [];
  doc.descendants((node: ProseMirrorNode, pos: number) => {
    if (node.isText) {
      const text = node.text || "";
      const regex = /(?:^|\s)(#[a-zA-Z0-9_-]+)/g;
      let match;
      while ((match = regex.exec(text)) !== null) {
        const matchText = match[1];
        const start = pos + match.index + (match[0].length - matchText.length);
        const end = start + matchText.length;

        decorations.push(
          Decoration.inline(start, end, {
            class: "tag-highlight",
          }),
        );
      }
    }
  });
  return DecorationSet.create(doc, decorations);
}

export function editorExtensions() {
  return [
    StarterKit.configure({
      horizontalRule: false,
      link: {
        openOnClick: false,
        HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" },
      },
      trailingNode: false,
      underline: false,
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ allowBase64: true }),
    WikiLink,
    TldrawExtension,
    BlockIdentity,
    TagHighlight,
    Markdown,
  ];
}

export function codecExtensions() {
  return editorExtensions().filter(
    (extension) => extension.name !== "markdown",
  );
}

export function ensureCurrentBlockId(editor: Editor): string | null {
  const { $from } = editor.state.selection;
  let depth = $from.depth;
  if (
    $from.node(depth).type.name === "paragraph" &&
    depth > 0 &&
    ["listItem", "taskItem"].includes($from.node(depth - 1).type.name)
  ) {
    depth--;
  }
  while (depth > 0 && !targetableBlocks.includes($from.node(depth).type.name)) {
    depth--;
  }
  if (depth === 0) return null;

  const node = $from.node(depth);
  const existing = node.attrs.blockId as string | null;
  if (existing) return existing;

  const ids = new Set<string>();
  editor.state.doc.descendants((child) => {
    if (child.attrs.blockId) ids.add(String(child.attrs.blockId));
  });
  let blockId: string;
  do blockId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
  while (ids.has(blockId));

  const position = $from.before(depth);
  editor.view.dispatch(
    editor.state.tr.setNodeMarkup(position, undefined, {
      ...node.attrs,
      blockId,
    }),
  );
  return blockId;
}
