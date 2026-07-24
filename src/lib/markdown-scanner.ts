import type { NoteId } from "./contracts.ts";
import { parseDeadlineInput } from "./dates.ts";

export interface ScannedBlock {
  id: string;
  excerpt: string;
}

export interface ScannedLink {
  target: string;
  label: string | null;
  targetBlockId: string | null;
  sourceBlockId: string | null;
  excerpt: string;
}

export interface ScannedTask {
  text: string;
  checked: boolean;
  blockId: string | null;
  line: number;
  deadline: string | null;
}

export interface IndexedMarkdown {
  title: string;
  hasTitle: boolean;
  searchText: string;
  blocks: ScannedBlock[];
  links: ScannedLink[];
  tasks: ScannedTask[];
  tags: string[];
  attributes: Record<string, string>;
  wordCount: number;
}

const BLOCK_ID = "[0-9a-f]{12}";
// Accepts "due:: 2026-07-24" or "due:: 24/07/2026", with an optional
// "HH:mm" time appended after a space or "T".
export const DEADLINE_MARKER =
  /\bdue::\s*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})(?:[ T](\d{1,2}:\d{2}))?\b/iu;

function parseTaskDeadline(text: string): string | null {
  const marker = text.match(DEADLINE_MARKER);
  return marker ? parseDeadlineInput(marker[1], marker[2]) : null;
}
export const WIKI_LINK_SOURCE = String.raw`\[\[([^\]|]+?)(?:\|([^\]]+))?\]\]`;
const WIKI_LINK = new RegExp(WIKI_LINK_SOURCE, "g");

export function withoutInlineCode(line: string): string {
  let output = "";
  let cursor = 0;

  while (cursor < line.length) {
    if (line[cursor] !== "`") {
      output += line[cursor++];
      continue;
    }

    let ticks = 1;
    while (line[cursor + ticks] === "`") ticks++;
    const delimiter = "`".repeat(ticks);
    const end = line.indexOf(delimiter, cursor + ticks);
    if (end === -1) {
      output += line.slice(cursor);
      break;
    }
    output += " ".repeat(end + ticks - cursor);
    cursor = end + ticks;
  }

  return output;
}

function plainText(markdown: string): string {
  return markdown
    .replace(
      WIKI_LINK,
      (_match, target: string, label?: string) =>
        label ?? target.replace(/#\^[0-9a-f]{12}$/i, ""),
    )
    .replace(/(?:^|\s)\^[0-9a-f]{12}\s*$/i, "")
    .replace(
      /^\s{0,3}(?:#{1,6}\s+|>\s?|[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/,
      "",
    )
    .replace(/[*_~]/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function excerpt(line: string): string {
  const text = plainText(line);
  return text.length <= 160 ? text : `${text.slice(0, 157)}…`;
}

export function parseWikiTarget(raw: string): {
  target: string;
  blockId: string | null;
} {
  const match = raw.trim().match(/^(.*?)(?:#\^([0-9a-f]{12}))?$/i);
  return {
    target: match?.[1]?.trim() ?? raw.trim(),
    blockId: match?.[2]?.toLowerCase() ?? null,
  };
}

function searchableLine(line: string): string {
  return plainText(withoutInlineCode(line));
}

export function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase();
}

export function scanMarkdown(source: string): IndexedMarkdown {
  const lines = source.replaceAll("\r\n", "\n").split("\n");
  const blocks: ScannedBlock[] = [];
  const links: ScannedLink[] = [];
  const tasks: ScannedTask[] = [];
  const tags = new Set<string>();
  const attributes: Record<string, string> = {};
  const searchable: string[] = [];
  let title = "Untitled";
  let hasTitle = false;
  let fence: string | null = null;
  let inFrontmatter = false;
  let awaitingCodeAnchor = false;
  let active: { kind: string; lines: string[]; linkIndexes: number[] } | null =
    null;

  for (const [lineIndex, line] of lines.entries()) {
    if (lineIndex === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---") {
        inFrontmatter = false;
        continue;
      }
      const fmMatch = line.match(/^([a-zA-Z0-9_-]+):\s*(.+)$/);
      if (fmMatch) {
        attributes[fmMatch[1].toLocaleLowerCase()] = fmMatch[2].trim();
      }
      continue;
    }

    const fenceMatch = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) {
        fence = marker;
        awaitingCodeAnchor = false;
      } else if (fence === marker) {
        fence = null;
        awaitingCodeAnchor = true;
      }
      active = null;
      continue;
    }
    if (fence) continue;

    const visible = withoutInlineCode(line);
    if (!visible.trim()) {
      active = null;
      continue;
    }

    const attrMatch = visible.match(/^([a-zA-Z0-9_-]+)::\s*(.+)$/);
    if (attrMatch) {
      attributes[attrMatch[1].toLocaleLowerCase()] = attrMatch[2].trim();
    }

    const standaloneAnchor = visible.match(
      new RegExp(`^\\s*\\^(${BLOCK_ID})\\s*$`, "i"),
    );
    if (awaitingCodeAnchor && standaloneAnchor) {
      blocks.push({
        id: standaloneAnchor[1].toLowerCase(),
        excerpt: "Code block",
      });
      awaitingCodeAnchor = false;
      continue;
    }
    awaitingCodeAnchor = false;

    const heading = visible.match(/^\s{0,3}#\s+(.+?)\s*$/);
    if (!hasTitle && heading) {
      title = plainText(heading[1]) || "Untitled";
      hasTitle = true;
    }

    const blockMatch = visible.match(
      new RegExp(`(?:^|\\s)\\^(${BLOCK_ID})\\s*$`, "i"),
    );
    const blockId = blockMatch?.[1]?.toLowerCase() ?? null;
    const task = visible.match(/^\s*[-+*]\s+\[([ xX])\]\s+(.+?)\s*$/u);
    if (task) {
      // ponytail: table rows use the task's first Markdown line; expand to
      // continuation paragraphs only when real notes need them.
      tasks.push({
        text: plainText(line),
        checked: task[1].toLocaleLowerCase() === "x",
        blockId,
        line: lineIndex + 1,
        deadline: parseTaskDeadline(task[2]),
      });
    }
    const kind = /^\s{0,3}#{1,6}\s+/u.test(visible)
      ? "heading"
      : /^\s*(?:[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/u.test(visible)
        ? "list"
        : /^\s*>/u.test(visible)
          ? "quote"
          : "paragraph";
    if (
      !active ||
      kind === "heading" ||
      kind === "list" ||
      active.kind !== kind
    ) {
      active = { kind, lines: [], linkIndexes: [] };
    }
    active.lines.push(line);
    const lineExcerpt = excerpt(line);

    for (const match of visible.matchAll(WIKI_LINK)) {
      const parsed = parseWikiTarget(match[1]);
      active.linkIndexes.push(links.length);
      links.push({
        target: parsed.target,
        label: match[2]?.trim() || null,
        targetBlockId: parsed.blockId,
        sourceBlockId: blockId,
        excerpt: lineExcerpt,
      });
    }

    for (const match of visible.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]+)/g)) {
      tags.add(match[1].toLocaleLowerCase());
    }

    if (blockId) {
      const blockExcerpt = excerpt(active.lines.join(" ")) || "Block";
      blocks.push({ id: blockId, excerpt: blockExcerpt });
      for (const index of active.linkIndexes) {
        links[index].sourceBlockId = blockId;
        links[index].excerpt = blockExcerpt;
      }
      active = null;
    }

    const text = searchableLine(line);
    if (text) searchable.push(text);
  }

  const searchText = searchable.join(" ");
  return {
    title,
    hasTitle,
    searchText,
    blocks,
    links,
    tasks,
    tags: Array.from(tags),
    attributes,
    wordCount: searchText ? searchText.split(/\s+/u).length : 0,
  };
}

export function noteTarget(id: NoteId): string {
  return id.replace(/\.md$/i, "");
}
