import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EntitlementService, FeatureId } from './entitlement.service';
import { UnlockCodePayload, encodeUnlockCode } from './license';
import { CoachRepository, StoredLicense } from './repository';

// Dev-only key (also in e2e/fixtures/dev.private.jwk). Trusted only in Angular dev mode.
const DEV_PRIVATE_JWK: JsonWebKey = {
  kty: 'OKP',
  crv: 'Ed25519',
  d: 'Tb0WzytbOabbJn3FscgvCqHtMEXTLFpCT00Y2i6hv74',
  x: '3N0w7aViqz2OIygGnT09H_c2EjUADlCgpyrbENpcH3g',
};

const ALL_FEATURES: FeatureId[] = [
  'multi_team',
  'custom_field_dimensions',
  'multi_player_comparison',
  'advanced_time_series',
  'scout_pdf_export',
  'enriched_csv_metrics',
  'defensive_alignment',
];

async function devCode(overrides: Partial<UnlockCodePayload> = {}): Promise<string> {
  const key = await crypto.subtle.importKey('jwk', DEV_PRIVATE_JWK, { name: 'Ed25519' }, false, [
    'sign',
  ]);
  return encodeUnlockCode(
    {
      v: 1,
      kid: 'dev',
      lic: 'comp-test',
      tier: 'pro',
      name: 'Coach Dana R.',
      iat: 1,
      ...overrides,
    },
    key,
  );
}

describe('EntitlementService', () => {
  let stored: StoredLicense | null;
  let failWrites: boolean;

  async function freshService(): Promise<EntitlementService> {
    const service = new EntitlementService();
    await vi.waitFor(() => expect(service.ready()).toBe(true));
    return service;
  }

  beforeEach(() => {
    stored = null;
    failWrites = false;
    vi.spyOn(CoachRepository.prototype, 'readLicense').mockImplementation(async () => stored);
    vi.spyOn(CoachRepository.prototype, 'writeLicense').mockImplementation(async (license) => {
      if (failWrites) throw new Error('QuotaExceededError');
      stored = license ? { ...license, id: 'license' } : null;
    });
    try {
      localStorage.removeItem('pinch_hitter_simulated_tier');
    } catch {
      // ignore
    }
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts every coach on the free tier', async () => {
    const service = await freshService();
    expect(service.tier()).toBe('free');
    expect(service.isPro()).toBe(false);
    expect(service.status().source).toBe('free');
    for (const feature of ALL_FEATURES) expect(service.canAccess(feature)).toBe(false);
  });

  it('unlocks every Pro feature with a valid code and records the licensee', async () => {
    const service = await freshService();
    const code = await devCode();

    const result = await service.activate(`Your link: https://x.test/activate#code=${code}`);

    expect(result.ok).toBe(true);
    expect(service.isPro()).toBe(true);
    expect(service.status()).toMatchObject({
      source: 'unlock_code',
      licenseeName: 'Coach Dana R.',
      licenseId: 'comp-test',
      code,
    });
    for (const feature of ALL_FEATURES) expect(service.canAccess(feature)).toBe(true);
  });

  it('keeps Pro after a reload by re-verifying the stored code', async () => {
    await (await freshService()).activate(await devCode());

    const reloaded = await freshService();
    expect(reloaded.isPro()).toBe(true);
    expect(reloaded.status().licenseeName).toBe('Coach Dana R.');
  });

  it('ignores a stored code that no longer verifies', async () => {
    stored = { id: 'license', code: (await devCode()).replace(/.$/, 'A'), activatedAt: 'x' };
    const service = await freshService();
    expect(service.isPro()).toBe(false);
  });

  it('rejects invalid codes without changing anything', async () => {
    const service = await freshService();
    const result = await service.activate('not a code');
    expect(result).toEqual({ ok: false, reason: 'not_found' });
    expect(service.isPro()).toBe(false);
    expect(stored).toBeNull();
  });

  it('stays free if the license cannot be saved', async () => {
    const service = await freshService();
    failWrites = true;
    await expect(service.activate(await devCode())).rejects.toThrow();
    expect(service.isPro()).toBe(false);
  });

  it('removes the license from this device', async () => {
    const service = await freshService();
    await service.activate(await devCode());
    await service.deactivate();
    expect(service.isPro()).toBe(false);
    expect(stored).toBeNull();
  });

  it('lets developers simulate a tier without touching the real license', async () => {
    const service = await freshService();
    expect(service.simulatorAvailable).toBe(true);

    service.setSimulatedTier('pro');
    expect(service.isPro()).toBe(true);
    expect(service.status().source).toBe('simulated');
    expect(service.license().source).toBe('free');

    service.setSimulatedTier(null);
    expect(service.isPro()).toBe(false);
  });
});
