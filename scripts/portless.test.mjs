import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import http from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'portless-launcher-'));
const bin = join(here, 'portless/node_modules/portless/dist/cli.js');
const name = `launcher-${process.pid}`;
let env, proxyPort;
const children = new Set();
async function freePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
async function until(fn) {
  for (let n = 0; n < 100; n++) { if (fn()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for launcher');
}
function launch(profile, extra = {}, args = []) {
  const proc = spawn(process.execPath, [join(dir, 'scripts/portless.mjs'), profile, ...args], { cwd: dir, env: { ...env, ...extra }, stdio: 'pipe' });
  let output = '';
  proc.stdout.on('data', x => output += x);
  proc.stderr.on('data', x => output += x);
  proc.done = new Promise(resolve => proc.once('exit', (code, signal) => resolve({code, signal, output})));
  children.add(proc);
  proc.once('exit', () => children.delete(proc));
  return proc;
}
async function stop(proc) {
  proc.kill('SIGTERM');
  const result = await Promise.race([proc.done, new Promise((_, reject) => setTimeout(() => reject(new Error('Shutdown timed out')), 10000).unref())]);
  assert.equal(result.code, 143, result.output);
  const routes = JSON.parse(readFileSync(join(dir, 'state/routes.json')));
  assert.ok(!routes.some(r => r.hostname === `${name}.localhost`));
}
function record(file) { return JSON.parse(readFileSync(join(dir, file), 'utf8')); }
before(async () => {
  assert.ok(existsSync(bin), 'Run npm ci --prefix scripts/portless first');
  proxyPort = await freePort();
  env = { ...process.env, PORTLESS_BIN: bin, PORTLESS_STATE_DIR: join(dir, 'state'), PORTLESS_HTTPS: '0', PORTLESS_PORT: String(proxyPort), PORTLESS_LAN: '0', PORTLESS_TLD: 'localhost', BROWSER: join(dir, 'browser'), OPEN: '1' };
  delete env.PORTLESS; delete env.PORTLESS_ACTIVE; delete env.PORTLESS_URL; delete env.PORT;
  mkdirSync(join(dir, 'scripts'));
  copyFileSync(join(here, 'portless.mjs'), join(dir, 'scripts/portless.mjs'));
  copyFileSync(join(here, 'portless-trust.sh'), join(dir, 'scripts/portless-trust.sh'));
  writeFileSync(join(dir, 'scripts/portless.json'), JSON.stringify({web: {name,command:[process.execPath,'app.mjs'],portEnv:['HTTP_PORT'],urlEnv:['APP_URL']},fail:{name,command:[process.execPath,'-e','process.exit(7)']},cleanup:{name,command:['bash','cleanup.sh'],cleanup:[process.execPath,'-e',"require('node:fs').writeFileSync('post-cleaned','done')"]}}));
  writeFileSync(join(dir, 'app.mjs'), `import http from 'node:http'; import fs from 'node:fs';
const server=http.createServer((req,res)=>res.end('ready')).listen(Number(process.env.PORT), '127.0.0.1',()=>fs.writeFileSync(process.env.RECORD,JSON.stringify({pid:process.pid,port:server.address().port,url:process.env.APP_URL,httpPort:process.env.HTTP_PORT,args:process.argv.slice(2)})));
process.on('SIGTERM',()=>server.close(()=>process.exit(143)));
`);
  writeFileSync(join(dir, 'cleanup.sh'), `#!/usr/bin/env bash\ntrap 'trap - TERM INT; sleep 0.3; touch cleaned; exit 143' TERM INT\ntouch cleanup-ready\nwhile true; do sleep 1; done\n`);
  writeFileSync(join(dir, 'browser'), `#!/usr/bin/env node\nrequire('node:fs').appendFileSync(${JSON.stringify(join(dir, 'opened'))}, process.argv[2]+'\\n');\n`, {mode:0o755});
  const result=spawnSync(process.execPath,[bin,'proxy','start','--port',String(proxyPort),'--no-tls'],{env,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
});
after(async () => {
  for (const proc of children) { proc.kill('SIGTERM'); await proc.done; }
  spawnSync(process.execPath,[bin,'proxy','stop'],{env,stdio:'ignore'});
  rmSync(dir,{recursive:true,force:true});
});
test('default opens the named URL once, forwards arguments, and maps the real port', async () => {
  const proc=launch('web',{RECORD:join(dir,'first')},['--','a b']);
  await until(()=>existsSync(join(dir,'first')) && existsSync(join(dir,'opened')));
  const r=record('first');
  assert.deepEqual(r.args,['a b']);
  assert.equal(r.httpPort,String(r.port));
  assert.equal(r.url,`http://${name}.localhost:${proxyPort}`);
  assert.equal(readFileSync(join(dir,'opened'),'utf8'),r.url+'\n');
  const body=await new Promise((resolve,reject)=>http.get({host:'127.0.0.1',port:proxyPort,headers:{host:`${name}.localhost`}},res=>{let body='';res.on('data',x=>body+=x);res.on('end',()=>resolve(body));}).on('error',reject));
  assert.equal(body,'ready');
  await stop(proc);
  assert.throws(()=>process.kill(r.pid,0));
});
test('OPEN=0 keeps the server running without launching a browser', async () => {
  const before=readFileSync(join(dir,'opened'),'utf8');
  const proc=launch('web',{OPEN:'0',RECORD:join(dir,'second')});
  await until(()=>existsSync(join(dir,'second')));
  await new Promise(r=>setTimeout(r,700));
  assert.equal(readFileSync(join(dir,'opened'),'utf8'),before);
  await stop(proc);
});
test('PORTLESS=0 preserves the raw command and skips proxy environment injection', async () => {
  const proc=launch('web',{PORTLESS:'0',PORT:String(await freePort()),RECORD:join(dir,'raw')});
  await until(()=>existsSync(join(dir,'raw')));
  assert.equal(record('raw').url,undefined);
  assert.equal(record('raw').httpPort,undefined);
  await stop(proc);
});
test('startup failure returns its original exit code and removes its route', async () => {
  const result=await launch('fail').done;
  assert.equal(result.code,7,result.output);
  assert.ok(!JSON.parse(readFileSync(join(dir,'state/routes.json'))).some(r=>r.hostname===`${name}.localhost`));
});

test('a rejected duplicate name cannot clean up the running application', async () => {
  const proc=launch('web',{OPEN:'0',RECORD:join(dir,'duplicate-ready')});
  await until(()=>existsSync(join(dir,'duplicate-ready')));
  const result=await launch('cleanup',{OPEN:'0'}).done;
  assert.equal(result.code,1,result.output);
  assert.ok(!existsSync(join(dir,'post-cleaned')));
  await stop(proc);
});
test('a shell can finish its cleanup trap without receiving duplicate signals', async () => {
  const proc=launch('cleanup',{OPEN:'0'});
  await until(()=>existsSync(join(dir,'cleanup-ready')));
  await stop(proc);
  assert.ok(existsSync(join(dir,'cleaned')), 'cleanup trap was interrupted');
  assert.ok(existsSync(join(dir,'post-cleaned')), 'post-exit cleanup did not finish');
});
