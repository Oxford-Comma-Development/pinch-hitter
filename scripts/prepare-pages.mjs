import { createHash } from 'node:crypto';
import {
  existsSync,
  copyFileSync,
  readdirSync,
  readFileSync,
  statSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { writeGuides } from './build-guides.mjs';

// Locate the browser build directory dynamically to ensure complete repo-name independence
function findBrowserDir(baseDir) {
  const primaryCandidate = resolve(baseDir, 'dist/browser');
  if (existsSync(join(primaryCandidate, 'index.html'))) {
    return primaryCandidate;
  }

  const distDir = resolve(baseDir, 'dist');
  if (existsSync(distDir)) {
    const entries = readdirSync(distDir);
    for (const entry of entries) {
      const candidate = join(distDir, entry, 'browser');
      if (
        existsSync(candidate) &&
        statSync(candidate).isDirectory() &&
        existsSync(join(candidate, 'index.html'))
      ) {
        return candidate;
      }
    }
  }

  return null;
}

const rootDir = process.cwd();
const browserDir = findBrowserDir(rootDir);

if (!browserDir) {
  console.error('Error: Could not locate browser build output directory containing index.html.');
  process.exit(1);
}

const indexPath = join(browserDir, 'index.html');
const notFoundPath = join(browserDir, '404.html');

// Absolute URLs for search and link previews. Only known at deploy time, so forks and local
// builds without SITE_URL keep the relative, host-independent index.html untouched.
const siteUrl = process.env.SITE_URL ? process.env.SITE_URL.replace(/\/*$/, '/') : null;

function replaceOnce(html, search, replacement, label) {
  if (!html.includes(search)) {
    console.error(`Error: could not find ${label} in index.html while adding SEO metadata.`);
    process.exit(1);
  }
  return html.replace(search, replacement);
}

function withPageUrl(html, pageUrl) {
  html = replaceOnce(
    html,
    '</head>',
    `<link rel="canonical" href="${pageUrl}"><meta property="og:url" content="${pageUrl}"></head>`,
    '</head>',
  );
  html = replaceOnce(
    html,
    'content="og-image.png"',
    `content="${siteUrl}og-image.png"`,
    'og:image',
  );
  return replaceOnce(
    html,
    '"name": "Pinch Hitter",',
    `"name": "Pinch Hitter", "url": "${siteUrl}",`,
    'JSON-LD name',
  );
}

function withPageText(html, title, description) {
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*"/, `$1${description}"`);
  html = html.replace(/(<meta\s+property="og:title"\s+content=")[^"]*"/, `$1${title}"`);
  return html.replace(/(<meta\s+property="og:description"\s+content=")[^"]*"/, `$1${description}"`);
}

const guidePages = writeGuides(browserDir, siteUrl);
console.log('✓ Generated static coaching guides: guides/index.html and one page per guide');

let privacyHtml = readFileSync(indexPath, 'utf8');
if (siteUrl) {
  const indexHtml = withPageUrl(readFileSync(indexPath, 'utf8'), siteUrl);
  writeFileSync(indexPath, indexHtml);

  // index.html changed after the build, so the service worker's integrity hash must follow.
  const ngswPath = join(browserDir, 'ngsw.json');
  if (existsSync(ngswPath)) {
    const ngsw = JSON.parse(readFileSync(ngswPath, 'utf8'));
    ngsw.hashTable[ngsw.index] = createHash('sha1').update(indexHtml).digest('hex');
    writeFileSync(ngswPath, JSON.stringify(ngsw, null, 2));
  }

  privacyHtml = withPageText(
    withPageUrl(privacyHtml, `${siteUrl}privacy/`),
    'Privacy Policy · Pinch Hitter',
    'Pinch Hitter keeps every team, player, and practice on your device. No account, no analytics, and no coaching data ever leaves your phone.',
  );

  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    { loc: siteUrl, lastmod: today },
    { loc: `${siteUrl}privacy/`, lastmod: today },
    ...guidePages,
  ]
    .map(({ loc, lastmod }) => `  <url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
    .join('\n');
  writeFileSync(
    join(browserDir, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  );
  // Crawlers read robots.txt only at a domain root, so a project subpath skips it.
  if (new URL(siteUrl).pathname === '/') {
    writeFileSync(
      join(browserDir, 'robots.txt'),
      `User-agent: *\nAllow: /\nSitemap: ${siteUrl}sitemap.xml\n`,
    );
  }
  console.log(`✓ Added canonical, Open Graph, and sitemap metadata for ${siteUrl}`);
} else {
  console.log('ℹ SITE_URL not set: skipping canonical URLs and sitemap');
}

copyFileSync(indexPath, notFoundPath);
console.log(`✓ Generated SPA fallback: copied index.html -> ${notFoundPath}`);

const privacyDir = join(browserDir, 'privacy');
mkdirSync(privacyDir, { recursive: true });
writeFileSync(join(privacyDir, 'index.html'), privacyHtml);
writeFileSync(join(browserDir, 'privacy.html'), privacyHtml);
console.log(`✓ Generated static privacy routes: privacy/index.html & privacy.html`);

const manifestPath = join(browserDir, 'manifest.webmanifest');
if (existsSync(manifestPath)) {
  console.log('✓ Found Web App Manifest: manifest.webmanifest');
} else {
  console.warn('⚠ Warning: manifest.webmanifest not found in browser directory');
}

const swPath = join(browserDir, 'ngsw.json');
if (existsSync(swPath)) {
  console.log('✓ Found Angular Service Worker configuration: ngsw.json');
} else {
  console.warn(
    '⚠ Warning: ngsw.json not found in browser directory (production build may not have been run with service worker)',
  );
}
