(() => {
  'use strict';
  const validMode = value => value === 'api' || value === 'subscription';
  const number = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
  function windowText(item) {
    const used = number(item.usedPercent);
    return used === null ? '额度比例未知' : `已用 ${used.toFixed(1)}% · 剩余 ${Math.max(0, 100 - used).toFixed(1)}%${item.stale ? '（快照待更新）' : ''}`;
  }
  function tokenText(value) { const n = number(value); return n === null ? '暂无记录' : n.toLocaleString() + ' token'; }
  function quotaLabel(item) { return item.windowDurationMins === 300 ? '5 小时额度' : item.windowDurationMins === 10080 ? '每周额度' : item.label || '额度窗口'; }
  function noticeText(value) {
    if (!value || value.notify === false) return '';
    if (value.failureKind === 'high-demand') return '挤不进去...';
    return number(value.tokens) === null ? '本轮 token 暂无记录' : '本轮本机已观测：' + tokenText(value.tokens);
  }
  function refreshMessage(data) {
    const sub = data?.subscription;
    if (data?.error || data?.ok === false) return '订阅额度读取失败，请重试';
    if (!sub?.available) return sub?.reason || '尚未观测到订阅额度快照，请在 Codex 完成一轮对话后刷新';
    return (sub.windows || []).some(w => w.stale)
      ? '已重新读取本机记录，仍有额度快照待更新；请在 Codex 完成一轮对话后再刷新'
      : '订阅额度已刷新';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { validMode, windowText, tokenText, noticeText, quotaLabel, refreshMessage };
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const key = 'dshw-account-view';
  let mode = 'api', card = null, content = null, root = null, generation = 0, switching = false, latestNotice = null, snapshot = null, pending = null;
  let modeButtons = [], status = null, modeRevision = 0;
  try { const saved = localStorage.getItem(key); if (validMode(saved)) mode = saved; } catch {}
  function text(parent, tag, value) { const el = document.createElement(tag); el.textContent = value; parent.append(el); return el; }
  function date(value) { if (!value) return '未知'; const d = new Date(typeof value === 'number' && value < 1e12 ? value * 1000 : value); return Number.isFinite(d.getTime()) ? d.toLocaleString() : '未知'; }
  function close() { generation++; pending?.controller.abort(); pending = null; card?.remove(); card = content = null; }
  function position() {
    if (!card) return;
    const anchor = (root || document).querySelector('.dshwv-img') || document.querySelector('.dshwv-img');
    if (!anchor) return;
    const bounds = anchor.getBoundingClientRect(), width = card.offsetWidth || 280, height = card.offsetHeight || 220;
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, bounds.right - width)) + 'px';
    const top = Math.max(8, Math.min(window.innerHeight - height - 8, bounds.top - height - 10 >= 8 ? bounds.top - height - 10 : bounds.bottom + 10)) + 'px';
    if(card.style.left!==left)card.style.left=left;
    if(card.style.top!==top)card.style.top=top;
  }
  function updateButtons() { for (const button of modeButtons) { button.disabled = switching; button.setAttribute('aria-pressed', String(button.dataset.mode === mode)); } for(const el of document.querySelectorAll('[data-account-api]'))el.hidden=mode==='subscription';
    document.documentElement.dataset.accountMode = mode;
    for (const el of document.querySelectorAll('.whale-mode-description')) el.textContent = mode === 'subscription' ? '查看 5 小时 / 周额度与本机 token 用量' : '查看当前 API 余额与消费记录';
    for (const el of document.querySelectorAll('.whale-mode-open')) el.textContent = mode === 'subscription' ? '查看订阅额度 →' : '配置 API 余额 →';
  }
  function followCard(ownCard) {
    if (card !== ownCard) return;
    position(); window.requestAnimationFrame(() => followCard(ownCard));
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
  function renderSnapshot(data) {
    if (!content) return;
    content.replaceChildren(); const sub = data.subscription || {};
    if (!sub.available) text(content, 'p', sub.reason || '暂无可用订阅额度快照。使用订阅账号完成 Codex 请求后刷新。');
    else {
      if (!(sub.windows || []).length) text(content, 'p', '暂无可用额度窗口');
      for (const item of sub.windows || []) {
        const section = text(content, 'section', ''); text(section, 'strong', quotaLabel(item)); text(section, 'p', windowText(item));
        const used = number(item.usedPercent);
        if (used !== null) { const meter = document.createElement('progress'); meter.max = 100; meter.value = Math.min(100, used); meter.setAttribute('aria-label', item.label || '已用额度'); section.append(meter); }
        text(section, 'small', '重置：' + date(item.resetsAt));
        if (item.stale) { text(section, 'small', '快照待更新：请在 Codex 完成一轮对话后刷新'); text(section, 'small', '最近观测：' + date(item.observedAt)); }
      }
    }
    const tokens = sub.tokens || data.tokens || {};
    text(content, 'p', '本机近 7 天：' + tokenText(tokens.total)); text(content, 'p', '本机滚动 5 小时：' + tokenText(tokens.last5Hours));
    if (tokens.complete === false) text(content, 'small', '扫描尚不完整，仅显示部分记录。');
    text(content, 'small', 'token 是本机观测，非官方订阅剩余额度；不包含其他设备，不能用百分比换算剩余 token。');
    const notice = noticeText(latestNotice); if (notice) text(content, 'p', notice); position();
  }
  async function refresh({ force = false } = {}) {
    if (mode !== 'subscription') return null;
    if (pending) return pending.promise;
    if (content) { content.replaceChildren(); text(content, 'p', '正在读取订阅快照…'); position(); }
    const own = generation, controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const job = { controller, promise: null };
    job.promise = (async () => {
      try {
        const response = await fetch('/api/insights' + (force ? '?refresh=1' : ''), { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw Error('暂时无法读取订阅快照');
        const data = await response.json();
        if (data.ok === false || data.error) throw Error('暂时无法读取订阅快照');
        if (own !== generation || mode !== 'subscription') return null;
        snapshot = data; renderSnapshot(snapshot);
      } catch {
        if (own !== generation || mode !== 'subscription') return null;
        // A failed refresh cannot leave an old snapshot looking current.
        snapshot = { ok: false, subscription: { available: false, windows: [], reason: '暂时无法读取订阅快照' }, tokens: null }; renderSnapshot(snapshot);
      } finally {
        clearTimeout(timer);
        if (pending === job) pending = null;
      }
      return snapshot;
    })();
    pending = job;
    return job.promise;
  }
  function toggleBubble(anchorRoot) {
    if (mode !== 'subscription') return false;
    if (card) { close(); return true; }
    root = anchorRoot?.querySelector ? anchorRoot : document;
    card = document.createElement('section'); card.className = 'whale-account-card'; card.setAttribute('aria-label', '会员订阅额度');
    const header = text(card, 'div', ''); header.className = 'whale-account-header'; text(header, 'strong', '会员订阅额度');
    const closeButton = text(header, 'button', '关闭'); closeButton.onclick = close;
    content = text(card, 'div', ''); const refreshButton = text(card, 'button', '刷新'); refreshButton.onclick = async () => { refreshButton.disabled = true; try { const data = await refresh({force:true}); if (data) window.whaleToast?.(refreshMessage(data)); } finally { refreshButton.disabled = false; } };
    document.body.append(card); followCard(card); refresh(); return true;
  }
  function notice(value) {
    if (mode !== 'subscription') return;
    latestNotice = value;
    const message = noticeText(value);
    if (message) window.whaleToast?.(message);
    if (card) refresh();
  }
  function init() {
    const style = document.createElement('style'); style.textContent = `.whale-account-card{position:fixed;z-index:2147483646;width:280px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;box-sizing:border-box;padding:14px;border:1px solid #9fcbd5;border-radius:16px;background:#f6fdff;color:#173d48;box-shadow:0 8px 26px #163f4433;font:13px/1.5 system-ui;pointer-events:auto}.whale-account-card p{margin:8px 0}.whale-account-card small{display:block;color:#496873}.whale-account-card progress{width:100%;accent-color:#258b9c}.whale-account-header{display:flex;justify-content:space-between;align-items:center}.whale-account-card button,.whale-account-menu button{cursor:pointer;border:1px solid #9fcbd5;border-radius:8px;padding:5px 9px;background:#fff;color:#173d48}.whale-account-menu{font:12px/1.5 system-ui;padding:5px}.whale-account-menu summary{cursor:pointer}.whale-account-menu button[aria-pressed=true]{background:#237f91;color:white}.whale-account-menu small{display:block;max-width:230px;margin-top:5px}`; document.head.append(style);
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
    window.addEventListener('resize', position);
    window.addEventListener('whale-mode-changing', close);
  }
  window.WhaleAccountView = { get mode() { return mode; }, get snapshot() { return snapshot; }, refreshMessage, toggleBubble, refresh, notice, close, setMode, quotaLabel };
  // Deferred scripts run at readyState=interactive before the widget creates its menu.
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', init, { once: true }); else init();
})();
