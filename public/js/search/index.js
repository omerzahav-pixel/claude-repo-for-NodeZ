/* =============================================================================
 * EdgeSpace · Sprint 3 · In-memory search index (Pass 4 § 02 supports).
 *
 * Indexes nodes / canvases / commands / workspaces for the ⌘K palette.
 * Fuzzy matcher returns scored hits with character-position matches so
 * the palette can render <mark> highlights.
 *
 * We keep the index in memory (rebuilt on every workspace switch or
 * material mutation). For a 2k-node workspace this fits in < 200 KB
 * and search latency is < 5 ms; no need to push into IDB yet.
 *
 * Public:
 *   SearchIndex.rebuild()            — read from window.__E2E.state()
 *   SearchIndex.search(query, opts)  — returns scored hit array
 *
 * Hit shape:
 *   { kind, id, label, sub, score, matches: [[i, j], ...], action }
 *     - kind: 'node' | 'canvas' | 'workspace' | 'command' | 'recent'
 *     - sub : secondary line (canvas name for nodes, etc.)
 *     - action: () => void  — what to do when the user picks this hit
 * ============================================================================= */

(function () {
  'use strict';

  let nodeIndex = [];        // {id, label, lc, sub, canvas}
  let canvasIndex = [];      // {id, name, lc}
  let workspaceIndex = [];   // {name, lc}
  let commandIndex = [];     // {name, lc, action}
  let recentIndex = [];      // {id, name, lc, ts}

  const RECENT_KEY = 'edgespace-recent-canvases';
  const RECENT_MAX = 25;

  function loadRecents() {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function saveRecents() {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recentIndex.slice(0, RECENT_MAX))); } catch (e) {}
  }
  function bumpRecent(canvasId, name) {
    recentIndex = recentIndex.filter(r => r.id !== canvasId);
    recentIndex.unshift({ id: canvasId, name, lc: String(name || '').toLowerCase(), ts: Date.now() });
    recentIndex = recentIndex.slice(0, RECENT_MAX);
    saveRecents();
  }

  function rebuildNodes() {
    nodeIndex = [];
    if (typeof window.__E2E === 'undefined') return;
    const S = window.__E2E.state();
    if (!S || !S.canvases) return;
    for (const [cid, c] of Object.entries(S.canvases)) {
      const canvasName = S.canvasMeta?.[cid]?.name || cid;
      for (const n of (c.nodes || [])) {
        const label = n.label || '(untitled)';
        nodeIndex.push({
          id: n.id, canvas: cid, label, sub: canvasName,
          lc: (String(label) + ' ' + String(n.notes || '') + ' ' + String(n.tags || '')).toLowerCase(),
          shape: n.shape, status: n.status
        });
      }
    }
  }
  function rebuildCanvases() {
    canvasIndex = [];
    if (typeof window.__E2E === 'undefined') return;
    const S = window.__E2E.state();
    if (!S || !S.canvases) return;
    for (const cid of Object.keys(S.canvases)) {
      const name = S.canvasMeta?.[cid]?.name || cid;
      canvasIndex.push({ id: cid, name, lc: String(name).toLowerCase() });
    }
  }
  async function rebuildWorkspaces() {
    workspaceIndex = [];
    if (typeof window.listWorkspaces !== 'function') return;
    try {
      const list = await window.listWorkspaces();
      for (const ws of list) workspaceIndex.push({ name: ws, lc: String(ws).toLowerCase() });
    } catch (e) {}
  }
  function rebuildCommands() {
    commandIndex = [
      { name: 'Add node',                lc: 'add node',                action: () => window.addC && window.addC() },
      { name: 'Add zone',                lc: 'add zone',                action: () => window.addZoneCenter && window.addZoneCenter() },
      { name: 'Fit view',                lc: 'fit view',                action: () => window.zF && window.zF() },
      { name: 'Toggle Hebrew (RTL)',     lc: 'toggle hebrew rtl',       action: () => window.toggleHebrew && window.toggleHebrew() },
      { name: 'Toggle dim edges',       lc: 'toggle dim edges',        action: () => window.toggleDimEdges && window.toggleDimEdges() },
      { name: 'Export full state',       lc: 'export full state',       action: () => window.ex && window.ex() },
      { name: 'Export this canvas',     lc: 'export this canvas',      action: () => window.exCanvas && window.exCanvas() },
      { name: 'Paste patch JSON',       lc: 'paste patch json',        action: () => window.showPatch && window.showPatch() },
      { name: 'Show legend',            lc: 'show legend',             action: () => window.toggleLegend && window.toggleLegend() },
      { name: 'New workspace',          lc: 'new workspace',           action: () => window.newWorkspace && window.newWorkspace() },
      { name: 'Switch to vault',        lc: 'switch to vault',         action: () => window.switchTo && window.switchTo('vault') },
      { name: 'Undo',                   lc: 'undo',                    action: () => window.un && window.un() },
      { name: 'Redo',                   lc: 'redo',                    action: () => window.re && window.re() }
    ];
  }

  async function rebuild() {
    // Commands first (synchronous, hard-coded) so consumers that don't await
    // rebuild() still get a populated commandIndex immediately.
    rebuildCommands();
    rebuildNodes();
    rebuildCanvases();
    if (!recentIndex.length) recentIndex = loadRecents();
    await rebuildWorkspaces();
  }

  /** Fuzzy match: returns score (higher = better) + positions. */
  function fuzzyMatch(needle, haystack) {
    if (!needle) return { score: 0.5, matches: [] };
    if (!haystack) return null;
    const nLow = needle.toLowerCase();
    const hLow = haystack.toLowerCase();
    // Exact substring is the highest score.
    const exactIdx = hLow.indexOf(nLow);
    if (exactIdx !== -1) {
      const matches = [];
      for (let i = 0; i < nLow.length; i++) matches.push(exactIdx + i);
      // Score: bonus for prefix match + density.
      let score = 100 + (nLow.length / hLow.length) * 30;
      if (exactIdx === 0) score += 50;
      return { score, matches };
    }
    // Subsequence match (each needle char appears in order).
    const matches = [];
    let h = 0;
    for (let n = 0; n < nLow.length; n++) {
      const c = nLow[n];
      while (h < hLow.length && hLow[h] !== c) h++;
      if (h >= hLow.length) return null;
      matches.push(h);
      h++;
    }
    // Score: subsequence density + early-match bonus.
    const span = matches[matches.length - 1] - matches[0] + 1;
    const density = nLow.length / span;
    let score = 40 * density - matches[0] * 0.5;
    if (matches[0] === 0) score += 15;
    return { score, matches };
  }

  /**
   * Parse a query for inline prefix filters:
   *   @node:xxx    → kind=node, q=xxx
   *   #canvas:xxx  → kind=canvas, q=xxx
   *   >cmd:xxx     → kind=command, q=xxx
   *   !status:done → kind=node, statusFilter=done
   */
  function parseQuery(raw) {
    let kind = null, statusFilter = null, q = raw.trim();
    const at = q.match(/^@(node|canvas|workspace|cmd|command|recent):\s*(.*)$/i);
    if (at) { kind = at[1].toLowerCase().replace('command', 'cmd'); q = at[2]; }
    const hash = q.match(/^#(canvas|node|workspace|cmd|recent):\s*(.*)$/i);
    if (hash) { kind = hash[1].toLowerCase(); q = hash[2]; }
    const cmd = q.match(/^>(cmd|command):\s*(.*)$/i);
    if (cmd) { kind = 'cmd'; q = cmd[2]; }
    const bang = q.match(/^!status:\s*(\S+)\s*(.*)$/i);
    if (bang) { kind = kind || 'node'; statusFilter = bang[1].toLowerCase(); q = bang[2]; }
    return { kind, statusFilter, q };
  }

  function search(rawQuery, opts) {
    opts = opts || {};
    const max = opts.max || 30;
    const { kind, statusFilter, q } = parseQuery(rawQuery || '');
    const hits = [];

    function pushNodes() {
      for (const n of nodeIndex) {
        if (statusFilter && n.status !== statusFilter) continue;
        const m = fuzzyMatch(q, n.label);
        if (!m) continue;
        hits.push({
          kind: 'node', id: n.id, label: n.label, sub: n.sub, score: m.score, matches: m.matches,
          action: () => {
            if (typeof window.switchTo === 'function' && n.canvas !== window.__E2E.state().current) window.switchTo(n.canvas);
            requestAnimationFrame(() => {
              if (typeof window.focusNode === 'function') window.focusNode(n.id);
            });
          }
        });
      }
    }
    function pushCanvases() {
      for (const c of canvasIndex) {
        const m = fuzzyMatch(q, c.name);
        if (!m) continue;
        hits.push({
          kind: 'canvas', id: c.id, label: c.name, sub: 'canvas', score: m.score + 5, matches: m.matches,
          action: () => { if (typeof window.switchTo === 'function') window.switchTo(c.id); }
        });
      }
    }
    function pushWorkspaces() {
      for (const ws of workspaceIndex) {
        const m = fuzzyMatch(q, ws.name);
        if (!m) continue;
        hits.push({
          kind: 'workspace', id: ws.name, label: ws.name, sub: 'workspace', score: m.score + 3, matches: m.matches,
          action: () => { if (typeof window.switchWorkspace === 'function') window.switchWorkspace(ws.name); }
        });
      }
    }
    function pushCommands() {
      for (const c of commandIndex) {
        const m = fuzzyMatch(q, c.name);
        if (!m) continue;
        hits.push({
          kind: 'command', id: c.name, label: c.name, sub: 'command', score: m.score, matches: m.matches,
          action: c.action
        });
      }
    }
    function pushRecents() {
      const recents = recentIndex;
      for (let i = 0; i < recents.length; i++) {
        const r = recents[i];
        const m = q ? fuzzyMatch(q, r.name) : { score: 100 - i, matches: [] };
        if (!m) continue;
        hits.push({
          kind: 'recent', id: r.id, label: r.name, sub: 'recent', score: m.score, matches: m.matches,
          action: () => { if (typeof window.switchTo === 'function') window.switchTo(r.id); }
        });
      }
    }

    if (!kind) {
      pushNodes(); pushCanvases(); pushWorkspaces(); pushCommands();
      if (!q) pushRecents();
    } else {
      if (kind === 'node')     pushNodes();
      if (kind === 'canvas')   pushCanvases();
      if (kind === 'workspace')pushWorkspaces();
      if (kind === 'cmd')      pushCommands();
      if (kind === 'recent')   pushRecents();
    }
    hits.sort((a, b) => b.score - a.score);
    return hits.slice(0, max);
  }

  // Pre-populate commands and recents at module load so the palette is
  // useful before any explicit rebuild().
  rebuildCommands();
  recentIndex = loadRecents();

  window.SearchIndex = Object.freeze({
    rebuild, search, bumpRecent,
    recents: () => recentIndex.slice()
  });
})();
