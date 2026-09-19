import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DATA_HOME } from '../runtime/paths.mjs';

if (process.platform !== 'darwin') {
  process.stderr.write('This uninstaller is only for macOS.\n');
  process.exit(1);
}

const configFile = path.join(DATA_HOME, 'follow-config.json');
let config = {};
try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch {}
const label = config.label || 'com.api-balance-whale.codex';
const plistPath = config.launchAgentPath || path.join(os.homedir(), 'Library', 'LaunchAgents', label + '.plist');
const domain = 'gui/' + process.getuid();

spawnSync('/bin/launchctl', ['bootout', domain + '/' + label], { stdio: 'inherit' });
try { fs.unlinkSync(plistPath); } catch (error) { if (error.code !== 'ENOENT') throw error; }

if (Object.keys(config).length) {
  config.enabled = false;
  config.uninstalledAt = new Date().toISOString();
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}
process.stdout.write('Automatic following is disabled. Settings, resources and records were retained.\n');
