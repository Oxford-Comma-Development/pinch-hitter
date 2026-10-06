# Project Roadmap

This document outlines the product delivery roadmap for **Pinch Hitter**, tracking completed foundational baselines, current milestones, planned Pro tier capabilities, and technical debt.

---

## Part 1: Core Foundation & Offline Practice MVP (Completed)

The core offline-first coaching notebook baseline is fully delivered and operational:

- [x] **Angular 22+ Standalone Architecture**: Signal-based reactivity, standalone components, zoneless execution patterns.
- [x] **Native IndexedDB Persistence**: Structured object stores (`teams`, `players`, `sessions`, `events`, `notes`, `settings`, `metadata`) in browser database `pinch-hitter`.
- [x] **Atomic Single-Transaction Capture**: Batted-ball observations, turn state updates, batting queue rotation, and revision tokens commit atomically in a single transaction.
- [x] **100-Step Reversible Undo**: Instant one-tap recovery reversing capture and automatic advancement without corrupting manual queue adjustments.
- [x] **Universal Data Ownership**: Lossless canonical JSON backup/merge and flat CSV event exports with spreadsheet formula escaping.
- [x] **Resolution-Independent Coordinates**: Normalized Version 1 square coordinate system `[0.0, 1.0]` anchored at home plate `(0.50, 0.88)`.
- [x] **Static PWA & GitHub Pages Deployment**: Automated CI workflow, dynamic `--base-href` resolution, SPA routing fallback via `scripts/prepare-pages.mjs` (`404.html`), and full offline service worker caching.
- [x] **Automated Test Suites**: Vitest unit/domain test suite (80 tests) and Playwright multi-viewport / offline PWA test coverage.

---

## Part 2: Accessibility & Dugout Ergonomics (Phase A - Completed)

Universal design enhancements tailored for one-handed dugout operation under bright outdoor sunlight:

- [x] **Okabe-Ito Barrier-Free Color Palette**: CVD-safe high-contrast color mapping and blue-to-yellow density heatmaps.
- [x] **WCAG 1.4.1 Multi-Shape Glyph Markers**: Redundant visual encoding rendering ball outcomes as distinct geometric SVG glyphs (circles, diamonds, triangles, stars, crosses, squares).
- [x] **High-Contrast Slate Field Canvas**: `#0f172a` canvas with 6px solid pure white chalk foul lines to eliminate midday outdoor glare.
- [x] **Left-Handed Dugout Mode**: Bottom action bar mirroring placing primary "Next batter" directly under the left thumb (`flex: 1.5`), with mirrored queue and pitcher controls.
- [x] **Method-Agnostic Entitlement Gateway**: `EntitlementService` backed by verified unlock codes; every coach starts free; tier simulator in dev builds only.

---

## Part 3: "Beefy" Pro Analytics & Visualizations (Phase B - Completed)

Advanced analytical capabilities designed for serious coaches, travel programs, high schools, and academies:

### Milestone 3.1: Custom Outfield Fence Distances (TODO-B1)

- [x] **Outfield Fence Overlays**: Overlay outfield fence distance arcs onto the SVG diamond (`field.component.ts`).
- [x] **Standard Dimension Presets**: Presets for Little League (200'), High School (315' LF, 365' alleys, 390' CF), College/Pro (330' LF, 375' alleys, 405' CF), Fastpitch Softball (220'), and Custom distances.
- [x] **Home Plate Vector Distance Math**: Calculate real estimated distance from home plate `(0.50, 0.88)` to landing coordinates `(fieldX, fieldY)`.
- [x] **Warning Track & Home Run Annotation**: Dynamically annotate balls that clear the custom fence vs. warning track fly balls.
- [x] **Entitlement Hook**: Guard custom distance editing behind `canAccess('custom_field_dimensions')` while providing interactive demo presets for free coaches.

### Milestone 3.2: Multi-Player & Switch Split Spray Overlay (TODO-B2)

- [x] **Hitter Comparison View**: "Compare" tab in the Pro analysis card on Reports (`pro-analytics.component.ts`).
- [x] **Superimposed Spray Charts**: Two hitters on one field, Okabe-Ito blue circles vs orange diamonds (shape + colour, WCAG 1.4.1).
- [x] **Switch-Hitter Split Overlay**: Superimpose left-handed batting events over right-handed batting events for a single switch-hitter on one diamond.
- [x] **Comparative Distribution Breakdown**: Side-by-side contacts, hard-hit, whiff, line-drive, pull/center/oppo, and distance with explicit denominators.

### Milestone 3.3: Rolling Development Trend Curves (TODO-B3)

- [x] **Time-Series Line Chart**: Native SVG rolling curves of hard-hit rate (ratings 4–6, matching report summaries) and whiff rate (rating 0), one point per practice day, with an accessible data table.
- [x] **Date Range Selectors**: Rolling windows of 14, 30, and 60 days; the report date filters bound the season.
- [x] **Player Development Velocity**: Change in percentage points from first to latest practice for both rates.

### Milestone 3.4: Defensive Shift & Coverage Zones (TODO-B4)

- [x] **Defensive Positioning Overlays**: "Defense" tab in Pro analysis draws fielder range circles for Standard, Pull shift, Opposite shift, Infield in, and No doubles. Positions are mirrored for left-handed hitters and scaled to the selected fence (`src/app/data/defense.ts`).
- [x] **Spray Vulnerability Insights**: Coverage of ground balls, line drives, and fly balls per alignment, with explicit denominators, the best alignment marked per column, and a plain-language insight. Presented as a planning estimate, not a play-by-play result.

---

## Part 4: In-App Gating UI & Previews (Phase C - Completed)

Refined, non-intrusive upgrade touchpoints that preserve the free practice experience:

- [x] **Milestone 4.1: Subtle `✦ PRO` UI Badges (TODO-C1)**: Elegant badge indicators on Pro features in Reports and Settings without blocking free navigation.
- [x] **Milestone 4.2: Interactive Pro Previews (TODO-C2)**: Allow free coaches to test-drive custom fence overlays and multi-player comparisons using demo data.
- [x] **Milestone 4.3: Upgrade & License Sheet (TODO-C3)**: Bottom sheet (dialog on desktop) explaining Pro, handing off to Stripe-hosted checkout, and accepting pasted unlock codes or links (`src/app/pro/`).

---

## Part 5: Licensing Integrations & Export Enhancements (Phases D & E)

- [x] **Milestone 5.1: Cryptographic Offline License Key Provider (TODO-D1)**: Ed25519 unlock codes verified offline with Web Crypto (ADR-011, `license.ts`).
- [ ] **Milestone 5.2: Stripe Checkout Integration (TODO-D2)**: Code complete. A stateless GCP function in the private `pinch-hitter-license` repo creates hosted Checkout Sessions and mints codes on return, with no webhook. **Remaining:** deploy the function, set `LICENSE_FUNCTION_URL`, then go live (see that repo's `STRIPE_INTEGRATION_TODO.md`).
- [x] **Milestone 5.3: Scout Cards (TODO-E1)**: Print-ready one-page card (`/scout/:playerId`) with team crest, spray chart, key rates, direction bars, 30-day trend, and coach notes. Saved as a PDF through the browser print dialog. _Density heatmap and radar chart deferred._
- [x] **Milestone 5.4: Enriched Analytics CSV Export (TODO-E2)**: Pro exports append estimated distance, spray angle, direction, field zone, and fence columns after the raw columns. _Launch-angle and exit-velocity bands are deferred: they can't be derived honestly without radar data._

---

## Part 6: Technical Debt & Maintenance Backlog

| Item ID | Description                             | Severity | Ceiling / Known Constraint                                                      | Target Milestone |
| :------ | :-------------------------------------- | :------- | :------------------------------------------------------------------------------ | :--------------- |
| _TD-01_ | _In-Memory Season Filtering_            | _Low_    | _Currently loads all season events into memory; scale limit ~250,000 records_   | _Milestone 3.3_  |
| _TD-02_ | _Bounded 12x12 Heatmap Grid_            | _Low_    | _Fixed 12x12 binning; could support dynamic kernel density estimation in Pro_   | _Milestone 3.2_  |
| _TD-03_ | _Speech Recognition Network Dependency_ | _Low_    | _Browser Web Speech API may require internet connection on some mobile devices_ | _Ongoing_        |
