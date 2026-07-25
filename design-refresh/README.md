# Dyno Notes visual refresh plan

## Goal

Make Dyno Notes feel like a focused, local-first writing workbench rather than
a generic component-library workspace. The primary job is: open today, write
naturally, and find the note again.

The writing surface is the hero. The journal week strip is the one signature
element; everything around it should stay quiet.

## Visual direction

- **Audience:** keyboard-heavy note takers who value durable Markdown files.
- **Feel:** calm, precise, spacious, and technical without looking like an
  admin dashboard.
- **Reference palette:** paper `#F8FAF9`, surface `#FFFFFF`, rail `#EEF2EF`,
  ink `#1D2420`, muted ink `#667069`, spruce `#257052`. Keep the existing
  colorway choices and dark mode; use these values only as the neutral visual
  target.
- **Type roles:** serif for note titles and document headings, sans for
  interface and editor body, mono only for paths, shortcuts, and Markdown.
  Use the existing Tailwind font roles in this pass. Do not add a font
  dependency or `@font-face` rules under the current project CSS constraints.
- **Signature:** turn the existing week selector into a stable “journal
  ribbon” with coherent states for today, selected, and has-entry.

```text
┌ tabs ───────────────────────────────────────────────────────────────┐
│ brand / back         global search                    app actions   │
├ sidebar ──────┬───────────────────────────────┬─────────────────────┤
│               │ journal ribbon (journals only)│                     │
│ notes/views   │ note title                    │ outline/backlinks   │
│               │                               │                     │
│               │ document                      │                     │
└───────────────┴───────────────────────────────┴─────────────────────┘
```

## Implementation

### 1. Make the document the hero

Touch `src/components/note-editor.tsx` and
`src/components/note-editor.css`.

- Style the title as a borderless, heading-sized document title rather than a
  standard form input. Keep its current behavior and accessible label.
- Remove the editor container’s outer card treatment: border, rounded shell,
  background contrast, and shadow.
- Keep a comfortable reading measure and the existing block hover/drag
  affordances.
- Flatten the formatting toolbar into a quiet utility row. Avoid introducing
  another card or floating surface.
- Rename `WYSIWYG` to `Write` and `Source` to `Markdown`.
- Update the matching terminology in Help.

### 2. Stabilize the header

Touch `src/components/app-header.tsx` and the smallest supporting component
surface necessary.

- Keep global search in one predictable location for journals and pages.
- Remove the week selector from the header entirely; it moves to the
  document pane (see §3 — this is a structural move, not a styling tweak).
- Remove the raw workspace path from the main header; it remains available
  through existing settings/help context.
- Preserve back/forward navigation, keyboard shortcuts, window drag regions,
  and responsive behavior.

### 3. Relocate and refine the journal ribbon

This is the plan's one structural change — moving rendering/state, not just
CSS. The week selector currently lives entirely inside `app-header.tsx`;
`src/components/tabs-view.tsx` has no awareness of it today.

Touch `src/components/tabs-view.tsx` (mount the ribbon above `<NoteEditor />`
in `TabContent`, gated on the active note being a journal entry) and
`src/components/app-header.tsx` (remove the week selector and its state).

- Use the selected colorway consistently; replace the hard-coded blue
  has-entry dot with a semantic theme color.
- Make `today`, `selected`, and `has entry` visually distinct without stacking
  multiple strong treatments.
- Increase the smallest date labels from 9px to at least 10–11px.
- Do not add animation.

### 4. Reduce chrome and improve density

Touch only the components that need adjustment.

- Remove redundant borders where adjacent surfaces already establish
  structure.
- Increase 10px sidebar/context section labels to a readable 11–12px while
  retaining their compact utility role.
- Increase tab height from 28px to 32px.
- Ensure tab close controls become visible on keyboard focus as well as hover.
- Keep the right context rail functional and visually subordinate to the
  document. Do not redesign its content.

### 5. Finish color semantics

- Replace hard-coded decorative colors with existing semantic tokens.
- Verify warning/error cards remain legible in dark mode.
- Keep colorways focused on actions, links, selection, and focus; do not tint
  every surface.
- Preserve current appearance settings and storage behavior.

## Non-goals

- No new features, views, animation system, component library, or dependency.
- No redesign of Settings or Help beyond terminology consistency.
- No custom font installation in this pass.
- No changes to note storage, editor behavior, navigation behavior, or data
  contracts.
- No application-specific CSS outside the scoped Tiptap stylesheet.

## Acceptance criteria

- The note title and document are the strongest visual elements.
- Search no longer changes location or prominence by note type.
- The journal ribbon is recognizable without dominating the header.
- No journal or selection accent bypasses the selected colorway.
- Tabs and utility labels are readable at normal desktop scale.
- Light, dark, and all five colorways retain sufficient contrast.
- Mouse and keyboard focus states remain visible.
- Existing editor, journal, search, tab, and navigation behavior is unchanged.
- `deno task fmt`, `deno task lint`, and `deno task check` pass.

## Required developer UI check

Do not launch the app as the implementation agent. Ask the developer to run
`deno task desktop:dev` and verify:

1. A populated journal at 1440×900 and 1280×800.
2. A long page containing headings, tasks, links, code, and an image.
3. Write and Markdown modes, including keyboard focus.
4. Search, back/forward navigation, tabs, and week navigation.
5. Appearance Settings in light and dark mode with every colorway.
6. No crowding, clipping, unexpected layout movement, or low-contrast states.
