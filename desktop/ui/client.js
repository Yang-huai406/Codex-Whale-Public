(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let currentConfig = null, toastTimer;
  function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').hidden = true; }, 6000); }
  window.whaleToast = toast;
  async function api(url, method = 'GET', body) {
    const response = await fetch(url, { method, headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' });
    const result = await response.json();
    if (result.ok === false) throw new Error(result.error || '操作未完成');
    return result;
  }
  const form = $('settings-form');
  const element = name => form.elements.namedItem(name);
  async function openSettings() {
    try {
      const info = await api('/api/config'); currentConfig = info.settings;
      for (const key of ['provider', 'baseUrl', 'keyEnv', 'profile', 'projectDir', 'currency', 'dashboardUrl', 'balancePath', 'balanceField', 'usedField', 'balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) element(key).value = currentConfig[key] ?? '';
      element('baseUrl').placeholder = info.baseUrl;
      element('monitorSessions').checked = currentConfig.monitorSessions;
      const model = info.model || '';
      element('priceModel').value = model;
      const prices = currentConfig.models[model] || {};
      for (const [name, key] of [['priceInput', 'input'], ['priceCached', 'cachedInput'], ['priceOutput', 'output'], ['priceWrite', 'cacheWrite']]) element(name).value = prices[key] ?? '';
      $('settings-error').hidden = true; $('settings-dialog').showModal();
    } catch (error) { toast(error.message); }
  }
  window.addEventListener('whale-open-settings', openSettings);
  for (const id of ['close-settings', 'cancel-settings']) $(id).addEventListener('click', () => $('settings-dialog').close());
  form.addEventListener('submit', async event => {
    event.preventDefault();
    try {
      const settings = structuredClone(currentConfig);
      for (const key of ['provider', 'baseUrl', 'keyEnv', 'profile', 'projectDir', 'currency', 'dashboardUrl', 'balancePath', 'balanceField', 'usedField']) settings[key] = element(key).value.trim();
      for (const key of ['balanceScale', 'billingUsageDivisor', 'quotaPerUnit']) settings[key] = Number(element(key).value);
      settings.monitorSessions = element('monitorSessions').checked;
      const fields = ['priceInput', 'priceCached', 'priceOutput'];
      const hasPrice = fields.some(key => element(key).value !== '');
      const model = element('priceModel').value.trim();
      if (hasPrice) {
        if (!model || fields.some(key => element(key).value === '')) throw new Error('请完整填写模型名称、输入、缓存命中和输出价格');
        const prices = { input: Number(element('priceInput').value), cachedInput: Number(element('priceCached').value), output: Number(element('priceOutput').value) };
        if (element('priceWrite').value !== '') prices.cacheWrite = Number(element('priceWrite').value);
        settings.models[model] = prices;
      } else if (model) delete settings.models[model];
      await api('/api/config', 'PUT', settings); location.reload();
    } catch (error) { $('settings-error').hidden = false; $('settings-error').textContent = error.message; }
  });
})();
