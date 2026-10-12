import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
const sendCursor = source.slice(source.indexOf('function sendCursor('), source.indexOf('function setTestCursor('));
function fixture(isMac = true) {
  let time = 1000, buttons = 0, visible = true;
  const packets = [];
  const context = { isMac, fixture: false, rendererReady: true, lastCursor: '', lastHost: null,
    Date: { now: () => time }, macNative: { mouseButtons: () => buttons },
    isWindowVisible: () => visible,
    screen: { getCursorScreenPoint: () => ({ x: 120, y: 130 }) },
    window: { isDestroyed: () => false, getContentBounds: () => ({ x: 100, y: 100 }),
      webContents: { send: (channel, point) => packets.push({ channel, ...point }) } } };
  vm.createContext(context); vm.runInContext(sendCursor, context);
  return { context, packets, set: (nextButtons, nextTime) => { buttons = nextButtons; time = nextTime; },
    hide: () => { visible = false; }, tick: () => context.sendCursor() };
}

test('Mac stationary cursor carries fresh button-release evidence in both desktop modes', () => {
  const f = fixture();
  f.tick(); f.set(1, 1010); f.tick(); f.set(0, 1020); f.tick(); f.set(0, 1030); f.tick();
  assert.deepEqual(f.packets.map(p => [p.x, p.y, p.buttons, p.sampledAt]), [
    [20, 30, 0, 1000], [20, 30, 1, 1010], [20, 30, 0, 1020], [20, 30, 0, 1030],
  ]);
  f.hide(); f.tick(); assert.equal(f.packets.length, 4);
});

test('Windows continues using timestamped supervisor samples and unchanged-position coalescing', () => {
  const f = fixture(false);
  f.context.lastHost = { mouseButtons: 1, mouseSampleAt: 950 };
  f.tick(); f.tick(); assert.equal(f.packets.length, 1);
  assert.equal(f.packets[0].buttons, 1); assert.equal(f.packets[0].sampledAt, 950);
  f.context.lastHost = { mouseButtons: 0, mouseSampleAt: 1020 };
  f.tick(); assert.equal(f.packets.length, 2); assert.equal(f.packets[1].buttons, 0);
});

test('Mac and Windows use the native cursor stream without ignored-window event forwarding', () => {
  const constants = source.slice(source.indexOf('const isMac ='), source.indexOf('const usesSurfaceGuard ='));
  for (const platform of ['darwin', 'win32', 'linux']) {
    const state = vm.runInNewContext(constants + ';({forwardsMouseMoves, cursorPollMs})', { process: { platform } });
    assert.equal(state.forwardsMouseMoves, platform === 'linux');
    assert.equal(state.cursorPollMs, platform === 'linux' ? 50 : 16);
  }
});
