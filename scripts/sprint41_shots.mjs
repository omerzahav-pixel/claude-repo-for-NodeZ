// Sprint 4.1 · capture before/after perf-HUD screenshots showing the
// rendered-vs-visible gap and the rendered-count drop when --cull-v1 is ON.
// Desktop-Chromium emulation (not iPad) — illustrative evidence of the cull
// mechanism; the real 50-FPS acceptance is the user's tethered-iPad capture.
//
// Run: node scripts/sprint41_shots.mjs   (Vite must be on :5173)
import { chromium } from '@playwright/test';

const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint41/';

async function shot(page, flags, file, killRbush) {
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((f) => {
    try { indexedDB.deleteDatabase('ideaVault'); } catch {}
    try { localStorage.clear(); } catch {}
    localStorage.setItem('edgespace-flags', JSON.stringify(f));
  }, flags);
  await page.goto(BASE_URL + '?debug=perf', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
  // Seed a dense Algo-Execution-scale canvas: ~104 nodes + a web of edges,
  // spread across a large world so only a fraction sits in the viewport.
  await page.evaluate(() => {
    const E = window.__E2E;
    const c = E.current();
    c.nodes = []; c.edges = [];
    let id = 2000;
    const cols = 13, rows = 8, gap = 700;
    const ox = -((cols - 1) * gap) / 2, oy = -((rows - 1) * gap) / 2;
    const ids = [];
    for (let r = 0; r < rows; r++) for (let cc = 0; cc < cols; cc++) {
      id++; ids.push(id);
      c.nodes.push({ id, x: ox + cc * gap, y: oy + r * gap, shape: 'idea', status: 'idea', label: 'node ' + id, zone: null });
    }
    // ~1.8 edges/node: chain + some cross links.
    let eid = 9000;
    for (let i = 1; i < ids.length; i++) c.edges.push({ id: eid++, from: ids[i - 1], to: ids[i], type: 'feeds' });
    for (let i = 0; i < ids.length; i += 7) if (ids[i + 13]) c.edges.push({ id: eid++, from: ids[i], to: ids[i + 13], type: 'related' });
    window._userInteracted = true; // suppress the on-load zoom-to-fit (zF)
    const v = E.view(); v.x = 0; v.y = 0; v.k = 1;
    window.__RENDER_STATS_ON = true;
    window.render();
  });
  await page.waitForTimeout(300);
  // Re-assert the view AFTER any late auto-fit / IDB-restore render, so the
  // capture is at 100% zoom (most nodes off-screen) where the gap is visible.
  await page.evaluate((kill) => {
    if (kill) { try { delete window.RBush; } catch {} } // simulate the brief's assumed "nothing culled" baseline
    window._userInteracted = true;
    const v = window.__E2E.view(); v.x = 0; v.y = 0; v.k = 1;
    window.render();
  }, killRbush);
  await page.waitForTimeout(450); // let the HUD's ~10Hz tick read __renderStats
  const hud = await page.$('#perfHud');
  await hud.screenshot({ path: OUT + file });
  const stats = await page.evaluate(() => window.__renderStats);
  console.log(file, JSON.stringify(stats));
}

const baseFlags = { 'nav-v2': true, 'palette': true, 'views-v2': true, 'toolbar-migrated': true, 'canvas-tiles': true };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await shot(page, { ...baseFlags, 'cull-v1': false }, 'hud-baseline-norbush.png', true); // assumed baseline (no node cull)
await shot(page, { ...baseFlags, 'cull-v1': false }, 'hud-cull-off.png', false);         // real desktop (rbush culls nodes, not edges)
await shot(page, { ...baseFlags, 'cull-v1': true }, 'hud-cull-on.png', false);           // cull-v1 ON (nodes + edges + overlay LoD)
await browser.close();
console.log('saved to', OUT);
