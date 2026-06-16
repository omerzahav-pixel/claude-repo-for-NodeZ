// Sprint 8 · Issue 2 — screenshot the drawer showing the chosen canvas's nodes
// FLAT (no per-zone grouping). nav-v2 on so the spine + drawer are present.
import { chromium } from '@playwright/test';
const BASE = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint8/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('ideaVault'); } catch {}
  try { localStorage.clear(); } catch {}
  localStorage.setItem('edgespace-flags', JSON.stringify({ 'nav-v2': true, silhouettes: true }));
});
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current();
  // zones EXIST on the canvas (proving the drawer no longer groups by them)
  c.zones = [{ id: 'zr', name: 'Research', x: -300, y: -200, w: 300, h: 300, color: '#6FA8FF' },
             { id: 'zb', name: 'Build', x: 50, y: -200, w: 300, h: 300, color: '#FF7A45' }];
  c.edges = [];
  c.nodes = [
    { id: 1, x: -200, y: -120, shape: 'experiment', status: 'progress', label: 'signal bot per strategy', zone: 'zr' },
    { id: 2, x: 120, y: -120, shape: 'project', status: 'blocked', label: 'Algo Execution', zone: 'zb' },
    { id: 3, x: -200, y: 60, shape: 'idea', status: 'idea', label: 'volatility-scaled sizing', zone: 'zr' },
    { id: 4, x: 120, y: 60, shape: 'principle', status: 'done', label: 'never average down', zone: null },
    { id: 5, x: 0, y: 180, shape: 'question', status: 'pending', label: 'fees vs edge?', zone: null },
  ];
  window._userInteracted = true;
  window.render();
  if (window.Drawer) window.Drawer.refresh();
});
await page.waitForTimeout(600);
const probe = await page.evaluate(() => ({
  zoneRows: document.querySelectorAll('#drawer .dr-zone-row').length,
  nodeRows: Array.from(document.querySelectorAll('#drawer .dr-node-row .dr-name')).map(n => n.textContent),
}));
console.log('drawer', JSON.stringify(probe));
// clip the left edge: spine (56px) + drawer (~224px)
await page.screenshot({ path: OUT + 'drawer-flat.png', clip: { x: 0, y: 0, width: 300, height: 600 } });
await browser.close();
console.log('saved', OUT + 'drawer-flat.png');
