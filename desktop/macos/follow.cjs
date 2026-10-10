// Spaces are a compositor transform, not a window move. Bind the companion to
// the host's Spaces, keep it ordered in while the host is on another Space, and
// use fresh model bounds only while the compositor is settled.
function createMacFollower({ window, native, getMode, applyHost, getHost, onError = () => {}, now = Date.now }) {
  let latest = null, attached = null, lastAt = 0, lastBounds = '', lastError = '';
  let disposed = false, inTick = false;
  const status = { mode: 'macos-space-bound', bound: false, animating: false, reason: null, spaces: [] };
  const identity = host => String(host?.hostPid || '') + ':' + String(host?.window || '');
  function failed(reason) {
    status.bound = false; status.animating = false; status.reason = reason; status.spaces = [];
    delete status.hostWindow; delete status.overlayWindow;
    if (reason !== lastError) { lastError = reason; onError(reason); }
    attached = null; lastBounds = '';
    applyHost({ ...(latest || {}), visible: false, attached: false, nativeFollowing: false, followMode: status.mode });
  }
  function tick() {
    if (disposed || inTick || getMode() !== 'follow-codex' || !latest || window.isDestroyed()) return;
    inTick = true;
    try {
      if (now() - lastAt > 2500) { failed('host-heartbeat-stale'); return; }
      if (!latest.hostAlive) { failed('host-unavailable'); return; }
      if (!native) { failed('native-module-unavailable'); return; }
      // The probe also keeps valid window identities from inactive Spaces.
      // The native side checks animation state before changing membership.
      const target = latest.window !== '0' ? latest : attached || latest;
      const hostWindow = Number(target.window), hostPid = Number(target.hostPid);
      if (!Number.isSafeInteger(hostWindow) || hostWindow <= 0 || hostWindow > 0xffffffff
          || !Number.isSafeInteger(hostPid) || hostPid <= 0 || hostPid > 0x7fffffff) {
        failed('host-window-unavailable'); return;
      }
      const sample = JSON.parse(native.sync(window.getNativeWindowHandle(), hostWindow, hostPid));
      status.native = sample;
      if (!sample.ok) { failed(sample.reason || 'space-binding-failed'); return; }
      status.animating = !!sample.animating;
      if (sample.animating) return;
      if (!sample.bound) { failed('space-bind-unverified'); return; }
      const bounds = sample.bounds;
      if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key]))
          || bounds.width <= 10 || bounds.height <= 10) { failed('invalid-host-bounds'); return; }
      // macOS model bounds are already points. Do not use the Windows DPI path.
      const rect = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Math.round(value)]));
      const key = JSON.stringify(rect);
      if (identity(attached) !== identity(target) && window.isVisible()) window.hide();
      if (key !== lastBounds) { window.setBounds(rect, false); lastBounds = key; }
      attached = { ...target, hostAlive: true, visible: !!sample.visible, attached: true,
        nativeFollowing: false, followMode: status.mode, bounds: rect };
      status.bound = true; status.reason = null; status.spaces = sample.spaces || [];
      status.hostWindow = sample.hostWindow; status.overlayWindow = sample.overlayWindow;
      lastError = '';
      // Ignore the probe's on-screen flag. Membership itself prevents painting
      // on another Space; hiding here would make the return animation pop in.
      applyHost(attached);
    } catch { failed('native-space-sync-failed'); }
    finally { inTick = false; }
  }
  function observe(host) { latest = host; lastAt = now(); tick(); }
  function reset() {
    attached = null; lastBounds = ''; status.bound = false; status.animating = false; status.spaces = []; status.reason = null;
    delete status.hostWindow; delete status.overlayWindow;
    // A fresh probe update will select the current window after a mode switch.
    latest = getHost(); lastAt = now();
  }
  return { observe, tick, reset, snapshot: () => ({ ...status }), dispose() { disposed = true; attached = null; } };
}
module.exports = { createMacFollower };
