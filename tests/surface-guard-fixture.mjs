import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
// Invoked only by the isolated native-monitor harness. Never probes or alters
// the user's Codex window: all faults target this fixture's BrowserWindow.
export async function verifyDesktop({app,window,errors,renderInfo}) {
 const out=path.resolve(process.env.WHALE_DESKTOP_VERIFY_DIR),checks=[],trace=[];
 const ev=s=>window.webContents.executeJavaScript(s);
 const snapshot=()=>({at:Date.now(),visible:window.isVisible(),...renderInfo()});
 const wait=async(fn,label,ms=12000)=>{const start=Date.now();while(Date.now()-start<ms){if(fn())return;await delay(20)}throw Error(label+': '+JSON.stringify(snapshot()))};
 let last='';const sample=setInterval(()=>{const v=snapshot(),key=JSON.stringify({visible:v.visible,guard:v.surfaceGuard});if(key!==last){last=key;trace.push(v)}},10);
 const ready=()=>window.isVisible()&&renderInfo().surfaceGuard?.verified&&!renderInfo().visibility.pending;
 try {
  await wait(ready,'initial native proof');
  await ev("document.querySelector('.dshwv-img')?.decode().catch(()=>{})");
  await delay(700);const base=renderInfo().surfaceGuard.revocations;
  await delay(1200);assert.equal(renderInfo().surfaceGuard.revocations,base);checks.push('normal idle remains verified without native revocations');
  for(const kind of ['missing','full-rectangle']){
   const rev=renderInfo().surfaceGuard.revocations,epoch=renderInfo().surfaceGuard.epoch,begin=trace.length,started=Date.now();
   if(kind==='missing')window.setShape([]);else {const r=window.getContentBounds();window.setShape([{x:0,y:0,width:r.width,height:r.height}]);}
   await wait(()=>renderInfo().surfaceGuard.revocations>rev,kind+' native detection');
   const observedMs=Date.now()-started;
   await wait(ready,kind+' recovery');
   assert.ok(renderInfo().surfaceGuard.epoch>epoch);
   assert.ok(trace.slice(begin).some(t=>!t.visible&&!t.surfaceGuard.verified),kind+' must revoke visibility');
   checks.push({fault:kind,observedMs,restored:true});await delay(500);
  }
  const epoch=renderInfo().surfaceGuard.epoch;const r=window.getBounds();window.setBounds({...r,width:Math.max(600,r.width-90),height:Math.max(480,r.height-50)});
  await wait(()=>renderInfo().surfaceGuard.epoch>epoch,'resize epoch');await wait(ready,'resize proof');checks.push('resized viewport obtains fresh native proof');
  const rev=renderInfo().surfaceGuard.revocations;
  await ev("(()=>{let d=document.createElement('dialog');d.id='native-guard-test-card';d.style.cssText='width:85vw;height:75vh';d.textContent='Native region verification';document.body.append(d);d.showModal()})()");
  await delay(900);assert.equal(renderInfo().surfaceGuard.revocations,rev);assert.ok(ready());
  await ev("document.getElementById('native-guard-test-card').remove()");await delay(500);checks.push('large legal dialog and disjoint region remain valid');
  const nativeSetShape=window.setShape.bind(window),beforeDeadline=renderInfo().surfaceGuard.revocations;
  const full=()=>{const b=window.getContentBounds();nativeSetShape([{x:0,y:0,width:b.width,height:b.height}]);};
  window.setShape=full;full();
  const animate=setInterval(()=>window.webContents.send('whale-shape-request'),16),deadlineStart=Date.now();
  try{await wait(()=>renderInfo().surfaceGuard.revocations>beforeDeadline,'continuous silent region failure bounded deadline',5000);}
  finally{clearInterval(animate);window.setShape=nativeSetShape;window.webContents.send('whale-shape-request');}
  await wait(ready,'continuous mismatch recovery');checks.push({fault:'continuous-silent-full-region',observedMs:Date.now()-deadlineStart,restored:true});
  // Recovery is bounded per incident; a genuinely healthy interval resets the
  // budget so an unrelated later failure can recover without a permanent lockout.
  await delay(31000);assert.equal(renderInfo().surfaceGuard.attempts,0);checks.push('30 seconds of verified health reset the recovery budget');
  const before=trace.length;window.webContents.emit('unresponsive');
  await wait(()=>trace.slice(before).some(t=>!t.visible),'unresponsive hide');await wait(ready,'unresponsive reload and proof');checks.push('unresponsive event hides then reloads and verifies before showing');
  assert.equal(errors.length,0,JSON.stringify(errors));
  fs.writeFileSync(path.join(out,'surface-native.json'),JSON.stringify({ok:true,checks,trace,errors,final:snapshot()},null,2));
 }catch(e){fs.writeFileSync(path.join(out,'surface-native.json'),JSON.stringify({ok:false,error:String(e.stack),checks,trace,errors,final:snapshot()},null,2));throw e;}
 finally{clearInterval(sample);app.quit();}
}
