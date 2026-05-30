// Sprint 4.3 · capture rich-vs-simple node appearance + the HUD build line.
// Desktop-Chromium (illustration of what the modes look like); the 50-fps win
// is the user's iPad measurement. Run: node scripts/sprint43_shots.mjs
import { chromium } from '@playwright/test';

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint43/';

async function seedAndShot(page, flags, file, hud) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((f) => {
    try { indexedDB.deleteDatabase('ideaVault'); } catch {}
    try { localStorage.clear(); } catch {}
    localStorage.setItem('edgespace-flags', JSON.stringify(f));
  }, flags);
  await page.goto(BASE_URL + (hud ? '?debug=perf' : ''), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
  await page.evaluate(() => {
    const E = window.__E2E; const c = E.current();
    c.zones = []; c.nodes = []; c.edges = [];
    const shapes = ['project', 'idea', 'principle', 'resource', 'question', 'experiment', 'library', 'doc'];
    const stats = ['done', 'progress', 'pending', 'blocked', 'idea'];
    let id = 3000; const ids = [];
    for (let i = 0; i < 8; i++) {
      id++; ids.push(id);
      c.nodes.push({ id, x: (i % 4) * 160 - 240, y: Math.floor(i / 4) * 170 - 85, shape: shapes[i], status: stats[i % 5], label: shapes[i], zone: null, created: new Date().toISOString().slice(0, 10), modified: new Date().toISOString() });
    }
    for (let i = 1; i < ids.length; i++) c.edges.push({ id: 9000 + i, from: ids[i - 1], to: ids[i], type: 'feeds' });
    window._userInteracted = true;
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1.1;
    window.render();
  });
  await page.waitForTimeout(350);
  await page.evaluate(() => { window._userInteracted = true; const v = window.__E2E.view(); v.x = 0; v.y = 0; v.k = 1.1; window.render(); });
  await page.waitForTimeout(400);
  if (hud) {
    const el = await page.$('#perfHud');
    await el.screenshot({ path: OUT + file });
  } else {
    await page.screenshot({ path: OUT + file, clip: { x: 340, y: 210, width: 600, height: 400 } });
  }
  console.log(file, 'saved');
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await seedAndShot(page, {}, 'nodes-rich.png', false);
await seedAndShot(page, { 'simple-nodes': true }, 'nodes-simple.png', false);
await seedAndShot(page, { 'perf-hud': true }, 'hud-build.png', true);
await browser.close();
console.log('saved to', OUT);
