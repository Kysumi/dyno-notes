import { deepStrictEqual, equal, ok } from "node:assert/strict";
import { getSchema } from "@tiptap/core";

import {
  editorExtensions,
  findTextRanges,
  literalMatchOffsets,
} from "./editor-extensions.ts";
import {
  completedTaskCount,
  parseMarkdown,
  serializeMarkdown,
} from "./markdown-codec.ts";

const supported = `# Project Orbit

## Focus

This is **bold**, *italic*, ~~done~~, \`code\`, and [a URL](https://example.com).

- First
- Second ^abcdef123456

1. Ordered
2. Again

- [ ] Draft
- [x] Shipped

> A quote

\`\`\`ts
const answer = 42
\`\`\`
^123456abcdef

![Orbit](data:image/png;base64,aGVsbG8=)

Continue in [[pages/weekly-review|Weekly Review]].
`;

Deno.test("supported Markdown is structurally stable across two cycles", () => {
  const first = parseMarkdown(supported);
  ok(first.supported);
  equal(first.title, "Project Orbit");
  const serialized = serializeMarkdown(first.title, first.content);
  const second = parseMarkdown(serialized);
  deepStrictEqual(second.content, first.content);
  ok(serialized.includes("[[pages/weekly-review|Weekly Review]]"));
  ok(serialized.includes("^abcdef123456"));
  ok(serialized.includes("^123456abcdef"));
  ok(serialized.includes("```ts"));
  ok(serialized.includes("![Orbit](data:image/png;base64,aGVsbG8=)"));
  equal(first.content.content?.[2].content?.[1].attrs?.blockId, "abcdef123456");
});

Deno.test("codec preserves EOL detection and task state", () => {
  const parsed = parseMarkdown("# Daily\r\n\r\n- [x] Done\r\n");
  equal(parsed.eol, "\r\n");
  equal(parsed.content.content?.[0].type, "taskList");
  equal(parsed.content.content?.[0].content?.[0].attrs?.checked, true);
  equal(completedTaskCount(parsed.content), 1);
});

Deno.test("unsupported constructs are reported before WYSIWYG editing", () => {
  const parsed = parseMarkdown(`# External

| A | B |
|---|---|
| 1 | 2 |

<details>raw</details>

![image](x.png)

[^one]
`);
  equal(parsed.supported, false);
  deepStrictEqual(parsed.unsupportedReasons.sort(), [
    "footnotes",
    "raw HTML",
    "tables",
  ]);
});

Deno.test("a missing leading title stays in protected source mode", () => {
  const parsed = parseMarkdown("Body without a title.\n");
  equal(parsed.supported, false);
  deepStrictEqual(parsed.unsupportedReasons, ["a missing leading H1 title"]);
});

Deno.test("an empty WYSIWYG document defaults to a paragraph", () => {
  const document = getSchema(editorExtensions()).topNodeType.createAndFill();
  equal(document?.firstChild?.type.name, "paragraph");
});

Deno.test("find uses literal, case-insensitive, non-overlapping matches", () => {
  deepStrictEqual(literalMatchOffsets("a+b A+B aaaa", "a+b"), [
    { from: 0, to: 3 },
    { from: 4, to: 7 },
  ]);
  deepStrictEqual(literalMatchOffsets("aaaa", "aa"), [
    { from: 0, to: 2 },
    { from: 2, to: 4 },
  ]);
  deepStrictEqual(literalMatchOffsets("[draft]", "[draft]"), [
    { from: 0, to: 7 },
  ]);
  deepStrictEqual(literalMatchOffsets("note", "missing"), []);
  deepStrictEqual(literalMatchOffsets("note", ""), []);

  const schema = getSchema(editorExtensions());
  const document = schema.nodeFromJSON({
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          { type: "text", text: "mixed " },
          { type: "text", marks: [{ type: "bold" }], text: "format" },
        ],
      },
      { type: "paragraph", content: [{ type: "text", text: "format" }] },
    ],
  });
  deepStrictEqual(findTextRanges(document, "mixed format"), [
    { from: 1, to: 13 },
  ]);
  deepStrictEqual(findTextRanges(document, "format"), [
    { from: 7, to: 13 },
    { from: 15, to: 21 },
  ]);
  deepStrictEqual(findTextRanges(document, "formatformat"), []);
});
