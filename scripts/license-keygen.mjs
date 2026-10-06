// Generates an Ed25519 signing keypair for Pinch Hitter Pro unlock codes (ADR-011).
//
//   node scripts/license-keygen.mjs [kid]
//
// The private key is written OUTSIDE the repository (default ~/.pinch-hitter-license/<kid>.private.jwk)
// and is never printed. Store it in GCP Secret Manager and keep an offline backup. The public key
// is printed for src/app/data/license-config.ts.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { bytesToBase64Url } from '../src/app/data/license.ts';

const kid = process.argv[2] ?? 'k1';
if (!/^[a-z0-9-]{1,16}$/.test(kid)) {
  console.error('kid must be 1-16 lowercase letters, digits, or dashes');
  process.exit(1);
}

const dir = process.env.PH_LICENSE_KEY_DIR ?? join(homedir(), '.pinch-hitter-license');
const privatePath = join(dir, `${kid}.private.jwk`);
if (existsSync(privatePath)) {
  console.error(`Refusing to overwrite existing key: ${privatePath}`);
  process.exit(1);
}

const { privateKey, publicKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, [
  'sign',
  'verify',
]);
const jwk = { ...(await crypto.subtle.exportKey('jwk', privateKey)), kid };
const rawPublic = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', publicKey)));

mkdirSync(dir, { recursive: true });
writeFileSync(privatePath, JSON.stringify(jwk, null, 2) + '\n', { flag: 'wx', mode: 0o600 });

console.log(`Private key written to ${privatePath}`);
console.log('Back it up offline and add it to GCP Secret Manager. Never commit it.\n');
console.log('Add to LICENSE_PUBLIC_KEYS in src/app/data/license-config.ts:');
console.log(`  '${kid}': '${rawPublic}',`);
