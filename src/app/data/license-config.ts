/**
 * Public licensing configuration (ADR-011). Everything here ships to every browser.
 * Never put Stripe secret/restricted keys or the Ed25519 private key in this file.
 */

/**
 * Master switch. `false` restores the pre-launch behaviour where every coach is Pro, without
 * touching stored licenses. Use only as an emergency rollback.
 */
export const LICENSING_ENFORCED = true;

/** Canonical production URL, used for activation links. Must end with `/`. */
export const APP_URL = 'https://oxford-comma-development.github.io/pinch-hitter/';

/**
 * Deployed `pinch-hitter-license` Cloud Run function, without a trailing slash, e.g.
 * `https://us-central1-<project>.cloudfunctions.net/pinch-hitter-license`. Empty until deployed:
 * the upgrade sheet then explains that checkout is not open yet, and unlock codes still work.
 */
export const LICENSE_FUNCTION_URL = '';

/**
 * Display price for the upgrade sheet, e.g. `'$39'`. `null` hides the line, and checkout shows the
 * price. Keep it in sync with the Stripe price.
 */
export const PRO_PRICE_LABEL: string | null = '$39';

/**
 * Ed25519 public keys by `kid`, raw 32 bytes base64url. Generate with `npm run license-keygen`.
 * Retired keys stay listed so codes they signed keep working.
 */
export const LICENSE_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  k1: 'ezoxGKF3DjOuCNLma56MazG9-xMtm3mbd5ldIfHm6lk',
};

/**
 * Trusted only when Angular runs in dev mode (`npm start`, unit tests, e2e). The matching private
 * key is committed in `e2e/fixtures/dev.private.jwk` so tests can mint codes. Production builds
 * never accept it.
 */
export const DEV_LICENSE_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  dev: '3N0w7aViqz2OIygGnT09H_c2EjUADlCgpyrbENpcH3g',
};

/** License ids of leaked codes, rejected despite a valid signature. */
export const REVOKED_LICENSES: readonly string[] = [];
