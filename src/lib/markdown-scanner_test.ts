import { deepStrictEqual, equal } from "node:assert/strict";

import { scanMarkdown } from "./markdown-scanner.ts";

Deno.test("scanner extracts links, anchors, and searchable text outside code", () => {
  const scanned = scanMarkdown(`# Project Orbit

Review [[pages/weekly-review|Weekly Review]] and [[#^c8ae0295d932]]. ^abcdef123456

Inline \`[[pages/ignored]]\` stays text.

\`\`\`md
[[pages/also-ignored]] ^111111111111
\`\`\`
`);

  equal(scanned.title, "Project Orbit");
  deepStrictEqual(scanned.blocks, [{
    id: "abcdef123456",
    excerpt: "Review Weekly Review and .",
  }]);
  deepStrictEqual(
    scanned.links.map(({ target, targetBlockId, sourceBlockId }) => ({
      target,
      targetBlockId,
      sourceBlockId,
    })),
    [
      {
        target: "pages/weekly-review",
        targetBlockId: null,
        sourceBlockId: "abcdef123456",
      },
      {
        target: "",
        targetBlockId: "c8ae0295d932",
        sourceBlockId: "abcdef123456",
      },
    ],
  );
});

Deno.test("scanner handles CRLF and labeled block links", () => {
  const scanned = scanMarkdown(
    "# Daily\r\n\r\nSee [[pages/orbit#^abcdef123456|target]].\r\n",
  );
  equal(scanned.title, "Daily");
  equal(scanned.links[0].target, "pages/orbit");
  equal(scanned.links[0].targetBlockId, "abcdef123456");
  equal(scanned.links[0].label, "target");
});

Deno.test("scanner associates multiline links and standalone code anchors", () => {
  const scanned = scanMarkdown(`# Blocks

Continue in [[pages/orbit]]
before tomorrow. ^abcdef123456

\`\`\`md
[[pages/ignored]]
\`\`\`

^123456abcdef
`);
  equal(scanned.links.length, 1);
  equal(scanned.links[0].sourceBlockId, "abcdef123456");
  deepStrictEqual(scanned.blocks.map((block) => block.id), [
    "abcdef123456",
    "123456abcdef",
  ]);
  equal(scanned.blocks[1].excerpt, "Code block");
});
