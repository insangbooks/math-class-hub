import assert from 'node:assert/strict';
const base='http://127.0.0.1:4175';
for(const url of ['/','/sw.js','/manifest.webmanifest','/icon-192.png','/icon-512.png']){
  const response=await fetch(base+url);assert.equal(response.status,200,url);assert.ok(response.headers.get('content-security-policy'));assert.equal(response.headers.get('x-content-type-options'),'nosniff');
}
for(const url of ['/package.json','/src/core.ts','/%2e%2e/package.json'])assert.equal((await fetch(base+url)).status,404,url);
assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
const manifest=await(await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.icons.length,2);
console.log('PASS: production shell, icon/manifest routes, security headers, denied source routes, POST rejection.');
