/**
 * Public licensing configuration (ADR-011). Everything here ships to every browser.
 * Never put Stripe secret/restricted keys or the Ed25519 private key in this file.
 */

/** Canonical production URL, used for activation links. Must end with `/`. */
export const APP_URL = 'https://oxford-comma-development.github.io/pinch-hitter/';

/**
 * Ed25519 public keys by `kid`, raw 32 bytes base64url. Generate with `npm run license-keygen`.
 * Retired keys stay listed so codes they signed keep working.
 */
export const LICENSE_PUBLIC_KEYS: Readonly<Record<string, string>> = {
  k1: 'ezoxGKF3DjOuCNLma56MazG9-xMtm3mbd5ldIfHm6lk',
};

/** License ids of leaked codes, rejected despite a valid signature. */
export const REVOKED_LICENSES: readonly string[] = [];
