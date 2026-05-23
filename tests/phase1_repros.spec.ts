import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

/**
 * Phase 1 · Task 1.0 — deterministic repros for the five blocker bugs.
 *
 * Bugs being reproduced (per DECISIONS.md D2):
 *   1. `imF()` — full-state Import is a silent no-op on failure
 *   2. `reconcileCanvases()` scatters imported node positions
 *   3. KaTeX does not render on canvas (only sidebar/panel)
 *   4. Long note bodies overflow their containers
 *   5. Markdown (`**bold**`, headings, lists) shown as raw text
 *
 * Plus an XSS regression test: a note containing `<script>alert(1)</script>`
 * must render as visible text, never as executed JS. This test should pass
 * today AND keep passing after the Markdown processor lands in 1.3 (order
 * must be: escape HTML → extract math placeholders → Markdown → re-inject).
 *
 * State introspection uses the `window.__E2E` read-only getter hook added
 * at the bottom of `public/app.js` (non-module `let` bindings aren't on
 * `window` by default, so the hook is required).
 *
 * Expectation: every test in this file FAILS on the current v2-rewrite HEAD
 * except `XSS: <script> in note body renders as visible text`. Each one
 * will flip to pass as 1.1 through 1.6 land.
 */

type E2EState = {
  canvases: Record<string, { nodes: any[]; edges: any[]; zones: any[] }>;
  current: string;
  hebrewMode?: boolean;
  nextId: number;
};

declare global {
  interface Window {
    __E2E?: {
      state(): E2EState;
      view(): any;
      current(): { nodes: any[]; edges: any[]; zones: any[] };
      addNodeRaw(node: any): any;
      setCurrentCanvas(id: string): boolean;
    };
    render: () => void;
    showPatch?: () => void;
    closeModal?: () => void;
  }
}

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const viteUrl = process.env.VITE_URL ?? "http://localhost:5173/";
const discMathJson = path.join(repoRoot, "disc_math and probabilty_full.json");
const tradingJson = path.join(repoRoot, "TRADING REAL.json");

async function openCleanApp(page: Page) {
  // First navigation: clear persisted state so each test starts fresh.
  await page.goto(viteUrl, { waitUntil: "domcontentloaded" });
  await page.evaluate(async () => {
    try {
      indexedDB.deleteDatabase("ideaVault");
    } catch {}
    try {
      localStorage.clear();
    } catch {}
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("svg#cv", { state: "attached", timeout: 15_000 });
  await page.waitForSelector("#addBtn", { state: "visible", timeout: 15_000 });
  // Wait until the test hook is wired and load() has populated a canvas.
  await page.waitForFunction(
    () => !!window.__E2E && !!window.__E2E.state().canvases,
    null,
    { timeout: 15_000 }
  );
  // Remove the bootLog overlay so subsequent UI interactions aren't occluded
  // and screenshots are clean.
  await page.evaluate(() => document.getElementById("bootLog")?.remove());
}

async function canvasCount(page: Page): Promise<number> {
  return await page.evaluate(
    () => Object.keys(window.__E2E!.state().canvases).length
  );
}

async function totalNodeCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const s = window.__E2E!.state();
    return Object.keys(s.canvases).reduce(
      (sum, k) => sum + (s.canvases[k].nodes?.length || 0),
      0
    );
  });
}

// --------------------------------------------------------------------------

test.describe("Phase 1 · Task 1.0 · Blocker bug repros", () => {
  // -- Bug #1: Full-state Import silently fails -------------------------------

  test("1.1 Importing disc_math full-state populates 17 canvases and 279 nodes", async ({
    page,
  }) => {
    await openCleanApp(page);

    expect(await canvasCount(page)).toBe(1); // only 'vault' before import

    await page.setInputFiles("#imp", discMathJson);

    await expect
      .poll(() => canvasCount(page), {
        message: "Expected 17 canvases in state after importing disc_math",
        timeout: 10_000,
      })
      .toBe(17);

    expect(await totalNodeCount(page)).toBe(279);

    // saveInd should not be red after a successful import.
    const saveIndClass = await page.evaluate(
      () => document.getElementById("saveInd")?.className ?? ""
    );
    expect(saveIndClass).not.toContain("s-err");
  });

  test("1.1 Importing TRADING REAL populates 7 canvases and switches current to algo-exec-2026", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.setInputFiles("#imp", tradingJson);

    await expect
      .poll(() => canvasCount(page), {
        message: "Expected 7 canvases in state after importing TRADING REAL",
        timeout: 10_000,
      })
      .toBe(7);

    const current = await page.evaluate(() => window.__E2E!.state().current);
    expect(current).toBe("algo-exec-2026");
  });

  test("1.1 More → Import full state menu item opens the native file picker (UI path, iPad-safe)", async ({
    page,
  }) => {
    // Why this test exists: the previous 1.1 tests drive the input directly
    // via page.setInputFiles('#imp', ...) which bypasses the UI chain entirely.
    // The *actual* iPad bug is that the More-menu item runs
    // `document.getElementById('imp').click()` from an onclick handler, and
    // iOS Safari blocks synthetic .click() on a hidden file input because the
    // user-gesture activation doesn't propagate through the JS hop.
    // Fix is to swap the menu item to a <label for="imp"> — clicking a label
    // is treated as a gesture on the associated input by the browser, so the
    // picker opens correctly on iOS.
    // This test drives the real UI path (tap More → tap Import) and expects
    // the 'filechooser' Playwright event to fire. That event fires whenever
    // the browser would show a native file picker, which is exactly what a
    // label[for] activation triggers.
    await openCleanApp(page);

    await page.click("#moreBtn");
    await expect(page.locator("#more.on")).toBeVisible();

    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 5_000 }),
      page.locator("#moreBody").getByText("Import full state").click(),
    ]);

    // Provide a file so the picker path completes end-to-end and imF runs.
    await chooser.setFiles(discMathJson);

    await expect
      .poll(() => canvasCount(page), {
        message:
          "Expected 17 canvases after picking disc_math through the More → Import chain",
        timeout: 10_000,
      })
      .toBe(17);
  });

  test("1.1 Import menu items are label[for=…] (preserve the iOS user-gesture chain)", async ({
    page,
  }) => {
    // Structural guard: after the label-based fix, the two Import menu items
    // must be <label> elements whose for= points at the corresponding hidden
    // file input. This is what makes the More → Import flow reliable on iOS
    // Safari (synthetic .click() on the input from a JS onclick handler is
    // blocked by the engine's user-gesture rules).
    await openCleanApp(page);

    await page.click("#moreBtn");
    await expect(page.locator("#more.on")).toBeVisible();

    const info = await page.evaluate(() => {
      const imp = document.getElementById("imp") as HTMLInputElement | null;
      const impC = document.getElementById("impC") as HTMLInputElement | null;
      const body = document.getElementById("moreBody");
      if (!imp || !impC || !body) {
        return { ok: false, reason: "missing #imp, #impC, or #moreBody" };
      }
      // Find the menu item for "Import full state" and "Import into this
      // canvas" by text, independent of the English/Hebrew labels.
      const hits = Array.from(body.querySelectorAll("label"));
      const forAll = hits.find((l) => l.getAttribute("for") === "imp");
      const forCanvas = hits.find((l) => l.getAttribute("for") === "impC");
      // display:none inputs don't count as a visible gesture target on iOS.
      const impHidden = window.getComputedStyle(imp).display === "none";
      const impCHidden = window.getComputedStyle(impC).display === "none";
      return {
        ok: !!forAll && !!forCanvas && !impHidden && !impCHidden,
        hasForAll: !!forAll,
        hasForCanvas: !!forCanvas,
        impHidden,
        impCHidden,
      };
    });

    expect(
      info.ok,
      `Expected label[for=imp] and label[for=impC] in #moreBody, and file inputs not display:none. Got ${JSON.stringify(
        info
      )}`
    ).toBe(true);
  });

  test("1.1 Importing malformed JSON surfaces a visible error (no silent failure)", async ({
    page,
  }, testInfo) => {
    await openCleanApp(page);

    // Write a broken JSON file into the per-test output dir.
    const bad = path.join(testInfo.outputDir, "bad.json");
    fs.mkdirSync(path.dirname(bad), { recursive: true });
    fs.writeFileSync(bad, "{not valid json");

    let alertMsg = "";
    page.on("dialog", async (d) => {
      alertMsg = d.message();
      await d.dismiss();
    });
    const consoleErrors: string[] = [];
    page.on("pageerror", (err) => consoleErrors.push(err.message));

    await page.setInputFiles("#imp", bad);
    // Give the FileReader + error path a moment to surface.
    await page.waitForTimeout(1_000);

    const errorVisible = await page.evaluate(() => {
      const saveErr = document
        .getElementById("saveInd")
        ?.className.includes("s-err");
      // Phase 2.6 imF now catches parse errors and surfaces them via the
      // dark #dlg dialog (uiNotice) instead of letting them propagate to
      // window.onerror → #errBanner. Either signal counts as "visible".
      const dlgOpen = document.getElementById("dlg")?.classList.contains("on");
      const errBanner = !!document.getElementById("errBanner");
      return Boolean(saveErr || errBanner || dlgOpen);
    });

    // The user's #1 frustration is "I tap a button and nothing happens."
    // After the 1.1 fix, at minimum ONE of these signals must fire:
    //   - an alert / toast
    //   - saveInd going red (#s-err)
    //   - the errBanner overlay
    expect(
      Boolean(alertMsg) || errorVisible,
      `Expected visible error after importing malformed JSON. alertMsg=${JSON.stringify(
        alertMsg
      )} consoleErrors=${JSON.stringify(consoleErrors)}`
    ).toBe(true);
  });

  // -- Bug #2: Node positions scattered on import -----------------------------

  test("1.2 Imported node positions match source file within 1px", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.setInputFiles("#imp", discMathJson);

    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    // Pick 10 deterministic sample nodes from the first canvas of the source.
    const source = JSON.parse(fs.readFileSync(discMathJson, "utf8"));
    const sampleCanvases = Object.keys(source.canvases).slice(0, 3);
    type Sample = { canvas: string; id: number; x: number; y: number };
    const samples: Sample[] = [];
    for (const cid of sampleCanvases) {
      const nodes = source.canvases[cid].nodes ?? [];
      for (const n of nodes.slice(0, 4)) {
        samples.push({ canvas: cid, id: n.id, x: n.x, y: n.y });
      }
    }
    expect(samples.length).toBeGreaterThan(0);

    const actual: (Sample | null)[] = await page.evaluate((ss) => {
      const s = window.__E2E!.state();
      return ss.map((sample) => {
        const c = s.canvases[sample.canvas];
        if (!c) return null;
        const n = c.nodes.find((x: any) => x.id === sample.id);
        return n
          ? { canvas: sample.canvas, id: n.id, x: n.x, y: n.y }
          : null;
      });
    }, samples);

    for (let i = 0; i < samples.length; i++) {
      const exp = samples[i];
      const got = actual[i];
      expect(got, `sample ${exp.canvas}#${exp.id} not found in imported state`).not.toBeNull();
      expect(Math.abs(got!.x - exp.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(got!.y - exp.y)).toBeLessThanOrEqual(1);
    }
  });

  test("1.2 After import, the viewport auto-fits so current-canvas content is visible", async ({
    page,
  }) => {
    // Per the user's clarification on bug #2: the imported positions are
    // fine in the data model; what looks like "scattered" nodes is actually
    // the viewport staying at its pre-import origin/zoom while the imported
    // content lives far outside the visible region. Fix: after a successful
    // import, call zF() so the view auto-fits the current canvas.
    await openCleanApp(page);

    await page.setInputFiles("#imp", discMathJson);
    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    // Read the current canvas' data-model node count, then count how many
    // <g.node> elements in the DOM have a bounding rect that intersects the
    // viewport (inner window). On a correctly auto-fitted view, most nodes
    // on the current canvas should be visible; with no fit, the view sits
    // at {x:0, y:0, k:.5} which rarely intersects the imported cluster.
    const stats = await page.evaluate(() => {
      const s = window.__E2E!.state();
      const cur = s.canvases[s.current];
      const total = cur?.nodes?.length ?? 0;
      const W = window.innerWidth,
        H = window.innerHeight;
      const nodes = Array.from(document.querySelectorAll<SVGGElement>("svg#cv g.node"));
      let inside = 0;
      for (const g of nodes) {
        const r = g.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right < 0 || r.left > W || r.bottom < 0 || r.top > H) continue;
        inside++;
      }
      return { total, rendered: nodes.length, inside, view: window.__E2E!.view() };
    });

    expect(stats.total, "current canvas should contain imported nodes").toBeGreaterThan(0);
    // Require "most" — at least half — of current-canvas nodes to be inside
    // the viewport. Being strict (all of them) is brittle for canvases with
    // wide spreads; the auto-fit's job is to make the bulk visible.
    expect(
      stats.inside,
      `Expected most current-canvas nodes inside viewport after auto-fit. stats=${JSON.stringify(
        stats
      )}`
    ).toBeGreaterThanOrEqual(Math.max(1, Math.floor(stats.rendered / 2)));
  });

  // -- Bug #3: LaTeX does not render on canvas --------------------------------

  test("1.3 Non-compact formula node on canvas renders KaTeX after import", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.setInputFiles("#imp", discMathJson);
    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    // Compact formula nodes render as a "ƒ" glyph (no `.fnode[data-latex]`).
    // Only non-compact formulas go through the KaTeX render path, so filter
    // explicitly.
    const switched = await page.evaluate(() => {
      const s = window.__E2E!.state();
      for (const k of Object.keys(s.canvases)) {
        const hasFormula = (s.canvases[k].nodes || []).some(
          (n: any) => n.shape === "formula" && n.latex && !n.compact
        );
        if (hasFormula) {
          return window.__E2E!.setCurrentCanvas(k) ? k : null;
        }
      }
      return null;
    });

    expect(
      switched,
      "disc_math fixture is expected to contain at least one non-compact formula node"
    ).not.toBeNull();

    // D3 · Phase 1.6 — formula content moved to #canvasOverlay (HTML layer)
    // because iOS WebKit won't paint HTML inside <foreignObject>. The DOM
    // selector updates accordingly; the invariant (KaTeX renders inside a
    // .fnode box after a formula-bearing canvas is visible) is unchanged.
    await expect
      .poll(() => page.locator("#canvasOverlay .fnode .katex").count(), {
        message:
          "Expected at least one .katex element inside an overlay .fnode",
        timeout: 5_000,
      })
      .toBeGreaterThan(0);
  });

  test("1.3 Inline math ($x^2$) in a note body renders KaTeX on the canvas", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.evaluate(() => {
      const cur = window.__E2E!.current();
      const zoneId = cur.zones[0]?.id ?? "ideas";
      window.__E2E!.addNodeRaw({
        id: 9995,
        x: 0,
        y: 0,
        zone: zoneId,
        shape: "note",
        status: "idea",
        label: "Math note",
        notes: "Pythagoras: $x^2 + y^2 = r^2$ and a display: $$\\int f\\,dx$$",
      });
    });

    await expect
      .poll(
        () =>
          page
            .locator('#canvasOverlay .nslice[data-nid="9995"] .note-body .katex')
            .count(),
        {
          message:
            "Expected inline math in note body to be rendered by KaTeX auto-render",
          timeout: 5_000,
        }
      )
      .toBeGreaterThan(0);
  });

  // -- Bug #4: Note overflow --------------------------------------------------

  test("1.4 Long-body note is contained — inner scroll, no visual spill", async ({
    page,
  }) => {
    await openCleanApp(page);

    const longBody = Array.from(
      { length: 60 },
      (_, i) => `Line ${i + 1} — quick brown fox jumps over the lazy dog.`
    ).join("\n");

    await page.evaluate(
      ({ body }) => {
        const cur = window.__E2E!.current();
        const zoneId = cur.zones[0]?.id ?? "ideas";
        window.__E2E!.addNodeRaw({
          id: 9991,
          x: 0,
          y: 0,
          zone: zoneId,
          shape: "note",
          status: "idea",
          label: "Long note",
          notes: body,
          userW: 140,
          userH: 90,
        });
      },
      { body: longBody }
    );

    const overflowHandled = await page.evaluate(() => {
      const noteBody = document.querySelector(
        '#canvasOverlay .nslice[data-nid="9991"] .note-body'
      ) as HTMLElement | null;
      if (!noteBody) return { ok: false, reason: "note body not found" };
      const style = getComputedStyle(noteBody);
      const scrolls = noteBody.scrollHeight > noteBody.clientHeight + 1;
      const overflowAuto =
        style.overflow === "auto" ||
        style.overflowY === "auto" ||
        style.overflow === "scroll" ||
        style.overflowY === "scroll";
      return {
        ok: scrolls && overflowAuto,
        scrolls,
        overflowAuto,
        scrollHeight: noteBody.scrollHeight,
        clientHeight: noteBody.clientHeight,
      };
    });

    expect(
      overflowHandled.ok,
      `Expected long-body note to be contained with inner scrolling. Got ${JSON.stringify(
        overflowHandled
      )}`
    ).toBe(true);
  });

  // -- Bug #5: Markdown not rendered ------------------------------------------

  test("1.5 Markdown: **bold**, *italic*, and # Heading render as HTML tags", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.evaluate(() => {
      const cur = window.__E2E!.current();
      const zoneId = cur.zones[0]?.id ?? "ideas";
      window.__E2E!.addNodeRaw({
        id: 9992,
        x: 0,
        y: 0,
        zone: zoneId,
        shape: "note",
        status: "idea",
        label: "MD test",
        notes:
          "# Heading\n\nSome **bold** and *italic* and `code` text.\n\n- list item a\n- list item b",
      });
    });

    const md = await page.evaluate(() => {
      const el = document.querySelector(
        '#canvasOverlay .nslice[data-nid="9992"] [data-mathbody]'
      ) as HTMLElement | null;
      if (!el) return null;
      return {
        strong: !!el.querySelector("strong"),
        em: !!el.querySelector("em"),
        code: !!el.querySelector("code"),
        heading: !!el.querySelector("h1,h2,h3,h4,h5,h6"),
        list: !!el.querySelector("ul,ol"),
        html: el.innerHTML,
      };
    });

    expect(md, "Markdown test note not found in DOM").not.toBeNull();
    expect(md!.strong, `Expected <strong>; got: ${md!.html}`).toBe(true);
    expect(md!.em, `Expected <em>; got: ${md!.html}`).toBe(true);
    expect(md!.heading, `Expected heading tag; got: ${md!.html}`).toBe(true);
    expect(md!.list, `Expected list tag; got: ${md!.html}`).toBe(true);
  });

  test("1.5 Markdown preserves Hebrew RTL and mixed LTR numerals", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.evaluate(() => {
      const cur = window.__E2E!.current();
      const zoneId = cur.zones[0]?.id ?? "ideas";
      window.__E2E!.addNodeRaw({
        id: 9994,
        x: 0,
        y: 0,
        zone: zoneId,
        shape: "note",
        status: "idea",
        label: "HE test",
        // Hebrew with embedded LTR math; the dir should be rtl, math LTR.
        notes: "**שלום** — זו דוגמה עם מספר 42 ונוסחה $x^2 + y^2 = r^2$",
      });
    });

    const result = await page.evaluate(() => {
      const body = document.querySelector(
        '#canvasOverlay .nslice[data-nid="9994"] .note-body'
      ) as HTMLElement | null;
      if (!body) return null;
      const dir = getComputedStyle(body).direction;
      const strong = body.querySelector("strong");
      const hebrewText = strong?.textContent ?? "";
      return { dir, hebrewText };
    });

    expect(result).not.toBeNull();
    expect(result!.dir).toBe("rtl");
    expect(result!.hebrewText).toBe("שלום");
  });

  // -- XSS regression ---------------------------------------------------------

  test("1.6 XSS: <script> / onerror in note body renders as visible text, not executed", async ({
    page,
  }) => {
    await openCleanApp(page);

    let dialogFired = false;
    page.on("dialog", async (d) => {
      dialogFired = true;
      await d.dismiss();
    });

    await page.evaluate(() => {
      const cur = window.__E2E!.current();
      const zoneId = cur.zones[0]?.id ?? "ideas";
      window.__E2E!.addNodeRaw({
        id: 9993,
        x: 0,
        y: 0,
        zone: zoneId,
        shape: "note",
        status: "idea",
        label: "XSS test",
        notes:
          "<script>alert(1)</script><img src=x onerror=alert(2)><iframe src=javascript:alert(3)></iframe>",
      });
    });

    // Give any would-be JS a beat to execute (it shouldn't).
    await page.waitForTimeout(500);

    const inspection = await page.evaluate(() => {
      const el = document.querySelector(
        '#canvasOverlay .nslice[data-nid="9993"] [data-mathbody]'
      ) as HTMLElement | null;
      return {
        found: !!el,
        text: el?.textContent ?? "",
        hasScriptTag: !!el?.querySelector("script"),
        hasOnerrorImg: !!el?.querySelector("img[onerror]"),
        hasIframe: !!el?.querySelector("iframe"),
      };
    });

    expect(dialogFired, "No alert() should have fired from user content").toBe(
      false
    );
    expect(inspection.found).toBe(true);
    expect(
      inspection.text,
      `Literal <script>alert(1)</script> should be visible text. Got text=${JSON.stringify(
        inspection.text
      )}`
    ).toContain("<script>alert(1)</script>");
    expect(inspection.hasScriptTag).toBe(false);
    expect(inspection.hasOnerrorImg).toBe(false);
    expect(inspection.hasIframe).toBe(false);
  });

  // -- iPad hardening (1.6 a/b/c) ---------------------------------------------

  test("1.6a Shell is locked to viewport (position:fixed + overscroll-behavior:none)", async ({
    page,
  }) => {
    // Rubber-band / pull-to-refresh / scroll-chaining on iPad Safari can
    // translate the document under our canvas. Lock the shell so only the
    // app's own pan/zoom can move the view.
    await openCleanApp(page);
    const shell = await page.evaluate(() => {
      const bodyStyle = getComputedStyle(document.body);
      const htmlStyle = getComputedStyle(document.documentElement);
      // WebKit doesn't surface `overscroll-behavior` via getComputedStyle
      // the way Chromium does, so we assert on the applied stylesheet rule
      // directly as the load-bearing check for iPad Safari.
      let overscrollRuleApplied = false;
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules || [])) {
            const t = (rule as any).cssText || "";
            if (
              t.includes("overscroll-behavior:none") ||
              t.includes("overscroll-behavior: none")
            ) {
              overscrollRuleApplied = true;
              break;
            }
          }
        } catch {
          // cross-origin sheets throw on cssRules access — ignore.
        }
        if (overscrollRuleApplied) break;
      }
      return {
        bodyPosition: bodyStyle.position,
        htmlPosition: htmlStyle.position,
        bodyOverflow: bodyStyle.overflow,
        htmlOverflow: htmlStyle.overflow,
        overscrollRuleApplied,
      };
    });
    // The load-bearing iPad lock is position:fixed + overflow:hidden on
    // html+body — rubber-band is physically impossible when the shell can't
    // scroll. `overscroll-behavior:none` is the modern belt-and-braces add-on
    // but Playwright's bundled WebKit drops unrecognized properties from the
    // CSSOM, so we check it as a soft assertion (logged if missing, not a
    // hard fail on WebKit).
    expect(shell.bodyPosition).toBe("fixed");
    expect(shell.htmlPosition).toBe("fixed");
    expect(shell.bodyOverflow).toBe("hidden");
    expect(shell.htmlOverflow).toBe("hidden");
    if (!shell.overscrollRuleApplied) {
      // Only hard-fail on engines that *do* expose the rule (Chromium).
      const isChromium = await page.evaluate(
        () => !!(window as any).chrome || /Chrome\//.test(navigator.userAgent)
      );
      if (isChromium) {
        throw new Error(
          "overscroll-behavior:none rule missing from the applied stylesheet on Chromium (check src/app.css)"
        );
      }
    }
  });

  test("1.6b Canvas has touch-action:none and claims touch defaults (iPad Scribble/pinch hardening)", async ({
    page,
  }) => {
    await openCleanApp(page);
    const canvas = await page.evaluate(() => {
      const cv = document.getElementById("cv");
      if (!cv) return null;
      const cs = getComputedStyle(cv);
      return {
        touchAction: cs.touchAction,
        userSelect: cs.userSelect || (cs as any).webkitUserSelect,
      };
    });
    expect(canvas).not.toBeNull();
    expect(canvas!.touchAction).toBe("none");
  });

  test("1.6c Viewport culling keeps all in-view nodes mounted after import (correctness guard)", async ({
    page,
  }) => {
    // Culling is a perf optimization; it must not drop nodes the user can
    // actually see. After importing disc_math and switching to the canvas
    // with the most nodes, every data-layer node whose world-space bbox
    // intersects the current viewBox (+ the 200px screen-space margin)
    // must have a corresponding <g.node> element in the DOM.
    await openCleanApp(page);
    await page.setInputFiles("#imp", discMathJson);
    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    const result = await page.evaluate(() => {
      const state = window.__E2E!.state();
      // Switch to the canvas with the most nodes to maximize culling pressure.
      let biggest = state.current;
      let biggestN = 0;
      for (const k of Object.keys(state.canvases)) {
        const n = state.canvases[k].nodes?.length || 0;
        if (n > biggestN) {
          biggestN = n;
          biggest = k;
        }
      }
      window.__E2E!.setCurrentCanvas(biggest);
      const v = window.__E2E!.view();
      const W = window.innerWidth,
        H = window.innerHeight;
      const margin = 200 / v.k;
      const vx1 = -W / 2 / v.k - v.x - margin;
      const vy1 = -H / 2 / v.k - v.y - margin;
      const vx2 = vx1 + W / v.k + margin * 2;
      const vy2 = vy1 + H / v.k + margin * 2;
      const cur = window.__E2E!.current();
      const expectedInView: number[] = [];
      for (const n of cur.nodes) {
        const w = (n as any).userW || 80,
          h = (n as any).userH || 80;
        const nx1 = n.x - w,
          ny1 = n.y - h,
          nx2 = n.x + w,
          ny2 = n.y + h;
        const intersects =
          nx2 >= vx1 && nx1 <= vx2 && ny2 >= vy1 && ny1 <= vy2;
        if (intersects) expectedInView.push(n.id);
      }
      const missing = expectedInView.filter(
        (id) => !document.querySelector(`g.node[data-id="${id}"]`)
      );
      return {
        biggest,
        totalNodes: cur.nodes.length,
        expectedInView: expectedInView.length,
        missing: missing.slice(0, 20),
      };
    });

    expect(
      result.missing.length,
      `Culling dropped nodes that should be visible on "${result.biggest}" (${result.totalNodes} nodes, ${result.expectedInView} expected in viewport). Missing ids sample: ${JSON.stringify(
        result.missing
      )}`
    ).toBe(0);
  });

  // -- Paste-patch regression guard -------------------------------------------

  test("1.7 Paste-patch modal still opens after import (regression guard)", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.setInputFiles("#imp", discMathJson);
    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    await page.evaluate(() => window.showPatch?.());
    await expect(page.locator("#modal")).toBeVisible();

    // Close the modal so downstream tests (if any) aren't left with a blocker.
    await page.evaluate(() => window.closeModal?.());
  });

  // -- D5 regression guard — cross-layer z-stacking ---------------------------

  test("1.8 Overlay slice DOM order matches hit-rect DOM order (per-node z-stacking)", async ({
    page,
  }) => {
    // D5 · Phase 1.6 — before the per-node slice fix, every overlay child
    // (notes, formulas) lived as a sibling under #canvasOverlay; because the
    // overlay is a sibling of #cv, not a child, all of its content rendered
    // above every SVG shape regardless of which node was drawn on top of
    // which. Real iPad then showed note A's body painted ON TOP of note B's
    // SVG background even when B was drawn AFTER A. The fix co-locates each
    // node's shape + content inside a single .nslice div so the stacking
    // context is per-node, and the slice DOM order exactly mirrors the
    // hit-rect DOM order in #cv. This test guards that invariant at the
    // DOM level — Playwright can't catch the iOS paint bug, but it *can*
    // catch a render() that regresses ordering between the two trees.
    await openCleanApp(page);

    await page.evaluate(() => {
      const cur = window.__E2E!.current();
      const zoneId = cur.zones[0]?.id ?? "ideas";
      // Two overlapping notes + one formula so we exercise both rich shapes.
      window.__E2E!.addNodeRaw({ id: 9881, x: 0, y: 0, zone: zoneId, shape: "note", status: "idea", label: "A", notes: "back" });
      window.__E2E!.addNodeRaw({ id: 9882, x: 20, y: 20, zone: zoneId, shape: "note", status: "idea", label: "B", notes: "front" });
      window.__E2E!.addNodeRaw({ id: 9883, x: 40, y: 40, zone: zoneId, shape: "formula", status: "idea", label: "F", latex: "x^2" });
      window.render();
    });

    const result = await page.evaluate(() => {
      const hitIds = Array.from(
        document.querySelectorAll<SVGGElement>("#cv g.node")
      ).map((g) => g.getAttribute("data-id"));
      const sliceIds = Array.from(
        document.querySelectorAll<HTMLElement>("#canvasOverlay .nslice")
      ).map((d) => d.getAttribute("data-nid"));
      return { hitIds, sliceIds };
    });

    // Every in-DOM node must have a matching slice, in the same order.
    expect(result.sliceIds).toEqual(result.hitIds);
    // Sanity check: our three added nodes are all present.
    for (const id of ["9881", "9882", "9883"]) {
      expect(result.hitIds).toContain(id);
      expect(result.sliceIds).toContain(id);
    }
  });
});
