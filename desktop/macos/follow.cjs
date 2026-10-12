// Spaces are a compositor transform, not a window move. Bind the companion to
// the host's Spaces, keep it ordered in while the host is on another Space, and
// use fresh model bounds only while the compositor is settled.
function companionBounds(bounds) {
  // macOS 27 / Electron 44 can omit the host from a Space thumbnail when this
  // transparent window has exactly the host's frame. Real A/B testing isolated
  // the frame, not alpha, zoom, level or recurring ordering (see the thumbnail
  // investigation). Reserve the smallest integer-point strip at the right
  // edge. Keep the origin, height and renderer scale; never accumulate insets
  // from the companion's previous bounds or use Mission Control transforms.
  return { x: Math.round(bounds.x), y: Math.round(bounds.y),
    width: Math.max(1, Math.round(bounds.width) - 1), height: Math.round(bounds.height) };
}

function createMacFollower({ window, native, getMode, applyHost, getHost, isVisible = () => window.isVisible(), getOverlayBounds = companionBounds, onError = () => {}, now = Date.now }) {
  let latest = null, attached = null, lastAt = 0, lastBounds = '', lastError = '';
  let uncertainSince = null, lastOrderingError = '';
  let foregroundLevel = null;
  let disposed = false, inTick = false;
  const status = { mode: 'macos-space-bound', bound: false, animating: false, reason: null, spaces: [] };
  const identity = host => String(host?.hostPid || '') + ':' + String(host?.window || '');
  function failed(reason) {
    status.bound = false; status.animating = false; status.reason = reason; status.spaces = [];
    delete status.transientReason; delete status.orderingError;
    delete status.hostWindow; delete status.overlayWindow;
    delete status.hostBounds; delete status.overlayBounds;
    if (reason !== lastError) { lastError = reason; onError(reason); }
    attached = null; lastBounds = ''; uncertainSince = null; lastOrderingError = '';
    applyHost({ ...(latest || {}), visible: false, attached: false, nativeFollowing: false, followMode: status.mode });
  }
  function deferHostReadFailure(reason, target) {
    // A single failed WindowServer state read does not revoke a binding that
    // was just verified for this exact host. Keep the existing window and its
    // input surface through a short gap; a persistent failure still hides it.
    if (reason !== 'host-state-unavailable' || !status.bound || !attached || identity(attached) !== identity(target)) return false;
    const time = now();
    if (uncertainSince === null) uncertainSince = time;
    if (time - uncertainSince >= 250) return false;
    if (status.transientReason !== reason) onError('transient-' + reason);
    status.transientReason = reason;
    return true;
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
      if (!sample.ok) {
        const reason = sample.reason || 'space-binding-failed';
        if (deferHostReadFailure(reason, target)) return;
        failed(reason); return;
      }
      status.animating = !!sample.animating;
      if (sample.animating) return;
      if (!sample.bound) { failed('space-bind-unverified'); return; }
      const bounds = sample.bounds;
      if (!bounds || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(bounds[key]))
          || bounds.width <= 10 || bounds.height <= 10) { failed('invalid-host-bounds'); return; }
      // macOS model bounds are already points. Do not use the Windows DPI path.
      const hostRect = Object.fromEntries(Object.entries(bounds).map(([key, value]) => [key, Math.round(value)]));
      const rect = getOverlayBounds(hostRect, target);
      if (!rect || !['x', 'y', 'width', 'height'].every(key => Number.isSafeInteger(rect[key]))
          || rect.width <= 0 || rect.height <= 0) { failed('invalid-overlay-bounds'); return; }
      const key = JSON.stringify(rect);
      if (identity(attached) !== identity(target) && isVisible()) window.hide();
      if (key !== lastBounds) { window.setBounds(rect, false); lastBounds = key; }
      attached = { ...target, hostAlive: true, visible: !!sample.visible, attached: true,
        nativeFollowing: false, followMode: status.mode, bounds: hostRect };
      status.bound = true; status.reason = null; status.spaces = sample.spaces || [];
      status.hostWindow = sample.hostWindow; status.overlayWindow = sample.overlayWindow;
      status.hostBounds = hostRect; status.overlayBounds = rect;
      lastError = ''; uncertainSince = null; delete status.transientReason;
      // Ignore the probe's on-screen flag. Membership itself prevents painting
      // on another Space; hiding here would make the return animation pop in.
      applyHost(attached);
      // A normal-level Codex window can cover its companion for one frame on
      // every activation, before moveAbove repairs the order. Hold one extra
      // level while this exact host is foreground, including widget editing.
      // Restore normal ordering when another app/window comes forward. Do not
      // change levels during Space animations or without a verified binding.
      let lowered = false;
      if (typeof sample.hostForeground === 'boolean') {
        const raised = attached.visible && isVisible() && sample.hostForeground;
        if (foregroundLevel !== raised) {
          lowered = foregroundLevel === true && !raised;
          window.setAlwaysOnTop(raised, 'normal', raised ? 1 : 0);
          foregroundLevel = raised;
        }
        status.foregroundLevel = raised;
      }
      // showInactive/focus and host activation can reorder normal-level
      // windows. Stay immediately above the verified host, below windows
      // covering it. Never order a hidden companion in or disturb a Space swipe.
      // A settled native order is a no-op. In particular, do not repeatedly
      // reorder an inactive window after a settings-card blur or Space return.
      // Missing ordering is supported for older native modules until reinstall.
      if (!foregroundLevel && attached.visible && isVisible() &&
          (sample.ordering == null || sample.ordering === 'misplaced' || lowered && sample.ordering === 'above')) {
        try {
          window.moveAbove(`window:${hostWindow}:0`);
          lastOrderingError = ''; delete status.orderingError;
        } catch {
          // Ordering is separate from the verified Space membership. Retry on
          // the next tick without hiding a healthy, clickable companion.
          status.orderingError = 'relative-order-failed';
          if (lastOrderingError !== status.orderingError) onError(status.orderingError);
          lastOrderingError = status.orderingError;
        }
      }
    } catch { failed('native-space-sync-failed'); }
    finally { inTick = false; }
  }
  function observe(host) { latest = host; lastAt = now(); tick(); }
  function reset() {
    foregroundLevel = null; delete status.foregroundLevel;
    attached = null; lastBounds = ''; status.bound = false; status.animating = false; status.spaces = []; status.reason = null;
    uncertainSince = null; lastOrderingError = ''; lastError = '';
    delete status.transientReason; delete status.orderingError;
    delete status.hostWindow; delete status.overlayWindow;
    delete status.hostBounds; delete status.overlayBounds;
    // A fresh probe update will select the current window after a mode switch.
    latest = getHost(); lastAt = now();
  }
  return { observe, tick, reset, snapshot: () => ({ ...status }), dispose() { disposed = true; attached = null; } };
}
module.exports = { createMacFollower, companionBounds };
