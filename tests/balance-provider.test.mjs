import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ConfigStore } from '../runtime/config.mjs';
import { WhaleService } from '../runtime/service.mjs';
import { BalanceProvider } from '../runtime/providers.mjs';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'whale-provider-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const codexHome = path.join(root, 'codex'), dataDir = path.join(root, 'data');
  fs.mkdirSync(codexHome);
  const file = path.join(codexHome, 'config.toml');
  const write = (id = 'openai') => fs.writeFileSync(file, `model_provider = "${id}"
model = "${id === 'openai' ? 'gpt-test' : 'deepseek-test'}"
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/"
experimental_bearer_token = "test-deepseek-only"
[model_providers.secondary]
name = "DeepSeek"
base_url = "https://api.deepseek.com/"
experimental_bearer_token = "test-deepseek-only"
`);
  write();
  const config = new ConfigStore({ codexHome, dataDir, env: {} });
  return { root, config, write };
}

test('balance stays on DeepSeek across GPT and secondary switches; session context follows Codex', t => {
  const { config, write } = fixture(t);
  config.save({ balanceProviderId: 'deepseek', currency: 'CNY' });
  const pinned = config.resolve();
  assert.equal(pinned.id, 'deepseek');
  assert.equal(pinned.key, 'test-deepseek-only');
  assert.equal(config.resolve({ forSession: true }).id, 'openai');
  assert.equal(config.resolve({ forSession: true }).key, '');
  write('secondary');
  assert.equal(config.resolve().accountId, pinned.accountId);
  assert.equal(config.resolve({ forSession: true }).id, 'secondary');
});

test('empty selection keeps original follow-current behavior', t => {
  const { config, write } = fixture(t);
  assert.equal(config.resolve().id, 'openai');
  write('secondary');
  assert.equal(config.resolve().id, 'secondary');
});

test('missing selected provider fails clearly instead of silently using another key', t => {
  const { config } = fixture(t);
  config.save({ balanceProviderId: 'missing' });
  assert.throws(() => config.resolve(), /余额.*服务商/);
});

test('project configuration cannot redirect the pinned global key', t => {
  const { root, config } = fixture(t);
  const project = path.join(root, 'project');
  fs.mkdirSync(path.join(project, '.codex'), { recursive: true });
  fs.writeFileSync(path.join(project, '.codex/config.toml'), '[model_providers.deepseek]\nbase_url="https://untrusted.example"\n');
  config.save({ balanceProviderId: 'deepseek', projectDir: project });
  const resolved = config.resolve();
  assert.equal(new URL(resolved.baseUrl).hostname, 'api.deepseek.com');
  assert.equal(resolved.key, 'test-deepseek-only');
});

test('changing API origin still requires a dedicated key environment variable', t => {
  const { config } = fixture(t);
  config.save({ balanceProviderId: 'deepseek', baseUrl: 'https://other.example' });
  assert.throws(() => config.resolve(), /密钥环境变量/);
});

test('GPT turns do not sample or charge the pinned DeepSeek account', async t => {
  const { config } = fixture(t);
  config.save({ balanceProviderId: 'deepseek', currency: 'CNY' });
  const queried = [];
  const service = new WhaleService({ config, provider: { async balance(c) {
    queried.push(c.id);
    return { ok: false };
  } } });
  const meta = { id: 'session:turn', sessionId: 'session', turnId: 'turn', startedAt: Date.now(), notify: false,
    byModel: { 'gpt-test': { input_tokens: 10, output_tokens: 2 } } };
  service.beginTurn(meta);
  assert.equal(service.turns.get(meta.id).context.id, 'openai');
  await service.finishTurn({ ...meta, outcome: 'completed' });
  assert.deepEqual(queried, ['openai', 'openai']);
  assert.equal(service.ledger.load(service.scope(config.resolve(), 'CNY')).events.length, 0);
  const current = config.resolve({ forSession: true });
  const records = service.ledger.load(service.scope(current, 'CNY'));
  assert.equal(records.events[0].source, 'token-only');
});

test('DeepSeek continues observing the pinned account while upstream keeps account debits separate from per-turn costs', async t => {
  const { config, write } = fixture(t);
  config.save({ balanceProviderId: 'deepseek', currency: 'CNY' });
  write('secondary');
  let balance = 100;
  const service = new WhaleService({ config, provider: { async balance(c) {
    return { ok: true, accountId: c.accountId, totalBalance: balance--, totalUsed: null, currency: 'CNY' };
  } } });
  const meta = { id: 'session:turn', sessionId: 'session', turnId: 'turn', startedAt: Date.now(), notify: false };
  service.beginTurn(meta);
  await service.finishTurn({ ...meta, outcome: 'completed' });
  const events = service.ledger.load(service.scope(config.resolve(), 'CNY')).events;
  assert.equal(events[0].source, 'token-only');
  assert.equal(events[0].amount, null);
  assert.equal(events[0].accountIntervalAmount, 1);
});

test('recovery uses the conversation account instead of the pinned display account', t => {
  const { config } = fixture(t);
  config.save({ balanceProviderId: 'deepseek' });
  const service = new WhaleService({ config });
  const current = config.resolve({ forSession: true });
  service.journal.put({ stage: 'active', accountId: current.accountId, currency: current.setting.currency,
    pricing: {}, meta: { id: 'session:turn', sessionId: 'session', turnId: 'turn' } });
  service.prepareRecovery();
  assert.equal(service.turns.get('session:turn').context.id, 'openai');
  assert.equal(service.turns.get('session:turn').canQuery, true);
});

test('an explicit fixed wallet remains display-only when Codex switches providers', t => {
  const { config, write } = fixture(t);
  config.save({ balanceProviderId: 'deepseek', connectionMode: 'fixed', selectedConnection: 'wallet',
    connections: [{ id: 'wallet', name: 'Wallet', baseUrl: 'https://wallet.example/v1',
      balance: { adapter: 'none' } }] });
  assert.equal(config.resolve().baseUrl, 'https://wallet.example/v1');
  assert.equal(config.resolve({ forSession: true }).id, 'openai');
  write('secondary');
  assert.equal(config.resolve().baseUrl, 'https://wallet.example/v1');
  assert.equal(config.resolve({ forSession: true }).id, 'secondary');
});

test('fixed wallet rules are excluded when resolving turns, even with a matching provider ID', async t => {
  const { config, write } = fixture(t);
  write('secondary');
  config.save({ connectionMode: 'fixed', selectedConnection: 'wallet', connections: [
    { id: 'wallet', name: 'Wallet', baseUrl: 'https://wallet.example/v1',
      match: { providerId: 'secondary' }, balance: { adapter: 'billing' } },
  ] });
  assert.equal(config.resolve().connectionId, 'wallet');
  const session = config.resolve({ forSession: true });
  assert.equal(session.id, 'secondary');
  assert.equal(session.connectionId, '');
  const requests = [];
  const provider = new BalanceProvider({ fetchImpl: async url => { requests.push(url); return new Response('{}'); } });
  assert.equal((await provider.balance(session)).balanceStatus, 'unsupported');
  assert.deepEqual(requests, []);
});

test('fixed mode allows a separately configured follow rule for the current provider', t => {
  const { config, write } = fixture(t);
  write('secondary');
  config.save({ connectionMode: 'fixed', selectedConnection: 'wallet', connections: [
    { id: 'wallet', name: 'Wallet', baseUrl: 'https://wallet.example/v1', balance: { adapter: 'billing' } },
    { id: 'session', name: 'Session provider', match: { providerId: 'secondary' }, balance: { adapter: 'deepseek' } },
  ] });
  assert.equal(config.resolve().connectionId, 'wallet');
  const session = config.resolve({ forSession: true });
  assert.equal(session.connectionId, 'session');
  assert.equal(session.key, 'test-deepseek-only');
  assert.equal(new URL(session.baseUrl).hostname, 'api.deepseek.com');
});
