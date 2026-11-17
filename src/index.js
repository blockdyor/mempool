// SPDX-License-Identifier: AGPL-3.0-only
// mempool — paste this single file into the Cloudflare Worker editor.
const SECURITY = {'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'};
const FIELDS = ['fastestFee','halfHourFee','hourFee','economyFee'];
function number(n, integer=false) {
  if (!Number.isFinite(n) || n < 0 || n > Number.MAX_SAFE_INTEGER || (integer && !Number.isSafeInteger(n))) throw Error('Invalid upstream number');
  return n;
}
function block(b, projected=false) {
  const extra=projected?b:b.extras;
  if (!extra || !Array.isArray(extra.feeRange) || extra.feeRange.length<2 || extra.feeRange.length>20) throw Error('Invalid fees');
  const common={fee:number(extra.medianFee),range:extra.feeRange.map(n=>number(n)),tx:number(projected?b.nTx:b.tx_count,true),vsize:number(projected?b.blockVSize:b.weight/4)};
  if(projected)return common;
  if(!/^[a-f0-9]{64}$/.test(b.id))throw Error('Invalid block ID');
  return {...common,id:b.id,height:number(b.height,true),time:number(b.timestamp,true)};
}
async function data(url) {
  const key=new Request(url.origin+'/api/mempool'), cache=globalThis.caches?.default;
  let saved;
  try { const entry=await cache?.match(key); if(entry)saved=await entry.json(); } catch { /* Cache failure must not hide live data. */ }
  const age=saved?Date.now()-saved.time:Infinity;
  if(saved && age>=0 && age<30000)return {...saved,cached:true};
  try {
    const paths=['/v1/blocks','/v1/fees/mempool-blocks','/v1/fees/recommended','/mempool'];
    const [blocks,next,fees,pool]=await Promise.all(paths.map(async path=>{
      const r=await fetch('https://mempool.space/api'+path,{signal:AbortSignal.timeout(7000)});
      if(!r.ok)throw Error('Provider unavailable');
      return r.json();
    }));
    if(!Array.isArray(blocks)||blocks.length<2||!Array.isArray(next)||!next.length)throw Error('No blocks');
    const result={blocks:blocks.slice(0,2).map(b=>block(b)),next:block(next[0],true),fees:Object.fromEntries(FIELDS.map(f=>[f,number(fees[f])])),count:number(pool.count,true),vsize:number(pool.vsize),time:Date.now(),cached:false};
    try { await cache?.put(key,Response.json(result,{headers:{'Cache-Control':'public, max-age=600'}})); } catch { /* A good provider response remains usable. */ }
    return result;
  } catch {
    const fallbackAge=saved?Date.now()-saved.time:Infinity;
    if(saved&&fallbackAge>=0&&fallbackAge<=600000)return {...saved,cached:true};
    return null;
  }
}
function contents(d) {
  if(!d)return '<div class="empty" role="status">Temporarily unavailable</div>';
  const fmt=n=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(n);
  const shape=(b,next)=>{
    const bands=6,fill=Math.min(1,b.vsize/1000000),base=52-fill*46;
    const layers=Array.from({length:bands},(_,i)=>{
      const rate=b.range[Math.min(b.range.length-1,Math.floor(i*(b.range.length-1)/(bands-1)))];
      const hue=Math.round(210+Math.min(1,Math.log1p(rate)/Math.log(101))*47);
      return '<rect x="2" y="'+(base+(bands-1-i)*fill*46/bands).toFixed(2)+'" width="76" height="'+Math.max(.1,fill*46/bands-.8).toFixed(2)+'" fill="hsl('+hue+' 76% 65%)"/>';
    }).join('');
    const label=next?'Next':fmt(b.height),detail=fmt(b.fee)+' sat/vB · '+fmt(b.tx)+' transactions · '+fmt(b.vsize/1000000)+' MvB';
    return '<a class="block'+(next?' projected':'')+'" href="https://mempool.space/'+(next?'mempool-block/0':'block/'+b.id)+'" target="_blank" rel="noopener" aria-label="'+label+', '+detail+'" title="'+detail+'"><span class="block-label">'+label+'</span><svg viewBox="0 0 80 56" preserveAspectRatio="none" aria-hidden="true">'+layers+'</svg><span class="block-fee">'+fmt(b.fee)+' <small>sat/vB</small></span><span class="tx muted">'+fmt(b.tx)+' tx</span></a>';
  };
  return '<div class="row heading"><span class="title">mempool</span><span class="muted">'+fmt(d.vsize/1000000)+' MvB<span class="pool-count"> · '+fmt(d.count)+' tx</span></span></div><div class="strip">'+shape(d.next,true)+'<span class="divider" aria-hidden="true"></span>'+d.blocks.map(b=>shape(b,false)).join('')+'</div><div class="fees" aria-label="Recommended transaction fees in satoshis per virtual byte">'+['No rush','1 hour','30 min','Next block'].map((label,i)=>'<div><span class="muted">'+label+'</span><strong>'+fmt(d.fees[['economyFee','hourFee','halfHourFee','fastestFee'][i]])+'</strong></div>').join('')+'<span class="units muted">sat/vB</span></div>';
}
function caption(d) {
  return d?(d.cached?'Cached · ':'')+new Date(d.time).toISOString().slice(0,16).replace('T',' ')+' UTC':'';
}
const STYLE=`:root{--bg:#fff;--fg:#000;--mut:#5B5F66;--bd:rgb(0 0 0/.08);--up:#10b981;--dn:#ef4444;--line-up:#07815a;color-scheme:light}
:root[data-theme=dark]{--bg:#1D1F21;--fg:#F6F7FA;--mut:#B6BBC4;--bd:rgb(255 255 255/.09);--line-up:var(--up);color-scheme:dark}
@media(prefers-color-scheme:dark){:root[data-theme=auto]{--bg:#1D1F21;--fg:#F6F7FA;--mut:#B6BBC4;--bd:rgb(255 255 255/.09);--line-up:var(--up);color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px -apple-system,BlinkMacSystemFont,'SF Pro Text',system-ui,'Segoe UI',sans-serif}
a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}button{font:inherit;color:inherit;cursor:pointer;background:none;border:1px solid var(--bd);border-radius:7px;padding:5px 8px}
a:focus-visible,button:focus-visible,svg:focus-visible{outline:2px solid var(--fg);outline-offset:3px}
main{width:min(420px,calc(100% - 40px));margin:24px auto}header{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.brand img{height:28px;width:auto;display:block;filter:brightness(0)}
:root[data-theme=dark] .brand img{filter:brightness(0) invert(1)}@media(prefers-color-scheme:dark){:root[data-theme=auto] .brand img{filter:brightness(0) invert(1)}}
#card{border:1px solid var(--bd);border-radius:12px;padding:16px;position:relative;display:flex;flex-direction:column;height:230px;min-height:0}.row{display:flex;justify-content:space-between;align-items:baseline;gap:8px}.muted{color:var(--mut);font-size:11px}
footer{display:flex;justify-content:space-between;gap:12px;margin-top:20px;font-size:11px;color:var(--mut)}.embed-brand{display:none}:root[data-embed] .standalone{display:none}:root[data-embed] main{width:auto;margin:0;height:100dvh;display:flex;flex-direction:column}:root[data-embed] #card{height:auto;flex:1;min-height:0}:root[data-embed] .brand img{height:16px}:root[data-embed] .embed-brand{display:inline;white-space:nowrap}a:focus-visible{outline:2px solid var(--fg);outline-offset:2px}

#content{display:contents}
.title{font-size:18px;font-weight:600;letter-spacing:-.3px}.heading{flex:none}.strip{display:grid;grid-template-columns:1fr 1px 1fr 1fr;gap:12px;align-items:stretch;flex:1;min-height:0;margin:12px 0}.block{display:flex;flex-direction:column;justify-content:center;min-width:0;text-align:center;border:1px solid var(--bd);border-radius:6px;padding:6px 7px;gap:3px;font-variant-numeric:tabular-nums}.block:hover{text-decoration:none;border-color:var(--mut)}.projected{border-style:dashed}.block-label{font-size:12px;font-weight:600;white-space:nowrap}.block svg{display:block;width:100%;height:42px;min-height:14px;flex:1}.block-fee{font-size:12px;white-space:nowrap}.block-fee small{font-size:9px;color:var(--mut)}.tx{font-size:9px}.divider{border-left:1px dashed var(--mut);opacity:.55}.fees{position:relative;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding-bottom:13px;flex:none}.fees>div{display:flex;flex-direction:column;gap:3px}.fees strong{font-size:16px;font-weight:600;font-variant-numeric:tabular-nums}.fees .units{position:absolute;right:0;bottom:0;font-size:9px}.status-row{flex:none;margin-top:8px}.empty{display:grid;place-items:center;flex:1;font-size:12px;color:var(--mut)}
:root[data-embed] header{height:22px;padding:0 8px;margin:0}:root[data-embed] #card{padding:8px 10px}:root[data-embed] .title{font-size:13px}:root[data-embed] .pool-count,:root[data-embed] .tx{display:none}:root[data-embed] .strip{gap:8px;margin:5px 0}:root[data-embed] .block{padding:3px 5px;gap:1px}:root[data-embed] .block-label{font-size:10px}:root[data-embed] .block-fee{font-size:10px}:root[data-embed] .block-fee small{font-size:8px}:root[data-embed] .block svg{height:16px}:root[data-embed] .fees{padding-bottom:0;gap:4px}:root[data-embed] .fees .muted{font-size:9px}:root[data-embed] .fees strong{font-size:12px}:root[data-embed] .fees .units{display:none}:root[data-embed] .status-row{margin-top:3px;font-size:9px}:root[data-embed] .status-row a{font-size:9px}
`;
const PAGE=(nonce,theme,embedded,d)=>`<!doctype html><html lang="en" data-theme="${theme}"${embedded?' data-embed="1"':''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="robots" content="noindex,nofollow"><title>mempool</title><link rel="icon" href="data:,">
<script nonce="${nonce}">if(self!==top)document.documentElement.dataset.embed='1';</script><style nonce="${nonce}">${STYLE}</style></head><body><main><header><a class="brand" href="https://blockdyor.com" target="_top"><img src="data:image/webp;base64,UklGRkwDAABXRUJQVlA4WAoAAAAQAAAAPwEASgAAQUxQSM4CAAABkIVt29lI/9q2bdu2jSPbtm3bdsaeaTuZdFbDnq1t29v5F2/y/eV4NiIm4BeHU5jF0z/gcA2zv64cKsyWQzn0ZI74J5psBffQKjt0Hsk2JSO3ZFl+WM9d+3XOyfvuBJy1ByFxPsp/IE2K84mSxC6zgnUSsbygCZLWcyWtpZWEcwiaIxFfCOohwcNZCYUl3IByQCLm1bJUgutQ+mOS9vMqog2pLBfGifUFHeJaf9bKmMY6BnOcT5A7F0uawuGLXITyHPekPOTEYlqCOLyMMr7i2n86Hv7k/sA4Hs6HJUny0ER8Z7mMtbC7idi3FiyG0larBXeYiFNrwfKCUlWoBSeZcG5Cuhq14BET8aOgydaRvRZWTMQ2tWBBxth+E/SoBetfNsFHlImM6Ga5qhx3ZMRbHO5GuV9yOJMR3TkMFZQmikNvJrbgNw6HM2KIoEnW0Z7j6kx72k8cLmQau3L4oyyDUyiTKZ6Wq6zSgXIT7aTMoLghRVQk8hNUQJRiS20Fpf+IFmjpQpmelJcHCqUEq0QgH2fpl0Oq1xU2prz2gb7v0AsfnMNpKdMVdnFIZBXh+ZwW9WRk3l8k3rRDZZrA/rEWOTVxkB3aacaxF0YcbI84MampiRR3FGyBKiodKbfQLspMm8pLKGhdk1Vyoh2C2glKp7LQeq7qiLPbwbpMXNZ2+JSOOKwdrITStWwHt+qIza1L1sERKEObdnCfjvhGUIl2sJ9eBzf0g+MpedthLx2xbztY2nrIQxidpB7GifWZ2EOc2Mu6VFcgdXculqRa4geH8xksT1F/yInFGD3ZCoMstouAtOdkOIayTyZWFjRHJragrFDgTkonhTiasloRu0ZQIVmBQy3kKhMLCGgqQ30xSixcWBxqcgypieXMZnNMTIw5DiWXn2L8V1EUo9Fo1LVuDvPEneR7x7U/z8DiWpN/yBV8JQxfCQsLCwtMb2cAVlA4IFgAAABwCACdASpAAUsAPm02mUmkIyKhIGgAgA2JaW7hdfAAO6HVUmyYh1VJsmIdVSbJiHVUmyYh1VJsmIdVSbJiHVUmyYh1VJsmIdVSbIIAAP7/uxAAAAAAAAAA" alt="blockdyor" width="320" height="75"></a><button id="theme" class="standalone" type="button" aria-label="Change color theme">◐</button></header><section id="card" aria-label="Bitcoin mempool"><div id="content">${contents(d)}</div><div class="row muted status-row"><span id="caption" role="status">${caption(d)}</span><a class="embed-brand" href="https://blockdyor.com" target="_blank" rel="noopener">← blockdyor.com</a></div></section><footer class="standalone"><a href="https://blockdyor.com">← Back to blockdyor.com</a><a href="https://github.com/blockdyor/mempool">Source</a><a href="https://mempool.space" target="_blank" rel="noopener">mempool.space</a></footer></main>
<script nonce="${nonce}">(()=>{
const root=document.documentElement,el=id=>document.getElementById(id),render=${contents.toString()},caption=${caption.toString()};
let current=${JSON.stringify(d)},timer,busy=false;
el('theme').addEventListener('click',()=>{root.dataset.theme=({auto:'dark',dark:'light',light:'auto'})[root.dataset.theme];el('theme').setAttribute('aria-label','Color theme: '+root.dataset.theme+'. Change theme');});
window.addEventListener('message',e=>{if(e.source===parent&&self!==top&&e.data?.type==='mempool-theme'&&['light','dark','auto'].includes(e.data.theme))root.dataset.theme=e.data.theme;});
function schedule(){clearTimeout(timer);if(!document.hidden)timer=setTimeout(load,30000);}
// The HTML renderer interpolates only server-validated numbers and hexadecimal block IDs.
async function load(){if(busy)return;busy=true;try{const r=await fetch('/api/mempool',{cache:'no-store',signal:AbortSignal.timeout(9000)});if(!r.ok)throw Error();const d=await r.json();if(!d||!Number.isFinite(d.time))throw Error();current=d;}catch{current=current&&Date.now()-current.time<=600000?{...current,cached:true}:null;}finally{el('content').innerHTML=render(current);el('caption').textContent=caption(current);busy=false;schedule();}}
document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimeout(timer);else load();});schedule();
})();</script></body></html>`;
const widget=origin=>`(()=>{const origin=${JSON.stringify(origin)},items=[],theme=()=>document.documentElement.classList.contains('theme-dark')?'dark':'light',size=(v,f)=>/^(?:[1-9]\\d{0,3}(?:px)?|(?:100|[1-9]?\\d)%)$/.test(v||'')?(/^\\d+$/.test(v)?v+'px':v):f;
document.querySelectorAll('[data-mempool]').forEach(el=>{if(el.dataset.mempoolReady)return;el.dataset.mempoolReady='1';const f=document.createElement('iframe'),d=el.dataset,explicit=['auto','light','dark'].includes(d.theme);f.title='Bitcoin mempool';f.loading='lazy';f.style.border='0';f.style.display='block';f.style.width=size(d.width,'320px');f.style.maxWidth='100%';f.style.height=size(d.height,'140px');f.src=origin+'/?embed=1&theme='+(explicit?d.theme:theme());el.replaceChildren(f);if(!explicit)items.push(f);});if(items.length)new MutationObserver(()=>items.forEach(f=>f.contentWindow?.postMessage({type:'mempool-theme',theme:theme()},origin))).observe(document.documentElement,{attributes:true,attributeFilter:['class']});})();`;
export default {
  async fetch(req) {
    const url=new URL(req.url);
    if(!['GET','HEAD'].includes(req.method))return new Response('Method not allowed',{status:405,headers:{...SECURITY,Allow:'GET, HEAD'}});
    let r;
    if(url.pathname==='/api/mempool'){
      const d=await data(url);r=Response.json(d||{data:null},{status:d?200:503,headers:{...SECURITY,'Cache-Control':'no-store'}});
    } else if(url.pathname==='/widget.js'){
      r=new Response(widget(url.origin),{headers:{...SECURITY,'Content-Type':'application/javascript;charset=utf-8','Cache-Control':'no-store'}});
    } else if(url.pathname==='/'){
      const nonce=crypto.randomUUID().replaceAll('-',''),theme=['light','dark','auto'].includes(url.searchParams.get('theme'))?url.searchParams.get('theme'):'auto';
      r=new Response(PAGE(nonce,theme,url.searchParams.get('embed')==='1'||req.headers.get('Sec-Fetch-Dest')==='iframe',await data(url)),{headers:{...SECURITY,'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; script-src 'nonce-"+nonce+"'; style-src 'nonce-"+nonce+"'; connect-src 'self'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors *"}});
    } else r=new Response('Not found',{status:404,headers:SECURITY});
    return req.method==='HEAD'?new Response(null,{status:r.status,headers:r.headers}):r;
  }
};
