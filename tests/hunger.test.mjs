import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = {module:{exports:{}}};
vm.runInNewContext(fs.readFileSync(new URL('../assets/whale-hunger.js', import.meta.url), 'utf8'), context);
const {subscriptionLow, apiLow} = context.module.exports;

test('subscription hunger requires a fresh valid low window', () => {
  const data = (usedPercent, stale = false) => ({subscription:{available:true, windows:[{usedPercent,stale}]}});
  assert.equal(subscriptionLow(data(80), 20), true);
  assert.equal(subscriptionLow(data(79), 20), false);
  assert.equal(subscriptionLow(data(99, true), 20), false);
  assert.equal(subscriptionLow(data(101), 20), false);
  assert.equal(subscriptionLow({subscription:{available:false,windows:[]}}, 20), false);
});

test('API hunger requires a confirmed fresh finite balance and an enabled threshold', () => {
  const balance = {ok:true,balanceStatus:'finite',totalBalance:5};
  const alert = {on:true,below:10};
  assert.equal(apiLow(balance, alert), true);
  assert.equal(apiLow({...balance,stale:true}, alert), false);
  assert.equal(apiLow({...balance,balanceStatus:'unconfirmed'}, alert), false);
  assert.equal(apiLow(balance, {...alert,on:false}), false);
  assert.equal(apiLow(balance, {...alert,below:null}), false);
});

test('low balance shows the still image, clicking animates once, and recovery restores the role', async () => {
  function element() {
    const classes = new Set();
    return {style:{}, children:[], listeners:{}, classList:{toggle(name, value){ value ? classes.add(name) : classes.delete(name); },
      add(name){classes.add(name);}, remove(name){classes.delete(name);}, contains(name){return classes.has(name);}},
      addEventListener(name, fn){this.listeners[name] = fn;}, append(...items){this.children.push(...items);},
      appendChild(item){this.children.push(item);}, insertBefore(item){this.children.push(item);}};
  }
  const listeners = {}, body = element(), menu = element(), original = element();
  const sandbox = {module:{exports:{}}, window:{WhaleAccountView:{mode:'api'}, addEventListener(n, fn){listeners[n]=fn;}},
    document:{head:element(), hidden:false, createElement:element, addEventListener(){}}, localStorage:{getItem(){return null;},setItem(){}}, setInterval(){}};
  vm.runInNewContext(fs.readFileSync(new URL('../assets/whale-hunger.js', import.meta.url), 'utf8'), sandbox);
  const instance = sandbox.module.exports.create({body,original,menu,alertSettings:()=>({on:true,below:10})});
  const image = body.children[0];
  listeners['whale-balance']({detail:{ok:true,balanceStatus:'finite',totalBalance:5}});
  assert.equal(image.classList.contains('whale-hungry-visible'), true);
  assert.equal(image.classList.contains('whale-begging'), false);
  assert.equal(original.style.opacity, undefined);
  instance.click();
  assert.equal(image.classList.contains('whale-begging'), true);
  listeners['whale-balance']({detail:{ok:true,balanceStatus:'finite',totalBalance:20}});
  assert.equal(image.classList.contains('whale-hungry-visible'), false);
  assert.equal(original.style.opacity, undefined);
});
