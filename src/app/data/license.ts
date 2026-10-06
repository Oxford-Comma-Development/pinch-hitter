/**
 * Pinch Hitter Pro unlock codes (ADR-011).
 *
 * Format: `PH1.<base64url(payload JSON)>.<base64url(Ed25519 signature)>`
 * The signature covers the ASCII bytes of `PH1.<payload segment>`.
 *
 * Pure module with no Angular imports: it is shared verbatim by the app (verify) and by
 * `scripts/mint-code.mjs` (sign), which Node runs directly via type stripping. Keep the syntax
 * erasable (no enums, no parameter properties).
 */

export const UNLOCK_CODE_PREFIX = 'PH1';

export interface UnlockCodePayload {
  /** Format version. */
  v: 1;
  /** Signing key id, selects the public key used for verification (enables rotation). */
  kid: string;
  /** Opaque license id, e.g. `stripe-<hash>` or `comp-<uuid>`. Used for deny-listing leaked codes. */
  lic: string;
  tier: 'pro';
  /** Licensee display name shown in Settings ("Licensed to …"). May be empty. */
  name: string;
  /** Issued-at, unix seconds. */
  iat: number;
}

export type UnlockCodeFailure =
  'not_found' | 'malformed' | 'unknown_key' | 'bad_signature' | 'revoked' | 'unsupported';

export type UnlockCodeResult =
  { ok: true; code: string; payload: UnlockCodePayload } | { ok: false; reason: UnlockCodeFailure };

// An Ed25519 signature is 64 bytes, always 86 unpadded base64url characters. The fixed length
// lets the code be recovered even when surrounding text runs into it once whitespace is removed.
const CODE_PATTERN = /PH1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{86}/;
const MAX_NAME_LENGTH = 80;
const MAX_LIC_LENGTH = 64;

/**
 * Finds an unlock code inside whatever the coach pasted: the bare code, an activation link,
 * or an email body where the code was wrapped across lines.
 */
export function extractUnlockCode(input: string): string | null {
  const match = input.replace(/\s+/g, '').match(CODE_PATTERN);
  return match ? match[0] : null;
}

/**
 * Verifies an unlock code offline against bundled public keys.
 *
 * @param publicKeys map of `kid` to raw 32-byte Ed25519 public key, base64url encoded
 * @param revokedLicenses license ids that must be rejected even with a valid signature
 */
export async function verifyUnlockCode(
  input: string,
  publicKeys: Readonly<Record<string, string>>,
  revokedLicenses: readonly string[] = [],
): Promise<UnlockCodeResult> {
  const code = extractUnlockCode(input);
  if (!code) {
    return { ok: false, reason: 'not_found' };
  }

  const [, payloadSegment, signatureSegment] = code.split('.');
  const payload = parsePayload(payloadSegment);
  if (!payload) {
    return { ok: false, reason: 'malformed' };
  }

  const publicKey = Object.hasOwn(publicKeys, payload.kid) ? publicKeys[payload.kid] : undefined;
  if (!publicKey) {
    return { ok: false, reason: 'unknown_key' };
  }

  let valid: boolean;
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      base64UrlToBytes(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify'],
    );
    valid = await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      base64UrlToBytes(signatureSegment),
      new TextEncoder().encode(`${UNLOCK_CODE_PREFIX}.${payloadSegment}`),
    );
  } catch (error) {
    // Browsers without Ed25519 in Web Crypto (pre-2025 Chromium, iOS < 17) throw NotSupportedError.
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      return { ok: false, reason: 'unsupported' };
    }
    return { ok: false, reason: 'malformed' };
  }

  if (!valid) {
    return { ok: false, reason: 'bad_signature' };
  }
  if (revokedLicenses.includes(payload.lic)) {
    return { ok: false, reason: 'revoked' };
  }
  return { ok: true, code, payload };
}

/** Signs a payload into an unlock code. Used by the mint script and tests, never by the app. */
export async function encodeUnlockCode(
  payload: UnlockCodePayload,
  privateKey: CryptoKey,
): Promise<string> {
  if (!isValidPayload(payload)) {
    throw new Error('Invalid unlock code payload');
  }
  const payloadSegment = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const signingInput = `${UNLOCK_CODE_PREFIX}.${payloadSegment}`;
  const signature = await crypto.subtle.sign(
    { name: 'Ed25519' },
    privateKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

function parsePayload(segment: string): UnlockCodePayload | null {
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment)));
    return isValidPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isValidPayload(value: unknown): value is UnlockCodePayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const p = value as Record<string, unknown>;
  return (
    p['v'] === 1 &&
    typeof p['kid'] === 'string' &&
    p['kid'].length > 0 &&
    typeof p['lic'] === 'string' &&
    p['lic'].length > 0 &&
    p['lic'].length <= MAX_LIC_LENGTH &&
    p['tier'] === 'pro' &&
    typeof p['name'] === 'string' &&
    p['name'].length <= MAX_NAME_LENGTH &&
    typeof p['iat'] === 'number' &&
    Number.isInteger(p['iat']) &&
    p['iat'] > 0
  );
}

export function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
