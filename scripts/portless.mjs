#!/usr/bin/env node
// Repository-local Portless launcher. Keep the proxy shared; stop only this app.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, delimiter } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import { tmpdir } from 'node:os';

const self = fileURLToPath(import.meta.url);
const root = resolve(dirname(self), '..');
const profiles = JSON.parse(readFileSync(resolve(root, 'scripts/portless.json'), 'utf8'));
const args = process.argv.slice(2);
const requested = args.shift();
const trustOnly = requested === 'trust';
const profile = trustOnly ? { command: [] } : profiles[requested];
if (!profile) throw new Error(`Choose a development profile: ${Object.keys(profiles).join(', ')}`);
const childMode = args[0] === '--child';
if (childMode) args.shift();
if (args[0] === '--') args.shift();
const cwd = resolve(root, profile.cwd ?? '.');
const env = { ...process.env };
for (const [key, value] of Object.entries(profile.env ?? {})) env[key] ??= value;
// Raw tools remain discoverable when launched from Make or a workspace root.
env.PATH = [resolve(cwd, 'node_modules/.bin'), resolve(root, 'node_modules/.bin'), env.PATH].join(delimiter);
const command = [...profile.command, ...args];
if (args[0] === '--check') {
  console.log(JSON.stringify({ ...profile, cwd }));
  process.exit(0);
}

function sync(command, argv, capture = false) {
  const result = spawnSync(command, argv, { cwd: root, env, stdio: capture ? ['inherit', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout?.trim();
}

function run(command, argv, options = {}) {
  const { forwardSignals = true, onExit, ...spawnOptions } = options;
  const child = spawn(command, argv, { cwd, env, stdio: 'inherit', ...spawnOptions });
  let stopping = false;
  const stop = signal => {
    if (stopping) return;
    stopping = true;
    if (!forwardSignals) return; // Portless already signals the entire app process tree.
    if (options.detached && process.platform !== 'win32') {
      try { process.kill(-child.pid, signal); } catch {}
    } else child.kill(signal);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => {
    let status = code ?? (signal === 'SIGINT' ? 130 : 143);
    try { onExit?.(); } catch (error) { console.error(error.message); status ||= 1; }
    process.exit(status);
  });
  return child;
}

function openWhenReady() {
  if (env.OPEN === '0' || env.BROWSER === 'none') return;
  let attempts = 0;
  let opened = false;
  const timer = setInterval(() => {
    if (++attempts > 1200) { clearInterval(timer); return; }
    const req = http.get({ host: '127.0.0.1', port: Number(env.PORT), path: '/', headers: { host: new URL(env.PORTLESS_URL).host }, timeout: 1000 }, res => {
      res.resume();
      if (opened || res.statusCode >= 500) return;
      opened = true;
      clearInterval(timer);
      const opener = env.BROWSER || (process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer.exe' : 'xdg-open');
      const browser = spawn(opener, [env.PORTLESS_URL], { stdio: 'ignore', detached: true });
      browser.on('error', () => console.warn(`Open ${env.PORTLESS_URL} in your browser.`));
      browser.unref();
    });
    req.on('timeout', () => req.destroy());
    req.on('error', () => {});
  }, 500);
  timer.unref();
}

if (!trustOnly && env.PORTLESS === '0') {
  run(command[0], command.slice(1), { detached: process.platform !== 'win32' });
} else if (!trustOnly && (childMode || env.PORTLESS_ACTIVE === '1')) {
  const nested = env.PORTLESS_ACTIVE === '1';
  env.PORTLESS_ACTIVE = '1';
  if (childMode && env.PORTLESS_STARTED_FILE) writeFileSync(env.PORTLESS_STARTED_FILE, 'started');
  for (const key of profile.portEnv ?? []) env[key] = env.PORT;
  for (const key of profile.urlEnv ?? []) env[key] ??= env.PORTLESS_URL;
  run(command[0], command.slice(1), { forwardSignals: false });
  if (!nested) openWhenReady();
} else {
  if (Number(process.versions.node.split('.')[0]) < 24) throw new Error('Portless needs Node.js 24+. Use PORTLESS=0 for the original development command.');
  const tools = resolve(root, 'scripts/portless');
  const bin = env.PORTLESS_BIN ?? resolve(tools, 'node_modules/portless/dist/cli.js');
  if (!existsSync(bin)) sync('npm', ['ci', '--prefix', tools, '--no-audit', '--no-fund']);
  env.PORTLESS_LAN = '0';
  env.PORTLESS_TLD = 'localhost';
  env.PORTLESS_HTTPS ??= '1';
  env.PORTLESS_PORT ??= env.PORTLESS_HTTPS === '0' ? '80' : '443';
  // Do certificate/privileged-port setup with stdin attached, before app launchers.
  if (trustOnly) sync(process.execPath, [bin, 'trust']);
  else sync(process.execPath, [bin, 'proxy', 'start', '--port', env.PORTLESS_PORT]);
  if (process.platform === 'linux' && env.PORTLESS_HTTPS !== '0') {
    sync('bash', [resolve(root, 'scripts/portless-trust.sh')]);
  }
  if (trustOnly) process.exit(0);
  const url = sync(process.execPath, [bin, 'get', profile.name], true);
  for (const key of profile.urlEnv ?? []) env[key] ??= url;
  const appPort = profile.appPortEnv ? env[profile.appPortEnv] : undefined;
  const cleanupDir = profile.cleanup ? mkdtempSync(resolve(tmpdir(), 'portless-cleanup-')) : null;
  if (cleanupDir) env.PORTLESS_STARTED_FILE = resolve(cleanupDir, 'started');
  run(process.execPath, [bin, '--name', profile.name, ...(appPort ? ['--app-port', appPort] : []), process.execPath, self, Object.keys(profiles).find(key => profiles[key] === profile), '--child', ...args], {
    // Only this wrapper receives terminal signals; Portless manages its app tree.
    detached: process.platform !== 'win32',
    onExit() {
      if (!cleanupDir) return;
      try {
        // Compose may need longer than Portless's ten-second shutdown window.
        // A rejected name/startup must never stop another already-running stack.
        if (existsSync(env.PORTLESS_STARTED_FILE)) {
          const result = spawnSync(profile.cleanup[0], profile.cleanup.slice(1), { cwd, env, stdio: 'inherit' });
          if (result.error || result.status !== 0) throw new Error('Development stack cleanup failed; run the documented stop command.');
        }
      } finally { rmSync(cleanupDir, { recursive: true, force: true }); }
    },
  });
}
