import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { DATA_HOME } from '../runtime/paths.mjs';

const runtimeDir = path.join(DATA_HOME, 'desktop-runtime');
const candidates = [
  path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
  path.join(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
];
if (process.platform === 'win32') {
  const lookup = spawnSync('where.exe', ['npm.cmd'], { encoding: 'utf8', windowsHide: true });
  for (const line of (lookup.stdout || '').trim().split(/\r?\n/)) if (line) candidates.push(path.join(path.dirname(line), 'node_modules', 'npm', 'bin', 'npm-cli.js'));
}
const npm = candidates.find(file => fs.existsSync(file));
if (!npm) { process.stderr.write('请先安装包含 npm 的 Node.js 24 或更新版本。\n'); process.exit(1); }
fs.mkdirSync(runtimeDir, { recursive: true });
let result = spawnSync(process.execPath, [npm, '--prefix', runtimeDir, '--cache', path.join(DATA_HOME, 'npm-cache'), 'install', '--no-audit', '--no-fund', '--ignore-scripts', '--save-exact', 'electron@44.3.0'], { stdio: 'inherit', windowsHide: true });
if (result.status !== 0) process.exit(result.status || 1);
result = spawnSync(process.execPath, [path.join(runtimeDir, 'node_modules', 'electron', 'install.js')], { stdio: 'inherit', windowsHide: true });
if (result.status !== 0) process.exit(result.status || 1);
process.stdout.write('桌面组件安装完成。可以启动桌面挂件。\n');
