import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const accountSource = fs.readFileSync(new URL('../desktop/ui/account-view.js', import.meta.url), 'utf8');
const widgetSource = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
function fixture(fetch) {
  const events = [], listeners = new Map(), elements = [];
  const window = {
    addEventListener(type, callback) { listeners.set(type, callback); },
    dispatchEvent(event) { events.push(event.type); listeners.get(event.type)?.(event); },
  };
  const context = { window, document: { readyState: 'loading', addEventListener() {}, querySelectorAll: () => elements },
    localStorage: { getItem: () => 'subscription' }, fetch, AbortController, setTimeout, clearTimeout,
    CustomEvent: class { constructor(type) { this.type = type; } }, state: {} };
  vm.createContext(context); vm.runInContext(accountSource, context);
  return { context, api: window.WhaleAccountView, events, elements };
}
const data = usedPercent => ({ ok: true, subscription: { available: true, windows: [{ windowDurationMins: 300, usedPercent }] } });
const response = value => ({ ok: true, json: async () => value });

test('manual refresh behind a background read performs one forced read shared by concurrent callers', async () => {
  const calls = []; let release;
  const f = fixture(url => { calls.push(url); return calls.length === 1 ? new Promise(resolve => { release = resolve; }) : Promise.resolve(response(data(60))); });
  const background = f.api.refresh(), manual = f.api.refresh({ force: true }), another = f.api.refresh({ force: true });
  release(response(data(20)));
  await Promise.all([background, manual, another]);
  assert.deepEqual(calls, ['/api/insights', '/api/insights?refresh=1']);
  assert.equal(f.api.snapshot.subscription.windows[0].usedPercent, 60);
  assert.deepEqual(f.events, ['whale-subscription-snapshot', 'whale-subscription-snapshot']);
});

test('closing a mode generation discards the pending snapshot and queued force upgrade', async () => {
  const calls = []; let release;
  const f = fixture(url => { calls.push(url); return new Promise(resolve => { release = resolve; }); });
  const background = f.api.refresh(), manual = f.api.refresh({ force: true });
  f.api.close(); release(response(data(20)));
  assert.equal(await background, null); assert.equal(await manual, null);
  assert.equal(f.api.snapshot, null); assert.deepEqual(f.events, []);
  assert.deepEqual(calls, ['/api/insights']);
});

test('refresh updates an existing subscription row without rebuilding the bubble, and failure clears its old quota', async () => {
  let used = 20, fail = false;
  const f = fixture(async () => fail ? { ok: false } : response(data(used)));
  f.context.accountMode = () => f.api.mode;
  f.context.subscriptionModule = type => f.api.bubbleModules[type];
  for (const [start, end] of [
    ['function bubbleContentTokenMap(', 'function bubbleTplHelpItems('],
    ['function bubbleContentText(', 'function bubbleMarqueeDur('],
    ['function bubbleRowContentOf(', 'function bubbleRowsTo('],
  ]) vm.runInContext(widgetSource.slice(widgetSource.indexOf(start), widgetSource.indexOf(end)), f.context);
  const start = widgetSource.indexOf("window.addEventListener('whale-subscription-snapshot'");
  const end = widgetSource.indexOf("window.addEventListener('whale-account-view'", start);
  vm.runInContext(widgetSource.slice(start, end), f.context);
  await f.api.refresh();
  const row = vm.runInContext("bubbleRowContentOf({ type: 'quota5h', tpl: '剩余 {quota_5h_remaining}' })", f.context);
  const element = { textContent: row.txt, _whaleSubscriptionText: row.subscriptionText };
  f.elements.push(element); assert.equal(element.textContent, '剩余 80.0%');
  used = 60; await f.api.refresh({ force: true });
  assert.equal(f.elements[0], element); assert.equal(element.textContent, '剩余 40.0%');
  fail = true; await f.api.refresh({ force: true });
  assert.equal(element.textContent, '剩余 未知');
});
