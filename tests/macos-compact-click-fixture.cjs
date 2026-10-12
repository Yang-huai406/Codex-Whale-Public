// Isolated Electron regression: real renderer input and real native bounds,
// with a synthetic host so no Codex window or personal settings are touched.
const { app, BrowserWindow, ipcMain, protocol, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { createMacFollower } = require('../desktop/macos/follow.cjs');
const { compactBounds, validLayout } = require('../desktop/macos/compact-window.cjs');
const root = path.resolve(__dirname, '..');
const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9);
if (!output || !path.isAbsolute(output)) app.exit(1);
const dataDir = path.join(output, 'fixture-data');
fs.mkdirSync(dataDir, { recursive: true });
app.setPath('userData', path.join(dataDir, 'profile'));
protocol.registerSchemesAsPrivileged([{ scheme: 'whale', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
let window, dispatcher, timer;
const report = { ok: false, clicks: [], boundsChanges: [], errors: [] };
app.whenReady().then(async () => {
  assert.equal(process.platform, 'darwin');
  app.dock?.hide();
  const { createDispatcher, UI_ORIGIN } = await import(pathToFileURL(path.join(root, 'runtime/dispatcher.mjs')));
  const { makeFixture } = await import(pathToFileURL(path.join(root, 'tests/desktop-fixture.mjs')));
  dispatcher = createDispatcher({ dataDir, ...await makeFixture(dataDir) });
  protocol.handle('whale', async request => {
    const u = new URL(request.url);
    const result = await dispatcher.dispatch(u.pathname + u.search, { method: request.method,
      body: ['GET', 'HEAD'].includes(request.method) ? null : Buffer.from(await request.arrayBuffer()) });
    return new Response(request.method === 'HEAD' ? null : result.body, { status: result.status, headers: result.headers });
  });
  const area = screen.getPrimaryDisplay().workArea;
  const hostBounds = { x: area.x + 30, y: area.y + 30, width: Math.min(1000, area.width - 60), height: Math.min(700, area.height - 60) };
  const host = { hostAlive: true, hostPid: 42, window: '123', visible: true, attached: true };
  const hostKey = '42:123';
  let ready = false, stable = false, layout = null, serial = 0, encoded = '';
  const saved = { 'dshw-pos': JSON.stringify({ v: 2, hAnchor: 'right', hDist: 12, vAnchor: 'bottom', vDist: 12 }) };
  ipcMain.on('whale-storage', event => { event.returnValue = saved; });
  ipcMain.on('whale-save-storage', (_event, values) => Object.assign(saved, values));
  ipcMain.on('whale-user-gesture', () => {});
  ipcMain.on('whale-shape', () => {});
  ipcMain.on('whale-keyboard-focus', () => {});
  ipcMain.on('whale-interactive', () => {});
  ipcMain.handle('whale-command', () => 'follow-codex');
  ipcMain.handle('whale-open-external', () => false);
  window = new BrowserWindow({ ...compactBounds(hostBounds, null), transparent: true, frame: false,
    resizable: false, show: false, hasShadow: false, acceptFirstMouse: true,
    webPreferences: { preload: path.join(root, 'desktop/preload.cjs'), contextIsolation: true,
      nodeIntegration: false, sandbox: true, backgroundThrottling: false, additionalArguments: ['--whale-render-test'] } });
  // Synthetic sendInputEvent exercises the production handlers. Physical mouse
  // input remains ignored so the user's cursor cannot alter this fixture.
  window.setIgnoreMouseEvents(true, { forward: false });
  window.webContents.on('console-message', (_event, ...args) => {
    const d = args[0];
    if (typeof d === 'object' ? d.level === 'error' : d === 3) report.errors.push(typeof d === 'object' ? d.message : args[1]);
  });
  const sendGeometry = force => {
    if (!ready) return;
    const overlay = follower.snapshot().overlayBounds;
    const next = JSON.stringify(overlay);
    if (!force && next === encoded) return;
    encoded = next;
    window.webContents.send('whale-host-geometry', { host: hostBounds, overlay, hostKey, serial: ++serial });
  };
  const follower = createMacFollower({ window: {
    isDestroyed: () => window.isDestroyed(), isVisible: () => window.isVisible(),
    getNativeWindowHandle: () => window.getNativeWindowHandle(), hide: () => window.hide(), moveAbove() {},
    setBounds(bounds) { report.boundsChanges.push({ ...bounds, dragging: layout?.dragging }); window.setBounds(bounds, false); },
  }, native: { sync: () => JSON.stringify({ ok: true, bound: true, visible: true, bounds: hostBounds, spaces: ['fixture'], hostWindow: 123 }) },
  getMode: () => 'follow-codex', getHost: () => host,
  getOverlayBounds: bounds => compactBounds(bounds, layout), applyHost: () => sendGeometry(false) });
  follower.observe(host);
  timer = setInterval(() => follower.observe(host), 16);
  ipcMain.on('whale-ready', () => { ready = true; window.webContents.send('whale-desktop-mode', 'follow-codex'); sendGeometry(true); });
  ipcMain.on('whale-compact-layout', (_event, next) => {
    if (!validLayout(next) || next.serial !== serial || next.hostKey !== hostKey) return;
    const before = serial; layout = next; follower.tick();
    if (serial === before) { stable = true; if (!window.isVisible()) window.show(); }
  });
  await window.loadURL(UI_ORIGIN + '/widget.html');
  const ev = code => window.webContents.executeJavaScript(code);
  const wait = async (code, label) => {
    for (let i = 0; i < 80; i++) { if (await ev(code)) return; await delay(50); }
    throw new Error('Timed out: ' + label);
  };
  for (let i = 0; i < 80 && !stable; i++) await delay(50);
  assert.equal(stable, true, 'compact renderer must complete startup');
  await wait('window.__whaleRenderTest?.status().hitCache.decodes > 0', 'alpha cache');
  window.focus(); await wait('document.hasFocus()', 'fixture focus'); await delay(250);
  // sendInputEvent presses Chromium's pointer without pressing the OS button.
  // macOS can therefore release native capture using the physical cursor's
  // unrelated button state. Keep capture synthetic for this geometry fixture.
  await ev(`(() => { const root=document.querySelector('.dshwv-root'); const held=new Set();
    root.setPointerCapture=id=>held.add(id);root.hasPointerCapture=id=>held.has(id);root.releasePointerCapture=id=>held.delete(id); })()`);
  await ev(`window.__clickTrace=[]; for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'])
    document.addEventListener(type,e=>{ if(type==='pointermove'&&!document.querySelector('.dshwv-root').classList.contains('dshwv-dragging'))return;
      __clickTrace.push({type,x:e.clientX,y:e.clientY,screenX:e.screenX,screenY:e.screenY,buttons:e.buttons,trusted:e.isTrusted}); },true);`);
  const hitPoint = () => ev(`(() => { const img=document.querySelector('.dshwv-img'),root=document.querySelector('.dshwv-root'),r=img.getBoundingClientRect();
    let best=null,distance=Infinity;for(let y=Math.ceil(r.top);y<r.bottom;y+=2)for(let x=Math.ceil(r.left);x<r.right;x+=2)
    if(WhaleRendering.petInteraction.hit(img,root,x,y)){const d=(x-(r.left+r.right)/2)**2+(y-(r.top+r.bottom)/2)**2;if(d<distance){distance=d;best={x,y};}}
    if(!best)throw Error('no opaque whale point');return best; })()`);
  const mouse = (type, p, modifiers = []) => window.webContents.sendInputEvent({ type, x: Math.round(p.x), y: Math.round(p.y), button: 'left', clickCount: 1, modifiers });
  const baseline = window.getBounds(); report.boundsChanges.length = 0;
  const holds = [35, 90, 180];
  // The whale image animates, so a point sampled before the press can fall on
  // a transparent frame by the time the button goes down. Sample, then retry
  // that one click instead of asserting against a press the pet never saw.
  const clickOnce = async holdMs => {
    await ev('__whaleRenderTest.close()'); await delay(180);
    await ev('window.__clickTrace = []');
    const p = await hitPoint(); mouse('mouseMove', p); await delay(20); mouse('mouseDown', p);
    await delay(holdMs);
    const press = await ev(`(() => { const root=document.querySelector('.dshwv-root'), img=document.querySelector('.dshwv-img');
      const ir=img.getBoundingClientRect();
      return { pressed: root.classList.contains('dshwv-dragging'), moved: root.classList.contains('dshwv-drag-moved'),
        cls: root.className, iw: innerWidth, imgRect: [Math.round(ir.left),Math.round(ir.top),Math.round(ir.width),Math.round(ir.height)] }; })()`);
    const duringPress = window.getBounds();
    mouse('mouseUp', p); await delay(180);
    const after = window.getBounds(), pointerTrace = await ev('__clickTrace');
    // This fixture window is small but real, so a physical cursor resting over
    // it can inject its own press/release pair. Only synthetic input belongs to
    // this test: a sample with extra presses is environment noise, not a
    // product defect, so drop it instead of asserting against a second pointer.
    const downs = pointerTrace.filter(entry => entry.type === 'pointerdown').length;
    const ups = pointerTrace.filter(entry => entry.type === 'pointerup' || entry.type === 'pointercancel').length;
    return { press, duringPress, after, pointerTrace, noise: downs !== 1 || ups !== 1 };
  };
  let effective = 0, dropped = 0, missed = 0;
  for (let i = 0; i < 12; i++) {
    const holdMs = holds[i % 3];
    let sample = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      sample = await clickOnce(holdMs);
      if (sample.press.pressed || sample.noise) break;
      missed++;
    }
    report.pointerTrace = sample.pointerTrace;
    report.clicks.push({ holdMs, bounds: sample.after, duringPress: sample.duringPress, noise: sample.noise, ...sample.press });
    if (sample.noise || !sample.press.pressed) {
      dropped++;
      report.boundsChanges.length = 0;
      continue;
    }
    assert.equal(sample.press.moved, false, 'a click must not request the expanded drag surface');
    assert.deepEqual(sample.duringPress, baseline, 'press must not reframe the native window');
    assert.deepEqual(sample.after, baseline, 'release must retain native coordinates');
    effective++;
  }
  report.effectiveClicks = effective; report.droppedClicks = dropped; report.missedPresses = missed;
  assert.ok(effective >= 8, 'too few clicks landed on the pet: ' + effective + '/' + (effective + dropped) + ', missed ' + missed);
  assert.equal(report.boundsChanges.length, 0, 'no old frame may be relocated on clicks');
  report.clickBoundsChanges = report.boundsChanges.length;
  // Keep actual dragging and shrinking covered after delaying expansion.
  await ev('__whaleRenderTest.close()'); await delay(250);
  const p = await hitPoint(), before = window.getBounds();
  mouse('mouseMove', p); mouse('mouseDown', p); await delay(40);
  await ev(`(() => { window.__dragTrace=[]; const el=document.querySelector('.dshwv-position');
    const snap=(kind)=>{ const r=el.getBoundingClientRect(), g=window.whaleCompact.current();
      __dragTrace.push({ kind, t: Math.round(performance.now()*10)/10, left: Math.round(r.left*100)/100, top: Math.round(r.top*100)/100,
        iw: innerWidth, ih: innerHeight, ox: g&&g.overlay.x, oy: g&&g.overlay.y, hx: g&&g.host.x, hy: g&&g.host.y,
        moved: document.querySelector('.dshwv-root').classList.contains('dshwv-drag-moved') }); };
    new MutationObserver(()=>snap('paint')).observe(el, { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', ()=>snap('resize'));
    window.addEventListener('whale-compact-geometry', ()=>snap('geometry'));
    snap('start'); })()`);
  mouse('mouseMove', { x: p.x - 40, y: p.y - 25 }, ['leftButtonDown']); await delay(120);
  assert.equal(layout.dragging, true); assert.deepEqual(window.getBounds(), hostBounds);
  report.dragTrace = await ev('__dragTrace');
  // Swapping the native window between the compact frame and the whole host
  // must not move the painted pet. Geometry arrives right after setBounds, so
  // host coordinates have to stay put across every viewport change.
  let swaps = 0;
  for (let i = 1; i < report.dragTrace.length; i++) {
    const prev = report.dragTrace[i - 1], entry = report.dragTrace[i];
    if (entry.iw === prev.iw) continue;
    swaps++;
    const shift = (a, b) => [a.left + (a.ox ?? 0) - (a.hx ?? 0) - (b.left + (b.ox ?? 0) - (b.hx ?? 0)),
      a.top + (a.oy ?? 0) - (a.hy ?? 0) - (b.top + (b.oy ?? 0) - (b.hy ?? 0))];
    const moved = shift(entry, prev);
    assert.ok(Math.abs(moved[0]) <= 2 && Math.abs(moved[1]) <= 2, 'expanding the native window must not relocate the pet ' + JSON.stringify({ prev, entry }));
  }
  assert.ok(swaps >= 1, 'the drag must exercise the native window swap');
  report.dragSwaps = swaps;
  const expanded = window.getBounds();
  mouse('mouseUp', { x: before.x + p.x - 40 - expanded.x, y: before.y + p.y - 25 - expanded.y });
  await delay(400); assert.equal(layout.dragging, false);
  report.shrinkTrace = await ev('__dragTrace');
  assert.equal(window.getBounds().width, baseline.width); assert.equal(window.getBounds().height, baseline.height);
  report.drag = { expanded: hostBounds, released: window.getBounds() };
  assert.equal(report.errors.length, 0, JSON.stringify(report.errors));
  report.ok = true;
}).catch(error => { report.error = error.stack; }).finally(async () => {
  clearInterval(timer);
  window?.destroy(); await dispatcher?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'compact-click.json'), JSON.stringify(report, null, 2));
  app.exit(report.ok ? 0 : 1);
});
