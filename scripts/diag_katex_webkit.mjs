// Sprint 8 follow-up · reproduce the KaTeX failure on REAL WebKit (the user's
// iPad engine). Chromium tests passed; WebKit was never run. Checks not just
// that .katex DOM exists, but that it actually rendered with size + font (a
// formula can produce DOM yet be invisible if CSS/fonts don't apply).
import { webkit } from '@playwright/test';
const BASE = process.env.VITE_URL ?? 'http://localhost:5173/';

const browser = await webkit.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
const errs = [];
page.on('pageerror', e => errs.push('PAGEERR ' + e.message));
page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });
page.on('requestfailed', r => errs.push('REQFAIL ' + r.url() + ' :: ' + (r.failure()?.errorText || '')));
page.on('response', r => { if (r.url().includes('/katex/') && !r.ok()) errs.push('HTTP ' + r.status() + ' ' + r.url()); });

await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { try { indexedDB.deleteDatabase('ideaVault'); } catch {} try { localStorage.clear(); } catch {} localStorage.setItem('edgespace-flags', JSON.stringify({ silhouettes: true })); });
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });
const katexReady = await page.evaluate(async () => {
  for (let i = 0; i < 50; i++) { if (window.katex && window.renderMathInElement) return true; await new Promise(r => setTimeout(r, 100)); }
  return { katex: !!window.katex, autoRender: !!window.renderMathInElement };
});
await page.evaluate(() => {
  const E = window.__E2E, c = E.current(); c.zones = []; c.edges = [];
  c.nodes = [
    { id: 1, x: -160, y: -40, shape: 'formula', status: 'idea', label: 'Sharpe', latex: '\\frac{E[R]}{\\sigma}', zone: null },
    { id: 2, x: 160, y: -40, shape: 'note', status: 'idea', label: 'n', notes: 'inline $x^2$ here', zone: null },
  ];
  window._userInteracted = true; const v = E.view(); v.x = 0; v.y = 0; v.k = 1.5; window.render();
});
await page.waitForTimeout(900);
const probe = await page.evaluate(() => {
  const ov = document.getElementById('canvasOverlay');
  const fnode = ov?.querySelector('.fnode[data-latex]');
  const katexEls = ov ? Array.from(ov.querySelectorAll('.katex')) : [];
  let rect = null, font = null, color = null, fontStatus = null;
  if (katexEls[0]) {
    const r = katexEls[0].getBoundingClientRect();
    rect = { w: Math.round(r.width), h: Math.round(r.height) };
    const cs = getComputedStyle(katexEls[0]); font = cs.fontFamily; color = cs.color;
  }
  try { fontStatus = document.fonts ? (document.fonts.check('10px KaTeX_Main') ? 'KaTeX_Main loaded' : 'KaTeX_Main NOT loaded') : 'no fonts API'; } catch (e) { fontStatus = 'err ' + e.message; }
  return {
    katexLoaded: !!window.katex,
    fnodeText: fnode ? fnode.textContent.slice(0, 40) : '(no .fnode)',
    katexCount: katexEls.length,
    firstRect: rect, font, color, fontStatus,
  };
});
console.log('katexReady', JSON.stringify(katexReady));
console.log('webkit-probe', JSON.stringify(probe, null, 1));
console.log('errs', JSON.stringify(errs.slice(0, 10), null, 1));
await page.screenshot({ path: 'C:/Users/Administrator/projects/NodeZ-v2/docs/sprint8/katex-webkit.png', clip: { x: 300, y: 250, width: 560, height: 320 } });
await browser.close();
