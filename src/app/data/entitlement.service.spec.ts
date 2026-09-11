import { describe, it, expect, beforeEach } from 'vitest';
import { EntitlementService, FeatureId } from './entitlement.service';

describe('EntitlementService', () => {
  let service: EntitlementService;

  beforeEach(() => {
    localStorage.clear();
    service = new EntitlementService();
  });

  it('initializes in Pro mode by default when unconfigured', () => {
    expect(service.tier()).toBe('pro');
    expect(service.isPro()).toBe(true);
    expect(service.status().source).toBe('simulated');
  });

  it('allows access to all Pro features when tier is pro', () => {
    const features: FeatureId[] = [
      'multi_team',
      'custom_field_dimensions',
      'multi_player_comparison',
      'advanced_time_series',
      'scout_pdf_export',
      'enriched_csv_metrics',
    ];

    for (const feature of features) {
      expect(service.canAccess(feature)).toBe(true);
    }
  });

  it('restricts Pro features when switched to free tier', () => {
    service.setSimulatedTier('free');

    expect(service.tier()).toBe('free');
    expect(service.isPro()).toBe(false);

    expect(service.canAccess('custom_field_dimensions')).toBe(false);
    expect(service.canAccess('multi_team')).toBe(false);
    expect(service.canAccess('multi_player_comparison')).toBe(false);
  });

  it('persists tier choice across service re-instantiations via localStorage', () => {
    service.setSimulatedTier('free');

    // Create a new instance simulating a page reload
    const reloadedService = new EntitlementService();
    expect(reloadedService.tier()).toBe('free');
    expect(reloadedService.isPro()).toBe(false);
    expect(reloadedService.canAccess('multi_team')).toBe(false);
  });

  it('resets to pro default via resetToDefault()', () => {
    service.setSimulatedTier('free');
    expect(service.isPro()).toBe(false);

    service.resetToDefault();
    expect(service.tier()).toBe('pro');
    expect(service.isPro()).toBe(true);
  });
});
