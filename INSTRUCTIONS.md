# Agent Instructions

This repository is **Pinch Hitter**, an offline-first baseball and softball batting-practice coaching notebook and spray chart built as an Angular Progressive Web Application (PWA) optimized for hosting on **GitHub Pages**.

> **Note**: Comprehensive agent guidelines, architectural specifications, and implementation roadmaps are maintained in:
>
> - [AGENTS.md](AGENTS.md): Repository role, code map, development commands, quality gates, and guardrails.
> - [GEMINI.md](GEMINI.md): Operational coding rules, the simplicity ladder, and development constraints.
> - [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): System architecture, technology stack, directory boundaries, state management, coordinate math, and offline storage.
> - [docs/DECISIONS.md](docs/DECISIONS.md): Architectural Decision Records (ADRs).
> - [docs/ROADMAP.md](docs/ROADMAP.md): Master product roadmap, Pro tier milestones, and technical debt backlog.
> - [docs/exec-plans/active/](docs/exec-plans/active/README.md): Active execution plans for non-trivial tasks.
> - [docs/exec-plans/completed/](docs/exec-plans/completed/README.md): Archived, verified execution plans.
> - [docs/data-format.md](docs/data-format.md): IndexedDB schema, migration mechanics, JSON backup specification, and CSV formats.
> - [docs/pro-tier-strategy.md](docs/pro-tier-strategy.md): Method-agnostic entitlement architecture, feature gating analysis, and analytics roadmap.
> - [docs/user-manual.md](docs/user-manual.md): Coach's Field Manual, workflows, and accessibility guide.

---

## Core Product Principles

- **Store data richly; ask for data sparingly**: A single field tap creates a valid observation without modal confirmation. Classifications are optional and never carry over to subsequent hits. Manual hitter advance is the default.
- **Terminology**: The unit of capture is a **recorded contact**, never an inferred swing, at-bat, or official plate appearance.
- **Local-First Data Sovereignty**: All data lives in native IndexedDB on the device. No accounts, no cloud backend, no third-party tracking.
- **Single-Transaction Atomic Capture**: Event records, session turn state, batting queue rotation, and revision tokens commit in a single IndexedDB transaction before UI signals update or success is acknowledged.
- **Dugout Ergonomics & Universal Design**: Designed for one-handed operation on phone portrait, field-left/control-right phone landscape, with Okabe-Ito barrier-free color mapping, WCAG 1.4.1 multi-shape SVG marker glyphs, obsidian slate sunlight field, and Left-Handed Dugout Mode.

---

## Quality Gate Verification

Before delivering substantial changes or completing an execution plan, run the complete verification suite:

```sh
npm run format:check
npm run lint
npm test -- --watch=false
npm run build
npm run e2e
npm run e2e:pwa
```

When working in this repository, adhere strictly to the principles, guardrails, and validation commands outlined in [AGENTS.md](AGENTS.md) and [GEMINI.md](GEMINI.md).
