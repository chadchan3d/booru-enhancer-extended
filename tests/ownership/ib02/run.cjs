'use strict';
const assert = require('assert');
const { MiniDocument, MiniEvent, structuralSnapshot } = require('./mini_dom.cjs');
const { createOwner, safeViewerClick } = require('./owner_probe.cjs');

const results = [];
function test(id, fn) {
  try { fn(); results.push({ id, pass: true }); }
  catch (err) { results.push({ id, pass: false, error: err.stack || String(err) }); }
}
function fixture() {
  const d = new MiniDocument();
  const card = d.createElement('article'); card.setAttribute('id','card');
  const link = d.createElement('a'); link.setAttribute('href','/post/1'); link.setAttribute('title','native title');
  const picture = d.createElement('picture');
  const source = d.createElement('source'); source.setAttribute('srcset','native-1x 1x, native-2x 2x');
  const img = d.createElement('img'); img.setAttribute('src','native.jpg'); img.setAttribute('srcset','native.jpg 1x'); img.setAttribute('style','object-fit:cover');
  picture.appendChild(source); picture.appendChild(img); link.appendChild(picture); card.appendChild(link); d.body.appendChild(card);
  return { d, card, link, picture, source, img };
}

test('O01-static-restoration', () => {
  const f=fixture(); const before=structuralSnapshot(f.card); const o=createOwner({origin:f.link});
  o.ownAttribute(f.link,'title',null); o.ownAttribute(f.img,'style','object-fit:contain'); o.ownAttribute(f.source,'srcset','enhanced 1x'); o.dispose();
  assert.deepStrictEqual(structuralSnapshot(f.card),before);
});
test('O02-native-identity-listener', () => {
  const f=fixture(); const refs=[f.link,f.picture,f.source,f.img]; let calls=0; const native=()=>calls++; f.link.addEventListener('click',native);
  const o=createOwner({origin:f.link}); const b=f.d.createElement('button'); o.addOwned(b,f.card); o.dispose();
  assert.strictEqual(f.link,refs[0]); assert.strictEqual(f.picture,refs[1]); assert.strictEqual(f.source,refs[2]); assert.strictEqual(f.img,refs[3]);
  f.link.dispatchEvent(new MiniEvent('click')); assert.strictEqual(calls,1);
});
test('O03-repeat-dispose', () => {
  const f=fixture(); let active=0;
  for(let i=0;i<5;i++){ const o=createOwner({origin:f.link}); const b=f.d.createElement('button'); o.addOwned(b,f.card); o.on(b,'click',()=>active++); b.dispatchEvent(new MiniEvent('click')); o.dispose(); o.dispose(); b.dispatchEvent(new MiniEvent('click')); }
  assert.strictEqual(active,5);
});
test('O04-later-native-edits-survive', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); o.ownAttribute(f.link,'title','enhanced'); o.ownAttribute(f.img,'style','object-fit:contain'); o.ownAttribute(f.source,'srcset','enhanced');
  f.link.setAttribute('title','native newer'); f.img.setAttribute('style','native newer style'); f.source.setAttribute('srcset','native newer srcset'); o.dispose();
  assert.strictEqual(f.link.getAttribute('title'),'native newer'); assert.strictEqual(f.img.getAttribute('style'),'native newer style'); assert.strictEqual(f.source.getAttribute('srcset'),'native newer srcset');
});
test('O05-same-value-native-write-preserved', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); o.ownAttribute(f.img,'style','object-fit:contain'); f.img.setAttribute('style','object-fit:contain'); o.dispose(); assert.strictEqual(f.img.getAttribute('style'),'object-fit:contain');
});
test('O06-late-work-guard', () => {
  const f=fixture(); let late=0, cleanup=0; const o=createOwner({origin:f.link}); const guarded=o.guard(()=>late++); o.cleanup(()=>cleanup++); o.dispose(); guarded(); o.dispose(); assert.strictEqual(late,0); assert.strictEqual(cleanup,1);
});
test('O07-sync-takeover-failure', () => {
  const e=new MiniEvent('click'); let opened=0; const did=safeViewerClick(e,{openShell:()=>{opened++; return false;}}); assert.strictEqual(did,false); assert.strictEqual(e.defaultPrevented,false); assert.strictEqual(opened,1);
});
test('O08-later-media-fallback', () => {
  const f=fixture(); const fallback=f.d.createElement('a'); fallback.setAttribute('href',f.link.getAttribute('href')); const o=createOwner({origin:f.link}); o.addOwned(fallback,f.card); assert.strictEqual(fallback.getAttribute('href'),'/post/1'); o.dispose();
});
test('O09-protected-clicks', () => {
  const variants=[{ctrlKey:true},{metaKey:true},{shiftKey:true},{altKey:true},{button:1}]; let opens=0;
  for(const init of variants){ const e=new MiniEvent('click',init); assert.strictEqual(safeViewerClick(e,{openShell:()=>{opens++; return true;}}),false); assert.strictEqual(e.defaultPrevented,false); }
  assert.strictEqual(opens,0);
});
test('O10-append-failure-retains-readable-content', () => {
  const f=fixture(); const paginator=f.d.createElement('a'); paginator.setAttribute('href','?page=2'); f.d.body.appendChild(paginator); const o=createOwner({origin:f.link}); const added=f.d.createElement('article'); added.textContent='appended'; o.addOwned(added,f.d.body);
  assert.strictEqual(added.isConnected,true); assert.strictEqual(paginator.isConnected,true);
});
test('O11-full-disposal-removes-owned-only', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); const added=f.d.createElement('article'); o.addOwned(added,f.d.body); o.dispose(); assert.strictEqual(added.isConnected,false); assert.strictEqual(f.card.isConnected,true); assert.strictEqual(f.link.isConnected,true);
});
test('O12-nested-native-control', () => {
  const e=new MiniEvent('click'); let opens=0; const did=safeViewerClick(e,{openShell:()=>{opens++;return true;},isNativeControl:true}); assert.strictEqual(did,false); assert.strictEqual(e.defaultPrevented,false); assert.strictEqual(opens,0);
});
test('O13-focused-owned-control-returns-origin', () => {
  const f=fixture(); f.link.focus(); const o=createOwner({origin:f.link}); const b=f.d.createElement('button'); o.addOwned(b,f.card); b.focus(); const out=o.dispose(); assert.strictEqual(b.isConnected,false); assert.strictEqual(f.d.activeElement,f.link); assert.strictEqual(out.focusOutcome,'origin'); assert.strictEqual(out.reloadRecommended,false);
});
test('O13-mutant-missing-focus-return-detected', () => {
  const f=fixture(); const b=f.d.createElement('button'); f.card.appendChild(b); b.focus(); b.remove(); assert.strictEqual(f.d.activeElement,f.d.body); assert.notStrictEqual(f.d.activeElement,f.link);
});
test('O14-do-not-steal-later-user-focus', () => {
  const f=fixture(); const other=f.d.createElement('input'); f.d.body.appendChild(other); const o=createOwner({origin:f.link}); const b=f.d.createElement('button'); o.addOwned(b,f.card); b.focus(); other.focus(); const out=o.dispose(); assert.strictEqual(f.d.activeElement,other); assert.strictEqual(out.focusOutcome,'unchanged');
});
test('O15-missing-origin-uses-declared-fallback', () => {
  const f=fixture(); const fallback=f.d.createElement('a'); fallback.setAttribute('href','/native-list'); f.d.body.appendChild(fallback); const o=createOwner({origin:f.link,fallback}); const b=f.d.createElement('button'); o.addOwned(b,f.card); b.focus(); f.card.remove();
  f.d.body.appendChild(b); b.focus(); const out=o.dispose(); assert.strictEqual(f.d.activeElement,fallback); assert.strictEqual(out.focusOutcome,'fallback');
});
test('O16-no-surviving-target-discloses-reload-recovery', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); const b=f.d.createElement('button'); o.addOwned(b,f.card); b.focus(); f.card.remove(); f.d.body.appendChild(b); b.focus(); const out=o.dispose(); assert.strictEqual(out.focusOutcome,'unresolved'); assert.strictEqual(out.reloadRecommended,true); assert.strictEqual(f.d.activeElement,f.d.body);
});
test('O17-native-card-replacement-not-restored-over-new-card', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); o.ownAttribute(f.link,'title','enhanced'); const replacement=f.d.createElement('article'); replacement.setAttribute('id','card'); const replacementLink=f.d.createElement('a'); replacementLink.setAttribute('title','replacement native'); replacement.appendChild(replacementLink); f.d.body.removeChild(f.card); f.d.body.appendChild(replacement); o.dispose(); assert.strictEqual(replacementLink.getAttribute('title'),'replacement native'); assert.strictEqual(replacement.isConnected,true);
});
test('O18-moved-source-node-keeps-identity', () => {
  const f=fixture(); const holder=f.d.createElement('div'); f.d.body.appendChild(holder); const o=createOwner({origin:f.link}); o.ownAttribute(f.source,'srcset','enhanced'); holder.appendChild(f.source); o.dispose(); assert.strictEqual(f.source.parentNode,holder); assert.strictEqual(f.source.getAttribute('srcset'),'native-1x 1x, native-2x 2x');
});
test('O19-repeated-native-edits-latest-survives', () => {
  const f=fixture(); const o=createOwner({origin:f.link}); o.ownAttribute(f.link,'title','enhanced'); f.link.setAttribute('title','native one'); f.link.setAttribute('title','native two'); o.dispose(); assert.strictEqual(f.link.getAttribute('title'),'native two');
});
test('O20-disabled-labels-and-equivalent-replacement', () => {
  const f=fixture(); assert.strictEqual(f.link.getAttribute('title'),'native title');
  const o=createOwner({origin:f.link}); o.ownAttribute(f.link,'title',null); o.ownAttribute(f.link,'aria-label','native title'); assert.strictEqual(f.link.getAttribute('aria-label'),'native title'); o.dispose(); assert.strictEqual(f.link.getAttribute('title'),'native title'); assert.strictEqual(f.link.hasAttribute('aria-label'),false);
});

const failures=results.filter(r=>!r.pass);
console.log(JSON.stringify({suite:'IB02 V6-L ownership probe',cases:results.length,passed:results.length-failures.length,failed:failures.length,results},null,2));
process.exitCode=failures.length?1:0;
