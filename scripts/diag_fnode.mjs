// Sprint 8 follow-up · WHY is the formula NODE empty while note inline-math
// renders? Inspect every .katex: its parent container, geometry, and whether
// the formula node's .fnode clips/hides it.
import { webkit, chromium } from '@playwright/test';
const BASE = process.env.VITE_URL ?? 'http://localhost:5173/';
const engine = process.env.ENGINE === 'chromium' ? chromium : webkit;

const browser = await engine.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { try { indexedDB.deleteDatabase('ideaVault'); } catch {} try { localStorage.clear(); } catch {} localStorage.setItem('edgespace-flags', JSON.stringify({ silhouettes: true })); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
await page.evaluate(async () => { for (let i = 0; i < 50; i++) { if (window.katex) return; await new Promise(r => setTimeout(r, 100)); } });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current(); c.zones = []; c.edges = [];
  c.nodes = [{ id: 1, x: 0, y: 0, shape: 'formula', status: 'idea', label: 'Sharpe', latex: '\\frac{E[R]}{\\sigma}', zone: null }];
  window._userInteracted = true; const v = E.view(); v.x = 0; v.y = 0; v.k = 1.5; window.render();
});
await page.waitForTimeout(800);
const probe = await page.evaluate(() => {
  const ov = document.getElementById('canvasOverlay');
  const fnode = ov?.querySelector('.fnode[data-latex]');
  const out = { fnode: null, katexInFnode: null };
  if (fnode) {
    const fr = fnode.getBoundingClientRect();
    const cs = getComputedStyle(fnode);
    out.fnode = {
      rect: { x: Math.round(fr.x), y: Math.round(fr.y), w: Math.round(fr.width), h: Math.round(fr.height) },
      overflow: cs.overflow, display: cs.display, maxWidth: cs.maxWidth, maxHeight: cs.maxHeight,
      childCount: fnode.children.length,
      innerHTMLhead: fnode.innerHTML.slice(0, 80),
    };
    const k = fnode.querySelector('.katex');
    if (k) {
      const kr = k.getBoundingClientRect();
      out.katexInFnode = { x: Math.round(kr.x), y: Math.round(kr.y), w: Math.round(kr.width), h: Math.round(kr.height),
        // is the katex box inside the fnode box?
        insideX: kr.x >= fr.x - 1 && kr.right <= fr.right + 1,
        insideY: kr.y >= fr.y - 1 && kr.bottom <= fr.bottom + 1 };
    } else {
      out.katexInFnode = 'NO .katex inside .fnode';
    }
  } else {
    out.fnode = 'NO .fnode[data-latex] found';
  }
  return out;
});
console.log('engine', process.env.ENGINE || 'webkit');
console.log('fnode-probe', JSON.stringify(probe, null, 1));
await browser.close();
