import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { bus } from '../../src/core/state.js';

test('all source modules have one canonical cache URL at root and project subpaths', () => {
  const root = new URL('../../', import.meta.url);
  const html = readFileSync(new URL('index.html', root), 'utf8');
  const { imports } = JSON.parse(html.match(/<script type="importmap">([\s\S]*?)<\/script>/)[1]);
  const files = readdirSync(new URL('src/', root), { recursive: true }).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    const path = 'src/' + file;
    assert.equal(imports['/' + path], imports['./' + path], path);
    assert.ok(imports['/' + path]?.startsWith('./' + path + '?v='), path);
    const version = path.endsWith('.data.js') ? '20261028-data' : '20261030-polish1';
    assert.ok(imports['/' + path].endsWith('?v=' + version), path);
    if (!path.endsWith('.data.js')) {
      const source = readFileSync(new URL(path, root), 'utf8');
      assert.doesNotMatch(source, /(?:from\s*|import\s*\()\s*['"][^'"]+\.js\?v=/, path);
    }
  }
  const entry = html.match(/<script type="module" src="([^"]+)"/)[1];
  for (const base of ['https://example.org/', 'https://example.org/bung-bunty-rebar-world/']) {
    assert.equal(new URL(entry, base).href, new URL(imports['./src/main.js'], base).href);
  }
});

test('zone-scoped bus cleanup is idempotent and does not retain old callbacks', () => {
  let calls = 0;
  const stop = bus.on('test-zone-lifetime', () => calls++);
  bus.emit('test-zone-lifetime');
  stop();
  stop();
  bus.emit('test-zone-lifetime');
  assert.equal(calls, 1);
  assert.equal(bus._m.has('test-zone-lifetime'), false);
});
