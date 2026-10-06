# Execution Plan: Defensive Alignments (B4) & Spanish for Pro Analysis

- **Date**: 2026-10-06
- **Status**: Completed (2026-10-06)
- **Owner**: Chris / Claude

## 1. Goal & Objectives

- Ship the last roadmap Pro feature: **defensive alignment and coverage zones** (TODO-B4), so every Lifetime Pro purchase includes the full Phase B set.
- Make the Pro analysis card, scout cards, and the Pro entry points fully translated (en/es).

## 2. Context & Background

- Pro analysis lives in `src/app/reports/pro-analytics.component.*` (Compare and Trends tabs, sample-data previews for free coaches). Scout cards live in `scout-card.component.ts`. Both were English-only.
- Coordinates are normalized (ADR-007). Distances use `calculateDistanceFeet`, which scales by spray angle against the high-school reference diamond.

## 3. Proposed Changes

- `src/app/data/defense.ts` (new, pure): five alignments (Standard, Pull shift, Opposite shift, Infield in, No doubles). Each is a set of fielder spots in feet and spray angle relative to the hitter's pull side. Spots are mirrored for left-handed contacts and scaled to the selected fence.
  - `alignmentCoverage(events, alignment, fence)` returns covered ground balls, line drives, and fly balls, each a `Ratio` with an explicit denominator.
  - A contact counts as covered when it lands within a fielder's typical range of those spots: infielders about 30 ft on the ground, outfielders about 70 ft in the air.
- `FieldComponent`: a `zones` input that draws translucent range circles. They are decorative; the numbers live in the table.
- Pro analysis gets a third **Defense** tab: an alignment picker, field overlay, a comparison table across all alignments with the best per column marked, a plain-language insight, and the method note. Sample data is used for free coaches.
- New `FeatureId` `defensive_alignment` is added to `PRO_FEATURES`, `SHIPPED_PRO_FEATURES`, and the upgrade-sheet strings.
- All Pro analysis and scout-card text moves to the en/es dictionaries (`proa.*`, `scout.*`).

## 4. Implementation Steps

- [x] **Step 1**: `defense.ts` and unit tests (mirroring, scaling, coverage counts, denominators).
- [x] **Step 2**: `zones` input on `FieldComponent`.
- [x] **Step 3**: Defense tab and entitlement wiring.
- [x] **Step 4**: i18n for the Pro analysis card, scout card, and the Pro buttons on Reports and Settings.
- [x] **Step 5**: e2e for the Defense tab and a Spanish Pro analysis check. Update docs (ROADMAP, pro-tier-strategy, user manual).

## 5. Verification Plan

- [x] `npm test -- --watch=false`, `npm run lint`, `npm run format:check`
- [x] `npm run e2e`, `npm run build`, `npm run e2e:pwa`
- [x] Visual check of the Defense tab on phone and desktop

## Outcome notes

- Ground-ball reach was tuned from 30 ft to 22 ft. At 30 ft the standard alignment covered every gap, which made shifts meaningless. A unit test now pins that a grounder through the standard 5–6 hole is covered only by the pull shift.
- Found and fixed while testing: Angular renders `{{ }}` inside SVG `<title>` as raw text, so every spray-chart mark tooltip and the chart title showed template source. These now bind `textContent`.

## 6. Risks, Ceilings & Rollback

- **Ceiling**: Coverage is a planning estimate from landing spots and typical fielder range, not a play-by-play result. The UI says so.
- **Ceiling**: Scaling to the fence approximates smaller diamonds; youth infields aren't exactly proportional.
- **Rollback**: Remove `defensive_alignment` from `SHIPPED_PRO_FEATURES` and the tab. Nothing is stored, so no data migration is involved.
