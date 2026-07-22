import { deepStrictEqual, equal, ok } from "node:assert/strict";

import { parseMarkdown, serializeMarkdown } from "./markdown-codec.ts";

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
  equal(
    first.content.content?.[2].content?.[1].attrs?.blockId,
    "abcdef123456",
  );
});

Deno.test("codec preserves EOL detection and task state", () => {
  const parsed = parseMarkdown("# Daily\r\n\r\n- [x] Done\r\n");
  equal(parsed.eol, "\r\n");
  equal(parsed.content.content?.[0].type, "taskList");
  equal(parsed.content.content?.[0].content?.[0].attrs?.checked, true);
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
    "images",
    "raw HTML",
    "tables",
  ]);
});

Deno.test("a missing leading title stays in protected source mode", () => {
  const parsed = parseMarkdown("Body without a title.\n");
  equal(parsed.supported, false);
  deepStrictEqual(parsed.unsupportedReasons, ["a missing leading H1 title"]);
});
