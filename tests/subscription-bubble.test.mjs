import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import { createWidgetHost } from '../lib/widget-host.mjs';

const source = fs.readFileSync(new URL('../desktop/ui/account-view.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} } };
vm.runInNewContext(source, sandbox);
const { bubbleValues, defaultBubbleModules } = sandbox.module.exports;

test('subscription bubble distinguishes zero remaining from unknown and preserves stale/partial markers', () => {
  const values = bubbleValues({ subscription: { available: true, windows: [
    { windowDurationMins: 300, usedPercent: 12.5, resetsAt: 1800000000000 },
    { windowDurationMins: 10080, usedPercent: 100, stale: true }
  ] }, tokens: { last5Hours: 0, total: 12345, complete: false } });
  assert.equal(values.quota_5h_remaining, '87.5%');
  assert.equal(values.quota_week_remaining, '0.0%（过期）');
  assert.equal(values.quota_week_reset, '未知（过期）');
  assert.equal(values.tokens_5h, '0（部分）');
  assert.match(values.tokens_7d, /部分/);
  assert.equal(bubbleValues(null).quota_5h_remaining, '未知');
  assert.equal(bubbleValues(null).tokens_5h, '暂无记录');
  assert.equal(bubbleValues({ subscription: { available: false, windows: [{ windowDurationMins: 300, usedPercent: 0 }] } }).quota_5h_remaining, '未知');
  for (const usedPercent of [null, -1, NaN, Infinity, '10']) {
    assert.equal(bubbleValues({ subscription: { available: true, windows: [{ windowDurationMins: 300, usedPercent }] } }).quota_5h_remaining, '未知');
  }
});

test('subscription default uses editable modules and each call returns fresh objects', () => {
  const first = defaultBubbleModules(); first[0].text = 'custom';
  const next = defaultBubbleModules();
  assert.equal(next[0].text, 'Codex 订阅');
  assert.deepEqual(Array.from(next, m => m.type), ['text', 'quota5h', 'quotaWeek']);
});

test('real bubble route isolates subscription settings, preserves legacy API file and revision protection', async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-bubble-test-'));
  const routes = new Map();
  createWidgetHost(dataDir).apply({ whale: {}, effect: () => {}, webServer: {
    register: route => { routes.set(route.path, route.handler); return () => {}; }, tapIndex: () => () => {}
  } });
  async function request(mode = '', body) {
    const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
    req.method = body === undefined ? 'GET' : 'POST';
    req.url = '/dsh-whale/bubble.json' + mode;
    let status, result;
    const res = { writeHead(value) { status = value; }, end(value) { result = JSON.parse(value); } };
    await routes.get('/dsh-whale/bubble.json')(req, res);
    return { status, ...result };
  }
  try {
    const original = { v: 1, items: [{ kind: 'custom', modules: [{ type: 'text', text: 'Existing API content' }] }], lib: [] };
    const apiFile = path.join(dataDir, '.dshw-bubble.json');
    const originalBytes = JSON.stringify(original, null, 2);
    fs.writeFileSync(apiFile, originalBytes);
    const api = await request();
    assert.deepEqual(api.config, original);
    assert.equal((await request('?mode=api')).revision, api.revision);
    const sub = await request('?mode=subscription');
    assert.equal(sub.config, null);
    const config = { v: 1, items: [{ kind: 'custom', modules: JSON.parse(JSON.stringify(defaultBubbleModules())) }], lib: [] };
    const saved = await request('?mode=subscription', { ...config, expectedRevision: sub.revision });
    assert.equal(saved.status, 200);
    assert.deepEqual((await request('?mode=subscription')).config, config);
    assert.equal(fs.readFileSync(apiFile, 'utf8'), originalBytes);
    assert.equal((await request()).revision, api.revision);
    assert.equal((await request('?mode=subscription', { ...config, expectedRevision: sub.revision })).status, 409);
    assert.equal((await request('?mode=api', { ...original, expectedRevision: api.revision })).status, 200);
    for (const query of ['?mode=', '?mode=bogus', '?mode=API', '?mode=../escape']) {
      assert.equal((await request(query, config)).status, 400);
    }
  } finally { fs.rmSync(dataDir, { recursive: true, force: true }); }
});
