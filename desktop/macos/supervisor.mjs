import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { bridgeRequest } from '../../runtime/bridge.mjs';

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
function argument(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const dataDir = path.resolve(argument('--data-dir', path.join(process.env.CODEX_HOME || path.join(process.env.HOME || '', '.codex'), 'whale-widget')));
const pluginRoot = path.resolve(argument('--plugin-root', scriptRoot));
const configFile = path.join(dataDir, 'follow-config.json');
const lockFile = path.join(dataDir, 'macos-supervisor.lock');
const stateFile = path.join(dataDir, 'supervisor-state.json');
const followStateFile = path.join(dataDir, 'follow-state.json');
const logFile = path.join(dataDir, 'macos-supervisor.log');

fs.mkdirSync(dataDir, { recursive: true });
const readJson = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); } catch { return fallback; }
};
const writeJson = (file, value) => {
  const temporary = file + '.' + process.pid + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, file);
};
const log = message => {
  const line = new Date().toISOString() + ' ' + message + '\n';
  try { fs.appendFileSync(logFile, line); } catch {}
  process.stderr.write(line);
};
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const processAlive = pid => {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  try { process.kill(pid, 0); return true; } catch (error) { return error.code === 'EPERM'; }
};

function acquireLock() {
  const existing = readJson(lockFile, null);
  if (existing && processAlive(Number(existing.pid))) {
    log('another macOS supervisor is already running');
    process.exit(0);
  }
  try { fs.unlinkSync(lockFile); } catch {}
  const descriptor = fs.openSync(lockFile, 'wx', 0o600);
  fs.writeFileSync(descriptor, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }, null, 2));
  fs.closeSync(descriptor);
}

function releaseLock() {
  if (readJson(lockFile, {}).pid !== process.pid) return;
  try { fs.unlinkSync(lockFile); } catch {}
}

const config = readJson(configFile, {});
if (config.platform !== 'darwin' || config.mode !== 'follow-codex') {
  process.stderr.write('macOS follow configuration is missing or invalid. Run scripts/install-macos.mjs first.\n');
  process.exit(1);
}
const electronPath = path.resolve(config.electronPath || '');
const probePath = path.resolve(config.probePath || '');
if (!fs.existsSync(electronPath) || !fs.existsSync(probePath)) {
  process.stderr.write('Desktop runtime or window probe is missing. Run scripts/install-macos.mjs first.\n');
  process.exit(1);
}

acquireLock();
let stopping = false;
let child = null;
let childStartedAt = 0;
let lastLaunchAt = 0;
let probe = null;
let probeBuffer = '';
let hostState = { hostAlive: false, hostPid: 0, window: '0', visible: false, attached: false, nativeFollowing: false };
let sequence = 0;
let pendingState = null;
let sending = false;
let heartbeat = null;

function queueHostState(state) {
  pendingState = state;
  void pumpHostState();
}

async function pumpHostState() {
  if (sending) return;
  sending = true;
  while (pendingState && !stopping) {
    const state = pendingState;
    pendingState = null;
    try {
      await bridgeRequest('/internal/host', { method: 'POST', body: state, dataDir, timeoutMs: 1500 });
    } catch {
      // The Electron host may not have created its socket yet. The heartbeat
      // retries the latest state without allowing an unbounded queue to form.
    }
    await delay(4);
  }
  sending = false;
}

function pausedFor(hostPid) {
  const pause = readJson(path.join(dataDir, 'pause-until-host-exit.json'), {});
  if (!pause.hostPid) return false;
  if (!hostState.hostAlive) {
    try { fs.unlinkSync(path.join(dataDir, 'pause-until-host-exit.json')); } catch {}
    return false;
  }
  return String(pause.hostPid) === String(hostPid);
}

function startChild() {
  if (stopping || child || !hostState.hostAlive || pausedFor(hostState.hostPid)) return;
  const now = Date.now();
  if (now - lastLaunchAt < 4000) return;
  const main = path.join(pluginRoot, 'desktop', 'main.cjs');
  if (!fs.existsSync(main)) {
    log('desktop/main.cjs is missing');
    return;
  }
  const environment = { ...process.env, WHALE_INITIAL_HOST: JSON.stringify(hostState), WHALE_LAUNCH_TIME: String(now) };
  delete environment.ELECTRON_RUN_AS_NODE;
  child = spawn(electronPath, [main, '--whale-data=' + dataDir, '--supervised'], {
    cwd: pluginRoot,
    env: environment,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  childStartedAt = now;
  lastLaunchAt = now;
  child.stdout.on('data', data => {
    const text = String(data).trim();
    if (text) log('electron: ' + text.slice(0, 1000));
  });
  child.stderr.on('data', data => {
    const text = String(data).trim();
    if (text) log('electron: ' + text.slice(0, 4000));
  });
  child.on('error', error => log('electron failed to start: ' + error.message));
  child.on('exit', (code, signal) => {
    log('electron exited: code=' + String(code) + ' signal=' + String(signal));
    child = null;
  });
}

function stopChild() {
  if (!child) return Promise.resolve();
  const running = child;
  try {
    queueHostState({ hostAlive: false, monitorExit: true, serial: ++sequence });
    running.stdin.end();
  } catch {}
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      try { running.kill('SIGKILL'); } catch {}
      resolve();
    }, 5000);
    running.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function handleHostState(state) {
  hostState = state;
  hostState.serial = ++sequence;
  writeJson(followStateFile, {
    childPid: child?.pid || null,
    state: hostState,
    native: { enabled: false, mode: 'CGWindowList polling' },
    at: new Date().toISOString(),
  });
  queueHostState(hostState);
  if (hostState.hostAlive) startChild();
  else if (child) {
    queueHostState({ hostAlive: false, monitorExit: true, serial: ++sequence });
  }
}

probe = spawn(probePath, ['--bundle-id', process.env.WHALE_CODEX_BUNDLE_ID || config.bundleId || 'com.openai.codex'], {
  cwd: pluginRoot,
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
});
probe.stdout.setEncoding('utf8');
probe.stdout.on('data', chunk => {
  probeBuffer += chunk;
  const lines = probeBuffer.split('\n');
  probeBuffer = lines.pop() || '';
  for (const line of lines) {
    if (!line.trim()) continue;
    try { void handleHostState(JSON.parse(line)); }
    catch { log('invalid window probe output'); }
  }
});
probe.stderr.on('data', data => log('probe: ' + String(data).trim().slice(0, 4000)));
probe.on('error', error => log('window probe failed to start: ' + error.message));
probe.on('exit', (code, signal) => {
  if (!stopping) log('window probe exited unexpectedly: code=' + String(code) + ' signal=' + String(signal));
});

writeJson(stateFile, {
  pid: process.pid,
  parentPid: process.ppid,
  startedAt: new Date().toISOString(),
  host: 'node-macos',
  platform: 'darwin',
  pluginRoot,
});

heartbeat = setInterval(() => {
  if (!stopping) {
    queueHostState(hostState);
    if (hostState.hostAlive) startChild();
    writeJson(stateFile, {
      pid: process.pid,
      parentPid: process.ppid,
      startedAt: readJson(stateFile, {}).startedAt || new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      childPid: child?.pid || null,
      host: 'node-macos',
      platform: 'darwin',
      pluginRoot,
    });
  }
}, 500);
heartbeat.unref?.();

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  clearInterval(heartbeat);
  log('stopping: ' + signal);
  try { probe?.kill('SIGTERM'); } catch {}
  await stopChild();
  releaseLock();
  try { fs.unlinkSync(stateFile); } catch {}
  process.exit(0);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT', () => { void shutdown('SIGINT'); });
process.on('uncaughtException', error => log('uncaught exception: ' + error.stack));
process.on('unhandledRejection', error => log('unhandled rejection: ' + String(error?.stack || error)));

log('macOS supervisor started for ' + pluginRoot);
