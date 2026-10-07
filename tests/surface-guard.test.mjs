import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const { createSurfaceGuard } = require('../desktop/surface-guard.cjs');
const { validateWindowShape } = require('../desktop/window-shape.cjs');
const rects = [{ x: 100, y: 50, width: 180, height: 120 }], viewport = { width: 1200, height: 800 };
function fixture() {
  let time = 1, retries = 0, restored = 0; const revocations = [];
  const guard = createSurfaceGuard({ instance: 'test-instance', now: () => time, revoke: r => revocations.push(r), retry: () => retries++, restored: () => restored++ });
  return { guard, revocations, advance: n => { time += n; guard.tick(); }, retries: () => retries, restored: () => restored,
    prepare: (v = viewport, h = '123') => guard.next(rects, v, h), ack: (request, patch = {}) => guard.accept({ ...request, ok: true, revocations: 0, ...patch }) };
}
test('startup stays hidden until the current native region is verified', () => {
  const f = fixture(), r = f.prepare(); assert.equal(f.guard.ready(), false);
  assert.equal(f.ack(r), true); assert.equal(f.guard.ready(), true); assert.equal(f.restored(), 1);
  f.ack(r); assert.equal(f.restored(), 1, 'duplicate proof does not reset input or remap');
});
test('instance, viewport epoch, HWND, dimensions and shape sequence all bind native ACKs', () => {
  for (const patch of [{ instance: 'old-instance' }, { epoch: 0 }, { sequence: 0 }, { sequence: 2 }, { handle: '456' }, { width: 1199 }, { height: 801 }]) {
    const f = fixture(), r = f.prepare(); assert.equal(f.ack(r, patch), false); assert.equal(f.guard.ready(), false);
  }
});
test('ordinary animation updates retain proof without per-frame hide/show', () => {
  const f = fixture(), first = f.prepare(); f.ack(first);
  for (let n = 0; n < 300; n++) { f.prepare(); f.advance(16); assert.equal(f.guard.ready(), true); }
  assert.deepEqual(f.revocations, []); assert.equal(f.restored(), 1); assert.equal(f.retries(), 0);
});
test('unverified startup permits one outstanding shape so continuous animation cannot starve ACK', () => {
  const f = fixture(); assert.equal(f.guard.canApply(), true); const request = f.prepare();
  for (let n = 0; n < 100; n++) assert.equal(f.guard.canApply(), false);
  f.ack(request); assert.equal(f.guard.canApply(), true);
  const hiddenRequest = f.guard.next(rects, viewport, '123', { retainProof: false });
  assert.equal(f.guard.ready(), false); assert.equal(f.guard.canApply(), false);
  f.ack(hiddenRequest); assert.equal(f.guard.ready(), true);
});
test('stale mismatch from an earlier frame cannot revoke a newer region', () => {
  const f = fixture(), old = f.prepare(); f.ack(old); const current = f.prepare();
  assert.equal(f.ack(old, { ok: false }), false); assert.equal(f.guard.ready(), true);
  assert.equal(f.ack(current), true);
});
test('a real native hide revokes even if animation advanced before the report arrived', () => {
  const f = fixture(), old = f.prepare(); f.ack(old); f.prepare();
  f.ack(old, { ok: false, revocations: 1 }); assert.equal(f.guard.ready(), false);
  assert.ok(f.revocations.includes('native-surface-revoked'));
  assert.equal(f.ack(old), false, 'old success still cannot restore the revoked window');
});
test('resize revokes proof and a late previous-viewport ACK cannot restore it', () => {
  const f = fixture(), old = f.prepare(); f.ack(old); f.guard.reset();
  assert.equal(f.guard.ready(), false); assert.equal(f.ack(old), false);
  const current = f.prepare({ width: 800, height: 600 }); f.ack(current); assert.equal(f.guard.ready(), true);
});
test('failure invalidates earlier successful ACKs until a fresh apply is verified', () => {
  const f = fixture(), old = f.prepare(); f.ack(old); f.guard.fail('shape-apply-failed');
  assert.equal(f.ack(old), false); assert.equal(f.guard.ready(), false);
  f.advance(1000); const fresh = f.prepare(); assert.ok(fresh.epoch > old.epoch);
  assert.equal(f.ack(old), false); f.ack(fresh); assert.equal(f.guard.ready(), true);
});
test('native failure immediately revokes readiness and bounded retries require new proof', () => {
  const f = fixture(); let r = f.prepare(); f.ack(r);
  for (let n = 0; n < 10; n++) {
    f.ack(r, { ok: false, reason: 'native-region-missing', revocations: n + 1 });
    assert.equal(f.guard.ready(), false); f.advance(1000); r = f.prepare();
  }
  assert.equal(f.retries(), 3); assert.equal(f.guard.snapshot().attempts, 3);
  assert.equal(f.guard.ready(), false); f.ack(r); assert.equal(f.guard.ready(), true);
});
test('manual recovery rearms a spent budget but never shows before verified recovery', () => {
  const f = fixture(); for (let n = 0; n < 3; n++) { f.guard.fail('test'); f.advance(1000); }
  f.guard.manualRecovery(); assert.equal(f.guard.ready(), false); f.advance(1000); assert.equal(f.retries(), 4);
});
test('only a sustained healthy interval rearms the automatic retry budget', () => {
  const f = fixture(); f.guard.fail('test'); f.advance(1000); const r = f.prepare(); f.ack(r);
  f.advance(29999); assert.equal(f.guard.snapshot().attempts, 1);
  f.advance(1); assert.equal(f.guard.snapshot().attempts, 0);
});
test('missing or unparseable native responses time out even if renderer changes geometry', () => {
  const f = fixture(); f.prepare(); for (let n = 0; n < 30; n++) { f.prepare(); f.advance(100); }
  assert.ok(f.revocations.includes('native-verification-timeout')); assert.ok(f.retries() >= 1); assert.equal(f.guard.ready(), false);
});
test('a native revocation missed between host messages resets input on fresh successful proof', () => {
  const f = fixture(), r = f.prepare(); f.ack(r); f.ack(r, { revocations: 1 });
  assert.ok(f.revocations.includes('native-surface-revoked')); assert.equal(f.restored(), 2); assert.equal(f.guard.ready(), true);
});
test('dispose rejects queued native replies and cancels automatic retries', () => {
  const f = fixture(), r = f.prepare(); f.guard.fail('test'); f.guard.dispose(); f.advance(5000);
  assert.equal(f.ack(r), false); assert.equal(f.retries(), 0); assert.equal(f.guard.ready(), false);
});
test('a stalled native monitor revokes even when its last result was healthy', () => {
  let time = 10000; const errors = [];
  const guard = createSurfaceGuard({ instance: 'heartbeat-instance', now: () => time, requireHeartbeat: true, revoke: r => errors.push(r), retry() {} });
  const r = guard.next(rects, viewport, '123'); guard.observeHeartbeat(time); guard.accept({ ...r, ok: true });
  time += 2500; guard.tick(); assert.equal(guard.ready(), true);
  guard.observeHeartbeat(10000); time += 501; guard.tick(); assert.equal(guard.ready(), false);
  assert.ok(errors.includes('native-monitor-timeout')); assert.equal(guard.accept({ ...r, ok: true }), false);
});
test('the real main apply function revokes a formerly healthy surface on native API failure', () => {
  const source = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  const apply = source.slice(source.indexOf('function applyWindowShape('), source.indexOf('function setKeyboardFocus('));
  const f = fixture(), request = f.prepare(); f.ack(request);
  const box = { usesWindowShape: true, usesSurfaceGuard: true, quitting: false, surfaceGuard: f.guard, windowShape: rects,
    validateWindowShape, windowShapeError: null, diagnose() {},
    window: { isDestroyed: () => false, isVisible: () => true, webContents: { isDestroyed: () => false }, getContentBounds: () => viewport, setShape() { throw new Error('native API failed'); } } };
  vm.runInNewContext(apply + ';applyWindowShape(' + JSON.stringify(rects) + ')', box);
  assert.equal(f.guard.ready(), false); assert.ok(f.revocations.includes('shape-apply-failed'));
});
test('real apply coalesces hidden animation through the owned-window delayed show', () => {
  const source = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  const apply = source.slice(source.indexOf('function applyWindowShape('), source.indexOf('function setKeyboardFocus('));
  const f = fixture(), request = f.prepare(); f.ack(request);
  let visible = false, applied = 0; const published = [];
  const handle = Buffer.alloc(8); handle.writeBigUInt64LE(123n);
  const box = { usesWindowShape: true, usesSurfaceGuard: true, rendererReady: true, quitting: false, surfaceGuard: f.guard,
    windowShape: rects, windowShapeError: null, deferredShape: null, validateWindowShape, diagnose() {}, invalidate() {}, visibility() {},
    publishSurface: p => published.push(p),
    window: { isDestroyed: () => false, isVisible: () => visible, webContents: { isDestroyed: () => false }, getContentBounds: () => viewport,
      getNativeWindowHandle: () => handle, setShape() { applied++; } } };
  vm.createContext(box); vm.runInContext(apply, box);
  for (let n = 0; n < 100; n++) box.applyWindowShape([{ ...rects[0], x: n }]);
  assert.equal(applied, 0); assert.equal(f.guard.snapshot().sequence, request.sequence); assert.equal(f.guard.ready(), true);
  visible = true; const latest = box.deferredShape; box.deferredShape = null; box.applyWindowShape(latest);
  assert.equal(applied, 1); assert.equal(published.length, 1); assert.equal(published[0].rects[0].x, 99); assert.equal(f.guard.ready(), true);
});
