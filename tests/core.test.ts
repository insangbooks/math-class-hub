import test from 'node:test';
import assert from 'node:assert/strict';
import { candidates, curvePath, experiment, functionValue, graphCoordinate, makeGroups, numberValue, parseExcluded, remainingSeconds, safeUrl, shuffled, validateApps, validateSettings, defaults } from '../src/core.ts';
import { APPS_KEY, SETTINGS_KEY, loadApps, loadSettings, readSlot, writeSlot } from '../src/storage.ts';
import type {StorageLike} from '../src/storage.ts';
function memory(initial:Record<string,string>={}):StorageLike&{data:Record<string,string>}{const data={...initial};return {data,getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;},removeItem:k=>{delete data[k];}};}
test('audience excludes, normalizes duplicates, rejects invalid target after shrinking',()=>{
  assert.deepEqual(parseExcluded('2, 2  4',5),[2,4]);assert.deepEqual(candidates(5,[2]),[1,3,4,5]);
  for(const value of ['0','6','1.5','NaN','Infinity','abc'])assert.throws(()=>parseExcluded(value,5));
  assert.throws(()=>candidates(2,[3]));
});
test('shuffle and group assignment have no omissions or duplicates, size difference at most one',()=>{
  for(let n=1;n<=200;n++)for(const k of [1,Math.max(1,Math.floor(n/3)),n]){
    const input=Array.from({length:n},(_,i)=>i+1);const groups=makeGroups(input,k,()=>0);
    assert.deepEqual(groups.flat().sort((a,b)=>a-b),input);assert.ok(Math.max(...groups.map(g=>g.length))-Math.min(...groups.map(g=>g.length))<=1);
    assert.equal(new Set(shuffled(input)).size,n);
  }
  assert.throws(()=>makeGroups([1,2],3));
});
test('probability frequency sums, valid outcomes, repetition bounds',()=>{
  for(const sides of [2,6]){const out=experiment(sides,10000);assert.equal(out.length,sides);assert.equal(out.reduce((a,b)=>a+b,0),10000);assert.ok(out.every(n=>Number.isInteger(n)&&n>=0));}
  assert.deepEqual(experiment(2,10,()=>0),[10,0]);assert.throws(()=>experiment(3,10));assert.throws(()=>experiment(2,10001));
});
test('numeric validation rejects blanks, non-finite and fractional integer inputs',()=>{
  for(const raw of ['', ' ', 'Infinity', 'NaN', '-1','201','1.5'])assert.throws(()=>numberValue(raw,'입력',1,200,true));
  assert.equal(numberValue('-0.5','입력',-1,1),-.5);
});
test('URLs require HTTPS without credentials or token-bearing parameters',()=>{
  assert.equal(safeUrl('https://example.com/tool'),'https://example.com/tool');
  for(const s of ['javascript:alert(1)','data:text/html,hi','http://example.com','file:///a','https://a:b@example.com','https://example.com/?token=x','https://example.com/#secret','no-url'])assert.throws(()=>safeUrl(s));
});
test('safe coefficient calculation and graph coordinate mapping',()=>{
  assert.equal(functionValue('linear',2,1,0,0),1);assert.equal(functionValue('linear',2,1,0,1),3);
  assert.equal(functionValue('quadratic',1,0,0,2),4);assert.equal(functionValue('quadratic',1,-2,1,1),0);
  assert.equal(graphCoordinate(0,10),300);assert.equal(graphCoordinate(10,10),560);assert.equal(graphCoordinate(10,10,true),40);
});
test('timer corrects elapsed time, clamps expiration to zero',()=>{
  assert.equal(remainingSeconds(60000,10000),50);assert.equal(remainingSeconds(60000,10001),50);assert.equal(remainingSeconds(60000,70000),0);
});
test('steep quadratic remains visible at wide ranges; offscreen curves return no path',()=>{
  const p=curvePath('quadratic',1000,0,0,1000);assert.ok(p.includes('L'));assert.ok(!p.includes('NaN'));assert.ok(!p.includes('Infinity'));
  assert.equal(curvePath('quadratic',1,0,1000,10),'');assert.ok(curvePath('linear',1000,0,0,1000).includes('L'));
});
test('normal settings and apps survive persistence; duplicate IDs rejected',()=>{
  const store=memory();writeSlot(store,SETTINGS_KEY,defaults,false,validateSettings);assert.deepEqual(loadSettings(store).value,defaults);
  const app={id:'synthetic-tool-1',name:'도형 도구',description:'합성 테스트',url:'https://example.com/'};
  writeSlot(store,APPS_KEY,[app],false,validateApps);assert.deepEqual(loadApps(store).value,[app]);assert.throws(()=>validateApps([app,app]));assert.throws(()=>validateSettings({...defaults,studentCount:'30'}));
});
test('corrupt data and unknown versions stay intact; locked writes cannot overwrite',()=>{
  for(const raw of ['{broken',JSON.stringify({schemaVersion:2,data:defaults}),JSON.stringify({schemaVersion:1,data:{...defaults,excludedNumbers:[201]}})]){
    const store=memory({[SETTINGS_KEY]:raw});const slot=loadSettings(store);assert.ok(slot.blocked);
    assert.throws(()=>writeSlot(store,SETTINGS_KEY,defaults,slot.blocked,validateSettings));assert.equal(store.data[SETTINGS_KEY],raw);
  }
});
test('storage permission and quota failures do not report successful writes',()=>{
  const store=memory();writeSlot(store,SETTINGS_KEY,defaults,false,validateSettings);const original=store.data[SETTINGS_KEY];
  store.setItem=()=>{throw new Error('quota');};assert.throws(()=>writeSlot(store,SETTINGS_KEY,{...defaults,timerSeconds:60},false,validateSettings));assert.equal(store.data[SETTINGS_KEY],original);
  store.getItem=()=>{throw new Error('denied');};assert.ok(readSlot(store,SETTINGS_KEY,defaults,validateSettings).blocked);
});
