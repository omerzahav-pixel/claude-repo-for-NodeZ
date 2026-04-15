// Tiny ES-module bootstrap for the non-module app.js.
// Vite processes this via a <script type="module"> tag in index.html and
// bundles the `rbush` dependency (listed in package.json) into the output.
// We then expose the RBush class on window so vanilla app.js can reach it
// without becoming a module itself — this keeps the D2 "stay SVG / stay
// non-module" pivot intact while still letting Phase 1 · 1.6c use a real
// R-tree for viewport culling.
import RBush from "rbush";
(window as any).RBush = RBush;
