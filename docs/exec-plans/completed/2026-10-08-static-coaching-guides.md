# Execution Plan: Static Coaching Guides

- **Date**: 2026-10-08
- **Status**: Completed
- **Owner**: Claude Code

## 1. Goal & Objectives

Give search engines real coaching text to rank. Publish three guides ("How to chart batting practice", "How to read a spray chart", "Spray charts for softball") and a small index at `<base href>guides/`. They're plain static HTML, so they load instantly and crawlers never need JavaScript. Each guide ends with an "Open Pinch Hitter" link back to the app.

## 2. Context & Background

- Only `/` and `/privacy/` were indexable. Commit 0962205 added SEO metadata to `prepare-pages.mjs` from `SITE_URL`. The user chose to host guides inside the `pinch-hitter` subpath.
- The Angular service worker answers every in-scope navigation with `index.html`. Without an exclusion, an installed app would show Home instead of an article.
- CI (`ci.yml`) ran `npm run build` without `prepare-pages.mjs`, so a guides test in `e2e-pwa` would have nothing to load.

## 3. Proposed Changes

- `guides/guides.mjs` (metadata) and `guides/<slug>.html` (HTML body fragments). There's no Markdown step: fragments need no parser or dependency, and Prettier formats them.
- `scripts/build-guides.mjs`: one inline-styled template using the app's tokens, relative links only, per-page title, description, Open Graph tags, and `Article` / `CollectionPage` JSON-LD. Canonical, `og:url`, and absolute `og:image` are added when `SITE_URL` is set. It returns sitemap entries.
- `scripts/prepare-pages.mjs`: calls `writeGuides` and adds guide URLs to `sitemap.xml`.
- `ngsw-config.json`: `navigationUrls` restates Angular's defaults and adds `!/guides` and `!/guides/**`.
- `scripts/serve-production.mjs`: serves a folder's `index.html` and redirects a missing trailing slash, like GitHub Pages.
- Crawl paths: a link in the static splash in `src/index.html` and in the privacy page footer. `home.component.ts` isn't touched, because another session is editing it.
- `ci.yml`: build with `npm run build:pages`.

## 4. Implementation Steps

- [x] **Step 1: Content**: Wrote three guides (750–960 words) for volunteer and high-school coaches, using "recorded contact" terminology.
- [x] **Step 2: Generator**: Added `build-guides.mjs` and wired it into `prepare-pages.mjs` and the sitemap.
- [x] **Step 3: Service worker**: Added the navigation exclusion and confirmed the compiled regexes in `dist/browser/ngsw.json`.
- [x] **Step 4: Test**: Added `e2e-pwa/guides.spec.ts`. It installs the worker, follows the privacy footer link to the index and then to a guide, checks the article text, checks the no-slash redirect, and returns via "Open Pinch Hitter". With the exclusion removed from `ngsw.json`, the test fails: Home's "Let's get to the field." appears instead.
- [x] **Step 5: Docs**: Updated ARCHITECTURE "Search & Link-Preview Metadata" and "PWA & Offline Strategy", plus the AGENTS.md code map.

## 5. Verification Plan

- [x] Unit tests pass: `npm test -- --watch=false`
- [x] Lint analysis passes: `npm run lint`
- [x] Formatting passes: `npm run format:check`
- [x] Multi-viewport E2E smoke tests pass: `npm run e2e`
- [x] PWA offline tests pass: `npm run e2e:pwa`
- [x] `SITE_URL=https://oxford-comma-development.github.io/pinch-hitter node scripts/prepare-pages.mjs` emits canonical links, absolute `og:image`, and six sitemap URLs
- [x] Real browser verification at 375px phone width: no horizontal scroll, and header and footer links are at least 44px

## 6. Risks, Ceilings & Rollback

- **Ceiling / Known Limitation**: The guides aren't cached by the service worker, so they need a connection. That's fine for reading material, and the app itself stays offline-first. Guides are English only. `ng serve` doesn't serve `guides/`, so the dev server falls back to Home; preview guides with `npm run build:pages` and `node scripts/serve-production.mjs`.
- **Rollback Strategy**: Revert the commit. If only the exclusion is reverted, installed apps go back to showing Home for guide URLs. Nothing else depends on the guides.
