# Pinch Hitter: implementation principles

Read the workspace `GEMINI.md` when present. Prefer native platform features and existing dependencies; avoid abstraction layers that do not serve an actual product need.

## Product

This is a coach’s local baseball notebook and batting-practice capture tool. Phone portrait is the primary experience. **Store data richly; ask for data sparingly.** A location tap must create a valid observation without a modal or Save step. Classifications are optional and must not silently carry to the next observation. Manual hitter advance is the default. Call the unit a **recorded contact**, never a swing.

The coach normally has one active team; team switching belongs in Settings. During active practice, hide ordinary navigation and prioritize hitter, upcoming line, field, optional classification, Undo, and Next batter. Maintain the field-left/control-right landscape layout and touch queue dragging with accessible alternatives.

## Data integrity

Use stable IDs and explicit domain types. Application data belongs in native IndexedDB, not localStorage. Event capture and session/queue state must commit in one transaction. Show saved confirmation only after commit; preserve old state on failure. Serialize same-tab mutations, coordinate cross-tab writes, and retain revision checks for platforms without Web Locks.

Preserve original normalized coordinates and event-time handedness. SVG/report/export coordinates must follow the documented versioned square system. Do not turn a nullable classification into an implied result. Keep derived analytics separate from source observations and expose their denominators.

Undo must remove the latest capture and correctly reverse any automatic advancement while respecting later deliberate queue changes. Migrations must extend existing data without recreating populated stores. Validate backup schemas, references, numeric bounds, enumerations, and IDs before import, preview counts, then apply a non-destructive atomic merge. Document format changes in [docs/data-format.md](docs/data-format.md).

## UX and PWA

Use readable contrast, semantic buttons, visible keyboard focus, native dialogs or focus-managed sheets, screen-reader labels, at least 44px important touch targets, safe-area padding, reduced motion, and no horizontal overflow. Reports require text equivalents to plotted observations. Keep normal operation useful offline; speech and Web Share are progressive enhancements.

Preserve Angular service worker, repository-relative manifest/assets, and GitHub Pages SPA fallback. Never replace the product identity with infrastructure diagnostics. New versions must not disrupt an ongoing practice or lose local data.

## Verification and delivery

Run formatting, lint, full unit suite, production build, Playwright workflows, and production offline tests before delivering substantial changes:

```sh
npm run format:check
npm run lint
npm test -- --watch=false
npm run build
npm run e2e
npm run e2e:pwa
```

Use realistic tests for queue transitions, persistence, imports, reports, and corrections. Visually inspect phone portrait/landscape and tablet layouts and interact with the real application. Keep README and the focused data guide accurate. Workflows must pass before considering a deployment complete. Do not introduce new dependencies unless the platform and installed stack cannot reasonably cover the need.
