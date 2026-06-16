// Sprint 8 · diagnose the orange error bar + KaTeX-not-rendering.
// Usage: node scripts/diag_err.mjs <url>
import { chromium } from '@playwright/test';
const URL = process.argv[2] || 'http://localhost:5173/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();
const pageErrors = [], consoleErrs = [], netFail = [];
page.on('pageerror', (e) => pageErrors.push(e.message + (e.stack ? ' :: ' + e.stack.split('\n').slice(0, 3).join(' | ') : '')));
page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
page.on('requestfailed', (r) => netFail.push(r.url() + ' :: ' + (r.failure()?.errorText || '?')));
page.on('response', (r) => { if (!r.ok() && (r.url().includes('katex') || r.url().endsWith('.js') || r.url().endsWith('.css'))) netFail.push('HTTP ' + r.status() + ' ' + r.url()); });

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500); // let the boot chain + defer scripts run

const boot = await page.evaluate(() => {
  const eb = document.getElementById('errBanner');
  const eo = document.getElementById('errorBoundary');
  return {
    hasE2E: !!window.__E2E,
    katex: !!window.katex,
    autoRender: !!window.renderMathInElement,
    errBanner: eb ? eb.textContent.slice(0, 400) : null,
    errorBoundaryShown: eo ? getComputedStyle(eo).display !== 'none' : false,
    render: typeof window.render,
  };
});

// If E2E hooks exist, seed a formula node and see if it typesets.
let formula = 'no-E2E';
if (boot.hasE2E) {
  formula = await page.evaluate(async () => {
    try {
      const E = window.__E2E, c = E.current();
      c.nodes = [{ id: 9999, x: 0, y: 0, shape: 'formula', status: 'idea', label: 'f', latex: 'E=mc^2', zone: null }];
      c.edges = [];
      const v = E.view(); v.x = 0; v.y = 0; v.k = 1.3; window.render();
      await new Promise(r => setTimeout(r, 500));
      const ov = document.getElementById('canvasOverlay');
      return {
        fnode: !!ov?.querySelector('.fnode[data-latex]'),
        katexDom: (ov || document).querySelectorAll('.katex').length,
        rawText: ov?.querySelector('.fnode')?.textContent?.slice(0, 30) || '(none)',
      };
    } catch (e) { return { error: e.message }; }
  });
}

console.log('URL', URL);
console.log('boot', JSON.stringify(boot, null, 1));
console.log('formula', JSON.stringify(formula));
console.log('pageErrors', JSON.stringify(pageErrors, null, 1));
console.log('consoleErrs', JSON.stringify(consoleErrs.slice(0, 8), null, 1));
console.log('netFail', JSON.stringify(netFail.slice(0, 8), null, 1));
await browser.close();
