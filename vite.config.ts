import { defineConfig } from "vite";

// NodeZ Phase 0: vanilla scaffold, no frameworks.
// Legacy idea_vault.html JS lives in public/app.js (passthrough — no
// module scope, so `function foo(){}` declarations stay on window and
// existing inline `onclick="foo()"` handlers in index.html keep working).
// Legacy CSS lives in src/app.css (bundled normally by Vite).
// Phase 1 will author new code as proper ES modules under src/ and
// progressively shrink public/app.js. See DECISIONS.md D1 for rationale.
export default defineConfig({
  // Relative base so Cloudflare Pages works at both pages.dev and custom domain subpaths.
  base: "./",
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "es2022",
  },
});
