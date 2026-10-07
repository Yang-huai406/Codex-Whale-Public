export function runtimeReady(status, { version, revision, nativeGuard }) {
  return status?.ok === true && status.version === version && status.buildVersion === version &&
    status.buildRevision === revision && status.rendererReady === true &&
    (!nativeGuard || status.surfaceGuard?.verified === true);
}
