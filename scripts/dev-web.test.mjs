import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const source = join(dirname(fileURLToPath(import.meta.url)), '..');
let root, proc, done, port;

function request(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path, method }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', data => body += data);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), 'sandflow-web-test-'));
  for (const directory of ['scripts', 'share/templates', 'share/skel/public_html', 'users/alice', 'users/bob/public_html/assets', 'users/linked']) {
    await mkdir(join(root, directory), { recursive: true });
  }
  for (const file of ['scripts/dev-web.mjs', 'Makefile', 'share/templates/index.html.tmpl', 'share/skel/public_html/index.html', 'share/favicon.ico']) {
    await copyFile(join(source, file), join(root, file));
  }
  await writeFile(join(root, 'README'), 'Instructions <example> & details');
  await writeFile(join(root, 'config.env'), 'PRIVATE_CONFIG=do-not-serve');
  await writeFile(join(root, 'users/alice/id_rsa.pub'), 'do-not-serve');
  await writeFile(join(root, 'users/bob/public_html/index.html'), '<body>Bob home</body>');
  await writeFile(join(root, 'users/bob/public_html/assets/site.css'), 'body { color: gold; }');
  await symlink(join(root, 'config.env'), join(root, 'users/bob/public_html/leak.txt'));
  await symlink(root, join(root, 'users/linked/public_html'));
  const env = { ...process.env, PORT: '0', HOST: '127.0.0.1' };
  delete env.PORTLESS_URL;
  proc = spawn(process.execPath, ['scripts/dev-web.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  done = new Promise(resolve => proc.once('exit', (code, signal) => resolve({ code, signal })));
  let output = '';
  proc.stdout.on('data', data => { output += data; });
  proc.stderr.on('data', data => { output += data; });
  for (let i = 0; i < 100; i++) {
    const match = /http:\/\/127\.0\.0\.1:(\d+)/.exec(output);
    if (match) { port = Number(match[1]); return; }
    if (proc.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Server did not start: ' + output);
});

after(async () => {
  if (proc && proc.exitCode === null) proc.kill('SIGTERM');
  if (done) {
    const result = await Promise.race([done, new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timed out')), 5000).unref())]);
    assert.equal(result.code, 0);
  }
  if (root) await rm(root, { recursive: true, force: true });
});

test('homepage renders the existing template with local links and escaped README text', async () => {
  const response = await request('/');
  assert.equal(response.status, 200);
  assert.match(response.body, /<h1>sandflow\.club<\/h1>/);
  assert.match(response.body, /Instructions &lt;example&gt; &amp; details/);
  assert.match(response.body, /href="\/~alice\/"/);
  assert.ok(!response.body.includes('${index_users}'));
  assert.match(response.body, /EventSource\('\/__dev\/events'\)/);
  assert.equal(response.headers['cache-control'], 'no-store');
});

test('user pages use their public files or fall back to the existing skeleton', async () => {
  assert.match((await request('/~alice/')).body, /welcome down the rabbit hole/);
  assert.match((await request('/~bob/')).body, /Bob home/);
  const redirect = await request('/~bob');
  assert.equal(redirect.status, 302);
  assert.equal(redirect.headers.location, '/~bob/');
  const css = await request('/~bob/assets/site.css');
  assert.equal(css.status, 200);
  assert.equal(css.body, 'body { color: gold; }');
  assert.match(css.headers['content-type'], /^text\/css/);
  assert.equal((await request('/~missing/')).status, 404);
});

test('private paths, traversal and symlinks outside public directories are not served', async () => {
  for (const path of ['/config.env', '/Makefile', '/users/alice/id_rsa.pub', '/~alice/id_rsa.pub',
    '/~bob/%2e%2e/%2e%2e/config.env', '/~bob/leak.txt', '/~linked/config.env', '/~bob/.env']) {
    assert.equal((await request(path)).status, 404, path);
  }
  assert.equal((await request('/%ZZ')).status, 400);
});

test('HEAD and unsupported HTTP methods are handled correctly', async () => {
  const head = await request('/', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  const post = await request('/', 'POST');
  assert.equal(post.status, 405);
  assert.equal(post.headers.allow, 'GET, HEAD');
  assert.equal((await request('/favicon.ico')).status, 200);
});

test('editing a source file notifies live reload and changes the next response', { timeout: 5000 }, async () => {
  let stream;
  let req;
  try {
    const versions = [];
    await new Promise((resolve, reject) => {
      req = http.get({ host: '127.0.0.1', port, path: '/__dev/events' }, res => {
        stream = res;
        let pending = '';
        res.on('data', data => {
          pending += data;
          const lines = pending.split('\n\n');
          pending = lines.pop();
          for (const line of lines) if (line.startsWith('data: ')) {
            versions.push(line);
            if (versions.length === 1) {
              writeFile(join(root, 'README'), 'Updated instructions').catch(reject);
            } else resolve();
          }
        });
        res.on('error', reject);
      });
      req.on('error', reject);
    });
    assert.notEqual(versions[0], versions[1]);
    assert.match((await request('/')).body, /Updated instructions/);
  } finally {
    stream?.destroy();
    req?.destroy();
  }
});

test('make dev works without server configuration and invokes only the web launcher', async () => {
  await rm(join(root, 'config.env'));
  const result = spawnSync('make', ['--no-print-directory', '-n', 'dev'], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), 'node scripts/portless.mjs web');
  const setup = spawnSync('make', ['--no-print-directory', '-n', 'setup-gateway'], { cwd: root, encoding: 'utf8' });
  assert.notEqual(setup.status, 0, 'Server setup still requires explicit configuration');
});
