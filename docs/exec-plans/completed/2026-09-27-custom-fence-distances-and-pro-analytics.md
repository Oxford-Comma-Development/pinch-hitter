# Execution Plan: Custom Outfield Fence Distances & Pro Field Analytics

- **Date**: 2026-09-27
- **Status**: Completed
- **Owner**: Antigravity Agent & Coach Developer
- **Target Milestones**: Roadmap Milestone 3.1 (TODO-B1) & Phase C Gating Hooks (TODO-C1/C2)

---

## 1. Goal & Objectives

Introduce **customizable outfield fence distances, warning-track calculation, and field dimension presets** to Pinch Hitter's SVG diamond and reports:

1. **Preset Diamond Dimensions**: Provide standard out-of-the-box fence profiles for Little League (200' uniform), High School (315' lines, 365' alleys, 390' center), College/Pro (330' lines, 375' alleys, 405' center), and Fastpitch Softball (220' uniform), plus a fully configurable custom wall.
2. **Home Plate Distance Trigonometry**: Calculate accurate estimated fly ball landing distance in feet from home plate anchor `(0.50, 0.88)` based on normalized coordinates `(fieldX, fieldY)` and diamond scale.
3. **Warning Track & Home Run Classification**: Automatically identify and annotate balls that clear the fence versus warning-track contact within 15 feet of the wall.
4. **Visual Diamond Enhancements**: Render clean, responsive SVG fence arcs, distance markers (LF, CF, RF), and warning-track shading on `FieldComponent` across both Classic Ballpark and Obsidian Slate high-contrast themes.
5. **Decoupled Entitlement Integration**: Free coaches can test-drive standard presets and interactive previews (`canAccess('custom_field_dimensions')`); Pro coaches can customize and persist home field wall distances.
6. **Zero Dependencies & Zero Regressions**: Maintain pure SVG rendering, Signals reactivity, 100% offline functionality, and full test suite passing (`npm test`, `npm run lint`, `npm run format:check`, `npm run e2e`, `npm run e2e:pwa`).

---

## 2. Context & Background

- **Coordinate System**: Pinch Hitter uses a normalized square coordinate system (Version 1) where `(0.0, 0.0)` is top-left, `(1.0, 1.0)` is bottom-right, and home plate is centered at `(0.50, 0.88)`.
- **Field Component**: `FieldComponent` (`src/app/shared/field.component.ts`) renders an SVG diamond (`viewBox="0 0 1000 1000"`) for both live capture (`PracticeComponent`) and analysis charts (`ReportsComponent`).
- **Domain Layer**: `src/app/data/domain.ts` contains pure functions for directional angles, coordinate boundary clamping, and distribution statistics.
- **Entitlement Gateway**: `EntitlementService` (`src/app/data/entitlement.service.ts`) provides method-agnostic authorization for `'custom_field_dimensions'`.
- **Current State**: Phase A (Accessibility & Dugout Ergonomics) is complete. Phase B (Pro Analytics) begins with Custom Fence Distances (TODO-B1) as documented in `docs/pro-tier-strategy.md` and `docs/ROADMAP.md`.

---

## 3. Architecture & Design

### 3.1 Domain Models (`src/app/data/models.ts`)

```typescript
export type FieldPresetKey = 'high_school' | 'college' | 'little_league' | 'softball' | 'custom';

export interface OutfieldFenceConfig {
  preset: FieldPresetKey;
  label: string;
  leftLineFeet: number;
  leftCenterFeet: number;
  centerFeet: number;
  rightCenterFeet: number;
  rightLineFeet: number;
  warningTrackDepthFeet: number;
}
```

Standard presets:

- **High School Varsity**: LF 315', LCF 365', CF 390', RCF 365', RF 315', track 15'
- **College / Pro Standard**: LF 330', LCF 375', CF 405', RCF 375', RF 330', track 15'
- **Little League / Youth**: LF 200', LCF 200', CF 200', RCF 200', RF 200', track 10'
- **Fastpitch Softball**: LF 220', LCF 220', CF 220', RCF 220', RF 220', track 10'

### 3.2 Trigonometry & Coordinate Transformation (`src/app/data/domain.ts`)

- Home Plate: $(X_0, Y_0) = (0.50, 0.88)$
- Angle $\theta$ relative to CF (0° is straight up center field, -45° is third base line, +45° is first base line):
  $$\theta = \text{atan2}(X - 0.50, -(Y - 0.88))$$
- Scale calibration: In standard SVG coordinate system, CF fence is at $Y = 0.08$, meaning radius $R = 0.80$ normalized units. For High School CF = 390', scale factor is $487.5$ ft / unit. Foul poles at 45° angle are at normalized radius $0.61659$ units = 315' ($510.87$ ft/unit). Cosine interpolation between key angles accurately matches the real geometry of baseball fields.
- Functions:
  - `calculateDistanceFeet(event: BallEvent): number`
  - `getFenceDistanceAtAngle(fenceConfig: OutfieldFenceConfig, angleRad: number): number`
  - `isOverTheFence(event: BallEvent, fenceConfig: OutfieldFenceConfig): boolean`
  - `isWarningTrack(event: BallEvent, fenceConfig: OutfieldFenceConfig): boolean`
  - `generateFenceSvgPath(fenceConfig: OutfieldFenceConfig): string`

### 3.3 SVG Diamond Component (`src/app/shared/field.component.ts`)

- Accepts `@Input() fenceConfig = input<OutfieldFenceConfig | null>(null)`.
- Renders:
  - Dynamic warning track band with textured or subtle fill.
  - Outfield fence wall arc with distinct stroke color and markers.
  - Distance indicator labels along the wall (LF, LCF, CF, RCF, RF).
  - All fence SVG overlay elements have `pointer-events: none` to guarantee capture isolation.

### 3.4 Reports Component (`src/app/reports/`)

- Outfield Wall preset selector pills (High School, College, Little League, Softball, Custom [PRO]).
- Dynamic metric summary chips:
  - Total Warning Track Fly Balls.
  - Estimated Home Runs over selected wall preset.
- Pro Gating preview banner: when non-pro coach taps "Custom...", present interactive demo preview explaining custom wall geometry.

### 3.5 Settings / Practice Preferences (`src/app/settings/`)

- Add "BALLPARK & OUTFIELD FENCE" card in Settings allowing coaches to choose their default team diamond preset and view distances summary.

---

## 4. Implementation Steps

### Phase 1: Pure Domain Mathematics & Presets

- [x] **Step 1.1**: Add `OutfieldFenceConfig`, `FieldPresetKey`, and `STANDARD_FENCE_PRESETS` to `src/app/data/models.ts`.
- [x] **Step 1.2**: Implement `getFenceDistanceAtAngle`, `calculateDistanceFeet`, `isOverTheFence`, `isWarningTrack`, and `generateFenceSvgPath` in `src/app/data/domain.ts`.
- [x] **Step 1.3**: Write comprehensive unit tests in `src/app/data/domain.spec.ts` verifying distance calculations across multiple angles and fence presets.

### Phase 2: SVG Diamond Visualization (`FieldComponent`)

- [x] **Step 2.1**: Update `FieldComponent` to accept `fenceConfig` input and render the SVG wall arc, warning track band, and distance text markers.
- [x] **Step 2.2**: Style fence elements for both `classic` (green turf) and `high_contrast` (obsidian slate) field themes, with print media styles for ink-friendly contrast.
- [x] **Step 2.3**: Verify tap capture in `PracticeComponent` remains unaffected by fence layers.

### Phase 3: Reports Component & Analytics Overlays

- [x] **Step 3.1**: Add `selectedFence` signal in `ReportsComponent` defaulting to `high_school`.
- [x] **Step 3.2**: Add fence preset selector buttons and warning-track / over-the-fence metric chips in `reports.component.html`.
- [x] **Step 3.3**: Hook Pro entitlement (`entitlement.canAccess('custom_field_dimensions')`) to gate custom wall distance sliders with an interactive demo preview.

### Phase 4: Persistence & Settings

- [x] **Step 4.1**: Store team default fence preference in `AppSettings` or `Team`.
- [x] **Step 4.2**: Add team home field dimension editor in `SettingsComponent`.

---

## 5. Verification Plan

- [x] **Unit Tests**: Run `npm test -- --watch=false` to verify all 85 unit and domain tests pass cleanly.
- [x] **Lint Analysis**: Run `npm run lint` with zero errors.
- [x] **Formatting**: Run `npm run format:check` with zero Prettier warnings.
- [x] **Build Validation**: Run `npm run build` and `npm run build:pages` verifying production bundle generation and budgets.
- [x] **E2E Smoke Suite**: Run `npm run e2e` across phone portrait, phone landscape, tablet, and desktop viewports (69 passed, 1 skipped).
- [x] **PWA Offline Suite**: Run `npm run e2e:pwa` verifying full offline operation.
- [x] **Visual Verification**: Inspected fence rendering across viewports and Classic/Slate themes.

---

## 6. Risks, Ceilings & Rollback

- **Ceiling / Known Limitation**: Coordinates capture 2D landing locations, not 3D radar apex trajectory. Ball clearance over fences is calculated using estimated 2D landing distance; balls with low trajectory (`ground-ball`, `dribbler`) are excluded from home run categorization.
- **Rollback Strategy**: All fence additions are pure additives to domain math and SVG overlays. If regressions arise, disabling the fence overlay flag in `FieldComponent` instantly restores the standard diamond without data loss.
