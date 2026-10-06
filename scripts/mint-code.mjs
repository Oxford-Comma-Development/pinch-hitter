// Mints a Pinch Hitter Pro unlock code by hand: comp licenses, conference demos, support re-issues.
//
//   npm run mint-code -- --name "Coach Dana R." [--lic comp-2026-dana] [--kid k1] [--key path/to/k1.private.jwk]
//
// Prints the code and an activation link. The link carries the code in the URL fragment, so it is
// never sent to the static host.
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { encodeUnlockCode } from '../src/app/data/license.ts';
import {
  APP_URL,
  DEV_LICENSE_PUBLIC_KEYS,
  LICENSE_PUBLIC_KEYS,
} from '../src/app/data/license-config.ts';

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    lic: { type: 'string' },
    kid: { type: 'string', default: 'k1' },
    key: { type: 'string' },
  },
});

if (values.name === undefined) {
  console.error(
    'Usage: npm run mint-code -- --name "Coach Dana R." [--lic id] [--kid k1] [--key path]',
  );
  process.exit(1);
}

const keyDir = process.env.PH_LICENSE_KEY_DIR ?? join(homedir(), '.pinch-hitter-license');
const keyPath = values.key ?? join(keyDir, `${values.kid}.private.jwk`);
const { kid: _kid, ...jwk } = JSON.parse(readFileSync(keyPath, 'utf8'));
const privateKey = await crypto.subtle.importKey('jwk', jwk, { name: 'Ed25519' }, false, ['sign']);

if (Object.hasOwn(DEV_LICENSE_PUBLIC_KEYS, values.kid)) {
  console.warn(`Note: kid "${values.kid}" is trusted only by dev builds (npm start, tests).\n`);
} else if (!Object.hasOwn(LICENSE_PUBLIC_KEYS, values.kid)) {
  console.warn(
    `Warning: kid "${values.kid}" is not in LICENSE_PUBLIC_KEYS; the app will reject this code.\n`,
  );
}

const code = await encodeUnlockCode(
  {
    v: 1,
    kid: values.kid,
    lic: values.lic ?? `comp-${crypto.randomUUID()}`,
    tier: 'pro',
    name: values.name.trim(),
    iat: Math.floor(Date.now() / 1000),
  },
  privateKey,
);

console.log(code);
console.log(`\n${APP_URL}activate#code=${code}`);
