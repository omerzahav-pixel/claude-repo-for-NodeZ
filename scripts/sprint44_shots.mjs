// Sprint 4.4 · capture the HUD with the new build stamp + layout/other lines.
import { chromium } from '@playwright/test';
const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint44/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('ideaVault'); } catch {}
  try { localStorage.clear(); } catch {}
  localStorage.setItem('edgespace-flags', JSON.stringify({ 'cull-v1': true }));
});
await page.goto(BASE_URL + '?debug=perf', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current();
  c.nodes = []; for (let i = 0; i < 30; i++) c.nodes.push({ id: 100 + i, x: (i % 6) * 200 - 500, y: Math.floor(i / 6) * 200 - 400, shape: 'idea', status: 'idea', label: 'n', zone: null });
  c.edges = [];
  window.__RENDER_STATS_ON = true;
  const v = E.view(); v.x = 0; v.y = 0; v.k = 1; window.render();
});
await page.waitForTimeout(500);
const el = await page.$('#perfHud');
await el.screenshot({ path: OUT + 'hud-440.png' });
const stats = await page.evaluate(() => window.__renderStats);
console.log('hud-440.png', JSON.stringify(stats));
await browser.close();
console.log('saved to', OUT);
