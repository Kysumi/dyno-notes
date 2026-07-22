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

## Development

```sh
deno task desktop:dev
```

Run all checks and create a production build with:

```sh
deno task check
```
