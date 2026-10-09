// Lists translation keys that no source file references, and keys that exist
// in one dictionary but not the other. Exits non-zero when the dictionaries
// disagree, so missing Spanish (or English) never ships silently.
//
// Usage: node scripts/check-i18n.mjs
//
// A key counts as used when its full text appears in a quoted string or
// template literal under src/app. Keys built at runtime from a prefix
// (`'pro.feature.' + id` or `` `proa.align.${id}` ``) count every key that
// starts with that prefix as used.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src/app/', import.meta.url);
const dictDir = new URL('i18n/dictionaries/', root);

function keysOf(file) {
  const text = readFileSync(new URL(file, dictDir), 'utf8');
  return new Set([...text.matchAll(/^\s*'([\w.-]+)':/gm)].map((match) => match[1]));
}

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'dictionaries' ? [] : sourceFiles(path);
    return /\.(ts|html)$/.test(entry.name) && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

const en = keysOf('en.ts');
const es = keysOf('es.ts');
const source = sourceFiles(root.pathname.replace(/^\/(\w:)/, '$1'))
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

const literals = new Set([...source.matchAll(/['"`]([\w.-]+)['"`]/g)].map((match) => match[1]));
const prefixes = [
  ...[...source.matchAll(/['"]([\w-]+(?:\.[\w-]+)*\.)['"]\s*\+/g)].map((match) => match[1]),
  ...[...source.matchAll(/`([\w-]+(?:\.[\w-]+)*\.)\$\{/g)].map((match) => match[1]),
];

// Plural forms (`key.one`, `key.other`) are looked up through their base key.
const baseKey = (key) => key.replace(/\.(zero|one|two|few|many|other)$/, '');
const unused = [...en].filter(
  (key) =>
    !literals.has(baseKey(key)) && !prefixes.some((prefix) => baseKey(key).startsWith(prefix)),
);
const missingEs = [...en].filter((key) => !es.has(key));
const missingEn = [...es].filter((key) => !en.has(key));

const report = (title, keys) => {
  console.log(`${title}: ${keys.length}`);
  for (const key of keys) console.log(`  ${key}`);
};
report('Unused keys', unused);
report('Missing from es.ts', missingEs);
report('Missing from en.ts', missingEn);

if (missingEs.length || missingEn.length) process.exitCode = 1;
