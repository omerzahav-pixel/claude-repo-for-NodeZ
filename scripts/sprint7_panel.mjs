// Sprint 7 · Issue 2 — info-panel fits viewport + sticky footer + formula contained.
// Short viewport (mimics iPad landscape with the keyboard up). Proves the body
// scrolls and the Save/Close/Copy/Pull footer stays inside the viewport.
import { chromium } from '@playwright/test';
const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint7/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('ideaVault'); } catch {}
  try { localStorage.clear(); } catch {}
  localStorage.setItem('edgespace-flags', JSON.stringify({ silhouettes: true }));
});
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
await page.waitForFunction(() => !!window.katex, null, { timeout: 15000 });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current();
  c.zones = []; c.edges = [];
  c.nodes = [{
    id: 9001, x: 0, y: 0, shape: 'formula', status: 'progress',
    label: 'Kelly fraction with a wide denominator to test horizontal overflow',
    latex: 'f^{*}=\\dfrac{p\\,(b+1)-1}{b}=\\dfrac{p}{a}-\\dfrac{q}{b}\\quad\\text{where}\\quad q=1-p,\\; a=\\text{loss fraction}',
    notes: 'Bet a fixed fraction of bankroll equal to the edge over the odds. ' .repeat(8),
    rationale: 'Maximises long-run log growth; halve it in practice for variance. '.repeat(4),
    url: 'https://example.com/kelly', tags: 'sizing, risk', confidence: 4, zone: null,
  }];
  // open the panel + expand the details disclosure so the panel is its tallest
  window.panelDetailsOpen = true;
  window.op(c.nodes[0]);
});
await page.waitForTimeout(500);
const probe = await page.evaluate(() => {
  const pn = document.getElementById('pn');
  const body = pn?.querySelector('.pn-body');
  const foot = pn?.querySelector('.pn-foot');
  const prev = document.getElementById('latexPreview');
  const btns = [...(foot?.querySelectorAll('button') || [])].map(b => {
    const r = b.getBoundingClientRect();
    return { t: b.textContent.trim().slice(0, 14), bottom: Math.round(r.bottom), inView: r.bottom <= innerHeight + 1 && r.top >= 0 };
  });
  return {
    vh: innerHeight,
    bodyScrolls: body ? body.scrollHeight > body.clientHeight + 2 : null,
    footBottom: foot ? Math.round(foot.getBoundingClientRect().bottom) : null,
    footInView: foot ? foot.getBoundingClientRect().bottom <= innerHeight + 1 : null,
    previewOverflowX: prev ? getComputedStyle(prev).overflowX : null,
    previewScrollW_gt_clientW: prev ? prev.scrollWidth > prev.clientWidth : null,
    allFooterBtnsInView: btns.every(b => b.inView),
    btns,
  };
});
console.log('panel', JSON.stringify(probe, null, 1));
await page.screenshot({ path: OUT + 'panel-sticky-footer.png', clip: { x: 900 - 372, y: 0, width: 372, height: 560 } });
await browser.close();
console.log('saved', OUT + 'panel-sticky-footer.png');
