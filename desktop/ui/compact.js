(() => {
  'use strict';
  const bridge = window.whaleDesktop;
  if (bridge?.platform !== 'darwin' || !bridge.onHostGeometry || !bridge.compactLayout) return;
  let geometry = null, pending = 0, previous = '';
  const offset = () => geometry ? {
    x: geometry.overlay.x - geometry.host.x,
    y: geometry.overlay.y - geometry.host.y,
  } : { x: 0, y: 0 };
  const visible = el => !!el?.isConnected && !el.hidden && el.checkVisibility({ opacityProperty: true, visibilityProperty: true });
  function publish() {
    pending = 0;
    if (!geometry) return;
    const root = document.querySelector('.dshwv-root');
    if (!root || !visible(root)) return;
    const rect = root.getBoundingClientRect(), shift = offset();
    const layout = {
      serial: geometry.serial,
      hostKey: geometry.hostKey,
      root: { x: rect.left + shift.x, y: rect.top + shift.y, width: rect.width, height: rect.height },
      expanded: [...document.querySelectorAll('.whale-account-card,.dshwv-menu-open,dialog[open],.dshwv-qedit,.dshwv-usagepanel,.dshwv-rolelist-open,.dshwv-audiolist-open,.dshwv-custmenu,.dshwv-tplhelp,.dshwv-fx-info,#toast:not([hidden]),[class*="mask"]')].some(visible),
      // A press is also the start of a click. Expanding on pointerdown moves the
      // old small-window frame to the host origin before its coordinates update.
      dragging: !!document.querySelector('.dshwv-root.dshwv-drag-moved'),
    };
    const encoded = JSON.stringify(layout);
    if (encoded !== previous) { previous = encoded; bridge.compactLayout(layout); }
  }
  function request() { if (!pending) pending = requestAnimationFrame(publish); }
  function receive(next) {
    geometry = next?.host && next?.overlay ? next : null;
    previous = '';
    document.documentElement.classList.toggle('whale-compact', !!geometry);
    if (geometry) {
      document.documentElement.style.setProperty('--whale-host-width', geometry.host.width + 'px');
      document.documentElement.style.setProperty('--whale-host-height', geometry.host.height + 'px');
    }
    window.dispatchEvent(new Event('whale-compact-geometry'));
    request();
  }
  window.whaleCompact = Object.freeze({
    hostViewport: () => geometry ? { w: geometry.host.width, h: geometry.host.height } : null,
    localPoint: (x, y) => { const shift = offset(); return { x: x - shift.x, y: y - shift.y }; },
    hostPoint: (x, y) => { const shift = offset(); return { x: x + shift.x, y: y + shift.y }; },
    current: () => geometry,
    request,
  });
  bridge.onHostGeometry(receive);
  new MutationObserver(request).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'open', 'hidden'] });
  const resize = new ResizeObserver(request);
  let observedRoot = null;
  function observeRoot() {
    const root = document.querySelector('.dshwv-root');
    if (root && root !== observedRoot) {
      if (observedRoot) resize.unobserve(observedRoot);
      resize.observe(root); observedRoot = root;
    }
  }
  observeRoot();
  new MutationObserver(observeRoot).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('resize', request);
  window.addEventListener('whale-interaction-geometry', request);
})();
