// A renderer-ready flag is not proof that the native clipping region exists.
// Ordinary animation updates retain the last verified surface; only an ACK for
// the current instance, viewport and shape can restore a revoked surface.
function createSurfaceGuard({ instance, revoke, retry, restored = () => {}, stable = () => {}, changed = () => {}, now = Date.now, maxAttempts = 3, requireHeartbeat = false }) {
  let epoch = 1, sequence = 0, current = null, verified = false, attempts = 0;
  let lastFailure = null, recoveryAt = 0, waitingSince = null, revocations = 0, disposed = false;
  let heartbeat = 0;
  let healthySince = null;
  function fail(reason) {
    if (disposed) return;
    // Revoke the proof itself, not only the visible flag: a delayed success for
    // the pre-failure shape must not reopen the HWND before a fresh reapply.
    epoch++; current = null; verified = false; healthySince = null; waitingSince = null; lastFailure = reason; revoke(reason);
    if (!recoveryAt && attempts < maxAttempts) recoveryAt = now() + 250 * (++attempts);
    changed();
  }
  return {
    next(rects, viewport, handle, { retainProof = true } = {}) {
      if (disposed) return null;
      if (!retainProof) { verified = false; healthySince = null; }
      current = { instance, epoch, sequence: ++sequence, handle: String(handle), width: viewport.width, height: viewport.height, rects };
      if (!verified && waitingSince === null) waitingSince = now();
      return current;
    },
    canApply: () => !disposed && (verified || current === null),
    observeHeartbeat(at) { if (Number.isSafeInteger(at) && at > heartbeat && at <= now() + 1000) heartbeat = at; },
    reset(reason = 'viewport-changed') {
      if (disposed) return;
      epoch++; current = null; verified = false; healthySince = null; recoveryAt = 0; waitingSince = null; revoke(reason); changed();
    },
    fail,
    accept(report) {
      if (disposed || !current || !report || report.instance !== instance || String(report.handle) !== current.handle) return false;
      const exact = report.epoch === epoch && report.sequence === sequence && report.width === current.width && report.height === current.height;
      const nativeRevoked = Number.isSafeInteger(report.revocations) && report.revocations > revocations;
      if (nativeRevoked && Number.isSafeInteger(report.epoch) && report.epoch > 0 && report.epoch <= epoch) {
        revocations = report.revocations;
        // A native hide is an irreversible observed event, even if animation
        // advanced the shape meanwhile. It can revoke, never grant readiness.
        if (!exact) { fail('native-surface-revoked'); return false; }
        verified = false; revoke('native-surface-revoked');
      }
      // Success always requires the exact current viewport and shape.
      if (!exact) return false;
      if (report.ok !== true) { fail(String(report.reason || 'native-region-mismatch')); return false; }
      const resumed = !verified;
      verified = true; recoveryAt = 0; waitingSince = null; lastFailure = null;
      if (resumed) healthySince = now();
      changed(); if (resumed) restored(); return true;
    },
    tick() {
      if (!disposed && verified && requireHeartbeat && now() - heartbeat > 3000) fail('native-monitor-timeout');
      if (!disposed && verified && healthySince !== null && now() - healthySince >= 30000) { attempts = 0; healthySince = null; stable(); }
      if (!disposed && current && !verified && !recoveryAt && waitingSince !== null && now() - waitingSince >= 2000) fail('native-verification-timeout');
      if (disposed || !recoveryAt || now() < recoveryAt) return;
      recoveryAt = 0; retry();
    },
    manualRecovery() { attempts = 0; recoveryAt = 0; fail('manual-surface-recovery'); },
    ready: () => !disposed && verified,
    snapshot: () => ({ epoch, sequence, verified, attempts, revocations, failure: lastFailure, pendingRecovery: !!recoveryAt }),
    dispose() { disposed = true; recoveryAt = 0; verified = false; },
  };
}
module.exports = { createSurfaceGuard };
