import http from 'node:http';
import worker from './src/index.js';
// Private test server: loopback only, never a public tunnel.
const server=http.createServer(async(req,res)=>{
  try {
    const r=await worker.fetch(new Request(new URL(req.url,'http://127.0.0.1:8788'),{method:req.method}));
    res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));
  } catch(e) { console.error(e);res.writeHead(500);res.end('Local server error'); }
});
server.listen(8788,'127.0.0.1',()=>console.log('MEMPOOL_READY http://127.0.0.1:8788'));
