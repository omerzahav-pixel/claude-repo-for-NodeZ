// Sprint 8 · stress render() with diverse/edge-case node data to catch the
// throw that aborts the whole canvas render (orange bar + "KaTeX not going
// through at all"). Runs under default flags and the report's flag set.
import { chromium } from '@playwright/test';
const BASE = process.env.VITE_URL ?? 'http://localhost:5173/';

const FLAGSETS = [
  { name: 'defaults', flags: {} },
  { name: 'report-url', flags: { 'nav-v2': true, palette: true, 'views-v2': true, 'toolbar-migrated': true, 'canvas-tiles': true, 'cull-v1': true } },
];

const browser = await chromium.launch();
for (const fs of FLAGSETS) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push('PAGEERR ' + e.message + ' :: ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('CONSOLE ' + m.text()); });

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.evaluate((f) => {
    try { indexedDB.deleteDatabase('ideaVault'); } catch {}
    try { localStorage.clear(); } catch {}
    localStorage.setItem('edgespace-flags', JSON.stringify(f));
  }, fs.flags);
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__E2E, null, { timeout: 15000 });

  const res = await page.evaluate(async () => {
    const E = window.__E2E, c = E.current(), S = E.state();
    S.canvases['kid'] = { nodes: [{ id: 1, x: 0, y: 0, shape: 'idea' }], edges: [], zones: [] };
    const today = new Date().toISOString();
    c.zones = c.zones || [];
    c.edges = [];
    c.nodes = [
      { id: 1, x: -300, y: -150, shape: 'formula', status: 'idea', label: 'f1', latex: 'E=mc^2', zone: null },
      { id: 2, x: -150, y: -150, shape: 'formula', status: 'progress', label: 'f2', latex: '\\frac{a}{b}\\\\\\sum_{i=0}^{n} x_i', zone: null },
      { id: 3, x: 0, y: -150, shape: 'formula', status: 'idea', label: 'empty', latex: '', zone: null },
      { id: 4, x: 150, y: -150, shape: 'note', status: 'idea', label: 'note', notes: 'inline $x^2$ and **bold** and <b>&amp;</b>\n- list', zone: null },
      { id: 5, x: -300, y: 0, shape: 'idea', status: 'blocked', label: null, notes: null, zone: null },         // null label/notes
      { id: 6, x: -150, y: 0, shape: 'project', status: 'idea', label: 'P-valid', notes: 'x', childCanvas: 'kid', zone: null },
      { id: 7, x: 0, y: 0, shape: 'project', status: 'idea', label: 'P-missing', notes: 'x', childCanvas: 'GONE', zone: null }, // dangling child
      { id: 8, x: 150, y: 0, shape: 'project', status: 'idea', label: 'P-nochild', zone: null },                 // no childCanvas
      { id: 9, x: -300, y: 150, shape: 'experiment', status: 'done', label: 'ניסוי בעברית', notes: 'טקסט עברי ארוך מאוד שאמור להיחתך', zone: null },
      { id: 10, x: -150, y: 150, shape: 'principle', status: 'progress', label: 'p', rationale: 'because', notes: '', zone: null },
      { id: 11, x: 0, y: 150, shape: 'weirdshape', status: 'idea', label: 'unknown shape', notes: 'legacy', zone: null }, // unknown shape
      { id: 12, x: 150, y: 150, shape: 'resource', status: 'idea', label: 'r', url: 'https://x.com', created: today, modified: today, zone: null },
      { id: 13, x: 300, y: 0, shape: 'idea', status: undefined, label: 'no status', zone: null },                // undefined status
    ];
    const out = { threw: null, katexDom: 0, nslices: 0 };
    try {
      window.render();
      await new Promise(r => setTimeout(r, 400));
      const ov = document.getElementById('canvasOverlay');
      out.katexDom = (ov || document).querySelectorAll('.katex').length;
      out.nslices = (ov || document).querySelectorAll('.nslice').length;
    } catch (e) { out.threw = e.message + ' :: ' + (e.stack || '').split('\n').slice(1, 3).join(' | '); }
    return out;
  });

  console.log('\n===== ' + fs.name + ' =====');
  console.log('render', JSON.stringify(res));
  console.log('errs', JSON.stringify(errs.slice(0, 6), null, 1));
  await ctx.close();
}
await browser.close();
