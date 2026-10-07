import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ui = name => fs.readFileSync(new URL('../desktop/ui/' + name, import.meta.url), 'utf8');
const widget = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
const first = widget.indexOf('    function feedback(event) {');
const interactionFunctions = widget.slice(first, widget.indexOf('    function pressDown() {', first));

function fixture({ duration = .6, deferred = false, sample = () => 1 } = {}) {
  let now = 0, idle, contexts = 0, context;
  const nodes = [], requests = [], documentEvents = {}, windowEvents = {};
  // Sample the actual scheduled envelope, including the history before a
  // cancelled ramp. This permits offline continuity checks without audio output.
  class Param {
    value = 0; events = []; revisions = [];
    setValueAtTime(value, at) { this.events.push({ kind: 'set', value, at }); }
    linearRampToValueAtTime(value, at) { this.events.push({ kind: 'linear', value, at }); }
    exponentialRampToValueAtTime(value, at) { this.events.push({ kind: 'exp', value, at }); }
    cancelScheduledValues(at) { this.revisions.push({ at, events: this.events.slice() }); this.events = this.events.filter(e => e.at < at); }
    at(at) {
      const snapshot = this.revisions.find(r => at < r.at);
      const events = (snapshot ? snapshot.events : this.events).slice().sort((a, b) => a.at - b.at);
      let last = { at: 0, value: this.value };
      for (const event of events) {
        if (at < event.at) {
          if (event.kind === 'linear') return last.value + (event.value - last.value) * (at - last.at) / (event.at - last.at);
          if (event.kind === 'exp' && last.value > 0) return last.value * (event.value / last.value) ** ((at - last.at) / (event.at - last.at));
          return last.value;
        }
        last = event;
      }
      return last.value;
    }
  }
  class AudioContext {
    state = 'running'; destination = {};
    constructor() { contexts++; context = this; }
    get currentTime() { return now; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    decodeAudioData(url) { return Promise.resolve({ duration, url }); }
    createGain() { return { gain: new Param(), connect() {}, disconnect() { this.disconnectedAt = now; } }; }
    createBufferSource() {
      const node = {
        stopCalls: [], frequency: new Param(), connect(gain) { this.gain = gain; }, disconnect() { this.disconnectedAt = now; },
        start(at) { this.startAt = at; }, stop(at = now) { this.stopAt = at; this.stopCalls.push(at); },
      };
      nodes.push(node); return node;
    }
    createOscillator() { return this.createBufferSource(); }
  }
  const sandbox = {
    AudioContext, performance: { now: () => now * 1000 },
    setTimeout(fn) { idle = fn; return 1; }, clearTimeout() {},
    window: { addEventListener: (name, fn) => { windowEvents[name] = fn; } },
    document: { hidden: false, addEventListener: (name, fn) => { documentEvents[name] = fn; } },
    localStorage: { getItem: () => null },
    fetch: url => new Promise(resolve => { const request = { url, resolve: () => resolve({ ok: true, arrayBuffer: async () => url }) }; requests.push(request); if (!deferred) request.resolve(); }),
    soundSet: 'duck', soundVol: .5, soundOn: true, releasePlayed: false, pressAudio: null, releaseAudio: null,
    audioGroupSlotEmpty: () => false,
  };
  vm.createContext(sandbox);
  for (const code of [ui('audio-engine.js'), ui('preferences-v3.js'), interactionFunctions]) vm.runInContext(code, sandbox);
  const endAt = node => Math.min(node.stopAt ?? Infinity, node.startAt + (node.buffer?.duration ?? Infinity));
  return {
    api: sandbox.window.WhaleAudio, feedback: sandbox.window.WhaleFeedback, sandbox, nodes, requests,
    contexts: () => contexts, context: () => context, idle: () => idle(),
    setTime(time) {
      now = time;
      for (const node of nodes) if (!node.ended && endAt(node) <= now) { node.ended = true; node.onended?.(); }
    },
    async flush() { for (let i = 0; i < 24; i++) await Promise.resolve(); },
    press() { sandbox.playPress(); }, release() { sandbox.playRelease(); },
    hidden() { sandbox.document.hidden = true; documentEvents.visibilitychange(); },
    unload() { windowEvents.beforeunload(); },
    liveAt: at => nodes.filter(n => n.startAt <= at && endAt(n) > at && (n.disconnectedAt ?? Infinity) > at),
    output(at) { return nodes.reduce((sum, n) => sum + (n.startAt <= at && endAt(n) > at && (n.disconnectedAt ?? Infinity) > at ? n.gain.gain.at(at) * sample(at - n.startAt, n.buffer?.url) : 0), 0); },
  };
}

test('actual widget press/release crossfades nonzero samples in 8 ms and preserves prompt release', async () => {
  const f = fixture({ duration: 20 });
  f.press(); await f.flush(); f.setTime(.04); f.release(); await f.flush();
  assert.equal(f.nodes.length, 2);
  assert.equal(f.nodes[0].stopAt, .048);
  assert.equal(f.nodes[1].startAt, .04);
  // A constant nonzero input exposes hard cuts independently of sample phase.
  for (let i = 0; i < 384; i++) assert.ok(Math.abs(f.output(.04 + i / 48000) - .4) < 1e-9);
  f.setTime(.048); assert.equal(f.liveAt(.048).length, 1);
});

test('real press/release call chain is bounded at 1, 5, 10, 20 and 100 clicks/second with no queued replay', async () => {
  for (const rate of [1, 5, 10, 20, 100]) {
    const f = fixture(), count = rate * 2;
    for (let click = 0; click < count; click++) {
      f.setTime(click / rate); f.press(); await f.flush();
      f.setTime((click + .4) / rate); f.release(); await f.flush();
      assert.ok(f.liveAt((click + .4) / rate).length <= 3);
    }
    const started = f.nodes.length;
    assert.ok(started <= 46, `${rate} Hz started ${started} voices in two seconds`);
    if (rate <= 10) assert.equal(started, count * 2);
    else assert.ok(started < count * 2);
    f.setTime(3); await f.flush();
    assert.equal(f.nodes.length, started); assert.equal(f.liveAt(3).length, 0);
    // Same-sign full-scale samples stay within the selected event/master gain.
    for (let at = 0; at < 2.7; at += 1 / 48000) assert.ok(f.output(at) <= .40000001);
  }
});

test('a merged press/release pair keeps the existing release tail, while a later long press is interruptible', async () => {
  const f = fixture({ duration: 20 });
  f.press(); await f.flush(); f.setTime(.03); f.release(); await f.flush();
  f.setTime(.05); f.press(); await f.flush(); f.setTime(.07); f.release(); await f.flush();
  assert.equal(f.nodes.length, 2); assert.equal(f.nodes[1].stopAt, undefined);
  f.setTime(.2); f.press(); await f.flush(); f.setTime(3); f.release(); await f.flush();
  assert.equal(f.nodes.length, 4); assert.equal(f.nodes[2].stopAt, 3.008); assert.equal(f.nodes[3].startAt, 3);
});

test('release-only and legacy direct gesture callers also have a bounded restart rate', async () => {
  for (const event of ['release', undefined]) {
    const f = fixture();
    for (let i = 0; i < 100; i++) { f.setTime(i / 100); await f.api.play({ channel: 'gesture', event, url: '/same' }); }
    assert.ok(f.nodes.length <= 12); assert.ok(f.liveAt(.99).length <= 2);
  }
});

test('a duplicate down never swallows the real release of a held custom clip', async () => {
  const f = fixture({ duration: 20 });
  await f.api.play({ channel: 'gesture', event: 'press', url: '/held' });
  f.setTime(.01); await f.api.play({ channel: 'gesture', event: 'press', url: '/held' });
  f.setTime(.02); await f.api.play({ channel: 'gesture', event: 'release', url: '/up' });
  assert.equal(f.nodes.length, 2); assert.equal(f.nodes[0].stopAt, .028); assert.equal(f.nodes[1].startAt, .02);
});

test('a fresh release wins cold-cache races; obsolete or delayed sounds never replay', async () => {
  const f = fixture({ deferred: true });
  f.press(); await f.flush(); f.setTime(.04); f.release(); await f.flush();
  f.requests.find(r => r.url.includes('release')).resolve(); await f.flush();
  f.requests.find(r => r.url.includes('press')).resolve(); await f.flush();
  assert.equal(f.nodes.length, 1); assert.match(f.nodes[0].buffer.url, /release/);
  const delayed = fixture({ deferred: true });
  delayed.press(); await delayed.flush(); delayed.setTime(.3);
  delayed.requests[0].resolve(); await delayed.flush(); assert.equal(delayed.nodes.length, 0);
  const cancelled = fixture({ deferred: true });
  cancelled.press(); await cancelled.flush(); cancelled.api.stop('gesture');
  cancelled.requests[0].resolve(); await cancelled.flush(); assert.equal(cancelled.nodes.length, 0);
});

test('mute, hiding and shutdown stop active and fading voices and reset the interaction gate', async () => {
  for (const stop of [f => f.api.play({ channel: 'gesture', event: 'press', volume: 0 }), f => f.hidden(), f => f.unload(), f => f.idle()]) {
    const f = fixture();
    f.press(); await f.flush(); f.setTime(.04); f.release(); await f.flush();
    f.setTime(.044); await stop(f); assert.equal(f.liveAt(.044).length, 0);
    assert.ok(f.nodes.every(n => n.disconnectedAt !== undefined));
  }
  const f = fixture(); await f.api.play({ channel: 'gesture', volume: 0 });
  assert.equal(f.contexts(), 0); assert.equal(f.requests.length, 0);
  f.press(); await f.flush(); f.api.stop('gesture'); f.setTime(.01); f.press(); await f.flush(); assert.equal(f.nodes.length, 2);
});

test('late decode from a closed context cannot fill or remove a replacement cache request', async () => {
  const f = fixture({ deferred: true });
  const before = f.api.warm('/same'); await f.flush(); f.idle();
  const after = f.api.warm('/same'); await f.flush();
  f.requests[0].resolve(); await before;
  const joined = f.api.warm('/same'); await f.flush(); assert.equal(f.requests.length, 2);
  f.requests[1].resolve(); await Promise.all([after, joined]); assert.equal(f.contexts(), 2);
});

test('notification groups and repeated previews remain complete and independent of gesture coalescing', async () => {
  const f = fixture({ duration: .3 });
  await f.api.play({ channel: 'notice', urls: ['/first', '/second'], volume: .3 });
  const notice = f.nodes.slice();
  f.press(); await f.flush(); f.setTime(.01); f.release(); await f.flush();
  f.feedback.play('press', '/preview', 1, undefined, true); await f.flush();
  f.feedback.play('press', '/preview', 1, undefined, true); await f.flush();
  assert.deepEqual(notice.map(n => n.startAt), [0, .3]); assert.ok(notice.every(n => n.stopAt === undefined));
  assert.equal(f.nodes.filter(n => n.buffer?.url === '/preview').length, 2);
  f.api.stop('gesture'); assert.ok(notice.every(n => n.stopAt === undefined));
});

test('a retargeted fade and short clips stay continuous, including procedural presets', async () => {
  const f = fixture();
  f.press(); await f.flush(); f.setTime(.1); f.release(); await f.flush();
  f.setTime(.104); f.press(); await f.flush();
  assert.ok(f.liveAt(.104).length <= 3);
  for (let i = 0; i < 384; i++) assert.ok(Math.abs(f.output(.104 + i / 48000) - .4) < 1e-9);
  const short = fixture({ duration: .004 });
  short.press(); await short.flush(); short.setTime(.001); short.release(); await short.flush();
  assert.ok(Math.abs(short.nodes[0].gain.gain.at(.001) - .2) < 1e-9);
  const tones = fixture();
  await tones.api.play({ channel: 'gesture', event: 'press', preset: 'pearl' });
  tones.setTime(.03); await tones.api.play({ channel: 'gesture', event: 'release', preset: 'glass' });
  assert.equal(tones.nodes.length, 4); assert.ok(tones.nodes.slice(0, 2).every(n => n.stopAt === .038));
});
