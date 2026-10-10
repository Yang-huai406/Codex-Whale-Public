import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const engine = fs.readFileSync(new URL('../desktop/ui/audio-engine.js', import.meta.url), 'utf8');
function harness({ duration = 1 } = {}) {
  let now = 0, next = 0;
  const timers = new Map(), voices = [], listeners = {};
  const noop = () => {};
  const param = () => ({ setValueAtTime: noop, linearRampToValueAtTime: noop,
    exponentialRampToValueAtTime: noop, cancelAndHoldAtTime: noop, cancelScheduledValues: noop });
  class AudioContext {
    state = 'running'; destination = {};
    get currentTime() { return now; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
    close() { return Promise.resolve(); }
    decodeAudioData() { return Promise.resolve({ duration }); }
    createGain() { return { gain: param(), connect: noop, disconnect: noop }; }
    createBufferSource() {
      const node = { connect: noop, disconnect: noop, start(at) { node.startAt = at; },
        stop(at = now) { node.stopAt = at; } };
      voices.push(node); return node;
    }
    createOscillator() { return { ...this.createBufferSource(), frequency: param() }; }
  }
  const document = { hidden: false, addEventListener: (name, fn) => { listeners[name] = fn; } };
  const sandbox = { window: { addEventListener: noop }, document, AudioContext,
    performance: { now: () => now * 1000 }, fetch: async url => ({ ok: url !== 'missing', arrayBuffer: async () => new ArrayBuffer(0) }),
    setTimeout: (fn, ms) => { const id = ++next; timers.set(id, { at: now + ms / 1000, fn }); return id; },
    clearTimeout: id => timers.delete(id) };
  vm.runInNewContext(engine, sandbox);
  const flush = async () => { for (let n = 0; n < 30; n++) await Promise.resolve(); };
  async function advance(to) {
    await flush();
    for (;;) {
      const due = [...timers.entries()].filter(([, t]) => t.at <= to + 1e-9).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].fn(); await flush();
    }
    now = to; await flush();
  }
  const audio = sandbox.window.WhaleAudio;
  async function play(event, opts = {}) {
    const job = audio.play({ channel: 'gesture', event, url: event, ...opts });
    await flush(); return { job };
  }
  return { audio, voices, play, advance, document, listeners, flush };
}
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('quick release preserves 180ms of press, then fades over 30ms', async () => {
  const h = harness(); await h.play('press'); await h.advance(.1); const release = await h.play('release');
  assert.equal(h.voices.length, 1); assert.equal(h.voices[0].stopAt, undefined);
  await h.advance(.179); assert.equal(h.voices.length, 1);
  await h.advance(.18); await release.job;
  near(h.voices[1].startAt, .18); near(h.voices[0].stopAt, .21);
});
test('configured 400ms hold and zero hold both affect scheduling', async () => {
  for (const ms of [400, 0]) {
    const h = harness(); await h.play('press', { minPlayMs: ms }); await h.advance(.1);
    const release = await h.play('release', { minPlayMs: ms });
    await h.advance(Math.max(.1, ms / 1000)); await release.job;
    near(h.voices[1].startAt, Math.max(.1, ms / 1000));
  }
});
test('short samples end naturally instead of waiting for the configured minimum', async () => {
  const h = harness({ duration: .06 }); await h.play('press', { minPlayMs: 600 }); await h.advance(.04);
  const release = await h.play('release', { minPlayMs: 600 }); await h.advance(.06); await release.job;
  near(h.voices[1].startAt, .06); assert.equal(h.voices[0].stopAt, undefined);
});
test('long hold releases immediately once the minimum has passed', async () => {
  const h = harness(); await h.play('press'); await h.advance(.7); const r = await h.play('release');
  await r.job; near(h.voices[1].startAt, .7);
});
test('rapid clicking keeps only the latest pending feedback', async () => {
  const h = harness(); await h.play('press'); await h.advance(.1); const r1 = await h.play('release');
  await h.advance(.12); const p2 = await h.play('press'); await h.advance(.14); const r2 = await h.play('release');
  await h.advance(.18); await Promise.all([r1.job, p2.job, r2.job]);
  assert.equal(h.voices.length, 2); near(h.voices[1].startAt, .18);
  await h.advance(2); assert.equal(h.voices.length, 2);
});
test('stop and muted release cancel pending playback', async () => {
  for (const mute of [false, true]) {
    const h = harness(); await h.play('press'); await h.advance(.1); const r = await h.play('release');
    if (mute) await h.play('release', { preset: 'silent' }); else h.audio.stop('gesture');
    await h.advance(1); await r.job; assert.equal(h.voices.length, 1); near(h.voices[0].stopAt, .1);
  }
});
test('hidden document cancels queued sounds', async () => {
  const h = harness(); await h.play('press'); await h.advance(.1); const r = await h.play('release');
  h.document.hidden = true; h.listeners.visibilitychange(); await h.advance(1); await r.job;
  assert.equal(h.voices.length, 1);
});
test('preview and notification sounds do not interrupt the protected gesture', async () => {
  const h = harness(); await h.play('press'); await h.advance(.1);
  await h.audio.play({ channel: 'preview', url: 'preview' });
  await h.audio.play({ channel: 'notice', urls: ['first', 'second'] });
  assert.equal(h.voices[0].stopAt, undefined); near(h.voices[3].startAt, 1.1);
});
test('missing release audio leaves the existing press playing', async () => {
  const h = harness(); await h.play('press'); await h.advance(.1); const r = await h.play('release', { url: 'missing' });
  await r.job; assert.equal(h.voices.length, 1); assert.equal(h.voices[0].stopAt, undefined);
});
test('invalid duration falls back and large duration is clamped', async () => {
  for (const [value, expected] of [[null, .18], ['bad', .18], [9999, .6]]) {
    const h = harness(); await h.play('press', { minPlayMs: value }); await h.advance(.1); const r = await h.play('release');
    await h.advance(expected); await r.job; near(h.voices[1].startAt, expected);
  }
});
