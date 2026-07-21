# Dyno Notes

Dyno Notes is a desktop note-taking app inspired by
[Logseq](https://logseq.com/) and [Emacs Org mode](https://orgmode.org/).

It combines two complementary ideas:

- **Org-mode-inspired storage:** notes are stored as readable plain text using
  an outline-based document model. Headings, nested blocks, tasks, properties,
  tags, and links remain understandable outside the app.
- **Logseq-inspired interface:** the GUI is organized around daily journals,
  linked pages, outlines, backlinks, search, and fast block-based navigation.

The goal is a modern visual workspace without locking notes into an opaque file
format: Org mode underneath, Logseq on the surface.

## Development

```sh
deno task desktop:dev
```

Run all checks and create a production build with:

```sh
deno task check
```
