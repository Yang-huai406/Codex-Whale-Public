(() => {
  'use strict';
  const validMode = value => value === 'api' || value === 'subscription';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function windowText(item) {
    const used = number(item.usedPercent);
    return used === null ? '额度比例未知' : `已用 ${used.toFixed(1)}% · 剩余 ${Math.max(0, 100 - used).toFixed(1)}%${item.stale ? '（快照已过期）' : ''}`;
  }
  function tokenText(value) { const n = number(value); return n === null ? '暂无记录' : n.toLocaleString() + ' token'; }
  function quotaLabel(item) { return item.windowDurationMins === 300 ? '5 小时额度' : item.windowDurationMins === 10080 ? '每周额度' : item.label || '额度窗口'; }
  function noticeText(value) {
    if (!value || value.notify === false) return '';
    if (value.failureKind === 'high-demand') return '挤不进去...';
    return number(value.tokens) === null ? '本轮 token 暂无记录' : '本轮本机已观测：' + tokenText(value.tokens);
  }
  const bubbleModules = Object.freeze({
    'quota5h': { label: '5 小时剩余', token: 'quota_5h_remaining', tpl: '5 小时剩余 {quota_5h_remaining}' },
    'quotaWeek': { label: '每周剩余', token: 'quota_week_remaining', tpl: '每周剩余 {quota_week_remaining}' },
    'reset5h': { label: '5 小时重置时间', token: 'quota_5h_reset', tpl: '重置 {quota_5h_reset}' },
    'resetWeek': { label: '每周重置时间', token: 'quota_week_reset', tpl: '周重置 {quota_week_reset}' },
    'tokens5h': { label: '本机滚动 5 小时 token', token: 'tokens_5h', tpl: '本机 5 小时 {tokens_5h} token' },
    'tokens7d': { label: '本机近 7 天 token', token: 'tokens_7d', tpl: '本机 7 天 {tokens_7d} token' }
  });
  function resetText(value) {
    if (number(value) === null || !value) return '未知';
    const d = new Date(value < 1e12 ? value * 1000 : value);
    return Number.isFinite(d.getTime()) ? d.toLocaleString() : '未知';
  }
  function bubbleValues(data) {
    const sub = data?.subscription || {}, tokens = sub.tokens || data?.tokens || {}, values = {};
    for (const [name, duration] of [['5h', 300], ['week', 10080]]) {
      const item = sub.available && (sub.windows || []).find(w => w.windowDurationMins === duration);
      const used = item ? number(item.usedPercent) : null;
      const suffix = item?.stale ? '（过期）' : '';
      values['quota_' + name + '_remaining'] = used === null ? '未知' : Math.max(0, 100 - used).toFixed(1) + '%' + suffix;
      values['quota_' + name + '_used'] = used === null ? '未知' : used.toFixed(1) + '%' + suffix;
      values['quota_' + name + '_reset'] = item ? resetText(item.resetsAt) + suffix : '未知';
    }
    for (const [name, field] of [['5h', 'last5Hours'], ['7d', 'total']]) {
      const value = number(tokens[field]);
      values['tokens_' + name] = value === null ? '暂无记录' : value.toLocaleString() + (tokens.complete === false ? '（部分）' : '');
    }
    return values;
  }
  function defaultBubbleModules() {
    return [
      { type: 'text', text: 'Codex 订阅', size: 8, bold: true, color: '#203170' },
      { type: 'quota5h', tpl: bubbleModules.quota5h.tpl, size: 8, bold: true, color: '#203170' },
      { type: 'quotaWeek', tpl: bubbleModules.quotaWeek.tpl, size: 6, color: '#536ba9' }
    ];
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validMode, windowText, tokenText, noticeText, quotaLabel, bubbleModules, bubbleValues, defaultBubbleModules };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const key = 'dshw-account-view';
  let mode = 'api', generation = 0, switching = false, latestNotice = null, snapshot = null, pending = null;
  let modeButtons = [], status = null, modeRevision = 0;
  try { const saved = localStorage.getItem(key); if (validMode(saved)) mode = saved; } catch {}
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function close() { generation++; pending?.controller.abort(); pending = null; }
  function updateButtons() { for (const button of modeButtons) { button.disabled = switching; button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); } for(const el of document.querySelectorAll('[data-account-api]'))el.hidden=mode==='subscription';
    document.documentElement.dataset.accountMode = mode;
    for (const el of document.querySelectorAll('.whale-mode-description')) el.textContent = mode === 'subscription' ? '查看 5 小时 / 周额度与本机 token 用量' : '查看当前 API 余额与消费记录';
    for (const el of document.querySelectorAll('.whale-mode-open')) el.textContent = mode === 'subscription' ? '查看订阅额度 →' : '配置 API 余额 →';
  }
  function commit(next) {
    mode = next; try { localStorage.setItem(key, mode); } catch {}
    close(); latestNotice = null; snapshot = null; updateButtons();
    window.dispatchEvent(new CustomEvent('whale-account-view', { detail: { mode } }));
  }
  async function setMode(next) {
    if (!validMode(next) || switching) return false;
    modeRevision++; switching = true; updateButtons(); if (status) status.textContent = '正在保存…';
    try {
      const response = await fetch('/api/display-mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: next }) });
      if (!response.ok) throw Error('切换失败，请重试');
      const result = await response.json();
      if (result.ok === false || (result.mode || result.displayMode) !== next) throw Error('模式未保存，请重试');
      commit(next); if (status) status.textContent = next === 'subscription' ? '已切换。点击下方按钮查看额度。' : '已切换为 API 余额模式。'; return true;
    } catch (e) { if (status) status.textContent = e.message || '切换失败，请重试'; return false; }
    finally { switching = false; updateButtons(); }
  }
  async function refresh() {
    if (mode !== 'subscription') return null;
    if (pending) return pending.promise;
    const own = generation, controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const job = { controller, promise: null };
    job.promise = (async () => {
      try {
        const response = await fetch('/api/insights', { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('暂时无法读取订阅快照');
        const data = await response.json();
        if (data.ok === false) throw Error('暂时无法读取订阅快照');
        if (own !== generation || mode !== 'subscription') return null;
        snapshot = data;
      } catch {
        if (own !== generation || mode !== 'subscription') return null;
        // A failed refresh cannot leave an old snapshot looking current.
        snapshot = { subscription: { available: false, windows: [], reason: '暂时无法读取订阅快照' }, tokens: null };
      } finally {
        clearTimeout(timer);
        if (pending === job) pending = null;
      }
      return snapshot;
    })();
    pending = job;
    return job.promise;
  }
  function notice(value) {
    if (mode !== 'subscription') return;
    latestNotice = value;
    const message = noticeText(value);
    if (message) window.whaleToast?.(message);
    refresh();
  }
  function init() {
    const style = document.createElement('style'); style.textContent = `.whale-account-menu button{cursor:pointer;border:1px solid #9fcbd5;border-radius:8px;padding:5px 9px;background:#fff;color:#173d48}.whale-account-menu{font:12px/1.5 system-ui;padding:5px}.whale-account-menu summary{cursor:pointer}.whale-account-menu button[aria-pressed=true]{background:#237f91;color:white}.whale-account-menu small{display:block;max-width:230px;margin-top:5px}`; document.head.append(style);
    const menu = document.querySelector('.dshwv-menu');
    if (menu) {
      const details = text(menu, 'section', ''); details.className = 'whale-account-menu'; text(details, 'strong', '小鲸鱼 · 控制面板'); menu.prepend(details);
      const row = text(details, 'div', ''); row.setAttribute('role', 'group'); row.setAttribute('aria-label', '额度展示模式');
      for (const [value, label] of [['api', 'API 余额'], ['subscription', 'Codex 订阅']]) { const button = text(row, 'button', label); button.dataset.mode = value; button.onclick = () => setMode(value); modeButtons.push(button); }
      text(details, 'p', '').className = 'whale-mode-description';
      const open = text(details, 'button', ''); open.className = 'whale-mode-open'; open.onclick = () => window.dispatchEvent(new Event(mode === 'subscription' ? 'whale-open-insights' : 'whale-open-settings'));
      status = text(details, 'small', '切换展示模式，不修改登录账号。'); status.setAttribute('role', 'status'); updateButtons();
      const view = menu.querySelector('.dshwv-menuview');
      if (view) {
        const rows = [...view.children];
        const groups = ['外观与位置', '声音与气泡', '用量与资源'].map(label => {
          const group = document.createElement('details'); group.className = 'whale-menu-group';
          text(group, 'summary', label); view.append(group); return group;
        });
        groups[0].open = true;
        for (const child of rows) {
          if (child.classList.contains('dshwv-menu-sep')) { child.remove(); continue; }
          const label = child.textContent;
          const index = /音效|音量|气泡|消耗提示|声音/.test(label) ? 1 : /币种|汇率|资源|工坊|API|额度|峰谷/.test(label) ? 2 : 0;
          groups[index].append(child);
        }
      }
    }
    const initialRevision = modeRevision;
    fetch('/api/display-mode', { cache: 'no-store' }).then(async response => { if (!response.ok) return; const data = await response.json(); const next = data.mode || data.displayMode; if (validMode(next) && !switching && modeRevision === initialRevision) commit(next); }).catch(() => {});
    window.addEventListener('whale-mode-changing', close);
  }
  window.WhaleAccountView = { get mode() { return mode; }, get snapshot() { return snapshot; }, refresh, notice, close, setMode, quotaLabel, bubbleModules, bubbleValues, defaultBubbleModules };
  // Deferred scripts run at readyState=interactive before the widget creates its menu.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
