import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../src/index.js';
const realFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=realFetch;});
async function page(bundled=false){
  const b={id:'b'.repeat(64),height:900001,timestamp:1700000000,tx_count:2,weight:3000000,extras:{medianFee:2,feeRange:[1,2,3]}};
  globalThis.fetch=async url=>Response.json(new URL(url).pathname.endsWith('/blocks')?[b,b]:new URL(url).pathname.endsWith('mempool-blocks')?[{blockVSize:500000,nTx:3,medianFee:2,feeRange:[1,2,3]}]:new URL(url).pathname.endsWith('recommended')?{fastestFee:4,halfHourFee:3,hourFee:2,economyFee:1}:{count:6,vsize:700000});
  const h=await(await worker.fetch(new Request('https://test/'))).text();
  const scripts=[...h.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)];
  const elements=Object.fromEntries(['theme','content','caption','tip','tip-body','tip-close'].map(id=>[id,{textContent:'',innerHTML:'',events:{},querySelectorAll(){return [];},querySelector(){return null;},contains(){return false;},addEventListener(n,f){this.events[n]=f;},setAttribute(n,v){this[n]=v;}}]));
  const events={},root={dataset:{theme:'auto'}},document={documentElement:root,hidden:false,getElementById:id=>elements[id],addEventListener(n,f){events[n]=f;}};
  let scheduled,fetcher=async()=>{throw Error('offline');},calls=0;
  const window={addEventListener(){}};
  let client=scripts.at(-1)[1];
  if(bundled){const before="const fmt=n=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(n),shape=";assert.ok(client.includes(before));client=client.replace(before,"const fmt=__name(n=>new Intl.NumberFormat('en',{maximumFractionDigits:2}).format(n),'fmt'),shape=");}
  vm.runInNewContext(client,{document,window,parent:{},self:{},Intl,Date,Number,Math,AbortSignal,setTimeout(f,ms){scheduled={f,ms};return 1;},clearTimeout(){scheduled=null;},fetch:(...args)=>{if(args[0]==='/api/mempool')calls++;return fetcher(...args);}});
  return {elements,events,root,document,timer:()=>scheduled,calls:()=>calls,setFetch:f=>{fetcher=f;}};
}
test('actual client script cycles themes and schedules thirty-second refresh',async()=>{const p=await page();assert.equal(p.timer().ms,30000);p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'dark');p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'light');p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'auto');});
test('failed client refresh marks retained capture cached without inventing timestamp',async()=>{const p=await page();await p.timer().f();assert.equal(p.calls(),1);assert.match(p.elements.caption.textContent,/^Cached · \d{4}-\d{2}-\d{2} /);assert.match(p.elements.content.innerHTML,/900,001/);});
test('actual client pauses hidden polling and refreshes when visible',async()=>{const p=await page();p.document.hidden=true;p.events.visibilitychange();assert.equal(p.timer(),null);p.document.hidden=false;await p.events.visibilitychange();await new Promise(resolve=>setImmediate(resolve));assert.equal(p.calls(),1);assert.equal(p.timer().ms,30000);});
test('block tap pins only a transient local tooltip and Escape closes it',async()=>{const p=await page();const b={dataset:{block:'b'.repeat(64)},closest(){return this;}};p.elements.content.events.click({target:b});assert.equal(p.elements.tip.hidden,false);assert.equal(p.elements['tip-close'].hidden,false);assert.match(p.elements['tip-body'].innerHTML,/Block 900,001/);p.events.keydown({key:'Escape'});assert.equal(p.elements.tip.hidden,true);});
test('fee choice shows a size-labelled estimate and survives data refresh',async()=>{const p=await page();const b={dataset:{fee:'0'},closest(){return this;}};p.elements.content.events.click({target:b});assert.match(p.elements['tip-body'].innerHTML,/140 vB example ≈ 140 sats/);await p.timer().f();assert.match(p.elements.content.innerHTML,/data-fee="0" aria-pressed="true"/);assert.equal(p.elements.tip.hidden,false,'Pinned details must survive scheduled refresh');});
test('Wrangler name-decorated render functions remain self-contained after refresh',async()=>{const p=await page(true);await p.timer().f();assert.match(p.elements.content.innerHTML,/900,001/);assert.match(p.elements.caption.textContent,/^Cached/);});
test('scheduled refresh restores keyboard focus on a fee recommendation',async()=>{const p=await page();p.document.activeElement={dataset:{fee:'1'}};let restored=null;p.elements.content.querySelector=selector=>({focus(options){restored={selector,options};}});await p.timer().f();assert.equal(restored?.selector,'[data-fee="1"]');assert.equal(restored?.options.preventScroll,true);});
