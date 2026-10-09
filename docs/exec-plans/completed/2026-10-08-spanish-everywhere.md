# Execution Plan: Spanish on Every Screen

- **Date**: 2026-10-08
- **Status**: Completed
- **Owner**: Claude Code

## 1. Goal & Objectives

A coach who picks Español in Settings should read Spanish on every screen, not a mix. Home already
routes its text through the `t` pipe; Practice, Roster, Reports, Settings, the spray-chart field,
and the app shell still hardcoded English, and about 90 dictionary keys sat unused.

- Route every visible string (text, `aria-label`, `title`, `placeholder`, status messages) through
  the `t` pipe or `I18nService.t`.
- Give `CoachStore.unbackedWork()` counts instead of an English sentence; word it in the UI.
- Show dates in the coach's language (`oct`, `jue`), not always English.
- Stop writing "1 practices".
- Add `scripts/check-i18n.mjs` so unused or one-sided keys show up immediately.

## 2. Context & Background

- `I18nService.t(key, params)` looks up `en.ts` / `es.ts` and replaces `{param}` tokens; the impure
  `t` pipe re-renders when the language signal changes.
- Spanish copy uses "pelotero", "libreta", and "coach" (see `home.*`).
- Live-practice capture logic (`CoachStore.recordContact`, queue rotation, undo) is out of scope;
  only the words around it change.
- Data-layer validation errors (`transfer.ts`, `coach-store.ts` guard rails) stay English for now.

## 3. Proposed Changes

- `i18n.service.ts`: plural lookup (`key.one` / `key.other` chosen with `Intl.PluralRules` when a
  numeric `count` param is passed), `date(value, format)` using `formatDate` with the current
  language, `unbackedSummary(work)`, `sessionTitle(title)`, and Spanish locale registration.
  Parameter values are inserted literally (a `$&` in a team name no longer corrupts text).
- `local-date.pipe.ts`: `localDate` pipe. Its format may be a `date.*` key so Spanish can put the
  day before the month (`8 oct 2026`).
- `coach-store.ts`: `UnbackedWorkSummary.summary` replaced by `neverBackedUp`.
- `shared/files.ts`: `shareFile` returns `'shared' | 'canceled' | 'downloaded'` so Settings can
  word the outcome; share-sheet title and text are parameters.
- Templates and component messages: Practice, Roster, Reports, Settings, Home, field, app shell,
  Pro license card, scout card.
- Dictionaries: new `roster.*`, `practice.*`, `reports.*`, `settings.*`, `backup.*`, `date.*`,
  `fence.*`, `field.*`, `common.*` keys; stale keys with no matching UI removed.

## 4. Implementation Steps

- [x] **Step 1: Key checker**: `node scripts/check-i18n.mjs` lists unused keys and keys missing from
      either dictionary (exit 1 on a mismatch).
- [x] **Step 2: Service support**: plurals, `localDate`, Spanish locale data, unbacked summary.
- [x] **Step 3: Screens**: Roster, Settings, Practice, Reports, field, shell, date pipes.
- [x] **Step 4: Tests**: i18n spec covers plurals, literal params, Spanish dates, and the summary;
      e2e plural assertion updated (`1 team`).
- [x] **Step 5: Verify**: quality gates and Spanish walkthrough at mobile width.

## 5. Verification Plan

- [x] Unit tests pass: `npm test -- --watch=false`
- [x] Lint analysis passes: `npm run lint`
- [x] Formatting passes: `npm run format:check`
- [x] Multi-viewport E2E smoke tests pass: `npm run e2e`
- [x] `node scripts/check-i18n.mjs` reports 0 unused keys and 0 missing keys
- [x] Real browser verification in Spanish at 375px: Home, Roster, Practice, Reports, Settings

## 6. Risks, Ceilings & Rollback

- **Ceiling / Known Limitation**: Validation messages thrown by the data layer (`transfer.ts`
  imports, `coach-store.ts` guard rails) and roster CSV row errors are still English. The privacy
  policy page is English-only long-form copy. The "Developer preview" legend on the Pro card only
  appears in dev builds.
- **Rollback Strategy**: Revert the commit. No storage schema changes; `UnbackedWorkSummary` is
  computed in memory only.
