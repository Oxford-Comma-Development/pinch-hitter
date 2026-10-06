import { beforeAll, describe, expect, it } from 'vitest';
import {
  UnlockCodePayload,
  bytesToBase64Url,
  encodeUnlockCode,
  extractUnlockCode,
  verifyUnlockCode,
} from './license';

describe('unlock codes', () => {
  let privateKey: CryptoKey;
  let otherPrivateKey: CryptoKey;
  let publicKeys: Record<string, string>;

  const payload: UnlockCodePayload = {
    v: 1,
    kid: 'test',
    lic: 'comp-0001',
    tier: 'pro',
    name: 'Coach Dana R.',
    iat: 1_791_000_000,
  };

  async function rawPublicKey(key: CryptoKey): Promise<string> {
    return bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', key)));
  }

  beforeAll(async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    const other = (await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair;
    privateKey = pair.privateKey;
    otherPrivateKey = other.privateKey;
    publicKeys = { test: await rawPublicKey(pair.publicKey) };
  });

  it('round-trips a signed code', async () => {
    const code = await encodeUnlockCode(payload, privateKey);
    expect(code.startsWith('PH1.')).toBe(true);

    const result = await verifyUnlockCode(code, publicKeys);
    expect(result).toEqual({ ok: true, code, payload });
  });

  it('keeps non-ASCII licensee names intact', async () => {
    const accented = { ...payload, name: 'Entrenador José Núñez' };
    const result = await verifyUnlockCode(await encodeUnlockCode(accented, privateKey), publicKeys);
    expect(result.ok && result.payload.name).toBe('Entrenador José Núñez');
  });

  it('finds the code inside an activation link or a line-wrapped email body', async () => {
    const code = await encodeUnlockCode(payload, privateKey);
    const link = `https://example.com/pinch-hitter/activate#code=${code}`;
    const wrapped = `Your code:\n  ${code.slice(0, 40)}\n${code.slice(40)}\nThanks!`;

    expect(extractUnlockCode(link)).toBe(code);
    expect(extractUnlockCode(wrapped)).toBe(code);
    expect((await verifyUnlockCode(wrapped, publicKeys)).ok).toBe(true);
  });

  it('reports not_found when nothing resembling a code was pasted', async () => {
    expect(await verifyUnlockCode('hello coach', publicKeys)).toEqual({
      ok: false,
      reason: 'not_found',
    });
  });

  it('rejects a payload edited after signing', async () => {
    const code = await encodeUnlockCode(payload, privateKey);
    const [prefix, , signature] = code.split('.');
    const forgedPayload = bytesToBase64Url(
      new TextEncoder().encode(JSON.stringify({ ...payload, name: 'Someone Else' })),
    );

    const result = await verifyUnlockCode(`${prefix}.${forgedPayload}.${signature}`, publicKeys);
    expect(result).toEqual({ ok: false, reason: 'bad_signature' });
  });

  it('rejects a code signed by a different key that claims a known kid', async () => {
    const code = await encodeUnlockCode(payload, otherPrivateKey);
    expect(await verifyUnlockCode(code, publicKeys)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rejects a code whose kid is not bundled', async () => {
    const code = await encodeUnlockCode({ ...payload, kid: 'retired' }, privateKey);
    expect(await verifyUnlockCode(code, publicKeys)).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
  });

  it('does not resolve kid through the prototype chain', async () => {
    const code = await encodeUnlockCode({ ...payload, kid: 'toString' }, privateKey);
    expect(await verifyUnlockCode(code, publicKeys)).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
  });

  it('rejects deny-listed licenses even with a valid signature', async () => {
    const code = await encodeUnlockCode(payload, privateKey);
    expect(await verifyUnlockCode(code, publicKeys, ['comp-0001'])).toEqual({
      ok: false,
      reason: 'revoked',
    });
  });

  it('rejects structurally invalid payloads', async () => {
    const garbage = bytesToBase64Url(new TextEncoder().encode('{"v":2}'));
    const signature = 'A'.repeat(86);
    expect(await verifyUnlockCode(`PH1.${garbage}.${signature}`, publicKeys)).toEqual({
      ok: false,
      reason: 'malformed',
    });
    expect(await verifyUnlockCode(`PH1.not-json.${signature}`, publicKeys)).toEqual({
      ok: false,
      reason: 'malformed',
    });
  });

  it('refuses to sign an invalid payload', async () => {
    await expect(
      encodeUnlockCode({ ...payload, name: 'x'.repeat(81) }, privateKey),
    ).rejects.toThrow('Invalid unlock code payload');
  });
});
