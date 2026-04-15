// ============================================================================
// Phase 1.5 · On-screen diagnostics for real-iPad debugging (bugs #1/#3/#5).
// iPad Safari console access is painful — render log lines directly into the
// DOM (bottom-right overlay) so Azamat can read them on the deployed URL
// without plugging into a Mac. Auto-on unless URL has ?nodbg; tap × to close.
// Sections: IMPORT (orange) · KATEX (green) · MD (purple) · SYS (gray).
// ============================================================================
(function(){
  if(typeof location!=='undefined'&&location.search.indexOf('nodbg')>=0)return;
  // Suppress the overlay under automation (Playwright sets navigator.webdriver)
  // so existing screenshot tests and flow tests don't have to care about it.
  // Real Safari / Chrome / Firefox leave webdriver undefined.
  if(typeof navigator!=='undefined'&&navigator.webdriver)return;
  var SC2={IMPORT:'#d97757',KATEX:'#7db36a',MD:'#c48a9b',SYS:'#8a8478'};
  var t0=Date.now(),panel=null,body=null,collapsed=false,queue=[];
  function esc2(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
  function ensure(){
    if(panel||!document.body)return;
    panel=document.createElement('div');
    panel.id='dbgPanel';
    panel.style.cssText='position:fixed;right:8px;bottom:8px;width:min(360px,calc(100vw - 16px));max-height:45vh;z-index:99999;background:rgba(26,24,21,.95);border:1px solid #d97757;border-radius:8px;color:#e8dfce;font:10px/1.35 ui-monospace,Menlo,Consolas,monospace;display:flex;flex-direction:column;box-shadow:0 4px 16px rgba(0,0,0,.4);pointer-events:auto';
    var hdr=document.createElement('div');
    hdr.style.cssText='display:flex;align-items:center;gap:6px;padding:5px 8px;border-bottom:1px solid #3a352e;background:#22201c;border-radius:7px 7px 0 0;font-weight:600;font-size:11px;flex-shrink:0;-webkit-user-select:none;user-select:none';
    hdr.innerHTML='<span style="color:#d97757">◆</span><span>diag</span><span style="flex:1"></span><span id="dbgTog" style="cursor:pointer;padding:4px 8px;color:#8a8478">▾</span><span id="dbgClr" style="cursor:pointer;padding:4px 8px;color:#8a8478">clr</span><span id="dbgX" style="cursor:pointer;padding:4px 8px;color:#8a8478">×</span>';
    body=document.createElement('div');
    body.id='dbgBody';
    body.style.cssText='flex:1;overflow-y:auto;padding:6px 8px;-webkit-overflow-scrolling:touch';
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
const DZ={vault:[{id:'ideas',name:'Ideas',x:-1100,y:-500,w:700,h:520,color:'#6fa8d3'},{id:'projects',name:'Projects',x:-350,y:-500,w:700,h:520,color:'#c9896a'},{id:'inbox',name:'Inbox',x:400,y:-500,w:520,h:520,color:'#7d7569'}]};
const RMZ=[{id:'blockers',name:'Blockers',x:-1000,y:-500,w:600,h:400,color:'#d96b5a'},{id:'flight',name:'In Flight',x:-350,y:-500,w:600,h:400,color:'#6fa8d3'},{id:'next',name:'Next Up',x:300,y:-500,w:550,h:400,color:'#d4a855'},{id:'backlog',name:'Backlog',x:-1000,y:-70,w:600,h:400,color:'#8a8478'},{id:'done',name:'Done',x:-350,y:-70,w:600,h:400,color:'#7db36a'},{id:'principles',name:'Principles',x:300,y:-70,w:550,h:400,color:'#c48a9b'}];
const SH=['project','idea','principle','resource','question','experiment','library','doc','formula','note'],ST=['done','progress','pending','blocked','idea'];
const SC={done:'#7db36a',progress:'#6fa8d3',pending:'#d4a855',blocked:'#d96b5a',idea:'#8a8478'},SL={done:'Done',progress:'In Progress',pending:'Pending',blocked:'Blocked',idea:'Idea'};
const ET={blocker:{c:'#d96b5a',d:'',l:'Blocker'},feeds:{c:'#8a8478',d:'',l:'Feeds into'},related:{c:'#6fa8d3',d:'',l:'Related'},derived:{c:'#7db36a',d:'',l:'Derived from'},example:{c:'#e6c84e',d:'',l:'Example'},proof:{c:'#b85450',d:'',l:'Proof'},arrow:{c:'#e8dfce',d:'',l:'Arrow'},custom:{c:'#d97757',d:'',l:'Custom'}};
let S={canvases:{vault:{nodes:[],edges:[],zones:[]}},current:'vault',canvasMeta:{vault:{name:'Vault',parentNodeId:null}},nextId:1,hebrewMode:false};
let view={x:0,y:0,k:.5},hist=[],sel=null,drag=null,edgeHover=null,selSet=new Set(),marquee=null;
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
const zoneAt=(x,y)=>{for(const z of zs())if(x>=z.x&&x<=z.x+z.w&&y>=z.y&&y<=z.y+z.h)return z.id;return zs()[0].id};
const DB_NAME='ideaVault',DB_STORE='state';
let currentWs='workspace';
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
async function setCurrentWs(ws){await storageSet('vault3-current-ws',ws);currentWs=ws}
async function rebuildWsDropdown(){const list=await listWorkspaces();const sel=document.getElementById('wsSel');if(!sel)return;sel.innerHTML=list.map(w=>`<option value="${esc(w)}" ${w===currentWs?'selected':''}>${esc(w)}</option>`).join('')}
async function switchWorkspace(ws){await sv();await setCurrentWs(ws);S={canvases:{vault:{nodes:[],edges:[],zones:[]}},current:'vault',canvasMeta:{vault:{name:'Vault',parentNodeId:null}},nextId:1,hebrewMode:false};hist=[];selSet.clear();sel=null;await loadState();rebuildWsDropdown()}
async function newWorkspace(){const name=await uiPrompt('New workspace name','university',{hint:'e.g. university, life, research'});if(!name)return;const clean=name.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-');if(!clean)return;const list=await listWorkspaces();if(list.includes(clean)){await uiNotice('A workspace named "'+clean+'" already exists.');return}list.push(clean);await saveWorkspaces(list);await switchWorkspace(clean)}
async function loadState(){try{const v=await storageGet(KEY());if(v){const o=JSON.parse(v);S={...S,...o}}}catch(e){console.error('load',e)}reconcileCanvases();applyHebrewState();render();bF();bB();renderTabs();renderSB()}
async function load(){
  // Phase 1.7 · Item #8 — replaced the v1 full-width #bootLog banner
  // (green monospace across the viewport top) with a subtle bottom-right
  // toast() fired once at the end of load(). Failures go to the ◆ diag
  // panel via dbg() plus a red toast so the user still gets a visible
  // signal if something breaks during boot, without a giant banner in
  // their face on every page load.
  const step=(m,ok)=>{window.dbg&&window.dbg('SYS',(ok===false?'✗ ':'✓ ')+m)};
  step('load() started');
  try{currentWs=await getCurrentWs();step('getCurrentWs: '+currentWs)}catch(e){step('getCurrentWs FAIL: '+e.message,false);currentWs='workspace'}
  let list;try{list=await listWorkspaces();step('listWorkspaces: '+JSON.stringify(list))}catch(e){step('listWorkspaces FAIL: '+e.message,false);list=['workspace']}
  if(!list.includes(currentWs)){list.push(currentWs);try{await saveWorkspaces(list);step('saveWorkspaces OK')}catch(e){step('saveWorkspaces FAIL: '+e.message,false)}}
  try{const existing=await storageGet('vault3-workspace');if(!existing){const legacy=await storageGet('vault3');if(legacy){await storageSet('vault3-workspace',legacy)}}step('legacy migration done')}catch(e){step('migration FAIL: '+e.message,false)}
  let loadOk=true;
  try{await loadState();step('loadState OK — zones: '+(S.canvases?.vault?.zones?.length||0)+' nodes: '+(S.canvases?.vault?.nodes?.length||0))}catch(e){loadOk=false;step('loadState FAIL: '+e.message,false);try{reconcileCanvases();applyHebrewState();render();bF();bB();renderTabs();renderSB();step('fallback render OK')}catch(e2){step('fallback render FAIL: '+e2.message,false)}}
  try{rebuildWsDropdown();step('rebuildWsDropdown OK')}catch(e){step('rebuildWsDropdown FAIL: '+e.message,false)}
  step('load() complete');
  const totalNodes=Object.values(S.canvases||{}).reduce((n,c)=>n+(c.nodes?.length||0),0);
  toast(loadOk?('Loaded '+currentWs+' · '+totalNodes+' node'+(totalNodes===1?'':'s')):'Load failed — check diag',{kind:loadOk?'ok':'err',ms:loadOk?1500:3000});
}
async function sv(){const si=document.getElementById('saveInd');if(si)si.className='ind s-pend';try{const ok=await storageSet(KEY(),JSON.stringify(S));if(si)si.className=ok?'ind s-ok':'ind s-err'}catch(e){if(si){si.className='ind s-err';si.title='Save failed: '+e.message}}}
const T={
  en:{idea:'Idea',progress:'In Progress',pending:'Pending',blocked:'Blocked',done:'Done',
      project:'Project',question:'Question',experiment:'Experiment',principle:'Principle',resource:'Resource',library:'Library',doc:'Document',formula:'Formula',note:'Note',
      blocker:'Blocker',feeds:'Feeds into',related:'Related',derived:'Derived from',example:'Example',proof:'Proof',arrow:'Arrow',custom:'Custom',
      shapes:'Shapes',status:'Status',edges:'Edges',nodes:'Nodes',
      add:'+ Add',zone:'+ Zone',fit:'Fit',back:'← Back',more:'⋯ More',
      label:'Label',notes:'Description / Notes',rationale:'Why this placement',url:'URL',docUrl:'Document link',tags:'Tags',confidence:'Confidence (0–5)',shape:'Shape',zoneF:'Zone',latex:'LaTeX formula',noteBody:'Note body (Markdown)',
      save:'Save',close:'Close',del:'Delete',addedOn:'added',
      filterList:'Filter list…',searchCanvas:'Search canvas…',pasteUrl:'Paste URL…',
      newCanvas:'New canvas name:',newWs:'New workspace name (e.g. university, life):',
      exportAll:'Export all (full state)',exportThis:'Export this canvas',importAll:'Import full state',importThis:'Import into this canvas',pastePatch:'Paste patch',quickLink:'Quick-add from URL',dedupe:'Dedupe nodes',cleanOrphan:'Clean orphan canvases',clearCanvas:'Clear canvas',deleteWs:'Delete this workspace',
      mhExport:'Export',mhImport:'Import',mhUtil:'Utilities',mhWs:'Workspace',
      ctxEdge:'Edge',ctxZone:'Zone',changeTo:'Change to',deleteEdge:'Delete edge',unlockZ:'🔓 Unlock (allow move/resize)',lockZ:'🔒 Lock position',renameZ:'Rename',recolorZ:'Recolor',deleteZ:'Delete zone',addNodeHere:'+ Add node here',addZoneHere:'+ Add zone here',customLabel:'Label for this connection:',untitled:'Untitled',clearCanvasConfirm:'Clear current canvas?',deleteSelected:'Delete N selected nodes?',openRoadmap:'Open roadmap',createRoadmap:'+ Create roadmap',copyToVault:'Copy to vault',pullFromVault:'Pull from vault',copiedFromVault:'copied from vault'},
  he:{idea:'רעיון',progress:'בתהליך',pending:'ממתין',blocked:'חסום',done:'הושלם',
      project:'פרויקט',question:'שאלה',experiment:'ניסוי',principle:'עיקרון',resource:'משאב',library:'ספרייה',doc:'מסמך',formula:'נוסחה',note:'פתק',
      blocker:'חסימה',feeds:'מזין את',related:'קשור ל',derived:'נגזר מ',example:'דוגמה',proof:'הוכחה',arrow:'חץ',custom:'מותאם',
      shapes:'צורות',status:'מצב',edges:'קשרים',nodes:'נקודות',
      add:'+ הוסף',zone:'+ אזור',fit:'התאם',back:'חזרה →',more:'⋯ עוד',
      label:'כותרת',notes:'תיאור / הערות',rationale:'למה במיקום הזה',url:'קישור',docUrl:'קישור למסמך',tags:'תגיות',confidence:'ביטחון (0–5)',shape:'צורה',zoneF:'אזור',latex:'נוסחת LaTeX',noteBody:'גוף הפתק (Markdown)',
      save:'שמירה',close:'סגירה',del:'מחיקה',addedOn:'נוסף',
      filterList:'סנן רשימה…',searchCanvas:'חיפוש בקנבס…',pasteUrl:'הדבק קישור…',
      newCanvas:'שם הקנבס החדש:',newWs:'שם סביבה חדשה (לדוגמה: university, life):',
      exportAll:'יצוא הכול (מלא)',exportThis:'יצוא הקנבס הזה',importAll:'יבוא מצב מלא',importThis:'יבוא לקנבס הזה',pastePatch:'הדבק patch',quickLink:'הוספה מהירה מקישור',dedupe:'מחיקת כפילויות',cleanOrphan:'ניקוי קנבסים יתומים',clearCanvas:'נקה קנבס',deleteWs:'מחיקת הסביבה',
      mhExport:'יצוא',mhImport:'יבוא',mhUtil:'כלים',mhWs:'סביבה',
      ctxEdge:'קשר',ctxZone:'אזור',changeTo:'שנה ל',deleteEdge:'מחק קשר',unlockZ:'🔓 פתח (אפשר הזזה/שינוי גודל)',lockZ:'🔒 נעל מיקום',renameZ:'שנה שם',recolorZ:'שנה צבע',deleteZ:'מחק אזור',addNodeHere:'+ הוסף נקודה כאן',addZoneHere:'+ הוסף אזור כאן',customLabel:'תווית לקשר הזה:',untitled:'ללא כותרת',clearCanvasConfirm:'לנקות את הקנבס הנוכחי?',deleteSelected:'למחוק N נקודות שנבחרו?',openRoadmap:'פתח מפת דרכים',createRoadmap:'+ צור מפת דרכים',copyToVault:'העתק לוולט',pullFromVault:'משוך מהוולט',copiedFromVault:'הועתק מהוולט'}
};
function t(k){return T[S.hebrewMode?'he':'en'][k]||k}
function refreshUiText(){
  const map={addBtn:'add',zoneBtn:'zone',fitBtn:'fit',backBtn:'back',moreBtn:'more'};
  for(const[id,k]of Object.entries(map)){const el=document.getElementById(id);if(el)el.textContent=t(k)}
  const sr=document.getElementById('sr');if(sr)sr.placeholder=t('searchCanvas');
  const sbq=document.getElementById('sbq');if(sbq)sbq.placeholder=t('filterList');
  const sbn=document.getElementById('sbName');if(sbn)sbn.textContent=t('nodes');
  const more=document.getElementById('moreBody');if(more){more.innerHTML=`<div class="mh">${t('mhExport')}</div><button onclick="ex();flashInd('expInd');hideMore()">${t('exportAll')}</button><button onclick="exCanvas();flashInd('expInd');hideMore()">${t('exportThis')}</button><div class="msep"></div><div class="mh">${t('mhImport')}</div><label for="imp" onclick="window.dbg&&window.dbg('IMPORT','label[for=imp] tapped — browser should now forward click to #imp');hideMore()">${t('importAll')}</label><label for="impC" onclick="window.dbg&&window.dbg('IMPORT','label[for=impC] tapped');hideMore()">${t('importThis')}</label><button onclick="showPatch();hideMore()">${t('pastePatch')}</button><div class="msep"></div><div class="mh">${t('mhUtil')}</div><button onclick="quickLink();hideMore()">${t('quickLink')}</button><button onclick="dd();hideMore()">${t('dedupe')}</button><button onclick="cleanOrphanCanvases();hideMore()">${t('cleanOrphan')}</button><button onclick="clearCanvasConfirm();hideMore()" style="color:var(--block)">${t('clearCanvas')}</button><div class="msep"></div><div class="mh">${t('mhWs')}</div><button onclick="deleteCurrentWorkspace();hideMore()" style="color:var(--block)">${t('deleteWs')}</button>`}
  bF();renderSB();renderLegend();
}
async function toggleHebrew(){const on=!(S.hebrewMode);S.hebrewMode=on;document.body.classList.toggle('he',on);const btn=document.getElementById('heBtn');if(btn){btn.style.background=on?'var(--accent)':'';btn.style.color=on?'#1a1815':''}refreshUiText();sv();render()}
function applyHebrewState(){const on=!!S.hebrewMode;document.body.classList.toggle('he',on);const btn=document.getElementById('heBtn');if(btn){btn.style.background=on?'var(--accent)':'';btn.style.color=on?'#1a1815':''}refreshUiText();applyDimBtn()}
function toggleDimEdges(){S.dimEdges=!S.dimEdges;sv();applyDimBtn();render()}
function applyDimBtn(){const btn=document.getElementById('dimEdgesBtn');if(btn){btn.style.background=S.dimEdges?'var(--accent)':'';btn.style.color=S.dimEdges?'#1a1815':''}}
async function deleteCurrentWorkspace(){const list=await listWorkspaces();if(list.length<=1){await uiNotice('Cannot delete the last workspace.');return}if(!await uiConfirm(`Delete workspace "${currentWs}" and ALL its data? This cannot be undone.`,{title:'Delete workspace',danger:true,okLabel:'Delete'}))return;try{if('indexedDB' in window){const db=await idbOpen();const tx=db.transaction(DB_STORE,'readwrite').objectStore(DB_STORE);tx.delete(KEY())}}catch(e){}const newList=list.filter(w=>w!==currentWs);await saveWorkspaces(newList);await switchWorkspace(newList[0])}
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
function focusNode(id){const n=ns().find(x=>x.id===id);if(!n)return;const tx=-n.x,ty=-n.y;const steps=12;let i=0;const sx=view.x,sy=view.y;const anim=()=>{i++;const t=i/steps;view.x=sx+(tx-sx)*t;view.y=sy+(ty-sy)*t;render();if(i<steps)requestAnimationFrame(anim)};anim();sel=n;op(n)}
function cycleSb(){const sb=document.getElementById('sb');sb.classList.remove('mini');sb.classList.toggle('co')}
function sbHeadClick(e){const sb=document.getElementById('sb');if(sb.classList.contains('mini')){sb.classList.remove('mini')}}
function sbResize(e){e.preventDefault();const sb=document.getElementById('sb');const sx=e.clientX,ow=sb.offsetWidth;const mm=ev=>{sb.style.width=Math.max(200,Math.min(500,ow+ev.clientX-sx))+'px'};const mu=()=>{document.removeEventListener('pointermove',mm);document.removeEventListener('pointerup',mu)};document.addEventListener('pointermove',mm);document.addEventListener('pointerup',mu)}
function collapseAllZones(){if(!S.sbCollapse)S.sbCollapse={};const ck=S.current+':__';const allCollapsed=zs().every(z=>S.sbCollapse[S.current+':'+z.id]);for(const z of zs())S.sbCollapse[S.current+':'+z.id]=!allCollapsed;sv();renderSB()}
function renderTabs(){const t=document.getElementById('tabs');if(!t)return;let h='';for(const cid of Object.keys(S.canvases)){const name=S.canvasMeta[cid]?.name||cid;const cur=cid===S.current;const closeBtn=cid==='vault'?'':`<span class="x" onclick="event.stopPropagation();closeCanvas('${cid}')" title="Delete canvas">×</span>`;h+=`<div class="tab${cur?' cur':''}" onclick="switchTo('${cid}')" oncontextmenu="event.preventDefault();showTabCtx(event,'${cid}')">${esc(name)}${closeBtn}</div>`}h+='<div class="newtab" onclick="newTab()" title="New standalone canvas">＋</div>';t.innerHTML=h}
function positionCtx(x,y){ctx.style.left='-9999px';ctx.style.top='-9999px';ctx.style.display='block';requestAnimationFrame(()=>{const r=ctx.getBoundingClientRect();const W=innerWidth,H=innerHeight,pad=8;let nx=x,ny=y;if(x+r.width+pad>W)nx=Math.max(pad,x-r.width);if(y+r.height+pad>H)ny=Math.max(pad,y-r.height);ctx.style.left=nx+'px';ctx.style.top=ny+'px'})}
function showTabCtx(e,cid){const m=S.canvasMeta[cid]||{};
  const isLinked=!!m.parentNodeId;const linkLabel=isLinked?(S.hebrewMode?'חבר לפרויקט אחר':'Reconnect to project'):(S.hebrewMode?'חבר לפרויקט':'Connect to project');
  ctx.innerHTML=`<div class="csub">${esc(m.name||cid)}</div><button onclick="renameCanvas('${cid}');hideCtx()">${S.hebrewMode?'שנה שם':'Rename'}</button><button onclick="showProjectPicker('${cid}');hideCtx()">${esc(linkLabel)}</button>${isLinked?`<button onclick="unlinkCanvas('${cid}');hideCtx()">${S.hebrewMode?'נתק מפרויקט':'Unlink from project'}</button>`:''}${cid!=='vault'?`<div class="csep"></div><button onclick="hideCtx();closeCanvas('${cid}')" style="color:var(--block)">${S.hebrewMode?'מחק קנבס':'Delete canvas'}</button>`:''}`;positionCtx(e.clientX,e.clientY)}
async function renameCanvas(cid){const m=S.canvasMeta[cid];if(!m)return;const newName=await uiPrompt(S.hebrewMode?'שם חדש לקנבס':'Rename canvas',m.name||cid);if(!newName)return;sn();m.name=newName.trim();sv();renderTabs();bB()}
function unlinkCanvas(cid){const m=S.canvasMeta[cid];if(!m||!m.parentNodeId)return;sn();const pn=S.canvases[m.parentCanvas||'vault']?.nodes.find(n=>n.id===m.parentNodeId);if(pn)pn.childCanvas=null;m.parentNodeId=null;sv();render();renderTabs()}
function showProjectPicker(cid){modal.classList.add('on');const projectNodes=[];for(const[ck,cv2]of Object.entries(S.canvases)){if(ck===cid)continue;for(const n of cv2.nodes||[]){if(n.shape==='project')projectNodes.push({n,canvasId:ck,canvasName:S.canvasMeta[ck]?.name||ck})}}
  document.getElementById('mcbody').innerHTML=`<h3>${S.hebrewMode?'בחר צומת פרויקט להתחבר אליו':'Choose project node to connect to'}</h3><input id="ppQ" placeholder="${esc(S.hebrewMode?'חיפוש…':'Search…')}" oninput="renderProjectPicker('${cid}')" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);margin-bottom:10px"/><div class="plist" id="ppL"></div><div class="brow"><button onclick="closeModal()">${t('close')}</button></div>`;
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
function sn(){hist.push(JSON.stringify(S));if(hist.length>40)hist.shift()}
function un(){if(!hist.length)return;S=JSON.parse(hist.pop());const sid=sel?.id;sel=sid?ns().find(n=>n.id===sid):null;sv();render();bF();bB();sel?op(sel):cp()}
function bB(){const chain=[];let c2=S.current;while(c2){chain.unshift({id:c2,name:S.canvasMeta[c2]?.name||c2});const p=S.canvasMeta[c2]?.parentCanvas;c2=p||null}
  const backBtn=document.getElementById('backBtn');if(backBtn){if(chain.length>1){backBtn.style.display='inline-block';backBtn.setAttribute('data-parent',chain[chain.length-2].id)}else{backBtn.style.display='none'}}
  bc.innerHTML=chain.map((n,i)=>i===chain.length-1?`<span class="cur">${esc(n.name)}</span>`:`<a onclick="switchTo('${n.id}')">${esc(n.name)}</a><span style="color:var(--muted)">›</span>`).join(' ')}
function goBack(){const p=document.getElementById('backBtn').getAttribute('data-parent');if(p)switchTo(p)}
function switchTo(id){if(!S.canvases[id])return;S.current=id;sel=null;cp();view={x:0,y:0,k:.5};sv();render();bF();bB();renderTabs();renderSB();zF()}
function render(){
  const W=Math.max(innerWidth||document.documentElement.clientWidth||800,400),H=Math.max(innerHeight||document.documentElement.clientHeight||600,400);
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
  let visIds=null;
  if(window.RBush&&ns().length>=100){
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
  for(const e of es()){const a=ns().find(n=>n.id===e.from),b=ns().find(n=>n.id===e.to);if(!a||!b)continue;const et=ET[e.type]||ET.feeds;
    const rA=46,rB=46;const dx0=b.x-a.x,dy0=b.y-a.y,d0=Math.hypot(dx0,dy0)||1;
    const ax=a.x+dx0/d0*rA,ay=a.y+dy0/d0*rA,bx=b.x-dx0/d0*rB,by=b.y-dy0/d0*rB;
    const dx=bx-ax,dy=by-ay;const horiz=Math.abs(dx)>Math.abs(dy);const off=Math.min(Math.abs(horiz?dx:dy)*0.75,240);
    const c1x=horiz?ax+Math.sign(dx)*off:ax,c1y=horiz?ay:ay+Math.sign(dy)*off;
    const c2x=horiz?bx-Math.sign(dx)*off:bx,c2y=horiz?by:by-Math.sign(dy)*off;
    const edgeFocus=focusMode&&(e.from===sel.id||e.to===sel.id);
    const edgeDim=dimE||(focusMode&&!edgeFocus);
    const edgeOpacity=edgeDim?(focusMode?0.08:0.18):1;
    const showEdgeLabel=!dimE&&view.k>0.4&&(!focusMode||edgeFocus);
    h+=`<path class="edge ${e.dim?'dim':''}" data-edge="${e.id}" d="M ${ax},${ay} C ${c1x},${c1y} ${c2x},${c2y} ${bx},${by}" fill="none" stroke="${et.c}" stroke-width="2.5" marker-end="url(#a-${e.type||'feeds'})" opacity="${edgeOpacity}"/>`;
    if(showEdgeLabel){const lbl=e.customLabel||t(e.type||'feeds');const mx=(ax+3*c1x+3*c2x+bx)/8,my=(ay+3*c1y+3*c2y+by)/8;const labelRtl=/[\u0590-\u05FF]/.test(lbl);const fsize=labelRtl?12:10;h+=`<foreignObject x="${mx-60}" y="${my-11}" width="120" height="22" style="pointer-events:none"><div xmlns="http://www.w3.org/1999/xhtml" style="direction:${labelRtl?'rtl':'ltr'};text-align:center;font-family:'Inter','Assistant',system-ui,sans-serif;font-size:${fsize}px;color:${et.c};background:var(--bg);border:1px solid ${et.c};border-radius:3px;padding:2px 5px;display:inline-block;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:500">${esc(lbl)}</div></foreignObject>`}}
  for(const n of ns()){if(visIds&&!visIds.has(n.id))continue;const c=SC[n.status]||SC.idea,s=42,se=sel?.id===n.id||selSet.has(n.id),tg=edgeHover?.id===n.id;const focusDim=focusMode&&!related.has(n.id);let sh='',ring='',richContent='';
    // D5 · Phase 1.6 — shape SVG strings are unchanged (world coords via n.x /
    // n.y). At the bottom of the loop each slice wraps them in a
    // <g transform="translate(-n.x,-n.y)"> so the same markup lives inside a
    // per-node div positioned at world (n.x, n.y). Cross-layer z-stacking is
    // fixed because every node's shape + content travel together.
    if(n.shape==='project'){const pts=[];for(let i=0;i<10;i++){const ang=-Math.PI/2+i*Math.PI/5;const r=i%2===0?s:s*.5;pts.push((n.x+r*Math.cos(ang))+','+(n.y+r*Math.sin(ang)))}sh=`<polygon points="${pts.join(' ')}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s+6}"/>`}
    else if(n.shape==='library'){sh=`<rect x="${n.x-s}" y="${n.y-s*.65}" width="${s*2}" height="${s*1.3}" rx="3" fill="${c}" stroke="rgba(255,255,255,.18)"/><line x1="${n.x-s*.5}" y1="${n.y-s*.55}" x2="${n.x-s*.5}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><line x1="${n.x}" y1="${n.y-s*.55}" x2="${n.x}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/><line x1="${n.x+s*.5}" y1="${n.y-s*.55}" x2="${n.x+s*.5}" y2="${n.y+s*.55}" stroke="rgba(0,0,0,.3)" stroke-width="2"/>`;if(se||tg)ring=`<rect class="ring" x="${n.x-s-4}" y="${n.y-s*.65-4}" width="${s*2+8}" height="${s*1.3+8}" rx="5"/>`}
    else if(n.shape==='principle'){sh=`<polygon points="${n.x},${n.y-s*.9} ${n.x+s*.9},${n.y} ${n.x},${n.y+s*.9} ${n.x-s*.9},${n.y}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.9-5} ${n.x+s*.9+5},${n.y} ${n.x},${n.y+s*.9+5} ${n.x-s*.9-5},${n.y}"/>`}
    else if(n.shape==='resource'){sh=`<polygon points="${n.x-s*.45},${n.y-s*.65} ${n.x+s*.45},${n.y-s*.65} ${n.x+s*.9},${n.y} ${n.x+s*.45},${n.y+s*.65} ${n.x-s*.45},${n.y+s*.65} ${n.x-s*.9},${n.y}" fill="${c}" stroke="rgba(255,255,255,.18)"/>`;if(se||tg)ring=`<circle class="ring" cx="${n.x}" cy="${n.y}" r="${s*.95}"/>`}
    else if(n.shape==='question'){sh=`<polygon points="${n.x},${n.y-s*.85} ${n.x+s*.85},${n.y-s*.05} ${n.x+s*.55},${n.y+s*.75} ${n.x-s*.55},${n.y+s*.75} ${n.x-s*.85},${n.y-s*.05}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+8}" font-size="24" font-weight="700" fill="#1a1815" text-anchor="middle">?</text>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.85-5} ${n.x+s*.85+5},${n.y-s*.05} ${n.x+s*.55+3},${n.y+s*.75+5} ${n.x-s*.55-3},${n.y+s*.75+5} ${n.x-s*.85-5},${n.y-s*.05}"/>`}
    else if(n.shape==='experiment'){sh=`<polygon points="${n.x},${n.y-s*.85} ${n.x+s*.8},${n.y+s*.65} ${n.x-s*.8},${n.y+s*.65}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+s*.35}" font-size="18" text-anchor="middle">⚗</text>`;if(se||tg)ring=`<polygon class="ring" points="${n.x},${n.y-s*.85-6} ${n.x+s*.8+6},${n.y+s*.65+3} ${n.x-s*.8-6},${n.y+s*.65+3}"/>`}
    else if(n.shape==='doc'){const w2=s*.7,h2=s*.85;sh=`<path d="M ${n.x-w2} ${n.y-h2} L ${n.x+w2-12} ${n.y-h2} L ${n.x+w2} ${n.y-h2+12} L ${n.x+w2} ${n.y+h2} L ${n.x-w2} ${n.y+h2} Z" fill="${c}" stroke="rgba(255,255,255,.18)"/><path d="M ${n.x+w2-12} ${n.y-h2} L ${n.x+w2-12} ${n.y-h2+12} L ${n.x+w2} ${n.y-h2+12}" fill="none" stroke="rgba(0,0,0,.3)"/><line x1="${n.x-w2*.6}" y1="${n.y-h2*.3}" x2="${n.x+w2*.6}" y2="${n.y-h2*.3}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><line x1="${n.x-w2*.6}" y1="${n.y}" x2="${n.x+w2*.6}" y2="${n.y}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/><line x1="${n.x-w2*.6}" y1="${n.y+h2*.3}" x2="${n.x+w2*.4}" y2="${n.y+h2*.3}" stroke="rgba(0,0,0,.3)" stroke-width="1.5"/>`;if(se||tg)ring=`<rect class="ring" x="${n.x-w2-4}" y="${n.y-h2-4}" width="${w2*2+8}" height="${h2*2+8}" rx="4"/>`}
    else if(n.shape==='formula'){
      if(n.compact){
        // compact: small node with formula glyph + label below (handled by showLabel logic)
        sh=`<circle cx="${n.x}" cy="${n.y}" r="${s*.7}" fill="${c}" stroke="rgba(255,255,255,.18)"/><text x="${n.x}" y="${n.y+12}" font-size="36" text-anchor="middle" fill="#1a1815" font-style="italic" font-family="Source Serif 4,serif" font-weight="700">ƒ</text>`;
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
    const lbl=(n.label||'').length>26?n.label.slice(0,24)+'…':(n.label||'');
    const portal=n.childCanvas?`<text x="${n.x+s-6}" y="${n.y-s*.45}" font-size="14" fill="var(--accent)">↗</text>`:'';
    const linkGlyph=n.url?`<text x="${n.x}" y="${n.y+4}" font-size="13" text-anchor="middle" fill="rgba(26,24,21,.85)" font-weight="700">🔗</text>`:'';
    const conf=n.confidence?`<rect x="${n.x-s*.8}" y="${n.y+s+22}" width="${s*1.6*(n.confidence/5)}" height="3" fill="${n.confidence>=4?SC.done:n.confidence>=2?SC.pend:SC.blocked}" rx="1"/>`:'';
    const hitR=drag?.k==='edge'?s+30:s+6;
    const rtl=/[\u0590-\u05FF]/.test(n.label||'');
    const isCompactFormula=n.shape==='formula'&&n.compact;
    const showLabel=view.k>0.28&&(!['formula','note'].includes(n.shape)||isCompactFormula);
    const isBigShape=(n.shape==='formula'&&!n.compact)||n.shape==='note';
    const hitRect=isBigShape?`<rect class="th" x="${n.x-(n._w||100)}" y="${n.y-(n._h||60)}" width="${(n._w||100)*2}" height="${(n._h||60)*2}" rx="6" fill="transparent"/>`:`<circle class="th" cx="${n.x}" cy="${n.y}" r="${hitR}"/>`;
    // Outer SVG: just an invisible hit target wrapped in <g.node data-id> so
    // the existing closest('.node') event delegation keeps routing drags.
    h+=`<g class="node" data-id="${n.id}">${hitRect}</g>`;
    // Overlay: per-node slice at world (n.x, n.y) containing the visible
    // shape, ring, glyphs, SVG text label, plus rich HTML content. The inner
    // <g transform="translate(-n.x,-n.y)"> pulls world-coord shape markup
    // back to the slice's local origin so shape-gen code stays unchanged.
    const dimCls=(n.dim||focusDim)?' dim':'';
    const tgtCls=tg?' tgt':'';
    const svgLabel=showLabel?`<text x="${n.x}" y="${n.y+s+16}" direction="${rtl?'rtl':'ltr'}">${esc(lbl)}</text>`:'';
    const glyphs=(['resource','library'].includes(n.shape)?linkGlyph:'')+portal+conf+svgLabel;
    oh+=`<div class="nslice${dimCls}${tgtCls}" data-nid="${n.id}" style="left:${n.x}px;top:${n.y}px">`
      +`<svg class="nshape" width="1" height="1" style="overflow:visible">`
      +`<g transform="translate(${-n.x},${-n.y})">${ring}${sh}${glyphs}</g>`
      +`</svg>${richContent}</div>`;
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
}
function bF(){const mode=S.filterMode||'zone';const otherMode=mode==='zone'?'status':'zone';const switchLabel=S.hebrewMode?(mode==='zone'?'אזורים ⇄ מצב':'מצב ⇄ אזורים'):(mode==='zone'?'Zones ⇄ Status':'Status ⇄ Zones');let h=`<span class="pill mode" onclick="switchFilterMode()" style="background:var(--accent);color:#1a1815;font-weight:600;cursor:pointer">${switchLabel}</span>`;if(mode==='zone'){zs().forEach(z=>h+=`<span class="pill on" data-f="zone:${z.id}" onclick="tF(this)" ondblclick="soloF(this)">${esc(z.name)}</span>`)}else{ST.forEach(s=>h+=`<span class="pill on" data-f="status:${s}" onclick="tF(this)" ondblclick="soloF(this)">${esc(t(s))}</span>`)}document.getElementById('fl').innerHTML=h}
function switchFilterMode(){S.filterMode=S.filterMode==='status'?'zone':'status';sv();bF();aF()}
function renderLegend(){const lg=document.getElementById('lgBody');if(!lg)return;lg.innerHTML=`<h4>${t('shapes')}</h4><div class="row">★ ${t('project')} ● ${t('idea')} ◆ ${t('principle')}</div><div class="row">⬣ ${t('resource')} ? ${t('question')} ⚗ ${t('experiment')} ▭ ${t('library')} ▤ ${t('doc')}</div><h4>${t('status')}</h4><div class="row"><span class="sw" style="background:var(--done)"></span>${t('done')}</div><div class="row"><span class="sw" style="background:var(--prog)"></span>${t('progress')}</div><div class="row"><span class="sw" style="background:var(--pend)"></span>${t('pending')}</div><div class="row"><span class="sw" style="background:var(--block)"></span>${t('blocked')}</div><div class="row"><span class="sw" style="background:var(--idea)"></span>${t('idea')}</div><h4>${t('edges')}</h4><div class="row" style="color:var(--block)">━ ${t('blocker')}</div><div class="row" style="color:var(--muted)">━ ${t('feeds')}</div><div class="row" style="color:var(--prog)">━ ${t('related')}</div><div class="row" style="color:var(--done)">━ ${t('derived')}</div><div class="row" style="color:var(--text2)">━ ${t('arrow')}</div>`}
function tF(el){el.classList.toggle('on');aF()}
function soloF(el){const all=document.querySelectorAll('#fl .pill');const wasOff=!el.classList.contains('on');const onlyMeOn=el.classList.contains('on')&&[...all].every(p=>p===el||!p.classList.contains('on'));if(onlyMeOn){all.forEach(p=>p.classList.add('on'))}else{all.forEach(p=>p.classList.remove('on'));el.classList.add('on')}aF()}
function aF(){const zonePresent=document.querySelector('#fl .pill[data-f^="zone:"]')!==null;const statusPresent=document.querySelector('#fl .pill[data-f^="status:"]')!==null;const a=new Set([...document.querySelectorAll('.pill.on')].map(p=>p.dataset.f));const q=document.getElementById('sr').value.toLowerCase();ns().forEach(n=>{const zOk=!zonePresent||a.has('zone:'+n.zone);const sOk=!statusPresent||a.has('status:'+n.status);const qOk=!q||((n.label||'')+(n.notes||'')+(n.tags||'')+(n.rationale||'')).toLowerCase().includes(q);n.dim=!(zOk&&sOk&&qOk)});const k=new Set(ns().filter(n=>!n.dim).map(n=>n.id));es().forEach(e=>e.dim=!(k.has(e.from)&&k.has(e.to)));render()}
function addNode(x,y,d={},skip){if(!skip)sn();const id=S.nextId++;const n={label:'New',notes:'',tags:'',rationale:'',shape:'idea',status:'idea',url:'',docUrl:'',originId:null,childCanvas:null,confidence:null,latex:'',color:null,compact:false,...d,id,x,y,zone:d.zone||zoneAt(x,y),created:d.created||new Date().toISOString().slice(0,10)};ns().push(n);sv();render();renderSB();return n}
function addC(){const w=s2w(innerWidth/2,innerHeight/2);const n=addNode(w.x,w.y);sel=n;op(n)}
function delN(id){sn();C().nodes=ns().filter(n=>n.id!==id);C().edges=es().filter(e=>e.from!==id&&e.to!==id);if(sel?.id===id)cp();sv();render();renderSB()}
function delE(id){sn();C().edges=es().filter(e=>e.id!==id);sv();render()}
function clr(){C().nodes=[];C().edges=[];cp();sv();render()}
function dd(){sn();const sx=new Set();C().nodes=ns().filter(n=>{const k=(n.label||'').trim().toLowerCase();if(!k||sx.has(k))return false;sx.add(k);return true});const ids=new Set(ns().map(n=>n.id));C().edges=es().filter(e=>ids.has(e.from)&&ids.has(e.to));sv();render()}
function fromU(){const u=document.getElementById('urlIn').value.trim();if(!u)return;let lbl=u;const z=(zs().find(x=>x.id==='inbox')||zs()[zs().length-1]).id;try{const p=new URL(u),seg=p.pathname.split('/').filter(Boolean);lbl=(seg[seg.length-1]||p.hostname).replace(/[-_]/g,' ').slice(0,40)}catch(e){}const w=s2w(innerWidth/2,innerHeight/2);const n=addNode(w.x,w.y,{label:lbl,url:u,shape:'resource',zone:z});document.getElementById('urlIn').value='';sel=n;op(n)}
function op(n){sel=n;pn.style.display='block';
  const isFormula=n.shape==='formula',isNote=n.shape==='note';
  const up=(!isFormula&&!isNote&&n.url)?`<a class="urp" href="${esc(n.url)}" target="_blank" rel="noopener">↗ ${esc(n.url.replace(/^https?:\/\//,'').slice(0,42))}</a>`:'';
  const docLink=(!isFormula&&!isNote&&n.docUrl)?`<a class="urp" href="${esc(n.docUrl)}" target="_blank" rel="noopener" style="margin-left:6px">📄 ${esc(n.docUrl.replace(/^https?:\/\//,'').slice(0,36))}</a>`:'';
  const originBadge=n.originId?`<div class="origin">↙ ${t('copiedFromVault')}</div>`:'';
  const portalBtn=n.shape==='project'?(n.childCanvas?`<button onclick="switchTo('${n.childCanvas}')">${esc(t('openRoadmap'))}</button>`:`<button onclick="createRoadmap(${n.id})">${esc(t('createRoadmap'))}</button>`):'';
  const copyBtn=S.current!=='vault'?`<button onclick="copyBackToVault(${n.id})">${esc(t('copyToVault'))}</button>`:'';
  const pullBtn=S.current!=='vault'?`<button onclick="showPullPicker()">${esc(t('pullFromVault'))}</button>`:'';
  const zoneName=zs().find(z=>z.id===n.zone)?.name||n.zone;
  const formulaPreview=isFormula?`<div id="latexPreview" style="background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:14px;margin:6px 0;text-align:center;min-height:50px"></div>`:'';
  const compactToggle=isFormula?`<label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input id="f_compact" type="checkbox" ${n.compact?'checked':''}/>${S.hebrewMode?'תצוגה מצומצמת (כצומת רגיל)':'Compact view (as regular node)'}</label>`:'';
  const colorPicker=(isNote||isFormula)?`<label>${S.hebrewMode?'צבע':'Color'}</label><div style="display:flex;gap:6px;align-items:center"><input id="f_color" type="color" value="${n.color||(isNote?'#d4a855':'#22201c')}" style="width:50px;height:32px;background:transparent;border:1px solid var(--border);border-radius:6px;cursor:pointer"/><button onclick="document.getElementById('f_color').value='';sP()" style="font-size:11px">${S.hebrewMode?'איפוס':'Reset'}</button></div>`:'';
  const urlFields=(!isFormula&&!isNote)?`<label>${t('url')}</label><input id="f_url" value="${esc(n.url)}" placeholder="https://…"/>
    <label>${t('docUrl')}</label><input id="f_docUrl" value="${esc(n.docUrl||'')}" placeholder="Google Drive / Notion / Dropbox…"/>`:'';
  const latexField=isFormula?`<label>${t('latex')}</label><textarea id="f_latex" oninput="updateLatexPreview()" style="font-family:monospace;font-size:12px">${esc(n.latex||'')}</textarea>${formulaPreview}`:'';
  const notesField=isNote?`<label>${t('noteBody')}</label><textarea id="f_notes" style="min-height:140px">${esc(n.notes)}</textarea>`:`<label>${t('notes')}</label><textarea id="f_notes">${esc(n.notes)}</textarea>`;
  pn.innerHTML=`<button class="pn-close" onclick="cp()" aria-label="Close">&times;</button><h2>${esc(n.label||t('untitled'))}</h2><div class="meta">${esc(t(n.status))} · ${esc(zoneName)} · ${t('addedOn')} ${n.created}</div>${up}${docLink}${originBadge}
    <label>${t('label')}</label><input id="f_label" value="${esc(n.label)}"/>
    ${latexField}
    ${compactToggle}
    ${notesField}
    ${isNote?'':`<label>${t('rationale')}</label><textarea id="f_rationale">${esc(n.rationale)}</textarea>`}
    ${urlFields}
    ${colorPicker}
    <label>${t('tags')}</label><input id="f_tags" value="${esc(n.tags)}"/>
    <label>${t('confidence')}</label><input id="f_conf" type="number" min="0" max="5" step="1" value="${n.confidence||''}"/>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
    <div><label>${t('shape')}</label><select id="f_shape">${SH.map(s=>`<option value="${s}" ${s===n.shape?'selected':''}>${esc(t(s))}</option>`).join('')}</select></div>
    <div><label>${t('status')}</label><select id="f_status">${ST.map(s=>`<option value="${s}" ${s===n.status?'selected':''}>${esc(t(s))}</option>`).join('')}</select></div></div>
    <label>${t('zoneF')}</label><select id="f_zone">${zs().map(z=>`<option value="${z.id}" ${z.id===n.zone?'selected':''}>${esc(z.name)}</option>`).join('')}</select>
    <div class="brow"><button class="pr" onclick="sP()">${t('save')}</button><button onclick="cp()">${t('close')}</button><button class="dn" onclick="delN(${n.id})">${t('del')}</button></div>
    ${portalBtn||copyBtn||pullBtn?`<div class="brow">${portalBtn}${copyBtn}${pullBtn}</div>`:''}`;
  if(isFormula)updateLatexPreview();
  render()}
function updateLatexPreview(){const el=document.getElementById('latexPreview'),src=document.getElementById('f_latex');if(!el||!src||!window.katex)return;try{katex.render(src.value||'\\\\text{(empty)}',el,{throwOnError:false,displayMode:true,strict:'ignore'})}catch(e){el.textContent='⚠ '+e.message}}
function sP(){if(!sel)return;sn();const n=sel;n.label=document.getElementById('f_label').value;
  const fn=document.getElementById('f_notes');if(fn)n.notes=fn.value;
  const fr=document.getElementById('f_rationale');if(fr)n.rationale=fr.value;
  const fu=document.getElementById('f_url');if(fu)n.url=fu.value;
  const fd=document.getElementById('f_docUrl');if(fd)n.docUrl=fd.value;
  const fl=document.getElementById('f_latex');if(fl)n.latex=fl.value;
  const fcomp=document.getElementById('f_compact');if(fcomp)n.compact=fcomp.checked;
  const fcol=document.getElementById('f_color');if(fcol)n.color=fcol.value||null;
  n.tags=document.getElementById('f_tags').value;n.shape=document.getElementById('f_shape').value;n.status=document.getElementById('f_status').value;n.zone=document.getElementById('f_zone').value;n.confidence=document.getElementById('f_conf').value?parseInt(document.getElementById('f_conf').value):null;sv();render();renderSB();op(n)}
function cp(){sel=null;pn.style.display='none';render()}
function createRoadmap(nid){const n=ns().find(x=>x.id===nid);if(!n)return;const cid='rm-'+nid;if(S.canvases[cid])return switchTo(cid);sn();S.canvases[cid]={nodes:[],edges:[],zones:JSON.parse(JSON.stringify(RMZ))};S.canvasMeta[cid]={name:n.label+' › Roadmap',parentNodeId:n.id,parentCanvas:S.current};n.childCanvas=cid;sv();switchTo(cid)}
function copyBackToVault(nid){const n=ns().find(x=>x.id===nid);if(!n)return;sn();const fromCanvas=S.current;S.current='vault';const w=s2w(innerWidth/2,innerHeight/2);addNode(w.x,w.y,{...n,id:undefined,originId:n.id,childCanvas:null},true);S.current=fromCanvas;sv();uiNotice('Copied to vault.')}
function copyToCanvas(nid,cid){const vn=S.canvases.vault.nodes.find(x=>x.id===nid);if(!vn)return;sn();const prev=S.current;S.current=cid;const z=zs()[0];const x=z.x+60+Math.random()*(z.w-140),y=z.y+70+Math.random()*(z.h-140);addNode(x,y,{...vn,id:undefined,originId:vn.id,zone:z.id,childCanvas:null},true);S.current=prev;sv();render()}
function showPullPicker(){const cid=S.current;const items=S.canvases.vault.nodes;modal.classList.add('on');document.getElementById('mcbody').innerHTML=`<h3>Pull from vault</h3><p>Pick a node to copy into this roadmap</p><input id="pq" placeholder="Filter…" oninput="renderPull('${cid}')" style="width:100%;background:var(--bg2);border:1px solid var(--border);border-radius:7px;padding:8px 10px;color:var(--text);margin-bottom:10px"/><div class="plist" id="pl"></div><div class="brow"><button onclick="closeModal()">Close</button></div>`;renderPull(cid)}
function renderPull(cid){const q=(document.getElementById('pq')?.value||'').toLowerCase();const items=S.canvases.vault.nodes.filter(n=>!q||(n.label||'').toLowerCase().includes(q));document.getElementById('pl').innerHTML=items.map(n=>`<div class="pitem" onclick="copyToCanvas(${n.id},'${cid}');closeModal()"><b>${esc(n.label)}</b><span style="color:var(--muted);font-size:11px"> · ${S.canvases.vault.zones.find(z=>z.id===n.zone)?.name||''}</span></div>`).join('')||'<div style="color:var(--muted);font-size:12px">No matches</div>'}
function closeModal(){modal.classList.remove('on')}
function showPatch(){modal.classList.add('on');document.getElementById('mcbody').innerHTML=`<h3>Paste patch</h3><p>Paste JSON from Claude: <code style="background:var(--bg2);padding:1px 4px;border-radius:3px">{"canvasId":"vault","nodes":[...],"edges":[...]}</code>. Nodes need label; other fields optional. Edges use label references (from/to = label) or IDs.</p><textarea id="pt" placeholder='{"canvasId":"vault","nodes":[{"label":"Example","zone":"inbox","shape":"idea","status":"idea","rationale":"why it is here"}],"edges":[]}'></textarea><div class="brow"><button class="pr" onclick="applyPatch()">Apply</button><button onclick="closeModal()">Cancel</button></div>`}
async function applyPatch(){try{const raw=JSON.parse(document.getElementById('pt').value);if(raw.patches&&Array.isArray(raw.patches)){sn();let ok=0;for(const p of raw.patches){try{document.getElementById('pt').value=JSON.stringify(p);await applyPatchSingle(p);ok++}catch(e){console.error('patch failed:',p.canvasId,e)}}closeModal();await uiNotice('Applied '+ok+'/'+raw.patches.length+' patches.');return}sn();await applyPatchSingle(raw);closeModal()}catch(err){await uiNotice('Parse error: '+err.message,{title:'Patch failed'})}}
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
  const prev=S.current;S.current=cid;if(p.zones){if(p.replaceZones)C().zones=[];for(const z of p.zones){if(!C().zones.find(x=>x.id===z.id))C().zones.push(z)}}
  const added={};for(const nd of(p.nodes||[])){const z=zs().find(x=>x.id===nd.zone)||zs()[0];const x=nd.x!==undefined?nd.x:z.x+60+Math.random()*(z.w-140),y=nd.y!==undefined?nd.y:z.y+70+Math.random()*(z.h-140);const n=addNode(x,y,nd,true);added[nd.label]=n.id}
  for(const e of(p.edges||[])){const fi=typeof e.from==='number'?e.from:added[e.from]||ns().find(n=>n.label===e.from)?.id;const ti=typeof e.to==='number'?e.to:added[e.to]||ns().find(n=>n.label===e.to)?.id;if(fi&&ti)es().push({id:S.nextId++,from:fi,to:ti,type:e.type||'feeds',customLabel:e.customLabel||null})}
  S.current=prev;sv();render();bF();bB();renderTabs();renderSB();if(p.switchTo)switchTo(cid)}
function showCtx(x,y,n){
  const rmList=Object.entries(S.canvasMeta).filter(([k,m])=>k!==S.current&&k!=='vault').map(([k,m])=>`<button onclick="copyToCanvas(${n.id},'${k}');hideCtx()">→ ${S.hebrewMode?'העתק אל':'Copy to'} ${esc(m.name)}</button>`).join('');
  const compactBtn=n.shape==='formula'?`<button onclick="sF(${n.id},'compact',${!n.compact})">${n.compact?(S.hebrewMode?'הצג מורחב (מלבן עם נוסחה)':'Show expanded (rectangle + math)'):(S.hebrewMode?'הצג מצומצם (כצומת רגיל)':'Show compact (regular node)')}</button>`:'';
  ctx.innerHTML=`<div class="csub">${t('shape')}</div>${SH.map(s=>`<button onclick="sF(${n.id},'shape','${s}')">${esc(t(s))}${n.shape===s?' ✓':''}</button>`).join('')}${compactBtn?'<div class="csep"></div>'+compactBtn:''}<div class="csep"></div><div class="csub">${t('status')}</div>${ST.map(s=>`<button onclick="sF(${n.id},'status','${s}')"><span style="display:inline-block;width:10px;height:10px;background:${SC[s]};border-radius:2px;margin-right:6px;vertical-align:middle"></span>${esc(t(s))}${n.status===s?' ✓':''}</button>`).join('')}<div class="csep"></div><button onclick="hideCtx();op(ns().find(x=>x.id===${n.id}))">${S.hebrewMode?'ערוך פרטים…':'Edit details…'}</button>${n.shape==='project'&&S.current==='vault'?(n.childCanvas?`<button onclick="hideCtx();switchTo('${n.childCanvas}')">↗ ${t('openRoadmap')}</button>`:`<button onclick="hideCtx();createRoadmap(${n.id})">${t('createRoadmap')}</button>`):''}${rmList?'<div class="csep"></div>'+rmList:''}<div class="csep"></div><button onclick="hideCtx();delN(${n.id})" style="color:var(--block)">${t('del')}</button>`;
  positionCtx(x,y);}
function hideCtx(){ctx.style.display='none'}
function sF(id,f,v){sn();const n=ns().find(x=>x.id===id);if(n){n[f]=v;sv();render();if(sel?.id===id)op(n)}hideCtx()}
document.addEventListener('click',e=>{if(!ctx.contains(e.target))hideCtx();if(!ep.contains(e.target))ep.style.display='none'});
function etLabel(k){return t(k)||(ET[k]?.l)||k}
function showEdgePicker(sx,sy,fromId,toId){ep.style.display='block';ep.style.left=sx+'px';ep.style.top=sy+'px';ep.innerHTML=Object.entries(ET).map(([k,v])=>`<button onclick="${k==='custom'?`createCustomEdge(${fromId},${toId})`:`createEdge(${fromId},${toId},'${k}')`}"><span class="sw" style="background:${v.c}"></span>${esc(etLabel(k))}</button>`).join('')}
async function createCustomEdge(f,toId){const lbl=await uiPrompt(t('customLabel'),'');if(!lbl)return;sn();es().push({id:S.nextId++,from:f,to:toId,type:'custom',customLabel:lbl});ep.style.display='none';sv();render()}
function createEdge(f,t,ty){sn();es().push({id:S.nextId++,from:f,to:t,type:ty});ep.style.display='none';sv();render()}
const TH=4;
/* === UNIFIED POINTER INPUT (mouse + finger + Apple Pencil) === */
const activePtrs=new Map();
let pinchState=null;
let longPressTimer=null;
let lastTapTime=0,lastTapX=0,lastTapY=0;

function beginInteraction(e){
  const nrz=e.target.closest('.nrz');const nE=e.target.closest('.node'),zH=e.target.closest('.zh'),zE=e.target.closest('.zd'),w=s2w(e.clientX,e.clientY);const mod=e.ctrlKey||e.metaKey;
  if(nrz){const id=+nrz.dataset.nrz;const n=ns().find(x=>x.id===id);if(n){sn();drag={k:'nresize',n,sx:e.clientX,sy:e.clientY,ow:n._w||100,oh:n._h||60}}return}
  if(nE){const n=ns().find(x=>x.id===+nE.dataset.id);
    if(mod){if(selSet.has(n.id))selSet.delete(n.id);else selSet.add(n.id);render();drag=null;return}
    if(e.shiftKey){drag={k:'edge',from:n,sx:e.clientX,sy:e.clientY,moved:false}}
    else{const group=selSet.has(n.id)&&selSet.size>1?[...selSet].map(id=>ns().find(x=>x.id===id)).filter(Boolean):null;drag={k:'node',n,ox:w.x-n.x,oy:w.y-n.y,sx:e.clientX,sy:e.clientY,moved:false,group,groupStart:group?.map(x=>({id:x.id,x:x.x,y:x.y}))}}
  }else if(zH){const z=zs().find(x=>x.id===zH.closest('.zone').dataset.zone);sn();drag={k:'resize',z,sx:e.clientX,sy:e.clientY,ow:z.w,oh:z.h}}
  else if(zE){const z=zs().find(x=>x.id===zE.closest('.zone').dataset.zone);drag={k:'zone',z,ox:w.x-z.x,oy:w.y-z.y,sx:e.clientX,sy:e.clientY,moved:false}}
  else if(mod){drag={k:'marquee',sx:e.clientX,sy:e.clientY,startW:w,curW:w};selSet.clear();render()}
  else{if(!mod&&selSet.size){selSet.clear();render()}drag={k:'pan',sx:e.clientX,sy:e.clientY,vx:view.x,vy:view.y};cv.classList.add('gr')}
}

cv.addEventListener('pointerdown',e=>{
  if(window.dlog&&location.search.includes('debug'))dlog('pointerdown type='+e.pointerType+' target='+(e.target.tagName||'?')+' cls='+(e.target.className?.baseVal||e.target.className||'-'));
  if(e.pointerType==='mouse'&&e.button===2)return; // right-click handled by contextmenu
  try{cv.setPointerCapture(e.pointerId)}catch(err){}
  activePtrs.set(e.pointerId,{x:e.clientX,y:e.clientY});

  if(activePtrs.size===2){
    // Pinch starts — cancel any single-pointer drag
    if(drag?.k==='pan'){view.x=drag.vx;view.y=drag.vy}
    if(drag?.snap){hist.pop()}
    drag=null;cv.classList.remove('gr');
    if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
    const [p1,p2]=[...activePtrs.values()];
    pinchState={dist:Math.hypot(p2.x-p1.x,p2.y-p1.y)||1,cx:(p1.x+p2.x)/2,cy:(p1.y+p2.y)/2,k:view.k};
    e.preventDefault();return;
  }
  if(activePtrs.size>2)return;

  beginInteraction(e);

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
      view.k=Math.max(.08,Math.min(3,pinchState.k*(d/pinchState.dist)));
      const after=s2w(cx,cy);
      view.x+=after.x-before.x;view.y+=after.y-before.y;
      // Slide the pinch center too (allow 2-finger pan while pinching)
      const dcx=cx-pinchState.cx,dcy=cy-pinchState.cy;
      view.x+=dcx/view.k;view.y+=dcy/view.k;
      pinchState.cx=cx;pinchState.cy=cy;pinchState.dist=d;pinchState.k=view.k;
      render();e.preventDefault();return;
    }
  }
  if(!drag)return;
  const w=s2w(e.clientX,e.clientY);
  if(!drag.moved&&(Math.abs(e.clientX-drag.sx)>TH||Math.abs(e.clientY-drag.sy)>TH)){
    drag.moved=true;document.body.classList.add('dragging');
    if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
  }
  if(drag.k==='node'&&drag.moved){if(!drag.snap){sn();drag.snap=true}const newNx=w.x-drag.ox,newNy=w.y-drag.oy;if(drag.group){const anchor=drag.groupStart.find(g=>g.id===drag.n.id);const dx=newNx-anchor.x,dy=newNy-anchor.y;for(const gs of drag.groupStart){const nn=ns().find(x=>x.id===gs.id);if(nn){nn.x=gs.x+dx;nn.y=gs.y+dy}}}else{drag.n.x=newNx;drag.n.y=newNy;drag.n.zone=zoneAt(drag.n.x,drag.n.y)}render()}
  else if(drag.k==='marquee'){drag.curW=w;render();drawMarquee(drag.startW,w)}
  else if(drag.k==='zone'&&drag.moved){if(!drag.snap){sn();drag.snap=true}drag.z.x=w.x-drag.ox;drag.z.y=w.y-drag.oy;render()}
  else if(drag.k==='resize'){drag.z.w=Math.max(200,drag.ow+(e.clientX-drag.sx)/view.k);drag.z.h=Math.max(150,drag.oh+(e.clientY-drag.sy)/view.k);render()}
  else if(drag.k==='nresize'){drag.n.userW=Math.max(80,drag.ow+(e.clientX-drag.sx)/view.k);drag.n.userH=Math.max(50,drag.oh+(e.clientY-drag.sy)/view.k);render()}
  else if(drag.k==='pan'&&drag.moved){view.x=drag.vx+(e.clientX-drag.sx)/view.k;view.y=drag.vy+(e.clientY-drag.sy)/view.k;render()}
  else if(drag.k==='edge'&&drag.moved){const tE=document.elementFromPoint(e.clientX,e.clientY)?.closest?.('.node');edgeHover=tE?ns().find(x=>x.id===+tE.dataset.id):null;if(edgeHover&&edgeHover.id===drag.from.id)edgeHover=null;render();const l=document.createElementNS('http://www.w3.org/2000/svg','line');l.setAttribute('x1',drag.from.x);l.setAttribute('y1',drag.from.y);l.setAttribute('x2',w.x);l.setAttribute('y2',w.y);l.setAttribute('stroke','var(--accent)');l.setAttribute('stroke-width',2);l.setAttribute('stroke-dasharray','4,3');cv.appendChild(l)}
});
function drawMarquee(a,b){const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);const r=document.createElementNS('http://www.w3.org/2000/svg','rect');r.setAttribute('x',x1);r.setAttribute('y',y1);r.setAttribute('width',x2-x1);r.setAttribute('height',y2-y1);r.setAttribute('fill','var(--accent)');r.setAttribute('fill-opacity','0.1');r.setAttribute('stroke','var(--accent)');r.setAttribute('stroke-width','1');r.setAttribute('stroke-dasharray','4,3');cv.appendChild(r)}

document.addEventListener('pointerup',e=>{
  activePtrs.delete(e.pointerId);
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
  if(pinchState){if(activePtrs.size<2){pinchState=null}return}

  // Double-tap detection (touch only) — if this was a tap that didn't move
  if(e.pointerType==='touch'&&drag&&!drag.moved){
    const now=Date.now();
    const isDblTap=(now-lastTapTime<350)&&(Math.abs(e.clientX-lastTapX)<30)&&(Math.abs(e.clientY-lastTapY)<30);
    if(isDblTap){
      // Cancel pending open and fire dblclick
      if(drag.k==='pan'){view.x=drag.vx;view.y=drag.vy}
      if(drag.snap){hist.pop()}
      drag=null;cv.classList.remove('gr');document.body.classList.remove('dragging');
      const el=document.elementFromPoint(e.clientX,e.clientY);
      const ev=new MouseEvent('dblclick',{clientX:e.clientX,clientY:e.clientY,bubbles:true,cancelable:true});
      Object.defineProperty(ev,'target',{value:el});
      cv.dispatchEvent(ev);
      lastTapTime=0;
      return;
    }
    lastTapTime=now;lastTapX=e.clientX;lastTapY=e.clientY;
  }

  document.body.classList.remove('dragging');
  if(!drag){cv.classList.remove('gr');return}
  cv.classList.remove('gr');
  if(drag.k==='edge'){if(edgeHover){showEdgePicker(e.clientX,e.clientY,drag.from.id,edgeHover.id)}edgeHover=null}
  else if(drag.k==='marquee'){const a=drag.startW,b=drag.curW;const x1=Math.min(a.x,b.x),y1=Math.min(a.y,b.y),x2=Math.max(a.x,b.x),y2=Math.max(a.y,b.y);for(const n of ns()){if(n.x>=x1&&n.x<=x2&&n.y>=y1&&n.y<=y2)selSet.add(n.id)}render()}
  else if(drag.k==='node'&&!drag.moved){const n=drag.n;if(sel?.id===n.id)cp();else{sel=n;op(n)}}
  else if(drag.k==='pan'&&!drag.moved){cp()}
  if(drag.snap||drag.k==='resize'||drag.k==='nresize')sv();drag=null;render();
});

cv.addEventListener('pointercancel',e=>{
  activePtrs.delete(e.pointerId);
  if(activePtrs.size<2)pinchState=null;
  if(longPressTimer){clearTimeout(longPressTimer);longPressTimer=null}
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
    drag=null;document.body.classList.remove('dragging');render();
  });
})();

cv.addEventListener('dblclick',async e=>{const nE=e.target.closest?.('.node');if(nE){const n=ns().find(x=>x.id===+nE.dataset.id);if(n.shape==='project'&&S.current==='vault'){if(n.childCanvas)switchTo(n.childCanvas);else if(await uiConfirm('Create roadmap for "'+n.label+'"?',{title:'New roadmap',okLabel:'Create'}))createRoadmap(n.id);return}sel=n;op(n);return}const w=s2w(e.clientX,e.clientY);const n=addNode(w.x,w.y);sel=n;op(n)});

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
async function recolorZone(zid){const c=await uiPrompt(S.hebrewMode?'צבע (hex)':'Zone color','',{placeholder:'#d97757',hint:'Hex color, e.g. #d97757'});if(!c)return;sn();const z=zs().find(x=>x.id===zid);if(z)z.color=c;sv();render();bF()}
function addNodeAt(x,y){const n=addNode(x,y);sel=n;op(n)}
async function addZoneAt(x,y){const name=await uiPrompt('New zone','New Zone');if(!name)return;sn();const id='z-'+Date.now();const colors=['#8b7ba8','#6b8cb0','#5fa3a8','#7aa882','#c48a9b','#c9896a','#7d7569','#b07ba8','#6ba8a0'];const c=colors[zs().length%colors.length];zs().push({id,name,x:x-250,y:y-180,w:500,h:360,color:c});sv();render();bF()}
function addZoneCenter(){const w=s2w(innerWidth/2,innerHeight/2);addZoneAt(w.x,w.y)}
async function renameZone(zid){const z=zs().find(x=>x.id===zid);if(!z)return;const n=await uiPrompt('Rename zone',z.name);if(n){sn();z.name=n;sv();render();bF()}hideCtx()}
function toggleLock(zid){const z=zs().find(x=>x.id===zid);if(!z)return;sn();z.locked=z.locked===false?true:false;sv();render();hideCtx()}
async function deleteZone(zid){const z=zs().find(x=>x.id===zid);if(!z)return;const nodesInZone=ns().filter(n=>n.zone===zid).length;if(nodesInZone>0){if(!await uiConfirm(`${nodesInZone} nodes are in "${z.name}". They'll be reassigned to another zone. Continue?`,{title:'Delete zone',danger:true,okLabel:'Delete'})){hideCtx();return}}if(zs().length<=1){await uiNotice('Cannot delete the last zone.');hideCtx();return}sn();const fallback=zs().find(x=>x.id!==zid).id;ns().forEach(n=>{if(n.zone===zid)n.zone=fallback});C().zones=zs().filter(x=>x.id!==zid);sv();render();bF();hideCtx()}
cv.addEventListener('wheel',e=>{e.preventDefault();const b=s2w(e.clientX,e.clientY),d=e.deltaY<0?1.12:.89;view.k=Math.max(.08,Math.min(3,view.k*d));const a=s2w(e.clientX,e.clientY);view.x+=a.x-b.x;view.y+=a.y-b.y;render()},{passive:false});
/* Phase 1 · 1.6b — defense-in-depth for iPad Safari / Apple Pencil / Scribble.
   touch-action:none on #cv (CSS) already tells the browser we own the canvas
   gesture; these non-passive touchstart/move listeners claim the legacy touch
   event path too so iOS can't route a pencil touch to Scribble or kick in
   Safari's own pinch-zoom / pull-to-refresh. Node editing happens in the side
   panel (not inline on the canvas), so blocking touch defaults here is safe. */
cv.addEventListener('touchstart',e=>{e.preventDefault()},{passive:false});
cv.addEventListener('touchmove',e=>{e.preventDefault()},{passive:false});
window.addEventListener('keydown',async e=>{if(['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if(e.key==='Delete'){if(selSet.size){if(await uiConfirm(`Delete ${selSet.size} selected nodes?`,{title:'Bulk delete',danger:true,okLabel:'Delete'})){sn();for(const id of selSet)delN(id);selSet.clear();render()}}else if(sel)delN(sel.id)}else if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();un()}else if((e.ctrlKey||e.metaKey)&&e.key==='a'){e.preventDefault();selSet.clear();for(const n of ns())selSet.add(n.id);render()}else if(e.key==='Escape'){selSet.clear();cp();hideCtx();closeModal();ep.style.display='none';hideLegend();hideMore();render()}});
function zF(){const items=[...zs().map(z=>({x1:z.x,y1:z.y,x2:z.x+z.w,y2:z.y+z.h})),...ns().map(n=>({x1:n.x-60,y1:n.y-60,x2:n.x+60,y2:n.y+60}))];if(!items.length){view={x:0,y:0,k:.5};render();return}const x1=Math.min(...items.map(i=>i.x1)),y1=Math.min(...items.map(i=>i.y1)),x2=Math.max(...items.map(i=>i.x2)),y2=Math.max(...items.map(i=>i.y2)),pad=80;view.k=Math.min(innerWidth/(x2-x1+pad*2),innerHeight/(y2-y1+pad*2),.7);view.x=-(x1+x2)/2;view.y=-(y1+y2)/2;render()}
function ex(){const b=new Blob([JSON.stringify(S,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='idea-vault.json';a.click()}
function imF(e){
  window.dbg&&window.dbg('IMPORT','imF entered · files='+((e.target.files&&e.target.files.length)||0));
  const f=e.target.files[0];
  if(!f){window.dbg&&window.dbg('IMPORT','no file selected — abort');return}
  window.dbg&&window.dbg('IMPORT','file: '+f.name+' · '+f.size+'B');
  const r=new FileReader();
  r.onload=()=>{
    window.dbg&&window.dbg('IMPORT','FileReader.onload · result len='+(r.result?r.result.length:0));
    try{
      sn();
      const parsed=JSON.parse(r.result);
      window.dbg&&window.dbg('IMPORT','JSON parsed · canvases='+Object.keys(parsed.canvases||{}).length);
      S=parsed;
      window.dbg&&window.dbg('IMPORT','state swapped · current='+S.current);
      reconcileCanvases();
      window.dbg&&window.dbg('IMPORT','reconcileCanvases done · nodes='+(S.canvases[S.current]?.nodes?.length||0));
      sv();
      render();
      window.dbg&&window.dbg('IMPORT','render done');
      bF();bB();renderTabs();renderSB();
      zF();
      window.dbg&&window.dbg('IMPORT','zF done — import complete');
    }catch(err){
      window.dbg&&window.dbg('IMPORT','ERROR in onload: '+err.message);
      throw err;
    }
  };
  r.onerror=()=>{window.dbg&&window.dbg('IMPORT','FileReader error: '+(r.error&&r.error.message))};
  r.readAsText(f);
  window.dbg&&window.dbg('IMPORT','readAsText dispatched');
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
}
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
/* Debug overlay — shows real-time events on iPad */
const dbg=document.createElement('div');dbg.id='dbgOverlay';dbg.style.cssText='position:fixed;bottom:100px;left:8px;right:8px;max-height:150px;overflow-y:auto;background:rgba(0,0,0,0.85);color:#7db36a;font:10px/1.3 monospace;padding:6px;border:1px solid #7db36a;border-radius:6px;z-index:9998;pointer-events:auto;touch-action:pan-y;display:none';document.body.appendChild(dbg);
function dlog(m){const l=document.createElement('div');l.textContent=m;dbg.insertBefore(l,dbg.firstChild);while(dbg.children.length>30)dbg.removeChild(dbg.lastChild);dbg.style.display='block'}
/* Show debug overlay by URL ?debug=1 */
if(location.search.includes('debug')){dbg.style.display='block';dlog('DEBUG MODE ON');dlog('viewport: '+innerWidth+'x'+innerHeight);dlog('ua: '+navigator.userAgent.slice(0,60))}

window.addEventListener('error',e=>{const existing=document.getElementById('errBanner');if(existing)return;const b=document.createElement('div');b.id='errBanner';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#d96b5a;color:white;padding:12px;font:12px/1.4 monospace;word-break:break-word;max-height:40vh;overflow:auto';b.textContent='JS ERROR: '+(e.message||'unknown')+' @ '+(e.filename||'?')+':'+(e.lineno||'?');b.onclick=()=>b.remove();document.body.appendChild(b)});
window.addEventListener('unhandledrejection',e=>{const existing=document.getElementById('errBanner');if(existing)return;const b=document.createElement('div');b.id='errBanner';b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:9999;background:#d96b5a;color:white;padding:12px;font:12px/1.4 monospace;word-break:break-word;max-height:40vh;overflow:auto';b.textContent='PROMISE ERROR: '+(e.reason?.message||e.reason||'unknown')+'\\n'+(e.reason?.stack||'');b.onclick=()=>b.remove();document.body.appendChild(b)});

load().then(()=>{try{zF()}catch(e){console.error('zF failed',e)}
  // iOS Safari needs a re-render after layout settles
  requestAnimationFrame(()=>{try{render();zF()}catch(e){}});
  setTimeout(()=>{try{render();zF()}catch(e){}},300);
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
})})}
