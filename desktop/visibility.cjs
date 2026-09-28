// Windows can hide/remap an owned HWND without changing Chromium's cached
// visibility. Recover only for explicit show requests or lifecycle boundaries,
// never on a normal heartbeat or move. Injected timers make cancellation testable.
function createVisibilityController({ getWindow, getState, onShown = () => {}, schedule = setTimeout, cancel = clearTimeout, delayMs = 40 }) {
  let pending = null, generation = 0, disposed = false, desired = null;
  let shown = false, recover = false, hostKey = null, revision = null, remaps = 0;
  const wants = state => !state.quitting && state.ready && state.host?.hostAlive !== false && state.host?.visible &&
    (state.fixture || state.host?.attached) && !state.host?.modal && !state.manuallyHidden;
  const key = state => String(state.host?.hostPid ?? '') + ':' + String(state.host?.window ?? '');
  const epoch = state => Number.isSafeInteger(state.host?.visibilityRevision) ? state.host.visibilityRevision : null;
  function clear() { generation++; if (pending !== null) cancel(pending); pending = null; }
  function update() {
    if (disposed) return;
    const window = getWindow(), state = getState();
    if (!window || window.isDestroyed()) { clear(); return; }
    const next = !!wants(state), nextKey = key(state), nextRevision = epoch(state);
    const changed = (hostKey !== null && hostKey !== nextKey) ||
      (revision !== null && nextRevision !== null && revision !== nextRevision);
    hostKey = nextKey; revision = nextRevision;
    if (changed && shown) { recover = true; clear(); }
    if (!next) {
      clear();
      if (desired !== false || window.isVisible()) window.hide();
      if (shown) recover = true;
      desired = false;
      return;
    }
    if (desired === false && shown) recover = true;
    desired = true;
    if (pending !== null) return;
    if (shown && !window.isVisible()) recover = true;
    if (recover) {
      window.hide();
      const ticket = ++generation, targetKey = hostKey, targetRevision = revision;
      pending = schedule(() => {
        if (disposed || ticket !== generation) return;
        pending = null;
        if (window !== getWindow() || window.isDestroyed()) return;
        const current = getState();
        if (!wants(current) || key(current) !== targetKey || epoch(current) !== targetRevision) { update(); return; }
        // Clear before show: its synchronous show event can request an update.
        recover = false; shown = true; remaps++;
        window.showInactive(); onShown();
      }, delayMs);
    } else if (!shown || !window.isVisible()) {
      shown = true; window.showInactive(); onShown();
    }
  }
  function requestRecovery() {
    if (disposed) return;
    // isVisible() may still be true while the owned HWND has lost its surface.
    // Coalesce requests while settling; update still enforces every hide guard.
    recover = true;
    update();
  }
  return { update, requestRecovery, dispose() { disposed = true; clear(); }, snapshot: () => ({ desired, pending: pending !== null, remaps }) };
}
module.exports = { createVisibilityController };
