import type { JSONContent } from "@tiptap/core";
import { MarkdownManager } from "@tiptap/markdown";

import { codecExtensions } from "./editor-extensions.ts";
import { scanMarkdown, withoutInlineCode } from "./markdown-scanner.ts";

export interface ParsedNote {
  title: string;
  content: JSONContent;
  supported: boolean;
  unsupportedReasons: string[];
  eol: "\n" | "\r\n";
}

const BLOCK_ID = /(?:^|\s)\^([0-9a-f]{12})\s*$/u;
const targetable = new Set([
  "paragraph",
  "heading",
  "listItem",
  "taskItem",
  "blockquote",
  "codeBlock",
]);
const manager = new MarkdownManager({ extensions: codecExtensions() });

function textContent(node: JSONContent): string {
  return node.text ?? (node.content ?? []).map(textContent).join("");
}

export function completedTaskCount(node: JSONContent): number {
  return (
    (node.type === "taskItem" && node.attrs?.checked === true ? 1 : 0) +
    (node.content ?? []).reduce(
      (total, child) => total + completedTaskCount(child),
      0,
    )
  );
}

function stripMarker(node: JSONContent): string | null {
  const content = node.content;
  if (!content?.length) return null;
  const last = content.at(-1);
  if (!last || last.type !== "text" || typeof last.text !== "string") {
    return null;
  }
  const match = last.text.match(BLOCK_ID);
  if (!match) return null;
  last.text = last.text.slice(0, match.index).replace(/\s+$/u, "");
  if (!last.text) content.pop();
  return match[1];
}

function markerNode(node: JSONContent): JSONContent | null {
  if (node.type === "paragraph" || node.type === "heading") return node;
  if (node.type === "listItem" || node.type === "taskItem") {
    return node.content?.find((child) => child.type === "paragraph") ?? null;
  }
  if (node.type === "blockquote") {
    return (
      [...(node.content ?? [])]
        .reverse()
        .find(
          (child) => child.type === "paragraph" || child.type === "heading",
        ) ?? null
    );
  }
  return null;
}

function decodeBlocks(node: JSONContent): JSONContent {
  if (targetable.has(node.type ?? "") && node.type !== "codeBlock") {
    const target = markerNode(node);
    const blockId = target && stripMarker(target);
    if (blockId) node.attrs = { ...node.attrs, blockId };
  }
  if (!node.content) return node;
  const content: JSONContent[] = [];
  for (let index = 0; index < node.content.length; index++) {
    const child = node.content[index];
    if (
      child.type === "codeBlock" &&
      node.content[index + 1]?.type === "paragraph" &&
      /^\^[0-9a-f]{12}$/u.test(textContent(node.content[index + 1]))
    ) {
      child.attrs = {
        ...child.attrs,
        blockId: textContent(node.content[++index]).slice(1),
      };
    }
    content.push(decodeBlocks(child));
  }
  node.content = content;
  return node;
}

function appendMarker(node: JSONContent, blockId: string): void {
  const target = markerNode(node);
  if (!target) return;
  target.content ??= [];
  target.content.push({ type: "text", text: ` ^${blockId}` });
}

function encodeBlocks(node: JSONContent): JSONContent {
  if (!node.content) return node;
  const content: JSONContent[] = [];
  for (const child of node.content) {
    const encoded = encodeBlocks(child);
    const blockId = encoded.attrs?.blockId as string | undefined;
    if (blockId && encoded.type === "codeBlock") {
      content.push(encoded, {
        type: "paragraph",
        content: [{ type: "text", text: `^${blockId}` }],
      });
    } else {
      content.push(encoded);
    }
  }
  node.content = content;
  const blockId = node.attrs?.blockId as string | undefined;
  if (blockId && node.type !== "codeBlock") appendMarker(node, blockId);
  return node;
}

function unsupportedReasons(source: string): string[] {
  const reasons = new Set<string>();
  const lines = source.split("\n");
  let fence: string | null = null;

  if (!/^\uFEFF?#\s+\S/u.test(source)) {
    reasons.add("a missing leading H1 title");
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/u);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = marker;
      else if (fence === marker) fence = null;
      continue;
    }
    if (fence) continue;

    const visible = withoutInlineCode(line);
    if (/<\/?[a-z][a-z0-9-]*(?:\s[^>]*|\/?)>/iu.test(visible)) {
      reasons.add("raw HTML");
    }
    if (/\[\^[^\]]+\]|^\s*\[\^[^\]]+\]:/u.test(visible)) {
      reasons.add("footnotes");
    }
    if (/^#\s+/u.test(visible) && index > 0) {
      reasons.add("additional H1 headings");
    }
    if (/^\s{0,3}(?:---+|___+|\*\*\*+)\s*$/u.test(visible)) {
      reasons.add("horizontal rules");
    }
    if (
      visible.includes("|") &&
      /^\s*\|?\s*:?-{3,}/u.test(lines[index + 1] ?? "")
    )
      reasons.add("tables");
  }
  if (fence) reasons.add("an unclosed code fence");
  return [...reasons];
}

function splitTitle(source: string): { title: string; body: string } {
  const match = source.match(/^\uFEFF?#\s+(.+?)(?:\n|$)/u);
  if (!match) return { title: scanMarkdown(source).title, body: source };
  return {
    title: scanMarkdown(match[0]).title,
    body: source.slice(match[0].length).replace(/^\n/u, ""),
  };
}

export function parseMarkdown(source: string): ParsedNote {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const lf = source.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  const { title, body } = splitTitle(lf);
  const reasons = unsupportedReasons(lf);
  return {
    title,
    content: decodeBlocks(manager.parse(body)),
    supported: reasons.length === 0,
    unsupportedReasons: reasons,
    eol,
  };
}

export function serializeMarkdown(title: string, content: JSONContent): string {
  const body = manager
    .serialize(encodeBlocks(structuredClone(content)))
    .trimEnd();
  return body ? `# ${title.trim()}\n\n${body}\n` : `# ${title.trim()}\n`;
}
