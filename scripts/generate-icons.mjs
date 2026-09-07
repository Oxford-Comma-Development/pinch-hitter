import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const svg = readFileSync('public/icons/mark.svg', 'utf8');
for (const size of [72, 96, 128, 144, 152, 192, 384, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icons/icon-${size}x${size}.png`, omitBackground: true });
}
await page.setViewportSize({ width: 48, height: 48 });
await page.setContent(
  `<style>body{margin:0}svg{width:100vw;height:100vh;display:block}</style>${svg}`,
);
const png = await page.screenshot({ omitBackground: true });
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 48;
header[7] = 48;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18);
writeFileSync('public/favicon.ico', Buffer.concat([header, png]));
await browser.close();
