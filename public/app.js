// ============================================================================
// Phase 1.5 · On-screen diagnostics for real-iPad debugging (bugs #1/#3/#5).
// iPad Safari console access is painful — render log lines directly into the
// DOM (bottom-right overlay) so Azamat can read them on the deployed URL
// without plugging into a Mac. Auto-on unless URL has ?nodbg; tap × to close.
// Sections: IMPORT (orange) · KATEX (green) · MD (purple) · SYS (gray).
// ============================================================================
(function(){
  // Phase 5b — diag overlay hidden by default for normal users. Opt-in via
  // ?diag=1 in URL, or Ctrl+Shift+D hotkey (wired later). Playwright stays
  // suppressed via navigator.webdriver. ?nodbg still force-disables.
  if(typeof location!=='undefined'&&location.search.indexOf('nodbg')>=0)return;
  if(typeof navigator!=='undefined'&&navigator.webdriver)return;
  var optIn=typeof location!=='undefined'&&location.search.indexOf('diag=1')>=0;
  if(!optIn){
    // Still register window.dbg so code using it doesn't crash, but skip the panel.
    window.dbg=function(){};
    // Allow Ctrl+Shift+D to activate retroactively.
    document.addEventListener('keydown',function _dk(e){if(e.ctrlKey&&e.shiftKey&&e.key==='D'){e.preventDefault();document.removeEventListener('keydown',_dk);location.search=(location.search?location.search+'&':'?')+'diag=1'}});
    return;
  }
  var SC2={IMPORT:'#d97757',KATEX:'#7db36a',MD:'#c48a9b',SYS:'#8a8478'};
  var t0=Date.now(),panel=null,body=null,collapsed=false,queue=[];
  function esc2(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function ensure(){
    if(panel||!document.body)return;
    panel=document.createElement('div');
    panel.id='dbgPanel';
    panel.style.cssText='position:fixed;right:8px;bottom:8px;width:min(360px,calc(100vw - 16px));max-height:45vh;z-index:99999;background:rgba(15,15,15,.95);border:1px solid #d97757;border-radius:8px;color:#e8dfce;font:10px/1.35 ui-monospace,Menlo,Consolas,monospace;display:flex;flex-direction:column;box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:auto';
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;gap:8px;padding:4px 8px;border-bottom:1px solid #333333;background:#181A1B;border-radius:8px 8px 0 0;font-weight:600;font-size:11px;flex-shrink:0;-webkit-user-select:none;user-select:none';
    hdr.innerHTML='<span style="color:#d97757">◆</span><span>diag</span><span style="flex:1"></span><span id="dbgTog" style="cursor:pointer;padding:4px 8px;color:#8a8478">▾</span><span id="dbgClr" style="cursor:pointer;padding:4px 8px;color:#8a8478">clr</span><span id="dbgX" style="cursor:pointer;padding:4px 8px;color:#8a8478">×</span>';
    body=document.createElement('div');
    body.id='dbgBody';
    body.style.cssText='flex:1;overflow-y:auto;padding:8px;-webkit-overflow-scrolling:touch';
    panel.appendChild(hdr);panel.appendChild(body);
    document.body.appendChild(panel);
    hdr.querySelector('#dbgTog').onclick=function(){collapsed=!collapsed;body.style.display=collapsed?'none':'block';hdr.querySelector('#dbgTog').textContent=collapsed?'▸':'▾'};
    hdr.querySelector('#dbgClr').onclick=function(){body.innerHTML=''};
    hdr.querySelector('#dbgX').onclick=function(){panel.remove();panel=null;body=null};
    // Flush queued pre-DOM calls.
    for(var i=0;i<queue.length;i++)dbgRender(queue[i][0],queue[i][1]);
    queue=[];
  }
  function dbgRender(section,msg){
    if(!body)return;
    var ms=Date.now()-t0;
    var color=SC2[section]||'#8a8478';
    var row=document.createElement('div');
    row.style.cssText='margin:1px 0;white-space:pre-wrap;word-break:break-word';
    var tpad=String(ms);while(tpad.length<5)tpad=' '+tpad;
    row.innerHTML='<span style="color:#544e45">'+tpad+'</span> <span style="color:'+color+';font-weight:700">'+section+'</span> '+esc2(msg);
    body.appendChild(row);
    body.scrollTop=body.scrollHeight;
  }
  function dbg(section,msg){
    try{
      if(!document.body){queue.push([section,msg]);return}
      ensure();
      dbgRender(section,msg);
    }catch(e){}
  }
  window.dbg=dbg;
  // Surface uncaught errors so iPad-only exceptions show up in the log.
  window.addEventListener('error',function(e){dbg('SYS','ERROR: '+(e.message||'?')+(e.filename?' @ '+String(e.filename).split('/').pop()+':'+e.lineno:''))});
  window.addEventListener('unhandledrejection',function(e){dbg('SYS','PROMISE: '+((e.reason&&e.reason.message)||e.reason||'?'))});
  // Snapshot the environment as the first line so we can tell desktop vs real
  // iPad apart in screenshots the user sends back.
  var ua=navigator.userAgent;
  var isIpadLike=/iPad|iPhone|iPod/.test(ua)||(navigator.maxTouchPoints>1&&/Mac/.test(ua));
  dbg('SYS','boot · '+(isIpadLike?'iPad-class':'desktop')+' · '+ua.slice(0,90));
  dbg('SYS','KaTeX script tag: '+(document.querySelector('script[src*="katex"]')?'present':'MISSING'));
  dbg('SYS','autoRender script tag: '+(document.querySelector('script[src*="auto-render"]')?'present':'MISSING'));
  // Confirm that when the CDNs actually resolve (defer), the globals land.
  window.addEventListener('load',function(){
    dbg('SYS','load · window.katex: '+(window.katex?'present':'MISSING')+' · renderMathInElement: '+(window.renderMathInElement?'present':'MISSING'));
  });
})();
/* Phase 6 · version + error-boundary glue. EDGESPACE_VERSION bumps on every
   user-facing release; EDGESPACE_BUILD is wired to git short SHA at deploy
   time (TODO: vite plugin). For now bumped manually on each phase. */
const EDGESPACE_VERSION='2.1.0';
const EDGESPACE_BUILD='phase-6';
window.EDGESPACE_VERSION=EDGESPACE_VERSION;window.EDGESPACE_BUILD=EDGESPACE_BUILD;
(function(){const tag=document.getElementById('versionTag');if(tag)tag.textContent='v'+EDGESPACE_VERSION+' · '+EDGESPACE_BUILD})();
/* Boot-time error boundary. If app.js fails to parse / execute the inline
   <script src="./app.js"> never finishes; window.onerror catches it and
   shows the fallback UI so the user has somewhere to go besides a blank
   screen. The fallback also offers cache-clear-and-reload as a recovery. */
let _bootCompleted=false;
window.addEventListener('error',function(e){
  if(_bootCompleted)return;
  const eb=document.getElementById('errorBoundary');const msg=document.getElementById('errorBoundaryMsg');
  if(!eb||!msg)return;
  msg.textContent=(e.message||'Unknown error')+'\nv'+EDGESPACE_VERSION+' · '+EDGESPACE_BUILD+'\n'+(e.filename||'')+(e.lineno?':'+e.lineno:'')+'\nUA: '+navigator.userAgent.slice(0,160);
  eb.style.display='block';
  document.getElementById('errorBoundaryReload').onclick=async function(){
    try{if('serviceWorker' in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs)await r.unregister()}}catch(e){}
    try{indexedDB.deleteDatabase('ideaVault')}catch(e){}
    try{localStorage.clear();sessionStorage.clear()}catch(e){}
    location.reload();
  };
  document.getElementById('errorBoundaryDismiss').onclick=function(){eb.style.display='none'};
});
const DZ={vault:[{id:'ideas',name:'Ideas',x:-1100,y:-500,w:700,h:520,color:'#6fa8d3'},{id:'projects',name:'Projects',x:-350,y:-500,w:700,h:520,color:'#c9896a'},{id:'inbox',name:'Inbox',x:400,y:-500,w:520,h:520,color:'#7d7569'}]};
const RMZ=[{id:'blockers',name:'Blockers',x:-1000,y:-500,w:600,h:400,color:'#d96b5a'},{id:'flight',name:'In Flight',x:-350,y:-500,w:600,h:400,color:'#6fa8d3'},{id:'next',name:'Next Up',x:300,y:-500,w:550,h:400,color:'#d4a855'},{id:'backlog',name:'Backlog',x:-1000,y:-70,w:600,h:400,color:'#8a8478'},{id:'done',name:'Done',x:-350,y:-70,w:600,h:400,color:'#7db36a'},{id:'principles',name:'Principles',x:300,y:-70,w:550,h:400,color:'#c48a9b'}];
const SH=['project','idea','principle','resource','question','experiment','library','doc','formula','note'],ST=['done','progress','pending','blocked','idea'];
const SC={done:'#7db36a',progress:'#6fa8d3',pending:'#d4a855',blocked:'#d96b5a',idea:'#8a8478'},SL={done:'Done',progress:'In Progress',pending:'Pending',blocked:'Blocked',idea:'Idea'};
const ET={blocker:{c:'#d96b5a',d:'',l:'Blocker'},feeds:{c:'#8a8478',d:'',l:'Feeds into'},related:{c:'#6fa8d3',d:'',l:'Related'},derived:{c:'#7db36a',d:'',l:'Derived from'},example:{c:'#e6c84e',d:'',l:'Example'},proof:{c:'#b85450',d:'',l:'Proof'},arrow:{c:'#e8dfce',d:'',l:'Arrow'},custom:{c:'#d97757',d:'',l:'Custom'}};
let S={canvases:{vault:{nodes:[],edges:[],zones:[]}},current:'vault',canvasMeta:{vault:{name:'Vault',parentNodeId:null}},nextId:1,hebrewMode:false};
let view={x:0,y:0,k:.5},hist=[],redoStack=[],sel=null,drag=null,edgeHover=null,selSet=new Set(),marquee=null;
const cv=document.getElementById('cv'),pn=document.getElementById('pn'),ctx=document.getElementById('ctx'),ep=document.getElementById('ep'),bc=document.getElementById('bc'),modal=document.getElementById('modal');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);

/* =========================================================================
 * Phase 1.7 · In-app dialog component — replaces native prompt/confirm/alert.
 *
 * iOS Safari renders native system dialogs in light mode even when the host
 * app is dark, which looks off-brand. These three promise-based helpers
 * emit a dark-themed modal (#dlg) that matches the rest of the UI.
 *
 *   await uiPrompt(title, defaultValue, {hint, placeholder, multiline})
 *       → string | null   (null on Esc / Cancel / outside-click)
 *   await uiConfirm(message, {title, okLabel, cancelLabel, danger})
 *       → boolean         (false on Esc / Cancel / outside-click)
 *   await uiNotice(message, {title})
 *       → undefined       (resolved on OK / Esc / outside-click)
 *
 * Layering: #dlg sits at z-index 70, above #modal (60) so a confirm can
 * appear on top of the paste-patch modal ("parent node not found…").
 *
 * XSS: every caller-supplied title/message/default goes through esc() before
 * interpolation, same as every other user-content path in the app.
 * ========================================================================= */
function _uiDlgEl(){
  let el=document.getElementById('dlg');
  if(el)return el;
  el=document.createElement('div');
  el.id='dlg';
  el.innerHTML='<div class="dc"></div>';
  document.body.appendChild(el);
  return el;
}
function _uiOpenDlg(innerHtml,opts){
  return new Promise(resolve=>{
    const el=_uiDlgEl();
    const box=el.firstChild;
    box.innerHTML=innerHtml;
    el.classList.add('on');
    let done=false;
    const finish=v=>{
      if(done)return;done=true;
      el.classList.remove('on');
      el.removeEventListener('pointerdown',onOverlay);
      document.removeEventListener('keydown',onKey,true);
      resolve(v);
    };
    const onOverlay=e=>{if(e.target===el)finish(opts.cancelValue)};
    const onKey=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(opts.cancelValue)}
      else if(e.key==='Enter'&&opts.enterSubmits&&document.activeElement?.tagName!=='TEXTAREA'){
        e.preventDefault();finish(opts.getSubmitValue?opts.getSubmitValue():undefined);
      }
    };
    el.addEventListener('pointerdown',onOverlay);
    document.addEventListener('keydown',onKey,true);
    if(opts.bind)opts.bind(box,finish);
    requestAnimationFrame(()=>{
      const f=opts.focusSelector?box.querySelector(opts.focusSelector):box.querySelector('button.pr')||box.querySelector('button');
      if(f){try{f.focus()}catch(e){}if(opts.selectOnFocus&&'select'in f){try{f.select()}catch(e){}}}
    });
  });
}
function uiPrompt(title,defaultValue='',opts={}){
  const {hint='',placeholder='',multiline=false,submitLabel='OK',cancelLabel='Cancel'}=opts;
  const id='_uii_'+Math.random().toString(36).slice(2,9);
  const input=multiline
    ?`<textarea id="${id}" placeholder="${esc(placeholder)}" style="min-height:96px">${esc(defaultValue)}</textarea>`
    :`<input id="${id}" type="text" value="${esc(defaultValue)}" placeholder="${esc(placeholder)}" autocomplete="off" autocapitalize="off" spellcheck="false"/>`;
  const html=`<h3>${esc(title)}</h3>${hint?`<p>${esc(hint)}</p>`:''}<div class="dbody">${input}</div><div class="drow"><button data-ui-cancel>${esc(cancelLabel)}</button><button class="pr" data-ui-ok>${esc(submitLabel)}</button></div>`;
  return _uiOpenDlg(html,{
    focusSelector:'#'+id,
    selectOnFocus:!multiline,
    enterSubmits:!multiline,
    cancelValue:null,
    getSubmitValue:()=>document.getElementById(id)?.value??'',
    bind(box,finish){
      box.querySelector('[data-ui-ok]').onclick=()=>finish(document.getElementById(id)?.value??'');
      box.querySelector('[data-ui-cancel]').onclick=()=>finish(null);
    }
  });
}
function uiConfirm(message,opts={}){
  const {title='Confirm',okLabel='OK',cancelLabel='Cancel',danger=false}=opts;
  const okCls=danger?'dn':'pr';
  const html=`<h3>${esc(title)}</h3><p class="dmsg">${esc(message)}</p><div class="drow"><button data-ui-cancel>${esc(cancelLabel)}</button><button class="${okCls}" data-ui-ok>${esc(okLabel)}</button></div>`;
  return _uiOpenDlg(html,{
    enterSubmits:true,
    cancelValue:false,
    getSubmitValue:()=>true,
    bind(box,finish){
      box.querySelector('[data-ui-ok]').onclick=()=>finish(true);
      box.querySelector('[data-ui-cancel]').onclick=()=>finish(false);
    }
  });
}
function uiNotice(message,opts={}){
  const {title='Notice',okLabel='OK'}=opts;
  const html=`<h3>${esc(title)}</h3><p class="dmsg">${esc(message)}</p><div class="drow"><button class="pr" data-ui-ok>${esc(okLabel)}</button></div>`;
  return _uiOpenDlg(html,{
    enterSubmits:true,
    cancelValue:undefined,
    getSubmitValue:()=>undefined,
    bind(box,finish){
      box.querySelector('[data-ui-ok]').onclick=()=>finish();
    }
  });
}

/* =========================================================================
 * Phase 1.7 · Item #8 — bottom-right toast.
 *
 * Replaces the v1 top-of-screen #bootLog banner that rendered every init
 * step in green monospace across the whole viewport width. That banner
 * looked like a startup debug log and broke the "feels professional" test.
 *
 *   toast('Loaded vault · 42 nodes')                default info, 1.5s
 *   toast('Saved', {kind:'ok'})                     green left-border
 *   toast('Save failed', {kind:'err', ms:3000})     red left-border, 3s
 *
 * Positions above the ◆ diag panel (right:8px bottom:8px, max 45vh) so the
 * two never overlap. Hebrew mode flips to the left side via CSS. In RTL,
 * the host's `#toast` gets left:14px via body.he cascade.
 *
 * Kept intentionally minimal — no promise, no queue management; the CSS
 * transition + setTimeout lifecycle is enough for "Saved"/"Loaded" pings.
 * ========================================================================= */
function toast(msg,opts={}){
  const {kind='info',ms=1500}=opts;
  let host=document.getElementById('toast');
  if(!host){host=document.createElement('div');host.id='toast';document.body.appendChild(host)}
  // Lift the stack above the ◆ diag panel when that panel is mounted.
  // 18px margin so the toast isn't flush with the diag border.
  const dbgPanel=document.getElementById('dbgPanel');
  host.style.bottom=(dbgPanel?dbgPanel.offsetHeight+18:14)+'px';
  const el=document.createElement('div');
  el.className='ts'+(kind==='ok'?' ok':kind==='err'?' err':'');
  el.textContent=msg;
  host.appendChild(el);
  requestAnimationFrame(()=>el.classList.add('on'));
  setTimeout(()=>{el.classList.remove('on');setTimeout(()=>{el.remove();if(!host.children.length)host.remove()},250)},ms);
}

/* =========================================================================
 * Phase 1.8 · Smart popover positioning utility.
 *
 * Anchors a popover panel to a trigger button and flips upward if not enough
 * viewport space below. Works in LTR and RTL. Keeps the panel fully on-screen
 * by clamping left/top so nothing gets cut off at viewport edges (important
 * for narrow iPhone widths where the default "right-align to trigger" blows
 * out the left side).
 *
 *   placePopover('more', 'moreBtn')
 *   placePopover('more', 'moreBtn', { gap: 8, preferUp: false })
 *
 * The popover element must be in the DOM and have its current visibility
 * applied (so offsetHeight/offsetWidth are real). Caller toggles the .on
 * class; this function only writes positioning styles (top/left/right).
 *
 * Call sites currently: #more (top toolbar). Intended to absorb #ctx and #ep
 * in a follow-up once we consolidate their bespoke positioning logic.
 * ========================================================================= */
function placePopover(panelId,anchorId,opts={}){
  const panel=document.getElementById(panelId);
  const anchor=document.getElementById(anchorId);
  if(!panel||!anchor)return;
  const gap=opts.gap??4;
  // Anchor rect in viewport coords.
  const a=anchor.getBoundingClientRect();
  // Measure panel without forcing a re-layout if it's already visible; if
  // hidden, temporarily flip visibility so we get real dimensions.
  const wasOn=panel.classList.contains('on');
  const prevVis=panel.style.visibility,prevDisp=panel.style.display;
  if(!wasOn){panel.style.visibility='hidden';panel.style.display='block'}
  const pw=panel.offsetWidth||panel.getBoundingClientRect().width||220;
  const ph=panel.offsetHeight||panel.getBoundingClientRect().height||160;
  if(!wasOn){panel.style.visibility=prevVis;panel.style.display=prevDisp}
  const vw=innerWidth,vh=innerHeight;
  const isRtl=document.body.classList.contains('he');
  // Default: open below, align right edge to anchor's right edge (LTR) or
  // left edge to anchor's left edge (RTL — mirrors what native menus do).
  // Flip up if not enough space below.
  const spaceBelow=vh-a.bottom,spaceAbove=a.top;
  const openUp=opts.preferUp||(spaceBelow<ph+gap+8&&spaceAbove>spaceBelow);
  // Reset any prior inline positioning.
  panel.style.position='fixed';
  panel.style.right='auto';
  panel.style.bottom='auto';
  // Vertical
  if(openUp){
    panel.style.top=Math.max(8,a.top-ph-gap)+'px';
  }else{
    panel.style.top=Math.min(vh-ph-8,a.bottom+gap)+'px';
  }
  // Horizontal — right-align in LTR, left-align in RTL, clamped to viewport.
  let left;
  if(isRtl){
    left=a.left;
  }else{
    left=a.right-pw;
  }
  left=Math.max(8,Math.min(vw-pw-8,left));
  panel.style.left=left+'px';
}

// Minimal Markdown processor for note bodies. Expects HTML-ESCAPED input so
// nothing user-supplied can synthesize tags. Supported:
//   # / ## / ### / …       headings
//   **bold**  __bold__     strong
//   *italic*               em
//   `code`                 code
//   - item                 ul/li (contiguous run)
//   1. item                ol/li (contiguous run)
// Math ($…$ and $$…$$) is stashed to placeholders BEFORE Markdown so _, *, #
// inside LaTeX are never mangled, then re-injected so KaTeX auto-render can
// process it downstream. XSS invariant: because input is already escaped,
// no Markdown transform can emit a tag that wasn't hardcoded here.
function mdProcess(escapedText){
  // Phase 1.5 — bug #5 diagnostic. Bumped here and reset at end of render()
  // so post-render log can show "was mdProcess ever called on this pass?"
  window._mdCallsThisRender=(window._mdCallsThisRender||0)+1;
  const math=[];
  let s=String(escapedText||'');
  s=s.replace(/\$\$[\s\S]+?\$\$/g,m=>{math.push(m);return '\x00M'+(math.length-1)+'\x00'});
  s=s.replace(/\$[^\n$]+?\$/g,m=>{math.push(m);return '\x00M'+(math.length-1)+'\x00'});
  const inline=t=>t
    .replace(/\*\*([^*\n]+?)\*\*/g,'<strong>$1</strong>')
    .replace(/__([^_\n]+?)__/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+?)\*/g,'<em>$1</em>')
    .replace(/`([^`\n]+?)`/g,'<code>$1</code>');
  const lines=s.split('\n');
  const out=[];
  let i=0;
  while(i<lines.length){
    const l=lines[i];
    const h=/^(#{1,6})\s+(.+)$/.exec(l);
    if(h){out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`);i++;continue}
    if(/^- /.test(l)){
      const g=[];
      while(i<lines.length&&/^- /.test(lines[i])){g.push(`<li>${inline(lines[i].slice(2))}</li>`);i++}
      out.push(`<ul>${g.join('')}</ul>`);continue;
    }
    if(/^\d+\. /.test(l)){
      const g=[];
      while(i<lines.length&&/^\d+\. /.test(lines[i])){g.push(`<li>${inline(lines[i].replace(/^\d+\. /,''))}</li>`);i++}
      out.push(`<ol>${g.join('')}</ol>`);continue;
    }
    out.push(inline(l));i++;
  }
  let result=out.join('\n');
  result=result.replace(/\x00M(\d+)\x00/g,(_,idx)=>math[+idx]);
  return result;
}
const s2w=(x,y)=>({x:(x-innerWidth/2)/view.k-view.x,y:(y-innerHeight/2)/view.k-view.y});
const C=()=>S.canvases[S.current],zs=()=>C().zones,ns=()=>C().nodes,es=()=>C().edges;
const zoneAt=(x,y)=>{for(const z of zs())if(x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h)return z.id;return zs()[0]?.id||null};
const DB_NAME='ideaVault',DB_STORE='state';
/* Sprint 3.3 Issue 1 — module-scope `let` doesn't go on window, which is
   why spine.js / drawer.js's `window.currentWs` reads were falling back
   to the literal 'workspace' and the workspace-name label stayed stale.
   The setter below + the bootstrap reader mirror to window.currentWs so
   the chrome modules see the live value. */
let currentWs='workspace';
try { window.currentWs = currentWs; } catch (e) {}
const KEY=()=>'vault3-'+currentWs;
const WS_LIST_KEY='vault3-workspaces';
const HE_KEY='vault3-he';
function idbOpen(){return new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{r.result.createObjectStore(DB_STORE)};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function idbGet(k){const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(k);tx.onsuccess=()=>res(tx.result);tx.onerror=()=>rej(tx.error)})}
async function idbSet(k,v){const db=await idbOpen();return new Promise((res,rej)=>{const tx=db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE).put(v,k);tx.onsuccess=()=>res();tx.onerror=()=>rej(tx.error)})}
async function storageGet(k){try{if('indexedDB' in window){const v=await idbGet(k);if(v)return v}}catch(e){}try{if(window.storage){const r=await window.storage.get(k);if(r)return r.value}}catch(e){}try{return localStorage.getItem(k)}catch(e){}return null}
async function storageSet(k,v){let ok=false;try{if('indexedDB' in window){await idbSet(k,v);ok=true}}catch(e){}try{if(window.storage){await window.storage.set(k,v);ok=true}}catch(e){}if(!ok){try{localStorage.setItem(k,v);ok=true}catch(e){}}return ok}
async function listWorkspaces(){const v=await storageGet(WS_LIST_KEY);if(v)try{return JSON.parse(v)}catch(e){}return ['workspace']}
async function saveWorkspaces(list){await storageSet(WS_LIST_KEY,JSON.stringify(list))}
async function getCurrentWs(){const v=await storageGet('vault3-current-ws');return v||'workspace'}
async function setCurrentWs(ws){await storageSet('vault3-current-ws',ws);currentWs=ws;try{window.currentWs=ws}catch(e){}}
/* Phase 5 P2 — workspace color coding. Derive a stable hue from the name
   so every workspace has an instant-recognition color across devices,
   without any per-workspace picker or storage migration. Same string →
   same hue, always. Saturation + lightness stay fixed so colors stay
   distinct from canvas content without clashing against dark panels. */
/* Phase 5b · workspace color with optional override. Custom overrides are
   stored in a simple map in storage so rename + recolor persist. */
const WS_COLORS_KEY='vault3-ws-colors';
let _wsColorMap={};
async function loadWsColors(){try{const v=await storageGet(WS_COLORS_KEY);if(v)_wsColorMap=JSON.parse(v)}catch(e){}}
async function saveWsColors(){await storageSet(WS_COLORS_KEY,JSON.stringify(_wsColorMap))}
function wsColor(name){if(_wsColorMap[name])return _wsColorMap[name];let h=0;for(let i=0;i<(name||'').length;i++)h=(h*31+name.charCodeAt(i))%360;return`hsl(${h},55%,60%)`}
async function rebuildWsDropdown(){const list=await listWorkspaces();const sel=document.getElementById('wsSel');if(!sel)return;
  sel.innerHTML=list.map(w=>`<option value="${esc(w)}" ${w===currentWs?'selected':''} style="color:${wsColor(w)}">${esc(w)}</option>`).join('');
  // Left-edge stripe + tint on the current workspace. Border-left color
  // is the stripe; a subtle tinted text color hints at the workspace
  // identity even when the dropdown is closed. paddingLeft shrinks by the
  // extra 2px so the text stays put instead of jumping right when the
  // stripe thickens from 1px to 3px.
  sel.style.borderLeftColor=wsColor(currentWs);
  sel.style.borderLeftWidth='3px';
  sel.style.paddingLeft='10px';}
async function switchWorkspace(ws){await sv();await setCurrentWs(ws);S={canvases:{vault:{nodes:[],edges:[],zones:[]}},current:'vault',canvasMeta:{vault:{name:'Vault',parentNodeId:null}},nextId:1,hebrewMode:false};hist=[];selSet.clear();sel=null;await loadState();rebuildWsDropdown()}
async function newWorkspace(){const name=await uiPrompt('New workspace name','university',{hint:'e.g. university, life, research'});if(!name)return;const clean=name.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');if(!clean)return;const list=await listWorkspaces();if(list.includes(clean)){await uiNotice('A workspace named "'+clean+'" already exists.');return}list.push(clean);await saveWorkspaces(list);await switchWorkspace(clean)}
async function loadState(){try{const v=await storageGet(KEY());if(v){const o=JSON.parse(v);S={...S,...o}}}catch(e){console.error('load',e)}reconcileCanvases();/* Sprint 3.2 Issue 5 — honour the workspace's default-canvas preference. */applyDefaultCanvasForCurrentWs();applyHebrewState();render();bF();bB();renderTabs();renderSB()}
/* Sprint 3.2 Issue 5 — per-workspace default canvas. setDefaultCanvasForWorkspace
   writes 'edgespace-default-canvas:' + workspaceName to localStorage. On every
   workspace load, applyDefaultCanvasForCurrentWs reads it and (if present and
   still valid) sets S.current to that canvas. */
const DEFAULT_CANVAS_PREFIX='edgespace-default-canvas:';
function defaultCanvasKey(ws){return DEFAULT_CANVAS_PREFIX+(ws||currentWs)}
function setDefaultCanvasForWorkspace(cid,ws){try{localStorage.setItem(defaultCanvasKey(ws||currentWs),cid)}catch(e){}}
function clearDefaultCanvasForWorkspace(ws){try{localStorage.removeItem(defaultCanvasKey(ws||currentWs))}catch(e){}}
function getDefaultCanvasForWorkspace(ws){try{return localStorage.getItem(defaultCanvasKey(ws||currentWs))}catch(e){return null}}
function applyDefaultCanvasForCurrentWs(){try{const def=getDefaultCanvasForWorkspace();if(def&&S.canvases&&S.canvases[def]&&S.current!==def){S.current=def}}catch(e){}}
window.setDefaultCanvasForWorkspace=setDefaultCanvasForWorkspace;
window.clearDefaultCanvasForWorkspace=clearDefaultCanvasForWorkspace;
window.getDefaultCanvasForWorkspace=getDefaultCanvasForWorkspace;

/* Sprint 3.4 Issue 6 — per-workspace Weak-spot enable toggle.
   Spaced-repetition makes sense for study workspaces ("uni"), noise for
   project ones. Stored at localStorage[edgespace-weakspot:<ws>] = '1'|'0'.
   Default OFF for everyone, EXCEPT we one-time-migrate any workspace named
   exactly 'uni' to default ON (matches the user's existing study setup). */
const WEAKSPOT_PREFIX='edgespace-weakspot:';
const WEAKSPOT_MIGRATION_KEY='edgespace-weakspot-migrated';
function weakspotKey(ws){return WEAKSPOT_PREFIX+(ws||currentWs)}
function isWeakspotEnabled(ws){try{const v=localStorage.getItem(weakspotKey(ws||currentWs));return v==='1'}catch(e){return false}}
function setWeakspotEnabled(ws,on){try{localStorage.setItem(weakspotKey(ws||currentWs),on?'1':'0')}catch(e){}}
async function runWeakspotMigration(){try{if(localStorage.getItem(WEAKSPOT_MIGRATION_KEY))return;const list=typeof window.listWorkspaces==='function'?await window.listWorkspaces():[];/* one-time: enable weakspot on the workspace named 'uni' if present */for(const w of (list||[])){if(w==='uni')setWeakspotEnabled(w,true)}localStorage.setItem(WEAKSPOT_MIGRATION_KEY,'1')}catch(e){}}
/* Fire-and-forget after boot. */
setTimeout(()=>{runWeakspotMigration()},2000);

/* Sprint 3.4 Issue 6 — workspace-settings UI. Tools-panel "Workspace
   settings" row calls this. Simple modal with the weakspot toggle (and
   room for future per-ws prefs). */
function openWorkspaceSettings(){
  const ws=currentWs||'workspace';
  const enabled=isWeakspotEnabled(ws);
  /* Sprint 3.6 Issue 5 — Reset workspace as a destructive footer action. */
  const body=
    '<h3 style="margin:0 0 12px;font-family:var(--font-sans);font-size:16px">Workspace settings — '+esc(ws)+'</h3>'+
    '<label style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--line-2,#2A2F3A);border-radius:8px;cursor:pointer">'+
      '<input type="checkbox" id="__wsWeakspotToggle"'+(enabled?' checked':'')+' style="width:18px;height:18px"/>'+
      '<div style="flex:1">'+
        '<div style="font-weight:500;color:var(--ink,#F0EBE5)">Enable Weak-spot view for this workspace</div>'+
        '<div style="font-size:12px;color:var(--ink-3,#7C828E);margin-top:4px">Spaced-repetition ranking. Useful for study workspaces; noise for project ones.</div>'+
      '</div>'+
    '</label>'+
    /* Destructive zone — separated by a divider, red border, opt-in by tap. */
    '<div style="margin-top:24px;padding-top:16px;border-top:1px solid var(--line-2,#2A2F3A)">'+
      '<div style="font-size:11px;color:var(--ink-4,#5A6068);text-transform:uppercase;letter-spacing:0.12em;margin-bottom:8px">Danger zone</div>'+
      '<button id="__wsReset" type="button" style="display:flex;align-items:center;gap:10px;width:100%;padding:12px;background:transparent;border:1px solid rgba(248,113,113,0.4);border-radius:8px;cursor:pointer;text-align:start;color:var(--st-blocked,#F87171);font-family:var(--font-sans,Inter);font-size:13px">'+
        '<span style="font-size:16px">⌫</span>'+
        '<div style="flex:1">'+
          '<div style="font-weight:600">Reset workspace…</div>'+
          '<div style="font-size:11px;color:var(--ink-3,#7C828E);margin-top:2px">Remove every canvas, node, zone, and edge in this workspace. The workspace itself remains, empty.</div>'+
        '</div>'+
      '</button>'+
    '</div>';
  const m=document.getElementById('modal');const mb=document.getElementById('mcbody');
  if(!m||!mb)return;
  mb.innerHTML=body+'<div style="display:flex;justify-content:flex-end;margin-top:16px"><button id="__wsSettingsDone" style="padding:8px 16px;background:var(--hot,#FF7A45);color:#0F0F0F;border:none;border-radius:6px;cursor:pointer;font-weight:600">Done</button></div>';
  m.classList.add('on');
  document.getElementById('__wsSettingsDone').onclick=()=>{saveSettings();m.classList.remove('on')};
  document.getElementById('__wsReset').onclick=()=>{m.classList.remove('on');resetWorkspaceWithConfirm()};
  function saveSettings(){
    const t=document.getElementById('__wsWeakspotToggle');
    if(t)setWeakspotEnabled(ws,t.checked);
    /* Re-render view tabs so the Weak-spot button shows/hides immediately. */
    try{window.ViewTabs&&window.ViewTabs.refresh&&window.ViewTabs.refresh()}catch(e){}
  }
}
window.openWorkspaceSettings=openWorkspaceSettings;

/* Sprint 3.6 Issue 5 — empty the entire workspace in one transaction.
   Leaves exactly one empty vault canvas. Single undo restores
   everything (sn() snapshots S BEFORE the wipe). The workspace itself
   is NOT deleted — that's the separate "Delete workspace" path. */
async function resetWorkspaceWithConfirm(){
  const ws=currentWs||'workspace';
  let nCanvases=0,nNodes=0,nZones=0,nEdges=0;
  if(S&&S.canvases){
    for(const cid of Object.keys(S.canvases)){
      nCanvases++;
      const c=S.canvases[cid];
      nNodes+=(c.nodes||[]).length;
      nZones+=(c.zones||[]).length;
      nEdges+=(c.edges||[]).length;
    }
  }
  const body=
    '<div style="font-family:var(--font-sans,Inter);color:var(--ink,#F0EBE5)">'+
      '<h3 style="margin:0 0 12px;font-size:16px">Reset workspace "'+esc(ws)+'"?</h3>'+
      '<p style="margin:0 0 8px;color:var(--ink-2,#C8C5BE);font-size:13px">This will remove <b>all canvases ('+nCanvases+')</b>, <b>all nodes ('+nNodes+')</b>, <b>all zones ('+nZones+')</b>, and <b>all edges ('+nEdges+')</b> in this workspace.</p>'+
      '<p style="margin:0 0 8px;color:var(--ink-2,#C8C5BE);font-size:13px">The workspace itself remains, with exactly one empty vault canvas. Subsequent import places its content cleanly.</p>'+
      '<p style="margin:8px 0 0;color:var(--ink-3,#7C828E);font-size:12px">Undo restores everything.</p>'+
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">'+
        '<button id="__rstCancel" style="padding:8px 16px;background:transparent;color:var(--ink-2,#C8C5BE);border:1px solid var(--line-2,#2A2F3A);border-radius:6px;cursor:pointer">Cancel</button>'+
        '<button id="__rstOk" style="padding:8px 16px;background:var(--st-blocked,#F87171);color:#0F0F0F;border:none;border-radius:6px;cursor:pointer;font-weight:600">Reset workspace</button>'+
      '</div>'+
    '</div>';
  const m=document.getElementById('modal');const mb=document.getElementById('mcbody');
  if(!m||!mb)return;
  mb.innerHTML=body;
  m.classList.add('on');
  return new Promise(resolve=>{
    document.getElementById('__rstCancel').onclick=()=>{m.classList.remove('on');resolve(false)};
    document.getElementById('__rstOk').onclick=()=>{
      m.classList.remove('on');
      sn();
      /* Wipe everything to a fresh single-vault state. reconcileCanvases
         will fill in the default zone set so the vault doesn't look
         broken. */
      S={canvases:{vault:{nodes:[],edges:[],zones:[]}},current:'vault',canvasMeta:{vault:{name:'Vault',parentNodeId:null}},nextId:1,hebrewMode:S.hebrewMode||false};
      reconcileCanvases();
      sv();
      render();
      if(typeof renderTabs==='function')renderTabs();
      if(window.Drawer&&window.Drawer.refresh)window.Drawer.refresh();
      resolve(true);
    };
  });
}
window.resetWorkspaceWithConfirm=resetWorkspaceWithConfirm;
window.isWeakspotEnabled=isWeakspotEnabled;
window.setWeakspotEnabled=setWeakspotEnabled;
/* Phase 5 P2 · Landing screen — shown on first load when ≥ 2 workspaces. */
/* Phase 6 · landing-screen logic survives Safari tab close.
   Decision tree:
     1. No data in IDB at all → show landing (first-time user, even with 1 ws)
     2. Last-session timestamp < 4 hours old → skip landing (continuing work)
     3. Otherwise → show landing with all workspaces + Continue button
   The timestamp lives in localStorage (NOT sessionStorage which Safari nukes). */
const SESSION_TS_KEY='edgespace-last-session-ts';
const SESSION_FRESH_MS=4*60*60*1000;
function nowTs(){return Date.now()}
async function getLastSessionTs(){try{const v=localStorage.getItem(SESSION_TS_KEY);return v?+v:0}catch(e){return 0}}
async function setLastSessionTs(){try{localStorage.setItem(SESSION_TS_KEY,String(nowTs()))}catch(e){}}
let _sessionTickHandle=null;
function startSessionTick(){if(_sessionTickHandle)return;_sessionTickHandle=setInterval(()=>setLastSessionTs(),60*1000);
  // Also write on visibility change so closing the tab leaves a recent ts.
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')setLastSessionTs()})}
async function showLanding(){
  const list=await listWorkspaces();
  // Detect: does the user have any data worth presenting in the landing?
  let hasData=false;
  for(const ws of list){try{const raw=await storageGet('vault3-'+ws);if(raw){const o=JSON.parse(raw);if(Object.values(o.canvases||{}).reduce((n,c)=>n+(c.nodes?.length||0),0)>0){hasData=true;break}}}catch(e){}}
  /* Phase 6 · landing decision tree:
     - Trivial (1 workspace, no data) → skip; user sees empty canvas + empty
       state. Showing a 1-card landing is annoying.
     - Recent session (<4hr) AND has data → skip; user is mid-flow.
     - Otherwise → show. Multiple workspaces, or returning after 4hr+. */
  if(list.length<2&&!hasData){startSessionTick();await setLastSessionTs();return}
  const lastTs=await getLastSessionTs();
  const fresh=lastTs>0&&(nowTs()-lastTs)<SESSION_FRESH_MS;
  if(hasData&&fresh){await setLastSessionTs();startSessionTick();return}
  const ld=document.getElementById('landing');if(!ld)return;
  const ldList=document.getElementById('ld-list');if(!ldList)return;
  // Gather node counts per workspace by peeking at IDB
  const counts={};
  for(const ws of list){
    try{const raw=await storageGet('vault3-'+ws);if(raw){const o=JSON.parse(raw);counts[ws]=Object.values(o.canvases||{}).reduce((n,c)=>n+(c.nodes?.length||0),0)}else{counts[ws]=0}}catch(e){counts[ws]=0}
  }
  ldList.innerHTML=list.map(ws=>{
    const col=wsColor(ws);const cur=ws===currentWs;const cnt=counts[ws]||0;
    return `<div class="ld-card${cur?' cur':''}" onclick="closeLanding();if('${esc(ws)}'!==currentWs)switchWorkspace('${esc(ws)}')" data-ws="${esc(ws)}"><div class="ld-stripe" style="background:${col}"></div><div><div class="ld-name">${esc(ws)}</div><div class="ld-meta">${cnt} ${t('ldNodes')}${cur?' · '+t('ldCurrent'):''}</div></div></div>`
  }).join('');
  document.getElementById('ld-title').textContent=t('ldTitle');
  document.getElementById('ld-hint').textContent=lastTs>0?t('ldHintReturning'):t('ldHint');
  document.getElementById('ld-new').textContent=t('ldNew');
  // Show "Continue where I left off" instead of "Continue with current" for returning users
  document.getElementById('ld-skip').textContent=lastTs>0?t('ldContinue'):t('ldSkip');
  ld.classList.add('on');
  // Escape to dismiss
  const escH=(e)=>{if(e.key==='Escape'){closeLanding();document.removeEventListener('keydown',escH)}};
  document.addEventListener('keydown',escH);
  ld._escH=escH;
  startSessionTick();
}
function closeLanding(){const ld=document.getElementById('landing');if(!ld)return;ld.classList.remove('on');if(ld._escH){document.removeEventListener('keydown',ld._escH);delete ld._escH}setLastSessionTs()}
async function load(){
  // Phase 1.7 · Item #8 — replaced the v1 full-width #bootLog banner
  // (green monospace across the viewport top) with a subtle bottom-right
  // toast() fired once at the end of load(). Failures go to the ◆ diag
  // panel via dbg() plus a red toast so the user still gets a visible
  // signal if something breaks during boot, without a giant banner in
  // their face on every page load.
  const step=(m,ok)=>{window.dbg&&window.dbg('SYS',(ok===false?'✗ ':'✓ ')+m)};
  step('load() started');
  try{currentWs=await getCurrentWs();try{window.currentWs=currentWs}catch(e){}step('getCurrentWs: '+currentWs)}catch(e){step('getCurrentWs FAIL: '+e.message,false);currentWs='workspace';try{window.currentWs=currentWs}catch(e2){}}
  try{await loadWsColors();step('loadWsColors OK')}catch(e){step('loadWsColors FAIL: '+e.message,false)}
  let list;try{list=await listWorkspaces();step('listWorkspaces: '+JSON.stringify(list))}catch(e){step('listWorkspaces FAIL: '+e.message,false);list=['workspace']}
  if(!list.includes(currentWs)){list.push(currentWs);try{await saveWorkspaces(list);step('saveWorkspaces OK')}catch(e){step('saveWorkspaces FAIL: '+e.message,false)}}
  try{const existing=await storageGet('vault3-workspace');if(!existing){const legacy=await storageGet('vault3');if(legacy){await storageSet('vault3-workspace',legacy)}}step('legacy migration done')}catch(e){step('migration FAIL: '+e.message,false)}
  let loadOk=true;
  try{await loadState();step('loadState OK — zones: '+(S.canvases?.vault?.zones?.length||0)+' nodes: '+(S.canvases?.vault?.nodes?.length||0))}catch(e){loadOk=false;step('loadState FAIL: '+e.message,false);try{reconcileCanvases();applyHebrewState();render();bF();bB();renderTabs();renderSB();step('fallback render OK')}catch(e2){step('fallback render FAIL: '+e2.message,false)}}
  try{rebuildWsDropdown();step('rebuildWsDropdown OK')}catch(e){step('rebuildWsDropdown FAIL: '+e.message,false)}
  // Phase 5b · sidebar starts minimized — less visual noise on first load.
  // User can expand by clicking the sidebar header or the ☰ cycle button.
  const _sb=document.getElementById('sb');if(_sb&&!_sb.classList.contains('co'))_sb.classList.add('mini');
  step('load() complete');
  const totalNodes=Object.values(S.canvases||{}).reduce((n,c)=>n+(c.nodes?.length||0),0);
  toast(loadOk?('Loaded '+currentWs+' · '+totalNodes+' node'+(totalNodes===1?'':'s')):'Load failed — check diag',{kind:loadOk?'ok':'err',ms:loadOk?1500:3000});
  // Phase 5 P2 · show landing screen if ≥ 2 workspaces
  try{await showLanding()}catch(e){window.dbg&&window.dbg('SYS','showLanding error: '+e.message)}
  /* Phase 6 · mark boot complete so the error boundary stops swallowing
     post-boot exceptions (those should bubble normally). */
  _bootCompleted=true;window._bootCompleted=true;
}
async function sv(){const si=document.getElementById('saveInd');if(si)si.className='ind s-pend';try{const ok=await storageSet(KEY(),JSON.stringify(S));if(si)si.className=ok?'ind s-ok':'ind s-err'}catch(e){if(si){si.className='ind s-err';si.title='Save failed: '+e.message}}}
const T={
  en:{idea:'Idea',progress:'In Progress',pending:'Pending',blocked:'Blocked',done:'Done',
      project:'Project',question:'Question',experiment:'Experiment',principle:'Principle',resource:'Resource',library:'Library',doc:'Document',formula:'Formula',note:'Note',
      blocker:'Blocker',feeds:'Feeds into',related:'Related',derived:'Derived from',example:'Example',proof:'Proof',arrow:'Arrow',custom:'Custom',
      shapes:'Shapes',status:'Status',edges:'Edges',nodes:'Nodes',
      add:'+ Add',zone:'+ Zone',fit:'Fit',back:'← Back',more:'⋯ More',
      label:'Label',notes:'Description / Notes',rationale:'Why this placement',url:'URL',docUrl:'Document link',tags:'Tags',confidence:'Confidence (0–5)',shape:'Shape',zoneF:'Zone',latex:'LaTeX formula',noteBody:'Note body (Markdown)',
      save:'Save',close:'Close',del:'Delete',addedOn:'added',moreDetails:'More details',
      filterList:'Filter list…',searchCanvas:'Search canvas…',pasteUrl:'Paste URL…',
      newCanvas:'New canvas name:',newWs:'New workspace name (e.g. university, life):',
      exportAll:'Export all (full state)',exportThis:'Export this canvas',importAll:'Import full state',importThis:'Import into this canvas',pastePatch:'Paste patch',quickLink:'Quick-add from URL',dedupe:'Dedupe nodes',cleanOrphan:'Clean orphan canvases',clearCanvas:'Clear canvas',renameWs:'Rename workspace',recolorWs:'Change workspace color',deleteWs:'Delete this workspace',
      mhExport:'Export',mhImport:'Import',mhUtil:'Utilities',mhWs:'Workspace',
      ctxEdge:'Edge',ctxZone:'Zone',changeTo:'Change to',deleteEdge:'Delete edge',unlockZ:'🔓 Unlock (allow move/resize)',lockZ:'🔒 Lock position',renameZ:'Rename',recolorZ:'Recolor',deleteZ:'Delete zone',addNodeHere:'+ Add node here',addZoneHere:'+ Add zone here',customLabel:'Label for this connection:',untitled:'Untitled',clearCanvasConfirm:'Clear current canvas?',deleteSelected:'Delete N selected nodes?',openRoadmap:'Open roadmap',createRoadmap:'+ Create roadmap',copyToVault:'Copy to vault',pullFromVault:'Pull from vault',copiedFromVault:'copied from vault',
      ttWs:'Switch workspace',ttNewWs:'New workspace',ttHe:'Hebrew mode (toggle RTL + translated UI)',ttBack:'Back to parent canvas',ttAdd:'Add node (or double-click empty canvas)',ttZone:'Add zone (group of related nodes)',ttSearch:'Filter visible nodes by label / notes',ttFit:'Fit view to all nodes',ttUndo:'Undo (Ctrl+Z)',ttRedo:'Redo (Ctrl+Y / Ctrl+Shift+Z)',ttDim:'Dim edges (focus on nodes)',ttPatch:'Paste patch JSON',ttImport:'Import full state JSON',ttMore:'More options (export / import / utilities / workspace)',ttLegend:'Legend · keyboard shortcuts',ttSbTog:'Cycle sidebar: Nodes · Edges · Zones',ttSbCollapse:'Collapse / expand all',ttSbMini:'Minimize to bottom',
      esTitle:'This canvas is empty',esHint:'Tap <b>+ Add</b> to create your first node, or double-click the canvas anywhere to add one there.',esAdd:'+ Add first node',
      ldTitle:'EdgeSpace',ldHint:'Pick a workspace to start',ldHintReturning:'Welcome back. Pick up where you left off, or switch workspaces.',ldNew:'+ New workspace',ldSkip:'Continue with current',ldContinue:'Continue where I left off',ldCurrent:'current',ldNodes:'nodes'},
  he:{idea:'רעיון',progress:'בתהליך',pending:'ממתין',blocked:'חסום',done:'הושלם',
      project:'פרויקט',question:'שאלה',experiment:'ניסוי',principle:'עיקרון',resource:'משאב',library:'ספרייה',doc:'מסמך',formula:'נוסחה',note:'פתק',
      blocker:'חסימה',feeds:'מזין את',related:'קשור ל',derived:'נגזר מ',example:'דוגמה',proof:'הוכחה',arrow:'חץ',custom:'מותאם',
      shapes:'צורות',status:'מצב',edges:'קשרים',nodes:'נקודות',
      add:'+ הוסף',zone:'+ אזור',fit:'התאם',back:'חזרה →',more:'⋯ עוד',
      label:'כותרת',notes:'תיאור / הערות',rationale:'למה במיקום הזה',url:'קישור',docUrl:'קישור למסמך',tags:'תגיות',confidence:'ביטחון (0–5)',shape:'צורה',zoneF:'אזור',latex:'נוסחת LaTeX',noteBody:'גוף הפתק (Markdown)',
      save:'שמירה',close:'סגירה',del:'מחיקה',addedOn:'נוסף',moreDetails:'עוד פרטים',
      filterList:'סנן רשימה…',searchCanvas:'חיפוש בקנבס…',pasteUrl:'הדבק קישור…',
      newCanvas:'שם הקנבס החדש:',newWs:'שם סביבה חדשה (לדוגמה: university, life):',
      exportAll:'יצוא הכול (מלא)',exportThis:'יצוא הקנבס הזה',importAll:'יבוא מצב מלא',importThis:'יבוא לקנבס הזה',pastePatch:'הדבק patch',quickLink:'הוספה מהירה מקישור',dedupe:'מחיקת כפילויות',cleanOrphan:'ניקוי קנבסים יתומים',clearCanvas:'נקה קנבס',renameWs:'שנה שם סביבה',recolorWs:'שנה צבע סביבה',deleteWs:'מחיקת הסביבה',
      mhExport:'יצוא',mhImport:'יבוא',mhUtil:'כלים',mhWs:'סביבה',
      ctxEdge:'קשר',ctxZone:'אזור',changeTo:'שנה ל',deleteEdge:'מחק קשר',unlockZ:'🔓 פתח (אפשר הזזה/שינוי גודל)',lockZ:'🔒 נעל מיקום',renameZ:'שנה שם',recolorZ:'שנה צבע',deleteZ:'מחק אזור',addNodeHere:'+ הוסף נקודה כאן',addZoneHere:'+ הוסף אזור כאן',customLabel:'תווית לקשר הזה:',untitled:'ללא כותרת',clearCanvasConfirm:'לנקות את הקנבס הנוכחי?',deleteSelected:'למחוק N נקודות שנבחרו?',openRoadmap:'פתח מפת דרכים',createRoadmap:'+ צור מפת דרכים',copyToVault:'העתק לוולט',pullFromVault:'משוך מהוולט',copiedFromVault:'הועתק מהוולט',
      ttWs:'החלפת סביבה',ttNewWs:'סביבה חדשה',ttHe:'מצב עברית (RTL וטקסט מתורגם)',ttBack:'חזרה לקנבס האב',ttAdd:'הוספת נקודה (או לחיצה כפולה על שטח ריק)',ttZone:'הוספת אזור (קבוצת נקודות קשורות)',ttSearch:'סינון נקודות לפי כותרת / הערות',ttFit:'התאם תצוגה לכל הנקודות',ttUndo:'בטל (Ctrl+Z)',ttRedo:'שחזר (Ctrl+Y / Ctrl+Shift+Z)',ttDim:'עמעם קשרים (התמקד בנקודות)',ttPatch:'הדבקת patch בפורמט JSON',ttImport:'יבוא מצב מלא (JSON)',ttMore:'אפשרויות נוספות (יצוא / יבוא / כלים / סביבה)',ttLegend:'מקרא · קיצורי מקלדת',ttSbTog:'מעבר בסרגל: נקודות · קשרים · אזורים',ttSbCollapse:'כווץ / הרחב את כל האזורים',ttSbMini:'הקטן לתחתית',
      esTitle:'הקנבס הזה ריק',esHint:'לחצו <b>+ הוספה</b> ליצירת הנקודה הראשונה, או לחיצה כפולה על שטח ריק.',esAdd:'+ הוסף נקודה ראשונה',
      ldTitle:'EdgeSpace',ldHint:'בחרו סביבת עבודה',ldHintReturning:'ברוכים השבים. המשיכו מאיפה שעצרתם, או החליפו סביבה.',ldNew:'+ סביבה חדשה',ldSkip:'המשך עם הנוכחית',ldContinue:'המשך מאיפה שעצרתי',ldCurrent:'נוכחית',ldNodes:'נקודות'}
};
function t(k){return T[S.hebrewMode?'he':'en'][k]||k}
function refreshUiText(){
  const map={addBtn:'add',zoneBtn:'zone',fitBtn:'fit',backBtn:'back',moreBtn:'more'};
  for(const[id,k]of Object.entries(map)){const el=document.getElementById(id);if(el)el.textContent=t(k)}
  const sr=document.getElementById('sr');if(sr)sr.placeholder=t('searchCanvas');
  const sbq=document.getElementById('sbq');if(sbq)sbq.placeholder=t('filterList');
  const sbn=document.getElementById('sbName');if(sbn)sbn.textContent=t('nodes');
  /* Phase 5 P2 — tooltip i18n pass. Keep the static title attributes in
     index.html (they're the English baseline so browsers show them before
     JS runs) but override on every language switch with the translated
     string from T[lang]. By-id lookup for toolbar buttons; by-selector for
     the sidebar toggles (no id on those spans). */
  const titleMap={wsSel:'ttWs',heBtn:'ttHe',backBtn:'ttBack',addBtn:'ttAdd',zoneBtn:'ttZone',sr:'ttSearch',fitBtn:'ttFit',undoBtn:'ttUndo',redoBtn:'ttRedo',dimEdgesBtn:'ttDim',patchBtn:'ttPatch',importBtn:'ttImport',moreBtn:'ttMore',lgBtn:'ttLegend'};
  for(const[id,k]of Object.entries(titleMap)){const el=document.getElementById(id);if(el)el.title=t(k)}
  const sbNewWsBtn=document.querySelector('#tb button[onclick^="newWorkspace"]');if(sbNewWsBtn)sbNewWsBtn.title=t('ttNewWs');
  const tog=document.querySelector('#sb .sbhead .sbtog[onclick*="cycleSb"]');if(tog)tog.title=t('ttSbTog');
  const togC=document.querySelector('#sb .sbhead .sbtog[onclick*="collapseAllZones"]');if(togC)togC.title=t('ttSbCollapse');
  const togM=document.querySelector('#sb .sbhead .sbtog[onclick*="mini"]');if(togM)togM.title=t('ttSbMini');
  // Phase 5 P2 · empty-state i18n
  const esT=document.getElementById('es-title');if(esT)esT.textContent=t('esTitle');
  const esH=document.getElementById('es-hint');if(esH)esH.innerHTML=t('esHint');
  const esA=document.getElementById('es-add');if(esA)esA.textContent=t('esAdd');
  // Phase 5 P2 · landing i18n
  const ldT=document.getElementById('ld-title');if(ldT)ldT.textContent=t('ldTitle');
  const ldH=document.getElementById('ld-hint');if(ldH)ldH.textContent=t('ldHint');
  const ldN=document.getElementById('ld-new');if(ldN)ldN.textContent=t('ldNew');
  const ldS=document.getElementById('ld-skip');if(ldS)ldS.textContent=t('ldSkip');
  const more=document.getElementById('moreBody');if(more){more.innerHTML=`<div class="mh">${t('mhExport')}</div><button onclick="ex();flashInd('expInd');hideMore()">${t('exportAll')}</button><button onclick="exCanvas();flashInd('expInd');hideMore()">${t('exportThis')}</button><div class="msep"></div><div class="mh">${t('mhImport')}</div><label for="imp" onclick="window.dbg&&window.dbg('IMPORT','label[for=imp] tapped — browser should now forward click to #imp');hideMore()">${t('importAll')}</label><label for="impC" onclick="window.dbg&&window.dbg('IMPORT','label[for=impC] tapped');hideMore()">${t('importThis')}</label><button onclick="showPatch();hideMore()">${t('pastePatch')}</button><div class="msep"></div><div class="mh">${t('mhUtil')}</div><button onclick="quickLink();hideMore()">${t('quickLink')}</button><button onclick="dd();hideMore()">${t('dedupe')}</button><button onclick="cleanOrphanCanvases();hideMore()">${t('cleanOrphan')}</button><button onclick="clearCanvasConfirm();hideMore()" style="color:var(--block)">${t('clearCanvas')}</button><div class="msep"></div><div class="mh">${t('mhWs')}</div><button onclick="renameCurrentWorkspace();hideMore()">${t('renameWs')}</button><button onclick="recolorCurrentWorkspace();hideMore()">${t('recolorWs')}</button><button onclick="deleteCurrentWorkspace();hideMore()" style="color:var(--block)">${t('deleteWs')}</button>`}
  bF();renderSB();renderLegend();
}
async function toggleHebrew(){const on=!(S.hebrewMode);S.hebrewMode=on;document.body.classList.toggle('he',on);const btn=document.getElementById('heBtn');if(btn){btn.style.background=on?'var(--accent)':'';btn.style.color=on?'#0F0F0F':''}refreshUiText();sv();render()}
function applyHebrewState(){const on=!!S.hebrewMode;document.body.classList.toggle('he',on);const btn=document.getElementById('heBtn');if(btn){btn.style.background=on?'var(--accent)':'';btn.style.color=on?'#0F0F0F':''}refreshUiText();applyDimBtn()}
function toggleDimEdges(){S.dimEdges=!S.dimEdges;sv();applyDimBtn();render()}
function applyDimBtn(){const btn=document.getElementById('dimEdgesBtn');if(btn){btn.style.background=S.dimEdges?'var(--accent)':'';btn.style.color=S.dimEdges?'#0F0F0F':''}}
async function deleteCurrentWorkspace(){const list=await listWorkspaces();if(list.length<=1){await uiNotice('Cannot delete the last workspace.');return}if(!await uiConfirm(`Delete workspace "${currentWs}" and ALL its data? This cannot be undone.`,{title:'Delete workspace',danger:true,okLabel:'Delete'}))return;try{if('indexedDB' in window){const db=await idbOpen();const tx=db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE);tx.delete(KEY())}}catch(e){}
  /* Phase 6 · clean up the workspace's color override so the slot is free
     for a future workspace with the same name (which would otherwise
     unexpectedly inherit the deleted one's color). */
  if(_wsColorMap[currentWs]){delete _wsColorMap[currentWs];await saveWsColors()}
  const newList=list.filter(w=>w!==currentWs);await saveWorkspaces(newList);await switchWorkspace(newList[0])}
/* Phase 5b · rename workspace — migrate IDB data to new key, update list. */
async function renameCurrentWorkspace(){const name=await uiPrompt(t('renameWs'),currentWs,{hint:'e.g. university, life, research'});if(!name)return;const clean=name.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');if(!clean||clean===currentWs)return;const list=await listWorkspaces();if(list.includes(clean)){await uiNotice('A workspace named "'+clean+'" already exists.');return}const oldKey=KEY();const data=await storageGet(oldKey);const idx=list.indexOf(currentWs);if(idx>=0)list[idx]=clean;else list.push(clean);await saveWorkspaces(list);await setCurrentWs(clean);if(data)await storageSet(KEY(),data);try{if('indexedDB' in window){const db=await idbOpen();const tx=db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE);tx.delete(oldKey)}}catch(e){}if(_wsColorMap[currentWs]){_wsColorMap[clean]=_wsColorMap[currentWs];delete _wsColorMap[currentWs];await saveWsColors()}rebuildWsDropdown();refreshUiText();toast('Renamed to '+clean,{kind:'ok',ms:1500})}
/* Phase 5b · recolor workspace — HSL swatch picker. */
async function recolorCurrentWorkspace(){const SWATCHES=['#d97757','#c48a9b','#b07ba8','#8b7ba8','#6b8cb0','#5fa3a8','#7aa882','#c9896a','#e6b450','#a8a8a8'];const cur=wsColor(currentWs);const html=`<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;padding:8px">${SWATCHES.map(c=>`<button onclick="applyWsColor('${c}')" style="width:36px;height:36px;border-radius:50%;border:3px solid ${c===cur?'#fff':'transparent'};background:${c};cursor:pointer" title="${c}"></button>`).join('')}</div><div style="display:flex;gap:8px;align-items:center;margin-top:8px;padding:0 8px"><label style="font-size:12px;color:var(--muted)">Custom:</label><input id="wsColorInput" type="color" value="${cur.startsWith('#')?cur:'#d97757'}" style="border:none;background:transparent;width:36px;height:28px;cursor:pointer"/><button onclick="applyWsColor(document.getElementById('wsColorInput').value)" style="font-size:12px;padding:4px 8px;border-radius:4px;border:1px solid var(--border);background:var(--panel2);color:var(--text);cursor:pointer">Apply</button></div>`;const m=document.getElementById('modal');const mc=document.getElementById('mcbody');mc.innerHTML=`<h3 style="margin:0 0 8px;font-size:14px">${t('recolorWs')}</h3>${html}<div style="text-align:right;margin-top:12px"><button onclick="closeModal()" style="padding:6px 16px;border-radius:6px;border:none;background:var(--panel2);color:var(--text);cursor:pointer">${t('close')}</button></div>`;m.classList.add('on')}
function applyWsColor(c){_wsColorMap[currentWs]=c;saveWsColors();rebuildWsDropdown();closeModal();toast('Color updated',{kind:'ok',ms:1200})}
function flashInd(id){const el=document.getElementById(id);if(!el)return;el.classList.remove('flash');void el.offsetWidth;el.classList.add('flash')}
function hideMore(){window.dbg&&window.dbg('IMPORT','hideMore() — removing .on from #more (may break iOS label→input chain)');document.getElementById('more').classList.remove('on')}
/* Phase 1.8 — toggleMore() centralizes open/close and anchors via
   placePopover so the menu flips up when there's no room below (common in
   portrait iPad/iPhone where the toolbar wraps to two rows and the menu
   would otherwise run past the bottom of the viewport). */
function toggleMore(){
  const more=document.getElementById('more');
  if(!more)return;
  if(more.classList.contains('on')){more.classList.remove('on');return}
  more.classList.add('on');
  placePopover('more','moreBtn');
}
// Keep the More menu anchored while open if the viewport reflows.
window.addEventListener('resize',()=>{
  const more=document.getElementById('more');
  if(more&&more.classList.contains('on'))placePopover('more','moreBtn');
});
/* Phase 1.7 · Item #9 — panel toggle / outside-click / Esc.
 *
 * Before: `?` opened the Legend but tapping `?` again did nothing — the
 * user had to hunt for the `×` inside the panel to close it. Same
 * pattern issue affected the More menu (outside-click already worked on
 * non-canvas taps only, and Escape didn't close it at all).
 *
 * toggleLegend() flips the .on class so the same button opens AND closes.
 * hideLegend() is the explicit close used by the × tog span.
 *
 * IMPORTANT: we listen on 'pointerdown' (capture phase), not 'click'. The
 * canvas #cv calls e.preventDefault() in its own pointerdown handler AND
 * uses setPointerCapture — in Chromium that combo suppresses the synthetic
 * 'click' event entirely, so a 'click'-based outside-close never fires
 * when the user taps the canvas background. pointerdown fires first and is
 * not affected, making outside-close reliable for both canvas and non-canvas
 * targets. The Escape handler at the bottom of this file was extended to
 * also call hideLegend() + hideMore(). */
function toggleLegend(){document.getElementById('lg').classList.toggle('on')}
function hideLegend(){document.getElementById('lg').classList.remove('on')}
document.addEventListener('pointerdown',e=>{
  const more=document.getElementById('more');
  if(more&&more.classList.contains('on')&&!more.contains(e.target)&&!(e.target.closest&&e.target.closest('#moreBtn')))hideMore();
  const lg=document.getElementById('lg');
  if(lg&&lg.classList.contains('on')&&!lg.contains(e.target)&&!(e.target.closest&&e.target.closest('#lgBtn')))hideLegend();
  /* Phase 5b — context menu + edge picker outside-click. These were on
     'click' (line ~1020) which is suppressed by the canvas's pointerdown
     preventDefault + setPointerCapture combo. Move them here. */
  const _ctx=document.getElementById('ctx');
  if(_ctx&&_ctx.classList.contains('on')&&!_ctx.contains(e.target))hideCtx();
  const _ep=document.getElementById('ep');
  if(_ep&&_ep.classList.contains('on')&&!_ep.contains(e.target))_ep.classList.remove('on');
},true);
function urlDomain(u){try{const p=new URL(u);const h=p.hostname.replace('www.','');if(h.includes('tradingview'))return 'tradingview';if(h.includes('github'))return 'github';if(h.includes('arxiv'))return 'arxiv';if(h.includes('notion'))return 'notion';if(h.includes('youtube'))return 'youtube';if(h.includes('x.com')||h.includes('twitter'))return 'x';return h.split('.')[0]}catch(e){return 'link'}}
function renderSB(){const body=document.getElementById('sbbody');if(!body)return;const q=(document.getElementById('sbq')?.value||'').toLowerCase();const groups={};for(const n of ns()){if(q&&!((n.label||'')+(n.notes||'')+(n.tags||'')).toLowerCase().includes(q))continue;const zid=n.zone;if(!groups[zid])groups[zid]=[];groups[zid].push(n)}
  let h='';for(const z of zs()){const items=groups[z.id]||[];if(!items.length&&q)continue;const col=S.sbCollapse?.[S.current+':'+z.id];h+=`<div class="zhdr" onclick="toggleZoneCollapse('${z.id}')"><span style="color:${z.color}">${esc(z.name)}</span><span class="ct">${items.length}${col?' ▸':' ▾'}</span></div>`;if(!col)for(const n of items){const rtl=/[\u0590-\u05FF]/.test(n.label||'')?' rtl':'';const dot=statusDotSvg(n.status,n.shape);const desc=(n.notes||n.rationale||'').slice(0,50);
      // D5 · Phase 1.6 — run the preview snippet through mdProcess so
      // **bold**, *italic*, `code` render as HTML in the sidebar. Input is
      // already HTML-escaped via esc(), so the processor stays XSS-safe.
      const descHtml=desc?mdProcess(esc(desc)):'';
      const ur=n.url?`<a class="urp" href="${esc(n.url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗ ${urlDomain(n.url)}</a>`:'';h+=`<div class="item${rtl}" onclick="focusNode(${n.id})">${dot}<div class="txt"><div class="lbl">${esc(n.label)}</div>${descHtml?`<div class="desc">${descHtml}</div>`:''}${ur}</div></div>`}}
  body.innerHTML=h||'<div style="padding:12px;color:var(--muted);font-size:11px">No nodes yet</div>'}
function toggleZoneCollapse(zid){if(!S.sbCollapse)S.sbCollapse={};const k=S.current+':'+zid;S.sbCollapse[k]=!S.sbCollapse[k];sv();renderSB()}
function statusDotSvg(st,sh){const c=SC[st]||SC.idea;if(sh==='project'){const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5;const r=i%2===0?5:2.5;pts.push((5+r*Math.cos(ang))+','+(5+r*Math.sin(ang)))}return `<svg class="dot" viewBox="0 0 10 10"><polygon points="${pts.join(' ')}" fill="${c}"/></svg>`}
  if(sh==='principle')return `<svg class="dot" viewBox="0 0 10 10"><polygon points="5,0 10,5 5,10 0,5" fill="${c}"/></svg>`;
  if(sh==='resource')return `<svg class="dot" viewBox="0 0 10 10"><polygon points="2.5,1 7.5,1 10,5 7.5,9 2.5,9 0,5" fill="${c}"/></svg>`;
  if(sh==='library')return `<svg class="dot" viewBox="0 0 10 10"><rect x="0" y="1" width="10" height="8" fill="${c}"/></svg>`;
  if(sh==='question')return `<svg class="dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="${c}"/><text x="5" y="7.5" text-anchor="middle" font-size="7" fill="#000">?</text></svg>`;
  if(sh==='experiment')return `<svg class="dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="${c}"/></svg>`;
  return `<svg class="dot" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="${c}"/></svg>`}
function focusNode(id){const n=ns().find(x=>x.id===id);if(!n)return;
  /* Sprint 4.1 · keep the navigation target mounted for the whole camera
     animation (hard cull exception) so it's already present on arrival — no
     blank frame when --cull-v1 is ON. invalidate() forces a fresh cull scan on
     the first animated frame. Cleared when the animation lands (sel=n then
     keeps it mounted). */
  window.__cullFocusTarget=id;if(window.CullV1)window.CullV1.invalidate();
  const tx=-n.x,ty=-n.y;const steps=12;let i=0;const sx=view.x,sy=view.y;const anim=()=>{i++;const t=i/steps;view.x=sx+(tx-sx)*t;view.y=sy+(ty-sy)*t;render();if(i<steps)requestAnimationFrame(anim);else window.__cullFocusTarget=null};anim();sel=n;op(n)}
function cycleSb(){const sb=document.getElementById('sb');sb.classList.remove('mini');sb.classList.toggle('co')}
function sbHeadClick(e){const sb=document.getElementById('sb');if(sb.classList.contains('mini')){sb.classList.remove('mini')}}
function sbResize(e){e.preventDefault();const sb=document.getElementById('sb');const sx=e.clientX,ow=sb.offsetWidth;const mm=ev=>{sb.style.width=Math.max(200,Math.min(500,ow+ev.clientX-sx))+'px'};const mu=()=>{document.removeEventListener('pointermove',mm);document.removeEventListener('pointerup',mu)};document.addEventListener('pointermove',mm);document.addEventListener('pointerup',mu)}
function collapseAllZones(){if(!S.sbCollapse)S.sbCollapse={};const ck=S.current+':__';const allCollapsed=zs().every(z=>S.sbCollapse[S.current+':'+z.id]);for(const z of zs())S.sbCollapse[S.current+':'+z.id]=!allCollapsed;sv();renderSB()}
/* Phase 6 · aggressive tab collapsing.
   - Major canvas = vault OR direct child of vault. These are the only
     tabs visible by default; every other canvas tucks under its ancestor.
   - Only ONE major tab can be expanded at a time (S._tabExpanded). This
     keeps the bar bounded even with 50+ canvases.
   - The major tab containing the active canvas auto-expands so the active
     sub-tab stays reachable.
   - Hidden tabs (S.hiddenTabs[]) skip the bar entirely. Long-press →
     "Hide from tab bar" toggles. Hidden tabs surface in an overflow
     popover at the end of the bar.
   - Major tabs show a child-count badge; tapping a major tab navigates
     to it AND expands its children. Tapping again collapses. */
function renderTabs(){const t=document.getElementById('tabs');if(!t)return;
  const ids=Object.keys(S.canvases);
  const childrenOf={};for(const cid of ids){const pc=S.canvasMeta[cid]?.parentCanvas;if(pc&&ids.includes(pc)){if(!childrenOf[pc])childrenOf[pc]=[];childrenOf[pc].push(cid)}}
  // A "major" canvas: vault, direct child of vault, OR orphan (no valid
  // parent) so we don't lose canvases when their parent reference rots.
  const isMajor=cid=>{
    if(cid==='vault')return true;
    const pc=S.canvasMeta[cid]?.parentCanvas;
    if(pc==='vault')return true;
    // Phase 6 · orphan promotion. parentCanvas missing OR points to a
    // canvas that no longer exists → treat as major. Tab bar shows the
    // canvas; sidebar Uncategorized group counts it.
    if(!pc||!ids.includes(pc))return true;
    return false;
  };
  // Walk up to the major ancestor (vault or vault-child).
  function majorAncestorOf(cid){let cur=cid;let guard=20;while(cur&&guard-->0){if(isMajor(cur))return cur;cur=S.canvasMeta[cur]?.parentCanvas}return 'vault'}
  // Auto-expand the major tab that contains the active canvas.
  const activeMajor=majorAncestorOf(S.current);
  if(!S._tabExpanded&&activeMajor!=='vault')S._tabExpanded=activeMajor;
  if(!S.hiddenTabs)S.hiddenTabs=[];
  const hidden=new Set(S.hiddenTabs);
  // Count descendants (not just direct children) for the badge.
  function descendantCount(cid){let total=0;const stack=[cid];while(stack.length){const n=stack.pop();const kids=(childrenOf[n]||[]);for(const k of kids){if(hidden.has(k))continue;total++;stack.push(k)}}return total}
  // Major tabs to render: all majors NOT hidden.
  const majors=ids.filter(c=>isMajor(c)&&!hidden.has(c));
  let h='';
  for(const cid of majors){
    const name=S.canvasMeta[cid]?.name||cid;
    const cur=cid===S.current;
    const expanded=S._tabExpanded===cid&&cid!=='vault';
    const cnt=descendantCount(cid);
    const badge=cnt>0?` <span class="tab-badge">${cnt}</span>`:'';
    const tog=cnt>0?`<span class="tab-tog">${expanded?'▾':'▸'}</span>`:'';
    const closeBtn=cid==='vault'?'':`<span class="x" onclick="event.stopPropagation();closeCanvas('${cid}')" title="Delete canvas">×</span>`;
    h+=`<div class="tab${cur?' cur':''}${cnt>0?' major':''}" onclick="onTabTap('${cid}')" oncontextmenu="event.preventDefault();showTabCtx(event,'${cid}')">${tog}${esc(name)}${badge}${closeBtn}</div>`;
    // Children only render when this major is expanded.
    if(expanded){
      // BFS through descendants (skip hidden), indent by depth.
      const queue=[[cid,0]];const seen=new Set([cid]);
      while(queue.length){const [parent,depth]=queue.shift();const kids=(childrenOf[parent]||[]).filter(k=>!hidden.has(k)&&!seen.has(k));
        for(const k of kids){seen.add(k);
          const kn=S.canvasMeta[k]?.name||k;const kcur=k===S.current;
          const kKids=(childrenOf[k]||[]).filter(x=>!hidden.has(x));
          const kHasKids=kKids.length>0;
          const kCollapsed=!!S._tabCollapse?.[k];
          const kTog=kHasKids?`<span class="tab-tog" onclick="event.stopPropagation();toggleTabGroup('${k}')">${kCollapsed?'▸':'▾'}</span>`:'';
          const kClose=`<span class="x" onclick="event.stopPropagation();closeCanvas('${k}')" title="Delete canvas">×</span>`;
          h+=`<div class="tab sub${kcur?' cur':''}" style="padding-left:${16+(depth+1)*12}px;font-size:11px" onclick="switchTo('${k}')" oncontextmenu="event.preventDefault();showTabCtx(event,'${k}')">${kTog}${esc(kn)}${kClose}</div>`;
          if(!kCollapsed)queue.push([k,depth+1]);
        }}
    }
  }
  h+='<div class="newtab" onclick="newTab()" title="New standalone canvas">＋</div>';
  // Hidden-tabs overflow chip
  if(hidden.size){h+=`<div class="newtab tab-overflow" onclick="showHiddenTabs(event)" title="Show hidden tabs">⋯ ${hidden.size}</div>`}
  t.innerHTML=h}
/* Tap on a major tab: switch to it AND toggle expansion.
   - If you tap the active major, just collapse. - Otherwise switch + expand. */
function onTabTap(cid){
  const isMajor=cid==='vault'||S.canvasMeta[cid]?.parentCanvas==='vault';
  if(!isMajor){switchTo(cid);return}
  if(S._tabExpanded===cid&&cid===S.current){S._tabExpanded=null;renderTabs();return}
  S._tabExpanded=cid==='vault'?null:cid;
  if(cid!==S.current)switchTo(cid);else renderTabs();
}
function toggleTabGroup(cid){if(!S._tabCollapse)S._tabCollapse={};S._tabCollapse[cid]=!S._tabCollapse[cid];renderTabs()}
function hideFromTabBar(cid){if(!S.hiddenTabs)S.hiddenTabs=[];if(!S.hiddenTabs.includes(cid))S.hiddenTabs.push(cid);sv();renderTabs()}
function unhideTab(cid){if(!S.hiddenTabs)return;S.hiddenTabs=S.hiddenTabs.filter(x=>x!==cid);sv();renderTabs()}
function showHiddenTabs(ev){
  const list=(S.hiddenTabs||[]).filter(c=>S.canvases[c]);
  ctx.innerHTML=`<div class="csub">${S.hebrewMode?'טאבים מוסתרים':'Hidden tabs'}</div>${list.length?list.map(c=>`<button onclick="unhideTab('${c}');hideCtx()">↺ ${esc(S.canvasMeta[c]?.name||c)}</button>`).join(''):`<div style="padding:8px 12px;color:var(--muted);font-size:11px">${S.hebrewMode?'אין':'None'}</div>`}`;
  positionCtx(ev.clientX,ev.clientY);
}
function positionCtx(x,y){
  /* Phase 6 · keep #ctx in CSS class system. Make it measurable by removing
     visibility off-screen, measure, place, then add .on so the entrance
     animation plays from the corner where it appears. */
  ctx.style.left='-9999px';ctx.style.top='-9999px';ctx.classList.add('on');
  requestAnimationFrame(()=>{const r=ctx.getBoundingClientRect();const W=innerWidth,H=innerHeight,pad=8;let nx=x,ny=y;if(x+r.width+pad>W)nx=Math.max(pad,x-r.width);if(y+r.height+pad>H)ny=Math.max(pad,y-r.height);ctx.style.left=nx+'px';ctx.style.top=ny+'px'})}
function showTabCtx(e,cid){const m=S.canvasMeta[cid]||{};
  const isLinked=!!m.parentNodeId;const linkLabel=isLinked?(S.hebrewMode?'חבר לפרויקט אחר':'Reconnect to project'):(S.hebrewMode?'חבר לפרויקט':'Connect to project');
  /* Phase 6 · Hide-from-tab-bar option. Vault can't be hidden (it's the
     anchor); other canvases get a "Hide" toggle so the user can
     declutter without deleting data. Hidden tabs surface in the ⋯
     overflow chip at the end of the bar. */
  const hideLabel=cid==='vault'?'':`<button onclick="hideFromTabBar('${cid}');hideCtx()">${S.hebrewMode?'הסתר מסרגל הטאבים':'Hide from tab bar'}</button>`;
  ctx.innerHTML=`<div class="csub">${esc(m.name||cid)}</div><button onclick="renameCanvas('${cid}');hideCtx()">${S.hebrewMode?'שנה שם':'Rename'}</button><button onclick="showProjectPicker('${cid}');hideCtx()">${esc(linkLabel)}</button>${isLinked?`<button onclick="unlinkCanvas('${cid}');hideCtx()">${S.hebrewMode?'נתק מפרויקט':'Unlink from project'}</button>`:''}${hideLabel}${cid!=='vault'?`<div class="csep"></div><button onclick="hideCtx();closeCanvas('${cid}')" style="color:var(--block)">${S.hebrewMode?'מחק קנבס':'Delete canvas'}</button>`:''}`;positionCtx(e.clientX,e.clientY)}
async function renameCanvas(cid){const m=S.canvasMeta[cid];if(!m)return;const newName=await uiPrompt(S.hebrewMode?'שם חדש לקנבס':'Rename canvas',m.name||cid);if(!newName)return;sn();m.name=newName.trim();sv();renderTabs();bB()}
function unlinkCanvas(cid){const m=S.canvasMeta[cid];if(!m||!m.parentNodeId)return;sn();const pn=S.canvases[m.parentCanvas||'vault']?.nodes.find(n=>n.id===m.parentNodeId);if(pn)pn.childCanvas=null;m.parentNodeId=null;sv();render();renderTabs()}
function showProjectPicker(cid){modal.classList.add('on');const projectNodes=[];for(const[ck,cv2]of Object.entries(S.canvases)){if(ck===cid)continue;for(const n of cv2.nodes||[]){if(n.shape==='project')projectNodes.push({n,canvasId:ck,canvasName:S.canvasMeta[ck]?.name||ck})}}
  document.getElementById('mcbody').innerHTML=`<h3>${S.hebrewMode?'בחר צומת פרויקט להתחבר אליו':'Choose project node to connect to'}</h3><input id="ppQ" placeholder="${esc(S.hebrewMode?'חיפוש…':'Search…')}" oninput="renderProjectPicker('${cid}')" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);margin-bottom:12px"/><div class="plist" id="ppL"></div><div class="brow"><button onclick="closeModal()">${t('close')}</button></div>`;
  window._projectNodes=projectNodes;renderProjectPicker(cid)}
function renderProjectPicker(cid){const q=(document.getElementById('ppQ')?.value||'').toLowerCase();const items=window._projectNodes.filter(p=>!q||(p.n.label||'').toLowerCase().includes(q)||(p.canvasName||'').toLowerCase().includes(q));document.getElementById('ppL').innerHTML=items.map(p=>`<div class="pitem" onclick="connectCanvasToProject('${cid}',${p.n.id},'${p.canvasId}');closeModal()"><b>${esc(p.n.label)}</b><span style="color:var(--muted);font-size:11px"> · ${esc(p.canvasName)}</span></div>`).join('')||`<div style="color:var(--muted);font-size:12px">${S.hebrewMode?'אין צמתי פרויקט':'No project nodes'}</div>`}
function connectCanvasToProject(cid,nodeId,parentCanvas){sn();const m=S.canvasMeta[cid];if(!m)return;if(m.parentNodeId){const oldPn=S.canvases[m.parentCanvas||'vault']?.nodes.find(n=>n.id===m.parentNodeId);if(oldPn)oldPn.childCanvas=null}m.parentNodeId=nodeId;m.parentCanvas=parentCanvas;const newPn=S.canvases[parentCanvas]?.nodes.find(n=>n.id===nodeId);if(newPn)newPn.childCanvas=cid;sv();render();renderTabs();bB()}
async function newTab(){const name=await uiPrompt('New canvas','New Canvas');if(!name)return;sn();const cid='c-'+Date.now();S.canvases[cid]={nodes:[],edges:[],zones:[]};S.canvasMeta[cid]={name,parentNodeId:null,parentCanvas:null};sv();switchTo(cid)}
async function closeCanvas(cid){if(cid==='vault')return;const m=S.canvasMeta[cid];if(!await uiConfirm(`Delete canvas "${m?.name||cid}" and all its nodes? This cannot be undone with ↶.`,{title:'Delete canvas',danger:true,okLabel:'Delete'}))return;sn();if(m?.parentNodeId){const pc=m.parentCanvas||'vault';const pn=S.canvases[pc]?.nodes.find(n=>n.id===m.parentNodeId);if(pn)pn.childCanvas=null}delete S.canvases[cid];delete S.canvasMeta[cid];if(S.current===cid)S.current='vault';sv();render();renderTabs();renderSB();bB()}
function exCanvas(){const c=C();const meta=S.canvasMeta[S.current]||{};const out={canvasId:S.current,createCanvas:true,canvasName:meta.name,parentCanvas:meta.parentCanvas,parentNodeId:meta.parentNodeId,replaceZones:true,zones:c.zones,nodes:c.nodes.map(n=>({...n,id:undefined})),edges:c.edges.map(e=>{const fn=c.nodes.find(x=>x.id===e.from)?.label,tn=c.nodes.find(x=>x.id===e.to)?.label;return{from:fn,to:tn,type:e.type}}).filter(e=>e.from&&e.to)};const b=new Blob([JSON.stringify(out,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(meta.name||'canvas').replace(/[^a-z0-9]+/gi,'-')+'.json';a.click()}
function imFCanvas(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const parsed=JSON.parse(r.result);parsed.useCurrentCanvas=true;parsed.canvasId=S.current;delete parsed.createCanvas;showPatch();document.getElementById('pt').value=JSON.stringify(parsed,null,2)}catch(err){uiNotice('Parse error: '+err.message,{title:'Import failed'})}};r.readAsText(f)}
async function quickLink(){const u=await uiPrompt('Add resource link','',{placeholder:'https://…',hint:'Paste any URL — it becomes a resource node.'});if(!u)return;let lbl=u,z=zs()[zs().length-1].id;try{const p=new URL(u),seg=p.pathname.split('/').filter(Boolean);lbl=(seg[seg.length-1]||p.hostname).replace(/[-_]/g,' ').slice(0,40)}catch(e){}const w=s2w(innerWidth/2,innerHeight/2);const n=addNode(w.x,w.y,{label:lbl,url:u,shape:'resource',zone:z});sel=n;op(n)}
// Phase 1.7 · inline onclick in the More menu used to read
//   if(confirm('Clear current canvas?')){sn();clr()}
// but that blocked wiring the new dark-themed dialog. Extracted to a named
// async fn so the menu item can just call clearCanvasConfirm().
async function clearCanvasConfirm(){if(!await uiConfirm('Clear current canvas?',{title:'Clear canvas',danger:true,okLabel:'Clear'}))return;sn();clr()}
/* Phase 5 P2 — undo/redo. sn() snapshots before any mutation and
   ALSO clears redoStack: a fresh user action invalidates any redo
   history. un() saves the current state to redoStack before popping
   the last hist entry; re() is the mirror — pop redoStack, push
   current to hist, restore. Panels/toolbar update via bB() at the
   end so the disabled/enabled state of ↶/↷ is always fresh. */
function sn(){hist.push(JSON.stringify(S));if(hist.length>40)hist.shift();redoStack.length=0;bB()}
function un(){if(!hist.length)return;redoStack.push(JSON.stringify(S));if(redoStack.length>40)redoStack.shift();S=JSON.parse(hist.pop());const sid=sel?.id;sel=sid?ns().find(n=>n.id===sid):null;sv();render();bF();bB();sel?op(sel):cp()}
function re(){if(!redoStack.length)return;hist.push(JSON.stringify(S));if(hist.length>40)hist.shift();S=JSON.parse(redoStack.pop());const sid=sel?.id;sel=sid?ns().find(n=>n.id===sid):null;sv();render();bF();bB();sel?op(sel):cp()}
/* Phase 1.8 — test hook. Spec files that need to construct deep canvas
   chains without driving addNode + dblclick use this. The app itself
   never reads it. One line here beats adding a full "open child canvas"
   path to tests. */
window.__testAddChildCanvas=(id,name,parent)=>{
  if(!S.canvases[id])S.canvases[id]={nodes:[],edges:[],zones:[]};
  S.canvasMeta[id]={name,parentCanvas:parent||'vault'};
  S.current=id;
  bB();
};
function bB(){const chain=[];let c2=S.current;while(c2){chain.unshift({id:c2,name:S.canvasMeta[c2]?.name||c2});const p=S.canvasMeta[c2]?.parentCanvas;c2=p||null}
  const backBtn=document.getElementById('backBtn');if(backBtn){if(chain.length>1){backBtn.style.display='inline-block';backBtn.setAttribute('data-parent',chain[chain.length-2].id)}else{backBtn.style.display='none'}}
  // Phase 5 P2 — undo/redo button disable state (must run before any return)
  const ub=document.getElementById('undoBtn'),rb=document.getElementById('redoBtn');
  if(ub)ub.disabled=!hist.length;
  if(rb)rb.disabled=!redoStack.length;
  /* Phase 5b — hide breadcrumb chip on root canvas. Showing "Vault" alone
     is visual noise; the breadcrumb only adds value when navigated deeper. */
  if(chain.length<=1){bc.style.display='none';return}
  bc.style.display='';
  // Phase 1.8 — collapsible breadcrumbs. Default "thin": just the current
  // canvas + a chevron if the chain is deeper than 1. Tap expands the full
  // chain inline; tapping any ancestor navigates there. Depth-1 canvases
  // skip the chevron and always show just the name.
  // Phase 5b — Hebrew RTL: swap separator direction, set dir attribute, and
  // flip the expand chevron so the crumb reads right-to-left naturally.
  const rtl=!!S.hebrewMode;
  const sep=rtl?'‹':'›';
  const expChev=rtl?'◂':'▾';
  const colChev=rtl?'▸':'▴';
  bc.dir=rtl?'rtl':'ltr';
  const last=chain[chain.length-1];
  const mini=chain.length>1
    ?`<span class="bc-mini"><span class="bc-dots">…</span><span class="bc-sep">${sep}</span><span class="cur">${esc(last.name)}</span><span class="bc-exp">${expChev}</span></span>`
    :`<span class="bc-mini"><span class="cur">${esc(last.name)}</span></span>`;
  const full=chain.map((n,i)=>i===chain.length-1
    ?`<span class="cur">${esc(n.name)}</span>`
    :`<a onclick="event.stopPropagation();switchTo('${n.id}')">${esc(n.name)}</a><span class="bc-sep">${sep}</span>`).join(' ');
  const fullWrap=chain.length>1?`<span class="bc-full">${full}<span class="bc-col">${colChev}</span></span>`:'';
  bc.innerHTML=mini+fullWrap;
  // Tap anywhere on #bc (except an <a> inside the expanded chain) toggles.
  bc.onclick=e=>{if(e.target.tagName==='A')return;bc.classList.toggle('expanded')};
  /* undo/redo disable moved to top of bB() so it runs even on early return */}
function goBack(){const p=document.getElementById('backBtn').getAttribute('data-parent');if(p)switchTo(p)}
function switchTo(id){if(!S.canvases[id])return;S.current=id;sel=null;cp();view={x:0,y:0,k:.5};sv();render();bF();bB();renderTabs();renderSB();zF()}
/* Phase 6 · view-state clamp. Prevents the "canvas flew to infinity" failure
   mode where extreme transform values cause WebKit to drop the compositor
   layer and render the canvas blank. Zoom locked to [0.1, 5.0]; pan is
   clamped so the viewport center stays within 2× the content bounding box. */
function clampView(){
  view.k=Math.max(0.1,Math.min(5.0,view.k));
  if(!isFinite(view.x))view.x=0;
  if(!isFinite(view.y))view.y=0;
  const items=ns();
  if(!items.length){view.x=Math.max(-5000,Math.min(5000,view.x));view.y=Math.max(-5000,Math.min(5000,view.y));return}
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const n of items){if(n.x<minX)minX=n.x;if(n.x>maxX)maxX=n.x;if(n.y<minY)minY=n.y;if(n.y>maxY)maxY=n.y}
  const w=Math.max(maxX-minX,200),h=Math.max(maxY-minY,200);
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  view.x=Math.max(-cx-2*w,Math.min(-cx+2*w,view.x));
  view.y=Math.max(-cy-2*h,Math.min(-cy+2*h,view.y));
}
/* Phase 6 · force a synchronous layout flush after extreme transform updates
   so WebKit doesn't drop the layer. Reading offsetHeight is cheap and
   triggers reflow. Only used after pinch/pan/wheel — render() itself rebuilds
   innerHTML which already flushes. */
function forceRepaint(){const cv=document.getElementById('cv');if(cv)void cv.offsetHeight}
/* Sprint 4.6 · is a viewport pan/pinch/inertia in progress? render() refuses to
   rebuild while this is true (it just moves the layers via applyView), so
   renders/s stays 0 during motion and fps stays 60. Content drags (node / zone /
   marquee / resize / edge) are NOT viewport motion — they short-circuit to false
   so they keep rendering every move. Reliable because gesture.js never goes IDLE
   mid-pan (it settles only on finger-up; see gesture.js pointerUpOrCancel). */
function isViewportMotion(){
  if(drag&&drag.k!=='pan')return false;            // a content drag — must render
  if(window._inertiaActive)return true;
  try{const g=window.GestureV2;if(g&&typeof g.getState==='function'){const s=g.getState();if(s==='pan'||s==='pinch'||s==='inertia')return true;}}catch(e){}
  if(pinchState)return true;                        // legacy 2-finger (gestures-v2 OFF)
  if(drag&&drag.k==='pan')return true;              // legacy pan (gestures-v2 OFF)
  return false;
}
function render(){
  /* Sprint 4.6 · ZERO renders during viewport motion (the Phase-4 closeout). If
     a pan/pinch/inertia is in progress, never rebuild the DOM — just move the
     layers (applyView) and bail. This plugs every render-during-motion path at
     one chokepoint, so renders/s reads 0 and fps holds 60. The single settle
     render (pan-settle.js) restores full fidelity when motion ends. --legacy-pan
     opts out (per-frame render rollback). */
  if(!(window.Flags&&window.Flags.on('legacy-pan'))&&isViewportMotion()){
    if(typeof applyView==='function')applyView();
    return;
  }
  const W=Math.max(innerWidth||document.documentElement.clientWidth||800,400),H=Math.max(innerHeight||document.documentElement.clientHeight||600,400);
  /* Sprint 4.5 · render() now runs ONLY on data-model changes (add / move-in-
     canvas-space / edit / delete / zone / edge / canvas-switch / view-mode) and
     once on gesture settle — NEVER per pan/zoom frame. The per-frame transform
     path is applyView() (below), called from CanvasTransform.commit(); it moves
     all layers as one space without rebuilding. This counter lets the HUD prove
     it: renders/s ≈ 0 during pan, one tick on settle. */
  window.__renderTick=(window.__renderTick||0)+1;
  if(window.dlog&&location.search.includes('debug')&&!window._renderLogged){window._renderLogged=true;dlog('render W='+W+' H='+H+' zones='+(zs()?.length||0)+' nodes='+(ns()?.length||0))}
  // Phase 1.5 diagnostics — throttle so pan/drag doesn't flood, but always
  // log the first few renders + any render after a quiet window so we see
  // post-import / canvas-switch activity.
  window._renderCount=(window._renderCount||0)+1;
  const _rn=window._renderCount,_now=Date.now(),_last=window._lastRenderLog||0;
  const _shouldLog=window.dbg&&(_rn<=3||(_now-_last)>1500);
  if(_shouldLog){
    window._lastRenderLog=_now;
    const noteN=ns().filter(n=>n.shape==='note').length;
    const fN=ns().filter(n=>n.shape==='formula'&&!n.compact).length;
    window.dbg('KATEX','render #'+_rn+' · formulas='+fN+' · notes='+noteN+' · katex='+(window.katex?'yes':'MISSING')+' · autoRender='+(window.renderMathInElement?'yes':'MISSING'));
  }
  cv.setAttribute('viewBox',`${-W/2/view.k-view.x} ${-H/2/view.k-view.y} ${W/view.k} ${H/view.k}`);
  cv.setAttribute('width',W);cv.setAttribute('height',H);
  // Phase 1 · 1.6c — viewport culling via rbush (bootstrap.ts loads it on
  // window.RBush). Only activates when the canvas has enough nodes that
  // DOM append cost can actually pay off (>=100). Edges are not culled —
  // they're cheap (single <path> each) and may cross the viewport even
  // when both endpoints are off-screen in the node list. The 200px margin
  // (in screen px, converted to world px by /view.k) ensures nodes that
  // are partially visible or about to scroll into view stay in the DOM.
  let visIds=null,edgeVisIds=null,cullOn=false;
  const OVERLAY_MIN_K=0.5; // Sprint 4.1 · overlay level-of-detail threshold
  /* Sprint 4.1 · viewport culling (--cull-v1). When ON, CullV1 decides the
     mounted set for BOTH heavy layers (SVG outlines/edges + DOM overlays):
     only nodes/edges within viewport+margin enter the innerHTML string at all
     (true unmount, not display:none). The scan is throttled to ~100ms during
     active gestures; the hard-exception `keep` set is always mounted. When OFF,
     the legacy rbush node-only cull (≥100 nodes) below runs unchanged — full
     rollback path. */
  if(window.Flags&&window.Flags.on('cull-v1')&&window.CullV1){
    cullOn=true;
    const keep=new Set();
    if(sel)keep.add(sel.id);
    for(const id of selSet)keep.add(id);
    if(edgeHover)keep.add(edgeHover.id);
    if(drag){
      if(drag.n)keep.add(drag.n.id);                        // dragged / resizing node
      if(drag.k==='edge'&&drag.from)keep.add(drag.from.id);  // in-progress edge-draw endpoint
    }
    if(window.__cullFocusTarget!=null)keep.add(window.__cullFocusTarget); // drawer center-on-node target
    const _active=!!drag||!!window._inertiaActive;
    const _cr=window.CullV1.compute(ns(),es(),view,W,H,keep,_active);
    visIds=_cr.nodeSet;edgeVisIds=_cr.edgeSet;
  } else if(window.RBush&&ns().length>=100){
    const margin=200/view.k;
    const vx1=-W/2/view.k-view.x-margin,vy1=-H/2/view.k-view.y-margin;
    const vx2=vx1+W/view.k+margin*2,vy2=vy1+H/view.k+margin*2;
    const tree=new window.RBush();
    tree.load(ns().map(n=>{
      // Use the userW/userH sizing for formula/note nodes; fall back to a
      // generous ±80 for glyph nodes (project/library/principle/etc.).
      const w=n.userW||80,h=n.userH||80;
      return{minX:n.x-w,minY:n.y-h,maxX:n.x+w,maxY:n.y+h,id:n.id};
    }));
    const hits=tree.search({minX:vx1,minY:vy1,maxX:vx2,maxY:vy2});
    visIds=new Set(hits.map(x=>x.id));
    // Always keep the selection + edge-hovered node mounted even if off-
    // screen so the selection chrome/edit chain stays stable during pan.
    if(sel)visIds.add(sel.id);
    for(const id of selSet)visIds.add(id);
    if(edgeHover)visIds.add(edgeHover.id);
  }
  let h=`<defs>${Object.entries(ET).map(([k,v])=>`<marker id="a-${k}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${v.c}"/></marker>`).join('')}</defs>`;
  // D3 · Phase 1.6 — overlay HTML accumulator for content (formula headers +
  // KaTeX bodies, note bodies, zone labels, edge labels) that moves off of
  // <foreignObject> to survive iOS WebKit paint. Flushed into
  // #canvasOverlay after SVG innerHTML is applied.
  let oh='';
  const isHe=document.body.classList.contains('he');
  /* Sprint 4.3 · simple-node mode. ON when --simple-nodes is set (always), OR
     when --freeze-pan is set and the canvas is in motion (window.__inMotion,
     toggled by freeze-pan.js off the gesture state). In that mode each node
     paints as a single state-coloured circle + title — cheap to rasterise — so
     a pan frame no longer repaints 88 vector silhouettes + halos. Rich nodes
     return the instant motion settles. CanvasTransform calls render() every pan
     frame (transform.js), so making that per-frame paint cheap IS the fix. */
  const simpleMode = !!(window.Flags && window.Flags.on('simple-nodes'));
  // Focus mode: if a node is selected, dim everything not related (same zone or edge-connected)
  const focusMode=!!sel&&!drag;
  let related=null;
  if(focusMode){
    related=new Set([sel.id]);
    for(const n of ns())if(n.zone===sel.zone)related.add(n.id);
    for(const e of es()){if(e.from===sel.id)related.add(e.to);if(e.to===sel.id)related.add(e.from)}
  }
  const dimE=S.dimEdges;
  for(const z of zs()){const lk=z.locked!==false;const rtl=isHe||/[\u0590-\u05FF]/.test(z.name||'');h+=`<g class="zone" data-zone="${z.id}"><rect class="zr ${lk?'locked':'zd'}" x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" stroke="${z.color}" stroke-dasharray="${view.k>0.35?'0':'6,5'}" data-locked="${lk?1:0}"/><foreignObject x="${z.x}" y="${z.y+6}" width="${z.w}" height="32" style="pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" style="direction:${rtl?'rtl':'ltr'};text-align:${rtl?'right':'left'};padding:0 18px;color:${z.color};font-family:'Inter','Assistant',system-ui,sans-serif;font-weight:700;font-size:12px;letter-spacing:${rtl?'0':'1px'};text-transform:${rtl?'none':'uppercase'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(z.name)}${lk?' 🔒':''}</div></foreignObject>${lk?'':`<rect class="zh" x="${z.x+z.w-14}" y="${z.y+z.h-14}" width="14" height="14" rx="3"/>`}</g>`}
  /* Phase 2 (Pass 3 § 08) · zones v2 hook (note: this block comes BEFORE the
     v1 zone loop above wrapped its own gate; this short-circuit prepends
     the v2 markup to `h` and then the v1 loop is skipped via the flag
     re-check below in the same render pass). When --zones-v2 is ON,
     ZonesV2.renderAll() emits the rect + dashed border with NO SVG label;
     the DOM chip layer (#zoneChips) is laid out by ZonesV2.reposition()
     right after the SVG innerHTML lands. */
  if (window.Flags && window.Flags.on('zones-v2') && window.ZonesV2) {
    // Strip whatever the v1 loop above appended (the zone <g> markup) before
    // we add v2's clean version. We can find it cheaply: the v1 loop emits
    // exactly N occurrences of `<g class="zone" data-zone=...`.
    h = h.replace(/<g class="zone"[\s\S]*?<\/g>/g, '');
    h += window.ZonesV2.renderAll(zs());
  }
  /* Phase 2 (Pass 3 § 06–07) · edges v2 hook.
     When --edges-v2 is ON, EdgeV2.renderAll() owns the whole edge loop:
     8 type channels + magnetic anchors + cubic-spline routing + per-pair
     fan-out + auto-legend. Skip the v1 loop entirely in that case. */
  /* Sprint 4.1 · cull edges to the visible set when --cull-v1 is ON. The node
     index handed to EdgeV2 stays full (ns()) so a kept edge whose endpoints are
     off-screen still routes correctly — only the edge LIST is filtered. Legend
     recomputes from the visible edges (a culled edge type must not count toward
     the legend threshold). */
  const _edgesVis = edgeVisIds ? es().filter(e=>edgeVisIds.has(e.id)) : es();
  if (window.Flags && window.Flags.on('edges-v2') && window.EdgeV2) {
    const _nodeIndex = new Map(ns().map(n => [n.id, n]));
    h += window.EdgeV2.renderAll(_edgesVis, _nodeIndex, view, {
      sel, focusMode, dimE
    });
    try { window.EdgeV2.refreshLegend(_edgesVis); } catch (e) {}
  } else
  for(const e of _edgesVis){const a=ns().find(n=>n.id===e.from),b=ns().find(n=>n.id===e.to);if(!a||!b)continue;const et=ET[e.type]||ET.feeds;
    const rA=46,rB=46;const dx0=b.x-a.x,dy0=b.y-a.y,d0=Math.hypot(dx0,dy0)||1;
    const ax=a.x+dx0/d0*rA,ay=a.y+dy0/d0*rA,bx=b.x-dx0/d0*rB,by=b.y-dy0/d0*rB;
    const dx=bx-ax,dy=by-ay;const horiz=Math.abs(dx)>Math.abs(dy);const off=Math.min(Math.abs(horiz?dx:dy)*0.75,240);
    const c1x=horiz?ax+Math.sign(dx)*off:ax,c1y=horiz?ay:ay+Math.sign(dy)*off;
    const c2x=horiz?bx-Math.sign(dx)*off:bx,c2y=horiz?by:by-Math.sign(dy)*off;
    const edgeFocus=focusMode&&(e.from===sel.id||e.to===sel.id);
    const edgeDim=dimE||(focusMode&&!edgeFocus);
    const edgeOpacity=edgeDim?(focusMode?0.08:0.18):1;
    const showEdgeLabel=!dimE&&view.k>0.4&&(!focusMode||edgeFocus);
    /* Sprint 3.1 Issue 2 — emit an invisible 20-px-stroke hit-target FIRST
       so iPad taps land reliably on thin edges. The visible path keeps its
       existing 2.5-px stroke + marker; the hit path has pointer-events:
       stroke so only the fat band catches taps. */
    h+=`<path class="edge-hit" data-edge="${e.id}" d="M ${ax},${ay} C ${c1x},${c1y} ${c2x},${c2y} ${bx},${by}" fill="none" stroke="transparent" stroke-width="20" pointer-events="stroke"/>`;
    h+=`<path class="edge ${e.dim?'dim':''}" data-edge="${e.id}" d="M ${ax},${ay} C ${c1x},${c1y} ${c2x},${c2y} ${bx},${by}" fill="none" stroke="${et.c}" stroke-width="2.5" marker-end="url(#a-${e.type||'feeds'})" opacity="${edgeOpacity}" pointer-events="none"/>`;
    if(showEdgeLabel){const lbl=e.customLabel||t(e.type||'feeds');const mx=(ax+3*c1x+3*c2x+bx)/8,my=(ay+3*c1y+3*c2y+by)/8;const labelRtl=/[\u0590-\u05FF]/.test(lbl);const fsize=labelRtl?12:10;h+=`<foreignObject x="${mx-60}" y="${my-11}" width="120" height="22" style="pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" style="direction:${labelRtl?'rtl':'ltr'};text-align:center;font-family:'Inter','Assistant',system-ui,sans-serif;font-size:${fsize}px;color:${et.c};background:var(--bg);border:1px solid ${et.c};border-radius:4px;padding:2px 8px;display:inline-block;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${esc(lbl)}</div></foreignObject>`}}
  for(const n of ns()){if(visIds&&!visIds.has(n.id))continue;const c=SC[n.status]||SC.idea,s=42,se=sel?.id===n.id||selSet.has(n.id),tg=edgeHover?.id===n.id;const focusDim=focusMode&&!related.has(n.id);let sh='',ring='',richContent='';
    /* Phase 2 (Pass 3 § 02) · silhouettes v2 hook.
       When --silhouettes is ON and the renderer is loaded, the new module
       owns the shape + status dot + freshness halo + selection ring for
       every node type. Note + formula still emit their richContent via the
       v1 branches below (DOM .nslice contract unchanged) — we only swap the
       inline-SVG shape markup. When OFF, the existing per-shape branches
       (project / library / principle / …) own everything. */
    if(simpleMode){
      /* Sprint 4.3 · simple node — filled circle in the state colour; the title
         is added below via svgLabel. No silhouette, no halo, no rich body. */
      sh=`<circle cx="${n.x}" cy="${n.y}" r="26" fill="${c}" stroke="rgba(255,255,255,0.22)" stroke-width="2"/>`;
      if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="32"/>`;
    } else {
    const _silV2 = window.Flags && window.Flags.on('silhouettes') && typeof window.RenderSilhouette === 'function';
    if (_silV2 && n.shape !== 'formula' && n.shape !== 'note') {
      const _sil = window.RenderSilhouette(n, view, {
        rtl: isHe || /[֐-׿]/.test(n.label || ''),
        selected: se || tg,
        focused: focusMode && related && related.has(n.id),
        dim: focusDim,
        wsAccent: 'var(--hot)'
      });
      sh = _sil.sh;
      ring = _sil.ring;
    } else
    if(n.shape==='project'){const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5;const r=i%2===0?s:s*.5;pts.push((n.x+r*Math.cos(ang))+','+(n.y+r*Math.sin(ang)))}sh=`<polygon points="${pts.join(' ')}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s+6}"/>`}
    else if(n.shape==='library'){sh=`<rect x="${n.x-s}" y="${n.y-s*.65}" width="${s*2}" height="${s*1.3}" rx="3" fill="${c}" stroke="rgba(255,255,255,.18)"/><line x1="${n.x-s*.5}" y1="${n.y-s*.55}" x2="${n.x-s*.5}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><line x1="${n.x}" y1="${n.y-s*.55}" x2="${n.x}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><line x1="${n.x+s*.5}" y1="${n.y-s*.55}" x2="${n.x+s*.5}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/>`;if(se||tg)ring=`<rect class="ring" x="${n.x-s-4}" y="${n.y-s*.65-4}" width="${s*2+8}" height="${s*1.3+8}" rx="5"/>`}
    else if(n.shape==='principle'){sh=`<polygon points="${n.x},${n.y-s*.9} ${n.x+s*.9},${n.y} ${n.x},${n.y+s*.9} ${n.x-s*.9},${n.y}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.9-5} ${n.x+s*.9+5},${n.y} ${n.x},${n.y+s*.9+5} ${n.x-s*.9-5},${n.y}"/>`}
    else if(n.shape==='resource'){sh=`<polygon points="${n.x-s*.45},${n.y-s*.65} ${n.x+s*.45},${n.y-s*.65} ${n.x+s*.9},${n.y} ${n.x+s*.45},${n.y+s*.65} ${n.x-s*.45},${n.y+s*.65} ${n.x-s*.9},${n.y}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s*.95}"/>`}
    else if(n.shape==='question'){sh=`<polygon points="${n.x},${n.y-s*.85} ${n.x+s*.85},${n.y-s*.05} ${n.x+s*.55},${n.y+s*.75} ${n.x-s*.55},${n.y+s*.75} ${n.x-s*.85},${n.y-s*.05}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+8}" font-size="24" font-weight="700" fill="#0F0F0F" text-anchor="middle">?</text>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.85-5} ${n.x+s*.85+5},${n.y-s*.05} ${n.x+s*.55+3},${n.y+s*.75+5} ${n.x-s*.55-3},${n.y+s*.75+5} ${n.x-s*.85-5},${n.y-s*.05}"/>`}
    else if(n.shape==='experiment'){sh=`<polygon points="${n.x},${n.y-s*.85} ${n.x+s*.8},${n.y+s*.65} ${n.x-s*.8},${n.y+s*.65}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+s*.35}" font-size="18" text-anchor="middle">⚗</text>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.85-6} ${n.x+s*.8+6},${n.y+s*.65+3} ${n.x-s*.8-6},${n.y+s*.65+3}"/>`}
    else if(n.shape==='doc'){const w2=s*.7,h2=s*.85;sh=`<path d="M ${n.x-w2} ${n.y-h2} L ${n.x+w2-12} ${n.y-h2} L ${n.x+w2} ${n.y-h2+12} L ${n.x+w2} ${n.y+h2} L ${n.x-w2} ${n.y+h2} Z" fill="${c}" stroke="rgba(255,255,255,.18)"/><path d="M ${n.x+w2-12} ${n.y-h2} L ${n.x+w2-12} ${n.y-h2+12} L ${n.x+w2} ${n.y-h2+12}" fill="none" stroke="rgba(0,0,0,.3)"/><line x1="${n.x-w2*.6}" y1="${n.y-h2*.3}" x2="${n.x+w2*.6}" y2="${n.y-h2*.3}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><line x1="${n.x-w2*.6}" y1="${n.y}" x2="${n.x+w2*.6}" y2="${n.y}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><line x1="${n.x-w2*.6}" y1="${n.y+h2*.3}" x2="${n.x+w2*.4}" y2="${n.y+h2*.3}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>`;if(se||tg)ring=`<rect class="ring" x="${n.x-w2-4}" y="${n.y-h2-4}" width="${w2*2+8}" height="${h2*2+8}" rx="4"/>`}
    else if(n.shape==='formula'){
      if(n.compact){
        // compact: small node with formula glyph + label below (handled by showLabel logic)
        sh=`<circle cx="${n.x}" cy="${n.y}" r="${s*.7}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+12}" font-size="36" text-anchor="middle" fill="#0F0F0F" font-style="italic" font-family="Source Serif 4,serif" font-weight="700">ƒ</text>`;
        if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s*.7+4}"/>`;
      }else{
        const labelLen=(n.label||'').length;const latex=n.latex||'';const latexRows=latex.split(/\\\\/).length;
        const autoW=Math.max(170,Math.min(380,Math.max(labelLen*5+30,latex.length*3.2+30)));
        const autoH=Math.max(70,50+latexRows*18);
        const fw=n.userW||autoW;const fh=n.userH||autoH;
        n._w=fw;n._h=fh;
        const fillColor=n.color||'var(--bg2)';
        const labelRtl=/[\u0590-\u05FF]/.test(n.label||'');
        // Shape = frame + header stripe + resize handle. All three live inside
        // the slice's inline SVG. .nrz gets `pointer-events:auto` via CSS so
        // resize-drag still works even though the rest of the slice is
        // `pointer-events:none`. See DECISIONS.md D5.
        sh=`<rect x="${n.x-fw}" y="${n.y-fh}" width="${fw*2}" height="${fh*2}" rx="10" fill="${fillColor}" stroke="${c}" stroke-width="2"/><rect x="${n.x-fw}" y="${n.y-fh}" width="${fw*2}" height="32" rx="10" fill="${c}" opacity="0.18"/><rect class="nrz" data-nrz="${n.id}" x="${n.x+fw-12}" y="${n.y+fh-12}" width="14" height="14" rx="3" fill="${c}" opacity="0.4"/>`;
        if(se||tg)ring=`<rect class="ring" x="${n.x-fw-4}" y="${n.y-fh-4}" width="${fw*2+8}" height="${fh*2+8}" rx="12"/>`;
        // Rich HTML content for the formula lives in the slice directly
        // (label strip + KaTeX body). Positions are LOCAL to the slice's
        // (n.x, n.y) origin — match the former foreignObject rects 1:1.
        richContent=
          `<div class="nov fnode-label" data-nid="${n.id}" style="left:${-fw+10}px;top:${-fh+5}px;width:${fw*2-20}px;height:24px;color:${c};direction:${labelRtl?'rtl':'ltr'}">${esc(n.label||'')}</div>`+
          `<div class="nov fnode" data-latex="${esc(n.latex||'')}" data-nid="${n.id}" style="left:${-fw+10}px;top:${-fh+38}px;width:${fw*2-20}px;height:${fh*2-46}px">${n.latex?'':'<span style=\"color:var(--muted);font-size:11px\">(אין נוסחה)</span>'}</div>`;
      }
    }
    else if(n.shape==='note'){
      const body=(n.notes||n.label||'');
      const lines=body.split('\n');
      const maxLine=Math.max(...lines.map(l=>l.length),(n.label||'').length);
      const lineCount=lines.length+(n.label?2:0);
      const autoW=Math.max(140,Math.min(280,maxLine*3.5+30));
      const autoH=Math.max(70,Math.min(280,lineCount*9+24));
      const nw=n.userW||autoW;const nh=n.userH||autoH;
      n._w=nw;n._h=nh;
      const noteRtl=/[\u0590-\u05FF]/.test(body);
      const noteStroke=n.color||c;
      const safeBody=String(body).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      const mdBody=mdProcess(safeBody);
      // D5 · Phase 1.6 — note migration. Shape = border rect + resize handle
      // (inline SVG). Body = overlay div with mdProcess output + inline math
      // container. No more <foreignObject> — iOS WebKit finally paints it.
      sh=`<rect x="${n.x-nw}" y="${n.y-nh}" width="${nw*2}" height="${nh*2}" rx="6" fill="var(--panel)" stroke="${noteStroke}" stroke-width="2"/><rect class="nrz" data-nrz="${n.id}" x="${n.x+nw-12}" y="${n.y+nh-12}" width="14" height="14" rx="3" fill="${noteStroke}" opacity="0.4"/>`;
      if(se||tg)ring=`<rect class="ring" x="${n.x-nw-4}" y="${n.y-nh-4}" width="${nw*2+8}" height="${nh*2+8}" rx="8"/>`;
      const titleHtml=n.label?`<div style="font-weight:700;font-size:13px;margin-bottom:5px;color:${noteStroke};white-space:normal">${esc(n.label)}</div>`:'';
      richContent=`<div class="nov note-body" data-nid="${n.id}" style="left:${-nw+10}px;top:${-nh+10}px;width:${nw*2-20}px;height:${nh*2-20}px;direction:${noteRtl?'rtl':'ltr'};text-align:${noteRtl?'right':'left'}">${titleHtml}<div data-mathbody="1">${mdBody}</div></div>`;
    }
    else{sh=`<circle cx="${n.x}" cy="${n.y}" r="${s*.75}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s*.75+4}"/>`}
    }
    const lbl=(n.label||'').length>26?n.label.slice(0,24)+'…':(n.label||'');
    const portal=n.childCanvas?`<text x="${n.x+s-6}" y="${n.y-s*.45}" font-size="14" fill="var(--accent)">↗</text>`:'';
    const linkGlyph=n.url?`<text x="${n.x}" y="${n.y+4}" font-size="13" text-anchor="middle" fill="rgba(26,24,21,.85)" font-weight="700">🔗</text>`:'';
    const conf=n.confidence?`<rect x="${n.x-s*.8}" y="${n.y+s+22}" width="${s*1.6*(n.confidence/5)}" height="3" fill="${n.confidence>=4?SC.done:n.confidence>=2?SC.pend:SC.blocked}" rx="1"/>`:'';
    const hitR=drag?.k==='edge'?s+30:s+6;
    const rtl=/[\u0590-\u05FF]/.test(n.label||'');
    const isCompactFormula=n.shape==='formula'&&n.compact;
    /* Phase 5b · semantic zoom — below this scale threshold, notes and
       formulas swap their rich body content for just the label text so
       the zoomed-out canvas stays legible instead of showing illegible
       tiny text blobs. */
    const semanticCompact=view.k<0.45&&['formula','note'].includes(n.shape)&&!isCompactFormula;
    if(semanticCompact)richContent='';
    const showLabel=simpleMode?view.k>0.28:(view.k>0.28&&(!['formula','note'].includes(n.shape)||isCompactFormula||semanticCompact));
    const isBigShape=!simpleMode&&((n.shape==='formula'&&!n.compact)||n.shape==='note');
    const hitRect=isBigShape?`<rect class="th" x="${n.x-(n._w||100)}" y="${n.y-(n._h||60)}" width="${(n._w||100)*2}" height="${(n._h||60)*2}" rx="6" fill="transparent"/>`:`<circle class="th" cx="${n.x}" cy="${n.y}" r="${hitR}"/>`;
    // Outer SVG: just an invisible hit target wrapped in <g.node data-id> so
    // the existing closest('.node') event delegation keeps routing drags.
    h+=`<g class="node${se?' sel':''}" data-id="${n.id}">${hitRect}</g>`;
    // Overlay: per-node slice at world (n.x, n.y) containing the visible
    // shape, ring, glyphs, SVG text label, plus rich HTML content. The inner
    // <g transform="translate(-n.x,-n.y)"> pulls world-coord shape markup
    // back to the slice's local origin so shape-gen code stays unchanged.
    const dimCls=(n.dim||focusDim)?' dim':'';
    const tgtCls=tg?' tgt':'';
    const selCls=se?' sel':'';
    const svgLabel=showLabel?`<text x="${n.x}" y="${n.y+s+16}" direction="${rtl?'rtl':'ltr'}">${esc(lbl)}</text>`:'';
    const glyphs=(['resource','library'].includes(n.shape)?linkGlyph:'')+portal+conf+svgLabel;
    /* Sprint 4.1 · overlay level-of-detail. The visible shapes normally live in
       the DOM overlay — one .nslice per node, i.e. one iOS compositor layer per
       node. On a dense canvas at <0.5× zoom ~100 of those sit on-screen at once:
       the layer explosion iOS Safari can't batch. When --cull-v1 is ON and we're
       below 0.5×, draw the shape straight into the single #cv SVG layer (world
       coords, no per-node layer) and emit NO overlay slice. richContent is
       already '' here via semanticCompact, so nothing legible is lost; the
       invisible g.node hit target above still routes taps. At ≥0.5× the overlay
       path is byte-for-byte unchanged. */
    if(cullOn&&view.k<OVERLAY_MIN_K){
      h+=`<g class="node-lod${dimCls}" data-id="${n.id}">${ring}${sh}${glyphs}</g>`;
    } else {
      oh+=`<div class="nslice${dimCls}${tgtCls}${selCls}" data-nid="${n.id}" style="left:${n.x}px;top:${n.y}px">`
        +`<svg class="nshape" width="1" height="1" style="overflow:visible">`
        +`<g transform="translate(${-n.x},${-n.y})">${ring}${sh}${glyphs}</g>`
        +`</svg>${richContent}</div>`;
    }
  }
  cv.innerHTML=h;
  // D3 · Phase 1.6 — sync the HTML overlay with the SVG's viewBox transform,
  // then paint its content. The transform maps world coords (the same ones
  // the SVG node loop used above) to the screen via the same math:
  // screen = (W/2 + (wx + view.x) * view.k, H/2 + (wy + view.y) * view.k).
  // Children use plain `left:${wx}px; top:${wy}px` and ride this transform.
  const ov=document.getElementById('canvasOverlay');
  if(ov){
    ov.style.transform=`translate(${W/2}px,${H/2}px) scale(${view.k}) translate(${view.x}px,${view.y}px)`;
    ov.innerHTML=oh;
  }
  // Render KaTeX in formula nodes — now targets overlay (.fnode moved off
  // of <foreignObject> to survive iOS WebKit paint).
  let _katexCount=0;
  if(window.katex&&ov){ov.querySelectorAll('.fnode[data-latex]').forEach(el=>{const tex=el.dataset.latex;try{katex.render(tex,el,{throwOnError:false,displayMode:true,strict:'ignore'});_katexCount++}catch(e){el.textContent=tex}})}
  // Render inline math inside note bodies via KaTeX auto-render.
  // D5 · Phase 1.6 — note bodies now live in the overlay (per-node slices),
  // so this scans `ov` instead of `cv`. The mdProcess output wraps in
  // <div data-mathbody> and auto-render walks that subtree for $…$ / $$…$$.
  let _autoCount=0;
  if(window.renderMathInElement&&ov){ov.querySelectorAll('.note-body [data-mathbody]').forEach(el=>{try{renderMathInElement(el,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false}],throwOnError:false,strict:'ignore',output:'html'});_autoCount++}catch(e){}})}
  // Phase 1.5 diagnostics — post-render DOM read. Only emit when the render
  // preamble also emitted (gated by the same _shouldLog flag) so we stay in
  // sync with pan/drag throttling above. The overlay-paint section was
  // added in Phase 1.6 so Azamat can confirm on real iPad "N formula
  // overlay divs mounted for N formula nodes" even when paint is blank.
  if(_shouldLog&&window.dbg){
    const katexEls=(ov||cv).querySelectorAll('.katex').length;
    // D5 · Phase 1.6 — note-body Markdown/heading reads now target `ov`.
    const strongEls=ov?ov.querySelectorAll('.note-body strong').length:0;
    const emEls=ov?ov.querySelectorAll('.note-body em').length:0;
    const headingEls=ov?ov.querySelectorAll('.note-body h1,.note-body h2,.note-body h3').length:0;
    const ovFormulaDivs=ov?ov.querySelectorAll('.fnode[data-latex]').length:0;
    const ovLabelDivs=ov?ov.querySelectorAll('.fnode-label').length:0;
    const ovNoteDivs=ov?ov.querySelectorAll('.note-body').length:0;
    const ovSlices=ov?ov.querySelectorAll('.nslice').length:0;
    window.dbg('KATEX','post · katex.render()='+_katexCount+' · renderMathInElement()='+_autoCount+' · .katex DOM='+katexEls);
    window.dbg('MD','post · mdProcess calls this render='+(window._mdCallsThisRender||0)+' · <strong>='+strongEls+' · <em>='+emEls+' · headings='+headingEls);
    window.dbg('SYS','overlay paint-check · slices='+ovSlices+' · fnode='+ovFormulaDivs+' · fnode-label='+ovLabelDivs+' · note-body='+ovNoteDivs+(ov?' · transform='+ov.style.transform.slice(0,60):' · #canvasOverlay MISSING'));
  }
  window._mdCallsThisRender=0;
  // Phase 5 P2 · empty-state overlay — show when canvas is truly empty
  const _es=document.getElementById('emptyState');
  if(_es){const empty=ns().length===0&&zs().length===0;_es.classList.toggle('on',empty)}
  /* Phase 2 (Pass 3 § 08) · reposition the DOM zone chip layer after every
     render(). The chip layer is scale-invariant (DOM, not SVG) so its
     positions need recomputing each frame from the world coords. */
  if (window.Flags && window.Flags.on('zones-v2') && window.ZonesV2) {
    try { window.ZonesV2.reposition(zs(), view); } catch (e) {}
  }
  /* Sprint 4.1 Issue 1 · feed the perf HUD's rendered / visible / culled lines.
     Computed only when the HUD asked for it (window.__RENDER_STATS_ON, set on
     HUD install) so the normal path pays nothing. "rendered" = elements truly
     in the DOM right now (the actual cost). "visible" = elements whose bbox
     intersects the UN-inflated screen rect (what the user can see). The gap
     between them is the bug the brief wants legible without a console. */
  if(window.__RENDER_STATS_ON){
    try{
      const _rN=cv.querySelectorAll('g.node').length;
      const _rE=cv.querySelectorAll('path.e2,path.edge').length;
      const _rO=ov?ov.querySelectorAll('.nslice').length:0;
      const _vx1=-W/2/view.k-view.x,_vy1=-H/2/view.k-view.y,_vx2=_vx1+W/view.k,_vy2=_vy1+H/view.k;
      const _byId=new Map();for(const n of ns())_byId.set(n.id,n);
      const _vN=new Set();
      for(const n of ns()){const hw=(n._w||n.userW||80),hh=(n._h||n.userH||80);if(n.x+hw>=_vx1&&n.x-hw<=_vx2&&n.y+hh>=_vy1&&n.y-hh<=_vy2)_vN.add(n.id)}
      let _vE=0;
      for(const e of es()){const a=_byId.get(e.from),b=_byId.get(e.to);if(!a||!b)continue;let _in=_vN.has(e.from)||_vN.has(e.to);if(!_in){const mnx=Math.min(a.x,b.x),mxx=Math.max(a.x,b.x),mny=Math.min(a.y,b.y),mxy=Math.max(a.y,b.y);_in=mxx>=_vx1&&mnx<=_vx2&&mxy>=_vy1&&mny<=_vy2}if(_in)_vE++}
      const _vO=view.k>=OVERLAY_MIN_K?_vN.size:0;
      window.__renderStats={
        rendered:{nodes:_rN,edges:_rE,overlays:_rO},
        visible:{nodes:_vN.size,edges:_vE,overlays:_vO},
        culled:cullOn?('ON (margin: '+(window.CullV1?window.CullV1.MARGIN_VIEWPORTS.toFixed(1):'1.0')+'vw)'):'OFF'
      };
    }catch(e){}
  }
  /* Sprint 4.5 · the viewBox + overlay transform now encode the CURRENT view, so
     the per-frame CSS delta (applyView) resets to identity and the frozen base
     becomes this view. Any subsequent pan/zoom transforms relative to here until
     the next render (data change or gesture settle). */
  window.__panBase={x:view.x,y:view.y,k:view.k};
  cv.style.transform='';
}
/* Sprint 4.5 · applyView — the per-frame pan/zoom path. Moves every canvas layer
   as ONE coordinate space WITHOUT rebuilding the DOM. Called from
   CanvasTransform.commit() on each pan/pinch/inertia frame; render() is NOT
   called during motion (only on data changes + once on settle).
     · #cv (nodes, edges, edge-labels, zone-rects): a CSS delta transform from
       the frozen viewBox base (__panBase, set by the last render), transform-
       origin 0 0 so it scales about the SAME point as the overlay — this is the
       fix for the pinch "edges drift as a separate image" desync that bare
       --static-pan showed.
     · #canvasOverlay (node bodies + labels): the absolute view transform,
       origin 0 0 — identical mapping to #cv's effective transform, locked together.
     · #zoneChips (zone labels): positioned in screen space, so ZonesV2.reposition
       recomputes them each frame (cheap world→screen math, no geometry read) —
       this is the fix for "labels stuck in place".
     · #tiles (grid + zone fills): TileCache.sync() re-applies its CSS transform
       (normally driven by the render() wrap, which no longer fires during motion). */
function applyView(){
  const W=Math.max(innerWidth||document.documentElement.clientWidth||800,400),H=Math.max(innerHeight||document.documentElement.clientHeight||600,400);
  const base=window.__panBase||{x:view.x,y:view.y,k:view.k};
  const s=view.k/base.k;
  const tx=W/2*(1-s)+(view.x-base.x)*view.k,ty=H/2*(1-s)+(view.y-base.y)*view.k;
  cv.style.transformOrigin='0 0';
  cv.style.transform=`translate3d(${tx}px,${ty}px,0) scale(${s})`;
  const _abs=`translate(${W/2}px,${H/2}px) scale(${view.k}) translate(${view.x}px,${view.y}px)`;
  const _ov=document.getElementById('canvasOverlay');
  if(_ov)_ov.style.transform=_abs;
  if(window.Flags&&window.Flags.on('zones-v2')&&window.ZonesV2){try{window.ZonesV2.reposition(zs(),view)}catch(e){}}
  if(window.TileCache&&typeof window.TileCache.sync==='function'){try{window.TileCache.sync()}catch(e){}}
}
window.applyView=applyView;
function bF(){const fl=document.getElementById('fl');if(!fl)return;const mode=S.filterMode||'zone';const otherMode=mode==='zone'?'status':'zone';const switchLabel=S.hebrewMode?(mode==='zone'?'אזורים ⇄ מצב':'מצב ⇄ אזורים'):(mode==='zone'?'Zones ⇄ Status':'Status ⇄ Zones');
  /* Phase 5b · filter bar starts collapsed. Toggle button expands/collapses. */
  let h=`<span class="pill fl-toggle" onclick="document.getElementById('fl').classList.toggle('collapsed')" title="Toggle filter pills">⚡</span>`;
  h+=`<span class="pill mode" onclick="switchFilterMode()" style="background:var(--accent);color:#0F0F0F;font-weight:600;cursor:pointer">${switchLabel}</span>`;if(mode==='zone'){zs().forEach(z=>h+=`<span class="pill on" data-f="zone:${z.id}" onclick="tF(this)" ondblclick="soloF(this)">${esc(z.name)}</span>`)}else{ST.forEach(s=>h+=`<span class="pill on" data-f="status:${s}" onclick="tF(this)" ondblclick="soloF(this)">${esc(t(s))}</span>`)}fl.innerHTML=h;if(!fl.dataset.init){fl.classList.add('collapsed');fl.dataset.init='1'}}
function switchFilterMode(){S.filterMode=S.filterMode==='status'?'zone':'status';sv();bF();aF()}
function renderLegend(){const lg=document.getElementById('lgBody');if(!lg)return;lg.innerHTML=`<h4>${t('shapes')}</h4><div class="row">★ ${t('project')} ● ${t('idea')} ◆ ${t('principle')}</div><div class="row">⬣ ${t('resource')} ? ${t('question')} ⚗ ${t('experiment')} ▭ ${t('library')} ▤ ${t('doc')}</div><h4>${t('status')}</h4><div class="row"><span class="sw" style="background:var(--done)"></span>${t('done')}</div><div class="row"><span class="sw" style="background:var(--prog)"></span>${t('progress')}</div><div class="row"><span class="sw" style="background:var(--pend)"></span>${t('pending')}</div><div class="row"><span class="sw" style="background:var(--block)"></span>${t('blocked')}</div><div class="row"><span class="sw" style="background:var(--idea)"></span>${t('idea')}</div><h4>${t('edges')}</h4><div class="row" style="color:var(--block)">━ ${t('blocker')}</div><div class="row" style="color:var(--muted)">━ ${t('feeds')}</div><div class="row" style="color:var(--prog)">━ ${t('related')}</div><div class="row" style="color:var(--done)">━ ${t('derived')}</div><div class="row" style="color:var(--text2)">━ ${t('arrow')}</div>`}
function tF(el){el.classList.toggle('on');aF()}
function soloF(el){const all=document.querySelectorAll('#fl .pill');const wasOff=!el.classList.contains('on');const onlyMeOn=el.classList.contains('on')&&[...all].every(p=>p===el||!p.classList.contains('on'));if(onlyMeOn){all.forEach(p=>p.classList.add('on'))}else{all.forEach(p=>p.classList.remove('on'));el.classList.add('on')}aF()}
function aF(){const zonePresent=document.querySelector('#fl .pill[data-f^="zone:"]')!==null;const statusPresent=document.querySelector('#fl .pill[data-f^="status:"]')!==null;const a=new Set([...document.querySelectorAll('.pill.on')].map(p=>p.dataset.f));const q=document.getElementById('sr').value.toLowerCase();ns().forEach(n=>{const zOk=!zonePresent||a.has('zone:'+n.zone);const sOk=!statusPresent||a.has('status:'+n.status);const qOk=!q||((n.label||'')+(n.notes||'')+(n.tags||'')+(n.rationale||'')).toLowerCase().includes(q);n.dim=!(zOk&&sOk&&qOk)});const k=new Set(ns().filter(n=>!n.dim).map(n=>n.id));es().forEach(e=>e.dim=!(k.has(e.from)&&k.has(e.to)));render()}
function addNode(x,y,d={},skip){if(!skip)sn();const id=S.nextId++;
  /* Phase 5b · clamp userW/userH to sensible bounds so malformed patches
     don't blow up the canvas with giant or microscopic nodes. */
  if(d.userW!=null)d.userW=Math.max(60,Math.min(800,+d.userW||100));
  if(d.userH!=null)d.userH=Math.max(30,Math.min(600,+d.userH||60));
  if(d._w!=null)d._w=Math.max(60,Math.min(800,+d._w||100));
  if(d._h!=null)d._h=Math.max(30,Math.min(600,+d._h||60));
  const n={label:'New',notes:'',tags:'',rationale:'',shape:'idea',status:'idea',url:'',docUrl:'',originId:null,childCanvas:null,confidence:null,latex:'',color:null,compact:false,...d,id,x,y,zone:d.zone||zoneAt(x,y),created:d.created||new Date().toISOString().slice(0,10)};ns().push(n);sv();render();renderSB();return n}
/* Phase 5 P2 · smart placement: spiral outward from (cx,cy) until a spot has
   no other node within SPACING px. 8 directions per ring, max 20 rings. */
function findFreeSpot(cx,cy){const SP=120;for(let ring=0;ring<20;ring++){const steps=ring===0?1:ring*8;for(let i=0;i<steps;i++){const a=(2*Math.PI*i)/steps;const px=cx+Math.cos(a)*SP*ring;const py=cy+Math.sin(a)*SP*ring;if(!ns().some(n=>Math.abs(n.x-px)<SP&&Math.abs(n.y-py)<SP))return{x:px,y:py};};}return{x:cx+SP*20,y:cy}}
function addC(){/* Phase 5b — use SVG bounding rect for true visual center (iPad PWA
  viewport-fit:cover makes innerWidth/Height include safe-area insets) */
  const r=cv.getBoundingClientRect();const cx=r.left+r.width/2,cy=r.top+r.height/2;
  const w=s2w(cx,cy);const p=findFreeSpot(w.x,w.y);const n=addNode(p.x,p.y);sel=n;op(n)}
function delN(id){sn();C().nodes=ns().filter(n=>n.id!==id);C().edges=es().filter(e=>e.from!==id&&e.to!==id);if(sel?.id===id)cp();sv();render();renderSB()}
function delE(id){sn();C().edges=es().filter(e=>e.id!==id);sv();render()}
/* Sprint 3.4 Issue 7 — clr() now also clears zones. Empty rectangles
   left behind after "Clear canvas" were visual debris. Single undo
   restores nodes + edges + zones together. */
function clr(){C().nodes=[];C().edges=[];C().zones=[];cp();sv();render()}

/* Sprint 3.4 Issue 8 — clear canvas with optional cascade-delete of
   linked child canvases. Replaces clearCanvasConfirm in the new Tools
   panel flow (the old one stays for backward-compat). */
/* Sprint 3.6 Issue 3 — walks BOTH parent-child relationships:
     (a) portal-node `childCanvas` references inside the parent canvas
         (the createRoadmap flow sets this)
     (b) `canvasMeta[childId].parentCanvas === parentId` lookups
         (the import flow often sets ONLY this, leaving (a) empty)
   Without (b), canvases imported from JSON would be invisible to the
   delete-cascade modal's child-count, AND the post-delete re-parent
   loop would silently leave them orphaned. */
function gatherDescendantCanvasIds(rootCanvasId){
  const out=new Set();
  const stack=[rootCanvasId];
  const seen=new Set();
  while(stack.length){
    const cid=stack.pop();
    if(seen.has(cid))continue;
    seen.add(cid);
    const c=S.canvases[cid];
    if(c){
      // Path (a): portal nodes inside this canvas.
      for(const n of (c.nodes||[])){
        if(n.childCanvas && S.canvases[n.childCanvas] && n.childCanvas!==rootCanvasId && !out.has(n.childCanvas)){
          out.add(n.childCanvas);
          stack.push(n.childCanvas);
        }
      }
    }
    // Path (b): canvasMeta.parentCanvas references.
    if(S.canvasMeta){
      for(const otherCid of Object.keys(S.canvasMeta)){
        if(otherCid===rootCanvasId || out.has(otherCid)) continue;
        if(S.canvasMeta[otherCid]?.parentCanvas === cid){
          out.add(otherCid);
          stack.push(otherCid);
        }
      }
    }
  }
  return out;
}
async function clearCanvasWithCascade(){
  const cid=S.current;
  const c=S.canvases[cid];
  if(!c)return;
  const portals=(c.nodes||[]).filter(n=>n.childCanvas&&S.canvases[n.childCanvas]);
  const descendants=gatherDescendantCanvasIds(cid);
  const totalDescNodes=Array.from(descendants).reduce((sum,d)=>sum+((S.canvases[d]?.nodes?.length)||0),0);
  const nNodes=(c.nodes||[]).length;
  const nZones=(c.zones||[]).length;
  const cname=esc(S.canvasMeta?.[cid]?.name||cid);
  /* If no portal nodes → no modal needed, just clear. */
  if(portals.length===0){
    if(!await uiConfirm('Clear "'+cname+'"?\nThis removes '+nNodes+' nodes and '+nZones+' zones.',{title:'Clear canvas',danger:true,okLabel:'Clear'}))return;
    sn();clr();return;
  }
  /* Build the cascade modal body. */
  const portalNames=portals.map(p=>S.canvasMeta?.[p.childCanvas]?.name||p.childCanvas).slice(0,6);
  const portalList=portalNames.map(n=>'<code>'+esc(n)+'</code>').join(', ')+(portals.length>portalNames.length?' (+'+(portals.length-portalNames.length)+' more)':'');
  const body=
    '<div style="font-family:var(--font-sans,Inter);color:var(--ink,#F0EBE5)">'+
      '<h3 style="margin:0 0 12px;font-size:16px">Clear "'+cname+'"?</h3>'+
      '<p style="margin:0 0 12px;color:var(--ink-2,#C8C5BE);font-size:13px">This will remove <b>'+nNodes+' nodes</b> and <b>'+nZones+' zones</b>.</p>'+
      '<p style="margin:0 0 12px;color:var(--ink-2,#C8C5BE);font-size:13px"><b>'+portals.length+' of these nodes link to child canvases</b> ('+portalList+') containing <b>'+totalDescNodes+' nodes total</b>.</p>'+
      '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line-2,#2A2F3A);border-radius:8px;cursor:pointer;margin:12px 0">'+
        '<input type="checkbox" id="__clrCascade" style="width:18px;height:18px"/>'+
        '<span style="font-size:13px;color:var(--ink,#F0EBE5)">Also delete linked child canvases and everything under them</span>'+
      '</label>'+
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">'+
        '<button id="__clrCancel" style="padding:8px 16px;background:transparent;color:var(--ink-2,#C8C5BE);border:1px solid var(--line-2,#2A2F3A);border-radius:6px;cursor:pointer">Cancel</button>'+
        '<button id="__clrOk" style="padding:8px 16px;background:var(--st-blocked,#F87171);color:#0F0F0F;border:none;border-radius:6px;cursor:pointer;font-weight:600">Clear canvas</button>'+
      '</div>'+
    '</div>';
  const m=document.getElementById('modal');const mb=document.getElementById('mcbody');
  if(!m||!mb)return;
  mb.innerHTML=body;
  m.classList.add('on');
  return new Promise(resolve=>{
    document.getElementById('__clrCancel').onclick=()=>{m.classList.remove('on');resolve(false)};
    document.getElementById('__clrOk').onclick=()=>{
      const cascade=document.getElementById('__clrCascade')?.checked;
      m.classList.remove('on');
      sn();
      if(cascade){
        for(const did of descendants){
          delete S.canvases[did];
          if(S.canvasMeta)delete S.canvasMeta[did];
        }
      }
      /* Either way: also null out childCanvas refs on portal nodes that
         are about to be deleted (the nodes themselves disappear in clr(),
         but the descendants if NOT cascaded retain their entries in
         S.canvases — they're now reachable only via the workspace root
         because their parentNodeId is gone). */
      if(!cascade){
        for(const p of portals){
          if(S.canvases[p.childCanvas]&&S.canvasMeta?.[p.childCanvas]){
            S.canvasMeta[p.childCanvas].parentNodeId=null;
            S.canvasMeta[p.childCanvas].parentCanvas=null;
          }
        }
      }
      clr();
      if(typeof renderTabs==='function')renderTabs();
      resolve(true);
    };
  });
}
window.clearCanvasWithCascade=clearCanvasWithCascade;
function dd(){sn();const sx=new Set();C().nodes=ns().filter(n=>{const k=(n.label||'').trim().toLowerCase();if(!k||sx.has(k))return false;sx.add(k);return true});const ids=new Set(ns().map(n=>n.id));C().edges=es().filter(e=>ids.has(e.from)&&ids.has(e.to));sv();render()}
function fromU(){const u=document.getElementById('urlIn').value.trim();if(!u)return;let lbl=u;const z=(zs().find(x=>x.id==='inbox')||zs()[zs().length-1]).id;try{const p=new URL(u),seg=p.pathname.split('/').filter(Boolean);lbl=(seg[seg.length-1]||p.hostname).replace(/[-_]/g,' ').slice(0,40)}catch(e){}const w=s2w(innerWidth/2,innerHeight/2);const n=addNode(w.x,w.y,{label:lbl,url:u,shape:'resource',zone:z});document.getElementById('urlIn').value='';sel=n;op(n)}
/* Phase 5 P1 #2 — live preview + autosave for the property panel.
   Typed input (label, notes, rationale, url, docUrl, tags, confidence,
   latex) debounces at AUTOSAVE_MS, re-rendering the canvas on each
   keystroke (live preview) and persisting at the tail. Selects and
   checkboxes commit immediately. One undo-snapshot per panel session
   so Ctrl+Z walks back to the state before the panel opened, not
   one keystroke at a time. */
const AUTOSAVE_MS=200;
let autosaveTimer=null,autosaveSnapped=false;
/* Phase 5 P1 #3 — progressive disclosure for the property panel.
   Primary fields (label, body, shape, status, zone) stay always visible;
   secondary fields (rationale, url, tags, confidence, color, compact)
   tuck behind a "More details" <details> summary. `panelDetailsOpen`
   persists the open/closed choice across in-session rebuilds (shape
   change, save-patch, node switch) so an advanced edit session keeps
   its state. cp() resets to false so the next fresh-open panel starts
   minimal again. */
let panelDetailsOpen=false;
function aSnap(){if(!autosaveSnapped){sn();autosaveSnapped=true}}
function aFlush(){if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null;if(sel)sv()}}
/* Phase 5 P2 — expandable description. Auto-grow a textarea to fit its
   content up to 50% of viewport height, then lock and scroll inside.
   Called on input + after op() rebuilds so existing content opens at
   the right height instead of the CSS min-height (64px). No-ops for
   non-textarea nodes so the querySelectorAll loop in op() is safe. */
function aGrow(el){
  if(!el||el.tagName!=='TEXTAREA')return;
  const cap=Math.round(innerHeight*0.5);
  el.style.height='auto';
  const need=el.scrollHeight;
  el.style.height=Math.min(need,cap)+'px';
  el.style.overflowY=need>cap?'auto':'hidden';
}
/* Phase 5 P2 — expand textarea into the modal for roomy writing. Reuses
   the existing #modal backdrop so Esc/outside-tap close still works.
   Typing in the expanded view calls aField() the same way the panel
   textarea does — the node mutates in place. On close we sync the
   panel's textarea value + re-grow so focus/scroll don't jump. */
function expandField(fieldId,nodeKey,labelText){
  if(!sel)return;
  const cur=sel[nodeKey]||'';
  modal.classList.add('on');
  document.getElementById('mcbody').innerHTML=`<h3>${esc(labelText)}</h3>
    <textarea id="ef_body" dir="auto" style="width:100%;min-height:60vh;font-family:var(--serif);font-size:15px;line-height:1.55;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text);resize:none">${esc(cur)}</textarea>
    <div class="brow"><button class="pr" onclick="closeExpanded('${fieldId}','${nodeKey}')">${S.hebrewMode?'סיום':'Done'}</button></div>`;
  const ta=document.getElementById('ef_body');
  ta.focus();
  // Place caret at end so keyboard users can continue typing.
  try{ta.setSelectionRange(ta.value.length,ta.value.length)}catch(e){}
  ta.addEventListener('input',()=>{aField(x=>x[nodeKey]=ta.value)});
}
function closeExpanded(fieldId,nodeKey){
  aFlush();
  closeModal();
  // Re-sync the panel textarea from the mutated sel state + re-grow.
  const panelTa=document.getElementById(fieldId);
  if(panelTa&&sel){panelTa.value=sel[nodeKey]||'';aGrow(panelTa)}
}
function aField(applyFn,immediate){
  if(!sel)return;
  aSnap();
  applyFn(sel);
  render();renderSB();
  if(immediate){
    if(autosaveTimer){clearTimeout(autosaveTimer);autosaveTimer=null}
    sv();
  }else{
    if(autosaveTimer)clearTimeout(autosaveTimer);
    autosaveTimer=setTimeout(()=>{autosaveTimer=null;sv()},AUTOSAVE_MS);
  }
}
function op(n){aFlush();autosaveSnapped=false;sel=n;pn.classList.add('on');
  const isFormula=n.shape==='formula',isNote=n.shape==='note';
  const up=(!isFormula&&!isNote&&n.url)?`<a class="urp" href="${esc(n.url)}" target="_blank" rel="noopener">↗ ${esc(n.url.replace(/^https?:\/\//,'').slice(0,42))}</a>`:'';
  const docLink=(!isFormula&&!isNote&&n.docUrl)?`<a class="urp" href="${esc(n.docUrl)}" target="_blank" rel="noopener" style="margin-left:6px">📄 ${esc(n.docUrl.replace(/^https?:\/\//,'').slice(0,36))}</a>`:'';
  const originBadge=n.originId?`<div class="origin">↙ ${t('copiedFromVault')}</div>`:'';
  const portalBtn=n.shape==='project'?(n.childCanvas?`<button onclick="switchTo('${n.childCanvas}')">${esc(t('openRoadmap'))}</button>`:`<button onclick="createRoadmap(${n.id})">${esc(t('createRoadmap'))}</button>`):'';
  const copyBtn=S.current!=='vault'?`<button onclick="copyBackToVault(${n.id})">${esc(t('copyToVault'))}</button>`:'';
  const pullBtn=S.current!=='vault'?`<button onclick="showPullPicker()">${esc(t('pullFromVault'))}</button>`:'';
  const zoneName=zs().find(z=>z.id===n.zone)?.name||n.zone;
  const formulaPreview=isFormula?`<div id="latexPreview" style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:16px;margin:8px 0;text-align:center;min-height:48px"></div>`:'';
  const compactToggle=isFormula?`<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="f_compact" type="checkbox" ${n.compact?'checked':''} onchange="aField(x=>x.compact=this.checked,true);op(sel)"/>${S.hebrewMode?'תצוגה מצומצמת (כצומת רגיל)':'Compact view (as regular node)'}</label>`:'';
  const colorPicker=(isNote||isFormula)?`<label>${S.hebrewMode?'צבע':'Color'}</label><div style="display:flex;gap:8px;align-items:center"><input id="f_color" type="color" value="${n.color||(isNote?'#d4a855':'#181A1B')}" style="width:48px;height:32px;background:transparent;border:1px solid var(--border);border-radius:8px;cursor:pointer" oninput="aField(x=>x.color=this.value||null)"/><button onclick="document.getElementById('f_color').value='';aField(x=>x.color=null,true)" style="font-size:11px">${S.hebrewMode?'איפוס':'Reset'}</button></div>`:'';
  const urlFields=(!isFormula&&!isNote)?`<label>${t('url')}</label><input id="f_url" value="${esc(n.url)}" placeholder="https://…" oninput="aField(x=>x.url=this.value)"/>
    <label>${t('docUrl')}</label><input id="f_docUrl" value="${esc(n.docUrl||'')}" placeholder="Google Drive / Notion / Dropbox…" oninput="aField(x=>x.docUrl=this.value)"/>`:'';
  const latexField=isFormula?`<label class="flabel">${t('latex')}<button type="button" class="expandBtn" onclick="expandField('f_latex','latex','${esc(t('latex'))}')" title="Expand" aria-label="Expand">⇱</button></label><textarea id="f_latex" oninput="aField(x=>x.latex=this.value);aGrow(this);updateLatexPreview()" style="font-family:monospace;font-size:12px">${esc(n.latex||'')}</textarea>${formulaPreview}`:'';
  const notesLbl=isNote?t('noteBody'):t('notes');
  const notesField=`<label class="flabel">${notesLbl}<button type="button" class="expandBtn" onclick="expandField('f_notes','notes','${esc(notesLbl)}')" title="Expand" aria-label="Expand">⇱</button></label><textarea id="f_notes" ${isNote?'style="min-height:140px"':''} oninput="aField(x=>x.notes=this.value);aGrow(this)">${esc(n.notes)}</textarea>`;
  /* Phase 5 P1 #3 — progressive disclosure. Primary holds the 90%-of-use
     fields (label, body, shape/status, zone); detailFields tucks the
     occasional ones (rationale, url, tags, conf, color, compact) behind
     a <details> disclosure. Open/close persists in panelDetailsOpen. */
  const primaryFields=`
    <label>${t('label')}</label><input id="f_label" value="${esc(n.label)}" oninput="aField(x=>x.label=this.value)"/>
    ${latexField}
    ${notesField}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>${t('shape')}</label><select id="f_shape" onchange="aField(x=>x.shape=this.value,true);op(sel)">${SH.map(s=>`<option value="${s}" ${s===n.shape?'selected':''}>${esc(t(s))}</option>`).join('')}</select></div>
    <div><label>${t('status')}</label><select id="f_status" onchange="aField(x=>x.status=this.value,true)">${ST.map(s=>`<option value="${s}" ${s===n.status?'selected':''}>${esc(t(s))}</option>`).join('')}</select></div></div>
    <label>${t('zoneF')}</label><select id="f_zone" onchange="aField(x=>x.zone=this.value,true)">${zs().map(z=>`<option value="${z.id}" ${z.id===n.zone?'selected':''}>${esc(z.name)}</option>`).join('')}</select>`;
  const detailFields=`
    ${isNote?'':`<label class="flabel">${t('rationale')}<button type="button" class="expandBtn" onclick="expandField('f_rationale','rationale','${esc(t('rationale'))}')" title="Expand" aria-label="Expand">⇱</button></label><textarea id="f_rationale" oninput="aField(x=>x.rationale=this.value);aGrow(this)">${esc(n.rationale)}</textarea>`}
    ${urlFields}
    <label>${t('tags')}</label><input id="f_tags" value="${esc(n.tags)}" oninput="aField(x=>x.tags=this.value)"/>
    <label>${t('confidence')}</label><input id="f_conf" type="number" min="0" max="5" step="1" value="${n.confidence||''}" oninput="aField(x=>x.confidence=this.value?parseInt(this.value):null)"/>
    ${colorPicker}
    ${compactToggle}`;
  const detailsBlock=`<details class="pn-more" ${panelDetailsOpen?'open':''} ontoggle="panelDetailsOpen=this.open"><summary>${t('moreDetails')}</summary><div class="pn-more-body">${detailFields}</div></details>`;
  pn.innerHTML=`<button class="pn-close" onclick="cp()" aria-label="Close">&times;</button><h2>${esc(n.label||t('untitled'))}</h2><div class="meta">${esc(t(n.status))} · ${esc(zoneName)} · ${t('addedOn')} ${n.created}</div>${up}${docLink}${originBadge}
    ${primaryFields}
    ${detailsBlock}
    <div class="brow"><button class="pr" onclick="sP()">${t('save')}</button><button onclick="cp()">${t('close')}</button><button class="dn" onclick="delN(${n.id})">${t('del')}</button></div>
    ${portalBtn||copyBtn||pullBtn?`<div class="brow">${portalBtn}${copyBtn}${pullBtn}</div>`:''}`;
  if(isFormula)updateLatexPreview();
  // Phase 5 P2 — auto-grow every textarea to fit existing content after
  // rebuild. Runs once per op(); subsequent typing calls aGrow(this) via
  // inline oninput so growth is continuous.
  pn.querySelectorAll('textarea').forEach(aGrow);
  render()}
function updateLatexPreview(){const el=document.getElementById('latexPreview'),src=document.getElementById('f_latex');if(!el||!src||!window.katex)return;try{katex.render(src.value||'\\\\text{(empty)}',el,{throwOnError:false,displayMode:true,strict:'ignore'})}catch(e){el.textContent='⚠ '+e.message}}
/* Phase 5 P1 #2 — with autosave wired to every field, sP() is now a
   "commit now and rebuild the panel" shortcut: flush any pending debounce
   then re-run op(n) to refresh labels/badges that only update on rebuild
   (e.g. title, url pill, zone name). Still callable from explicit Save
   button + legacy contexts. */
function sP(){if(!sel)return;aFlush();op(sel)}
function cp(){aFlush();autosaveSnapped=false;panelDetailsOpen=false;sel=null;pn.classList.remove('on');render()}
/* Phase 2.5 Issue 6 — tap-outside dismisses the property panel.
   Only "empty canvas" taps count — taps on a node, edge, zone, resize
   handle, or any floating UI surface are left alone so the existing
   click handlers in app.js can do their normal thing (toggle selection,
   open ctx menu, etc.). A tap is defined as pointerdown→pointerup with
   < 10 px of movement; anything beyond that is a pan or node drag and
   must not dismiss the panel. */
(function(){
  const DISMISS_THRESHOLD_PX = 10;
  let downX = 0, downY = 0, downActive = false;
  function isFloatingUi(t){
    return !!(t && t.closest && t.closest('#pn,#more,#ctx,#ep,#dlg,#modal,#landing,#sb,#tb,#bc,#tabs,#lg,#lgBtn,#zoneChips,#edgeLegend,#edgeControls,#perfHud,#emptyState,#fl,#spine,#drawer,#topbar,#viewTabs,#palette,#viewStage'));
  }
  function isInteractiveCanvasTarget(t){
    if (!t || !t.closest) return false;
    /* Phase 2.9 Fix 3 — taps inside a zone (not on a node) must dismiss
       the property panel like an empty-canvas tap. Removed `.zd` (zone
       fill drag-handle) and `.zone` from the bail list so the dismiss-
       tracking arms. Zone DRAG still works because the existing app.js
       pointer handlers also fire on the same event; if the user moves
       > 10px before pointerup, our dismiss listener bails on motion and
       app.js's beginInteraction → drag={k:'zone',...} runs normally.
       What stays in the list:
         .node / g.node / .nslice  — node tap selects/toggles the node
         .nrz                       — node resize handle
         .zh                        — zone resize handle
         .edge / [data-edge]        — edge interaction (custom edge ctx menu) */
    return !!(t.closest('.node, g.node, .nslice, .nrz, .zh, .edge, [data-edge]'));
  }
  document.addEventListener('pointerdown', e => {
    if (!pn.classList.contains('on')) { downActive = false; return; }
    if (isFloatingUi(e.target))       { downActive = false; return; }
    if (isInteractiveCanvasTarget(e.target)) { downActive = false; return; }
    downActive = true; downX = e.clientX; downY = e.clientY;
  }, true);
  document.addEventListener('pointerup', e => {
    if (!downActive) return;
    downActive = false;
    if (!pn.classList.contains('on')) return;
    const dx = Math.abs(e.clientX - downX), dy = Math.abs(e.clientY - downY);
    if (dx > DISMISS_THRESHOLD_PX || dy > DISMISS_THRESHOLD_PX) return; // pan/drag — don't dismiss
    cp();
  }, true);
})();
function createRoadmap(nid){const n=ns().find(x=>x.id===nid);if(!n)return;const cid='rm-'+nid;if(S.canvases[cid])return switchTo(cid);sn();S.canvases[cid]={nodes:[],edges:[],zones:JSON.parse(JSON.stringify(RMZ))};S.canvasMeta[cid]={name:n.label+' › Roadmap',parentNodeId:n.id,parentCanvas:S.current};n.childCanvas=cid;sv();switchTo(cid)}
function copyBackToVault(nid){const n=ns().find(x=>x.id===nid);if(!n)return;sn();const fromCanvas=S.current;S.current='vault';const w=s2w(innerWidth/2,innerHeight/2);addNode(w.x,w.y,{...n,id:undefined,originId:n.id,childCanvas:null},true);S.current=fromCanvas;sv();uiNotice('Copied to vault.')}
function copyToCanvas(nid,cid){const vn=S.canvases.vault.nodes.find(x=>x.id===nid);if(!vn)return;sn();const prev=S.current;S.current=cid;const z=zs()[0];const x=z.x+60+Math.random()*(z.w-140),y=z.y+70+Math.random()*(z.h-140);addNode(x,y,{...vn,id:undefined,originId:vn.id,zone:z.id,childCanvas:null},true);S.current=prev;sv();render()}
function showPullPicker(){const cid=S.current;const items=S.canvases.vault.nodes;modal.classList.add('on');document.getElementById('mcbody').innerHTML=`<h3>Pull from vault</h3><p>Pick a node to copy into this roadmap</p><input id="pq" placeholder="Filter…" oninput="renderPull('${cid}')" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);margin-bottom:12px"/><div class="plist" id="pl"></div><div class="brow"><button onclick="closeModal()">Close</button></div>`;renderPull(cid)}
function renderPull(cid){const q=(document.getElementById('pq')?.value||'').toLowerCase();const items=S.canvases.vault.nodes.filter(n=>!q||(n.label||'').toLowerCase().includes(q));document.getElementById('pl').innerHTML=items.map(n=>`<div class="pitem" onclick="copyToCanvas(${n.id},'${cid}');closeModal()"><b>${esc(n.label)}</b><span style="color:var(--muted);font-size:11px"> · ${S.canvases.vault.zones.find(z=>z.id===n.zone)?.name||''}</span></div>`).join('')||'<div style="color:var(--muted);font-size:12px">No matches</div>'}
function closeModal(){modal.classList.remove('on')}
function showPatch(){modal.classList.add('on');document.getElementById('mcbody').innerHTML=`<h3>Paste patch</h3><p>Paste JSON from Claude: <code style="background:var(--bg2);padding:2px 4px;border-radius:4px">{"canvasId":"vault","nodes":[...],"edges":[...]}</code>. Nodes need label; other fields optional. Edges use label references (from/to = label) or IDs.</p><textarea id="pt" placeholder='{"canvasId":"vault","nodes":[{"label":"Example","zone":"inbox","shape":"idea","status":"idea","rationale":"why it is here"}],"edges":[]}'></textarea><div class="brow"><button class="pr" onclick="applyPatch()">Apply</button><button onclick="closeModal()">Cancel</button></div>`}
/* Phase 5 P2 — paste-patch size sanity.
   Pathologically large pastes freeze the main thread during JSON.parse
   and the render storm that follows. Guard with a two-tier check:
   bytes first (cheap, before parse), then node count (after parse).
   Thresholds chosen so a typical 5–50-node Claude patch waves through
   without friction; a 500KB+ paste asks to confirm; a 10MB+ paste is
   refused outright. Same shape for node counts: 200 warn / 2000 reject. */
const PATCH_MAX_BYTES=10*1024*1024, PATCH_WARN_BYTES=500*1024;
const PATCH_MAX_NODES=2000, PATCH_WARN_NODES=200;
// Non-module script: `const` at top level is NOT on window, so tests need
// these attached explicitly. Harmless exposure — purely numeric thresholds.
Object.assign(window,{PATCH_MAX_BYTES,PATCH_WARN_BYTES,PATCH_MAX_NODES,PATCH_WARN_NODES});
function patchNodeCount(raw){
  if(raw?.patches&&Array.isArray(raw.patches))return raw.patches.reduce((s,p)=>s+(p?.nodes?.length||0),0);
  return raw?.nodes?.length||0;
}
async function applyPatch(){
  const ta=document.getElementById('pt');const text=ta?.value||'';
  if(text.length>PATCH_MAX_BYTES){await uiNotice(`Patch is ${(text.length/1024/1024).toFixed(1)}MB. Limit is ${(PATCH_MAX_BYTES/1024/1024).toFixed(0)}MB — split it into smaller patches or use Import full state.`,{title:'Patch too large'});return}
  if(text.length>PATCH_WARN_BYTES){const ok=await uiConfirm(`This patch is ${(text.length/1024).toFixed(0)}KB. Very large patches can hang the UI for several seconds while parsing and rendering. Continue?`,{title:'Large patch',okLabel:'Apply anyway'});if(!ok)return}
  let raw;try{raw=JSON.parse(text)}catch(err){await uiNotice('Parse error: '+err.message,{title:'Patch failed'});return}
  const nodeTotal=patchNodeCount(raw);
  if(nodeTotal>PATCH_MAX_NODES){await uiNotice(`Patch would add ${nodeTotal} nodes. Limit is ${PATCH_MAX_NODES}.`,{title:'Too many nodes'});return}
  if(nodeTotal>PATCH_WARN_NODES){const ok=await uiConfirm(`This patch will add ${nodeTotal} nodes. Continue?`,{title:'Many nodes',okLabel:'Apply anyway'});if(!ok)return}
  try{
    if(raw.patches&&Array.isArray(raw.patches)){sn();let ok=0;for(const p of raw.patches){try{document.getElementById('pt').value=JSON.stringify(p);await applyPatchSingle(p);ok++}catch(e){console.error('patch failed:',p.canvasId,e)}}closeModal();if(nodeTotal>=10)zF();await uiNotice('Applied '+ok+'/'+raw.patches.length+' patches.');return}
    sn();await applyPatchSingle(raw);closeModal();if(nodeTotal>=10)zF()
  }catch(err){await uiNotice('Apply error: '+err.message,{title:'Patch failed'})}
}
async function applyPatchSingle(p){
  // Resolve parent node: prefer explicit parentNodeId, else look up by parentNodeLabel in parent canvas
  let resolvedParentId=p.parentNodeId||null;const parentCanvas=p.parentCanvas||'vault';
  if(!resolvedParentId&&p.parentNodeLabel){const pn=S.canvases[parentCanvas]?.nodes.find(n=>(n.label||'').trim()===p.parentNodeLabel.trim());if(pn)resolvedParentId=pn.id;else{if(!await uiConfirm(`No node labeled "${p.parentNodeLabel}" found in ${parentCanvas}. Apply patch as standalone canvas?`,{title:'Parent node not found',okLabel:'Apply standalone'}))return}}
  // Resolve target canvas: if parent node already has a childCanvas, use THAT (avoids duplicate canvases)
  let cid=p.canvasId||S.current;
  if(resolvedParentId){const pn=S.canvases[parentCanvas].nodes.find(n=>n.id===resolvedParentId);if(pn&&pn.childCanvas&&S.canvases[pn.childCanvas]){cid=pn.childCanvas}}
  // Force use current canvas if explicitly requested
  if(p.useCurrentCanvas)cid=S.current;
  if(!S.canvases[cid]){if(p.createCanvas){S.canvases[cid]={nodes:[],edges:[],zones:[]};S.canvasMeta[cid]={name:p.canvasName||cid,parentNodeId:resolvedParentId,parentCanvas};if(resolvedParentId){const pn=S.canvases[parentCanvas].nodes.find(n=>n.id===resolvedParentId);if(pn)pn.childCanvas=cid}}else{await uiNotice('Unknown canvas: '+cid+'. Add "createCanvas":true to create it.');return}}
  const prev=S.current;S.current=cid;
  /* Phase 6 · zones in update mode get merged: existing IDs update label/
     color, new IDs are added. Default mode keeps the old "skip if id exists"
     behavior so existing patches keep working. */
  const updateMode=p.mode==='update';
  if(p.zones){
    if(p.replaceZones)C().zones=[];
    for(const z of p.zones){
      const existing=C().zones.find(x=>x.id===z.id);
      if(existing){if(updateMode)Object.assign(existing,z)}
      else C().zones.push(z);
    }
  }
  const added={};
  for(const nd of(p.nodes||[])){
    /* Phase 6 · update mode. Look for an existing node by label; if found,
       merge the patch fields (preserving x/y/id/created so the node stays
       in place visually). If not found, fall through to the original
       create-new-node path. */
    if(updateMode&&nd.label){
      const existing=ns().find(n=>(n.label||'').trim()===nd.label.trim());
      if(existing){
        sn();
        const {id:_,x:_x,y:_y,created:_c,...patchFields}=nd;
        Object.assign(existing,patchFields);
        added[nd.label]=existing.id;
        continue;
      }
    }
    const z=zs().find(x=>x.id===nd.zone)||zs()[0];const x=nd.x!==undefined?nd.x:z.x+60+Math.random()*(z.w-140),y=nd.y!==undefined?nd.y:z.y+70+Math.random()*(z.h-140);const n=addNode(x,y,nd,true);added[nd.label]=n.id;
  }
  for(const e of(p.edges||[])){
    const fi=typeof e.from==='number'?e.from:added[e.from]||ns().find(n=>n.label===e.from)?.id;
    const ti=typeof e.to==='number'?e.to:added[e.to]||ns().find(n=>n.label===e.to)?.id;
    if(!fi||!ti)continue;
    /* Phase 6 · in update mode, skip duplicate edges (same from+to+type
       and matching customLabel for type=custom — two custom edges with
       different labels are semantically different). */
    const ty=e.type||'feeds';
    const cl=e.customLabel||null;
    const dupe=updateMode&&es().find(x=>x.from===fi&&x.to===ti&&x.type===ty&&(ty!=='custom'||(x.customLabel||null)===cl));
    if(dupe)continue;
    es().push({id:S.nextId++,from:fi,to:ti,type:ty,customLabel:cl});
  }
  S.current=prev;sv();render();bF();bB();renderTabs();renderSB();if(p.switchTo)switchTo(cid)}
function showCtx(x,y,n){
  const rmList=Object.entries(S.canvasMeta).filter(([k,m])=>k!==S.current&&k!=='vault').map(([k,m])=>`<button onclick="copyToCanvas(${n.id},'${k}');hideCtx()">→ ${S.hebrewMode?'העתק אל':'Copy to'} ${esc(m.name)}</button>`).join('');
  const compactBtn=n.shape==='formula'?`<button onclick="sF(${n.id},'compact',${!n.compact})">${n.compact?(S.hebrewMode?'הצג מורחב (מלבן עם נוסחה)':'Show expanded (rectangle + math)'):(S.hebrewMode?'הצג מצומצם (כצומת רגיל)':'Show compact (regular node)')}</button>`:'';
  ctx.innerHTML=`<div class="csub">${t('shape')}</div>${SH.map(s=>`<button onclick="sF(${n.id},'shape','${s}')">${esc(t(s))}${n.shape===s?' ✓':''}</button>`).join('')}${compactBtn?'<div class="csep"></div>'+compactBtn:''}<div class="csep"></div><div class="csub">${t('status')}</div>${ST.map(s=>`<button onclick="sF(${n.id},'status','${s}')"><span style="display:inline-block;width:10px;height:10px;background:${SC[s]};border-radius:2px;margin-right:6px;vertical-align:middle"></span>${esc(t(s))}${n.status===s?' ✓':''}</button>`).join('')}<div class="csep"></div><button onclick="hideCtx();op(ns().find(x=>x.id===${n.id}))">${S.hebrewMode?'ערוך פרטים…':'Edit details…'}</button>${n.shape==='project'&&S.current==='vault'?(n.childCanvas?`<button onclick="hideCtx();switchTo('${n.childCanvas}')">↗ ${t('openRoadmap')}</button>`:`<button onclick="hideCtx();createRoadmap(${n.id})">${t('createRoadmap')}</button>`):''}${rmList?'<div class="csep"></div>'+rmList:''}<div class="csep"></div><button onclick="hideCtx();delN(${n.id})" style="color:var(--block)">${t('del')}</button>`;
  positionCtx(x,y);}
function hideCtx(){ctx.classList.remove('on')}
function sF(id,f,v){sn();const n=ns().find(x=>x.id===id);if(n){n[f]=v;sv();render();if(sel?.id===id)op(n)}hideCtx()}
document.addEventListener('click',e=>{if(!ctx.contains(e.target))hideCtx();if(!ep.contains(e.target))ep.classList.remove('on')});
function etLabel(k){return t(k)||(ET[k]?.l)||k}
function showEdgePicker(sx,sy,fromId,toId){ep.style.left=sx+'px';ep.style.top=sy+'px';ep.innerHTML=Object.entries(ET).map(([k,v])=>`<button onclick="${k==='custom'?`createCustomEdge(${fromId},${toId})`:`createEdge(${fromId},${toId},'${k}')`}"><span class="sw" style="background:${v.c}"></span>${esc(etLabel(k))}</button>`).join('');ep.classList.add('on')}
async function createCustomEdge(f,toId){const lbl=await uiPrompt(t('customLabel'),'');if(!lbl)return;sn();es().push({id:S.nextId++,from:f,to:toId,type:'custom',customLabel:lbl});ep.classList.remove('on');sv();render()}
function createEdge(f,t,ty){sn();es().push({id:S.nextId++,from:f,to:t,type:ty});ep.classList.remove('on');sv();render()}
const TH=4;
/* === UNIFIED POINTER INPUT (mouse + finger + Apple Pencil) === */
const activePtrs=new Map();
let pinchState=null;
let longPressTimer=null;
let lastTapTime=0,lastTapX=0,lastTapY=0;
/* Phase 5 P1 — press-and-hold to drag a node on touch. `holdTimer` gates
   node dragging on touch only: users must hold for HOLD_MS (no motion)
   before their finger can move the node. Motion before the gate opens
   converts the interaction to a pan, so a light swipe pans the canvas
   instead of yanking a node around. Mouse gets immediate drag (no gate). */
const HOLD_MS=350;
let holdTimer=null;
function clearHoldFeedback(){document.body.classList.remove('holding');const hs=document.querySelector('.nslice.holding');if(hs)hs.classList.remove('holding');const hh=document.querySelector('g.node.holding');if(hh)hh.classList.remove('holding')}

function beginInteraction(e){
  const nrz=e.target.closest('.nrz');const nE=e.target.closest('.node'),zH=e.target.closest('.zh'),zE=e.target.closest('.zd'),w=s2w(e.clientX,e.clientY);const mod=e.ctrlKey||e.metaKey;
  if(nrz){const id=+nrz.dataset.nrz;const n=ns().find(x=>x.id===id);if(n){sn();drag={k:'nresize',n,sx:e.clientX,sy:e.clientY,ow:n._w||100,oh:n._h||60}}return}
  if(nE){const n=ns().find(x=>x.id===+nE.dataset.id);
    if(mod){if(selSet.has(n.id))selSet.delete(n.id);else selSet.add(n.id);render();drag=null;return}
    if(e.shiftKey){drag={k:'edge',from:n,sx:e.clientX,sy:e.clientY,moved:false}}
    else{const group=selSet.has(n.id)&&selSet.size>1?[...selSet].map(id=>ns().find(x=>x.id===id)).filter(Boolean):null;drag={k:'node',n,ox:w.x-n.x,oy:w.y-n.y,sx:e.clientX,sy:e.clientY,moved:false,group,groupStart:group?.map(x=>({id:x.id,x:x.x,y:x.y})),renderX:n.x,renderY:n.y}}
  }else if(zH){const z=zs().find(x=>x.id===zH.closest('.zone').dataset.zone);sn();drag={k:'resize',z,sx:e.clientX,sy:e.clientY,ow:z.w,oh:z.h}}
  else if(zE){const z=zs().find(x=>x.id===zE.closest('.zone').dataset.zone);drag={k:'zone',z,ox:w.x-z.x,oy:w.y-z.y,sx:e.clientX,sy:e.clientY,moved:false}}
  else if(mod){drag={k:'marquee',sx:e.clientX,sy:e.clientY,startW:w,curW:w};selSet.clear();render()}
  else{if(!mod&&selSet.size){selSet.clear();render()}
    /* Phase 1 (Pass 5) · when --gestures-v2 is ON, pan is owned by the new
       state machine — leave drag null so pointermove/pointerup pan branches
       no-op here. Node/edge/zone interactions above still run normally. */
    if(window.Flags&&window.Flags.on('gestures-v2'))return;
    drag={k:'pan',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};cv.classList.add('gr')}
}

cv.addEventListener('pointerdown',e=>{
  if(window.dlog&&location.search.includes('debug'))dlog('pointerdown type='+e.pointerType+' target='+(e.target.tagName||'?')+' cls='+(e.target.className?.baseVal||e.target.className||'-'));
  if(e.pointerType==='mouse'&&e.button===2)return; // right-click handled by contextmenu
  // Phase 6 · suppress the deferred bootstrap zF after first user interaction.
  window._userInteracted=true;
  /* Phase 1 (EdgeSpace Pass 5) · when --gestures-v2 is ON, the new state
     machine in js/canvas/gesture.js owns pinch + empty-canvas pan + inertia.
     Node/edge/zone/resize interactions still flow through this handler
     (the state machine ignores them) so we ONLY bail on pure pan triggers. */
  const _g2 = window.Flags && window.Flags.on('gestures-v2');
  try{cv.setPointerCapture(e.pointerId)}catch(err){}
  activePtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});

  if(activePtrs.size===2){
    if(_g2){
      /* Phase 2.6 R2 (recurring) — cancel ALL single-pointer interaction
         state so the v2 pinch state machine starts from a clean slate.
         Critical additions over Phase 2.5:
           1. If a node was being dragged, the slice had a CSS translate()
              applied via the fast-path. The data position (n.x/n.y) was
              also mutated. We don't revert the node — that would lose the
              user's drag intent — but we DO render() so the slice's inline
              transform clears and the visual position matches the data.
              Without this, the node stays visually offset while pinch
              applies its own transform, making the canvas "follow" finger 2.
           2. Drop the in-flight node-drag's velocity sampling so swipe
              inertia doesn't fire when fingers eventually lift.
           3. preventDefault on the touchstart so no node handler downstream
              tries to re-grab the second touch. */
      if(drag?.k==='pan'){view.x=drag.vx;view.y=drag.vy}
      if(drag?.snap){hist.pop()}
      const wasNodeDrag = drag?.k==='node';
      drag=null;cv.classList.remove('gr');document.body.classList.remove('dragging');
      if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
      if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
      clearHoldFeedback();
      // Drop any in-flight inertia velocity bookkeeping on window.
      if(window._inertiaActive&&window._cancelInertia){window._cancelInertia()}
      // Flush stale slice/hit-group transforms by re-rendering once.
      if(wasNodeDrag){try{render()}catch(_){}}
      try{e.preventDefault()}catch(_){}
      return;
    }
    // Pinch starts — cancel any single-pointer drag
    if(drag?.k==='pan'){view.x=drag.vx;view.y=drag.vy}
    if(drag?.snap){hist.pop()}
    drag=null;cv.classList.remove('gr');
    if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
    clearHoldFeedback();
    /* Phase 6 · pan→pinch handoff. If swipe inertia is still decaying, kill
       it BEFORE recording the pinch baseline so view.x/view.y don't drift
       between baseline-snapshot and the first move event. */
    if(window._inertiaActive&&window._cancelInertia){window._cancelInertia()}
    /* Sprint 4.6 · under --gestures-v2 the pinch is owned by the gesture state
       machine (gesture.js → CanvasTransform → applyView, render-free). Setting
       the legacy pinchState here would run render() every move (the zoom render
       leak) AND double-update the view alongside the v2 path. Skip it when v2 is
       on; gesture.js handles the pinch. */
    if(!(window.Flags&&window.Flags.on('gestures-v2'))){
      const [p1,p2]=[...activePtrs.values()];
      pinchState={dist:Math.hypot(p2.x-p1.x,p2.y-p1.y)||1,cx:(p1.x+p2.x)/2,cy:(p1.y+p2.y)/2,k:view.k};
    }
    e.preventDefault();return;
  }
  if(activePtrs.size>2)return;

  beginInteraction(e);

  // Phase 5 P1 — press-and-hold gate for node drag on touch. Arm only when
  // beginInteraction() decided this is a node drag (drag.k==='node'); pan,
  // resize, edge-create, marquee, zone move are unchanged — they react to
  // motion immediately as before. Mouse also unchanged: node drag instant.
  if(e.pointerType==='touch'&&drag?.k==='node'){
    drag.holdPending=true;
    if(holdTimer)clearTimeout(holdTimer);
    const nid=drag.n.id;
    holdTimer=setTimeout(()=>{
      holdTimer=null;
      if(!drag||drag.k!=='node'||!drag.holdPending)return;
      drag.holdPending=false;
      /* Phase 5b — once the hold gate opens, cancel the context-menu timer.
         Movement after this point = drag, not menu. The 500ms context-menu
         threshold is only 150ms past HOLD_MS; without this cancel, a tiny
         movement delay lets the menu fire during a legitimate drag. */
      if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
      // Visual + haptic cue so the user knows the gate opened.
      document.body.classList.add('holding');
      const slice=document.querySelector(`.nslice[data-nid="${nid}"]`);if(slice)slice.classList.add('holding');
      const hitG=document.querySelector(`g.node[data-id="${nid}"]`);if(hitG)hitG.classList.add('holding');
      if(navigator.vibrate)navigator.vibrate(12);
    },HOLD_MS);
  }

  // Long-press for context menu (touch only — mouse uses right-click)
  if(e.pointerType==='touch'){
    const sx=e.clientX,sy=e.clientY,tgt=e.target;
    if(longPressTimer)clearTimeout(longPressTimer);
    longPressTimer=setTimeout(()=>{
      longPressTimer=null;
      if(!drag||drag.moved)return;
      // Cancel drag, fire contextmenu
      if(drag.k==='pan'){view.x=drag.vx;view.y=drag.vy}
      if(drag.snap){hist.pop()}
      if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
      clearHoldFeedback();
      drag=null;cv.classList.remove('gr');
      const fakeEv=new MouseEvent('contextmenu',{clientX:sx,clientY:sy,bubbles:true,cancelable:true});
      Object.defineProperty(fakeEv,'target',{value:tgt});
      cv.dispatchEvent(fakeEv);
      if(navigator.vibrate)navigator.vibrate(20);
    },500);
  }
  e.preventDefault();
});

document.addEventListener('pointermove',e=>{
  // Multi-touch pinch
  if(pinchState&&activePtrs.has(e.pointerId)){
    activePtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePtrs.size===2){
      const [p1,p2]=[...activePtrs.values()];
      const d=Math.hypot(p2.x-p1.x,p2.y-p1.y);
      const cx=(p1.x+p2.x)/2,cy=(p1.y+p2.y)/2;
      const before=s2w(cx,cy);
      view.k=pinchState.k*(d/pinchState.dist);
      const after=s2w(cx,cy);
      view.x+=after.x-before.x;view.y+=after.y-before.y;
      // Slide the pinch center too (allow 2-finger pan while pinching)
      const dcx=cx-pinchState.cx,dcy=cy-pinchState.cy;
      view.x+=dcx/view.k;view.y+=dcy/view.k;
      clampView();
      pinchState.cx=cx;pinchState.cy=cy;pinchState.dist=d;pinchState.k=view.k;
      render();forceRepaint();e.preventDefault();return;
    }
  }
  if(!drag)return;
  const w=s2w(e.clientX,e.clientY);
  if(!drag.moved&&(Math.abs(e.clientX-drag.sx)>TH||Math.abs(e.clientY-drag.sy)>TH)){
    // Phase 5 P1 — motion on touch BEFORE the hold gate opened: user swiped,
    // didn't hold. Convert the node-drag intent into a pan so the swipe
    // scrolls the canvas instead of yanking the node.
    if(drag.holdPending&&drag.k==='node'){
      if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
      if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
      clearHoldFeedback();
      drag={k:'pan',sx:drag.sx,sy:drag.sy,vx:view.x,vy:view.y};
      cv.classList.add('gr');
    }
    drag.moved=true;document.body.classList.add('dragging');
    if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
  }
  if(drag.k==='node'&&drag.moved){if(!drag.snap){sn();drag.snap=true}const newNx=w.x-drag.ox,newNy=w.y-drag.oy;if(drag.group){const anchor=drag.groupStart.find(g=>g.id===drag.n.id);const dx=newNx-anchor.x,dy=newNy-anchor.y;for(const gs of drag.groupStart){const nn=ns().find(x=>x.id===gs.id);if(nn){nn.x=gs.x+dx;nn.y=gs.y+dy}}}else{drag.n.x=newNx;drag.n.y=newNy;drag.n.zone=zoneAt(drag.n.x,drag.n.y)}
    /* Phase 5b · fix ghost trail. CSS transform delta approach: instead of
       mutating left/top + inner <g> transform (which leaves shape children
       referencing stale world coords, causing visual offset), apply a single
       CSS translate() on the whole slice and an SVG translate on the hit
       group. All inner coordinates stay untouched. Full render() fires once
       on pointerup, which rebuilds everything clean. */
    if(!drag.group){
      const dx=drag.n.x-drag.renderX,dy=drag.n.y-drag.renderY;
      const _sl=document.querySelector(`.nslice[data-nid="${drag.n.id}"]`);if(_sl)_sl.style.transform=`translate(${dx}px,${dy}px)`;
      const _hg=cv.querySelector(`g.node[data-id="${drag.n.id}"]`);if(_hg)_hg.setAttribute('transform',`translate(${dx},${dy})`);
      /* Phase 2.5 R1 — live-route connected edges so they track the moved
         node in real time. Without this, the fast drag path (which skips
         render() to avoid the ghost-trail) leaves every connected edge
         frozen at its old anchor until pointerup. */
      if(window.EdgeV2&&typeof window.EdgeV2.liveRouteForNode==='function'){
        const _ni=new Map(ns().map(n=>[n.id,n]));
        try{window.EdgeV2.liveRouteForNode(drag.n,es(),_ni)}catch(_e){}
      }
    }else{render()}}
  else if(drag.k==='marquee'){drag.curW=w;render();drawMarquee(drag.startW,w)}
  else if(drag.k==='zone'&&drag.moved){if(!drag.snap){sn();drag.snap=true}drag.z.x=w.x-drag.ox;drag.z.y=w.y-drag.oy;render()}
  else if(drag.k==='resize'){drag.z.w=Math.max(200,drag.ow+(e.clientX-drag.sx)/view.k);drag.z.h=Math.max(150,drag.oh+(e.clientY-drag.sy)/view.k);render()}
  else if(drag.k==='nresize'){drag.n.userW=Math.max(80,drag.ow+(e.clientX-drag.sx)/view.k);drag.n.userH=Math.max(50,drag.oh+(e.clientY-drag.sy)/view.k);render()}
  else if(drag.k==='pan'&&drag.moved){view.x=drag.vx+(e.clientX-drag.sx)/view.k;view.y=drag.vy+(e.clientY-drag.sy)/view.k;
    /* Phase 5b · velocity tracking for swipe inertia (touch only). Record
       the last two move events so pointerup can compute instantaneous vel. */
    if(e.pointerType==='touch'){const now=performance.now();drag._prevX=drag._lastX;drag._prevY=drag._lastY;drag._prevT=drag._lastT;drag._lastX=e.clientX;drag._lastY=e.clientY;drag._lastT=now}
    clampView();render()}
  else if(drag.k==='edge'&&drag.moved){const tE=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.node');edgeHover=tE?ns().find(x=>x.id===+tE.dataset.id):null;if(edgeHover&&edgeHover.id===drag.from.id)edgeHover=null;render();const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',drag.from.x);l.setAttribute('y1',drag.from.y);l.setAttribute('x2',w.x);l.setAttribute('y2',w.y);l.setAttribute('stroke','var(--accent)');l.setAttribute('stroke-width',2);l.setAttribute('stroke-dasharray','4,3');cv.appendChild(l)}
});
function drawMarquee(a,b){const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',x1);r.setAttribute('y',y1);r.setAttribute('width',x2-x1);r.setAttribute('height',y2-y1);r.setAttribute('fill','var(--accent)');r.setAttribute('fill-opacity','0.1');r.setAttribute('stroke','var(--accent)');r.setAttribute('stroke-width','1');r.setAttribute('stroke-dasharray','4,3');cv.appendChild(r)}

document.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
  if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
  clearHoldFeedback();
  if(pinchState){if(activePtrs.size<2){pinchState=null}return}

  /* Sprint 3.1 Issue 1 — touch double-tap is now only honoured when the
     tap actually landed on a .node. That preserves double-tap-to-open-
     roadmap on iPad while removing the silent path that re-introduced
     double-tap-to-add-node (the dblclick handler below no longer adds
     nodes either, so this is defence-in-depth). */
  if(e.pointerType==='touch'&&drag&&!drag.moved){
    const now=Date.now();
    const isDblTap=(now-lastTapTime<350)&&(Math.abs(e.clientX-lastTapX)<30)&&(Math.abs(e.clientY-lastTapY)<30);
    if(isDblTap){
      const el=document.elementFromPoint(e.clientX,e.clientY);
      const onNode=el&&el.closest&&el.closest('.node');
      if(onNode){
        if(drag.k==='pan'){view.x=drag.vx;view.y=drag.vy}
        if(drag.snap){hist.pop()}
        drag=null;cv.classList.remove('gr');document.body.classList.remove('dragging');
        const ev=new MouseEvent('dblclick',{clientX:e.clientX,clientY:e.clientY,bubbles:true,cancelable:true});
        Object.defineProperty(ev,'target',{value:el});
        cv.dispatchEvent(ev);
        lastTapTime=0;
        return;
      }
      // Empty-canvas double-tap: explicit no-op. Reset state and fall
      // through so single-tap semantics (panel close, etc.) still apply.
      lastTapTime=0;
    } else {
      lastTapTime=now;lastTapX=e.clientX;lastTapY=e.clientY;
    }
  }

  document.body.classList.remove('dragging');
  if(!drag){cv.classList.remove('gr');return}
  cv.classList.remove('gr');
  if(drag.k==='edge'){if(edgeHover){showEdgePicker(e.clientX,e.clientY,drag.from.id,edgeHover.id)}edgeHover=null}
  else if(drag.k==='marquee'){const a=drag.startW,b=drag.curW;const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);for(const n of ns()){if(n.x>=x1&&n.x<=x2&&n.y>=y1&&n.y<=y2)selSet.add(n.id)}render()}
  else if(drag.k==='node'&&!drag.moved){const n=drag.n;if(sel?.id===n.id)cp();else{sel=n;op(n)}}
  else if(drag.k==='pan'&&!drag.moved){cp()}
  /* Phase 5b · swipe inertia — if the pan ended with velocity on a touch
     device, apply a decaying drift using rAF. Feels natural on iPad.
     Phase 6 · expose handle on window so pinch-start can cancel cleanly. */
  if(drag&&drag.k==='pan'&&drag.moved&&e.pointerType==='touch'&&drag._lastT&&drag._prevT){
    const dt=(drag._lastT-drag._prevT)||16;
    let vx=(drag._lastX-drag._prevX)/dt;
    let vy=(drag._lastY-drag._prevY)/dt;
    const speed=Math.sqrt(vx*vx+vy*vy);
    if(speed>0.15){const decay=0.92;let raf;
      const step=()=>{if(window._inertiaCancelled){window._inertiaCancelled=false;return}vx*=decay;vy*=decay;if(Math.abs(vx)<0.01&&Math.abs(vy)<0.01){render();window._inertiaActive=false;return}view.x+=vx*16/view.k;view.y+=vy*16/view.k;clampView();render();raf=requestAnimationFrame(step)};
      window._inertiaActive=true;
      window._cancelInertia=()=>{cancelAnimationFrame(raf);window._inertiaCancelled=true;window._inertiaActive=false;vx=0;vy=0};
      raf=requestAnimationFrame(step);
      // Any new pointerdown cancels the inertia.
      const stop=()=>{window._cancelInertia&&window._cancelInertia();cv.removeEventListener('pointerdown',stop)};
      cv.addEventListener('pointerdown',stop,{once:true})}
  }
  if(drag&&(drag.snap||drag.k==='resize'||drag.k==='nresize'))sv();drag=null;render();
});

cv.addEventListener('pointercancel',e=>{
  activePtrs.delete(e.pointerId);
  if(activePtrs.size<2)pinchState=null;
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
  if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
  clearHoldFeedback();
  if(drag?.k==='pan'){view.x=drag.vx;view.y=drag.vy}
  if(drag?.snap){hist.pop()}
  drag=null;cv.classList.remove('gr');document.body.classList.remove('dragging');render();
});

/* D5 · Phase 1.6 — per-node overlay slices migration. The overlay sits above
   #cv as a sibling (not a child), so pointer events fired on overlay children
   with `pointer-events:auto` (only .nrz today) do not bubble to cv. Mirror
   cv's pointerdown here so resize-drag keeps working. pointermove/pointerup
   are on `document` already, so no parallel listener needed for those. */
(function(){
  const _ov=document.getElementById('canvasOverlay');if(!_ov)return;
  _ov.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button===2)return;
    // Only the .nrz handle claims pointer-events:auto inside the overlay, so
    // arriving here means we should behave exactly like cv's single-finger
    // pointerdown: record the pointer, call beginInteraction, preventDefault.
    activePtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(activePtrs.size>2)return;
    beginInteraction(e);
    e.preventDefault();
  });
  _ov.addEventListener('pointercancel',e=>{
    activePtrs.delete(e.pointerId);
    if(activePtrs.size<2)pinchState=null;
    if(drag?.snap){hist.pop()}
    if(holdTimer){clearTimeout(holdTimer);holdTimer=null}
    clearHoldFeedback();
    drag=null;document.body.classList.remove('dragging');render();
  });
})();

/* Sprint 3.1 Issue 1 — empty-canvas double-click NO LONGER adds a node.
   Long-press is now the only add-node gesture. Double-click on a project
   node in the vault still opens / creates a roadmap; double-click on any
   other node still opens its property panel. */
cv.addEventListener('dblclick',async e=>{const nE=e.target.closest?.('.node');if(!nE)return;const n=ns().find(x=>x.id===+nE.dataset.id);if(!n)return;if(n.shape==='project'&&S.current==='vault'){if(n.childCanvas)switchTo(n.childCanvas);else if(await uiConfirm('Create roadmap for "'+n.label+'"?',{title:'New roadmap',okLabel:'Create'}))createRoadmap(n.id);return}sel=n;op(n)});

/* Re-render on resize / orientation change (iPad URL bar collapse, rotation) */
window.addEventListener('resize',()=>{try{render()}catch(e){}});
window.addEventListener('orientationchange',()=>{setTimeout(()=>{try{render();zF()}catch(e){}},200)});

/* Prevent iOS Safari page zoom (overrides user-scalable=no being ignored in iOS 10+) */
document.addEventListener('gesturestart',e=>e.preventDefault());
document.addEventListener('gesturechange',e=>e.preventDefault());
document.addEventListener('gestureend',e=>e.preventDefault());
/* Prevent default double-tap-zoom on the canvas */
let lastTouchEnd=0;
document.addEventListener('touchend',e=>{const now=Date.now();if(now-lastTouchEnd<=300)e.preventDefault();lastTouchEnd=now},{passive:false});
function changeEdgeType(id,k){sn();const e=es().find(x=>x.id===id);if(e){e.type=k;e.customLabel=null}sv();render();hideCtx()}
function reverseEdge(id){sn();const e=es().find(x=>x.id===id);if(e){const tmp=e.from;e.from=e.to;e.to=tmp}sv();render();hideCtx()}
async function changeEdgeToCustom(id){const lbl=await uiPrompt(t('customLabel'),'');if(!lbl)return;sn();const e=es().find(x=>x.id===id);if(e){e.type='custom';e.customLabel=lbl}sv();render();hideCtx()}
cv.addEventListener('contextmenu',e=>{const nE=e.target.closest('.node'),eE=e.target.closest('.edge'),zE=e.target.closest('.zr');
  if(nE){e.preventDefault();const n=ns().find(x=>x.id===+nE.dataset.id);showCtx(e.clientX,e.clientY,n)}
  else if(eE){e.preventDefault();const id=+eE.dataset.edge;const ed=es().find(x=>x.id===id);
    ctx.innerHTML=`<div class="csub">${t('ctxEdge')}: ${esc(t(ed?.type)||'?')}</div><button onclick="reverseEdge(${id})">${S.hebrewMode?'הפוך כיוון':'Reverse direction'} ⇄</button><div class="csep"></div>${Object.entries(ET).map(([k,v])=>k==='custom'?`<button onclick="changeEdgeToCustom(${id})">${t('changeTo')} ${esc(t('custom'))}…${ed?.type===k?' ✓':''}</button>`:`<button onclick="changeEdgeType(${id},'${k}')">${t('changeTo')} ${esc(t(k))}${ed?.type===k?' ✓':''}</button>`).join('')}<div class="csep"></div><button onclick="hideCtx();delE(${id})" style="color:var(--block)">${t('deleteEdge')}</button>`;positionCtx(e.clientX,e.clientY)}
  else if(zE){e.preventDefault();const zid=zE.closest('.zone').dataset.zone;const z=zs().find(x=>x.id===zid);const lk=z.locked!==false;
    ctx.innerHTML=`<div class="csub">${t('ctxZone')}: ${esc(z.name)}</div><button onclick="toggleLock('${zid}')">${lk?t('unlockZ'):t('lockZ')}</button><button onclick="renameZone('${zid}')">${t('renameZ')}</button><button onclick="recolorZone('${zid}')">${t('recolorZ')}</button><button onclick="deleteZone('${zid}')" style="color:var(--block)">${t('deleteZ')}</button>`;positionCtx(e.clientX,e.clientY)}
  else{e.preventDefault();showCanvasCtx(e.clientX,e.clientY,s2w(e.clientX,e.clientY))}});
function showCanvasCtx(x,y,w){ctx.innerHTML=`<button onclick="hideCtx();addNodeAt(${w.x},${w.y})">${t('addNodeHere')}</button><button onclick="hideCtx();addZoneAt(${w.x},${w.y})">${t('addZoneHere')}</button>`;positionCtx(x,y)}

/* Phase 2.8 B — register against the gesture state machine's high-level
   callbacks. The machine fires these for empty-canvas single-touch events
   only (node/zone/handle interactions stay owned by app.js's existing
   pointerdown handler). Long-press → "Add node / Add zone here" menu,
   matching the desktop right-click behaviour. Double-tap → add a node
   at that point, matching desktop dblclick behaviour. */
window.onCanvasLongPress = function(pos) {
  if (!pos) return;
  // Bail if the touch landed on a UI overlay (defensive — gesture.js
  // already filters node/zone targets but not toolbar/sidebar chrome).
  if (pos.target && pos.target.closest && pos.target.closest('#tb,#sb,#fl,#bc,#more,#ctx,#ep,#dlg,#modal,#landing,#pn,#tabs,#lg,#lgBtn,#perfHud,#zoneChips,#edgeLegend,#emptyState,#spine,#drawer,#topbar,#viewTabs,#palette,#viewStage')) return;
  const w = s2w(pos.x, pos.y);
  showCanvasCtx(pos.x, pos.y, w);
};
// Sprint 3 preamble 1 — window.onCanvasDoubleTap intentionally NOT
// registered. Double-tap-to-add-node was removed at user request.
async function recolorZone(zid){const c=await uiPrompt(S.hebrewMode?'צבע (hex)':'Zone color','',{placeholder:'#d97757',hint:'Hex color, e.g. #d97757'});if(!c)return;sn();const z=zs().find(x=>x.id===zid);if(z)z.color=c;sv();render();bF()}
function addNodeAt(x,y){const n=addNode(x,y);sel=n;op(n)}
async function addZoneAt(x,y){const name=await uiPrompt('New zone','New Zone');if(!name)return;sn();const id='z-'+Date.now();const colors=['#8b7ba8','#6b8cb0','#5fa3a8','#7aa882','#c48a9b','#c9896a','#7d7569','#b07ba8','#6ba8a0'];const c=colors[zs().length%colors.length];zs().push({id,name,x:x-250,y:y-180,w:500,h:360,color:c});sv();render();bF()}
function addZoneCenter(){const w=s2w(innerWidth/2,innerHeight/2);addZoneAt(w.x,w.y)}
async function renameZone(zid){const z=zs().find(x=>x.id===zid);if(!z)return;const n=await uiPrompt('Rename zone',z.name);if(n){sn();z.name=n;sv();render();bF()}hideCtx()}
function toggleLock(zid){const z=zs().find(x=>x.id===zid);if(!z)return;sn();z.locked=z.locked===false?true:false;sv();render();hideCtx()}
async function deleteZone(zid){const z=zs().find(x=>x.id===zid);if(!z)return;const nodesInZone=ns().filter(n=>n.zone===zid).length;if(nodesInZone>0){if(!await uiConfirm(`${nodesInZone} nodes are in "${z.name}". They'll be reassigned to another zone. Continue?`,{title:'Delete zone',danger:true,okLabel:'Delete'})){hideCtx();return}}if(zs().length<=1){await uiNotice('Cannot delete the last zone.');hideCtx();return}sn();const fallback=zs().find(x=>x.id!==zid).id;ns().forEach(n=>{if(n.zone===zid)n.zone=fallback});C().zones=zs().filter(x=>x.id!==zid);sv();render();bF();hideCtx()}
cv.addEventListener('wheel',e=>{
  // Phase 1 · zoom is owned by the gesture state machine when --gestures-v2 is ON.
  if(window.Flags&&window.Flags.on('gestures-v2'))return;
  e.preventDefault();const b=s2w(e.clientX,e.clientY),d=e.deltaY<0?1.12:.89;view.k=view.k*d;const a=s2w(e.clientX,e.clientY);view.x+=a.x-b.x;view.y+=a.y-b.y;clampView();render();forceRepaint()
},{passive:false});
/* Phase 1 · 1.6b — defense-in-depth for iPad Safari / Apple Pencil / Scribble.
   touch-action:none on #cv (CSS) already tells the browser we own the canvas
   gesture; these non-passive touchstart/move listeners claim the legacy touch
   event path too so iOS can't route a pencil touch to Scribble or kick in
   Safari's own pinch-zoom / pull-to-refresh. Node editing happens in the side
   panel (not inline on the canvas), so blocking touch defaults here is safe. */
cv.addEventListener('touchstart',e=>{e.preventDefault()},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault()},{passive:false});
window.addEventListener('keydown',async e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key==='Delete'){if(selSet.size){if(await uiConfirm(`Delete ${selSet.size} selected nodes?`,{title:'Bulk delete',danger:true,okLabel:'Delete'})){sn();for(const id of selSet)delN(id);selSet.clear();render()}}else if(sel)delN(sel.id)}else if((e.ctrlKey||e.metaKey)&&e.shiftKey&&(e.key==='z'||e.key==='Z')){e.preventDefault();re()}else if((e.ctrlKey||e.metaKey)&&(e.key==='y'||e.key==='Y')){e.preventDefault();re()}else if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();un()}else if((e.ctrlKey||e.metaKey)&&e.key==='a'){e.preventDefault();selSet.clear();for(const n of ns())selSet.add(n.id);render()}else if(e.key==='Escape'){selSet.clear();cp();hideCtx();closeModal();ep.style.display='none';hideLegend();hideMore();render()}});
function zF(){const items=[...zs().map(z=>({x1:z.x,y1:z.y,x2:z.x+z.w,y2:z.y+z.h})),...ns().map(n=>({x1:n.x-60,y1:n.y-60,x2:n.x+60,y2:n.y+60}))];if(!items.length){view={x:0,y:0,k:.5};render();return}const x1=Math.min(...items.map(i=>i.x1)),y1=Math.min(...items.map(i=>i.y1)),x2=Math.max(...items.map(i=>i.x2)),y2=Math.max(...items.map(i=>i.y2)),pad=80;view.k=Math.min(innerWidth/(x2-x1+pad*2),innerHeight/(y2-y1+pad*2),.7);view.x=-(x1+x2)/2;view.y=-(y1+y2)/2;render()}
/* Sprint 3.4 Issue 2 — fit-to-zone for drawer-row navigation. Same math
   as zF() but scoped to a single zone's bounding box, with a slightly
   tighter k cap so a single zone fills more of the viewport. */
function focusZone(zoneId){const z=zs().find(x=>x.id===zoneId);if(!z)return;const pad=60;view.k=Math.min(innerWidth/(z.w+pad*2),innerHeight/(z.h+pad*2),0.9);view.x=-(z.x+z.w/2);view.y=-(z.y+z.h/2);render()}
window.focusZone=focusZone;
function ex(){const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='idea-vault.json';a.click()}
/* Sprint 3.6 Issue 1 — the 1500 ms re-entry guard from 3.5 was a fix
   for the wrong problem. The duplication was render-side (drawer.js
   walked vault's children twice), not data-side. Removing the guard
   restores the natural "import two different files quickly" flow that
   the brief asked for. */
function imF(e){
  window.dbg&&window.dbg('IMPORT','imF entered · files='+((e.target.files&&e.target.files.length)||0));
  const f=e.target.files[0];
  if(!f){window.dbg&&window.dbg('IMPORT','no file selected — abort');return}
  window.dbg&&window.dbg('IMPORT','file: '+f.name+' · '+f.size+'B');
  const r=new FileReader();
  r.onload=async ()=>{
    window.dbg&&window.dbg('IMPORT','FileReader.onload · result len='+(r.result?r.result.length:0));
    try{
      const parsed=JSON.parse(r.result);
      /* Phase 2.6 NEW · format detection. The Import button is connected
         to #imp which historically expected FULL STATE (an S object with
         {canvases, canvasMeta, nextId, current, ...}). Users routinely
         try to import PATCH files (single-canvas exports, multi-patches,
         or Claude-generated update-mode patches) through the same button.
         Old behaviour: imF blindly replaced S with the parsed patch,
         reconcileCanvases initialised an empty default vault, render()
         painted nothing → "empty vault, no imported data".
         New behaviour: detect the shape, route patches through
         applyPatch (showPatch + #pt + applyPatch), full state through
         the legacy S-replace path. */
      const looksLikeFullState = parsed && typeof parsed === 'object'
        && parsed.canvases && typeof parsed.canvases === 'object'
        && Object.keys(parsed.canvases).length > 0;
      if (!looksLikeFullState) {
        window.dbg&&window.dbg('IMPORT','patch-shape detected (no canvases map) — routing through applyPatch');
        try { showPatch(); } catch (_) {}
        const pt = document.getElementById('pt');
        if (pt) { pt.value = r.result; try { await applyPatch(); } catch (apErr) { window.dbg&&window.dbg('IMPORT','applyPatch threw: '+apErr.message); } }
        else { await uiNotice('Patch import unavailable — please open the Patch dialog manually and paste the JSON.', {title:'Import format'}); }
        return;
      }
      sn();
      S=parsed;
      window.dbg&&window.dbg('IMPORT','state swapped · current='+S.current);
      reconcileCanvases();
      window.dbg&&window.dbg('IMPORT','reconcileCanvases done · nodes='+(S.canvases[S.current]?.nodes?.length||0));
      await sv();
      render();
      window.dbg&&window.dbg('IMPORT','render done');
      bF();bB();renderTabs();renderSB();
      zF();
      window.dbg&&window.dbg('IMPORT','zF done — import complete');
    }catch(err){
      window.dbg&&window.dbg('IMPORT','ERROR in onload: '+err.message);
      try{ await uiNotice('Could not import: '+(err&&err.message||'unknown error'),{title:'Import failed'}); }catch(_){}
    }
  };
  r.onerror=()=>{window.dbg&&window.dbg('IMPORT','FileReader error: '+(r.error&&r.error.message))};
  r.readAsText(f);
  window.dbg&&window.dbg('IMPORT','readAsText dispatched');
  // Phase 2.6 NEW · reset the input value so picking the same file twice in
  // a row re-fires the change event. Without this, iOS Safari silently
  // ignores a repeat selection of the same file.
  try { e.target.value = ''; } catch (_) {}
}
function reconcileCanvases(){
  if(!S)S={};
  if(!S.canvases)S.canvases={};
  if(!S.canvases.vault)S.canvases.vault={nodes:[],edges:[],zones:[]};
  if(!S.canvases.vault.nodes)S.canvases.vault.nodes=[];
  if(!S.canvases.vault.edges)S.canvases.vault.edges=[];
  if(!S.canvases.vault.zones||S.canvases.vault.zones.length===0){S.canvases.vault.zones=JSON.parse(JSON.stringify(DZ.vault))}
  if(!S.canvasMeta)S.canvasMeta={};
  if(!S.canvasMeta.vault)S.canvasMeta.vault={name:'Vault',parentNodeId:null};
  if(!S.current||!S.canvases[S.current])S.current='vault';
  if(!S.nextId)S.nextId=1;
  for(const cid of Object.keys(S.canvases)){
    if(!S.canvases[cid])S.canvases[cid]={nodes:[],edges:[],zones:[]};
    if(!S.canvases[cid].nodes)S.canvases[cid].nodes=[];
    if(!S.canvases[cid].edges)S.canvases[cid].edges=[];
    if(!S.canvases[cid].zones)S.canvases[cid].zones=[];
    if(!S.canvasMeta[cid])S.canvasMeta[cid]={name:cid,parentNodeId:null,parentCanvas:'vault'};
  }
  for(const cid of Object.keys(S.canvases)){for(const n of S.canvases[cid].nodes||[]){if(n.childCanvas&&!S.canvases[n.childCanvas]){n.childCanvas=null}}}
  for(const [cid,m] of Object.entries(S.canvasMeta)){if(m.parentNodeId){const pc=m.parentCanvas||'vault';const pn=S.canvases[pc]?.nodes.find(n=>n.id===m.parentNodeId);if(pn&&!pn.childCanvas)pn.childCanvas=cid}}
  /* Phase 6 · orphan auto-healing. A canvas with parentCanvas pointing at
     a deleted/missing canvas would otherwise vanish from the tab bar.
     Promote any such orphan to vault as the safest default. */
  let fixedOrphans=0;
  for(const cid of Object.keys(S.canvasMeta)){
    if(cid==='vault')continue;
    const m=S.canvasMeta[cid];
    if(m.parentCanvas&&!S.canvases[m.parentCanvas]){m.parentCanvas='vault';fixedOrphans++}
  }
  if(fixedOrphans>0&&window.dbg)window.dbg('SYS','reconcile · auto-healed '+fixedOrphans+' orphan canvas(es) to vault parent');
  /* Sprint 3.6 Issue 1 — dedup migration demoted from auto-run to
     warning-only. The actual root cause was the drawer's render path
     walking vault's children twice (fixed in drawer.js renderNodeOnce);
     there was never any data-level duplication to clean up. Keeping
     the function as a diagnostic so that if any future data path DOES
     somehow produce identical canvas pairs, we see a console.warn
     from `warnOnDuplicateCanvases` rather than silently passing. */
  warnOnDuplicateCanvases();
}

/* Sprint 3.6 Issue 1 — warning-only logger. Replaces 3.5's
   dedupeIdenticalCanvases which auto-deleted byte-equal pairs from a
   bug that was actually render-side. Now the function ONLY logs to
   the console — if it ever finds identical pairs in the wild, that's a
   signal something else is broken and worth a manual look. Never
   modifies S. */
function warnOnDuplicateCanvases(){
  if(!S||!S.canvases) return;
  const ids = Object.keys(S.canvases).filter(id => id !== 'vault');
  function sigOf(cid){
    const c = S.canvases[cid];
    const m = S.canvasMeta?.[cid] || {};
    if(!c) return null;
    const nodeIds = (c.nodes||[]).map(n => n.id).sort().join(',');
    const edgeIds = (c.edges||[]).map(e => e.id).sort().join(',');
    const zoneIds = (c.zones||[]).map(z => z.id).sort().join(',');
    return (m.name||cid) + '|' + (m.parentCanvas||'') + '|' + nodeIds + '|' + edgeIds + '|' + zoneIds;
  }
  const bySig = new Map();
  for(const cid of ids){
    const sig = sigOf(cid);
    if(!sig) continue;
    if(!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig).push(cid);
  }
  const dupGroups = [];
  for(const [sig, group] of bySig){
    if(group.length > 1) dupGroups.push({sig, ids: group});
  }
  if(dupGroups.length && typeof console !== 'undefined'){
    console.warn('[EdgeSpace] Found '+dupGroups.length+' canvas group(s) with identical signatures. Likely a real bug — please report.', dupGroups);
  }
}
/* Back-compat alias so tests / older console snippets still work. */
window.warnOnDuplicateCanvases = warnOnDuplicateCanvases;
window.dedupeIdenticalCanvases = warnOnDuplicateCanvases;

/* Sprint 3.5 Issue 5 — delete a canvas (with optional cascade). Same
   confirmation shape as clearCanvasWithCascade from 3.4 Issue 8. Single
   undo restores the canvas and any cascaded descendants.

   Counts shown in the modal:
     · nodes + zones on this canvas
     · whether this canvas itself has a portal node pointing IN to it
       (the parentNodeId field) — getting deleted means that portal
       node's childCanvas attribute is cleared so it stays in the
       parent canvas but no longer drills down
     · descendant canvases that would be orphaned if cascade is off
*/
async function deleteCanvasWithConfirm(cid){
  if(!cid || cid === 'vault') return;
  const c = S.canvases[cid];
  if(!c){ return; }
  const meta = S.canvasMeta?.[cid] || {};
  const name = esc(meta.name || cid);
  const nNodes = (c.nodes||[]).length;
  const nZones = (c.zones||[]).length;
  /* Children of THIS canvas (portal nodes inside it pointing OUT). */
  const childCanvases = gatherDescendantCanvasIds(cid);
  const totalDescNodes = Array.from(childCanvases).reduce((sum, d) => sum + ((S.canvases[d]?.nodes?.length)||0), 0);
  /* Build modal body. */
  const cascadeBlock = childCanvases.size
    ? '<p style="margin:8px 0 12px;color:var(--ink-2,#C8C5BE);font-size:13px"><b>'+childCanvases.size+' child canvas(es)</b> would become reachable from the workspace root, containing <b>'+totalDescNodes+' nodes</b> in total.</p>'+
      '<label style="display:flex;align-items:center;gap:10px;padding:12px;border:1px solid var(--line-2,#2A2F3A);border-radius:8px;cursor:pointer;margin:8px 0">'+
        '<input type="checkbox" id="__delCascade" style="width:18px;height:18px"/>'+
        '<span style="font-size:13px;color:var(--ink,#F0EBE5)">Also delete those child canvases and everything under them</span>'+
      '</label>'
    : '';
  const body =
    '<div style="font-family:var(--font-sans,Inter);color:var(--ink,#F0EBE5)">'+
      '<h3 style="margin:0 0 12px;font-size:16px">Delete "'+name+'"?</h3>'+
      '<p style="margin:0 0 8px;color:var(--ink-2,#C8C5BE);font-size:13px">'+
        '<b>'+nNodes+' nodes</b> and <b>'+nZones+' zones</b> will be removed.'+
      '</p>'+
      cascadeBlock+
      '<div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">'+
        '<button id="__delCancel" style="padding:8px 16px;background:transparent;color:var(--ink-2,#C8C5BE);border:1px solid var(--line-2,#2A2F3A);border-radius:6px;cursor:pointer">Cancel</button>'+
        '<button id="__delOk" style="padding:8px 16px;background:var(--st-blocked,#F87171);color:#0F0F0F;border:none;border-radius:6px;cursor:pointer;font-weight:600">Delete canvas</button>'+
      '</div>'+
    '</div>';
  const m = document.getElementById('modal');
  const mb = document.getElementById('mcbody');
  if(!m || !mb) return;
  mb.innerHTML = body;
  m.classList.add('on');
  return new Promise(resolve => {
    document.getElementById('__delCancel').onclick = () => { m.classList.remove('on'); resolve(false); };
    document.getElementById('__delOk').onclick = () => {
      const cascade = document.getElementById('__delCascade')?.checked;
      m.classList.remove('on');
      sn();
      if(cascade){
        for(const did of childCanvases){
          delete S.canvases[did];
          if(S.canvasMeta) delete S.canvasMeta[did];
        }
      } else {
        /* Re-parent child canvases to vault so they stay reachable. */
        for(const did of childCanvases){
          if(S.canvasMeta?.[did]){
            S.canvasMeta[did].parentCanvas = 'vault';
            S.canvasMeta[did].parentNodeId = null;
          }
        }
      }
      /* Null out any portal node elsewhere pointing TO this canvas. */
      for(const otherCid of Object.keys(S.canvases)){
        if(otherCid === cid) continue;
        for(const n of (S.canvases[otherCid].nodes||[])){
          if(n.childCanvas === cid) n.childCanvas = null;
        }
      }
      delete S.canvases[cid];
      if(S.canvasMeta) delete S.canvasMeta[cid];
      /* If the user was on the deleted canvas, jump back to vault. */
      if(S.current === cid) S.current = 'vault';
      sv();
      render();
      if(typeof renderTabs === 'function') renderTabs();
      if(window.Drawer && window.Drawer.refresh) window.Drawer.refresh();
      resolve(true);
    };
  });
}
window.deleteCanvasWithConfirm = deleteCanvasWithConfirm;
async function cleanOrphanCanvases(){const orphans=[];for(const cid of Object.keys(S.canvases)){if(cid==='vault')continue;const m=S.canvasMeta[cid];const empty=(S.canvases[cid].nodes||[]).length===0;const noParentRef=!m?.parentNodeId||!S.canvases[m.parentCanvas||'vault']?.nodes.find(n=>n.id===m.parentNodeId&&n.childCanvas===cid);if(empty&&noParentRef)orphans.push(cid)}
  if(!orphans.length){await uiNotice('No orphan canvases found.');return}
  if(!await uiConfirm(`Found ${orphans.length} orphan canvas(es) (empty + not linked to any node):\n\n${orphans.map(c=>'• '+(S.canvasMeta[c]?.name||c)).join('\n')}\n\nDelete them?`,{title:'Clean orphans',danger:true,okLabel:'Delete'}))return;
  sn();for(const cid of orphans){delete S.canvases[cid];delete S.canvasMeta[cid]}sv();render();renderTabs();renderSB();bB()}
async function ts(k){if(ns().length&&!await uiConfirm(`Current canvas has ${ns().length} nodes. Seed anyway?`,{title:'Seed demo',okLabel:'Seed'}))return;sn();seedDemo();zF()}
function placeIn(zid){const Z=zs().find(x=>x.id===zid)||zs()[0];return{x:Z.x+60+Math.random()*(Z.w-140),y:Z.y+70+Math.random()*(Z.h-140)}}
function seedDemo(){
  const prev=S.current;S.current='vault';
  const D=[
    ['First project','projects','project','progress','getting-started','','A sample project node. Click ↗ to give it its own sub-canvas (roadmap).'],
    ['Sample idea','ideas','idea','idea','','','Ideas become projects once you commit to them.'],
    ['Open question','ideas','question','idea','','','Questions mark things you need to research or decide.'],
    ['Guiding principle','ideas','principle','done','core','','Principles are rules you want to remember and apply consistently.'],
    ['Reference link','inbox','resource','idea','link','https://example.com','Paste any URL — the app auto-detects GitHub, YouTube, arXiv, and more.'],
    ['Formula example','inbox','formula','done','','','A formula node renders LaTeX via KaTeX.'],
    ['Research note','inbox','note','idea','','','Notes hold free-form text with $inline$ math and $$display$$ math.'],
  ];
  const ids={};
  for(const[l,z,sh,st,t,u,r]of D){const p=placeIn(z);const n=addNode(p.x,p.y,{label:l,zone:z,shape:sh,status:st,tags:t,url:u,rationale:r,latex:sh==='formula'?'E = mc^2':''},true);ids[l]=n.id}
  const eg=(a,b,t)=>{if(ids[a]&&ids[b])es().push({id:S.nextId++,from:ids[a],to:ids[b],type:t})};
  eg('Sample idea','First project','feeds');
  eg('Open question','First project','related');
  eg('Guiding principle','First project','related');
  S.current=prev;sv();render()
}

// --- Tab bar long-press (iPad/touch) ---
document.getElementById('tabs')?.addEventListener('pointerdown',function(e){
  if(e.pointerType==='mouse')return;
  const tab=e.target.closest?.('.tab');if(!tab)return;
  const sx=e.clientX,sy=e.clientY;
  const tLP=setTimeout(()=>{
    const tabs=Array.from(tab.parentNode.querySelectorAll('.tab'));
    const cid=Object.keys(S.canvases)[tabs.indexOf(tab)];
    if(cid){const fakeEv={preventDefault:()=>{},clientX:sx,clientY:sy};showTabCtx(fakeEv,cid)}
    if(navigator.vibrate)navigator.vibrate(20);
  },500);
  const cleanup=()=>{clearTimeout(tLP);tab.removeEventListener('pointerup',cleanup);tab.removeEventListener('pointermove',cleanup);tab.removeEventListener('pointercancel',cleanup)};
  tab.addEventListener('pointerup',cleanup,{once:true});
  tab.addEventListener('pointermove',cleanup,{once:true});
  tab.addEventListener('pointercancel',cleanup,{once:true});
});

// --- PWA meta (Safari-safe, no blob-URL service worker) ---
try{const meta=document.createElement('meta');meta.name='apple-mobile-web-app-capable';meta.content='yes';document.head.appendChild(meta);const meta2=document.createElement('meta');meta2.name='apple-mobile-web-app-title';meta2.content='Vault';document.head.appendChild(meta2)}catch(e){}

/* Global error banner for debugging */
/* Legacy verbose dev log overlay (bottom-of-viewport green panel).
   Phase 1 fix: previously triggered on ANY location.search containing the
   string 'debug', which means `?debug=perf` (the new Phase 1 HUD trigger)
   ALSO turned this on. Tightened to opt-in via the specific URL token
   `?debug=verbose`. Anything else — including ?debug=perf — leaves it
   inert, no DOM created, no listeners attached. */
const _dbgVerbose=(function(){try{return new URLSearchParams(location.search).get('debug')==='verbose'}catch(e){return false}})();
if(_dbgVerbose){
  const dbg=document.createElement('div');dbg.id='dbgOverlay';dbg.style.cssText='position:fixed;bottom:104px;left:8px;right:8px;max-height:152px;overflow-y:auto;background:rgba(0,0,0,0.85);color:#7db36a;font:10px/1.3 monospace;padding:8px;border:1px solid #7db36a;border-radius:8px;z-index:9998;pointer-events:auto;touch-action:pan-y';document.body.appendChild(dbg);
  window.dlog=function(m){const l=document.createElement('div');l.textContent=m;dbg.insertBefore(l,dbg.firstChild);while(dbg.children.length>30)dbg.removeChild(dbg.lastChild)};
  window.dlog('DEBUG MODE ON');window.dlog('viewport: '+innerWidth+'x'+innerHeight);window.dlog('ua: '+navigator.userAgent.slice(0,60));
}

window.addEventListener('error',e=>{const existing=document.getElementById('errBanner');if(existing)return;const b=document.createElement('div');b.id='errBanner';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#d96b5a;color:white;padding:12px;font:12px/1.4 monospace;word-break:break-word;max-height:40vh;overflow:auto';b.textContent='JS ERROR: '+(e.message||'unknown')+' @ '+(e.filename||'?')+':'+(e.lineno||'?');b.onclick=()=>b.remove();document.body.appendChild(b)});
window.addEventListener('unhandledrejection',e=>{const existing=document.getElementById('errBanner');if(existing)return;const b=document.createElement('div');b.id='errBanner';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#d96b5a;color:white;padding:12px;font:12px/1.4 monospace;word-break:break-word;max-height:40vh;overflow:auto';b.textContent='PROMISE ERROR: '+(e.reason?.message||e.reason||'unknown')+'\\n'+(e.reason?.stack||'');b.onclick=()=>b.remove();document.body.appendChild(b)});

load().then(()=>{try{zF()}catch(e){console.error('zF failed',e)}
  /* iOS Safari needs a re-render after layout settles. Belt-and-suspenders:
     re-fit on the next rAF (after layout) and again at 300ms (after font/
     KaTeX are likely loaded). Phase 6 · skip these if the user has already
     interacted, so a programmatic addNodeRaw + pointerdown sequence (used
     in our hold-drag tests) doesn't get its view yanked mid-test. */
  requestAnimationFrame(()=>{if(window._userInteracted)return;try{render();zF()}catch(e){}});
  setTimeout(()=>{if(window._userInteracted)return;try{render();zF()}catch(e){}},300);
}).catch(e=>{console.error('load failed',e);const b=document.createElement('div');b.id='errBanner';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#d96b5a;color:white;padding:12px;font:12px/1.4 monospace;word-break:break-word;max-height:40vh;overflow:auto';b.textContent='LOAD FAILED: '+(e.message||e)+'\\n\\n'+(e.stack||'');b.onclick=()=>b.remove();document.body.appendChild(b);
  // Try to render a blank canvas anyway so buttons work
  try{reconcileCanvases();applyHebrewState();render();bF();bB();renderTabs();renderSB();rebuildWsDropdown()}catch(e2){console.error('fallback render failed',e2)}
});

// Test hook: expose live state handles to Playwright via getters so assertions
// can introspect the current S / view without relying on `let` top-level
// binding scoping (non-module `let` is not attached to window). Read-only,
// no behavioral impact in production — dead code unless tests poke at it.
if(!window.__E2E){Object.defineProperty(window,'__E2E',{value:Object.freeze({
  state:()=>S,
  view:()=>view,
  current:()=>S.canvases[S.current],
  addNodeRaw:(node)=>{S.canvases[S.current].nodes.push(node);render();return node},
  setCurrentCanvas:(id)=>{if(S.canvases[id]){S.current=id;render();return true}return false},
  // Phase 2.5 R2 regression-test hook — read live drag-interaction state.
  drag:()=>drag,
  // Sprint 3.1 Issue 3 — expose the live selected node so the edge-draw
  // handles module can position its 4 grab dots without re-introducing a
  // global variable.
  sel:()=>sel,
})})}
