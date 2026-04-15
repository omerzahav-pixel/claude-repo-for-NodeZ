// Tiny ES-module bootstrap for the non-module app.js.
// Vite processes this via a <script type="module"> tag in index.html and
// bundles the `rbush` dependency (listed in package.json) into the output.
// We then expose the RBush class on window so vanilla app.js can reach it
// without becoming a module itself — this keeps the D2 "stay SVG / stay
// non-module" pivot intact while still letting Phase 1 · 1.6c use a real
// R-tree for viewport culling.
import RBush from "rbush";
(window as any).RBush = RBush;

// Phase 2 · PWA · service worker registration + persistent storage.
//
// SW is registered AFTER window load so it never competes with app bootstrap
// for network bandwidth on first paint. Register path is relative so we work
// under sub-paths (Cloudflare Pages preview URLs) without changes.
//
// navigator.storage.persist() asks the browser to exempt our IndexedDB +
// localStorage from eviction under storage pressure. iOS 17+ grants this
// silently once the PWA is added to Home Screen; desktop Chrome grants it
// based on engagement signals.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      (window as any).dbg?.("PWA", `SW registered · scope=${reg.scope}`);
      // If a new SW is waiting (previous version still in control), nudge
      // it past the install-wait phase so the reload loop lands cleanly.
      if (reg.waiting) reg.waiting.postMessage("SKIP_WAITING");
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && navigator.serviceWorker.controller) {
            (window as any).dbg?.("PWA", "new SW installed · reloading to pick it up");
          }
        });
      });
    }).catch((err) => {
      (window as any).dbg?.("PWA", "SW register failed: " + err.message);
    });
  });
}

// Persistent storage is a separate API; do it as soon as we can.
if ("storage" in navigator && typeof navigator.storage.persist === "function") {
  navigator.storage.persist().then((granted) => {
    (window as any).dbg?.("PWA", `storage.persist() · granted=${granted}`);
  }).catch((err) => {
    (window as any).dbg?.("PWA", "storage.persist() failed: " + err.message);
  });
}
