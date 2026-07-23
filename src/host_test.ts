import { deepStrictEqual, equal, match, ok, rejects } from "node:assert/strict";

import { AppError, hashBytes, slugify, Workspace, writeAll } from "./host.ts";

async function fixture(
  run: (workspace: Workspace, root: string) => Promise<void>,
): Promise<void> {
  const root = await Deno.makeTempDir({ prefix: "dyno-notes-test-" });
  try {
    await run(await Workspace.open(root), root);
  } finally {
    await Deno.remove(root, { recursive: true });
  }
}

Deno.test("workspace creates notes with safe names and collisions", () =>
  fixture(async (workspace, root) => {
    ok((await Deno.stat(`${root}/pages`)).isDirectory);
    ok((await Deno.stat(`${root}/journals`)).isDirectory);
    equal(slugify("  Héllo, 世界!  "), "héllo-世界");

    const first = await workspace.create({
      kind: "page",
      title: "Project Orbit",
    });
    const second = await workspace.create({
      kind: "page",
      title: "Project Orbit",
    });
    equal(first.id, "pages/project-orbit.md");
    equal(second.id, "pages/project-orbit-2.md");

    const journal = await workspace.create({
      kind: "journal",
      title: "Today",
      date: "2026-07-22",
    });
    equal(
      (await workspace.create({
        kind: "journal",
        title: "Ignored",
        date: "2026-07-22",
      })).id,
      journal.id,
    );
  }));

Deno.test("creation validates dates, titles, and payload size", () =>
  fixture(async (workspace) => {
    await rejects(
      () =>
        workspace.create({ kind: "journal", title: "Bad", date: "2026-02-30" }),
      (error: unknown) =>
        error instanceof AppError && error.name === "InvalidInput",
    );
    await rejects(
      () => workspace.create({ kind: "page", title: "x".repeat(201) }),
      (error: unknown) =>
        error instanceof AppError && error.name === "InvalidInput",
    );
    const note = await workspace.create({ kind: "page", title: "Large" });
    await rejects(
      () =>
        workspace.save({
          id: note.id,
          source: "x".repeat(10 * 1024 * 1024 + 1),
          expectedRevision: note.revision,
        }),
      (error: unknown) =>
        error instanceof AppError && error.name === "TooLarge",
    );
  }));

Deno.test("a journal is created only on its first content save", () =>
  fixture(async (workspace, root) => {
    const id = "journals/2026-07-23.md";
    await rejects(
      () => workspace.read(id),
      (error: unknown) =>
        error instanceof AppError && error.name === "NotFound",
    );

    await workspace.save({
      id,
      source: "# Thursday, 23 July 2026\n\nFirst note\n",
      expectedRevision: "",
    });
    equal(
      await Deno.readTextFile(`${root}/${id}`),
      "# Thursday, 23 July 2026\n\nFirst note\n",
    );

    await rejects(
      () =>
        workspace.save({
          id,
          source: "# Replaced\n",
          expectedRevision: "",
        }),
      (error: unknown) =>
        error instanceof AppError && error.name === "Conflict",
    );
  }));

Deno.test("workspace rejects traversal, absolute paths, and symlinks", () =>
  fixture(async (workspace, root) => {
    for (
      const id of [
        "../secret.md",
        "/tmp/secret.md",
        "pages/../secret.md",
        "pages\\secret.md",
      ]
    ) {
      await rejects(
        () => workspace.read(id),
        (error: unknown) =>
          error instanceof AppError && error.name === "InvalidNoteId",
      );
    }

    const outside = `${root}/outside.md`;
    await Deno.writeTextFile(outside, "# Outside\n");
    await Deno.symlink(outside, `${root}/pages/link.md`);
    await rejects(
      () => workspace.read("pages/link.md"),
      (error: unknown) =>
        error instanceof AppError && error.name === "InvalidNoteId",
    );
  }));

Deno.test("save preserves EOL, normalizes the final newline, and detects conflicts", () =>
  fixture(async (workspace, root) => {
    await Deno.writeTextFile(
      `${root}/pages/crlf.md`,
      "# CRLF\r\n\r\nBefore\r\n",
    );
    await workspace.reindex("pages/crlf.md");
    const note = await workspace.read("pages/crlf.md");
    equal(note.eol, "\r\n");

    const saved = await workspace.save({
      id: note.id,
      source: "# CRLF\n\nAfter\n\n",
      expectedRevision: note.revision,
    });
    equal(
      await Deno.readTextFile(`${root}/pages/crlf.md`),
      "# CRLF\r\n\r\nAfter\r\n",
    );
    equal(
      saved.revision,
      await hashBytes(await Deno.readFile(`${root}/pages/crlf.md`)),
    );

    await rejects(
      () =>
        workspace.save({
          id: note.id,
          source: "# stale",
          expectedRevision: note.revision,
        }),
      (error: unknown) =>
        error instanceof AppError && error.name === "Conflict",
    );
    deepStrictEqual(
      (await Array.fromAsync(Deno.readDir(`${root}/pages`))).filter((entry) =>
        entry.name.startsWith(".dyno-")
      ),
      [],
    );
  }));

Deno.test("imports preserve UTF-8 bytes, suffix collisions, and reject invalid encoding", () =>
  fixture(async (workspace, root) => {
    const bytes = new TextEncoder().encode("# Imported\n\nCafé\n");
    const imported = await workspace.import([{ name: "../My Note.md", bytes }]);
    const again = await workspace.import([{ name: "My Note.md", bytes }]);
    equal(imported[0].id, "pages/my-note.md");
    equal(again[0].id, "pages/my-note-2.md");
    deepStrictEqual(await Deno.readFile(`${root}/pages/my-note.md`), bytes);

    const noTitle = await workspace.import([{
      name: "Plain File.md",
      bytes: new TextEncoder().encode("No heading here.\n"),
    }]);
    equal(noTitle[0].title, "plain-file");

    await rejects(
      () =>
        workspace.import([{ name: "bad.md", bytes: new Uint8Array([0xff]) }]),
      (error: unknown) =>
        error instanceof AppError && error.name === "InvalidEncoding",
    );
  }));

Deno.test("index derives block backlinks and deterministic search ranking", () =>
  fixture(async (workspace, root) => {
    await Deno.writeTextFile(
      `${root}/pages/orbit.md`,
      "# Project Orbit\n\n- [ ] Target. ^abcdef123456\n",
    );
    await Deno.writeTextFile(
      `${root}/pages/source.md`,
      `# Source

See [[pages/orbit#^abcdef123456|target]]. ^111111111111

\`[[pages/ignored]]\`
`,
    );
    await Deno.writeTextFile(
      `${root}/pages/project.md`,
      "# Project\n\nOther body\n",
    );
    await workspace.rebuildIndex();

    const backlinks = workspace.backlinks({
      noteId: "pages/orbit.md",
      blockId: "abcdef123456",
    });
    equal(backlinks.length, 1);
    equal(backlinks[0].sourceId, "pages/source.md");
    equal(backlinks[0].sourceBlockId, "111111111111");
    deepStrictEqual(workspace.search("Project").map((result) => result.title), [
      "Project",
      "Project Orbit",
    ]);
    equal(workspace.search("Other body")[0].id, "pages/project.md");
    deepStrictEqual(
      workspace.tasks().map(({ id, noteId, text, checked, blockId }) => ({
        id,
        noteId,
        text,
        checked,
        blockId,
      })),
      [{
        id: "pages/orbit.md#^abcdef123456",
        noteId: "pages/orbit.md",
        text: "Target.",
        checked: false,
        blockId: "abcdef123456",
      }],
    );
  }));

Deno.test("ambiguous titles stay unresolved and deletion removes derived backlinks", () =>
  fixture(async (workspace, root) => {
    await Deno.writeTextFile(`${root}/pages/one.md`, "# Same\n");
    await Deno.writeTextFile(`${root}/pages/two.md`, "# Same\n");
    await Deno.writeTextFile(
      `${root}/pages/source.md`,
      "# Source\n\n[[Same]]\n",
    );
    await workspace.rebuildIndex();
    equal(workspace.backlinks({ noteId: "pages/one.md" }).length, 0);
    equal(workspace.backlinks({ noteId: "pages/two.md" }).length, 0);

    await Deno.writeTextFile(
      `${root}/pages/source.md`,
      "# Source\n\n[[pages/one|Same]]\n",
    );
    await workspace.reindex("pages/source.md");
    equal(workspace.backlinks({ noteId: "pages/one.md" }).length, 1);

    await Deno.remove(`${root}/pages/source.md`);
    await workspace.reindex("pages/source.md");
    equal(workspace.backlinks({ noteId: "pages/one.md" }).length, 0);
    equal(workspace.search("Source").length, 0);
  }));

Deno.test("cleanup only removes stale Dyno temporary files", () =>
  fixture(async (workspace, root) => {
    const stale = `${root}/pages/.dyno-stale.tmp`;
    const recent = `${root}/pages/.dyno-recent.tmp`;
    const unrelated = `${root}/pages/.editor-backup`;
    for (const path of [stale, recent, unrelated]) {
      await Deno.writeTextFile(path, "x");
    }
    await Deno.utime(stale, new Date(0), new Date(0));
    await workspace.cleanupTemporaryFiles();
    await rejects(() => Deno.stat(stale), Deno.errors.NotFound);
    ok((await Deno.stat(recent)).isFile);
    ok((await Deno.stat(unrelated)).isFile);
  }));

Deno.test("writeAll handles partial writes", async () => {
  const chunks: Uint8Array[] = [];
  await writeAll({
    write(bytes) {
      const chunk = bytes.slice(0, 2);
      chunks.push(chunk);
      return Promise.resolve(chunk.length);
    },
  }, new TextEncoder().encode("abcdef"));
  equal(
    new TextDecoder().decode(
      Uint8Array.from(chunks.flatMap((chunk) => [...chunk])),
    ),
    "abcdef",
  );
});

Deno.test("hashes are stable lowercase SHA-256", async () => {
  match(await hashBytes(new TextEncoder().encode("dyno")), /^[0-9a-f]{64}$/u);
  equal(
    await hashBytes(new TextEncoder().encode("dyno")),
    await hashBytes(new TextEncoder().encode("dyno")),
  );
});
