import fs from 'node:fs';
import path from 'node:path';
export function writeMacReceipt(dataDir, receipt) {
  fs.writeFileSync(path.join(receipt.backupDir, 'receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
  fs.writeFileSync(path.join(dataDir, 'macos-rollback-receipt.json'), JSON.stringify(receipt, null, 2), { mode: 0o600 });
}
export function backupMacInstall({ dataDir, pluginRoot, plistPath, installId, plugin = null }) {
  const backupDir = path.join(dataDir, 'backups', 'macos-' + installId);
  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  const operational = ['follow-config.json', 'follow-install.json', 'pause-until-host-exit.json'];
  let previous = null;
  try { previous = JSON.parse(fs.readFileSync(path.join(dataDir, 'follow-config.json'), 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const name of operational) { const source = path.join(dataDir, name); if (fs.existsSync(source)) fs.copyFileSync(source, path.join(backupDir, name)); }
  const oldPlist = previous?.launchAgentPath || plistPath;
  if (fs.existsSync(oldPlist)) fs.copyFileSync(oldPlist, path.join(backupDir, 'LaunchAgent.plist'));
  if (previous?.probePath && fs.existsSync(previous.probePath)) fs.copyFileSync(previous.probePath, path.join(backupDir, 'window-probe'));
  let sourceBackup = null;
  if (previous?.pluginRoot && path.resolve(previous.pluginRoot) !== path.resolve(pluginRoot) && fs.existsSync(previous.pluginRoot)) {
    sourceBackup = path.join(backupDir, 'previous-plugin');
    const excluded = new Set(['node_modules', '.git', 'qa', 'references']);
    fs.cpSync(previous.pluginRoot, sourceBackup, { recursive: true, filter: source => !excluded.has(path.basename(source)) });
  }
  // Rollback restores the pointer so the earlier installation stays reachable.
  const pointer = path.join(dataDir, 'macos-rollback-receipt.json');
  let previousReceipt = null;
  if (fs.existsSync(pointer)) { previousReceipt = path.join(backupDir, 'previous-rollback-receipt.json'); fs.copyFileSync(pointer, previousReceipt); }
  // version 2 adds Codex plugin registration; desktop-only installs leave plugin null.
  const receipt = { version: 2, installId, createdAt: new Date().toISOString(), backupDir, previous, sourceBackup, plistPath: oldPlist, operational, hadInstall: !!previous,
    stage: 'backup', pluginRoot, plugin, previousReceipt };
  writeMacReceipt(dataDir, receipt);
  return receipt;
}
