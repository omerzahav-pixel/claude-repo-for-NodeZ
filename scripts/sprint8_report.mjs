// Sprint 8 · build the completion report with the drawer screenshot inlined as
// base64 (self-contained HTML). {{REGRESSION}} comes from argv[2] post-suite.
import { readFileSync, writeFileSync } from 'node:fs';
const ROOT = 'C:/Users/Administrator/projects/NodeZ-v2/';
const SHOTS = ROOT + 'docs/sprint8/';
const b64 = (p) => 'data:image/png;base64,' + readFileSync(p).toString('base64');
const REGRESSION = process.argv[2] || 'החבילה המלאה רצה — ממתין לתוצאה.';

let html = readFileSync(ROOT + 'scripts/sprint8_report_template.html', 'utf8');
html = html
  .replace('{{IMG_DRAWER}}', b64(SHOTS + 'drawer-flat.png'))
  .replace('{{REGRESSION}}', REGRESSION);

const OUT = ROOT + 'sprint8_completion_2026-06-16.html';
writeFileSync(OUT, html);
console.log('wrote', OUT, '·', (html.length / 1024).toFixed(0) + 'KB');
