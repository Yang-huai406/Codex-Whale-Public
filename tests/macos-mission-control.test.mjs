import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Runs the window setup block that follows BrowserWindow creation with a fake window.
function setupCalls(isMac) {
  const source = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  const start = source.indexOf('    if (isMac) {\n      if (app.dock) app.dock.hide();');
  const end = source.indexOf('    window.setAlwaysOnTop(isMac || desktopMode', start);
  assert.ok(start > 0 && end > start, 'macOS window setup block not found');
  const calls = [];
  const record = name => (...args) => calls.push([name, ...args]);
  const window = { setAlwaysOnTop: record('setAlwaysOnTop'), setVisibleOnAllWorkspaces: record('setVisibleOnAllWorkspaces'), setHiddenInMissionControl: record('setHiddenInMissionControl') };
  vm.runInNewContext(source.slice(start, end), { isMac, window, app: { dock: { hide: record('dockHide') } } });
  return calls;
}

test('macOS overlay is hidden from Mission Control after joining all Spaces', () => {
  const names = setupCalls(true).map(call => call[0]);
  assert.deepEqual(setupCalls(true).find(call => call[0] === 'setHiddenInMissionControl'), ['setHiddenInMissionControl', true]);
  assert.ok(names.indexOf('setVisibleOnAllWorkspaces') < names.indexOf('setHiddenInMissionControl'));
});

test('Windows window setup never touches Mission Control', () => {
  assert.deepEqual(setupCalls(false), []);
  const source = fs.readFileSync(new URL('../desktop/main.cjs', import.meta.url), 'utf8');
  assert.equal(source.split('setHiddenInMissionControl').length - 1, 1);
});
