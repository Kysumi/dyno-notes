# Dyno Notes

Dyno Notes is a desktop note-taking app inspired by
[Logseq](https://logseq.com/) and [Emacs Org mode](https://orgmode.org/).

It combines two complementary ideas:

- **Markdown storage:** pages and journals are readable `.md` files under
  `~/Dyno Notes`. Headings, tasks, links, and block anchors remain usable
  outside the app.
- **Logseq-inspired interface:** the GUI is organized around daily journals,
  linked pages, outlines, backlinks, search, and fast block-based navigation.

The goal is a modern visual workspace without locking notes into an opaque file
format: Markdown underneath, a linked block editor on the surface.

## Download

Automated releases provide an Apple silicon (ARM64) macOS `.dmg` and a Windows
x64 `.msi` from the [Releases page](https://github.com/Kysumi/dyno-notes/releases).

### Opening the macOS app

The macOS build is not signed with an Apple Developer ID or notarized. After
copying `Dyno-Notes-macOS-arm64.app` into `/Applications`, macOS may report that
it is damaged or cannot be opened. If you trust the downloaded build, remove
its quarantine attribute and open it:

```sh
xattr -r -d com.apple.quarantine "/Applications/Dyno-Notes-macOS-arm64.app"
open "/Applications/Dyno-Notes-macOS-arm64.app"
```

This affects only Dyno Notes; it does not disable Gatekeeper globally. You can
instead use **System Settings → Privacy & Security → Open Anyway** after the
first failed launch. Intel Macs are not currently supported.

## Development

Run the app via the command:

```sh
deno task desktop:dev
```

Run all checks and create a production build with:

```sh
deno task check
```

Linting is [oxlint](https://oxc.rs/docs/guide/usage/linter.html) and
formatting is [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)
(`deno task lint`, `deno task fmt`). See [AGENTS.md](AGENTS.md) for the rules.

## Building

```sh
deno desktop --target aarch64-apple-darwin --output temp/dyno-notes.dmg main.ts
```
