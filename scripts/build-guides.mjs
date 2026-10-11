import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { guides } from '../guides/guides.mjs';

// Renders the coaching guides in guides/ as static pages so they load without Angular and
// crawlers never need JavaScript. Every link is relative, so the pages work under any base href.
// ngsw-config.json excludes guides/ from navigation handling, or an installed app would answer
// these URLs with index.html.

const sourceDir = resolve(import.meta.dirname, '../guides');
const publisher = { '@type': 'Organization', name: 'Oxford Comma Development LLC' };

function escapeHtml(text) {
  return text.replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

function jsonLd(data) {
  return JSON.stringify(data, null, 2).replace(/</g, '\\u003c');
}

const styles = `
  :root {
    color-scheme: light;
    --paper: #f6f5ee;
    --surface: #fffef9;
    --ink: #172f2b;
    --muted: #52635b;
    --green: #235d42;
    --orange: #b54b23;
    --line: #d8ddd2;
    --cream: #ecebdf;
    --focus-ring: 3px solid #b54b23;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--ink);
    background: var(--paper);
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--paper); line-height: 1.6; overflow-wrap: break-word; }
  a { color: var(--green); }
  a:focus-visible { outline: var(--focus-ring); outline-offset: 2px; border-radius: 4px; }
  .wrap {
    max-width: 44rem;
    margin: 0 auto;
    padding: 0 max(16px, env(safe-area-inset-right)) 0 max(16px, env(safe-area-inset-left));
  }
  header { padding-top: max(12px, env(safe-area-inset-top)); border-bottom: 1px solid var(--line); background: var(--surface); }
  header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
  .brand, .nav-link {
    min-height: 44px; display: inline-flex; align-items: center; gap: 10px;
    color: var(--ink); font-weight: 800; text-decoration: none;
  }
  .nav-link { color: var(--green); font-weight: 700; }
  .brand img { width: 32px; height: 32px; }
  main { padding: 12px 0 8px; }
  .eyebrow { margin: 0; color: var(--orange); font-size: 0.8rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
  .eyebrow a { display: inline-flex; align-items: center; min-height: 44px; }
  h1 { margin: 0 0 16px; font-size: clamp(1.9rem, 7vw, 2.6rem); line-height: 1.1; letter-spacing: -0.02em; }
  h2 { margin: 32px 0 8px; font-size: 1.3rem; line-height: 1.25; }
  p, li { font-size: 1.05rem; }
  li + li { margin-top: 6px; }
  ul, ol { padding-left: 1.4rem; }
  .lede { font-size: 1.2rem; color: var(--muted); }
  figure { margin: 24px 0; padding: 12px; background: var(--surface); border: 1px solid var(--line); border-radius: 12px; }
  figcaption { margin-top: 8px; color: var(--muted); font-size: 0.95rem; }
  .field-figure { display: block; width: 100%; max-width: 420px; height: auto; margin: 0 auto; }
  .field-figure .grass { fill: #dfe8d6; }
  .field-figure .cone { fill: #c9d9bd; }
  .field-figure .dirt { fill: #e8d9c0; }
  .field-figure .line { fill: none; stroke: #fff; stroke-width: 0.8; }
  .field-figure .label { font-size: 4px; font-weight: 700; fill: var(--ink); }
  .field-figure .dot { fill: #0072b2; }
  .field-figure .dot-alt { fill: #d55e00; }
  .cta {
    margin: 40px 0 24px; padding: 20px; border-radius: 14px;
    background: var(--ink); color: var(--paper);
  }
  .cta h2 { margin-top: 0; }
  .cta p { margin: 0 0 16px; }
  .button {
    min-height: 44px; display: inline-flex; align-items: center; justify-content: center;
    padding: 10px 18px; border-radius: 9px; border: 1px solid var(--green);
    background: var(--green); color: #fff; font-weight: 800; text-decoration: none;
  }
  .cta .button { background: var(--paper); color: var(--ink); border-color: var(--paper); }
  .cta .button:focus-visible { outline-color: var(--paper); }
  .guide-list { list-style: none; padding: 0; margin: 16px 0 0; display: grid; gap: 12px; }
  .guide-list li { margin: 0; }
  .guide-list a {
    display: block; min-height: 44px; padding: 14px 16px; border-radius: 12px;
    background: var(--surface); border: 1px solid var(--line); color: var(--ink); text-decoration: none;
  }
  .guide-list a:hover { border-color: var(--green); }
  .guide-list strong { display: block; color: var(--green); font-size: 1.1rem; }
  .guide-list span { color: var(--muted); font-size: 0.98rem; }
  footer { padding: 16px 0 max(24px, env(safe-area-inset-bottom)); border-top: 1px solid var(--line); color: var(--muted); font-size: 0.95rem; }
  footer .wrap { display: flex; flex-wrap: wrap; gap: 4px 20px; align-items: center; }
  footer a { min-height: 44px; display: inline-flex; align-items: center; }
`;

function page({ prefix, siteUrl, pageUrl, title, description, jsonLdData, ogType, main }) {
  const fullTitle = `${title} · Pinch Hitter`;
  const image = siteUrl ? `${siteUrl}og-image.png` : null;
  const urlTags = pageUrl
    ? `\n    <link rel="canonical" href="${pageUrl}" />\n    <meta property="og:url" content="${pageUrl}" />`
    : '';
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(fullTitle)}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#172f2b" />${urlTags}
    <meta property="og:type" content="${ogType}" />
    <meta property="og:site_name" content="Pinch Hitter" />
    <meta property="og:title" content="${escapeHtml(fullTitle)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:image" content="${image ?? `${prefix}og-image.png`}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="icon" type="image/svg+xml" href="${prefix}icons/mark.svg" />
    <link rel="apple-touch-icon" href="${prefix}icons/icon-192x192.png" />
    <script type="application/ld+json">
${jsonLd({ '@context': 'https://schema.org', ...jsonLdData, ...(image ? { image } : {}) })}
    </script>
    <style>${styles}</style>
  </head>
  <body>
    <header>
      <div class="wrap">
        <a class="brand" href="${prefix}"
          ><img src="${prefix}icons/mark.svg" alt="" width="32" height="32" />Pinch Hitter</a
        >
        <a class="nav-link" href="${prefix}guides/">Coaching guides</a>
      </div>
    </header>
    <main class="wrap">
${main}
      <section class="cta" aria-labelledby="cta-heading">
        <h2 id="cta-heading">Chart your next batting practice</h2>
        <p>
          Pinch Hitter is a free batting-practice notebook and spray chart for baseball and softball
          coaches. Tap where the ball lands. It works offline, needs no account, and keeps every
          recorded contact on your phone.
        </p>
        <a class="button" href="${prefix}">Open Pinch Hitter</a>
      </section>
    </main>
    <footer>
      <div class="wrap">
        <a href="${prefix}">Pinch Hitter</a>
        <a href="${prefix}guides/">Coaching guides</a>
        <a href="${prefix}privacy/">Privacy</a>
      </div>
    </footer>
  </body>
</html>
`;
}

function guideLinks(items, hrefPrefix) {
  return `<ul class="guide-list">
${items
  .map(
    (g) =>
      `        <li><a href="${hrefPrefix}${g.slug}/"><strong>${escapeHtml(g.title)}</strong><span>${escapeHtml(g.description)}</span></a></li>`,
  )
  .join('\n')}
      </ul>`;
}

// Writes guides/index.html and guides/<slug>/index.html into browserDir. Returns the absolute
// URLs of every page for the sitemap, or an empty list when siteUrl is unknown.
export function writeGuides(browserDir, siteUrl) {
  const indexUrl = siteUrl ? `${siteUrl}guides/` : null;

  for (const guide of guides) {
    const pageUrl = indexUrl ? `${indexUrl}${guide.slug}/` : null;
    const body = readFileSync(join(sourceDir, `${guide.slug}.html`), 'utf8');
    const others = guides.filter((g) => g !== guide);
    const main = `      <article>
        <p class="eyebrow"><a href="../">Coaching guides</a></p>
        <h1>${escapeHtml(guide.title)}</h1>
${body}
      </article>
      <h2>More coaching guides</h2>
      ${guideLinks(others, '../')}`;
    const html = page({
      prefix: '../../',
      siteUrl,
      pageUrl,
      title: guide.title,
      description: guide.description,
      ogType: 'article',
      main,
      jsonLdData: {
        '@type': 'Article',
        headline: guide.title,
        description: guide.description,
        datePublished: guide.published,
        dateModified: guide.updated,
        inLanguage: 'en',
        author: publisher,
        publisher,
        ...(pageUrl ? { mainEntityOfPage: pageUrl, url: pageUrl } : {}),
      },
    });
    const dir = join(browserDir, 'guides', guide.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'index.html'), html);
  }

  const description =
    'Practical guides for volunteer and high-school coaches: charting batting practice, reading spray charts, and spray charts for softball.';
  const indexHtml = page({
    prefix: '../',
    siteUrl,
    pageUrl: indexUrl,
    title: 'Coaching Guides',
    description,
    ogType: 'website',
    main: `      <p class="eyebrow">Pinch Hitter</p>
      <h1>Coaching guides</h1>
      <p class="lede">
        Short, practical reads for coaches who run batting practice: how to chart it, how to read
        what you charted, and how it all works on a softball field.
      </p>
      ${guideLinks(guides, '')}`,
    jsonLdData: {
      '@type': 'CollectionPage',
      name: 'Pinch Hitter coaching guides',
      description,
      inLanguage: 'en',
      publisher,
      ...(indexUrl
        ? {
            url: indexUrl,
            hasPart: guides.map((g) => ({
              '@type': 'Article',
              headline: g.title,
              url: `${indexUrl}${g.slug}/`,
            })),
          }
        : {}),
    },
  });
  writeFileSync(join(browserDir, 'guides', 'index.html'), indexHtml);

  return indexUrl
    ? [
        {
          loc: indexUrl,
          lastmod: guides
            .map((g) => g.updated)
            .sort()
            .at(-1),
        },
        ...guides.map((g) => ({ loc: `${indexUrl}${g.slug}/`, lastmod: g.updated })),
      ]
    : [];
}
