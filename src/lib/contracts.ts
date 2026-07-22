export type NoteId = string;

export type NoteKind = "page" | "journal";

export interface NoteSummary {
  id: NoteId;
  kind: NoteKind;
  title: string;
  updatedAt: string;
  wordCount: number;
}

export interface NoteFile {
  id: NoteId;
  kind: NoteKind;
  title: string;
  source: string;
  revision: string;
  eol: "\n" | "\r\n";
}

export interface Backlink {
  sourceId: NoteId;
  sourceTitle: string;
  sourceBlockId: string | null;
  targetBlockId: string | null;
  excerpt: string;
}

export interface SearchResult {
  id: NoteId;
  title: string;
  excerpt: string;
}

export interface DesktopBindings {
  workspaceInfo(): Promise<{ path: string }>;
  notesList(): Promise<NoteSummary[]>;
  notesRead(id: NoteId): Promise<NoteFile>;
  notesCreate(input: {
    kind: NoteKind;
    title: string;
    date?: string;
  }): Promise<NoteFile>;
  notesSave(input: {
    id: NoteId;
    source: string;
    expectedRevision: string;
  }): Promise<{ revision: string; updatedAt: string }>;
  notesImport(
    files: Array<{ name: string; bytes: Uint8Array }>,
  ): Promise<NoteSummary[]>;
  notesBacklinks(input: {
    noteId: NoteId;
    blockId?: string;
  }): Promise<Backlink[]>;
  notesSearch(query: string): Promise<SearchResult[]>;
}

declare global {
  var __dynoFlush: (() => Promise<boolean>) | undefined;
}
