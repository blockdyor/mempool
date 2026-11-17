import {test,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import worker from '../src/index.js';
const realFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=realFetch;});
async function page(){
  const b={id:'b'.repeat(64),height:900001,timestamp:1700000000,tx_count:2,weight:3000000,extras:{medianFee:2,feeRange:[1,2,3]}};
  globalThis.fetch=async url=>Response.json(new URL(url).pathname.endsWith('/blocks')?[b,b]:new URL(url).pathname.endsWith('mempool-blocks')?[{blockVSize:500000,nTx:3,medianFee:2,feeRange:[1,2,3]}]:new URL(url).pathname.endsWith('recommended')?{fastestFee:4,halfHourFee:3,hourFee:2,economyFee:1}:{count:6,vsize:700000});
  const h=await(await worker.fetch(new Request('https://test/'))).text();
  const scripts=[...h.matchAll(/<script nonce="[^"]+">([\s\S]*?)<\/script>/g)];
  const elements=Object.fromEntries(['theme','content','caption'].map(id=>[id,{textContent:'',innerHTML:'',events:{},addEventListener(n,f){this.events[n]=f;},setAttribute(n,v){this[n]=v;}}]));
  const events={},root={dataset:{theme:'auto'}},document={documentElement:root,hidden:false,getElementById:id=>elements[id],addEventListener(n,f){events[n]=f;}};
  let scheduled,fetcher=async()=>{throw Error('offline');},calls=0;
  const window={addEventListener(){}};
  vm.runInNewContext(scripts.at(-1)[1],{document,window,parent:{},self:{},Intl,Date,Number,Math,AbortSignal,setTimeout(f,ms){scheduled={f,ms};return 1;},clearTimeout(){scheduled=null;},fetch:(...args)=>{calls++;return fetcher(...args);}});
  return {elements,events,root,document,timer:()=>scheduled,calls:()=>calls,setFetch:f=>{fetcher=f;}};
}
test('actual client script cycles themes and schedules thirty-second refresh',async()=>{const p=await page();assert.equal(p.timer().ms,30000);p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'dark');p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'light');p.elements.theme.events.click();assert.equal(p.root.dataset.theme,'auto');});
test('failed client refresh marks retained capture cached without inventing timestamp',async()=>{const p=await page();await p.timer().f();assert.equal(p.calls(),1);assert.match(p.elements.caption.textContent,/^Cached · \d{4}-\d{2}-\d{2} /);assert.match(p.elements.content.innerHTML,/900,001/);});
test('actual client pauses hidden polling and refreshes when visible',async()=>{const p=await page();p.document.hidden=true;p.events.visibilitychange();assert.equal(p.timer(),null);p.document.hidden=false;await p.events.visibilitychange();await new Promise(resolve=>setImmediate(resolve));assert.equal(p.calls(),1);assert.equal(p.timer().ms,30000);});
