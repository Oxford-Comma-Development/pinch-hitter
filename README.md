# Pinch Hitter

A coach’s personal baseball notebook and batting-practice spray chart. Built for the coach behind the catcher, with a phone in one hand and attention on the hitter.

**[Open Pinch Hitter](https://cboler.github.io/pinch-hitter/)**

## At the field

1. Name your team and add players individually, paste a `Name, Number` list, or preview and import a roster CSV.
2. Tap **Start Practice**. Your active roster is ready in its usual order; choose a subset or rearrange today’s lineup if needed.
3. Tap the field where the ball lands. That is enough to save a contact. Optionally classify the latest contact or add a note.
4. Keep recording for the same hitter. **Next batter** moves them to the back of the line. Automatic rotation after a chosen number of recorded contacts is also available.
5. Finish and review a player or practice. Explore the spray chart, density, event history, classifications, pitcher splits, and direction tendencies. Correct older observations with explicit Save / Cancel controls.
6. Download or share a backup after practice.

The active practice screen includes current hitter, on-deck queue, touch reordering, skip/defer, sit-out/return, direct player selection, RHP/LHP, switch-hitter side, notes, and Undo Last. Undo also restores an automatic hitter change. Speech selection is optional and falls back to searchable roster selection.

## Your notebook belongs to you

No account, subscription, analytics, or application backend. Teams, players, sessions, contacts, notes, and preferences live in **IndexedDB on your device**. Captures and queue changes commit atomically before the app confirms they are saved. Reloading or reopening resumes the active practice.

Browser storage is tied to a browser profile and site address. Use Settings to request persistent storage and keep a separate JSON backup. Clearing browser data or losing a device can remove the only local copy. The application never uploads your coaching data.

- **JSON backup:** versioned, complete export with stable IDs, raw coordinates, history, notes, and active queue. Import validates records and relationships, previews counts, then merges without deleting unrelated local records. Matching IDs use the newer record. Divergent copies retain both contacts and reconcile session sequences.
- **CSV:** documented flat event export for spreadsheets, R, Python, or external baseball systems. Export a filtered player/practice report, active team, or all data. Formula-like text is escaped for spreadsheet safety.
- **Sharing:** native file sharing where supported, ordinary download everywhere else.
- **Print / PDF:** player, team, and session reports include the chart, filter context, and summaries. Use the browser print dialog to print or save a PDF.

See [the data format and migration guide](docs/data-format.md) for IndexedDB stores, entity relationships, JSON, CSV columns, merge rules, and coordinates.

## Install and use offline

Open the app online once and allow the service worker to finish caching. On supporting browsers, use **Settings → Install Coach Helper** or the browser’s install action. On iPhone/iPad, use Safari’s **Share → Add to Home Screen**.

After caching, roster management, practice recording, queue changes, reports, historical corrections, and file exports work offline. The interface treats offline use as normal. Speech recognition may rely on the browser’s network service; tapping a player always works locally. Updates are offered explicitly, and saved practice data survives updates.

## Development

Requires Node.js 24 and npm. No additional runtime dependencies beyond Angular and the existing application stack.

```sh
npm ci
npm start
```

Open `http://localhost:4200`. Angular standalone route components cover Home, Roster, Practice, Reports, and Settings. Product styling uses native CSS/SVG with system fonts; no external assets are required during practice.

```sh
npm run format:check
npm run lint
npm test -- --watch=false
npm run build
npx playwright install chromium
npm run e2e
npm run e2e:pwa
```

`e2e:pwa` requires a production build in `dist/browser`. It serves that build locally, establishes service-worker control, disconnects the browser, reloads, and exercises recording, rotation, reports, roster, and CSV export. `e2e` covers real workflows at phone portrait (390×844), phone landscape (844×390), tablet portrait (768×1024), tablet landscape (1024×768), and desktop (1280×800). Touch tests use Chromium’s touch input protocol. Domain tests cover queue state, undo, coordinate normalization, analytics, imports, and migration handling. Repository tests exercise real browser IndexedDB transactions.

## Architecture

- `src/app/data/models.ts`: explicit versioned domain entities and stable IDs.
- `src/app/data/domain.ts`: pure queue, event creation, undo, coordinate, filtering, and summary logic.
- `src/app/data/repository.ts`: native IndexedDB stores, indexes, migrations, revision checks, and atomic transactions.
- `src/app/data/coach-store.ts`: signal-based application state and serialized writes. Web Locks coordinate tabs when available; transaction revision checks prevent stale writes without that API.
- `src/app/data/transfer.ts`: strict portable backup validation/merge, roster CSV parsing, and event exports.
- `src/app/shared/field.component.ts`: responsive normalized SVG used for capture, reports, and corrections. The source coordinate system is square, top-left origin, X right, Y down, home plate `(0.5, 0.88)`, version 1.
- `src/app/reports/`: combined filters, distributions with explicit denominators, density derived from observations, event editing, and print layouts.

Raw locations are authoritative. Classifications are nullable. Batter and pitcher handedness are captured per event; player metadata edits cannot rewrite the historical batting side. Counts mean recorded contacts, never inferred swings, batting average, or complete game statistics. The notebook models one season per team record; create another team/season in Settings to keep seasons separate.

Reports currently filter in-memory season data and aggregate density into a fixed grid. This supports thousands of observations without requiring a charting dependency. IndexedDB indexes and isolated domain code provide a path to paginated queries or future synchronization without replacing the model. See the data guide for exact merge limits.

## Deployment

The public repository is [cboler/pinch-hitter](https://github.com/cboler/pinch-hitter). GitHub Pages uses **GitHub Actions**, deploying `main` to `/pinch-hitter/`.

The Pages workflow runs formatting, lint, unit tests, production build, multi-viewport coach workflows, and offline PWA tests before deployment. GitHub supplies the repository base path. `scripts/prepare-pages.mjs` creates the SPA `404.html` fallback and verifies PWA output. A separate Gitleaks workflow scans commits for secrets. Direct application routes remain usable after refresh through the Pages fallback (GitHub returns HTTP 404 for those fallback requests while Angular renders the requested route).

For a local Pages-shaped build:

```sh
npm run build -- --base-href /pinch-hitter/
node scripts/prepare-pages.mjs
npm run e2e:pwa
```

App icons originate in `public/icons/mark.svg`. `node scripts/generate-icons.mjs` regenerates the PNG and ICO variants using the installed Playwright browser.

## Practical limits

This release is a local notebook, with file-based collaboration. It has no hosted synchronization, accounts, or automatic cloud backup. Speech and installation prompts depend on browser support. Automated touch/viewport coverage uses Chromium; physical iOS/Safari and bright-sunlight testing remain useful before a school-wide rollout. Density and directional summaries describe recorded locations, without inventing classifications for missing data.
