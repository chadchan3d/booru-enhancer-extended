'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const PORT = 8775;
const root = __dirname;
const server = http.createServer((req,res)=>{
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  let file = url.pathname === '/' ? 'fixture.html' : url.pathname.slice(1);
  if (!['fixture.html'].includes(file)) {
    res.writeHead(404, {'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
    return res.end('not found');
  }
  const body = fs.readFileSync(path.join(root,file));
  res.writeHead(200, {
    'Content-Type':'text/html; charset=utf-8',
    'Cache-Control':'no-store',
    'Content-Length':body.length
  });
  res.end(body);
});
server.listen(PORT,'127.0.0.1',()=>console.log(`IB04 fixture listening at http://127.0.0.1:${PORT}`));
process.on('SIGINT',()=>server.close(()=>process.exit(0)));
