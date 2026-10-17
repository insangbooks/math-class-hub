import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Optional private sibling repository; other load errors must remain visible.
let diaryRoute;
const moduleUrl = new URL('../../일기장/server.mjs', import.meta.url);
const diaryExists = await stat(moduleUrl).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;});
if (diaryExists) ({ diaryRoute } = await import(moduleUrl.href));
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.webmanifest':'application/manifest+json; charset=utf-8','.png':'image/png','.bcmap':'application/octet-stream','.pfb':'application/octet-stream','.ttf':'font/ttf','.wasm':'application/wasm'};
const port=Number(process.env.MATH_HUB_PORT||4175);
const server=http.createServer(async(req,res)=>{
  if(diaryRoute && await diaryRoute(req,res,port))return;
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",'Cache-Control':'no-cache'};
  if(!['GET','HEAD'].includes(req.method||'')){res.writeHead(405,headers);res.end();return;}
  try {
    const decoded=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);
    const route=decoded.endsWith('/')?decoded+'index.html':decoded;
    const file=path.resolve(root,'.'+route);
    const mime=types[path.extname(file)]||(path.basename(file)==='LICENSE'?'text/plain; charset=utf-8':null);
    if(!file.startsWith(root+path.sep)||!mime||(await stat(file)).isDirectory()){res.writeHead(404,headers);res.end('Not found');return;}
    const body=await readFile(file);res.writeHead(200,{...headers,'Content-Type':mime});res.end(req.method==='HEAD'?undefined:body);
  }catch{res.writeHead(404,headers);res.end('Not found');}
});
server.listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'Preview port is already in use.':'Preview server could not start.');process.exitCode=1;});
