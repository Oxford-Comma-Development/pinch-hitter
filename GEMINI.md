# GEMINI.md

General guidelines for writing code in Pinch Hitter and any derived tools:

## The Ladder of Simplicity

Stop at the first rung that holds, but inform the user why:

1. **Does this need to exist?** → No: skip it (YAGNI).
2. **Native web platform does it?** → Use standard browser APIs, native IndexedDB, Web Locks, and native SVG/CSS.
3. **Angular built-in does it?** → Use standalone components, Signals, control flow (`@if`, `@for`), and native Router.
4. **Installed dependency does it?** → Use already installed packages (Angular, Vitest, Playwright) before proposing new ones.
5. **One line?** → Keep it one line.
6. **Only then**: The minimum that works (with respect to repository guidance about unit testing and quality gates).

---

## Core Rules

- **No unrequested abstractions**: Build only what is needed right now. Avoid premature generic abstractions, wrapper layers, or speculative helpers.
- **No new dependencies if avoidable**: Leverage Angular core features, native browser Web APIs, and native SVG rendering before installing npm packages. Do not introduce heavy charting or state libraries when SVG and Signals suffice.
- **No boilerplate nobody asked for**: Write concise, direct implementations.
- **Deletion over addition; boring over clever**: Prefer deleting unused code to maintaining dead paths. Clear, boring code is better than intricate, clever patterns.
- **Fewest files possible**: Group closely related logic where appropriate; do not fragment code into dozens of micro-files without a concrete organizational need.
- **Question complex requests**: Ask: _"Do you actually need X, or does Y cover it with less complexity?"_
- **Pick the edge-case-correct option**: When two standard approaches are similar in size, choose the robust, edge-case-correct algorithm (e.g. strict normalized SVG coordinate transforms, atomic multi-store IndexedDB transactions, and stable UUIDs).
- **Mark intentional simplifications**: If a shortcut has a known ceiling (e.g. in-memory season report filtering, 12x12 density grid bins, 250,000 entity import limit), document the ceiling and the upgrade path with a comment.
- **Simplicity in production over complexity in tests**: Prefer less complex production code to more complex unit test code.
- **Signals over RxJS complexity**: For synchronous state and UI reactivity, prefer Angular Signals (`signal`, `computed`). Reserve RxJS for asynchronous streams, event debouncing, or cancellation pipelines where it clearly provides value.
- **Single-transaction atomic capture**: Batted-ball observations, turn state updates, batting queue rotation, and revision tokens must always commit in a single IndexedDB transaction before UI signals update or success is confirmed.
- **Local-first data sovereignty**: Never store coaching data in `localStorage` or send it to an external server. The device is the coach's private notebook.
- **Resolution-independent coordinates**: All field locations must use normalized `[0.0, 1.0]` coordinates relative to the square Version 1 coordinate system with home plate at `(0.50, 0.88)`.
- **Browser verification**: Always verify changes locally in a real browser across multiple viewports (phone portrait 390×844, phone landscape 844×390, tablet portrait 768×1024, desktop 1280×800) and themes (classic green, high-contrast slate) before completing work.
- **Formatter & quality verification**: Always run `npm run format` and verify with `npm run format:check`, `npm run lint`, and `npm test -- --watch=false` before completing work.
