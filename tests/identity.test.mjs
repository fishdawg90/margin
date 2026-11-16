import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('the installed app belongs to Margin instead of the shared GitHub Pages origin',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
 const manifestURL='https://fishdawg90.github.io/margin/manifest.webmanifest';
 const start=new URL(manifest.start_url,manifestURL);
 const processedId=new URL(manifest.id,start.origin);
 assert.equal(processedId.href,'https://fishdawg90.github.io/margin/');
 assert.notEqual(processedId.pathname,'/');
 assert(start.href.startsWith(new URL(manifest.scope,manifestURL).href));
});
