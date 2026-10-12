import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// 直接驱动真实的 desktop/ui/gesture.js：无浏览器、无网络、无凭证，
// 只注入假的 performance.now 与带计数的 body.style / offsetWidth。
const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, '..', 'desktop', 'ui', 'gesture.js'), 'utf8');

const EASE = 'cubic-bezier(.2,.8,.3,1.15)';

function boot() {
  let clock = 1_000;
  let reflows = 0;
  const writes = [];
  const window = {};
  const style = {};
  for (const key of ['transition', 'transform']) {
    let value = '';
    Object.defineProperty(style, key, {
      enumerable: true,
      get: () => value,
      set: next => { value = next; writes.push([key, next]); },
    });
  }
  const body = {
    style,
    get offsetWidth() { reflows += 1; return 300; },
  };
  vm.runInNewContext(source, { window, performance: { now: () => clock } });
  return {
    api: window.WhaleGesture,
    body,
    writes,
    advance: ms => { clock += ms; },
    reset: () => { writes.length = 0; },
    get reflows() { return reflows; },
  };
}

test('a tap shorter than 32ms commits the squash style and forces layout before the rebound', () => {
  const h = boot();
  h.api.apply(h.body, true, 'balanced');
  assert.equal(h.body.style.transform, 'scaleY(0.88) scaleX(1.05)');
  assert.equal(h.reflows, 0, 'pressing must not read offsetWidth');

  h.advance(20);
  h.reset();
  h.api.apply(h.body, false, 'balanced');

  assert.deepEqual(h.writes, [
    ['transition', 'none'],
    ['transform', 'scaleY(0.88) scaleX(1.05)'],
    ['transition', `transform 140ms ${EASE}`],
    ['transform', 'scaleY(1) scaleX(1)'],
  ]);
  assert.equal(h.reflows, 1, 'exactly one forced layout for a sub-32ms tap');
});

test('the sub-32ms window is exclusive at exactly 32ms', () => {
  const justUnder = boot();
  justUnder.api.apply(justUnder.body, true);
  justUnder.advance(31.9);
  justUnder.reset();
  justUnder.api.apply(justUnder.body, false);
  assert.equal(justUnder.reflows, 1);
  assert.equal(justUnder.writes[0][1], 'none');

  const boundary = boot();
  boundary.api.apply(boundary.body, true);
  boundary.advance(32);
  boundary.reset();
  boundary.api.apply(boundary.body, false);
  assert.equal(boundary.reflows, 0);
  assert.deepEqual(boundary.writes, [
    ['transition', `transform 140ms ${EASE}`],
    ['transform', 'scaleY(1) scaleX(1)'],
  ]);
});

test('a tap of 32ms or longer rebounds without forcing layout', () => {
  const h = boot();
  h.api.apply(h.body, true, 'soft');
  h.advance(48);
  h.reset();
  h.api.apply(h.body, false, 'soft');

  assert.equal(h.reflows, 0);
  assert.deepEqual(h.writes, [
    ['transition', `transform 155ms ${EASE}`],
    ['transform', 'scaleY(1) scaleX(1)'],
  ]);
});

test('a repeated release does not force layout again', () => {
  const h = boot();
  h.api.apply(h.body, true);
  h.advance(10);
  h.api.apply(h.body, false);
  assert.equal(h.reflows, 1);

  h.reset();
  h.api.apply(h.body, false);
  assert.equal(h.reflows, 1, 'the press record is consumed by the first release');
  assert.deepEqual(h.writes, [
    ['transition', `transform 140ms ${EASE}`],
    ['transform', 'scaleY(1) scaleX(1)'],
  ]);

  const neverPressed = boot();
  neverPressed.api.apply(neverPressed.body, false);
  assert.equal(neverPressed.reflows, 0);
  assert.deepEqual(neverPressed.writes, [
    ['transition', `transform 140ms ${EASE}`],
    ['transform', 'scaleY(1) scaleX(1)'],
  ]);
});

test('the committed squash comes from the press-time preset, not the release-time preset', () => {
  const h = boot();
  h.api.apply(h.body, true, 'crisp');
  h.advance(8);
  h.reset();
  h.api.apply(h.body, false, 'balanced');

  assert.equal(h.writes[1][1], 'scaleY(0.9) scaleX(1.05)');
  assert.equal(h.writes[2][1], `transform 140ms ${EASE}`);
  assert.equal(h.reflows, 1);
});

test('preset lookup honors the requested name and falls back to balanced', () => {
  const probe = boot();
  const names = Object.entries(probe.api.presets);
  assert.deepEqual(names.map(([name]) => name).sort(), ['balanced', 'crisp', 'soft']);

  for (const [name, preset] of names) {
    const h = boot();
    h.api.apply(h.body, true, name);
    assert.equal(h.body.style.transition, `transform ${preset.press}ms ${EASE}`, name);
    assert.equal(h.body.style.transform, `scaleY(${preset.squash}) scaleX(1.05)`, name);
    h.advance(1);
    h.api.apply(h.body, false, name);
    assert.equal(h.body.style.transition, `transform ${preset.release}ms ${EASE}`, name);
    assert.equal(h.body.style.transform, 'scaleY(1) scaleX(1)', name);
  }

  const balanced = probe.api.presets.balanced;
  for (const unknown of ['no-such-preset', undefined]) {
    const h = boot();
    h.api.apply(h.body, true, unknown);
    assert.equal(h.body.style.transition, `transform ${balanced.press}ms ${EASE}`, String(unknown));
    assert.equal(h.body.style.transform, `scaleY(${balanced.squash}) scaleX(1.05)`, String(unknown));
    h.advance(1);
    h.api.apply(h.body, false, unknown);
    assert.equal(h.body.style.transition, `transform ${balanced.release}ms ${EASE}`, String(unknown));
    assert.equal(h.body.style.transform, 'scaleY(1) scaleX(1)', String(unknown));
  }

  assert.ok(Object.isFrozen(probe.api.presets));
  assert.ok(Object.isFrozen(probe.api));
});
