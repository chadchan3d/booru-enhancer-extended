'use strict';
// IB08 diagnosis A: terminal gallery disposal on e621/e926 listings.
// Runs the REAL production userscript in jsdom (IB07 harness), both hosts:
//   1 owned values restore at dispose;
//   2 no automatic re-enhancement after the 400 ms body-observer debounce,
//     nor after an unrelated body mutation;
//   3 native edit / move / source and picture replacements stay untouched;
//   4 a resize after dispose stays native;
//   5 explicit gallery.init() re-enhances;
//   6 a genuinely new container is still initialized by the body observer;
//   7 five dispose/init cycles leave no stale state (one action bar per card,
//     terminal after each dispose, native at the end);
//   8 the body observer cannot bypass the disposed-container barrier
//     (marker absent, repeated body mutations, history navigation).
// Fault controls: the barrier removed from the body observer, dispose not
// recording its container, init not clearing it, and the previous production
// a0f3041 (commit b2b1d9f, the live-failing artifact) must each be caught.
// Fixtures are synthetic. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const REPO = path.resolve(__dirname, '../../..');
const PROD = h.productionSource();
const PREVIOUS = execFileSync('git', ['-C', REPO, 'show', 'b2b1d9f:Booru_Enhancer.user.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

const M = 'https://static.example';
const U = (id) => ({ webp: `${M}/p${id}.webp`, jpg: `${M}/p${id}.jpg`, sample: `${M}/sample/s${id}.jpg` });
const card = (id) => { const u = U(id); return `<article class="thumbnail" data-id="${id}" data-file-ext="png" data-file-url="${M}/f${id}.png" data-sample-url="${u.sample}"
  data-preview-url="${u.jpg}" data-preview-webp="${u.webp}"><a href="/posts/${id}"><picture><source srcset="${u.webp}" type="image/webp"><source srcset="${u.jpg}" type="image/jpeg"><img src="${u.jpg}" alt=""></picture></a></article>`; };
const listing = (host) => ({ url: `https://${host}/posts`, html: `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${[1, 2, 3, 4, 5, 6].map(card).join('')}</section></body></html>` });

const mut = (s, from, to) => { if (s.split(from).length !== 2) throw new Error(`pattern not unique: ${from.slice(0, 60)}`); return s.replace(from, to); };
const VARIANTS = {
  production: (s) => s,
  barrierRemoved: (s) => mut(s, 'if (container && !container.dataset.beGalleryInit && !BE.modules.gallery.wasDisposed(container)) {', 'if (container && !container.dataset.beGalleryInit) {'),
  disposeNotRecorded: (s) => mut(s, '\t\t\tif (galleryContainer) disposedContainers.add(galleryContainer);\n', ''),
  initNotClearing: (s) => mut(s, '\t\t\tdisposedContainers.delete(container);\n', ''),
  previousProduction: () => PREVIOUS,
};

const sampled = (root) => [...root.querySelectorAll('source')].filter((s) => /\/sample\//.test(s.getAttribute('srcset') || '')).length;
const srcsets = (a) => [...a.querySelectorAll('source')].map((s) => s.getAttribute('srcset'));

async function scenario(src, host) {
  const o = {};
  const c = h.load({ ...listing(host), source: src });
  await h.sleep(300);
  const w = c.window; const d = w.document; const G = () => c.BE.modules.gallery;
  const container = d.querySelector('#posts-container');
  const arts = [...container.querySelectorAll('article')];
  const u = arts.map((a) => U(a.getAttribute('data-id')));
  o.ownedBefore = sampled(container);
  // native changes while owned (card 2 edit, card 3 move, card 4 source replacement, card 5 picture replacement)
  const s2 = arts[1].querySelector('source'); s2.setAttribute('srcset', u[1].jpg);
  const [s3a, s3b] = arts[2].querySelectorAll('source'); s3b.after(s3a);
  const s4 = arts[3].querySelector('source'); const n4 = d.createElement('source'); n4.setAttribute('srcset', u[3].webp); n4.setAttribute('type', 'image/webp'); s4.replaceWith(n4);
  const p5 = arts[4].querySelector('picture'); const np = d.createElement('picture');
  np.innerHTML = `<source srcset="${u[4].webp}" type="image/webp"><source srcset="${u[4].jpg}" type="image/jpeg"><img src="${u[4].jpg}" alt="">`; p5.replaceWith(np);
  await h.sleep(20);
  // 1: restore at dispose
  G().dispose();
  o.ownedAtDispose = sampled(container);
  o.restoredAtDispose = srcsets(arts[0]).join() === [u[0].webp, u[0].jpg].join() && srcsets(arts[5]).join() === [u[5].webp, u[5].jpg].join();
  o.wasDisposedAfterDispose = typeof G().wasDisposed === 'function' ? G().wasDisposed(container) : 'absent';
  // 2: no automatic re-enhancement
  await h.sleep(700);
  o.ownedAfterDebounce = sampled(container);
  o.wrappedAfterDebounce = container.querySelectorAll('article.be-thumb-wrap').length;
  d.body.appendChild(d.createElement('div')); await h.sleep(700);
  o.ownedAfterBodyMutation = sampled(container);
  // 3: native changes untouched
  o.nativeEditKept = srcsets(arts[1]).join() === [u[1].jpg, u[1].jpg].join();
  o.nativeMoveKept = [...arts[2].querySelectorAll('source')].map((x) => x.getAttribute('type')).join() === 'image/jpeg,image/webp' && srcsets(arts[2]).join() === [u[2].jpg, u[2].webp].join();
  o.replacementsNative = srcsets(arts[3]).join() === [u[3].webp, u[3].jpg].join() && srcsets(arts[4]).join() === [u[4].webp, u[4].jpg].join();
  // 4: resize after dispose
  w.innerWidth = 700; w.dispatchEvent(new w.Event('resize')); await h.sleep(700);
  o.ownedAfterResize = sampled(container);
  // 8: barrier - marker absent, repeated body mutations, history navigation
  container.removeAttribute('data-be-gallery-init');
  for (let i = 0; i < 3; i++) { d.body.appendChild(d.createElement('span')); await h.sleep(150); }
  try { w.history.pushState({}, '', '/posts?page=1'); } catch { /* jsdom */ }
  await h.sleep(700);
  o.ownedAfterBypassAttempts = sampled(container);
  o.wrappedAfterBypassAttempts = container.querySelectorAll('article.be-thumb-wrap').length;
  // 5: explicit re-init
  G().init(container); await h.sleep(50);
  o.ownedAfterExplicitInit = sampled(container);
  o.wasDisposedAfterInit = typeof G().wasDisposed === 'function' ? G().wasDisposed(container) : 'absent';
  // 7: cycles
  o.cycles = [];
  for (let k = 0; k < 5; k++) {
    G().dispose(); await h.sleep(700);
    const afterDispose = sampled(container);
    G().init(container); await h.sleep(50);
    o.cycles.push({ afterDispose, afterInit: sampled(container), bars: [...container.querySelectorAll('article')].map((a) => a.querySelectorAll('.be-thumb-actions').length).join('') });
  }
  G().dispose(); await h.sleep(700);
  o.ownedAtEnd = sampled(container);
  o.barsAtEnd = container.querySelectorAll('.be-thumb-actions').length;
  // 6: a genuinely new container is initialized by the body observer
  const fresh = d.createElement('section'); fresh.id = 'posts-container'; fresh.innerHTML = [7, 8].map(card).join('');
  container.replaceWith(fresh); await h.sleep(700);
  o.ownedInNewContainer = sampled(fresh);
  o.oldStillDisposed = typeof G().wasDisposed === 'function' ? G().wasDisposed(container) : 'absent';
  c.window.close();
  return o;
}

function verdicts(host, o) {
  const v = {};
  v[`${host} 1 owned values restore at dispose`] = o.ownedBefore === 6 && o.ownedAtDispose === 0 && o.restoredAtDispose;
  v[`${host} 2 no automatic re-enhancement after the observer delay or a body mutation`] = o.ownedAfterDebounce === 0 && o.wrappedAfterDebounce === 0 && o.ownedAfterBodyMutation === 0;
  v[`${host} 3 native edit, move and replacements stay untouched`] = o.nativeEditKept && o.nativeMoveKept && o.replacementsNative;
  v[`${host} 4 resize after dispose stays native`] = o.ownedAfterResize === 0;
  v[`${host} 5 explicit re-init works and clears the disposed state`] = o.ownedAfterExplicitInit > 0 && o.wasDisposedAfterInit === false;
  v[`${host} 6 a genuinely new container still initializes`] = o.ownedInNewContainer === 2;
  v[`${host} 7 five dispose/init cycles: terminal each time, one action bar per card, native at the end`] = o.cycles.length === 5 && o.cycles.every((x) => x.afterDispose === 0 && x.afterInit > 0 && /^1+$/.test(x.bars)) && o.ownedAtEnd === 0 && o.barsAtEnd === 0;
  v[`${host} 8 body observer cannot bypass the barrier (marker absent, mutations, navigation)`] = o.wasDisposedAfterDispose === true && o.ownedAfterBypassAttempts === 0 && o.wrappedAfterBypassAttempts === 0;
  return v;
}

function child(variant, host) {
  return new Promise((resolve) => execFile(process.execPath, [__filename, '--run', variant, host], { maxBuffer: 8 * 1024 * 1024, timeout: 180000 },
    (err, out) => { try { resolve(JSON.parse(out.slice(out.indexOf('{')))); } catch { resolve({ __crash: String(err || out).slice(0, 200) }); } }));
}

async function main() {
  if (process.argv[2] === '--run') {
    const o = await scenario(VARIANTS[process.argv[3]](PROD), process.argv[4]);
    process.stdout.write(JSON.stringify(o), () => process.exit(0));
    return;
  }
  const hosts = ['e621.net', 'e926.net'];
  const jobs = [];
  for (const v of Object.keys(VARIANTS)) for (const host of hosts) jobs.push([v, host]);
  const obs = {};
  await Promise.all(jobs.map(async ([v, host]) => { obs[`${v} ${host}`] = await child(v, host); }));
  for (const host of hosts) {
    const o = obs[`production ${host}`];
    if (o.__crash) { check(`${host} production run`, false, o.__crash); continue; }
    for (const [name, ok] of Object.entries(verdicts(host, o))) check(name, ok, JSON.stringify(o));
  }
  const expectCaught = {
    barrierRemoved: ['2 no automatic', '8 body observer'],
    disposeNotRecorded: ['2 no automatic', '8 body observer'],
    initNotClearing: ['5 explicit re-init'],
    previousProduction: ['2 no automatic', '8 body observer'],
  };
  for (const [v, targets] of Object.entries(expectCaught)) {
    for (const host of hosts) {
      const o = obs[`${v} ${host}`];
      if (o.__crash) { check(`fault ${v} ${host}: caught by crash`, true); continue; }
      const vv = verdicts(host, o);
      const flipped = Object.keys(vv).filter((k) => !vv[k]);
      const hit = targets.filter((t) => flipped.some((k) => k.includes(t)));
      check(`fault ${v} ${host}: caught by ${hit.join(' + ') || 'nothing'}`, hit.length === targets.length, JSON.stringify(flipped));
    }
  }
  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB08', diagnosis: 'A (terminal gallery disposal)', production_blob: h.gitBlobId(PROD), previous_production_blob: h.gitBlobId(PREVIOUS), fixtures: 'synthetic',
    observations: obs, checks: results.length, passed, failed: results.length - passed, failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'dispose-lifecycle-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
