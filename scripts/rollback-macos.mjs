// Self-contained: install-macos.mjs copies this file, macos-plugin.mjs and
// marketplace-helper.mjs into <backup>/recovery-scripts, outside the plugin tree.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findCodexCli, ensureCodexHome, registerPlugin, unregisterPlugin, runMarketplaceHelper, moveTree, assertPluginTree } from './macos-plugin.mjs';

const systemLaunchctl = args => spawnSync('/bin/launchctl', args, { encoding: 'utf8' });

// Every external effect is injectable so each rollback branch can be tested
// without touching launchd, the real Codex CLI or the user's home directory.
export async function rollbackMac({ dataDir, receiptFile, checkOnly = false, launchctl = systemLaunchctl, spawn = spawnSync,
  env = process.env, home = os.homedir(), uid = process.getuid(), helper = path.join(path.dirname(fileURLToPath(import.meta.url)), 'marketplace-helper.mjs'),
  waitMs = 200, log = text => process.stdout.write(text) }) {
  const pointer = path.join(dataDir, 'macos-rollback-receipt.json');
  receiptFile = path.resolve(receiptFile || pointer);
  const receipt = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  if (![1, 2].includes(receipt.version) || !path.isAbsolute(receipt.backupDir)) throw new Error('Invalid rollback receipt');
  if (receiptFile !== pointer && path.dirname(receiptFile) !== path.resolve(receipt.backupDir)) throw new Error('Receipt does not belong to its backup directory');
  if (receipt.stage === 'rolled-back') throw new Error('This installation was already rolled back at ' + receipt.rolledBackAt + '; refusing to repeat it');
  const plugin = receipt.version === 2 ? receipt.plugin : null;
  const marketReceipt = plugin?.marketplaceReceipt && fs.existsSync(plugin.marketplaceReceipt) ? plugin.marketplaceReceipt : null;
  if (marketReceipt) runMarketplaceHelper(helper, ['check-restore', marketReceipt], { env });
  const cli = plugin ? findCodexCli({ explicit: plugin.cli && fs.existsSync(plugin.cli) ? plugin.cli : '', spawn }) : '';
  if (checkOnly) return { ok: true, stage: receipt.stage || null, restore: receipt.hadInstall ? receipt.previous?.revision || 'previous' : 'none', pluginRoot: receipt.pluginRoot || null, unregister: !!plugin, preserveCurrentData: true };

  const checkpoint = path.join(receipt.backupDir, 'before-rollback-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(checkpoint, { recursive: true, mode: 0o700 });
  // The invoking script may live in the plugin tree that is moved below.
  const stableHelper = path.join(checkpoint, 'marketplace-helper.mjs');
  fs.copyFileSync(helper, stableHelper);
  const configFile = path.join(dataDir, 'follow-config.json');
  let current = {}; try { current = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch {}
  const domain = 'gui/' + uid;
  const run = (args, allowFailure = false) => { const result = launchctl(args); if (!allowFailure && result.status !== 0) throw new Error(result.stderr || 'launchctl failed'); return result; };
  const service = domain + '/' + (current.label || 'com.api-balance-whale.codex');
  if (run(['print', service], true).status === 0) {
    run(['bootout', service]);
    for (let i = 0; i < 30 && run(['print', service], true).status === 0; i++) await new Promise(resolve => setTimeout(resolve, waitMs));
    if (run(['print', service], true).status === 0) throw new Error('Current LaunchAgent did not stop');
  }
  let reregistered = false;
  if (plugin) {
    // `plugin add` may have succeeded even when its verification failed afterwards.
    if (['plugin-registered', 'complete'].includes(receipt.stage)) unregisterPlugin({ cli, marketplaceName: plugin.marketplaceName, spawn, env });
    else if (receipt.stage === 'marketplace-ready') { try { unregisterPlugin({ cli, marketplaceName: plugin.marketplaceName, spawn, env }); } catch {} }
    const target = receipt.pluginRoot;
    if (plugin.replacedBackup && fs.existsSync(plugin.replacedBackup)) {
      if (fs.existsSync(target)) moveTree(target, path.join(checkpoint, 'retired-source'));
      moveTree(plugin.replacedBackup, target);
    } else if (plugin.createdTarget && fs.existsSync(target)) moveTree(target, path.join(checkpoint, 'retired-source'));
    if (marketReceipt) runMarketplaceHelper(stableHelper, ['restore', marketReceipt], { env });
    if (plugin.previousEntry && fs.existsSync(target)) {
      ensureCodexHome(env, home);
      registerPlugin({ cli, marketplaceName: plugin.marketplaceName, version: assertPluginTree(target).version, spawn, env });
      reregistered = true;
    }
  }
  if (!receipt.hadInstall) {
    fs.writeFileSync(configFile, JSON.stringify({ ...current, enabled: false }, null, 2));
    run(['disable', service]);
    log('No previous installation: automatic following disabled' + (plugin ? ' and Codex plugin registration removed' : '') + '. All settings and usage records retained.\n');
  } else {
    const previous = receipt.previous;
    if (previous?.pluginRoot && !fs.existsSync(previous.pluginRoot) && receipt.sourceBackup && fs.existsSync(receipt.sourceBackup)) fs.cpSync(receipt.sourceBackup, previous.pluginRoot, { recursive: true, errorOnExist: true, force: false });
    if (!previous?.pluginRoot || !fs.existsSync(path.join(previous.pluginRoot, 'desktop', 'macos', 'supervisor.mjs'))) throw new Error('Previous code directory is missing. Restore previous-plugin from the backup to the original pluginRoot before retrying.');
    for (const name of ['follow-config.json', 'follow-install.json', 'pause-until-host-exit.json']) {
      const backup = path.join(receipt.backupDir, name), target = path.join(dataDir, name);
      if (fs.existsSync(backup)) fs.copyFileSync(backup, target); else if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    const probe = path.join(receipt.backupDir, 'window-probe');
    if (previous.probePath && fs.existsSync(probe)) { fs.copyFileSync(probe, previous.probePath); fs.chmodSync(previous.probePath, 0o755); }
    const plist = path.join(receipt.backupDir, 'LaunchAgent.plist');
    if (!fs.existsSync(plist)) throw new Error('Previous LaunchAgent backup is missing');
    fs.copyFileSync(plist, receipt.plistPath);
    if (previous.enabled !== false) {
      const oldService = domain + '/' + previous.label;
      run(['enable', oldService]); run(['bootstrap', domain, receipt.plistPath]); run(['kickstart', oldService]);
    }
    const registration = !plugin ? '' : reregistered ? ', previous Codex plugin registration restored' : ', Codex plugin registration removed';
    log('Previous operational configuration restored' + registration + '. Latest balance history, token records, settings and custom assets retained.\n');
  }
  // Mark this receipt spent and point back at the installation it replaced.
  const spent = { ...receipt, stage: 'rolled-back', rolledBackAt: new Date().toISOString(), rolledBackFrom: receipt.stage || null };
  fs.writeFileSync(path.join(receipt.backupDir, 'receipt.json'), JSON.stringify(spent, null, 2), { mode: 0o600 });
  let pointed = null; try { pointed = JSON.parse(fs.readFileSync(pointer, 'utf8')); } catch {}
  if (receipt.previousReceipt && fs.existsSync(receipt.previousReceipt)) fs.copyFileSync(receipt.previousReceipt, pointer);
  else if (pointed?.installId === receipt.installId) fs.writeFileSync(pointer, JSON.stringify(spent, null, 2), { mode: 0o600 });
  log('Private checkpoint: ' + checkpoint + '\n');
  return { ok: true, checkpoint, reregistered };
}

// Compare real paths: the module URL is resolved through symlinks such as /tmp.
const invokedDirectly = (() => { try { return fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url)); } catch { return false; } })();
if (invokedDirectly) {
  if (process.platform !== 'darwin') throw new Error('This rollback is only for macOS');
  const dataDir = path.resolve(process.env.WHALE_HOME || path.join(process.env.CODEX_HOME || path.join(os.homedir(), '.codex'), 'whale-widget'));
  const argv = process.argv.slice(2), checkOnly = argv.includes('--check-only');
  const result = await rollbackMac({ dataDir, receiptFile: argv.find(arg => !arg.startsWith('--')), checkOnly });
  if (checkOnly) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
