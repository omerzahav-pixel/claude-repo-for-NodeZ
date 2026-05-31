// Sprint 7 · build the completion report — inline the iPad screenshots as
// base64 data URIs so the HTML is fully self-contained (the brief mandates the
// screenshots be IN the report). {{REGRESSION}} is left for a post-suite edit.
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = 'C:/Users/Administrator/projects/NodeZ-v2/';
const SHOTS = ROOT + 'docs/sprint7/';
const b64 = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');

// The regression line is passed in as argv[2] so it's filled with the REAL
// suite number after the run (no hand-editing the generated HTML).
const REGRESSION = process.argv[2] || 'החבילה המלאה רצה — ממתין לתוצאה.';

let html = readFileSync(ROOT + 'scripts/sprint7_report_template.html', 'utf8');
html = html
  .replace('{{IMG_NODES}}', b64(SHOTS + 'nodes-anatomy.png'))
  .replace('{{IMG_KATEX}}', b64(SHOTS + 'katex-local.png'))
  .replace('{{IMG_PANEL}}', b64(SHOTS + 'panel-sticky-footer.png'))
  .replace('{{REGRESSION}}', REGRESSION);

const OUT = ROOT + 'sprint7_completion_2026-05-31.html';
writeFileSync(OUT, html);
console.log('wrote', OUT, '·', (html.length / 1024).toFixed(0) + 'KB');
