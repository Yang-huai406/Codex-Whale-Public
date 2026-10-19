// macOS Codex plugin registration and code staging. Mirrors the Windows
// install-package.ps1 flow: fixed ~/plugins target, personal marketplace entry,
// `codex plugin add`, then `plugin list --json` as the only success evidence.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const PLUGIN_NAME = 'api-balance-whale';
const EXCLUDED = new Set(['node_modules', '.git', 'qa', 'references']);

export function pluginTarget(home = os.homedir()) { return path.join(home, 'plugins', PLUGIN_NAME); }

export function cliCandidates({ home = os.homedir(), env = process.env } = {}) {
  const bundled = app => path.join(app, 'Contents', 'Resources', 'codex-cli', 'CodexCLI.app', 'Contents', 'MacOS', 'codex');
  // The desktop-bundled CLI matches the running app; standalone installs follow.
  const list = [bundled('/Applications/ChatGPT.app'), bundled(path.join(home, 'Applications', 'ChatGPT.app')),
    bundled('/Applications/Codex.app'), path.join('/Applications/Codex.app', 'Contents', 'Resources', 'codex'),
    path.join(home, '.local', 'bin', 'codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex'];
  for (const dir of String(env.PATH || '').split(path.delimiter).filter(Boolean)) list.push(path.join(dir, 'codex'));
  return [...new Set(list)];
}

export function findCodexCli({ explicit = '', candidates = cliCandidates(), spawn = spawnSync } = {}) {
  const usable = file => {
    try { if (!fs.statSync(file).isFile()) return false; } catch { return false; }
    const result = spawn(file, ['plugin', 'add', '--help'], { encoding: 'utf8', timeout: 20000 });
    return !result.error && result.status === 0;
  };
  if (explicit) {
    if (usable(path.resolve(explicit))) return path.resolve(explicit);
    throw new Error('The specified Codex CLI does not support `plugin add`: ' + explicit);
  }
  const found = candidates.find(usable);
  if (!found) throw new Error('A Codex CLI with `plugin add` support is required. Update Codex or pass --codex-cli <path>.');
  return found;
}

function codex(cli, args, { spawn = spawnSync, env = process.env } = {}) {
  const result = spawn(cli, args, { encoding: 'utf8', timeout: 120000, env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('codex ' + args.slice(0, 2).join(' ') + ' failed: ' + String(result.stderr || result.stdout || result.status).trim().slice(0, 400));
  return result.stdout;
}

export function ensureCodexHome(env = process.env, home = os.homedir()) {
  // The CLI refuses to start when CODEX_HOME names a missing directory.
  const codexHome = path.resolve(env.CODEX_HOME || path.join(home, '.codex'));
  fs.mkdirSync(codexHome, { recursive: true });
  return codexHome;
}

export function registerPlugin({ cli, marketplaceName, version, spawn = spawnSync, env = process.env }) {
  const id = PLUGIN_NAME + '@' + marketplaceName;
  JSON.parse(codex(cli, ['plugin', 'add', id, '--json'], { spawn, env }));
  const catalog = JSON.parse(codex(cli, ['plugin', 'list', '--json'], { spawn, env }));
  const installed = (catalog.installed || []).filter(p => p?.pluginId === id && p.version === version && p.installed === true && p.enabled === true);
  if (installed.length !== 1) throw new Error('Codex did not report one enabled v' + version + ' installation of ' + id + '.');
  return installed[0];
}

export function unregisterPlugin({ cli, marketplaceName, spawn = spawnSync, env = process.env }) {
  codex(cli, ['plugin', 'remove', PLUGIN_NAME + '@' + marketplaceName, '--json'], { spawn, env });
}

export function runMarketplaceHelper(helper, args, { node = process.execPath, env = process.env, spawn = spawnSync } = {}) {
  const result = spawn(node, [helper, ...args], { encoding: 'utf8', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(String(result.stderr || 'Marketplace helper failed').trim().split('\n').pop());
  return result.stdout.trim();
}

// Rename within a volume; fall back to copy+remove only across devices.
export function moveTree(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  if (fs.existsSync(to)) throw new Error('Refusing to overwrite existing directory: ' + to);
  try { fs.renameSync(from, to); }
  catch (error) {
    if (error.code !== 'EXDEV') throw error;
    fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
    fs.rmSync(from, { recursive: true, force: true });
  }
}

export function assertPluginTree(dir) {
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, '.codex-plugin', 'plugin.json'), 'utf8'));
  if (manifest.name !== PLUGIN_NAME) throw new Error('Directory belongs to another plugin: ' + dir);
  return manifest;
}

// Copy the release into place. The replaced tree is moved, never deleted.
export function stagePluginTree({ source, target, retired }) {
  const stage = target + '.stage-' + randomUUID().slice(0, 8);
  fs.cpSync(source, stage, { recursive: true, filter: file => !EXCLUDED.has(path.basename(file)) });
  let replaced = null;
  try {
    if (fs.existsSync(target)) { assertPluginTree(target); moveTree(target, retired); replaced = retired; }
    fs.renameSync(stage, target);
  } catch (error) {
    if (replaced && !fs.existsSync(target)) moveTree(replaced, target);
    fs.rmSync(stage, { recursive: true, force: true });
    throw error;
  }
  return replaced;
}
