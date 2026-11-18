import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import worker from '../src/index.js';
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch;delete globalThis.caches;});
const block={id:'a'.repeat(64),height:900001,timestamp:Math.floor(Date.now()/1000)-120,tx_count:2200,weight:3990000,extras:{medianFee:3.2,feeRange:[1,2,3,4,5,6,9]}};
const projected={blockVSize:800000,nTx:1200,medianFee:2.1,feeRange:[1,1,2,2,3,4,8]};
function upstream(change={}){globalThis.fetch=async url=>Response.json(({ '/v1/blocks':[block,{...block,height:900000}],'/v1/fees/mempool-blocks':[projected],'/v1/fees/recommended':{fastestFee:4,halfHourFee:3,hourFee:2,economyFee:1},'/mempool':{count:10000,vsize:3500000},...change})[new URL(url).pathname.replace('/api','')]);}
const call=(path='/',method='GET')=>worker.fetch(new Request('https://private.test'+path,{method}));
test('renders real initial blocks and fees in Price shell',async()=>{upstream();const r=await call();const h=await r.text();assert.equal(r.status,200);assert.match(h,/900,001/);assert.match(h,/Next/);assert.match(h,/4<\/strong>/);assert.match(h,/width:min\(420px/);assert.match(h,/height:230px/);assert.match(h,/<svg/);assert.match(h,/>mempool</);assert.match(r.headers.get('Content-Security-Policy'),/default-src 'none'/);});
test('API exposes bounded numeric data with capture timestamp',async()=>{upstream();const r=await call('/api/mempool');const d=await r.json();assert.equal(d.blocks.length,2);assert.equal(d.next.vsize,800000);assert.equal(d.fees.fastestFee,4);assert.equal(d.cached,false);assert.ok(Date.now()-d.time<5000);});
test('rejects invalid upstream without fabricating block values',async()=>{upstream({'/v1/blocks':[{...block,height:'<script>'}]});const r=await call('/api/mempool');assert.equal(r.status,503);assert.equal((await r.json()).data,null);});
test('rejects missing fees, negative vsize and empty projected blocks',async()=>{for(const change of [{'/v1/fees/recommended':{}},{'/mempool':{count:10,vsize:-1}},{'/v1/fees/mempool-blocks':[]}]){upstream(change);assert.equal((await call('/api/mempool')).status,503);}});
test('upstream failure produces honest initial unavailable page',async()=>{globalThis.fetch=async()=>{throw Error('offline');};const h=await(await call()).text();assert.match(h,/Temporarily unavailable/);assert.doesNotMatch(h.replace(/<script[^>]*>[\s\S]*?<\/script>/g,''),/NaN|undefined/);});
test('cache preserves timestamp and labels fallback, expires after ten minutes',async()=>{upstream();const d=await(await call('/api/mempool')).json();d.time-=60000;globalThis.caches={default:{match:async()=>Response.json(d),put:async()=>{}}};globalThis.fetch=async()=>{throw Error('offline');};let r=await call('/api/mempool');let saved=await r.json();assert.equal(saved.time,d.time);assert.equal(saved.cached,true);d.time-=600000;r=await call('/api/mempool');assert.equal(r.status,503);});
test('cache failures do not discard successful upstream data',async()=>{upstream();globalThis.caches={default:{match:async()=>{throw Error();},put:async()=>{throw Error();}}};assert.equal((await call('/api/mempool')).status,200);});
test('HEAD is bodyless and unknown paths or unsupported methods are rejected',async()=>{upstream();assert.equal(await(await call('/','HEAD')).text(),'');assert.equal((await call('/missing')).status,404);assert.equal((await call('/','POST')).status,405);});
test('theme input is allowlisted and embed keeps compact brand',async()=>{upstream();let h=await(await call('/?theme=%22%3E%3Cscript%3E&embed=1')).text();assert.match(h,/data-theme="auto"/);assert.match(h,/data-embed="1"/);assert.match(h,/alt="blockdyor"/);assert.doesNotMatch(h,/<script>/);h=await(await call('/?theme=dark')).text();assert.match(h,/data-theme="dark"/);});
test('widget defaults match Price',async()=>{const h=await(await call('/widget.js')).text();assert.match(h,/320px/);assert.match(h,/140px/);assert.match(h,/Bitcoin mempool/);});
test('blocks do not navigate away and footer keeps only home and rightmost Source',async()=>{
  upstream();const h=await(await call()).text();
  assert.match(h,/<button[^>]+class="block projected"/);assert.doesNotMatch(h,/<a[^>]+href="https:\/\/mempool.space/);
  const footer=h.match(/<footer[^>]*>(.*?)<\/footer>/s)[1];
  assert.equal([...footer.matchAll(/<a\b/g)].length,2);assert.match(footer,/>Source<\/a>$/);
});
test('Git deployment targets mempool and preserves dashboard-managed domains',async()=>{
  const config=readFileSync(new URL('../wrangler.toml',import.meta.url),'utf8');
  assert.match(config,/^name = "mempool"$/m);assert.match(config,/^main = "src\/index.js"$/m);
  assert.match(config,/^keep_vars = true$/m);assert.match(config,/^workers_dev = false$/m);
  assert.doesNotMatch(config,/^\s*(?:routes?|account_id|vars)\s*=|^\s*\[vars\]/m);
  upstream();const h=await(await call()).text();assert.match(h,/<a href="https:\/\/github.com\/blockdyor\/mempool">Source<\/a>/);
});
test('rejects incomplete mined-block response',async()=>{upstream({'/v1/blocks':[block]});assert.equal((await call('/api/mempool')).status,503);});
test('fallback expires during upstream timeout rather than extending ten-minute limit',async()=>{
  upstream();const d=await(await call('/api/mempool')).json();
  const now=Date.now,base=now();let elapsed=0;d.time=base-599999;
  globalThis.caches={default:{match:async()=>Response.json(d)}};
  globalThis.fetch=async()=>{elapsed=7001;throw Error('timeout');};
  Date.now=()=>base+elapsed;
  try{assert.equal((await call('/api/mempool')).status,503);}finally{Date.now=now;}
});
