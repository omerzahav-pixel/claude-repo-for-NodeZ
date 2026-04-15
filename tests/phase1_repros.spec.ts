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
      const errBanner = !!document.getElementById("errBanner");
      return Boolean(saveErr || errBanner);
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

  // -- Bug #3: LaTeX does not render on canvas --------------------------------

  test("1.3 Formula node on canvas renders KaTeX on first paint after import", async ({
    page,
  }) => {
    await openCleanApp(page);

    await page.setInputFiles("#imp", discMathJson);
    await expect
      .poll(() => canvasCount(page), { timeout: 10_000 })
      .toBe(17);

    // Navigate to a canvas that contains at least one formula node with latex.
    const switched = await page.evaluate(() => {
      const s = window.__E2E!.state();
      for (const k of Object.keys(s.canvases)) {
        const hasFormula = (s.canvases[k].nodes || []).some(
          (n: any) => n.shape === "formula" && n.latex
        );
        if (hasFormula) {
          return window.__E2E!.setCurrentCanvas(k) ? k : null;
        }
      }
      return null;
    });

    expect(
      switched,
      "disc_math fixture is expected to contain at least one formula node with latex"
    ).not.toBeNull();

    // Wait for KaTeX to render inside the canvas svg.
    await expect
      .poll(() => page.locator("svg#cv .fnode .katex").count(), {
        message:
          "Expected at least one .katex element inside a .fnode on the canvas",
        timeout: 5_000,
      })
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
        'g.node[data-id="9991"] .note-body'
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
        'g.node[data-id="9992"] [data-mathbody]'
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
        'g.node[data-id="9994"] .note-body'
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
        'g.node[data-id="9993"] [data-mathbody]'
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
});
