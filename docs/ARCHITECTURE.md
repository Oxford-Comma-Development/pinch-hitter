# System Architecture

This document describes the architectural foundation, system boundaries, data persistence mechanics, coordinate geometry, and offline infrastructure of **Pinch Hitter**.

---

## 1. System Overview

Pinch Hitter is an offline-first, client-side baseball and softball coaching notebook, batting-practice capture tool, and spray chart designed for coaches. It is structured as a client-side **Progressive Web Application (PWA)** hosted entirely on static infrastructure (**GitHub Pages**) with **zero server runtime, zero user accounts, zero analytics tracking, and zero cloud data leakage**:

```
[ Web Browser ]
      │
      ├──> [ Angular Service Worker (ngsw-worker.js) ]
      │         ├──> Cached Application Shell & Assets (CacheStorage)
      │         └──> Offline Boot & Static Asset Management
      │
      └──> [ Angular Application Shell ]
                ├──> Standalone Components & UI Views (Home, Roster, Practice, Reports, Settings)
                ├──> Angular Signals (Reactive State & Unidirectional Data Flow)
                ├──> Angular Router (Client-side Navigation with 404 Fallback)
                ├──> Entitlement Gateway (Method-Agnostic Feature Authorization)
                └──> Data Layer (CoachStore, Domain Math, CoachRepository)
                          │
                          └──> [ Native Browser IndexedDB ('pinch-hitter') ]
                                    ├──> teams, players, sessions, events, notes
                                    ├──> Web Locks Cross-Tab Mutex
                                    └──> Transactional Revision Checkpoints
```

### Key Architectural Characteristics

- **Local-First Data Sovereignty ("Your Notebook Belongs to You")**: All teams, rosters, practices, ball events, and notes reside strictly on the coach's local device in IndexedDB. No remote database or account registration is ever involved.
- **Offline-Native Operation**: Works seamlessly in rural ballparks, concrete dugouts, and batting cages with spotty or nonexistent cellular coverage. Storage persistence is requested via `navigator.storage.persist()`.
- **Single-Transaction Atomic Capture**: Recording a batted-ball observation commits the event record, session turn state, batting queue rotation, and database revision in a single atomic IndexedDB transaction before UI signals update or success is acknowledged.
- **Static Hosting Optimized**: Deploys statically to GitHub Pages (`https://oxford-comma-development.github.io/pinch-hitter/`) using a 404 single-page app (SPA) fallback mechanism without hardcoding subpath assumptions.

---

## 2. Technology Stack & Key Libraries

| Layer / Concern            | Technology / Library                  | Purpose / Justification                                                                 |
| :------------------------- | :------------------------------------ | :-------------------------------------------------------------------------------------- |
| **Framework**              | Angular 22+ (Standalone)              | Modern standalone component architecture, inject-based DI, zoneless reactivity patterns |
| **Language**               | TypeScript 6.0+                       | Strict typing, immutable domain transformations, zero runtime reflection                |
| **Reactivity & State**     | Angular Signals                       | Fine-grained synchronous reactivity, computed filters, and predictable UI state         |
| **Storage & Persistence**  | Native IndexedDB (`pinch-hitter`)     | Structured multi-store database on device with atomic transactions and version upgrades |
| **Concurrency & Mutex**    | Web Locks API (`navigator.locks`)     | Cross-window/tab write coordination with transactional revision token fallbacks         |
| **Routing**                | Angular Router                        | Hashless client-side routing with lazy-loaded standalone components                     |
| **Offline & PWA**          | `@angular/service-worker`             | Pre-cached application shell, offline boot, and background update management            |
| **Styling & Presentation** | Native CSS & SCSS                     | Mobile-first design tokens, high-contrast dugout themes, zero runtime CSS bloat         |
| **Field Graphics**         | Native Scalable Vector Graphics (SVG) | Resolution-independent normalized diamond rendering, Okabe-Ito colors, shape glyphs     |
| **Unit Testing**           | Vitest (`jsdom`)                      | Blazing-fast headless unit testing for domain math, queue logic, and store state        |
| **E2E Smoke Testing**      | Playwright                            | Real browser touch testing across phone portrait/landscape, tablet, and desktop         |
| **PWA Offline Testing**    | Playwright (`playwright.pwa.config`)  | Validates app startup, live capture, and export when disconnected from network          |
| **Code Quality**           | Angular ESLint + Prettier             | Automated linting and formatting compliance                                             |
| **Deployment**             | GitHub Actions                        | CI quality gates, Gitleaks secrets audit, and automated GitHub Pages deployment         |

---

## 3. Directory Layout & Boundaries

```
pinch-hitter/
├── docs/                     # Architectural, decision, roadmap, data format, and planning records
│   ├── ARCHITECTURE.md       # This document: system architecture and system boundaries
│   ├── DECISIONS.md          # Architectural Decision Records (ADRs)
│   ├── ROADMAP.md            # Master product roadmap, Pro tier milestones, and tech debt backlog
│   ├── data-format.md        # Canonical IndexedDB schema, migration rules, JSON/CSV specs
│   ├── pro-tier-strategy.md  # Entitlement architecture, feature gating, and analytics roadmap
│   ├── project-overview.md   # Architectural overview, ER diagrams, coordinate geometry
│   ├── user-manual.md        # Coach's Field Manual, workflows, and accessibility guide
│   └── exec-plans/           # Structured execution plans (active/ and completed/)
├── e2e/                      # Multi-viewport end-to-end smoke test suite
├── e2e-pwa/                  # Playwright offline PWA test suite
├── public/                   # Static files served directly without compilation
│   ├── icons/                # PWA icons across standard screen sizes generated from mark.svg
│   ├── favicon.ico           # Browser tab favicon
│   └── manifest.webmanifest  # Install metadata, orientations, and theme colors
├── scripts/                  # Automation scripts for build and deployment pipeline
│   ├── generate-icons.mjs    # Playwright-based script regenerating PNG/ICO icons from mark.svg
│   └── prepare-pages.mjs     # Generates 404.html SPA fallback from index.html
├── src/
│   ├── app/
│   │   ├── data/             # Core domain, data transfer, and persistence layer
│   │   │   ├── models.ts     # Domain entity interfaces, stable IDs, and types
│   │   │   ├── domain.ts     # Pure domain math: queue, undo, coordinates, summaries, filters
│   │   │   ├── repository.ts # Native IndexedDB driver, schema upgrades, revision checks
│   │   │   ├── coach-store.ts # Centralized Signal store and serialized writes
│   │   │   ├── entitlement.service.ts # Feature authorization backed by verified unlock codes
│   │   │   ├── license.ts    # Unlock-code format and offline Ed25519 verification (ADR-011)
│   │   │   ├── license-config.ts # Public keys, function URL, price label, rollback switch
│   │   │   ├── pro-analytics.ts # Pure comparison, rolling-trend, and enriched-export metrics
│   │   │   └── transfer.ts   # Canonical JSON backup/merge and CSV export/parsing
│   │   ├── home/             # Dashboard landing view, active session hero, backup indicators
│   │   ├── i18n/             # Multi-language dictionary files and localization service
│   │   ├── practice/         # Batting practice live capture workspace and Dugout modes
│   │   ├── privacy/          # Privacy policy and local-first data sovereignty statement
│   │   ├── pro/              # Upgrade sheet, /activate page, license card, checkout client, sample data
│   │   ├── reports/          # Analytics, spray charts, heatmaps, 14-day trends, event management
│   │   ├── roster/           # Roster management, player cards, lineup ordering, CSV import
│   │   ├── settings/         # Active team switcher, defaults, visual accessibility, storage, Pro license
│   │   ├── shared/           # Reusable UI components (FieldComponent SVG diamond, modal dialogs)
│   │   ├── app.config.ts     # Global application providers
│   │   ├── app.routes.ts     # Route table and lazy loading configurations
│   │   ├── app.ts            # Root application coordinator and PWA install prompts
│   │   └── app.html / .scss  # Shell layout, navigation bar, and banners
│   ├── index.html            # HTML document entrypoint
│   ├── main.ts               # Application bootstrap
│   └── styles.scss           # Design system tokens, mobile-first resets, and utilities
```

### Architectural Boundaries

1. **Domain Layer (`src/app/data/domain.ts`, `models.ts`)**: Pure TypeScript functions and interfaces with **zero framework or DOM dependencies**. Contains queue rotation mathematics, 100-step reversible undo logic, coordinate clamping, directional trigonometry, and statistical distribution calculators. Fully testable in isolation.
2. **Persistence Layer (`src/app/data/repository.ts`)**: Encapsulates raw browser IndexedDB access, transaction scopes, schema version migrations (v1 to v2), and revision comparison checks. Never exposes raw IDB handles to UI components.
3. **Application State Store (`src/app/data/coach-store.ts`)**: Centralized Angular Signal-based state coordinator. Serializes same-tab write operations, coordinates cross-window writes via Web Locks, and ensures signals update only after IndexedDB transaction commits succeed.
4. **Feature Authorization Layer (`src/app/data/entitlement.service.ts`)**: Method-agnostic entitlement gateway backed by offline-verified Ed25519 unlock codes (ADR-011). The only network dependency is at purchase time: a stateless GCP function in the private `pinch-hitter-license` repo creates Stripe-hosted Checkout Sessions and mints codes for paid sessions. It never receives coaching data.
5. **Presentation & Feature Views (`src/app/practice/`, `reports/`, etc.)**: Standalone Angular components responsible for rendering UI, handling gestures, listening to coach inputs, and invoking store mutations.

---

## 4. State Management & Reactivity

The application uses **Angular Signals** as its primary reactive foundation:

- **Store-Level State Signals**: `CoachStore` maintains reactive signals for `teams`, `players`, `sessions`, `events`, `notes`, `settings`, `activeTeam`, and `activeSession`.
- **Derived Computations**: Filtered observations, batting statistics, density grids, and queue ordering are calculated via `computed(() => ...)`, guaranteeing recalculation only when underlying state changes.
- **Side Effects**: Side effects (e.g. syncing preferences, updating document titles) are contained in `effect(() => ...)`.

### Signals vs. RxJS Decision Matrix

- **Use Signals for**:
  - All application and component state (active team, current hitter, turn sequence, active filters).
  - Derived calculations (spray chart points, density bins, spray directional breakdown percentages).
  - Template binding and UI rendering.
- **Use RxJS for**:
  - Asynchronous event streaming and debouncing.
  - Angular Service Worker version updates (`SwUpdate.versionUpdates`).

---

## 5. Field Coordinate Surface & Mathematics

Pinch Hitter uses a resolution-independent, normalized square coordinate system (Version 1):

```
(0, 0) Top-Left ───────────────────────────── (1.0, 0)
 │                                                │
 │                  Center Field                  │
 │                  (0.50, 0.08)                  │
 │                       │                        │
 │         Left          │         Right          │
 │        Field          │         Field          │
 │                       │                        │
 │                   2nd Base                     │
 │                 (0.50, 0.60)                   │
 │             ◇                   ◇              │
 │          3rd Base            1st Base          │
 │        (0.36, 0.74)        (0.64, 0.74)        │
 │                       ◇                        │
 │                   Home Plate                   │
 │                  (0.50, 0.88)                  │
 │                                                │
(0, 1.0) ──────────────────────────────────── (1.0, 1.0)
```

- **Origin**: `(0, 0)` is the top-left of the square SVG surface (`0 0 1000 1000`).
- **Normalized Units**: `fieldX = svgX / 1000`, `fieldY = svgY / 1000`. Both values are strictly bounded in `[0.0, 1.0]`.
- **Home Plate Anchor**: Exactly centered at `(0.50, 0.88)`.
- **Directional Angle Trigonometry**:
  $$\theta = \text{atan2}(\text{fieldX} - 0.50, 0.88 - \text{fieldY}) \times \frac{180}{\pi}$$
  - Center field zone: $|\theta| \le 15^\circ$.
  - Right-Handed Hitters: $\theta < -15^\circ$ is **Pull**, $\theta > 15^\circ$ is **Opposite**.
  - Left-Handed Hitters: $\theta > 15^\circ$ is **Pull**, $\theta < -15^\circ$ is **Opposite**.
- **Density Grid**: Derived in-memory using a bounded $12 \times 12$ bin matrix normalized to the maximum bin count, providing heat density without external rendering dependencies.
- **Coordinate Immutability**: Coordinates stored in `BallEvent` are immutable normalized values. Viewport resizing, aspect ratio letterboxing, landscape orientation, and PDF printing must only affect the SVG presentation transform, never the stored coordinates.

---

## 6. Storage & Concurrency Architecture

### 6.1 IndexedDB Schema (`pinch-hitter`)

- `teams`: Team metadata, season labels, monogram crests, and optional inline logos.
- `players`: Roster profiles, jersey numbers, batting/throwing handedness, positions, active status, default lineup order.
- `sessions`: Practice sessions, participants, active batting queue, turn counters, sequence tracking, undo stack.
- `events`: Individual recorded batted-ball observations, normalized coordinates, handedness snapshots, classifications, hit power rating (0–5).
- `notes`: Timestamped coaching notes with team/player/session/event relational scope.
- `settings`: Singleton preferences (`id: "preferences"`).
- `metadata`: Internal revision token (`id: "revision"`) for optimistic concurrency checks, and the verified Pro unlock code (`id: "license"`). It is never exported in backups and never bumps the notebook revision.

### 6.2 Concurrency & Transactional Integrity

1. **Same-Tab Serialization**: `CoachStore` serializes all write mutations through a promise queue.
2. **Cross-Tab Mutex**: The Web Locks API (`navigator.locks.request('pinch-hitter-lock')`) coordinates read/modify/write operations across multiple open browser tabs.
3. **Optimistic Revision Fallback**: For platforms lacking Web Locks, `metadata.revision` is compared within the IndexedDB transaction; concurrent collisions trigger an automatic retry (up to two attempts) from fresh data.
4. **Single-Transaction Atomic Capture**: Recording a batted-ball observation writes the new `BallEvent`, updates `PracticeSession` (queue rotation, `currentTurn`, `turnContacts`, `nextSequence`), appends to `undoStack`, and updates `metadata.revision` inside a **single atomic readwrite transaction**.

---

## 7. Routing & Static Hosting Mechanics

GitHub Pages is a static file server that serves files directly from repository branches. Navigating directly or reloading on a client-side route like `/practice` or `/reports` would normally yield an HTTP 404 error.

Pinch Hitter resolves this via `scripts/prepare-pages.mjs`:

```
[ Direct Route Request: /practice ]
               │
               ▼
   [ GitHub Pages Server ]
               │ (File /practice/index.html does not exist)
               ▼
       [ Serves 404.html ]  <── Generated by scripts/prepare-pages.mjs
               │                (contains Angular bundle + dynamic <base href>)
               ▼
      [ Browser Executes App ]
               │
               ▼
     [ Angular Router Activates ]
               │ (Detects URL path is /practice)
               ▼
     [ Renders Practice View Cleanly ]
```

### Subpath Independence

The deployment workflow dynamically injects the base path (`--base-href /pinch-hitter/` on GitHub Pages, `--base-href /` on custom apex domains). The source code contains zero hardcoded absolute domain paths.

---

## 8. PWA & Offline Strategy

Governed by `@angular/service-worker` through `ngsw-config.json`:

1. **App Shell Asset Group (`prefetch`)**:
   - Includes `index.html`, `favicon.ico`, and all compiled JS/CSS bundles.
   - Downloaded and cached immediately upon installation to ensure instant boot without network connectivity.
2. **Static Assets Group (`lazy`)**:
   - Includes icons, images, and static manifests in `public/`.
   - Downloaded on-demand and cached for offline use.
3. **Data Sovereignty**:
   - Zero remote data groups are defined; all data is local in IndexedDB. Service worker handles code updates gracefully without touching database stores.

---

## 9. Universal Accessibility & Dugout Ergonomics

Designed specifically for one-handed mobile use in intense outdoor sunlight:

- **Okabe-Ito Barrier-Free Palette**: Replaces red-green confusion with scientifically validated pigments (vivid yellow, orange, vermilion, sky blue, reddish purple, dark charcoal) and blue-to-yellow CVD heatmaps.
- **Multi-Shape Glyph Markers (WCAG 1.4.1)**: Redundant visual encoding ensures color is never the only data carrier. Contacts render as circles, diamonds, triangles, stars, crosses, and squares. The spray chart legend updates shape glyphs dynamically.
- **High-Contrast Slate Field (`#0f172a`)**: Designed for intense direct sunlight (midday summer games). 6px solid pure white foul lines and bright white bases eliminate glare. Printing automatically inverts this canvas to an ink-saving line-art blueprint.
- **Left-Handed Dugout Ergonomics**: Full mirroring of the bottom action rail pins the primary "Next batter" button directly under the left thumb (`flex: 1.5`), shifting pitcher and queue controls to the left edge for single-thumb reach.
- **Touch Target Baseline**: All interactive controls maintain a minimum target size of 44x44px (`--touch-target-min`).
- **Safe Area Insets**: Handled via `env(safe-area-inset-*)` across notched phone portrait and landscape displays.

---

## 10. Testing & Quality Strategy

Quality gates run automatically in local development and GitHub Actions CI:

```
npm run lint         ──> Angular ESLint verifies code style & best practices
npm run format:check ──> Prettier verifies code formatting
npm test             ──> Vitest runs 80+ unit and domain tests in headless JSDOM
npm run build        ──> Angular build checks budgets & compile errors
npm run e2e          ──> Playwright tests shell across mobile, tablet, and desktop
npm run e2e:pwa      ──> Playwright verifies app launch & offline capture severed from network
```
