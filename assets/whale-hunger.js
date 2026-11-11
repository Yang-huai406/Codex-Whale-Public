(function (host, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else host.WhaleHunger = api;
})(typeof window === 'object' ? window : globalThis, function () {
  'use strict';
  function subscriptionLow(data, threshold) {
    const sub = data && data.subscription;
    if (!sub || !sub.available || !Array.isArray(sub.windows)) return false;
    return sub.windows.some(w => w.stale === false && Number.isFinite(w.usedPercent) && w.usedPercent >= 0 && w.usedPercent <= 100 && 100 - w.usedPercent <= threshold);
  }
  function apiLow(data, alert) {
    return !!(alert && alert.on && alert.below != null && alert.below !== '' && Number.isFinite(Number(alert.below)) && data && data.ok && !data.stale &&
      (data.balanceStatus === 'finite' || !data.balanceStatus && !data.unlimited) && data.canObserve !== false && Number.isFinite(data.totalBalance) && data.totalBalance <= Number(alert.below));
  }
  function create({body, original, menu, alertSettings}) {
    let enabled = true, threshold = 20, low = false, generation = 0, latestBalance = null, imageAvailable = true;
    try { const saved = JSON.parse(localStorage.getItem('whale-hunger-settings') || '{}');
      if (typeof saved.enabled === 'boolean') enabled = saved.enabled;
      if (Number.isFinite(saved.threshold) && saved.threshold >= 0 && saved.threshold <= 100) threshold = saved.threshold;
    } catch (_) {}
    const css = document.createElement('style');
    css.textContent = '.whale-hungry{position:absolute;right:29%;bottom:0;width:23%;height:20%;object-fit:contain;display:none;pointer-events:none;z-index:0;transform-origin:50% 90%}.whale-hungry.whale-hungry-visible{display:block}.whale-hungry.whale-begging{animation:whale-beg 1.1s ease-in-out 1}@keyframes whale-beg{0%,100%{transform:translateY(0) rotate(0)}25%{transform:translateY(-8%) rotate(-5deg)}55%{transform:translateY(0) rotate(5deg)}75%{transform:translateY(-4%) rotate(-2deg)}}@media (prefers-reduced-motion:reduce){.whale-hungry.whale-begging{animation:none}}';
    document.head.appendChild(css);
    const overlay = document.createElement('img');
    overlay.className = 'whale-hungry'; overlay.src = '/assets/whale-bowl.png'; overlay.alt = ''; overlay.draggable = false;
    overlay.addEventListener('error', () => { imageAvailable = false; render(false); });
    body.insertBefore(overlay, original.nextSibling);
    const row = document.createElement('label'); row.className = 'dshwv-menu-row';
    const toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.checked = enabled;
    const text = document.createElement('span'); text.textContent = '低额度饥饿形象';
    const limit = document.createElement('input'); limit.type = 'number'; limit.min = '0'; limit.max = '100'; limit.step = '1'; limit.value = threshold; limit.className = 'dshwv-number'; limit.title = '订阅剩余额度阈值（%）';
    const suffix = document.createElement('span'); suffix.textContent = '%';
    row.title = '订阅按剩余百分比触发；API 使用已启用的余额预警阈值。';
    row.append(toggle, text, limit, suffix); menu.appendChild(row);
    function render(next) { low = enabled && imageAvailable && !!next; overlay.classList.toggle('whale-hungry-visible', low); if (!low) overlay.classList.remove('whale-begging'); window.WhaleRendering?.presentFor(200); }
    function save() { try { localStorage.setItem('whale-hunger-settings', JSON.stringify({enabled, threshold})); } catch (_) {} }
    async function refresh() {
      const own = ++generation;
      if (!enabled) { render(false); return; }
      if (window.WhaleAccountView?.mode !== 'subscription') { render(apiLow(latestBalance, alertSettings())); return; }
      try {
        const response = await fetch('/api/insights', {cache:'no-store'});
        if (!response.ok) throw new Error('unavailable');
        const data = await response.json();
        if (own === generation && window.WhaleAccountView?.mode === 'subscription') render(subscriptionLow(data, threshold));
      } catch (_) { if (own === generation) render(false); }
    }
    toggle.addEventListener('change', () => { enabled = toggle.checked; save(); refresh(); });
    limit.addEventListener('change', () => { const value = Number(limit.value); if (limit.value !== '' && Number.isFinite(value) && value >= 0 && value <= 100) threshold = value; limit.value = threshold; save(); refresh(); });
    window.addEventListener('whale-balance', event => { latestBalance = event.detail; if (window.WhaleAccountView?.mode !== 'subscription') refresh(); });
    window.addEventListener('whale-account-view', () => { render(false); refresh(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
    setInterval(() => { if (!document.hidden) refresh(); }, 60000);
    refresh();
    return { get active() { return low; }, click() { if (!low) return; overlay.classList.remove('whale-begging'); void overlay.offsetWidth; overlay.classList.add('whale-begging'); window.WhaleRendering?.presentFor(1200); } };
  }
  return {subscriptionLow, apiLow, create};
});
