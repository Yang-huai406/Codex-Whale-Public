import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function verifyDesktop({ app, window, screen, setHost, setTestCursor, dataDir, openedLinks, errors, renderInfo }) {
  const output = path.resolve(process.env.WHALE_DESKTOP_VERIFY_DIR);
  fs.mkdirSync(output, { recursive: true });
  const checks = [], ev = code => window.webContents.executeJavaScript(code);
  const wait = async (code, message, timeout = 8000) => {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) { if (await ev(code)) return; await delay(50); }
    throw new Error('Timed out: ' + message);
  };
  try {
    const area = screen.getPrimaryDisplay().workArea;
    const dip = { x: area.x + 24, y: area.y + 24, width: 700, height: 550 };
    await setHost({ hostAlive: true, hostPid: 123456, window: '0', visible: true, attached: true, bounds: screen.dipToScreenRect(null, dip) });
    await wait("document.querySelector('.dshwv-img')?.naturalWidth > 0 && localStorage.getItem('dshw-role') === 'default'", 'bad saved image falls back to the built-in role');
    await wait("window.__whaleRenderTest.status().balance === 12.3456 && !window.__whaleRenderTest.status().busy", 'startup size settings and initial data complete');
    assert.equal(window.isVisible(), true);
    checks.push('a missing saved image with retained metadata recovers a visible clickable default role on first launch');
    await ev('window.__whaleRenderTest.place(140, 140, false)'); await delay(450);
    const viewport = await ev("(() => {const r=document.querySelector('.dshwv-img').getBoundingClientRect(),p=document.querySelector('.dshwv-position'),root=document.querySelector('.dshwv-root');return {width:innerWidth,height:innerHeight,position:p.getBoundingClientRect().toJSON(),positionStyle:p.style.cssText,root:root.getBoundingClientRect().toJSON(),pet:{left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};})()");
    assert.ok(viewport.pet.width > 0 && viewport.pet.height > 0 && viewport.pet.left >= 0 && viewport.pet.top >= 0 && viewport.pet.right <= viewport.width && viewport.pet.bottom <= viewport.height, 'the complete role rectangle must be inside the fixture viewport: ' + JSON.stringify(viewport));
    const mask = await ev("WhaleRendering.hitCache.prepare('/dsh-whale/role-image.png?id=role_audit_apng').then(mask=>({width:mask.width,height:mask.height,alpha:[...mask.alpha]}))");
    assert.deepEqual(mask, { width: 2, height: 2, alpha: [0, 0, 255, 255] });
    checks.push('Chromium decodes the real two-frame APNG and both first-frame and later-frame pixels are clickable');
    assert.equal(await ev("whaleDesktop.openExternal('https://example.org/no-user-click')"), false);
    const edge = await ev(`(() => {
      const img=document.querySelector('.dshwv-img'),root=document.querySelector('.dshwv-root'),body=document.querySelector('.dshwv-body');
      const r=img.getBoundingClientRect(),candidates=[],flipped=WhaleRendering.mirrorScale(root)<0;
      for(let y=Math.ceil(r.top)+1;y<r.bottom-1;y+=2)for(let x=Math.ceil(r.left)+1;x<r.right-1;x+=2){
        const target=document.elementFromPoint(x,y);
        if(target?.closest('.dshwv-menu-btn,.dshwv-pop'))continue;
        if(WhaleRendering.hitCache.hit(img,x,y,flipped))candidates.push({x,y});
      }
      const css=body.style.cssText,transform=body.style.transform;body.style.transition='none';body.style.transform='scaleY(0.88) scaleX(1.05)';
      const result=candidates.find(p=>!WhaleRendering.hitCache.hit(img,p.x,p.y,flipped));body.style.transform=transform;void body.offsetWidth;body.style.cssText=css;
      document.addEventListener('pointerdown',e=>{window.__auditPointer=e.pointerId;},true);
      return result;
    })()`);
    assert.ok(edge, 'the original role must provide a press-animation boundary point');
    setTestCursor(edge); window.webContents.sendInputEvent({ type: 'mouseMove', ...edge }); await delay(120);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, ...edge }); await delay(320);
    assert.equal(await ev(`WhaleRendering.hitCache.hit(document.querySelector('.dshwv-img'),${edge.x},${edge.y},WhaleRendering.mirrorScale(document.querySelector('.dshwv-root'))<0)`), false, 'the test pixel must become transparent while pressed');
    assert.equal(renderInfo().inputEnabled, true, 'a captured press must not make the window click-through');
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, ...edge });
    await wait("window.__whaleRenderTest.status().shown && !window.__whaleRenderTest.status().switching", 'accepted edge press completes its bubble click after moving alpha');
    checks.push('an actual boundary press keeps native input captured through squish and opens its bubble on release');
    await ev('window.__whaleRenderTest.close()'); await delay(350);
    await ev("window.__whaleRenderTest.scene([{type:'link',text:'审计测试链接',url:'https://example.org/whale-audit',size:3}],0)");
    await wait("!window.__whaleRenderTest.status().switching && !!document.querySelector('.dshwv-frame:not([inert]) [title=\"https://example.org/whale-audit\"]')", 'the real custom bubble link is rendered');
    await delay(500);
    const link = await ev("(() => {const e=document.querySelector('.dshwv-frame:not([inert]) [title=\"https://example.org/whale-audit\"]');const r=e.getBoundingClientRect();return{x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),left:r.left,top:r.top,right:r.right,bottom:r.bottom};})()");
    assert.ok(link.left >= 0 && link.top >= 0 && link.right <= viewport.width && link.bottom <= viewport.height);
    setTestCursor({ x: link.x, y: link.y });
    window.webContents.sendInputEvent({ type: 'mouseMove', x: link.x, y: link.y }); await delay(100);
    window.webContents.sendInputEvent({ type: 'mouseDown', button: 'left', clickCount: 1, x: link.x, y: link.y }); await delay(30);
    window.webContents.sendInputEvent({ type: 'mouseUp', button: 'left', clickCount: 1, x: link.x, y: link.y });
    const linkDeadline = Date.now() + 3000;
    while (openedLinks.length === 0 && Date.now() < linkDeadline) await delay(30);
    assert.deepEqual(openedLinks, ['https://example.org/whale-audit']);
    assert.equal(await ev("whaleDesktop.openExternal('https://example.org/repeated')"), false);
    checks.push('actual Electron input clicks the real custom-bubble link through enableLinkRun and opens exactly one allowed HTTP/S URL');
    fs.writeFileSync(path.join(output, 'desktop-audit.png'), (await window.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(output, 'desktop-audit.json'), JSON.stringify({ ok: true, checks, viewport, link, expectedMissingImageConsoleMessages: errors.filter(message => /404|ERR_FILE_NOT_FOUND/.test(message)).length, dataDir }, null, 2));
    // Only this isolated test renderer is deliberately stalled. Production
    // Codex and its real companion remain untouched.
    ev('for (;;) {}').catch(() => {});
    await delay(80);
    app.quit();
  } catch (error) {
    fs.writeFileSync(path.join(output, 'desktop-audit.json'), JSON.stringify({ ok: false, checks, error: error.message, errors, dataDir }, null, 2));
    throw error;
  }
}
