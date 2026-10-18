import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
function fixture(command, extra = {}) {
  const root = mkdtempSync(join(tmpdir(), 'portless command space '));
  mkdirSync(join(root, 'scripts'));
  copyFileSync(join(here, 'portless.mjs'), join(root, 'scripts/portless.mjs'));
  writeFileSync(join(root, 'scripts/portless.json'), JSON.stringify({ probe: { command } }));
  const env = { ...process.env, PORTLESS: '0', OPEN: '0', ...extra };
  for (const key of ['PORTLESS_ACTIVE', 'PORTLESS_URL', 'PORTLESS_STARTED_FILE']) delete env[key];
  return { root, env, run(profile = 'probe') {
    return spawnSync(process.execPath, [join(root, 'scripts/portless.mjs'), profile], { env, encoding: 'utf8', timeout: 15000 });
  }, close() { rmSync(root, { recursive: true, force: true }); } };
}
test('npm shim works from an app path containing spaces', () => {
  const f = fixture(['npm', '--version']);
  try { const r = f.run(); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout.trim(), /^\d+\.\d+\.\d+$/); }
  finally { f.close(); }
});
for (const program of ['npm', 'npx']) test(`${program} preserves arguments without shell expansion`, { skip: process.platform !== 'win32' }, () => {
  const args = ['space in argument', '& echo NOT_A_COMMAND', '%PATH%', '^caret', '中文'];
  const f = fixture([program, ...args]);
  try {
    const cli = join(f.root, `${program}-cli.js`);
    writeFileSync(cli, `console.log(JSON.stringify(process.argv.slice(2)));`);
    f.env.npm_execpath = join(f.root, 'npm-cli.js');
    const r = f.run(); assert.equal(r.status, 0, r.stderr); assert.deepEqual(JSON.parse(r.stdout), args);
  } finally { f.close(); }
});
test('missing Portless is bootstrapped through the npm JavaScript entrypoint', { skip: process.platform !== 'win32' }, () => {
  const f = fixture(['unused']);
  try {
    delete f.env.PORTLESS; delete f.env.PORTLESS_BIN;
    const cli = join(f.root, 'npm-cli.js'); f.env.npm_execpath = cli;
    writeFileSync(cli, `const fs=require('node:fs'),p=require('node:path');const dir=p.join(process.argv[process.argv.indexOf('--prefix')+1],'node_modules/portless/dist');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(p.join(dir,'cli.js'),"console.log('FAKE_PROXY_TRUST');");`);
    const r = f.run('trust'); assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /FAKE_PROXY_TRUST/);
    assert.ok(existsSync(join(f.root, 'scripts/portless/node_modules/portless/dist/cli.js')));
  } finally { f.close(); }
});
test('Windows stop removes this launcher child and its descendant', { skip: process.platform !== 'win32' }, () => {
  const f = fixture([process.execPath, 'child.cjs']);
  try {
    writeFileSync(join(f.root, 'child.cjs'), `const fs=require('node:fs'),cp=require('node:child_process');if(process.argv.includes('--leaf'))setInterval(()=>{},1000);else{const p=cp.spawn(process.execPath,[__filename,'--leaf'],{stdio:'ignore'});fs.writeFileSync('pids.json',JSON.stringify([process.pid,p.pid]));setInterval(()=>{},1000);}`);
    const pids = join(f.root, 'pids.json');
    const launcher = join(f.root, 'scripts/portless.mjs');
    writeFileSync(launcher, readFileSync(launcher,'utf8') + `\nconst probe=setInterval(()=>{if(existsSync(${JSON.stringify(pids)})){clearInterval(probe);process.emit('SIGBREAK');}},100);`);
    const r=f.run(); assert.equal(r.error, undefined, r.stderr);
    for(const pid of JSON.parse(readFileSync(pids,'utf8'))) assert.throws(()=>process.kill(pid,0), `leftover PID ${pid}`);
  } finally { f.close(); }
});
