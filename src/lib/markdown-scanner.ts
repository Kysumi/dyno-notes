import type { NoteId } from "./contracts.ts";

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

export interface IndexedMarkdown {
  title: string;
  hasTitle: boolean;
  searchText: string;
  blocks: ScannedBlock[];
  links: ScannedLink[];
  wordCount: number;
}

const BLOCK_ID = "[0-9a-f]{12}";
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
  const searchable: string[] = [];
  let title = "Untitled";
  let hasTitle = false;
  let fence: string | null = null;
  let awaitingCodeAnchor = false;
  let active: { kind: string; lines: string[]; linkIndexes: number[] } | null =
    null;

  for (const line of lines) {
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
    const kind = /^\s{0,3}#{1,6}\s+/u.test(visible)
      ? "heading"
      : /^\s*(?:[-+*]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+)/u.test(visible)
      ? "list"
      : /^\s*>/u.test(visible)
      ? "quote"
      : "paragraph";
    if (
      !active || kind === "heading" || kind === "list" || active.kind !== kind
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
    wordCount: searchText ? searchText.split(/\s+/u).length : 0,
  };
}

export function noteTarget(id: NoteId): string {
  return id.replace(/\.md$/i, "");
}
