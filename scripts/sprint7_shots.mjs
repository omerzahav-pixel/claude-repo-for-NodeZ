// Sprint 7 · screenshot-verify Issue 1: title + body render INSIDE the node card
// (this missed in Sprint 5 and 6). Desktop emulation — the structure is what we
// verify (text inside the rectangle, nothing below it).
import { chromium } from '@playwright/test';
const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint7/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('ideaVault'); } catch {}
  try { localStorage.clear(); } catch {}
  localStorage.setItem('edgespace-flags', JSON.stringify({ silhouettes: true }));
});
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current();
  c.zones = []; c.edges = [];
  // a child canvas for the project node so its metadata is real
  const S = E.state();
  S.canvases['proj-child'] = { nodes: [{ id: 1, x: 0, y: 0, shape: 'idea', status: 'idea', label: 'a' }, { id: 2, x: 50, y: 0, shape: 'idea', status: 'done', label: 'b' }], edges: [], zones: [] };
  c.nodes = [
    { id: 7001, x: -260, y: -90, shape: 'experiment', status: 'progress', label: 'create signal bot per strategy', notes: 'Spin up one bot per strategy; route fills on close; compare leg-capture vs APR baseline.', zone: null },
    { id: 7002, x: 10, y: -90, shape: 'project', status: 'blocked', label: 'Algo Execution', notes: 'Execution layer: order routing, fills, risk caps.', childCanvas: 'proj-child', zone: null },
    { id: 7003, x: -260, y: 90, shape: 'idea', status: 'idea', label: 'volatility-scaled position sizing', notes: 'Size each entry by inverse realized vol so risk per trade is constant.', zone: null },
    { id: 7004, x: 10, y: 90, shape: 'principle', status: 'done', label: 'never average down a loser', notes: '', zone: null },
  ];
  window._userInteracted = true;
  const v = E.view(); v.x = 0; v.y = 0; v.k = 1.25; window.render();
});
await page.waitForTimeout(300);
await page.evaluate(() => { window._userInteracted = true; const v = window.__E2E.view(); v.x = 0; v.y = 0; v.k = 1.25; window.render(); });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT + 'nodes-anatomy.png', clip: { x: 175, y: 190, width: 650, height: 410 } });
// report what's in the experiment node's overlay slice
const probe = await page.evaluate(() => {
  const sl = document.querySelector('.nslice[data-nid="7001"]');
  const title = sl?.querySelector('.ncard-title')?.textContent;
  const body = sl?.querySelector('.ncard-body')?.textContent?.slice(0, 30);
  const belowLabel = !!sl?.querySelector('svg text'); // any below-the-rect SVG label?
  const projMeta = document.querySelector('.nslice[data-nid="7002"] .ncard-meta')?.textContent;
  return { title, body, belowLabel, projMeta };
});
console.log('probe', JSON.stringify(probe));
await browser.close();
console.log('saved to', OUT);
