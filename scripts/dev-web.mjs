#!/usr/bin/env node
import http from 'node:http';
import { watch } from 'node:fs';
import { lstat, readFile, readdir, realpath, stat } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clients = new Set();
let version = Date.now();
const escapeHtml = value => value.replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const reloadScript = `<script>
(() => {
  let version;
  const events = new EventSource('/__dev/events');
  events.onmessage = event => {
    if (version !== undefined && version !== event.data) location.reload();
    version = event.data;
  };
  window.addEventListener('pagehide', () => events.close(), { once: true });
})();
</script>`;
const mime = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf',
};

async function users() {
  return (await readdir(join(root, 'users'), { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => entry.name).sort();
}

// Resolve every served file inside its public directory, including symlinks.
async function publicFile(directory, pathname) {
  if (!(await lstat(directory)).isDirectory()) return null;
  const base = await realpath(directory);
  const file = await realpath(join(base, pathname));
  if (file !== base && !file.startsWith(base + sep)) return null;
  return { file, info: await stat(file) };
}

function send(req, res, status, type, body) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer(async (req, res) => {
  try {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.setHeader('allow', 'GET, HEAD');
      return send(req, res, 405, mime['.txt'], 'Method not allowed');
    }
    let pathname;
    try { pathname = decodeURIComponent(req.url.split('?')[0]); }
    catch { return send(req, res, 400, mime['.txt'], 'Bad path'); }
    if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0') ||
        pathname.split('/').some(part => part.startsWith('.'))) {
      return send(req, res, 404, mime['.txt'], 'Not found');
    }
    if (pathname === '/__dev/events' && req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no' });
      res.write(`data: ${version}\n\n`);
      clients.add(res);
      res.on('close', () => clients.delete(res));
      return;
    }

    let content, type = mime['.html'];
    if (pathname === '/' || pathname === '/index.html') {
      const [template, readme, names] = await Promise.all([
        readFile(join(root, 'share/templates/index.html.tmpl'), 'utf8'),
        readFile(join(root, 'README'), 'utf8'), users(),
      ]);
      const values = {
        readme: escapeHtml(readme),
        index_users: names.map(name => `<a href="/~${encodeURIComponent(name)}/">~${escapeHtml(name)}</a>`).join('\n'),
      };
      content = template.replace(/\$\{(readme|index_users)\}/g, (_, key) => values[key]);
    } else if (pathname === '/favicon.ico') {
      type = mime['.ico'];
      content = await readFile(join(root, 'share/favicon.ico'));
    } else {
      const match = /^\/~([^/]+)(\/.*)?$/.exec(pathname);
      if (!match || !(await users()).includes(match[1])) {
        return send(req, res, 404, mime['.txt'], 'Not found');
      }
      let directory = join(root, 'users', match[1], 'public_html');
      try { await stat(directory); }
      catch (error) {
        if (error.code !== 'ENOENT') throw error;
        directory = join(root, 'share/skel/public_html');
      }
      let entry = await publicFile(directory, match[2] ?? '/');
      if (entry?.info.isDirectory()) {
        if (!pathname.endsWith('/')) {
          res.writeHead(302, { location: pathname.split('/').map(encodeURIComponent).join('/') + '/' });
          return res.end();
        }
        const relative = (match[2] ?? '/') + 'index.html';
        try { entry = await publicFile(directory, relative); }
        catch (error) {
          if (error.code !== 'ENOENT') throw error;
          entry = await publicFile(directory, relative.replace(/index\.html$/, 'index.htm'));
        }
      }
      if (!entry?.info.isFile()) return send(req, res, 404, mime['.txt'], 'Not found');
      type = mime[extname(entry.file).toLowerCase()] ?? 'application/octet-stream';
      content = await readFile(entry.file);
    }
    if (type === mime['.html']) {
      content = content.toString();
      content = /<\/body>/i.test(content)
        ? content.replace(/<\/body>/i, () => reloadScript + '</body>')
        : content + reloadScript;
    }
    send(req, res, 200, type, content);
  } catch (error) {
    const missing = ['ENOENT', 'ENOTDIR'].includes(error.code);
    if (!missing) console.error(error);
    send(req, res, missing ? 404 : 500, mime['.txt'], missing ? 'Not found' : 'Unable to render page; see terminal.');
  }
});

let debounce;
function changed() {
  clearTimeout(debounce);
  debounce = setTimeout(() => {
    version++;
    for (const client of clients) client.write(`data: ${version}\n\n`);
  }, 100);
}
const watchers = ['share', 'users'].map(directory => watch(join(root, directory), { recursive: true }, changed));
watchers.push(watch(root, (_, filename) => { if (filename?.toString() === 'README') changed(); }));
const heartbeat = setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
heartbeat.unref();
server.listen(Number(process.env.PORT ?? 5173), process.env.HOST ?? '127.0.0.1', () => {
  console.log(`Web preview: ${process.env.PORTLESS_URL ?? `http://127.0.0.1:${server.address().port}`}`);
  console.log('Watching homepage, README, user pages and assets for live reload.');
});
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  clearTimeout(debounce);
  clearInterval(heartbeat);
  watchers.forEach(watcher => watcher.close());
  clients.forEach(client => client.end());
  server.close();
  server.closeAllConnections();
});
server.on('error', error => { console.error(error.message); process.exit(1); });
