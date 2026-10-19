import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findCodexCli, registerPlugin, unregisterPlugin, stagePluginTree, cliCandidates, ensureCodexHome } from '../scripts/macos-plugin.mjs';
import { backupMacInstall } from '../scripts/macos-backup.mjs';

// macOS installer/rollback only; the fixtures assume POSIX paths and modes.
const macOnly = { skip: process.platform === 'win32' };
const temp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'whale-mac-plugin-'));
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const manifest = (dir, name = 'api-balance-whale', version = '0.4.1') => write(path.join(dir, '.codex-plugin', 'plugin.json'), JSON.stringify({ name, version }));

test('Codex CLI discovery prefers the first candidate supporting plugin add and rejects an unusable explicit path', macOnly, () => {
  const dir = temp(), old = path.join(dir, 'old-codex'), bundled = path.join(dir, 'bundled-codex'), later = path.join(dir, 'later-codex');
  for (const file of [old, bundled, later]) write(file, '');
  const calls = [];
  const spawn = (file, args) => { calls.push([file, ...args]); return { status: file === old ? 2 : 0 }; };
  assert.equal(findCodexCli({ candidates: [path.join(dir, 'missing'), old, bundled, later], spawn }), bundled);
  assert.deepEqual(calls.map(c => c.slice(1)), [['plugin', 'add', '--help'], ['plugin', 'add', '--help']]);
  assert.throws(() => findCodexCli({ explicit: old, spawn }), /does not support `plugin add`/);
  assert.throws(() => findCodexCli({ candidates: [old], spawn }), /--codex-cli/);
});

test('desktop-bundled CLI is searched before standalone installs', macOnly, () => {
  const list = cliCandidates({ home: '/fixture-home', env: { PATH: '/opt/homebrew/bin:/usr/bin' } });
  assert.equal(list[0], '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex');
  assert.ok(list.indexOf('/fixture-home/.local/bin/codex') > 0 && list.includes('/usr/bin/codex'));
  assert.equal(new Set(list).size, list.length);
});

test('registration succeeds only when Codex lists exactly one enabled installation of this version', macOnly, () => {
  const installed = version => ({ installed: [{ pluginId: 'api-balance-whale@personal', version, installed: true, enabled: true }, { pluginId: 'other@personal', version, installed: true, enabled: true }] });
  const fake = list => (file, args) => ({ status: 0, stdout: JSON.stringify(args[1] === 'add' ? { pluginId: args[2] } : list) });
  assert.equal(registerPlugin({ cli: 'codex', marketplaceName: 'personal', version: '0.4.1', spawn: fake(installed('0.4.1')) }).version, '0.4.1');
  assert.throws(() => registerPlugin({ cli: 'codex', marketplaceName: 'personal', version: '0.4.1', spawn: fake(installed('0.2.0')) }), /did not report one enabled v0.4.1/);
  const disabled = installed('0.4.1'); disabled.installed[0].enabled = false;
  assert.throws(() => registerPlugin({ cli: 'codex', marketplaceName: 'personal', version: '0.4.1', spawn: fake(disabled) }), /did not report/);
  assert.throws(() => registerPlugin({ cli: 'codex', marketplaceName: 'personal', version: '0.4.1', spawn: () => ({ status: 1, stderr: 'marketplace not found' }) }), /plugin add failed: marketplace not found/);
  const calls = [];
  unregisterPlugin({ cli: 'codex', marketplaceName: 'personal', spawn: (file, args) => { calls.push(args); return { status: 0, stdout: '{}' }; } });
  assert.deepEqual(calls, [['plugin', 'remove', 'api-balance-whale@personal', '--json']]);
});

test('missing CODEX_HOME is created because the CLI refuses to start without it', macOnly, () => {
  const dir = temp(), codexHome = path.join(dir, 'custom-codex');
  assert.equal(ensureCodexHome({ CODEX_HOME: codexHome }, dir), codexHome);
  assert.ok(fs.statSync(codexHome).isDirectory());
  assert.equal(ensureCodexHome({}, dir), path.join(dir, '.codex'));
});

test('staging moves the replaced plugin aside, never deletes it, and skips development folders', macOnly, () => {
  const dir = temp(), source = path.join(dir, 'release'), target = path.join(dir, 'plugins', 'api-balance-whale'), retired = path.join(dir, 'backup', 'replaced-plugin');
  manifest(source); write(path.join(source, 'runtime', 'mcp.mjs'), 'new'); write(path.join(source, 'node_modules', 'x.js'), 'dev'); write(path.join(source, '.git', 'HEAD'), 'ref');
  manifest(target, 'api-balance-whale', '0.2.0'); write(path.join(target, 'runtime', 'mcp.mjs'), 'old');
  assert.equal(stagePluginTree({ source, target, retired }), retired);
  assert.equal(fs.readFileSync(path.join(target, 'runtime', 'mcp.mjs'), 'utf8'), 'new');
  assert.equal(fs.readFileSync(path.join(retired, 'runtime', 'mcp.mjs'), 'utf8'), 'old');
  assert.equal(fs.existsSync(path.join(target, 'node_modules')) || fs.existsSync(path.join(target, '.git')), false);
  assert.deepEqual(fs.readdirSync(path.dirname(target)), ['api-balance-whale']);
});

test('staging refuses a target owned by another plugin and leaves it untouched', macOnly, () => {
  const dir = temp(), source = path.join(dir, 'release'), target = path.join(dir, 'plugins', 'api-balance-whale');
  manifest(source); manifest(target, 'someone-else'); write(path.join(target, 'keep.txt'), 'theirs');
  assert.throws(() => stagePluginTree({ source, target, retired: path.join(dir, 'retired') }), /another plugin/);
  assert.equal(fs.readFileSync(path.join(target, 'keep.txt'), 'utf8'), 'theirs');
  assert.equal(fs.existsSync(path.join(dir, 'retired')), false);
  assert.deepEqual(fs.readdirSync(path.dirname(target)), ['api-balance-whale']);
});

test('fresh staging creates the target without a retired copy', macOnly, () => {
  const dir = temp(), source = path.join(dir, 'release'), target = path.join(dir, 'plugins', 'api-balance-whale');
  manifest(source);
  assert.equal(stagePluginTree({ source, target, retired: path.join(dir, 'retired') }), null);
  assert.ok(fs.existsSync(path.join(target, '.codex-plugin', 'plugin.json')));
});

test('version 2 receipt records plugin registration state next to the desktop backup', macOnly, () => {
  const dir = temp(), dataDir = path.join(dir, 'data');
  fs.mkdirSync(dataDir);
  const plugin = { cli: '/codex', marketplaceName: 'personal', previousEntry: null, marketplaceReceipt: null, replacedBackup: null, createdTarget: false };
  const receipt = backupMacInstall({ dataDir, pluginRoot: path.join(dir, 'plugins', 'api-balance-whale'), plistPath: path.join(dir, 'none.plist'), installId: 'v2', plugin });
  assert.equal(receipt.version, 2); assert.equal(receipt.stage, 'backup'); assert.deepEqual(receipt.plugin, plugin);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'macos-rollback-receipt.json'), 'utf8')), receipt);
  assert.equal((fs.statSync(path.join(receipt.backupDir, 'receipt.json')).mode & 0o777), 0o600);
});
