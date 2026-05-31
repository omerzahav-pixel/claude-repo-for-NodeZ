// Sprint 7 · Issue 0 — verify the VENDORED (local, non-CDN) KaTeX typesets.
// Proves: window.katex + renderMathInElement load from ./katex/, a formula node
// renders real .katex DOM, and an inline-math note body typesets too.
import { chromium } from '@playwright/test';
const BASE_URL = process.env.VITE_URL ?? 'http://localhost:5173/';
const OUT = 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint7/';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const badReqs = [];
page.on('requestfailed', (r) => badReqs.push(r.url()));
page.on('response', (r) => { if (r.url().includes('jsdelivr')) badReqs.push('CDN-HIT ' + r.url()); });
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
  try { indexedDB.deleteDatabase('ideaVault'); } catch {}
  try { localStorage.clear(); } catch {}
  localStorage.setItem('edgespace-flags', JSON.stringify({ silhouettes: true }));
});
await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
// wait for the deferred KaTeX scripts to attach window.katex
await page.waitForFunction(() => !!window.katex && !!window.renderMathInElement, null, { timeout: 15000 });
await page.evaluate(() => {
  const E = window.__E2E, c = E.current();
  c.zones = []; c.edges = [];
  c.nodes = [
    { id: 8001, x: -150, y: -40, shape: 'formula', status: 'progress', label: 'Sharpe', latex: '\\mathrm{SR}=\\dfrac{E[R_p-R_f]}{\\sigma_p}', zone: null },
    { id: 8002, x: 120, y: -40, shape: 'note', status: 'idea', label: 'sizing', notes: 'Position size $w_i = \\dfrac{1}{\\sigma_i}$ keeps risk flat.', zone: null },
  ];
  window._userInteracted = true;
  const v = E.view(); v.x = 0; v.y = 0; v.k = 1.4; window.render();
});
await page.waitForTimeout(600);
await page.evaluate(() => { window._userInteracted = true; const v = window.__E2E.view(); v.x = 0; v.y = 0; v.k = 1.4; window.render(); });
await page.waitForTimeout(500);
const probe = await page.evaluate(() => ({
  katex: !!window.katex,
  autoRender: !!window.renderMathInElement,
  katexFrom: (document.querySelector('script[src*="katex.min.js"]')?.getAttribute('src')) || '?',
  katexDom: document.querySelectorAll('.katex').length,
}));
console.log('probe', JSON.stringify(probe));
console.log('badReqs', JSON.stringify(badReqs.slice(0, 8)));
await page.screenshot({ path: OUT + 'katex-local.png', clip: { x: 360, y: 230, width: 560, height: 340 } });
await browser.close();
console.log('saved', OUT + 'katex-local.png');
