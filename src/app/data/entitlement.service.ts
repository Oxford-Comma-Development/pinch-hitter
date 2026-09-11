import { Injectable, computed, signal } from '@angular/core';

export type FeatureId =
  | 'multi_team'
  | 'custom_field_dimensions'
  | 'multi_player_comparison'
  | 'advanced_time_series'
  | 'scout_pdf_export'
  | 'enriched_csv_metrics';

export type CoachTier = 'free' | 'pro' | 'organization';

export interface LicenseStatus {
  tier: CoachTier;
  active: boolean;
  source: 'simulated' | 'stripe' | 'license_key' | 'organization';
  expiresAt: string | null;
  licenseeEmail?: string;
}

const STORAGE_KEY = 'pinch_hitter_simulated_tier';

const PRO_FEATURES: readonly FeatureId[] = [
  'multi_team',
  'custom_field_dimensions',
  'multi_player_comparison',
  'advanced_time_series',
  'scout_pdf_export',
  'enriched_csv_metrics',
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
      'Export flat CSVs with derived launch angles, exit bands, and directional vectors.',
  },
};

@Injectable({
  providedIn: 'root',
})
export class EntitlementService {
  private readonly _status = signal<LicenseStatus>(this.loadInitialStatus());

  /** Current license status snapshot */
  readonly status = this._status.asReadonly();

  /** Current active tier (e.g. 'free' or 'pro') */
  readonly tier = computed(() => this._status().tier);

  /** True if the active tier grants Pro access */
  readonly isPro = computed(
    () => this._status().tier === 'pro' || this._status().tier === 'organization',
  );

  /** Check if a specific feature is enabled under the current entitlement */
  canAccess(feature: FeatureId): boolean {
    if (this.isPro()) {
      return PRO_FEATURES.includes(feature);
    }
    return false;
  }

  /**
   * Switch the simulated tier for development, demo, and preview purposes.
   * Persists across page reloads in browser localStorage.
   */
  setSimulatedTier(tier: CoachTier): void {
    const nextStatus: LicenseStatus = {
      tier,
      active: true,
      source: 'simulated',
      expiresAt: null,
      licenseeEmail: 'coach@example.com',
    };
    this._status.set(nextStatus);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, tier);
      }
    } catch {
      // Ignore storage write errors (e.g. storage disabled or private browsing)
    }
  }

  /** Reset the simulated tier back to the default Pro (unlocked) state */
  resetToDefault(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
    this._status.set({
      tier: 'pro',
      active: true,
      source: 'simulated',
      expiresAt: null,
      licenseeEmail: 'coach@example.com',
    });
  }

  private loadInitialStatus(): LicenseStatus {
    let savedTier: CoachTier = 'pro';
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'free' || stored === 'pro' || stored === 'organization') {
          savedTier = stored;
        }
      }
    } catch {
      // Default to pro on storage access failure
    }

    return {
      tier: savedTier,
      active: true,
      source: 'simulated',
      expiresAt: null,
      licenseeEmail: 'coach@example.com',
    };
  }
}
