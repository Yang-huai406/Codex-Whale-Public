import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rollbackMac } from '../scripts/rollback-macos.mjs';

// macOS installer/rollback only; the fixtures assume POSIX paths and modes.
const macOnly = { skip: process.platform === 'win32' };
const root = fileURLToPath(new URL('..', import.meta.url));
const helper = path.join(root, 'scripts', 'marketplace-helper.mjs');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const tree = (dir, version, marker) => {
  write(path.join(dir, '.codex-plugin', 'plugin.json'), JSON.stringify({ name: 'api-balance-whale', version }));
  write(path.join(dir, 'desktop', 'macos', 'supervisor.mjs'), '');
  write(path.join(dir, 'marker.txt'), marker);
};

// A throwaway HOME (USERPROFILE on Windows) with data dir, plugin target, personal marketplace, fake launchd and fake Codex CLI.
function fixture({ stage = 'complete', hadInstall = true, registeredBefore = true, replaced = true, version = 2, removeFails = false } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-mac-rollback-')), env = { ...process.env, HOME: home, USERPROFILE: home, CODEX_HOME: path.join(home, '.codex') };
  const dataDir = path.join(home, '.codex', 'whale-widget'), target = path.join(home, 'plugins', 'api-balance-whale');
  const backupDir = path.join(dataDir, 'backups', 'macos-test'), cli = path.join(home, 'codex');
  write(cli, '');
  tree(target, '0.4.1', 'new');
  const replacedBackup = replaced ? path.join(backupDir, 'replaced-plugin') : null;
  if (replaced) tree(replacedBackup, '0.4.0', 'old');
  const marketplace = path.join(home, '.agents', 'plugins', 'marketplace.json');
  if (registeredBefore) write(marketplace, JSON.stringify({ name: 'personal', interface: { displayName: 'Personal' }, plugins: [{ name: 'other' }, { name: 'api-balance-whale', source: { source: 'local', path: './plugins/api-balance-whale' }, policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' }, category: 'Productivity' }] }));
  const marketplaceReceipt = path.join(backupDir, 'marketplace-entry.json');
  assert.equal(spawnSync(process.execPath, [helper, 'install', marketplaceReceipt], { env, encoding: 'utf8' }).status, 0);
  const plistPath = path.join(home, 'Library', 'LaunchAgents', 'com.api-balance-whale.codex.plist');
  write(plistPath, 'new plist'); write(path.join(backupDir, 'LaunchAgent.plist'), 'old plist');
  write(path.join(dataDir, 'follow-config.json'), JSON.stringify({ label: 'com.api-balance-whale.codex', pluginRoot: target, revision: 'new' }));
  if (hadInstall) write(path.join(backupDir, 'follow-config.json'), JSON.stringify({ label: 'com.api-balance-whale.codex', pluginRoot: target, revision: 'old' }));
  write(path.join(dataDir, 'ledger.json'), 'latest ledger');
  const previousReceipt = path.join(backupDir, 'previous-rollback-receipt.json');
  write(previousReceipt, JSON.stringify({ installId: 'older' }));
  const receipt = { version, installId: 'current', backupDir, hadInstall, plistPath, stage, pluginRoot: target, previousReceipt,
    previous: hadInstall ? { pluginRoot: target, label: 'com.api-balance-whale.codex', revision: 'old', enabled: true } : null,
    plugin: version === 2 ? { cli, marketplaceName: 'personal', previousEntry: json(marketplaceReceipt).previousEntry, marketplaceReceipt, replacedBackup, createdTarget: !replaced } : undefined };
  const receiptFile = path.join(backupDir, 'receipt.json');
  write(receiptFile, JSON.stringify(receipt)); write(path.join(dataDir, 'macos-rollback-receipt.json'), JSON.stringify(receipt));
  let loaded = true; const launchd = [], codex = [];
  const launchctl = args => { launchd.push(args[0]); if (args[0] === 'bootout') loaded = false; return { status: args[0] === 'print' ? (loaded ? 0 : 113) : 0 }; };
  const spawn = (file, args) => {
    if (args.includes('--help')) return { status: 0 };
    codex.push(args.slice(0, 3).join(' '));
    if (args[1] === 'remove' && removeFails) return { status: 1, stderr: 'not installed' };
    if (args[1] === 'list') return { status: 0, stdout: JSON.stringify({ installed: [{ pluginId: 'api-balance-whale@personal', version: '0.4.0', installed: true, enabled: true }] }) };
    return { status: 0, stdout: '{}' };
  };
  const run = (extra = {}) => rollbackMac({ dataDir, receiptFile, launchctl, spawn, env, home, uid: 501, helper, waitMs: 1, log: () => {}, ...extra });
  return { home, dataDir, target, backupDir, marketplace, receiptFile, launchd, codex, run };
}

test('rolling back an upgrade over a registered install restores code, marketplace entry, registration and receipt pointer', macOnly, async () => {
  const f = fixture();
  const result = await f.run();
  assert.equal(result.reregistered, true);
  assert.equal(fs.readFileSync(path.join(f.target, 'marker.txt'), 'utf8'), 'old');
  assert.equal(fs.readFileSync(path.join(result.checkpoint, 'retired-source', 'marker.txt'), 'utf8'), 'new');
  assert.deepEqual(f.codex, ['plugin remove api-balance-whale@personal', 'plugin add api-balance-whale@personal', 'plugin list --json']);
  assert.deepEqual(json(f.marketplace).plugins.map(p => p.name), ['other', 'api-balance-whale']);
  assert.deepEqual(f.launchd.filter(c => c !== 'print'), ['bootout', 'enable', 'bootstrap', 'kickstart']);
  assert.equal(json(path.join(f.dataDir, 'follow-config.json')).revision, 'old');
  assert.equal(fs.readFileSync(path.join(f.home, 'Library', 'LaunchAgents', 'com.api-balance-whale.codex.plist'), 'utf8'), 'old plist');
  assert.equal(fs.readFileSync(path.join(f.dataDir, 'ledger.json'), 'utf8'), 'latest ledger');
  assert.equal(json(path.join(f.dataDir, 'macos-rollback-receipt.json')).installId, 'older');
  assert.equal(json(f.receiptFile).stage, 'rolled-back');
  await assert.rejects(f.run(), /already rolled back/);
});

test('rolling back a fresh plugin install removes code, registration and marketplace entry and disables following', macOnly, async () => {
  const f = fixture({ hadInstall: false, registeredBefore: false, replaced: false });
  fs.rmSync(path.join(f.backupDir, 'previous-rollback-receipt.json'));
  const result = await f.run();
  assert.equal(result.reregistered, false);
  assert.equal(fs.existsSync(f.target), false);
  assert.equal(fs.readFileSync(path.join(result.checkpoint, 'retired-source', 'marker.txt'), 'utf8'), 'new');
  assert.deepEqual(f.codex, ['plugin remove api-balance-whale@personal']);
  assert.deepEqual(json(f.marketplace).plugins, []);
  assert.equal(json(path.join(f.dataDir, 'follow-config.json')).enabled, false);
  assert.ok(f.launchd.includes('disable') && !f.launchd.includes('bootstrap'));
  const pointer = json(path.join(f.dataDir, 'macos-rollback-receipt.json'));
  assert.equal(pointer.installId, 'current'); assert.equal(pointer.stage, 'rolled-back');
});

test('a failure after the marketplace write tolerates a missing registration; earlier failures never call remove', macOnly, async () => {
  const late = fixture({ stage: 'marketplace-ready', removeFails: true });
  await late.run();
  assert.equal(late.codex[0], 'plugin remove api-balance-whale@personal');
  assert.equal(fs.readFileSync(path.join(late.target, 'marker.txt'), 'utf8'), 'old');
  const early = fixture({ stage: 'source-ready' });
  await early.run();
  assert.ok(!early.codex.some(call => call.startsWith('plugin remove')));
  const strict = fixture({ stage: 'complete', removeFails: true });
  await assert.rejects(strict.run(), /plugin remove failed: not installed/);
});

test('check-only validates the receipt and marketplace without touching launchd, Codex or files', macOnly, async () => {
  const f = fixture();
  const before = fs.readdirSync(f.backupDir).sort();
  const result = await f.run({ checkOnly: true });
  assert.equal(result.ok, true); assert.equal(result.unregister, true); assert.equal(result.restore, 'old');
  assert.deepEqual(f.launchd, []); assert.deepEqual(f.codex, []);
  assert.deepEqual(fs.readdirSync(f.backupDir).sort(), before);
  assert.equal(fs.readFileSync(path.join(f.target, 'marker.txt'), 'utf8'), 'new');
});

test('version 1 desktop-only receipts roll back without Codex plugin operations', macOnly, async () => {
  const f = fixture({ version: 1 });
  await f.run();
  assert.deepEqual(f.codex, []);
  assert.equal(fs.readFileSync(path.join(f.target, 'marker.txt'), 'utf8'), 'new');
  assert.ok(f.launchd.includes('bootstrap'));
});

test('a receipt copied away from its backup directory is refused', macOnly, async () => {
  const f = fixture();
  const stray = path.join(f.home, 'stray-receipt.json');
  fs.copyFileSync(f.receiptFile, stray);
  await assert.rejects(f.run({ receiptFile: stray }), /does not belong/);
});
