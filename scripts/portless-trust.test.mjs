import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const here = dirname(fileURLToPath(import.meta.url));
for (const scenario of [
  { name: 'HTTPS checks browser trust before launching', https: '1', status: '0', profile: 'web', expected: ['proxy', 'browser-trust', 'get', '--name'], code: 0 },
  { name: 'failed browser trust prevents application launch', https: '1', status: '23', profile: 'web', expected: ['proxy', 'browser-trust'], code: 23 },
  { name: 'dev-trust repairs trust without launching services', https: '1', status: '0', profile: 'trust', expected: ['trust', 'browser-trust'], code: 0 },
  { name: 'HTTP bypasses certificate trust', https: '0', status: '23', profile: 'web', expected: ['proxy', 'get', '--name'], code: 0 },
]) {
  test(scenario.name, { skip: process.platform !== 'linux' }, () => {
    const dir = mkdtempSync(join(tmpdir(), 'portless-trust-entry-'));
    try {
      mkdirSync(join(dir, 'scripts'));
      copyFileSync(join(here, 'portless.mjs'), join(dir, 'scripts/portless.mjs'));
      writeFileSync(join(dir, 'scripts/portless.json'), JSON.stringify({ web: { name: 'test', command: ['unused'] } }));
      writeFileSync(join(dir, 'scripts/portless-trust.sh'), 'echo browser-trust >> "$TRUST_EVENTS"\nexit "$TRUST_STATUS"\n');
      const bin = join(dir, 'proxy.cjs');
      writeFileSync(bin, `require('fs').appendFileSync(process.env.TRUST_EVENTS, process.argv[2]+'\\n'); if(process.argv[2]==='get') console.log('https://test.localhost');`);
      const env = { ...process.env, PORTLESS_BIN: bin, PORTLESS_HTTPS: scenario.https, TRUST_STATUS: scenario.status, TRUST_EVENTS: join(dir, 'events') };
      delete env.PORTLESS; delete env.PORTLESS_ACTIVE; delete env.PORTLESS_URL;
      const result = spawnSync(process.execPath, [join(dir, 'scripts/portless.mjs'), scenario.profile], { env, encoding: 'utf8', timeout: 15000 });
      assert.equal(result.status, scenario.code, result.stderr);
      assert.deepEqual(readFileSync(join(dir, 'events'), 'utf8').trim().split('\n'), scenario.expected);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}
