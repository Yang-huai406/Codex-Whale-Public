import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const { createMacFollower } = createRequire(import.meta.url)('../desktop/macos/follow.cjs');

function fixture({ nativeVisibility = false } = {}) {
  const calls = [];
  let time = 0, mode = 'follow-codex', visible = false, manuallyHidden = false, orderFails = false;
  let sample = { ok: true, bound: true, visible: true, hostWindow: 123, overlayWindow: 789,
    spaces: ['1'], bounds: { x: 10, y: 20, width: 480, height: 340 } };
  const host = { hostAlive: true, hostPid: 42, window: '123' };
  const window = {
    isDestroyed: () => false, isVisible: () => visible,
    getNativeWindowHandle: () => Buffer.alloc(8),
    hide() { visible = false; calls.push(['hide']); },
    setBounds(bounds) { calls.push(['bounds', bounds]); },
    moveAbove(id) { calls.push(['above', id]); if (orderFails) throw new Error('window gone'); },
    setAlwaysOnTop(raised, level, relativeLevel) { calls.push(['level', raised, level, relativeLevel]); }
  };
  const follower = createMacFollower({ window, getMode: () => mode, getHost: () => host, now: () => time,
    ...(nativeVisibility ? { isVisible: () => visible } : {}),
    native: { sync() { calls.push(['sync']); return JSON.stringify(sample); } },
    applyHost(value) { calls.push(['apply', value]); visible = !!value.visible && !manuallyHidden; },
    onError(reason) { calls.push(['error', reason]); }
  });
  return { follower, host, calls, window, patch: value => { sample = { ...sample, ...value }; },
    setTime: value => { time = value; }, setMode: value => { mode = value; },
    setHidden: value => { manuallyHidden = value; }, setOrderFailure: value => { orderFails = value; } };
}

test('relative ordering uses native mapping even when Electron reports the visible companion hidden', () => {
  const f = fixture({ nativeVisibility: true });
  f.window.isVisible = () => false;
  f.follower.observe(f.host);
  assert.deepEqual(f.calls.at(-1), ['above', 'window:123:0']);
  f.calls.length = 0;
  f.patch({ hostWindow: 456 }); f.follower.observe({ ...f.host, window: '456' });
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'hide', 'apply', 'above']);
  f.setHidden(true); f.calls.length = 0; f.follower.tick();
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
});

test('settled stacking is not rewritten after blur; a real order change repairs once', () => {
  const f = fixture(); f.patch({ ordering: 'above' }); f.follower.observe(f.host);
  f.calls.length = 0;
  for (let i = 0; i < 1000; i++) f.follower.tick();
  assert.equal(f.calls.some(call => call[0] === 'above' || call[0] === 'hide' || call[0] === 'bounds'), false);
  f.patch({ ordering: 'misplaced' }); f.follower.tick();
  assert.equal(f.calls.filter(call => call[0] === 'above').length, 1);
  f.patch({ ordering: 'above' }); f.follower.tick();
  assert.equal(f.calls.filter(call => call[0] === 'above').length, 1);
});

test('inactive Spaces and unavailable stacking snapshots never force an order', () => {
  const f = fixture();
  for (const ordering of ['offscreen', 'unknown']) {
    f.patch({ ordering }); f.follower.observe(f.host);
  }
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.window.isVisible(), true);
});

test('macOS follows directly above the verified host after showing, including unchanged bounds', () => {
  const f = fixture(); f.follower.observe(f.host);
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'bounds', 'apply', 'above']);
  assert.deepEqual(f.calls.at(-1), ['above', 'window:123:0']);
  f.calls.length = 0; f.follower.tick();
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'apply', 'above']);
});

test('macOS thumbnail compatibility keeps the host frame intact and reserves one point only in the companion', () => {
  const f = fixture();
  const bounds = { x: 120, y: 34, width: 1205, height: 890 };
  f.patch({ bounds }); f.follower.observe(f.host);
  const expected = { ...bounds, width: 1204 };
  assert.deepEqual(f.calls.find(call => call[0] === 'bounds')[1], expected);
  assert.deepEqual(f.calls.find(call => call[0] === 'apply')[1].bounds, bounds);
  assert.deepEqual(f.follower.snapshot().hostBounds, bounds);
  assert.deepEqual(f.follower.snapshot().overlayBounds, expected);
  f.calls.length = 0;
  for (let i = 0; i < 10; i++) f.follower.tick();
  assert.equal(f.calls.some(call => call[0] === 'bounds'), false, 'steady ticks must not accumulate the inset');
  f.patch({ bounds: { ...bounds, x: -1000, width: 900 } }); f.follower.tick();
  assert.deepEqual(f.calls.find(call => call[0] === 'bounds')[1], { x: -1000, y: 34, width: 899, height: 890 });
  f.calls.length = 0; f.follower.reset(); f.follower.tick();
  assert.deepEqual(f.calls.find(call => call[0] === 'bounds')[1], { x: -1000, y: 34, width: 899, height: 890 });
});

for (const guard of ['manual-hide', 'host-hidden']) test('macOS ordering respects ' + guard, () => {
  const f = fixture();
  if (guard === 'manual-hide') f.setHidden(true); else f.patch({ visible: false });
  f.follower.observe(f.host);
  assert.equal(f.window.isVisible(), false);
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
});

test('Space animation preserves the last binding without ordering, moving or showing', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ animating: true, bounds: { x: 600, y: 20, width: 480, height: 340 } });
  f.follower.tick();
  assert.deepEqual(f.calls, [['sync']]);
  assert.equal(f.follower.snapshot().animating, true);
});

test('standalone mode bypasses native following and relative ordering', () => {
  const f = fixture(); f.setMode('standalone'); f.follower.observe(f.host); f.follower.tick();
  assert.deepEqual(f.calls, []);
});

for (const failure of ['native-failure', 'stale-heartbeat']) test('macOS ordering fails closed on ' + failure, () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  if (failure === 'native-failure') f.patch({ ok: false, reason: 'host-window-gone' }); else f.setTime(2501);
  f.follower.tick();
  assert.equal(f.window.isVisible(), false);
  assert.equal(f.follower.snapshot().bound, false);
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
});

test('a replacement host is hidden before retargeting and uses the new window ID', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ hostWindow: 456 }); f.follower.observe({ ...f.host, window: '456' });
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'hide', 'apply', 'above']);
  assert.deepEqual(f.calls.at(-1), ['above', 'window:456:0']);
});

test('brief host state read failure keeps the verified companion visible', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ ok: false, reason: 'host-state-unavailable' });
  f.follower.tick(); f.setTime(249); f.follower.tick();
  assert.equal(f.window.isVisible(), true);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.follower.snapshot().transientReason, 'host-state-unavailable');
  assert.equal(f.calls.some(call => call[0] === 'hide' || call[0] === 'apply'), false);
  f.patch({ ok: true }); f.follower.tick();
  assert.equal(f.follower.snapshot().transientReason, undefined);
  assert.equal(f.calls.some(call => call[0] === 'hide'), false);
});

test('persistent host state failure and a different host still fail closed', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ ok: false, reason: 'host-state-unavailable' });
  f.follower.tick(); f.setTime(250); f.follower.tick();
  assert.equal(f.window.isVisible(), false);
  assert.equal(f.follower.snapshot().bound, false);
  f.patch({ ok: true }); f.follower.tick();
  assert.equal(f.window.isVisible(), true);
  f.calls.length = 0;
  f.patch({ ok: false, reason: 'host-state-unavailable' });
  f.follower.observe({ ...f.host, window: '456' });
  assert.equal(f.window.isVisible(), false);
  assert.equal(f.follower.snapshot().bound, false);
});

test('confirmed host hide and host-window loss bypass the transient grace period', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ visible: false }); f.follower.tick();
  assert.equal(f.window.isVisible(), false);
  f.patch({ visible: true }); f.follower.tick();
  assert.equal(f.window.isVisible(), true);
  f.patch({ ok: false, reason: 'host-state-unavailable' }); f.follower.tick();
  assert.equal(f.window.isVisible(), true);
  f.patch({ reason: 'host-window-gone' }); f.follower.tick();
  assert.equal(f.window.isVisible(), false);
  assert.equal(f.follower.snapshot().bound, false);
});

test('ordering failure keeps a verified binding and retries without remapping', () => {
  const f = fixture(); f.setOrderFailure(true); f.follower.observe(f.host);
  assert.equal(f.window.isVisible(), true);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.follower.snapshot().orderingError, 'relative-order-failed');
  f.setOrderFailure(false); f.calls.length = 0; f.follower.tick();
  assert.equal(f.window.isVisible(), true);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.follower.snapshot().orderingError, undefined);
  assert.equal(f.calls.some(call => call[0] === 'hide'), false);
  assert.deepEqual(f.calls.at(-1), ['above', 'window:123:0']);
});

const levelCalls = calls => calls.filter(call => call[0] === 'level');

test('lowering re-establishes host adjacency even when the old raised snapshot said above', () => {
  const f = fixture(); f.patch({ hostForeground: true, ordering: 'above' });
  f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ hostForeground: false }); f.follower.tick();
  assert.deepEqual(f.calls.filter(call => ['level', 'above'].includes(call[0])), [
    ['level', false, 'normal', 0], ['above', 'window:123:0'],
  ]);
  f.calls.length = 0; f.follower.tick();
  assert.equal(f.calls.some(call => ['level', 'above', 'hide'].includes(call[0])), false);
});

test('a manually hidden companion cannot acquire a foreground level or be reordered', () => {
  const f = fixture(); f.setHidden(true); f.patch({ hostForeground: true, ordering: 'misplaced' });
  f.follower.observe(f.host);
  assert.equal(f.window.isVisible(), false);
  assert.deepEqual(levelCalls(f.calls), [['level', false, 'normal', 0]]);
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
  f.calls.length = 0; f.setHidden(false); f.follower.tick();
  assert.deepEqual(levelCalls(f.calls), [['level', true, 'normal', 1]]);
});

test('an existing raised level stays untouched throughout a Space animation', () => {
  const f = fixture(); f.patch({ hostForeground: true, ordering: 'above' }); f.follower.observe(f.host);
  f.calls.length = 0; f.patch({ animating: true, hostForeground: false }); f.follower.tick();
  assert.deepEqual(f.calls, [['sync']]);
  assert.equal(f.follower.snapshot().foregroundLevel, true);
});

test('a foreground host raises one normal level once and steady ticks never repeat it', () => {
  const f = fixture(); f.patch({ hostForeground: true, ordering: 'misplaced' });
  f.follower.observe(f.host);
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'bounds', 'apply', 'level']);
  assert.deepEqual(levelCalls(f.calls), [['level', true, 'normal', 1]]);
  assert.equal(f.follower.snapshot().foregroundLevel, true);
  f.calls.length = 0;
  for (let i = 0; i < 1000; i++) f.follower.tick();
  // A raised companion must not re-assert its level, re-order, hide or remap.
  for (const kind of ['level', 'hide', 'bounds', 'above']) {
    assert.equal(f.calls.filter(call => call[0] === kind).length, 0, 'steady foreground ticks must not repeat ' + kind);
  }
  assert.deepEqual([...new Set(f.calls.map(call => call[0]))].sort(), ['apply', 'sync']);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.window.isVisible(), true);
});

test('a host leaving the foreground restores the normal level and still repairs a misplaced order once', () => {
  const f = fixture(); f.patch({ hostForeground: true, ordering: 'misplaced' });
  f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ hostForeground: false }); f.follower.tick();
  assert.deepEqual(levelCalls(f.calls), [['level', false, 'normal', 0]]);
  assert.deepEqual(f.calls.filter(call => call[0] === 'above'), [['above', 'window:123:0']]);
  assert.equal(f.follower.snapshot().foregroundLevel, false);
  f.calls.length = 0; f.patch({ ordering: 'above' });
  for (let i = 0; i < 100; i++) f.follower.tick();
  assert.equal(levelCalls(f.calls).length, 0);
  assert.equal(f.calls.some(call => call[0] === 'above'), false, 'a settled order is not rewritten after the level drops');
});

test('Space animation never touches the foreground level', () => {
  const f = fixture(); f.follower.observe(f.host); f.calls.length = 0;
  f.patch({ animating: true, hostForeground: true, bounds: { x: 600, y: 20, width: 480, height: 340 } });
  f.follower.tick();
  assert.deepEqual(f.calls, [['sync']]);
  assert.equal(levelCalls(f.calls).length, 0);
  assert.equal(f.follower.snapshot().foregroundLevel, undefined);
});

test('standalone mode never touches the foreground level', () => {
  const f = fixture(); f.patch({ hostForeground: true }); f.setMode('standalone');
  f.follower.observe(f.host); f.follower.tick();
  assert.deepEqual(f.calls, []);
  assert.equal(f.follower.snapshot().foregroundLevel, undefined);
});

test('reset clears the cached foreground level so the next tick re-applies it exactly once', () => {
  const f = fixture(); f.patch({ hostForeground: true, ordering: 'above' });
  f.follower.observe(f.host);
  assert.deepEqual(levelCalls(f.calls), [['level', true, 'normal', 1]]);
  f.calls.length = 0; f.follower.reset();
  assert.equal(f.follower.snapshot().foregroundLevel, undefined);
  f.follower.tick();
  assert.deepEqual(levelCalls(f.calls), [['level', true, 'normal', 1]]);
  f.calls.length = 0;
  for (let i = 0; i < 50; i++) f.follower.tick();
  assert.equal(levelCalls(f.calls).length, 0);
});

test('an older native module without hostForeground keeps the existing ordering behavior', () => {
  const f = fixture(); f.patch({ ordering: 'misplaced' });
  f.follower.observe(f.host);
  assert.equal('hostForeground' in f.follower.snapshot().native, false, 'the legacy probe snapshot carries no foreground flag');
  assert.equal(levelCalls(f.calls).length, 0);
  assert.deepEqual(f.calls.map(call => call[0]), ['sync', 'bounds', 'apply', 'above']);
  assert.equal(f.follower.snapshot().foregroundLevel, undefined);
  f.calls.length = 0; f.patch({ ordering: 'above' });
  for (let i = 0; i < 100; i++) f.follower.tick();
  assert.equal(levelCalls(f.calls).length, 0);
  assert.equal(f.calls.some(call => call[0] === 'above'), false);
  assert.equal(f.follower.snapshot().bound, true);
  assert.equal(f.window.isVisible(), true);
});
