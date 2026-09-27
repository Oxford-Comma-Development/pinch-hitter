# Architectural Decisions

This document records the architectural decision records (ADRs) for **Pinch Hitter**.

Each record outlines the context, rationale, consequences, and trade-offs of significant architectural decisions made in the codebase.

---

## Decision Index

- [ADR-001: Angular Standalone Components and Signals Architecture](#adr-001-angular-standalone-components-and-signals-architecture)
- [ADR-002: GitHub Pages Static Hosting with Dynamic Base Href and 404 Fallback](#adr-002-github-pages-static-hosting-with-dynamic-base-href-and-404-fallback)
- [ADR-003: Vitest for Unit Testing and Playwright for Multi-Viewport E2E Testing](#adr-003-vitest-for-unit-testing-and-playwright-for-multi-viewport-e2e-testing)
- [ADR-004: Vanilla SCSS Design Tokens over External CSS Frameworks](#adr-004-vanilla-scss-design-tokens-over-external-css-frameworks)
- [ADR-005: Built-in Angular Service Worker for Offline PWA Support](#adr-005-built-in-angular-service-worker-for-offline-pwa-support)
- [ADR-006: Native IndexedDB Persistence with Web Locks and Revision Tokens](#adr-006-native-indexeddb-persistence-with-web-locks-and-revision-tokens)
- [ADR-007: Resolution-Independent Normalized Square Coordinate System (Version 1)](#adr-007-resolution-independent-normalized-square-coordinate-system-version-1)
- [ADR-008: Method-Agnostic Feature Entitlement Gateway with In-App Simulator](#adr-008-method-agnostic-feature-entitlement-gateway-with-in-app-simulator)
- [ADR-009: Universal Accessibility Baseline & Dugout Ergonomics](#adr-009-universal-accessibility-baseline--dugout-ergonomics)
- [ADR-010: Single-Transaction Atomic Capture and Reversible 100-Step Undo Stack](#adr-010-single-transaction-atomic-capture-and-reversible-100-step-undo-stack)

---

## ADR-001: Angular Standalone Components and Signals Architecture

### Status

Accepted

### Context

Legacy Angular applications relied heavily on `NgModule` containers and required complex state management libraries (NgRx, Akita) or extensive RxJS boilerplate for standard component state. Modern Angular provides standalone components, direct provider injection, and Angular Signals.

### Decision

- Use Angular standalone components exclusively (`standalone: true` default in modern Angular).
- Use Angular Signals (`signal()`, `computed()`, `effect()`) for synchronous UI state and reactivity.
- Reserve RxJS for streaming asynchronous events, debouncing, and cancellation scenarios.

### Consequences

- **Positive**: Dramatically less boilerplate, faster build times, tree-shakable components, and clearer mental model for state updates.
- **Trade-off**: Requires developers accustomed to NgModules or heavy state stores to adopt Angular's native modern patterns.

---

## ADR-002: GitHub Pages Static Hosting with Dynamic Base Href and 404 Fallback

### Status

Accepted

### Context

GitHub Pages is a cost-effective, zero-maintenance static host for web applications. However, it presents two challenges for modern single-page applications:

1. Projects are often hosted at subpaths (`https://<owner>.github.io/<repo>/`) rather than the domain root.
2. Static file servers return a 404 error when users reload or directly navigate to client-side routes (e.g. `/practice` or `/reports`).

### Decision

- Dynamically inject the repository's base path during GitHub Actions deployment using `@actions/configure-pages`.
- Generate a `404.html` SPA fallback by copying `dist/.../browser/index.html` via `scripts/prepare-pages.mjs` during the build step.
- When GitHub Pages encounters a direct route, it serves `404.html` containing the Angular application bundle and correct `<base href>`, enabling Angular Router to initialize and display the requested route.

### Consequences

- **Positive**: Complete repository-name independence; zero configuration required when creating a new repo; client-side routing works reliably on refresh.
- **Trade-off**: Direct route navigation briefly returns an HTTP 404 status code behind the scenes before serving the SPA shell. For static PWAs on GitHub Pages, this is standard and harmless.

---

## ADR-003: Vitest for Unit Testing and Playwright for Multi-Viewport E2E Testing

### Status

Accepted

### Context

Traditional Angular testing setups used Karma and Protractor (or heavy headless Chrome runners), leading to slow feedback loops and deprecated toolchains. A mobile-first PWA also requires validating rendering across physical device viewports to ensure no horizontal overflow or touch-target degradation occurs.

### Decision

- Use **Vitest** with JSDOM for fast, in-process unit tests (`npm test`).
- Use **Playwright** (`npm run e2e`) for automated end-to-end smoke testing across mobile portrait (390x844), mobile landscape (844x390), tablet (768x1024), and desktop (1280x800) viewports.
- Use a dedicated offline Playwright suite (`npm run e2e:pwa`) to verify execution completely severed from the network.

### Consequences

- **Positive**: Near-instant unit test execution; robust visual and functional validation across real browser engines (Chromium, WebKit, Firefox).
- **Trade-off**: Requires maintaining both a lightweight unit test runner and a browser-driven E2E runner.

---

## ADR-004: Vanilla SCSS Design Tokens over External CSS Frameworks

### Status

Accepted

### Context

Many starters bundle large CSS utility frameworks (Tailwind, Bootstrap) that increase bundle weight, add build complexity, and impose opinionated styling abstractions that downstream projects often fight or replace.

### Decision

- Use vanilla SCSS structured with CSS Custom Properties (`src/styles.scss`) for color palette, spacing, typography, radii, and touch-target minimums.
- Rely on native modern CSS features: flexbox, grid, `:focus-visible`, `env(safe-area-inset-*)`, and `@media (prefers-reduced-motion)`.

### Consequences

- **Positive**: Zero CSS runtime overhead, tiny bundle sizes, complete freedom for downstream applications, and native browser standards compliance.
- **Trade-off**: Requires writing semantic CSS rather than utility classes in HTML templates.

---

## ADR-005: Built-in Angular Service Worker for Offline PWA Support

### Status

Accepted

### Context

Progressive Web Applications require service workers to cache application assets and enable offline startup. Hand-crafting custom service workers introduces high maintenance overhead, cache-invalidation bugs, and manual versioning complexity.

### Decision

- Use `@angular/service-worker` configured via `ngsw-config.json`.
- Configure `appConfig` in `src/app/app.config.ts` to register the service worker when stable in production mode.
- Use the `prefetch` asset group for the app shell and the `lazy` group for secondary assets.

### Consequences

- **Positive**: Robust, hash-based asset cache invalidation; automatic background updates; official Angular tooling support.
- **Trade-off**: Custom service worker logic requires using extension hooks or integrating with Angular's service worker APIs.

---

## ADR-006: Native IndexedDB Persistence with Web Locks and Revision Tokens

### Status

Accepted

### Context

Coaches use Pinch Hitter in remote dugouts without reliable internet. Storing coaching notebooks on external servers requires accounts, recurring subscription fees, and risk of data loss when offline. `localStorage` is synchronous, blocked by main-thread execution, and severely constrained (5–10MB) with no transactional capabilities.

### Decision

- Persist all coaching data in browser-native IndexedDB (`pinch-hitter` database).
- Use the Web Locks API (`navigator.locks.request`) to coordinate cross-tab read/modify/write concurrency.
- Store an internal revision token (`metadata.revision`) inside IndexedDB to detect concurrent writes and retry automatically up to two times on platforms without Web Locks.
- Request persistent storage via `navigator.storage.persist()`.

### Consequences

- **Positive**: Complete user privacy and data sovereignty; high capacity; non-blocking asynchronous I/O; multi-tab transactional safety.
- **Trade-off**: Data is bound to the browser profile. Coaches must use manual JSON backup/export to transfer notebooks across devices or safeguard against browser storage clearance.

---

## ADR-007: Resolution-Independent Normalized Square Coordinate System (Version 1)

### Status

Accepted

### Context

Batted-ball locations must be captured on diverse devices: small phones, large tablets, landscape displays, and printed scouting reports. Using pixel coordinates or hardcoded screen offsets causes drift and distortion across different screen sizes.

### Decision

- Adopt a normalized Version 1 square coordinate system:
  - Origin `(0.0, 0.0)` is top-left.
  - Normalized coordinates `fieldX` and `fieldY` are strictly bounded in `[0.0, 1.0]`.
  - Home plate is anchored at `(0.50, 0.88)`.
- SVG viewbox is defined as `0 0 1000 1000`, mapping `fieldX = svgX / 1000` and `fieldY = svgY / 1000`.
- Stored coordinates in `BallEvent` are immutable normalized floats. Responsive letterboxing or rotation transforms are strictly presentation layer concerns.

### Consequences

- **Positive**: Perfect mathematical portability across phone portrait, phone landscape, desktop, and PDF printouts.
- **Trade-off**: Requires pure mathematical transforms (`domain.ts`) between screen client coordinates and SVG viewBox space.

---

## ADR-008: Method-Agnostic Feature Entitlement Gateway with In-App Simulator

### Status

Accepted

### Context

Pinch Hitter intends to offer Pro coaching features (such as custom fence dimensions, multi-player comparative spray charts, and executive scout PDFs) without tying the codebase to a specific monetization provider (Stripe, LemonSqueezy, or school licenses) and without breaking offline functionality.

### Decision

- Implement `EntitlementService` as a method-agnostic authorization gateway exposing `canAccess(feature: FeatureId)` and signals (`isPro`, `tier`).
- Default out-of-the-box to fully unlocked (`pro`) with zero configuration, so coaches and developers have instant access.
- Include an in-app tier simulator in `Settings → Coach License & Pro Features` persisted in `localStorage` (`pinch_hitter_simulated_tier`) to test gated features without polluting IndexedDB backups.

### Consequences

- **Positive**: Future licensing adapters (offline Ed25519 cryptographic keys, Stripe webhooks) plug in seamlessly without touching domain or component logic.
- **Trade-off**: Client-side enforcement can be overridden by knowledgeable users in browser dev tools; acceptable for a local-first offline PWA where data sovereignty is primary.

---

## ADR-009: Universal Accessibility Baseline & Dugout Ergonomics

### Status

Accepted

### Context

Coaches operate phones in intense outdoor midday sunlight, often with one hand while holding baseball equipment, and approximately 8% of male coaches have red-green color vision deficiency (deuteranopia/protanopia), making red dots on green grass indistinguishable.

### Decision

- Adopt the Okabe-Ito barrier-free color palette for all spray chart markers and CVD-safe blue-to-yellow heatmaps.
- Implement WCAG 1.4.1 redundant shape encoding: every batted-ball outcome renders as a distinct geometric SVG glyph (circles, diamonds, triangles, stars, crosses, squares).
- Build an Obsidian Slate high-contrast field canvas (`#0f172a`) with solid 6px white foul lines to eliminate sunlight glare.
- Implement Left-Handed Dugout Mode, mirroring the bottom action footer to position "Next batter" directly under the left thumb (`flex: 1.5`).

### Consequences

- **Positive**: Full accessibility compliance; dramatically superior field ergonomics under outdoor sporting conditions.
- **Trade-off**: Requires maintaining dual visual themes and dynamic SVG marker shape templates.

---

## ADR-010: Single-Transaction Atomic Capture and Reversible 100-Step Undo Stack

### Status

Accepted

### Context

During high-tempo batting practice, a coach may tap the screen rapidly. Partial writes (e.g. saving an event but failing to advance the queue) leave the application in an inconsistent state. Accidental taps require instant, reliable reversal without corrupting turn order.

### Decision

- When a ball event is captured, the event record, session turn state (`currentTurn`, `turnContacts`, `nextSequence`), queue rotation, undo stack entry, and revision token commit in a **single atomic IndexedDB transaction**.
- Store up to 100 reversible actions in `PracticeSession.undoStack` containing `before` and `after` snapshots.
- Undo deletes the event and restores session state in one transaction, automatically reversing rotation while respecting subsequent deliberate queue reordering.

### Consequences

- **Positive**: Zero possibility of orphaned events or corrupted batting orders; bulletproof field recovery.
- **Trade-off**: Requires snapshotting turn and queue state into each undo frame.

---

## Template for New Decisions

When recording a new architectural decision, copy and fill out the following template:

```markdown
## ADR-###: [Short Title]

### Status

[Proposed | Accepted | Superseded | Deprecated]

### Context

[What problem are we trying to solve? What constraints exist?]

### Decision

[What is the change or technical choice being made?]

### Consequences

- **Positive**: [What benefits does this decision bring?]
- **Trade-offs**: [What drawbacks, limitations, or maintenance costs are accepted?]
```
