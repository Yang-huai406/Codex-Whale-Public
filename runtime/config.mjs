import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from '../vendor/smol-toml/dist/index.js';
import { CODEX_HOME, DATA_HOME, readJson, writeJson } from './paths.mjs';

export const DEFAULT_CONFIG = {
  provider: 'auto', baseUrl: '', keyEnv: '', profile: '', projectDir: '', currency: 'USD',
  balancePath: '', balanceField: 'data.balance', usedField: '', balanceScale: 1,
  billingUsageDivisor: 100, quotaPerUnit: 500000,
  dashboardUrl: '', monitorSessions: true, refreshSeconds: 60,
  models: {},
};

function cleanUrl(value, { allowEmpty = false } = {}) {
  if (!value && allowEmpty) return '';
  let u;
  try { u = new URL(value); } catch { throw new Error('API 地址无效'); }
  if (u.username || u.password || u.search || u.hash) throw new Error('API 地址不能包含密钥、查询参数或片段');
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
  if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw new Error('API 地址须使用 HTTPS（本机服务除外）');
  return u.toString().replace(/\/$/, '');
}

function numberIn(value, min, max, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) throw new Error(label + '超出有效范围');
  return n;
}

export function validateConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('设置必须是 JSON 对象');
  const c = structuredClone(DEFAULT_CONFIG);
  for (const k of Object.keys(c)) if (Object.hasOwn(input, k)) c[k] = input[k];
  if (!['auto', 'billing', 'newapi', 'custom-json', 'deepseek'].includes(c.provider)) throw new Error('未知余额接口类型');
  c.baseUrl = cleanUrl(String(c.baseUrl || ''), { allowEmpty: true });
  c.dashboardUrl = cleanUrl(String(c.dashboardUrl || ''), { allowEmpty: true });
  c.keyEnv = String(c.keyEnv || '').trim();
  if (c.keyEnv && !/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.keyEnv)) throw new Error('密钥环境变量名称无效');
  c.profile = String(c.profile || '').slice(0, 128);
  c.projectDir = String(c.projectDir || '');
  c.currency = String(c.currency || 'USD').toUpperCase();
  if (!/^[A-Z]{3}$/.test(c.currency)) throw new Error('币种须使用 USD、CNY 等三位代码');
  c.refreshSeconds = numberIn(c.refreshSeconds, 15, 3600, '刷新间隔');
  c.monitorSessions = c.monitorSessions === true;
  c.billingUsageDivisor = numberIn(c.billingUsageDivisor, 0.000001, 1e12, '用量单位换算');
  c.quotaPerUnit = numberIn(c.quotaPerUnit, 0.000001, 1e12, '额度单位换算');
  c.balanceScale = numberIn(c.balanceScale, 0.000000001, 1e12, '余额系数');
  c.balancePath = String(c.balancePath || '');
  if (c.balancePath && (!c.balancePath.startsWith('/') || c.balancePath.startsWith('//') || /[\\#\r\n]/.test(c.balancePath))) throw new Error('余额路径须为当前 API 域名下的绝对路径');
  for (const k of ['balanceField', 'usedField']) {
    c[k] = String(c[k] || '');
    if (c[k] && !/^[A-Za-z0-9_.]+$/.test(c[k])) throw new Error('字段路径仅支持字母、数字、下划线和点');
    if (c[k].split('.').some(x => ['__proto__', 'constructor', 'prototype'].includes(x))) throw new Error('字段路径无效');
  }
  if (!c.models || typeof c.models !== 'object' || Array.isArray(c.models)) throw new Error('模型价格须为 JSON 对象');
  const models = {};
  for (const [model, prices] of Object.entries(c.models)) {
    if (!model || model.length > 150 || ['__proto__', 'constructor', 'prototype'].includes(model)) throw new Error('模型名称无效');
    if (!prices || typeof prices !== 'object') throw new Error('模型价格无效');
    models[model] = {};
    for (const field of ['input', 'cachedInput', 'output']) models[model][field] = numberIn(prices[field], 0, 1e9, '模型价格');
    if (prices.cacheWrite !== undefined) models[model].cacheWrite = numberIn(prices.cacheWrite, 0, 1e9, '缓存写入价格');
  }
  c.models = models;
  return c;
}

export class ConfigStore {
  constructor({ dataDir = DATA_HOME, codexHome = CODEX_HOME, env = process.env } = {}) {
    this.dataDir = dataDir; this.codexHome = codexHome; this.env = env;
    this.file = path.join(dataDir, 'api-settings.json');
  }
  load() { return validateConfig(readJson(this.file, DEFAULT_CONFIG)); }
  save(patch) {
    if (Object.keys(patch).some(k => /secret|token|api.?key|password/i.test(k) && k !== 'keyEnv')) throw new Error('请填写密钥环境变量名；插件设置中不保存密钥');
    const c = validateConfig({ ...this.load(), ...patch });
    writeJson(this.file, c); return c;
  }
  resolve() {
    const setting = this.load();
    const file = path.join(this.codexHome, 'config.toml');
    let config = {};
    if (fs.existsSync(file)) {
      try { config = parse(fs.readFileSync(file, 'utf8')); }
      catch { throw new Error('Codex config.toml 无法解析，请检查配置文件'); }
    }
    // A project file may come from a downloaded repository. Keep the trusted
    // user's endpoint before overlaying it; project values cannot authorize a
    // different destination to receive the user's global/environment key.
    const trustedProfileName = setting.profile || this.env.CODEX_PROFILE || config.profile || '';
    const trustedEffective = { ...config, ...(trustedProfileName ? config.profiles?.[trustedProfileName] : {}) };
    const trustedProvider = trustedEffective.model_providers?.[trustedEffective.model_provider || 'openai'] || {};
    const trustedOrigin = new URL(cleanUrl(trustedProvider.base_url || this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1')).origin;
    let projectLoaded = false;
    if (setting.projectDir) {
      const projectFile = path.join(path.resolve(setting.projectDir), '.codex', 'config.toml');
      if (fs.existsSync(projectFile)) {
        let local;
        try { local = parse(fs.readFileSync(projectFile, 'utf8')); } catch { throw new Error('项目 .codex/config.toml 无法解析'); }
        config = { ...config, ...local, model_providers: { ...config.model_providers, ...local.model_providers }, profiles: { ...config.profiles, ...local.profiles } };
        projectLoaded = true;
      }
    }
    const profileName = setting.profile || this.env.CODEX_PROFILE || config.profile || '';
    if (profileName && !config.profiles?.[profileName]) throw new Error('找不到所选 Codex profile');
    const effective = { ...config, ...(profileName ? config.profiles[profileName] : {}) };
    const id = effective.model_provider || 'openai';
    const provider = effective.model_providers?.[id] || {};
    const originalBase = cleanUrl(provider.base_url || this.env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
    const baseUrl = cleanUrl(setting.baseUrl || originalBase);
    if (!setting.keyEnv && projectLoaded && new URL(originalBase).origin !== trustedOrigin) throw new Error('项目配置更换 API 域名时，请在挂件设置中明确指定该服务专用的密钥环境变量；不会转发全局密钥');
    if (!setting.keyEnv && new URL(baseUrl).origin !== new URL(originalBase).origin) throw new Error('更换 API 域名时请指定该服务自己的密钥环境变量，不能复用原服务密钥');
    let key = '', keySource = 'none';
    const envName = setting.keyEnv || provider.env_key || '';
    if (envName && this.env[envName]) { key = this.env[envName]; keySource = 'environment'; }
    else if (!setting.keyEnv && provider.experimental_bearer_token) { key = provider.experimental_bearer_token; keySource = 'codex-provider'; }
    else if (!setting.keyEnv && !provider.env_key) {
      if (this.env.OPENAI_API_KEY) { key = this.env.OPENAI_API_KEY; keySource = 'environment'; }
      else {
        const auth = readJson(path.join(this.codexHome, 'auth.json'), {});
        if (typeof auth.OPENAI_API_KEY === 'string') { key = auth.OPENAI_API_KEY; keySource = 'codex-auth'; }
      }
    }
    key = String(key || '').trim().replace(/^Bearer\s+/i, '');
    if (/[\r\n]/.test(key)) throw new Error('API 密钥格式无效');
    const accountId = crypto.createHash('sha256').update(baseUrl + '\0' + key).digest('hex').slice(0, 24);
    const host = new URL(baseUrl).hostname;
    // 0.2.0: no service-specific label. The display name comes from the user's
    // own Codex provider entry, the provider id, or the hostname of the endpoint
    // they configured; the package itself names no vendor.
    const providerName = provider.name || id || host;
    const dashboardUrl = setting.dashboardUrl || (host === 'api.openai.com' ? 'https://platform.openai.com/settings/organization/billing/overview' : new URL(baseUrl).origin);
    return { setting, id, model: effective.model || '', profileName, providerName, baseUrl, key, keySource, accountId, dashboardUrl };
  }
  publicInfo() {
    const c = this.resolve();
    return { id: c.id, providerName: c.providerName, baseUrl: c.baseUrl, model: c.model, profile: c.profileName, hasKey: !!c.key, keySource: c.keySource, accountId: c.accountId, dashboardUrl: c.dashboardUrl, settings: c.setting };
  }
}
