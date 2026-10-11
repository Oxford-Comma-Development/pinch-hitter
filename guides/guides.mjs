// Static coaching guides published under <base href>guides/<slug>/ by scripts/prepare-pages.mjs.
// Each entry's body lives in guides/<slug>.html as a plain HTML fragment (no build-time parser).
// Bump `updated` when an article's content changes; it feeds the sitemap and Article JSON-LD.
export const guides = [
  {
    slug: 'how-to-chart-batting-practice',
    title: 'How to Chart Batting Practice',
    description:
      'A simple system for recording where every batting-practice ball lands, built for volunteer and high-school coaches standing behind the cage.',
    published: '2026-10-08',
    updated: '2026-10-08',
  },
  {
    slug: 'how-to-read-a-spray-chart',
    title: 'How to Read a Spray Chart',
    description:
      'Turn a cloud of dots into coaching decisions: pull, center, and opposite field, contact quality, sample size, and what to change in the cage.',
    published: '2026-10-08',
    updated: '2026-10-08',
  },
  {
    slug: 'softball-spray-charts',
    title: 'Spray Charts for Softball',
    description:
      'How fastpitch and slowpitch coaches can chart hitters on a smaller field, read slappers and short-game hitters, and plan defense from batting practice.',
    published: '2026-10-08',
    updated: '2026-10-08',
  },
];
