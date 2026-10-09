import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Renders the 1200x630 link-preview card used by og:image and twitter:image.
const svg = readFileSync('public/icons/mark.svg', 'utf8');
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(`<!doctype html>
<style>
  body {
    margin: 0;
    width: 1200px;
    height: 630px;
    display: flex;
    align-items: center;
    gap: 64px;
    padding: 0 88px;
    box-sizing: border-box;
    background: #172f2b;
    color: #fff9e6;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  .mark svg { width: 300px; height: 300px; display: block; border-radius: 64px;
    box-shadow: 0 0 0 4px #2c4c45; }
  h1 { margin: 0 0 12px; font-size: 40px; font-weight: 800; letter-spacing: 6px; color: #edc484; }
  h2 { margin: 0 0 28px; font-size: 64px; line-height: 1.05; font-weight: 900; letter-spacing: -1.5px; }
  p { margin: 0; font-size: 28px; color: #d8e5d7; line-height: 1.4; }
</style>
<div class="mark">${svg}</div>
<div>
  <h1>PINCH HITTER</h1>
  <h2>Batting practice spray charts for coaches</h2>
  <p>Baseball &amp; softball · Free · Works offline<br />No account. Your data stays on your phone.</p>
</div>`);
await page.screenshot({ path: 'public/og-image.png' });
await browser.close();
console.log('✓ Wrote public/og-image.png');
