# Agent Instructions

This repository is an **Angular PWA Starter** optimized for hosting on **GitHub Pages**.

When working in this repository or any project created from this template, follow these guidelines:

## Core Principles

1. **Preserve PWA & Deployment Infrastructure**:
   - Keep the Angular Service Worker (`@angular/service-worker`, `ngsw-config.json`), Web App Manifest (`public/manifest.webmanifest`), and GitHub Actions Pages deployment workflows intact unless a project requirement explicitly dictates modifying them.
   - Maintain the SPA 404 fallback mechanism (`scripts/prepare-pages.mjs`) to ensure client-side routing survives direct navigation and browser refreshes on GitHub Pages.

2. **Replace Placeholder UI**:
   - The initial components (`src/app/home/` and `src/app/status/`) and header branding are demonstration placeholders meant to be replaced with your application's domain UI.
   - Update branding metadata in `src/index.html`, `public/manifest.webmanifest`, and app icons in `public/icons/`.

3. **Preserve Responsive & Accessibility Standards**:
   - Adhere to the mobile-first foundations defined in `src/styles.scss` (system font stack, accessible `:focus-visible` outlines, touch targets >= 44px, safe-area insets, and reduced-motion support).
   - Prevent accidental horizontal overflow across all viewports (phone portrait, phone landscape, tablet, desktop).

4. **Run Quality & Validation Gates**:
   Before completing substantial changes, verify that the suite passes cleanly:

   ```bash
   npm run lint          # ESLint static analysis
   npm run format:check  # Prettier formatting verification
   npm test              # Vitest unit test suite
   npm run build         # Production Angular bundle
   npm run e2e           # Playwright multi-viewport smoke tests
   ```

5. **Document Architectural Changes**:
   - Keep `README.md` accurate if you alter deployment patterns, add major dependencies, or change project structure.
   - Avoid adding unnecessary external libraries or layers of abstraction without clear justification (YAGNI).
