import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createInsightsService} from '../runtime/insights.mjs';
import {createDispatcher} from '../runtime/dispatcher.mjs';

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'whale-refresh-'));
  const home=path.join(root,'codex');fs.mkdirSync(path.join(home,'sessions'),{recursive:true});
  const now=Date.now();
  fs.writeFileSync(path.join(home,'auth.json'),JSON.stringify({auth_mode:'chatgpt',tokens:{account_id:'test-account'}}));
  fs.utimesSync(path.join(home,'auth.json'),new Date(now-3600000),new Date(now-3600000));
  const config={codexHome:home,resolve:()=>({id:'openai',accountId:'test-account',key:null,setting:{monitorSessions:true}})};
  const write=(used,at=now-1000)=>fs.writeFileSync(path.join(home,'sessions','rollout-test.jsonl'),[
    {type:'session_meta',payload:{id:'test-session'}},
    {type:'event_msg',timestamp:new Date(at).toISOString(),payload:{type:'token_count',rate_limits:{limit_id:'codex',primary:{used_percent:used,window_minutes:300,resets_at:(now+3600000)/1000}}}},
  ].map(x=>JSON.stringify(x)).join('\n')+'\n');
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return {root,config,write,now};
}

test('manual refresh reads new quota inside cache TTL; background reads remain cached',async t=>{
  const f=fixture(t),service=createInsightsService(f.config);t.after(()=>service.close());
  f.write(20);assert.equal((await service.get()).subscription.windows[0].usedPercent,20);
  f.write(35);assert.equal((await service.get()).subscription.windows[0].usedPercent,20);
  assert.equal((await service.get({force:true})).subscription.windows[0].usedPercent,35);
  assert.equal((await service.get()).subscription.windows[0].usedPercent,35);
});

test('refresh never freshens an old snapshot or represents subscription expiry',async t=>{
  const f=fixture(t),service=createInsightsService(f.config);t.after(()=>service.close());
  const at=f.now-16*60000;f.write(20,at);
  await service.get();const result=await service.get({force:true});
  assert.equal(result.subscription.windows[0].stale,true);
  assert.equal(result.subscription.windows[0].observedAt,at);
  assert.match(result.subscription.reason,/不代表订阅到期/);
});

test('dispatcher refresh=1 bypasses cache and parallel refreshes complete',async t=>{
  const f=fixture(t),server=createDispatcher({dataDir:path.join(f.root,'data'),service:{config:f.config,turns:new Map(),close:async()=>{}},monitor:false,autoRefresh:false});
  t.after(()=>server.close());
  const get=async route=>JSON.parse((await server.dispatch(route)).body.toString());
  f.write(20);assert.equal((await get('/api/insights')).subscription.windows[0].usedPercent,20);
  f.write(60);assert.equal((await get('/api/insights')).subscription.windows[0].usedPercent,20);
  const results=await Promise.all([get('/api/insights?refresh=1'),get('/api/insights?refresh=1')]);
  for(const result of results)assert.equal(result.subscription.windows[0].usedPercent,60);
});

test('account view requests forced scans and clears failed snapshots',async()=>{
  const {default:vm}=await import('node:vm');
  const source=fs.readFileSync(new URL('../desktop/ui/account-view.js',import.meta.url),'utf8');
  const calls=[];let fail=false;
  const window={};
  vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}},
    localStorage:{getItem:()=> 'subscription'},AbortController,setTimeout,clearTimeout,
    fetch:async url=>{calls.push(url);return {ok:!fail,json:async()=>({ok:true,subscription:{available:true,windows:[]}})};}});
  await window.WhaleAccountView.refresh();assert.equal(calls[0],'/api/insights');
  await window.WhaleAccountView.refresh({force:true});assert.equal(calls[1],'/api/insights?refresh=1');
  fail=true;await window.WhaleAccountView.refresh({force:true});
  assert.equal(window.WhaleAccountView.snapshot.subscription.available,false);
  assert.equal(window.WhaleAccountView.snapshot.subscription.windows.length,0);
});

test('refresh feedback distinguishes absent, stale, fresh and failed observations',async()=>{
  const {default:vm}=await import('node:vm');
  const context={module:{exports:{}}};
  vm.runInNewContext(fs.readFileSync(new URL('../desktop/ui/account-view.js',import.meta.url),'utf8'),context);
  const {refreshMessage}=context.module.exports;
  assert.match(refreshMessage({subscription:{available:false,reason:'尚未观测'}}),/尚未观测/);
  assert.match(refreshMessage({subscription:{available:true,windows:[{stale:true}]}}),/待更新/);
  assert.equal(refreshMessage({subscription:{available:true,windows:[{stale:false}]}}),'订阅额度已刷新');
  assert.match(refreshMessage({error:'observation-timeout'}),/失败/);
});
