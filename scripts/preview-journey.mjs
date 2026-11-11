import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {realpath,stat} from 'node:fs/promises';
import {dirname,extname,relative,resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.PREVIEW_PORT||8877);
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.mp4':'video/mp4','.webp':'image/webp','.mp3':'audio/mpeg','.ttf':'font/ttf'};
// The phone preview exposes frontend files only, never the database or handoff.
createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Cache-Control','no-cache');
 if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
 try{
  const url=new URL(req.url,'http://preview.invalid');
  if(url.pathname==='/'){res.writeHead(302,{Location:'/ScinScope/'}).end();return;}
  let path=decodeURIComponent(url.pathname);
  if(!path.startsWith('/ScinScope/')){res.writeHead(404).end();return;}
  path=path.slice('/ScinScope/'.length)||'index.html';
  if(path.split('/').some(part=>part.startsWith('.'))){res.writeHead(404).end();return;}
  if(path!=='index.html'&&!/^(app|assets|css|js|pages)\//.test(path)){res.writeHead(404).end();return;}
  const full=await realpath(resolve(root,path));
  if(!full.startsWith(root+sep)||!types[extname(full)]){res.writeHead(404).end();return;}
  const actual=relative(root,full);
  if(actual!=='index.html'&&!/^(app|assets|css|js|pages)\//.test(actual)){res.writeHead(404).end();return;}
  const file=await stat(full);if(!file.isFile()){res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':types[extname(full)],'Content-Length':file.size});
  if(req.method==='HEAD')res.end();else createReadStream(full).on('error',()=>res.destroy()).pipe(res);
 }catch{res.writeHead(404).end();}
}).listen(port,'0.0.0.0',()=>{
 const addresses=Object.values(networkInterfaces()).flat().filter(item=>item.family==='IPv4'&&!item.internal);
 for(const item of addresses)console.log(`Phone preview: http://${item.address}:${port}/ScinScope/`);
 console.log(`Local: http://127.0.0.1:${port}/ScinScope/\nFrontend only. Keep this computer awake and use the same Wi-Fi.`);
});
