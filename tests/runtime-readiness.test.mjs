import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeReady } from '../scripts/runtime-readiness.mjs';
const expected={version:'0.4.1',revision:'current-build',nativeGuard:true};
const ready={ok:true,version:'0.4.1',buildVersion:'0.4.1',buildRevision:'current-build',rendererReady:true,surfaceGuard:{verified:true}};
test('an old process with the same semver cannot validate the new installation',()=>{
 assert.equal(runtimeReady({...ready,buildRevision:'previous-build'},expected),false);
 assert.equal(runtimeReady(ready,expected),true);
});
test('renderer-ready without a verified native surface is not a ready Windows installation',()=>{
 for(const surfaceGuard of [undefined,{verified:false}])assert.equal(runtimeReady({...ready,surfaceGuard},expected),false);
 assert.equal(runtimeReady({...ready,rendererReady:false},expected),false);
});
test('platforms without Windows native regions still require the correct ready build',()=>{
 assert.equal(runtimeReady({...ready,surfaceGuard:undefined},{...expected,nativeGuard:false}),true);
 assert.equal(runtimeReady({...ready,buildRevision:'old',surfaceGuard:undefined},{...expected,nativeGuard:false}),false);
});
