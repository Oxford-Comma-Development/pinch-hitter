import { Injectable, computed, isDevMode, signal } from '@angular/core';
import {
  DEV_LICENSE_PUBLIC_KEYS,
  LICENSE_PUBLIC_KEYS,
  LICENSING_ENFORCED,
  REVOKED_LICENSES,
} from './license-config';
import { UnlockCodeResult, verifyUnlockCode } from './license';
import { CoachRepository } from './repository';

export type FeatureId =
  | 'multi_team'
  | 'custom_field_dimensions'
  | 'multi_player_comparison'
  | 'advanced_time_series'
  | 'scout_pdf_export'
  | 'enriched_csv_metrics'
  | 'defensive_alignment';

export type CoachTier = 'free' | 'pro' | 'organization';

export interface LicenseStatus {
  tier: CoachTier;
  active: boolean;
  source: 'free' | 'unlock_code' | 'simulated' | 'unenforced';
  /** Always null for Lifetime Pro; kept for future organization licenses. */
  expiresAt: string | null;
  licenseeName?: string;
  licenseId?: string;
  /** The verified unlock code, so the coach can copy it to another device. */
  code?: string;
  activatedAt?: string;
}

const SIMULATOR_STORAGE_KEY = 'pinch_hitter_simulated_tier';

const PRO_FEATURES: readonly FeatureId[] = [
  'multi_team',
  'custom_field_dimensions',
  'multi_player_comparison',
  'advanced_time_series',
  'scout_pdf_export',
  'enriched_csv_metrics',
  'defensive_alignment',
];

export const FEATURE_DESCRIPTIONS: Record<FeatureId, { name: string; description: string }> = {
  multi_team: {
    name: 'Unlimited Teams & Seasons',
    description: 'Manage multiple school, travel, and showcase teams simultaneously.',
  },
  custom_field_dimensions: {
    name: 'Custom Outfield Dimensions',
    description:
      "Preset and custom fence distances (Little League 200', HS 320'–390', Softball 220').",
  },
  multi_player_comparison: {
    name: 'Multi-Hitter Comparative Charts',
    description: 'Overlay two hitters or switch-hitter splits on the same spray field.',
  },
  advanced_time_series: {
    name: 'Rolling Development Curves',
    description: 'Track 30/60-day moving averages of hard-hit rate and whiff percentages.',
  },
  scout_pdf_export: {
    name: 'Branded Scout Cards & Dossiers',
    description: 'Export one-page executive player evaluations with team crest and coach notes.',
  },
  enriched_csv_metrics: {
    name: 'Enriched Analytics Export',
    description:
      'Export flat CSVs with estimated distance, spray angle, direction, and field zone.',
  },
  defensive_alignment: {
    name: 'Defensive Alignments',
    description: 'See how standard, shifted, and deep alignments would cover a hitter’s spray.',
  },
};

/** Pro features that exist in the app today, in the order the upgrade sheet presents them. */
export const SHIPPED_PRO_FEATURES: readonly FeatureId[] = [
  'multi_player_comparison',
  'advanced_time_series',
  'defensive_alignment',
  'custom_field_dimensions',
  'multi_team',
  'enriched_csv_metrics',
  'scout_pdf_export',
];

const FREE_STATUS: LicenseStatus = { tier: 'free', active: true, source: 'free', expiresAt: null };

/**
 * Method-agnostic feature gateway (ADR-008), backed by offline-verified unlock codes (ADR-011).
 * The code is persisted in IndexedDB before any signal changes, so the UI never shows Pro that a
 * reload would take away.
 */
@Injectable({
  providedIn: 'root',
})
export class EntitlementService {
  private readonly repository = new CoachRepository();
  private readonly devMode = isDevMode();
  private readonly _license = signal<LicenseStatus>(
    LICENSING_ENFORCED ? FREE_STATUS : { ...FREE_STATUS, tier: 'pro', source: 'unenforced' },
  );
  private readonly _simulatedTier = signal<CoachTier | null>(this.loadSimulatedTier());
  private readonly _ready = signal(false);

  /** True once the stored license has been read and verified. */
  readonly ready = this._ready.asReadonly();

  /** Current license status, including any dev-mode simulation. */
  readonly status = computed<LicenseStatus>(() => {
    const simulated = this._simulatedTier();
    return simulated
      ? { tier: simulated, active: true, source: 'simulated', expiresAt: null }
      : this._license();
  });

  /** The real, verified license on this device, ignoring the dev simulator. */
  readonly license = this._license.asReadonly();

  readonly tier = computed(() => this.status().tier);

  readonly isPro = computed(() => this.tier() === 'pro' || this.tier() === 'organization');

  /** True when the developer tier simulator may be shown (never in production builds). */
  readonly simulatorAvailable = this.devMode;

  constructor() {
    void this.restore();
  }

  canAccess(feature: FeatureId): boolean {
    return this.isPro() && PRO_FEATURES.includes(feature);
  }

  /**
   * Verifies an unlock code (bare, inside a link, or pasted from an email) and, if valid, stores
   * it on this device. Nothing changes if verification or storage fails.
   */
  async activate(input: string): Promise<UnlockCodeResult> {
    const result = await verifyUnlockCode(input, this.trustedKeys(), REVOKED_LICENSES);
    if (!result.ok) return result;
    const activatedAt = new Date().toISOString();
    await this.repository.writeLicense({ code: result.code, activatedAt });
    this._license.set(this.toStatus(result, activatedAt));
    return result;
  }

  /** Removes the license from this device only. The coach can re-activate with the same code. */
  async deactivate(): Promise<void> {
    await this.repository.writeLicense(null);
    if (LICENSING_ENFORCED) this._license.set(FREE_STATUS);
  }

  /** Dev builds only: preview the app as another tier. `null` returns to the real license. */
  setSimulatedTier(tier: CoachTier | null): void {
    if (!this.devMode) return;
    this._simulatedTier.set(tier);
    try {
      if (tier) localStorage.setItem(SIMULATOR_STORAGE_KEY, tier);
      else localStorage.removeItem(SIMULATOR_STORAGE_KEY);
    } catch {
      // Storage may be disabled; the simulation still applies for this page view.
    }
  }

  private async restore(): Promise<void> {
    try {
      const stored = await this.repository.readLicense();
      if (stored && LICENSING_ENFORCED) {
        const result = await verifyUnlockCode(stored.code, this.trustedKeys(), REVOKED_LICENSES);
        if (result.ok) this._license.set(this.toStatus(result, stored.activatedAt));
      }
    } catch {
      // No IndexedDB (or unreadable): the coach stays on the free tier and can activate again.
    } finally {
      this._ready.set(true);
    }
  }

  private toStatus(result: UnlockCodeResult & { ok: true }, activatedAt: string): LicenseStatus {
    return {
      tier: result.payload.tier,
      active: true,
      source: 'unlock_code',
      expiresAt: null,
      licenseeName: result.payload.name,
      licenseId: result.payload.lic,
      code: result.code,
      activatedAt,
    };
  }

  private trustedKeys(): Readonly<Record<string, string>> {
    return this.devMode
      ? { ...LICENSE_PUBLIC_KEYS, ...DEV_LICENSE_PUBLIC_KEYS }
      : LICENSE_PUBLIC_KEYS;
  }

  private loadSimulatedTier(): CoachTier | null {
    if (!this.devMode) return null;
    try {
      const stored = localStorage.getItem(SIMULATOR_STORAGE_KEY);
      return stored === 'free' || stored === 'pro' || stored === 'organization' ? stored : null;
    } catch {
      return null;
    }
  }
}
