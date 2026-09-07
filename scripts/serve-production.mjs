import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist/browser');
const html = await readFile(resolve(root, 'index.html'), 'utf8');
const base = html.match(/<base href="([^"]+)"/)?.[1] || '/';
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};
createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base !== '/' && path.startsWith(base)) path = path.slice(base.length);
    else path = path.replace(/^\//, '');
    let file = resolve(root, path || 'index.html');
    if (file !== root && !file.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    try {
      if (!(await stat(file)).isFile()) file = resolve(root, 'index.html');
    } catch {
      if (extname(path)) {
        res.writeHead(404).end();
        return;
      }
      file = resolve(root, 'index.html');
    }
    res.writeHead(200, {
      'Content-Type': types[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(await readFile(file));
  } catch {
    res.writeHead(500).end();
  }
}).listen(4300, '127.0.0.1', () => console.log('Production PWA: http://127.0.0.1:4300' + base));
