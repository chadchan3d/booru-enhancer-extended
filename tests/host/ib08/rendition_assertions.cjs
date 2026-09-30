'use strict';
// IB08 P-stage local production assertions (L1–L9) for applySiteThumbMedia.
// Runs the REAL production userscript in jsdom through the IB07 harness
// (request transports instrumented before evaluation). A MutationObserver
// installed before production evaluates records every rendition-attribute
// change (src, srcset, sizes, media, type) and every node insertion/removal
// inside <picture> elements, so each test counts exactly which writes
// production made. Production mutants must each be caught.
// Fixtures are synthetic (not live markup). Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const { execFileSync, execFile } = require('child_process');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const REPO = path.resolve(__dirname, '../../..');
const PROD = h.productionSource();
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 400) });

// ---- fixtures ------------------------------------------------------------------
const M = 'https://static.example';
const H = '0123456789abcdef0123456789abcdef';
const U = (id) => ({
  file: `${M}/data/${H}_${id}.png`, sample: `${M}/data/sample/${H}_${id}.jpg`,
  preview: `${M}/data/preview/${H}_${id}.jpg`, webp: `${M}/data/preview/${H}_${id}.webp`,
});
function card(id, kind = 'ok') {
  const u = U(id);
  let ext = 'png'; let sampleAttr = `data-sample-url="${u.sample}"`; let fileAttr = `data-file-url="${u.file}"`;
  let s1 = `<source srcset="${u.webp}" type="image/webp">`;
  let s2 = `<source srcset="${u.preview}" type="image/jpeg">`;
  let img = `<img src="${u.preview}" alt="">`;
  let wrap = (inner) => `<picture>${inner}</picture>`;
  switch (kind) {
    case 'video': ext = 'webm'; break;
    case 'gif': ext = 'gif'; break;
    case 'noSample': sampleAttr = ''; break;
    case 'noFile': fileAttr = ''; break;
    case 'noPicture': wrap = (inner) => inner; s1 = ''; s2 = ''; break;
    case 'oneSource': s2 = ''; break;
    case 'threeSources': s2 += `<source srcset="${u.preview}" type="image/png">`; break;
    case 'sizes': s1 = `<source srcset="${u.webp}" type="image/webp" sizes="100px">`; break;
    case 'media': s2 = `<source srcset="${u.preview}" type="image/jpeg" media="(min-width: 1px)">`; break;
    case 'multiSrcset': s1 = `<source srcset="${u.webp} 1x, ${u.sample} 2x" type="image/webp">`; break;
    case 'imgSrcset': img = `<img src="${u.preview}" srcset="${u.preview} 1x" alt="">`; break;
    case 'foreignWebp': s1 = `<source srcset="${M}/other/${H}.webp" type="image/webp">`; break;
    case 'sampleIsPreview': sampleAttr = `data-sample-url="${u.preview}"`; break;
    case 'swappedTypes': s1 = `<source srcset="${u.webp}" type="image/jpeg">`; break;
    default: break;
  }
  return `<article class="thumbnail" data-id="${id}" data-file-ext="${ext}" data-width="1448" data-height="2048" ${fileAttr} ${sampleAttr}
    data-preview-url="${u.preview}" data-preview-webp="${u.webp}"><a href="/posts/${id}" class="thm-link">${wrap(`${s1}${s2}${img}`)}</a></article>`;
}
const MALFORMED = ['video', 'gif', 'noSample', 'noPicture', 'oneSource', 'threeSources', 'sizes', 'media', 'multiSrcset', 'imgSrcset', 'foreignWebp', 'sampleIsPreview', 'swappedTypes'];
const ids = (n, from = 1) => Array.from({ length: n }, (_, i) => String(from + i));
function listing({ anon = 'true', cards = ids(5).map((id) => card(id)) } = {}) {
  const a = anon === null ? '' : ` data-user-is-anonymous="${anon}"`;
  return `<!doctype html><html><head></head><body${a} data-user-level="${anon === 'true' ? '0' : '20'}"><section id="posts-container" class="posts-container">${cards.join('')}</section>
    <nav id="paginator"></nav></body></html>`;
}
const quality = (v) => ({ 'be:setting:media.thumbQuality': JSON.stringify(v) });

// ---- runner ------------------------------------------------------------------------
async function start({ url = 'https://e621.net/posts', html = listing(), settings = {}, source = PROD } = {}) {
  const gm = { thumbQualityWrites: 0 };
  const cookie = { reads: 0, writes: 0 };
  let recs = [];
  let mo = null;
  const pending = [];
  const ctx = h.load({ url, html, source, settings, setup: (w) => {
    const setValue = w.GM_setValue;
    w.GM_setValue = (k, v) => { if (k === 'be:setting:media.thumbQuality') gm.thumbQualityWrites++; return setValue(k, v); };
    const cd = Object.getOwnPropertyDescriptor(w.Document.prototype, 'cookie');
    Object.defineProperty(w.document, 'cookie', { get() { cookie.reads++; return cd.get.call(this); }, set(v) { cookie.writes++; cd.set.call(this, v); } });
    mo = new w.MutationObserver((rs) => { pending.push(...rs); }); // buffer: delivered records leave the queue
    mo.observe(w.document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['src', 'srcset', 'sizes', 'media', 'type'] });
  } });
  const w = ctx.window;
  const arts = [...w.document.querySelectorAll('article')];
  const refs = arts.map((a) => ({ a, img: a.querySelector('img'), picture: a.querySelector('picture'), sources: [...a.querySelectorAll('source')] }));
  const initial = arts.map(rsig);
  await h.sleep(250);
  const take = () => {
    // Rendition attributes on picture/source/img, and node changes inside or of <picture>.
    const media = (n) => ['picture', 'source', 'img'].includes(n.localName) && !!n.closest?.('article');
    const all = pending.splice(0).concat(mo.takeRecords());
    const out = all.filter((r) => (r.type === 'attributes' && media(r.target))
      || (r.type === 'childList' && (r.target.localName === 'picture' || [...r.addedNodes, ...r.removedNodes].some((n) => ['picture', 'source'].includes(n.localName)))));
    recs = recs.concat(out);
    return out;
  };
  const startup = take(); // every rendition write production made while loading and enhancing
  const G = () => ctx.BE.modules.gallery;
  return { ctx, w, arts, refs, initial, take, startup, gm, cookie, G, stored: () => w.GM_getValue('be:setting:media.thumbQuality') };
}
const srcsets = (a) => [...a.querySelectorAll('source')].map((s) => s.getAttribute('srcset'));
// Rendition signature of a card: rendition attributes of its picture/source/img, in order.
const rsig = (a) => [...a.querySelectorAll('picture, source, img')].map((el) => el.localName + JSON.stringify(['src', 'srcset', 'sizes', 'media', 'type'].map((n) => el.getAttribute(n)))).join('|');
const rendition = (t, i) => t.G().getThumbRendition(t.arts[i]);
const onlyWebpWrites = (recs, t, n) => recs.length === n && recs.every((r) => r.type === 'attributes' && r.attributeName === 'srcset' && t.refs.some((x) => x.sources[0] === r.target));

// Each suite returns boolean verdicts; the same suite runs on production and on every mutant.
async function suite(source) {
  const v = {};
  // L1 sample (default), both hosts independently
  for (const host of ['e621.net', 'e926.net']) {
    const t = await start({ url: `https://${host}/posts`, source });
    const recs = t.startup;
    const u = t.arts.map((a) => U(a.getAttribute('data-id')));
    v[`L1 ${host}: one owned write per pattern card, WebP srcset = native sample`] = onlyWebpWrites(recs, t, 5)
      && t.arts.every((a, i) => srcsets(a).join() === [u[i].sample, u[i].preview].join());
    v[`L1 ${host}: JPEG source, img src and img srcset untouched`] = t.arts.every((a, i) => a.querySelector('img').getAttribute('src') === u[i].preview && !a.querySelector('img').hasAttribute('srcset'));
    v[`L1 ${host}: picture/source/img node identity unchanged`] = t.refs.every((r) => r.a.querySelector('img') === r.img && r.a.querySelector('picture') === r.picture && [...r.a.querySelectorAll('source')].every((s, k) => s === r.sources[k]));
    v[`L1 ${host}: provenance OWNED_SAMPLE; other enhancements applied`] = t.arts.every((_, i) => rendition(t, i) === 'OWNED_SAMPLE') && t.arts.every((a) => a.classList.contains('be-thumb-wrap'));
    v[`L8 ${host}: no request, cookie access or thumbQuality write`] = t.ctx.requests.length === 0 && t.cookie.reads + t.cookie.writes === 0 && t.gm.thumbQualityWrites === 0;
    t.w.close();
  }
  // L2 preview and switching
  {
    const t = await start({ settings: quality('preview'), source });
    const u = t.arts.map((a) => U(a.getAttribute('data-id')));
    v['L2: preview makes zero rendition writes, provenance NATIVE_PREVIEW'] = t.startup.length === 0 && t.arts.every((_, i) => rendition(t, i) === 'NATIVE_PREVIEW');
    t.ctx.BE.settings.set('media.thumbQuality', 'sample'); await h.sleep(30);
    const s1 = t.take();
    v['L2: preview -> sample applies one owned write per card'] = onlyWebpWrites(s1, t, 5) && t.arts.every((a, i) => srcsets(a)[0] === u[i].sample && rendition(t, i) === 'OWNED_SAMPLE');
    t.ctx.BE.settings.set('media.thumbQuality', 'preview'); await h.sleep(30);
    t.take();
    v['L2: sample -> preview restores the native WebP srcset through the owner'] = t.arts.every((a, i) => srcsets(a).join() === [u[i].webp, u[i].preview].join() && rendition(t, i) === 'NATIVE_PREVIEW');
    t.refs[0].sources[0].setAttribute('srcset', u[0].preview); // native edit while previewing
    await h.sleep(10);
    t.ctx.BE.settings.set('media.thumbQuality', 'sample'); await h.sleep(30);
    v['L2: a natively touched attribute is refused, the native edit stays'] = srcsets(t.arts[0])[0] === u[0].preview && rendition(t, 0) === 'REFUSED_NATIVE_TOUCHED' && srcsets(t.arts[1])[0] === u[1].sample;
    t.w.close();
  }
  // L3 original
  {
    const t = await start({ settings: quality('original'), html: listing({ cards: [...ids(5).map((id) => card(id)), card('20', 'noFile'), card('21', 'video'), card('22', 'gif')] }), source });
    const recs = t.startup;
    const u = t.arts.map((a) => U(a.getAttribute('data-id')));
    v['L3: original writes the native file URL to the WebP srcset only (distinct from sample)'] = onlyWebpWrites(recs, t, 5)
      && t.arts.slice(0, 5).every((a, i) => srcsets(a).join() === [u[i].file, u[i].preview].join() && rendition(t, i) === 'OWNED_ORIGINAL');
    v['L3: no usable native file, video and GIF stay native'] = [5, 6, 7].every((i) => rsig(t.arts[i]) === t.initial[i]) && rendition(t, 5) === 'NATIVE_UNSUPPORTED' && rendition(t, 6) === 'NATIVE_UNSUPPORTED' && rendition(t, 7) === 'NATIVE_UNSUPPORTED';
    v['L8: original keeps the stored intent unchanged'] = t.stored() === JSON.stringify('original') && t.gm.thumbQualityWrites === 0;
    t.w.close();
  }
  // L4 malformed shapes
  {
    const t = await start({ html: listing({ cards: MALFORMED.map((k, i) => card(String(100 + i), k)) }), source });
    v['L4: every non-pattern shape makes zero rendition writes'] = t.startup.length === 0 && t.arts.every((a, i) => rsig(a) === t.initial[i]);
    v['L4: non-pattern cards report NATIVE_UNSUPPORTED and keep other enhancements'] = t.arts.every((a, i) => rendition(t, i) === 'NATIVE_UNSUPPORTED' && a.classList.contains('be-thumb-wrap'));
    t.w.close();
  }
  // L5 dispose with native edit, move and replacements; re-init cycles
  {
    const t = await start({ source });
    t.take();
    const u = t.arts.map((a) => U(a.getAttribute('data-id')));
    const d = t.w.document;
    const fresh = (tag, attrs) => { const el = d.createElement(tag); for (const [n, x] of Object.entries(attrs)) el.setAttribute(n, x); return el; };
    t.refs[1].sources[0].setAttribute('srcset', u[1].preview);
    t.refs[2].sources[1].after(t.refs[2].sources[0]);
    t.refs[3].sources[0].replaceWith(fresh('source', { srcset: u[3].webp, type: 'image/webp' }));
    const p = fresh('picture', {}); p.append(fresh('source', { srcset: u[4].webp, type: 'image/webp' }), fresh('source', { srcset: u[4].preview, type: 'image/jpeg' }), fresh('img', { src: u[4].preview, alt: '' }));
    t.refs[4].picture.replaceWith(p);
    await h.sleep(10);
    t.take();
    t.G().dispose();
    await h.sleep(10);
    const dr = t.take();
    v['L5: dispose restores the control card'] = srcsets(t.arts[0]).join() === [u[0].webp, u[0].preview].join();
    v['L5: dispose keeps a native edit'] = srcsets(t.arts[1]).join() === [u[1].preview, u[1].preview].join();
    v['L5: dispose restores a moved source in its native order'] = [...t.arts[2].querySelectorAll('source')].map((s) => s.getAttribute('type')).join() === 'image/jpeg,image/webp' && srcsets(t.arts[2]).join() === [u[2].preview, u[2].webp].join();
    v['L5: replaced source and replaced picture are untouched'] = srcsets(t.arts[3]).join() === [u[3].webp, u[3].preview].join() && srcsets(t.arts[4]).join() === [u[4].webp, u[4].preview].join();
    v['L5: dispose writes only the two restorations, no node operations'] = onlyWebpWrites(dr, t, 2);
    v['L5: no sample residue on any connected node'] = ![...d.querySelectorAll('source, img')].some((el) => /\/sample\//.test(el.getAttribute('srcset') || '') || /\/sample\//.test(el.getAttribute('src') || ''));
    t.w.close();
  }
  {
    const t = await start({ source });
    const container = t.w.document.querySelector('#posts-container');
    for (let k = 0; k < 5; k++) { t.G().dispose(); t.G().init(container); await h.sleep(10); }
    const u = t.arts.map((a) => U(a.getAttribute('data-id')));
    const appliedAfterCycles = t.arts.every((a, i) => srcsets(a)[0] === u[i].sample);
    t.G().dispose(); await h.sleep(10);
    v['L5: five dispose/init cycles stay bounded and end native'] = appliedAfterCycles && t.arts.every((a, i) => srcsets(a).join() === [u[i].webp, u[i].preview].join());
    t.w.close();
  }
  // L6 login state and route
  for (const [label, opts] of [['logged in (data-user-is-anonymous="false")', { html: listing({ anon: 'false' }) }], ['marker absent', { html: listing({ anon: null }) }],
    ['marker value not exactly "true"', { html: listing({ anon: 'TRUE' }) }], ['non-/posts route', { url: 'https://e621.net/favorites' }], ['e926 logged in', { url: 'https://e926.net/posts', html: listing({ anon: 'false' }) }]]) {
    const t = await start({ ...opts, source });
    v[`L6 ${label}: zero rendition writes, NATIVE_OUT_OF_SCOPE, other enhancements kept`] = t.startup.length === 0 && t.arts.every((a, i) => rendition(t, i) === 'NATIVE_OUT_OF_SCOPE' && a.classList.contains('be-thumb-wrap'));
    v[`L8 ${label}: stored thumbQuality intent retained while inert`] = t.gm.thumbQualityWrites === 0 && t.ctx.BE.settings.get('media.thumbQuality') === 'sample';
    t.w.close();
  }
  {
    const t = await start({ html: listing({ anon: 'false' }), settings: quality('original'), source });
    v['L8 logged in: saved "original" stays stored and readable while inert'] = t.startup.length === 0 && t.stored() === JSON.stringify('original') && t.ctx.BE.settings.get('media.thumbQuality') === 'original';
    t.w.close();
  }
  // L7 other hosts / adapters
  for (const [label, url] of [['subdomain of e621.net (adapter active, host not admitted)', 'https://sub.e621.net/posts'], ['rule34.xxx', 'https://rule34.xxx/index.php?page=post&s=list'], ['gelbooru.com', 'https://gelbooru.com/index.php?page=post&s=list']]) {
    const t = await start({ url, source });
    v[`L7 ${label}: zero rendition writes`] = t.startup.length === 0 && t.arts.every((a, i) => rsig(a) === t.initial[i]);
    t.w.close();
  }
  return v;
}

// ---- production mutants ------------------------------------------------------------
const mut = (s, from, to) => { if (s.split(from).length !== 2) throw new Error(`mutant pattern not unique: ${from.slice(0, 60)}`); return s.replace(from, to); };
const W = "if (!owner.ownAttribute(p.webpSource, 'srcset', target)) return 'REFUSED_NATIVE_TOUCHED';";
const MUTANTS = {
  'also writes the JPEG source': (s) => mut(s, W, `${W} owner.ownAttribute(p.webpSource.nextElementSibling, 'srcset', target);`),
  'also writes img src': (s) => mut(s, W, `${W} owner.ownAttribute(img, 'src', target);`),
  'adds img srcset': (s) => mut(s, W, `${W} owner.ownAttribute(img, 'srcset', target);`),
  'clones/replaces the source node': (s) => mut(s, W, "{ const n = p.webpSource.cloneNode(true); n.setAttribute('srcset', target); p.webpSource.replaceWith(n); }"),
  'writes outside the owner (no native-touch refusal)': (s) => mut(s, W, "p.webpSource.setAttribute('srcset', target);"),
  'constructs a URL': (s) => mut(s, "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : null;", "const target = quality === 'sample' ? p.sample + '?q=1' : quality === 'original' ? p.file : null;"),
  'preview writes the JPEG preview (old behavior)': (s) => mut(s, "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : null;", "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : wrap.getAttribute('data-preview-url');"),
  'original mapped to sample': (s) => mut(s, "const target = quality === 'sample' ? p.sample : quality === 'original' ? p.file : null;", "const target = quality === 'sample' || quality === 'original' ? p.sample : null;"),
  'switch back to preview not restored': (s) => mut(s, "return owner.ownAttribute(p.webpSource, 'srcset', p.nativeWebp) ? outcome : 'REFUSED_NATIVE_TOUCHED';", 'return outcome;'),
  'login gate removed': (s) => mut(s, "\t\t\t\t&& document.body?.getAttribute('data-user-is-anonymous') === 'true';", '\t\t\t\t&& true;'),
  'login gate on attribute presence only': (s) => mut(s, "document.body?.getAttribute('data-user-is-anonymous') === 'true';", "document.body?.hasAttribute('data-user-is-anonymous');"),
  'route gate removed': (s) => mut(s, "\t\t\t\t&& /^\\/posts\\/?$/.test(location.pathname)\n", ''),
  'host gate removed': (s) => mut(s, "\t\t\t\t&& (location.hostname === 'e621.net' || location.hostname === 'e926.net')\n", ''),
  'pattern gate: source shape not checked': (s) => mut(s, "if (kids.length !== 3 || kids[2] !== img) return null;", 'if (kids.length < 2) return null;'),
  'pattern gate: sizes/media not checked': (s) => mut(s, "if (s.hasAttribute('sizes') || s.hasAttribute('media')) return null;", ''),
  'pattern gate: media type not checked': (s) => mut(s, "if (!E6_RENDITION_EXT.has(String(wrap.getAttribute('data-file-ext') || '').toLowerCase())) return null;", ''),
  'request from the rendition path': (s) => mut(s, W, `${W} BE.net.request({ url: location.origin + '/posts.json' }, 1).catch(() => {});`),
  'overwrites saved intent while inert': (s) => mut(s, "if (!img || !wrap || !owner || !e6RenditionAdmitted()) return 'NATIVE_OUT_OF_SCOPE';", "if (!img || !wrap || !owner || !e6RenditionAdmitted()) { GM_setValue('be:setting:media.thumbQuality', JSON.stringify('sample')); return 'NATIVE_OUT_OF_SCOPE'; }"),
  'no dispose restore (owner bypassed on apply)': (s) => mut(s, "if (!e6NativeWebpSrcset.has(p.webpSource)) {\n", "if (false) {\n"),
};

// Each suite (production or one mutant) runs in its own child process, in parallel.
function runSuiteChild(key) {
  return new Promise((resolve) => {
    execFile(process.execPath, [__filename, '--suite', key], { maxBuffer: 16 * 1024 * 1024, timeout: 180000 }, (err, stdout) => {
      try { resolve(JSON.parse(stdout.slice(stdout.indexOf('{')))); } catch { resolve({ __crash: String(err || stdout).slice(0, 200) }); }
    });
  });
}
async function pool(keys, n) {
  const out = {}; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < keys.length) { const k = keys[i++]; out[k] = await runSuiteChild(k); } }));
  return out;
}

async function main() {
  if (process.argv[2] === '--suite') {
    const key = process.argv[3];
    const v = await suite(key === 'base' ? PROD : MUTANTS[key](PROD));
    process.stdout.write(JSON.stringify(v), () => process.exit(0));
    return;
  }
  const keys = ['base', ...Object.keys(MUTANTS)];
  for (const k of keys.slice(1)) { try { MUTANTS[k](PROD); } catch (e) { check(`fault ${k}: mutant applied`, false, e.message); } }
  const verdicts = await pool(keys, Math.max(2, Math.min(6, require('os').cpus().length - 1)));
  const base = verdicts.base;
  for (const [name, ok] of Object.entries(base)) check(name, ok, 'production verdict false');

  // L9: earlier suites stay green (assertions and controls; the IB07 suites pin the IB07 artifact blob by design).
  const runJson = (dir, file) => { try { return execFileSync('node', [file], { cwd: path.join(REPO, dir), encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { return String(e.stdout || ''); } };
  for (const [dir, file] of [['tests/host/ib07', 'item9_assertions.cjs'], ['tests/host/ib07', 'pagecount_assertions.cjs'], ['tests/host/ib07', 'exclusion_assertions.cjs'], ['tests/host/ib07', 'gelbooru_native_post.cjs']]) {
    const out = runJson(dir, file);
    const failLists = [...out.matchAll(/"(fail|failed|controlFailures|mismatchesAgainstExpected)": \[([^\]]*)\]/g)];
    // Two report formats: named failure lists (must be empty) or per-item "pass" booleans (none false).
    const passItems = (out.match(/"pass": (true|false)/g) || []);
    const ok = (failLists.length > 0 || passItems.length > 0) && failLists.every((m) => m[2].trim() === '') && !passItems.includes('"pass": false');
    check(`L9 ${file}: all assertions and controls pass on the new production`, ok, failLists.map((m) => m[0].slice(0, 80)).join(' | ') || out.slice(-300));
  }
  for (const [dir, file] of [['tests/browser/ib08', 'verify_v9r_ownership_experiment.cjs'], ['tests/browser/ib08', 'verify_v9r_baseline_probe.cjs'], ['tests/browser/ib08', 'verify_b1_login_state_probe.cjs']]) {
    const out = runJson(dir, file);
    const m = out.match(/(\d+)\/(\d+) checks passed/);
    check(`L9 ${file}: ${m ? `${m[1]}/${m[2]}` : 'no result'}`, m && m[1] === m[2], out.slice(-200));
  }

  // Fault controls: every mutant must flip at least one verdict.
  for (const name of Object.keys(MUTANTS)) {
    const v = verdicts[name];
    if (!v || v.__crash) { check(`fault ${name}: caught by crash/timeout`, true, v && v.__crash); continue; }
    const flipped = Object.keys(base).filter((k) => base[k] && !v[k]);
    check(`fault ${name}: caught (${flipped.length} verdicts; e.g. ${(flipped[0] || 'none').slice(0, 60)})`, flipped.length > 0, 'mutant passed every verdict');
  }

  const passed = results.filter((x) => x.pass).length;
  const summary = {
    checkpoint: 'IB08', stage: 'P (local production assertions L1–L9)', evidence_gate: 'G-RENDITION',
    production_blob: h.gitBlobId(PROD),
    fixtures: 'synthetic, not live markup',
    checks: results.length, passed, failed: results.length - passed,
    fault_controls: results.filter((x) => x.name.startsWith('fault ')).map((x) => ({ name: x.name, pass: x.pass })),
    failures: results.filter((x) => !x.pass),
  };
  fs.writeFileSync(path.join(__dirname, 'rendition-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
