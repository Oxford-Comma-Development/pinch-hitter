# Execution Plan: Search Visibility & First-Impression Polish

- **Date**: 2026-10-08
- **Status**: Completed
- **Owner**: Claude Code

## 1. Goal & Objectives

Make Pinch Hitter discoverable and presentable when it is found: search results, link previews in
texts/Slack/social, and the very first paint. Polish the Home screen so Spanish-speaking coaches
see Spanish everywhere the dictionary already supports it.

## 2. Context & Background

- The app is a client-rendered SPA on GitHub Pages under a subpath. `index.html` has a title and a
  short description only: no Open Graph/Twitter tags, no canonical URL, no structured data, no
  `robots.txt` or `sitemap.xml`. Link-preview bots do not run JavaScript, so they see an empty
  `<app-root>`.
- Absolute URLs (canonical, `og:url`, `og:image`) cannot be hardcoded without breaking subpath
  independence and forks. `actions/configure-pages` already exposes `base_url`.
- `home.component.ts` hardcodes English although `home.*` keys exist in both dictionaries.

## 3. Proposed Changes

- `src/index.html`: keyword-bearing title and description (baseball **and** softball, spray chart,
  batting practice, offline, free), Open Graph/Twitter tags, `SoftwareApplication` JSON-LD, and a
  static branded splash inside `<app-root>` that Angular replaces on bootstrap. The splash gives
  crawlers and preview bots an `<h1>` and summary, and gives coaches a branded first paint instead
  of a blank screen.
- `scripts/generate-icons.mjs`: also render `public/og-image.png` (1200×630).
- `scripts/prepare-pages.mjs`: when `SITE_URL` is set, inject canonical / `og:url` / absolute
  `og:image` / JSON-LD `url`, give `privacy/index.html` its own title, description, and canonical,
  and write `robots.txt` and `sitemap.xml`. Without `SITE_URL`, behaviour is unchanged.
- `.github/workflows/deploy.yml`: pass `SITE_URL` from `configure-pages`.
- `home.component.ts` + dictionaries: route every visible string through `t`.

## 4. Implementation Steps

- [x] **Step 1: Head metadata & splash** in `src/index.html`.
- [x] **Step 2: Social preview image** generated from the brand mark.
- [x] **Step 3: Build-time absolute URLs, robots, sitemap** in `prepare-pages.mjs` + workflow.
- [x] **Step 4: Home i18n** wiring and new keys (en/es). Committed with the screen-wide translation work, which edits the same files.

## 5. Verification Plan

- [x] Unit tests pass: `npm test -- --watch=false`
- [x] Lint analysis passes: `npm run lint`
- [x] Formatting passes: `npm run format:check`
- [x] Production build + `SITE_URL=… node scripts/prepare-pages.mjs` output inspected
- [x] PWA offline tests pass: `npm run e2e:pwa`
- [x] Real browser verification of Home in English and Spanish, mobile portrait

## 6. Risks, Ceilings & Rollback

- **Ceiling**: Deep routes still serve `404.html` with a 404 status on GitHub Pages, so only `/` and
  `/privacy/` are indexable. A custom domain and prerendered marketing pages would do more for
  ranking than any tag; both are out of scope.
- **Rollback**: All changes are additive metadata, a build script branch gated on `SITE_URL`, and
  template string wiring. Revert the commit.
