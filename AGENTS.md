# AGENTS.md

These instructions apply to this repository and any downstream tools or extensions built for Pinch Hitter.

## Repository Overview

- **Product**: Pinch Hitter — an offline-first, client-side baseball and softball coaching notebook, batting-practice capture tool, and spray chart designed for coaches behind the batting cage.
- **Framework**: Angular 22+ (standalone components, inject-based dependency injection, and Angular Signals for fine-grained reactive state).
- **PWA & Deployment**: Angular Service Worker (`@angular/service-worker`, `ngsw-config.json`), Web App Manifest (`public/manifest.webmanifest`), dynamic subpath base-href, and SPA routing fallback (`scripts/prepare-pages.mjs` creating `404.html`) via GitHub Actions (`.github/workflows/deploy.yml` deploying to `https://cboler.github.io/pinch-hitter/`).
- **Architecture Style**: Client-side single-page application with **zero server-side runtime, zero user accounts, zero analytics tracking, and zero cloud data leakage**. All coaching data (teams, rosters, sessions, ball events, notes, preferences) lives strictly on the coach's device in browser-native IndexedDB.

---

## Map of Code

```
pinch-hitter/
├── .github/workflows/       # CI validation, secret scans (gitleaks), and GitHub Pages deployment
├── docs/                    # Architecture, ADRs, roadmaps, data specifications, and plans
│   ├── ARCHITECTURE.md      # Detailed system architecture, boundaries, coordinates, and storage
│   ├── DECISIONS.md         # Architectural Decision Records (ADRs)
│   ├── ROADMAP.md           # Master product roadmap, Pro tier milestones, and tech debt backlog
│   ├── data-format.md       # Canonical IndexedDB schema, migration rules, JSON/CSV specs, and coordinates
│   ├── pro-tier-strategy.md # Feature gating architecture, freemium analysis, and analytics roadmap
│   ├── project-overview.md  # System overview, ER diagrams, coordinate geometry, and testing philosophy
│   ├── user-manual.md       # Coach's Field Manual, quick start, workflow guides, and accessibility notes
│   └── exec-plans/          # Structured execution plans for non-trivial tasks
│       ├── active/          # Plans currently in progress
│       └── completed/       # Archived, verified execution plans
├── e2e/                     # Playwright cross-viewport smoke test suite (mobile, tablet, desktop)
│   └── smoke.spec.ts        # Roster, practice capture, queue rotation, reports, and CSV tests
├── e2e-pwa/                 # Playwright production offline PWA validation suite
│   └── pwa-offline.spec.ts  # Verifies app startup, live capture, and export when severed from network
├── public/                  # Source-controlled static assets
│   ├── icons/               # PWA icons (72x72 through 512x512, maskable) generated from mark.svg
│   ├── favicon.ico          # Browser tab favicon
│   └── manifest.webmanifest # Web App Manifest identity and theme configuration
├── scripts/                 # Build and deployment helper scripts
│   ├── generate-icons.mjs   # Generates raster PNG/ICO icons from public/icons/mark.svg
│   └── prepare-pages.mjs    # Generates 404.html SPA fallback and validates PWA build output
├── src/                     # Application source code
│   ├── app/
│   │   ├── data/            # Core domain and persistence layer
│   │   │   ├── coach-store.ts        # Centralized Signal state store and serialized transactions
│   │   │   ├── domain.ts             # Pure functions: queue math, undo, coordinates, summaries, filters
│   │   │   ├── entitlement.service.ts # Method-agnostic feature authorization & local simulator
│   │   │   ├── models.ts             # Entity interfaces, stable ID schemas, and type definitions
│   │   │   ├── repository.ts         # Native IndexedDB driver, migrations, revision tokens, transactions
│   │   │   └── transfer.ts           # JSON backup validation/merge, roster CSV parsing, and event export
│   │   ├── home/            # Dashboard landing view, active session hero, backup indicators
│   │   ├── i18n/            # Internationalization dictionaries and translation service
│   │   ├── practice/        # Batting practice live capture workspace, queue strip, Dugout modes
│   │   ├── privacy/         # Privacy policy documentation (local-first data sovereignty)
│   │   ├── reports/         # Analytics, spray charts, heatmaps, 14-day trends, event management
│   │   ├── roster/          # Roster management, player cards, lineup ordering, CSV import
│   │   ├── settings/        # Active team switcher, defaults, visual accessibility, storage, tier switch
│   │   ├── shared/          # Reusable components (FieldComponent SVG diamond, modal dialogs)
│   │   ├── app.config.ts    # Application providers (Router, Service Worker, global error handling)
│   │   ├── app.routes.ts    # Application route definitions with standalone lazy loading
│   │   └── app.ts / .html   # Root shell component, global navigation, and PWA install prompts
│   ├── index.html           # HTML entrypoint, title, viewport, and meta tags
│   ├── main.ts              # Angular bootstrap entrypoint
│   └── styles.scss          # Design tokens, mobile-first resets, dugout high-contrast utilities
├── angular.json             # Angular CLI workspace configuration
├── ngsw-config.json         # Service worker asset caching and data group rules
├── package.json             # Scripts, dependencies, and package configurations
├── playwright.config.ts     # Playwright multi-viewport smoke test configuration
└── playwright.pwa.config.ts # Playwright offline PWA test configuration
```

---

## Commands & Quality Gates

Prerequisites: Node.js 24+ and npm 10+.

```bash
# Install dependencies reproducibly from lockfile
npm ci

# Start local development server with auto-reload (http://localhost:4200/)
npm start

# Run unit tests via Vitest (headless, single run)
npm test -- --watch=false

# Run ESLint static analysis
npm run lint

# Check and fix formatting with Prettier
npm run format
npm run format:check

# Production build and GitHub Pages deployment preparation
npm run build
npm run build:pages

# Run Playwright multi-viewport smoke tests (mobile, tablet, desktop)
npm run e2e

# Run Playwright offline PWA validation suite (requires pre-built dist)
npm run e2e:pwa
```

---

## Agent Workflow & Documentation System

When planning and implementing changes, follow this structured documentation cycle:

1. **Consult Architecture**: Review `docs/ARCHITECTURE.md` and `docs/project-overview.md` to understand system boundaries, state management patterns, coordinate mathematics, and static hosting mechanics.
2. **Consult & Record Decisions**: Check `docs/DECISIONS.md` before proposing architectural pivots. Record new non-trivial architectural choices as ADRs.
3. **Check & Update Roadmap**: Refer to `docs/ROADMAP.md` and `docs/pro-tier-strategy.md` for project milestones, feature gating plans, and technical debt items. Update status when features land.
4. **Execution Plans for Non-Trivial Tasks**: For multi-step features, architectural refactoring, or risky changes:
   - Create a plan in `docs/exec-plans/active/YYYY-MM-DD-<slug>.md` using the template defined in `docs/exec-plans/active/README.md`.
   - Implement step-by-step, validating against automated tests and real browser rendering.
   - Once verified and complete, move the plan to `docs/exec-plans/completed/`.
5. **Quality Gate Verification**: Never declare work complete without executing `npm test -- --watch=false`, `npm run lint`, `npm run format:check`, and testing locally in a browser. For changes affecting service workers or storage, run `npm run build` and `npm run e2e:pwa`.

---

## Guardrails & Invariants

All agents and contributors must preserve the following principles:

### 1. PWA & Static Hosting Integrity

- **Subpath Independence**: Keep the application deployable from subpaths (`https://<owner>.github.io/<repo>/`) as well as root domains (`https://example.com/`). Never hardcode root-relative asset paths or router links (`/` instead of `./` or router link tokens).
- **SPA Fallback Preservation**: Never delete or bypass `scripts/prepare-pages.mjs`. Static hosts like GitHub Pages require `404.html` containing the Angular application bundle to support direct client-side route navigation and browser refresh.
- **Service Worker Lifecycle**: Preserve `@angular/service-worker` in `src/app/app.config.ts` and `ngsw-config.json`. Do not disable service worker caching in production builds. New versions must never disrupt an ongoing practice session or delete local IndexedDB data.

### 2. Data Sovereignty & Transactional Integrity ("Your Notebook Belongs to You")

- **Zero Cloud Leakage**: Application data belongs in native IndexedDB (`pinch-hitter`), never in `localStorage` and never uploaded to an external server or cloud backend.
- **Single-Transaction Atomic Capture**: Event capture, session turn state, batting queue rotation, and revision tokens must commit together in a **single atomic IndexedDB read/write transaction**. UI Signals update only _after_ transaction success.
- **Save Confirmation**: Show saved confirmation only after transaction commit. Preserve previous application state if a write fails.
- **Web Locks & Revision Retries**: Serialize writes within a window. Coordinate cross-tab mutations via Web Locks (`navigator.locks.request`). Fall back to transaction revision checks and automatic retries for browsers without Web Locks.
- **Stable UUIDs & Snapshot Integrity**: Entity IDs must be stable UUIDs (`crypto.randomUUID()`). Player names and jersey numbers must be snapshotted onto `BallEvent` records at capture time so subsequent roster changes never rewrite historical records.
- **Reversible Undo**: The 100-step undo stack must delete the latest event and revert turn state atomically, reversing automatic advancement while respecting subsequent deliberate queue adjustments.
- **Non-Destructive Backups & Merges**: Validates schema, references, bounds, and IDs before import, previews counts, then applies a non-destructive atomic merge where matching IDs use the newer `updatedAt`.

### 3. Mobile-First, Dugout Ergonomics & Universal Accessibility

- **Field-Ready Usability**: Phone portrait is the primary experience. One-handed operation is paramount: **store data richly; ask for data sparingly**. A field tap must create a valid observation without modal confirmation. Classifications are optional and must not silently carry over to the next event. Manual hitter advance is the default.
- **Recorded Contact Terminology**: Call the recorded unit a **recorded contact**, never an inferred swing, at-bat, or official plate appearance.
- **Touch Target Sizing**: Ensure all buttons, links, and interactive controls maintain a minimum target size of 44x44px (`--touch-target-min`).
- **Safe Area Insets**: Support notched displays using CSS `env(safe-area-inset-top/bottom/left/right)`.
- **Keyboard & Focus States**: Retain accessible `:focus-visible` outlines (`--focus-ring`). Never suppress focus rings with `outline: none` without providing an accessible alternative.
- **Zero Horizontal Scroll**: Prevent accidental horizontal layout overflow across phone portrait, phone landscape, tablet, and desktop viewports.
- **Universal Design**: Maintain the Okabe-Ito barrier-free color palette, multi-shape SVG marker glyphs (WCAG 1.4.1), high-contrast slate field (`#0f172a`) for direct outdoor sunlight, and Left-Handed Dugout Mode action rail mirroring.

### 4. Normalized SVG Coordinate System (Version 1)

- **Square Coordinate Surface**: The field coordinate surface is a normalized square with origin `(0, 0)` at the top-left, X increasing rightward to `1.0`, Y increasing downward to `1.0`.
- **Home Plate Anchor**: Home plate is anchored at `(0.50, 0.88)`.
- **Coordinate Immutability**: Stored coordinates must always remain the original normalized floating point values `[0.0, 1.0]`. Never mutate or round coordinates to fit a screen, viewport, or heatmap bin.
- **Separation of Analytics**: Derived metrics (density grids, directional tendencies, spray charts) must remain separate from raw observations and always expose their explicit denominators.

### 5. YAGNI & Minimal Complexity

- **Native Standards First**: Use native browser Web APIs, standard HTML elements, native SVG, and CSS custom properties before adding third-party libraries.
- **Angular Built-in Primitives**: Prefer Angular Signals (`signal()`, `computed()`) for reactive state and native control flow (`@if`, `@for`) over heavyweight state management libraries or unnecessary RxJS ceremony.
- **No Unrequested Boilerplate**: Keep components and services focused on their explicit purpose. Avoid speculative abstractions.
